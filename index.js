const {existsSync} = require('fs');
const {appendFile, readFile, readdir} = require('fs').promises;
const {join} = require('path');
const toml = require('@iarna/toml');
const cpx = require('cpx');
const build = require('netlify-lambda/lib/build');

const functionsBuildDir = `functions-build-${Date.now()}`;
let netlifyToml = {};
let isProject = false;
let isActions = false;

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
async function deployActions({run, functionsDir, timeout, memory}) {
  const files = await readdir(functionsDir);

  await Promise.all(
    files.map(async (file) => {
      const [actionName, extension] = file.split('.');
      let command =
        `nim action update ${actionName} ${join(functionsDir, file)} ` +
        `--timeout=${Number(timeout)} --memory=${Number(memory)} ` +
        `--web=raw `;

      if (extension === 'js') {
        command += '--kind nodejs-lambda:10 --main handler';
      }

      const {stderr, exitCode} = await run.command(command, {
        reject: false,
        stdout: 'ignore'
      });
      const message = exitCode === 0 ? 'done.' : String(stderr);
      console.log(`Deploying ${file}: ${message}`);
    })
  );
}

module.exports = {
  // Execute before build starts.
  onPreBuild: async ({utils, constants, inputs}) => {
    try {
      if (!process.env.NIMBELLA_LOGIN_TOKEN) {
        utils.build.failBuild(
          'Nimbella login token not available. Please run `netlify addons:create nimbella` at the base of your local project directory linked to your Netlify site.'
        );
      }

      const nimConfig = join(require('os').homedir(), '.nimbella');
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

      if (constants.CONFIG_PATH && existsSync(constants.CONFIG_PATH)) {
        netlifyToml = toml.parse(await readFile(constants.CONFIG_PATH));
      }

      isActions = inputs.functions ? existsSync(inputs.functions) : false;
      isProject = existsSync('packages');
    } catch (error) {
      utils.build.failBuild(error.message);
    }
  },
  // Build the functions
  onBuild: async ({utils, inputs}) => {
    try {
      if (isActions) {
        // Here we're passing the build directory instead of source because source is extracted from inputs.functions.
        const stats = await build.run(functionsBuildDir, inputs.functions);
        console.log(stats.toString(stats.compilation.options.stats));
        // Copy any files that do not end with .js. T
        cpx.copy(inputs.functions + '/**/*.!(js)', functionsBuildDir);
      }
    } catch (error) {
      utils.build.failBuild(error.message);
    }
  },
  // Execute after build is done.
  onPostBuild: async ({constants, utils, inputs}) => {
    try {
      const {stdout: namespace} = await utils.run.command(`nim auth current`);

      if (process.env.CONTEXT === 'production') {
        if (isProject) {
          await deployProject(utils.run);
        }

        if (isActions) {
          console.log('\n------------------Functions------------------\n');
          await deployActions({
            run: utils.run,
            functionsDir: functionsBuildDir,
            timeout: inputs.timeout, // Default is 6 seconds
            memory: inputs.memory // Default is 256MB (max for free tier)
          });
        }
      } else {
        console.log(
          `Skipping the deployment to Nimbella as the context (${process.env.CONTEXT}) is not production.`
        );
      }

      const redirectRules = [];
      const redirects = [];
      const redirectsFile = join(constants.PUBLISH_DIR, '_redirects');

      if (isActions) {
        if (existsSync(redirectsFile)) {
          console.log(
            "Found _redirects file. We will rewrite rules that redirect (200 rewrites) to '/.netlify/functions/*'."
          );
          const {parseRedirectsFormat} = require('netlify-redirect-parser');
          const {success} = await parseRedirectsFormat(redirectsFile);
          redirects.push(...success);
        }

        if (netlifyToml.redirects) {
          console.log(
            "Found redirect rules in netlify.toml. We will rewrite rules that redirect (200 rewrites) to '/.netlify/functions/*'."
          );
          redirects.push(...netlifyToml.redirects);
        }

        for (const redirect of redirects) {
          if (
            redirect.status === 200 &&
            redirect.to.startsWith('/.netlify/functions/')
          ) {
            const redirectPath = redirect.to.split('/.netlify/functions/')[1];
            redirectRules.push(
              `${redirect.from} https://apigcp.nimbella.io/api/v1/web/${namespace}/default/${redirectPath} 200!`
            );
          }
        }
      }

      let {path: redirectPath} = inputs;
      redirectPath = redirectPath.endsWith('/')
        ? redirectPath
        : redirectPath + '/';

      if (isProject) {
        redirectRules.push(
          `${redirectPath}* https://apigcp.nimbella.io/api/v1/web/${namespace}/:splat 200!`
        );
      }

      if (isActions && !isProject) {
        redirectRules.push(
          `${redirectPath}* https://apigcp.nimbella.io/api/v1/web/${namespace}/default/:splat 200!`
        );
      }

      await appendFile(redirectsFile, redirectRules.join('\n'));
    } catch (error) {
      utils.build.failBuild(error.message);
    }
  }
};
