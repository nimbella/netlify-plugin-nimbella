const {existsSync} = require('fs');
const {appendFile, readFile} = require('fs').promises;
const {join} = require('path');
const toml = require('@iarna/toml');

const nim = `npx -p https://apigcp.nimbella.io/downloads/nim/nimbella-cli.tgz nim`;

/**
 * Deploy a Nimbella Project.
 * @param {*} run - function provided under utils by Netlify to build event functions.
 */
async function deployProject(run) {
  await run.command(`${nim} project deploy . --exclude=web`);
}

module.exports = {
  // Execute before build starts.
  onPreBuild: async ({utils, inputs}) => {
    if (!process.env.NIMBELLA_LOGIN_TOKEN && !inputs.nimbellaToken) {
      utils.build.failBuild(
        'Nimbella login token not available. Please run `netlify addons:create nimbella` at the base of your local project directory linked to your Netlify site.'
      );
    }

    const nimConfig = join(process.env.HOME, '.nimbella');
    await utils.cache.restore(nimConfig);

    const isLoggedIn = existsSync(nimConfig);
    // Login if not logged in before.
    if (!isLoggedIn || process.env.NETLIFY) {
      await utils.run.command(
        `${nim} auth login ${
          process.env.NIMBELLA_LOGIN_TOKEN || inputs.nimbellaToken
        }`
      );

      // Cache the nimbella config to avoid logging in for consecutive builds.
      await utils.cache.save(nimConfig);
    }
  },

  // Execute after build is done.
  onPostBuild: async ({constants, utils}) => {
    const config = toml.parse(await readFile(constants.CONFIG_PATH));
    const {stdout: namespace} = await utils.run.command(`${nim} auth current`);

    await deployProject(utils.run);

    // Add Netlify redirect rule to redirect api calls to Nimbella.
    const redirectRule = `${
      config.nimbella.path ? config.nimbella.path : '/api/'
    }* https://apigcp.nimbella.io/api/v1/web/${namespace}/:splat 200!\n`;

    await appendFile(join(constants.PUBLISH_DIR, '_redirects'), redirectRule);
  }
};
