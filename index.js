const {existsSync} = require('fs');
const {appendFile, readFile, readdir, writeFile} = require('fs').promises;
const {join} = require('path');
const toml = require('@iarna/toml');
const cpx = require('cpx');
const build = require('netlify-lambda/lib/build');

let config = {};
let isProject = false;
let isActions = false;
const functionsBuildDir = `functions-build-${Date.now()}`;
const NIM_CLI = 'https://apigcp.nimbella.io/downloads/nim/nimbella-cli.tgz';

// Disable auto updates of nim.
process.env.NIM_DISABLE_AUTOUPDATE = '1';

/**
 * Deploy a Nimbella Project.
 * @param {*} run - function provided under utils by Netlify to build event functions.
 */
async function deployProject(run) {
  await run.command(`nim project deploy . --exclude=web`);
}

/**
 * Deploy actions under a directory. Currently limited to lambda functions.
 * @param {function} run - function provided under utils by Netlify to build event functions.
 * @param {string} functionsDir - Path to the actions directory.
 */
async function deployActions({
  run,
  functionsDir,
  secretsPath,
  timeout,
  memory
}) {
  const files = await readdir(functionsDir);
  for (const file of files) {
    const [actionName, extension] = file.split('.');
    let command =
      `nim action update ${actionName} ${join(functionsDir, file)} ` +
      `--timeout=${Number(timeout)} --memory=${Number(memory)} ` +
      `--web=raw --env-file=${secretsPath} `;

    if (extension === 'js') {
      command += '--kind nodejs-lambda:10 --main handler';
    }

    // Deploy
    console.log(`Deploying ${file}...`);
    const {stdout, stderr, exitCode} = await run.command(command, {
      reject: false,
      stdout: 'ignore'
    });

    if (exitCode === 0) {
      console.log('done.');
    } else {
      console.log(stdout || stderr);
    }
  }
}

module.exports = {
  // Execute before build starts.
  onPreBuild: async ({utils, constants}) => {
    try {
      if (!process.env.NIMBELLA_LOGIN_TOKEN) {
        utils.build.failBuild(
          'Nimbella login token not available. Please run `netlify addons:create nimbella` at the base of your local project directory linked to your Netlify site.'
        );
      }

      console.log('Installing nimbella cli...');
      await utils.run.command(`npm i -g ${NIM_CLI}`);

      const nimConfig = join(process.env.HOME, '.nimbella');
      await utils.cache.restore(nimConfig);

      const loggedIn = existsSync(nimConfig);
      // Login if not logged in before.
      if (loggedIn) {
        console.log('\nUsing the following namespace.');
        await utils.run.command('nim auth current');
      } else {
        await utils.run.command(
          `nim auth login ${process.env.NIMBELLA_LOGIN_TOKEN}`
        );

        // Cache the nimbella config to avoid logging in for consecutive builds.
        await utils.cache.save(nimConfig);
      }

      config = toml.parse(await readFile(constants.CONFIG_PATH));
      isProject = existsSync('packages');
      isActions = existsSync(config.nimbella.functions);
    } catch (error) {
      utils.build.failBuild(error.message);
    }
  },
  // Build the functions
  onBuild: async ({utils}) => {
    try {
      if (isActions) {
        // Here we're passing the build directory instead of source because source is extracted from config.nimbella.functions.
        const stats = await build.run(functionsBuildDir);
        console.log(stats.toString(stats.compilation.options.stats));
        // Copy any files that do not end with .js. T
        cpx.copy(config.nimbella.functions + '/**/*.!(js)', functionsBuildDir);
      }
    } catch (error) {
      utils.build.failBuild(error.message);
    }
  },
  // Execute after build is done.
  onPostBuild: async ({constants, utils}) => {
    try {
      // Create env.json
      const envs = {...process.env};
      // Remove CI related variables.
      delete envs.NETLIFY;
      delete envs.CI;
      await writeFile('env.json', JSON.stringify(envs));

      if (isProject) {
        await deployProject(utils.run);
      }

      if (isActions) {
        await deployActions({
          run: utils.run,
          functionsDir: functionsBuildDir,
          secretsPath: join(process.cwd(), 'env.json'),
          timeout: config.nimbella.timeout || 6000, // Default is 10 seconds
          memory: config.nimbella.memory || 256 // Default is 256MB (max for free tier)
        });
      }

      const redirectRules = [];
      const redirects = [];
      const redirectsFile = join(constants.PUBLISH_DIR, '_redirects');

      if (existsSync(redirectsFile)) {
        console.log(
          "Found _redirects file. We will rewrite rules that redirect (200 rewrites) to '/.netlify/functions/*'."
        );
        const {parseRedirectsFormat} = require('netlify-redirect-parser');
        const {success} = await parseRedirectsFormat(redirectsFile);
        redirects.push(...success);
      }

      if (config.redirects) {
        console.log(
          "Found redirect rules in netlify.toml. We will rewrite rules that redirect (200 rewrites) to '/.netlify/functions/*'."
        );
        redirects.push(...config.redirects);
      }

      for (const redirect of redirects) {
        if (redirect.status === 200) {
          if (redirect.to.startsWith('/.netlify/functions/')) {
            const redirectPath = redirect.to.split('/.netlify/functions/')[1];
            redirectRules.push(
              `${redirect.from} /.netlify/nimbella/default/${redirectPath} 301!`
            );
          }
        }
      }

      let {path: redirectPath = '.netlify/functions'} = config.nimbella;
      redirectPath = redirectPath.endsWith('/')
        ? redirectPath
        : redirectPath + '/';

      if (isProject) {
        redirectRules.push(`${redirectPath}* /.netlify/nimbella/:splat 301!`);
      }

      if (isActions && !isProject) {
        redirectRules.push(
          `${redirectPath}* /.netlify/nimbella/default/:splat 301!`
        );
      }

      await appendFile(redirectsFile, redirectRules.join('\n'));
    } catch (error) {
      utils.build.failBuild(error.message);
    }
  }
};
