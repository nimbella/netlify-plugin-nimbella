const {appendFile} = require('fs').promises;
const {join} = require('path');

module.exports = {
  onPostBuild: async ({constants, utils, inputs}) => {
    // // Login
    // await utils.run.command(
    //   `npx nim auth login ${process.env.NIM_TOKEN || inputs.nimbellaToken}`
    // );

    // Redirect api calls
    const {stdout} = await utils.run.command('npx nim auth current');
    const namespace = stdout.trim();
    const redirectRule = `/api/* https://apigcp.nimbella.io/api/v1/web/${namespace}/default/:splat 200!`;
    await appendFile(join(constants.PUBLISH_DIR, '_redirects'), redirectRule);

    const {readdir} = require('fs').promises;
    const files = await readdir(constants.FUNCTIONS_SRC);

    for (const file of files) {
      // Deploy
      console.log(`Deploying ${file}...`);
      const {stdout, stderr} = await utils.run.command(
        `npx nim action create ${file.split('.')[0]} ${join(
          constants.FUNCTIONS_SRC,
          file
        )} --kind nodejs-lambda:10 --main handler --web=true`
      );

      if (!stdout || !stderr) {
        console.log('done.');
      } else {
        console.log(stdout || stderr);
      }
    }
  }
};
