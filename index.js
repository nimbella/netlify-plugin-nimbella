const {appendFile, readFile, readdir, existsSync} = require('fs');
const {join} = require('path');
const toml = require('@iarna/toml');

const nim = `npx -p https://apigcp.nimbella.io/downloads/nim/nimbella-cli.tgz nim`;

const isLoggedIn = existsSync(join(process.env.HOME, '.nimbella'));

/**
 * Deploy a Nimbella Project.
 * @param {*} run - function provided under utils by Netlify to build event functions.
 */
async function deployProject(run) {
  await run.command(`${nim} project deploy . --exclude=web`);
}

/**
 * Deploy actions under a directory. Currently limited to lambda functions.
 * @param {string} functionsDir - Path to the actions directory.
 */
async function deployActions(functionsDir) {
  const files = await readdir(functionsDir);
  for (const file of files) {
    // Deploy
    console.log(`Deploying ${file}...`);
    const {stderr, exitCode} = await utils.run.command(
      `${nim} action update ${file.split('.')[0]} ${join(
        functionsDir,
        file
      )} --kind nodejs-lambda:10 --main handler --web=true`,
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
  onPreBuild: async ({utils, inputs}) => {
    if (!process.env.NIM_TOKEN && !inputs.nimbellaToken) {
      utils.build.failBuild(
        'Token not present. Please setup an env named `NIM_TOKEN`.'
      );
    }

    // Login if not logged in before.
    if (!isLoggedIn || process.env.NETLIFY) {
      await utils.run.command(
        `${nim} auth login ${process.env.NIM_TOKEN || inputs.nimbellaToken}`
      );
    }
  },
  // Execute after build is done.
  onPostBuild: async ({constants, utils}) => {
    const config = toml.parse(await readFile(constants.CONFIG_PATH));
    const {stdout: namespace} = await utils.run.command(`${nim} auth current`);
    const isProject = existsSync('packages');
    const isActions = existsSync(config.nimbella.functions);

    if (isProject) {
      await deployProject(utils.run);
    }

    if (isActions) {
      await deployActions(config.nimbella.functions);
    }

    // Add a Netlify redirect rule to redirect api calls to Nimbella.
    const redirectRule = `${
      config.nimbella.path ? config.nimbella.path : '.netlify/functions/'
    }* https://apigcp.nimbella.io/api/v1/web/${namespace}/default/:splat 200!\n`;

    await appendFile(join(constants.PUBLISH_DIR, '_redirects'), redirectRule);
  }
};
