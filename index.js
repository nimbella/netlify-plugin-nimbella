const {appendFile} = require('fs').promises;
const {join} = require('path');

module.exports = {
  onPostBuild: async ({constants}) => {
    // Login
    await utils.run.command(`npx nim auth login ${process.env.NIM_TOKEN}`);

    // Redirect api calls
    const {stdout} = await utils.run.command('npx nim auth current');
    const namespace = stdout.trim();
    const redirectRule = `/api/* https://${namespace}-apigcp.nimbella.io/api/:splat 200`;
    await appendFile(join(constants.PUBLISH_DIR, '_redirects'), redirectRule);

    // Deploy
    await utils.run.command(
      `cd ${constants.FUNCTIONS_DIST} && npx nim project deploy`
    );
  }
};
