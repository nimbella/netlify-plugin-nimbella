const {existsSync} = require('fs');
const {appendFile, readFile, readdir} = require('fs').promises;
const {join} = require('path');
const toml = require('@iarna/toml');
const build = require('netlify-lambda/lib/build');

let config = {};
let isProject = false;
let isActions = false;
const functionsBuildDir = `functions-build-${Date.now()}`;
const nim = `npx -p https://apigcp.nimbella.io/downloads/nim/nimbella-cli.tgz nim`;

/**
 * Deploy a Nimbella Project.
 * @param {*} run - function provided under utils by Netlify to build event functions.
 */
async function deployProject(run) {
  await run.command(`${nim} project deploy . --exclude=web`);
}

/**
 * Deploy actions under a directory. Currently limited to lambda functions.
 * @param {function} run - function provided under utils by Netlify to build event functions.
 * @param {string} functionsDir - Path to the actions directory.
 */
async function deployActions({run, functionsDir, secretsPath}) {
  const files = await readdir(functionsDir);
  for (const file of files) {
    // Deploy
    console.log(`Deploying ${file}...`);
    const {stderr, exitCode} = await run.command(
      `${nim} action update ${file.split('.')[0]} ${join(
        functionsDir,
        file
      )} --kind nodejs-lambda:10 --main handler --web=raw --env-file=${secretsPath}`,
      {reject: false, stdout: 'ignore'}
    );

    if (exitCode === 0) {
      console.log('done.');
    } else {
      console.log(stdout || stderr);
    }
  }
}

module.exports = {
  // Execute before build starts.
  onPreBuild: async ({utils, inputs, constants}) => {
    if (!process.env.NIMBELLA_LOGIN_TOKEN && !inputs.nimbellaToken) {
      utils.build.failBuild(
        'Nimbella login token not available. Please run `netlify addons:create nimbella` at the base of your local project directory linked to your Netlify site.'
      );
    }

    const nimConfig = join(process.env.HOME, '.nimbella');
    await utils.cache.restore(nimConfig);

    const isLoggedIn = existsSync(nimConfig);
    // Login if not logged in before.
    if (!isLoggedIn) {
      await utils.run.command(
        `${nim} auth login ${
          process.env.NIMBELLA_LOGIN_TOKEN || inputs.nimbellaToken
        }`
      );

      // Cache the nimbella config to avoid logging in for consecutive builds.
      await utils.cache.save(nimConfig);
    } else {
      console.log('Using cached auth credentials.');
    }

    config = toml.parse(await readFile(constants.CONFIG_PATH));
    isProject = existsSync('packages');
    isActions = existsSync(config.nimbella.functions);
  },
  // Build the functions
  onBuild: async ({utils}) => {
    try {
      if (isActions) {
        // Here we're passing the build directory instead of source because source is extracted from config.nimbella.functions.
        const stats = await build.run(functionsBuildDir);
        console.log(stats.toString(stats.compilation.options.stats));
      }
    } catch (error) {
      utils.build.failBuild(error.message);
    }
  },
  // Execute after build is done.
  onPostBuild: async ({constants, utils}) => {
    const {stdout: namespace} = await utils.run.command(`${nim} auth current`);

    // Create env.json
    const fs = require('fs');
    const envs = {...process.env};
    // Remove CI related variables.
    delete envs.NETLIFY;
    delete envs.CI;
    fs.writeFileSync('env.json', JSON.stringify(envs));

    if (isProject) {
      // TODO(satyarohith): Figure out how to export secrets while deploying as a project.
      await deployProject(utils.run);
    }

    if (isActions) {
      await deployActions({
        run: utils.run,
        functionsDir: functionsBuildDir,
        secretsPath: join(process.cwd(), 'env.json')
      });
    }

    // Add a Netlify redirect rule to redirect api calls to Nimbella.
    const redirectRule = `${
      config.nimbella.path ? config.nimbella.path : '.netlify/functions/'
    }* https://apigcp.nimbella.io/api/v1/web/${namespace}/default/:splat 200!\n`;

    await appendFile(join(constants.PUBLISH_DIR, '_redirects'), redirectRule);
  }
};
