const {existsSync} = require('fs')
const {appendFile, readFile, readdir, writeFile} = require('fs').promises
const {join} = require('path')
const {homedir, tmpdir} = require('os')
const toml = require('@iarna/toml')
const cpx = require('cpx')
const build = require('netlify-lambda/lib/build')
const {parseRedirectsFormat} = require('netlify-redirect-parser')

const functionsBuildDir = `functions-build-${Date.now()}`
const nimConfig = join(homedir(), '.nimbella')
let netlifyToml = {}
let isProject = false
let isActions = false

// Disable auto updates of nim.
process.env.NIM_DISABLE_AUTOUPDATE = '1'

/**
 * Deploy a Nimbella Project.
 * @param {*} run - function provided under utils by Netlify to build event functions.
 */
async function deployProject(run) {
  await run.command(`nim project deploy . --exclude=web`)
}

/**
 * Deploy actions under a directory. Currently limited to lambda functions.
 * @param {function} run - function provided under utils by Netlify to build event functions.
 * @param {string} functionsDir - Path to the actions directory.
 */
async function deployActions({run, functionsDir, timeout, memory, envsFile}) {
  const files = await readdir(functionsDir)
  if (!existsSync(envsFile)) {
    envsFile = false
  }

  await Promise.all(
    files.map(async (file) => {
      const [actionName, extension] = file.split('.')
      const command = [
        `nim action update ${actionName} ${join(functionsDir, file)}`,
        `--timeout=${Number(timeout)} --memory=${Number(memory)} `,
        `--web=raw`
      ]

      if (extension === 'js') {
        command.push('--kind nodejs-lambda:10 --main handler')
      }

      if (envsFile) {
        command.push(`--env-file=${envsFile}`)
      }

      const {stderr, exitCode, failed} = await run.command(command.join(' '), {
        reject: false,
        stdout: 'ignore'
      })
      const message = exitCode === 0 && !failed ? 'done.' : String(stderr)
      console.log(`Deploying ${file}: ${message}`)
    })
  )
}

module.exports = {
  // Execute before build starts.
  onPreBuild: async ({utils, constants, inputs}) => {
    if (
      !process.env.NIMBELLA_LOGIN_TOKEN &&
      !(await utils.cache.has(nimConfig))
    ) {
      utils.build.failBuild(
        'Nimbella login token is not available. Please run `netlify addons:create nimbella` at the base of your local project directory linked to your Netlify site.'
      )
    }

    await utils.cache.restore(nimConfig)

    const loggedIn = existsSync(nimConfig)
    // Login if not logged in before.
    if (loggedIn) {
      try {
        const {stdout} = await utils.run.command('nim auth current', {
          stdout: 'pipe'
        })
        console.log(`Using the following namespace: ${stdout}`)
      } catch (error) {
        utils.build.failBuild(
          'Failed to retrieve the current namespace from cache',
          {error}
        )
      }
    } else {
      try {
        if (
          process.env.NIMBELLA_API_HOST &&
          process.env.NIMBELLA_API_HOST !== ''
        ) {
          await utils.run.command(
            `nim auth login ${process.env.NIMBELLA_LOGIN_TOKEN} --apihost ${process.env.NIMBELLA_API_HOST}`
          )
        } else {
          // Delegate to default apihost configured in the cli.
          await utils.run.command(
            `nim auth login ${process.env.NIMBELLA_LOGIN_TOKEN}`
          )
        }

        // Cache the nimbella config to avoid logging in for consecutive builds.
        await utils.cache.save(nimConfig)
      } catch (error) {
        utils.build.failBuild('Failed to login using the provided token', {
          error
        })
      }
    }

    if (constants.CONFIG_PATH && existsSync(constants.CONFIG_PATH)) {
      netlifyToml = toml.parse(await readFile(constants.CONFIG_PATH))
    }

    isActions = inputs.functions ? existsSync(inputs.functions) : false
    isProject = existsSync('packages')
  },
  // Build the functions
  onBuild: async ({utils, inputs}) => {
    try {
      if (isActions) {
        // Here we're passing the build directory instead of source because source is extracted from inputs.functions.
        const stats = await build.run(functionsBuildDir, inputs.functions)
        console.log(stats.toString(stats.compilation.options.stats))
        // Copy any files that do not end with .js. T
        cpx.copy(inputs.functions + '/**/*.!(js)', functionsBuildDir)
      }
    } catch (error) {
      utils.build.failBuild('Failed to build the functions', {error})
    }
  },
  // Execute after build is done.
  onPostBuild: async ({constants, utils, inputs}) => {
    const {stdout: namespace} = await utils.run.command(`nim auth current`)

    if (process.env.CONTEXT === 'production') {
      if (isProject) {
        try {
          await deployProject(utils.run)
        } catch (error) {
          utils.build.failBuild('Failed to deploy the project', {error})
        }
      }

      if (isActions) {
        console.log('\n------------------Functions------------------\n')
        try {
          if (inputs.envs.length > 0) {
            const envs = {}
            let envMessage = 'Forwarded the following environment variables: '
            inputs.envs.forEach((env, index) => {
              envs[env] = process.env[env]
              envMessage += index === inputs.envs.length - 1 ? env : env + ', '
            })
            await writeFile(join(tmpdir(), 'env.json'), JSON.stringify(envs))
            console.log(envMessage)
          }

          await deployActions({
            run: utils.run,
            envsFile: join(tmpdir(), 'env.json'),
            functionsDir: functionsBuildDir,
            timeout: inputs.timeout, // Default is 6 seconds
            memory: inputs.memory // Default is 256MB (max for free tier)
          })
        } catch (error) {
          utils.build.failBuild('Failed to deploy the functions', {error})
        }
      }
    } else {
      console.log(
        `Skipping the deployment to Nimbella as the context (${process.env.CONTEXT}) is not production.`
      )
    }

    const redirectRules = []
    const redirects = []
    const redirectsFile = join(constants.PUBLISH_DIR, '_redirects')
    let {stdout: apihost} = await utils.run.command(
      `nim auth current --apihost`
    )
    apihost = apihost.replace(/^(https:\/\/)/, '')

    // Creates or updates the _redirects file; this file takes precedence
    // over other redirect declarations, and is processed from top to bottom
    //
    // First: if we deployed netlify functions to nimbella, scan the redirects
    // for matching rewrites with /.netlify/functions/* as their target
    // and remap them to their nimbella api end points.
    //
    // Second: if there is an API path directive input.api, add a matching rule
    // to the _redirects file. The target is either the Nimbella namespace/:splat
    // or namespace/default/:splat. The latter is used when deploying Netlify functions
    // to Nimbella.
    //
    // The first set of rewrites is pre-pended to the _redirects file, then the second
    // set, if any.

    if (isActions) {
      if (existsSync(redirectsFile)) {
        console.log(
          "Found _redirects file. We will rewrite rules that redirect (200 rewrites) to '/.netlify/functions/*'."
        )
        const {success} = await parseRedirectsFormat(redirectsFile)
        redirects.push(...success)
      }

      if (netlifyToml.redirects) {
        console.log(
          "Found redirect rules in netlify.toml. We will rewrite rules that redirect (200 rewrites) to '/.netlify/functions/*'."
        )
        redirects.push(...netlifyToml.redirects)
      }

      for (const redirect of redirects) {
        if (
          redirect.status === 200 &&
          redirect.to &&
          redirect.to.startsWith('/.netlify/functions/')
        ) {
          const redirectPath = redirect.to.split('/.netlify/functions/')[1]
          redirectRules.push(
            `${
              redirect.from || redirect.path
            } https://${apihost}/api/v1/web/${namespace}/default/${redirectPath} 200!`
          )
        }
      }
    }

    let {path: redirectPath} = inputs
    redirectPath = redirectPath.endsWith('/')
      ? redirectPath
      : redirectPath + '/'

    if (isProject) {
      redirectRules.push(
        `${redirectPath}* https://${apihost}/api/v1/web/${namespace}/:splat 200!`
      )
    }

    if (isActions && !isProject) {
      redirectRules.push(
        `${redirectPath}* https://${apihost}/api/v1/web/${namespace}/default/:splat 200!`
      )
    }

    if (redirectRules.length > 0) {
      let content = ''
      if (existsSync(redirectsFile)) {
        content = await readFile(redirectsFile)
      } else if (!existsSync(constants.PUBLISH_DIR)) {
        const mkdir = require('make-dir')
        await mkdir(constants.PUBLISH_DIR)
      }

      // The rewrites take precedence
      await writeFile(redirectsFile, redirectRules.join('\n') + '\n')
      await appendFile(redirectsFile, content)
    }
  }
}
