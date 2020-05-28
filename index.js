const {appendFile, readFile, readdir} = require('fs').promises;
const fs = require('fs');
const {join} = require('path');
const toml = require('@iarna/toml');

const nim = `npx -p https://apigcp.nimbella.io/downloads/nim/nimbella-cli.tgz nim`;

module.exports = {
  onPreBuild: async ({constants, utils}) => {
    // Login
    if (process.env.NETLIFY) {
      await utils.run.command(
        `${nim} auth login ${process.env.NIM_TOKEN || inputs.nimbellaToken}`
      );
    }
  },
  onPostBuild: async ({constants, utils, inputs}) => {
    const config = toml.parse(await readFile(constants.CONFIG_PATH));
    const {stdout} = await utils.run.command(`${nim} auth current`);
    const namespace = stdout.trim();
    const packages = fs.existsSync('packages');

    if (packages) {
      await utils.run.command(`${nim} deploy . --exclude=web`);
    }

    // Redirect api calls
    const redirectRule = `${
      config.nimbella.path ? config.nimbella.path : '/.netlify/functions/'
    }* https://apigcp.nimbella.io/api/v1/web/${namespace}/${
      packages ? ':splat' : 'default/:splat'
    } 200!\n`;

    await appendFile(join(constants.PUBLISH_DIR, '_redirects'), redirectRule);

    // Deploy functions if they exist.
    if (fs.existsSync(config.nimbella.functions)) {
      const files = await readdir(config.nimbella.functions);

      for (const file of files) {
        // Deploy
        console.log(`Deploying ${file}...`);
        let {
          stderr,
          exitCode
        } = await utils.run.command(
          `${nim} action update ${file.split('.')[0]} ${join(
            config.nimbella.functions,
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
  }
};
