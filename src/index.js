const {existsSync} = require('fs')
const {appendFile, readFile, writeFile} = require('fs').promises
const {join} = require('path')
const {homedir} = require('os')
const {buildAndDeployNetlifyFunctions, rewriteRedirects} = require('./nfn')

const nimConfig = join(homedir(), '.nimbella')
let isProject = false // True if deploying a Nimbella project
let deployWeb = false // True if deploying a Nimbella project with a web folder and proxying the domain
let hasFunctions = false // True if deploying Netlify functions

// Disable auto updates of nim.
process.env.NIM_DISABLE_AUTOUPDATE = '1'

/**
 * Retrieves API host for current auth.
 * Assumes there is a valid auth already.
 */
async function getApiHost(run) {
  const {stdout: apihost} = await run.command(`nim auth current --apihost`)
  return apihost.replace(/^(https:\/\/)/, '')
}

/**
 * Deploy a Nimbella Project.
 * @param {*} run - function provided under utils by Netlify to build event functions.
 * @param {bool} includeWeb - flag to include/exclude web assets from project deploy
 */
async function deployProject(run, includeWeb) {
  if (includeWeb) {
    await run.command(`nim project deploy .`) // Do not exclude web folder
  } else {
    await run.command(`nim project deploy . --exclude=web`)
  }
}

// Creates or updates the _redirects file; this file takes precedence
// over other redirect declarations, and is processed from top to bottom
//
// If there is an API path directive input.path in the plugin settings, add a
// matching rule to the _redirects file. The target is the Nimbella namespace/:splat.
//
// If deploying the web assets as well, then proxy the entire domain instead.
async function addRedirect(inputs, {namespace, apihost}) {
  const redirectRules = []

  if (deployWeb) {
    redirectRules.push(`/* https://${namespace}-${apihost}/:splat 200!`)
  } else if (inputs.path) {
    const redirectPath = inputs.path.endsWith('/')
      ? inputs.path
      : inputs.path + '/'
    const pkg = isProject ? '' : 'default/'
    redirectRules.push(
      `${redirectPath}* https://${apihost}/api/v1/web/${namespace}/${pkg}:splat 200!`
    )
  }

  return redirectRules
}

/**
 * Checks inputs for validity.
 * Issues warning if deprecated input properties are used.
 * @param {object} inputs
 * @returns true iff input parameters are valid
 */
function checkInputsAndNotifyOfDeprecation(inputs) {
  const warn = (prop) => {
    const chalk = require('chalk')
    console.warn(
      chalk.yellow(`${prop} is deprecated.`),
      'Migrate to Nimbella project.yml.'
    )
  }

  const error = (prop, units) => {
    const chalk = require('chalk')
    console.warn(chalk.yellow(`${prop} must be a number in ${units}.`))
  }

  let valid = true
  if (inputs) {
    if (inputs.functions) warn('[inputs.functions]')
    if (inputs.timeout) {
      warn('[inputs.timeout]')
      if (Number.isNaN(Number(inputs.timeout))) {
        error('[inputs.timeout]', 'milliseconds in [100-10000])')
        valid = false
      }
    }

    if (inputs.memory) {
      warn('[inputs.memory]')
      if (Number.isNaN(Number(inputs.memory))) {
        error('[inputs.memory]', 'megabytes in [128-512])')
        valid = false
      }
    }
  }

  return valid
}

async function constructDotEnvFile(inputs) {
  if (inputs.envs && inputs.envs.length > 0) {
    console.log('Forwarding environment variables:')
    let envVars = ''
    inputs.envs.forEach((env) => {
      console.log(`\t- ${env}`)
      envVars += `\n${env} = ${process.env[env]}`
    })
    await appendFile('.env', envVars)
  }
}

module.exports = {
  // Execute before build starts.
  onPreBuild: async ({utils, inputs}) => {
    const valid = checkInputsAndNotifyOfDeprecation(inputs)
    if (!valid) {
      utils.build.failBuild('Invalid input parameters.')
    }

    if (
      !process.env.NIMBELLA_LOGIN_TOKEN &&
      !(await utils.cache.has(nimConfig))
    ) {
      utils.build.failBuild(
        [
          'Nimbella login token is not available.',
          `Add NIMBELLA_LOGIN_TOKEN to your build environment.',
          'You may also run 'netlify addons:create nimbella' in your project directory linked to this Netlify site.`
        ].join('\n')
      )
    }

    await utils.cache.restore(nimConfig)
    const loggedIn = existsSync(nimConfig)
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

    deployWeb = false
    if (typeof inputs.web === 'boolean') {
      deployWeb = inputs.web
    } else if (typeof inputs.web === 'string') {
      deployWeb = inputs.web.toLowerCase() === 'true'
    }

    isProject = existsSync('packages') || (deployWeb && existsSync('web'))
    hasFunctions = inputs.functions && existsSync(inputs.functions)

    if (hasFunctions && isProject) {
      utils.build.failBuild(
        'Detected both a Nimbella project and a functions directory. Use one or the other.'
      )
    }
  },
  // Build and deploy the Nimbella project
  onBuild: async ({utils, inputs}) => {
    if (process.env.CONTEXT === 'production') {
      if (isProject) {
        try {
          await constructDotEnvFile(inputs)
          await deployProject(utils.run, deployWeb)
        } catch (error) {
          utils.build.failBuild('Failed to build and deploy the project', {
            error
          })
        }
      } else if (hasFunctions) {
        return buildAndDeployNetlifyFunctions({utils, inputs})
      } else {
        console.log(
          `Skipping the build and deployment: Nimbella project not detected.`
        )
      }
    } else {
      console.log(
        `Skipping the build and deployment: context (${process.env.CONTEXT}) is not production.`
      )
    }
  },
  // Execute after build is done.
  onPostBuild: async ({constants, utils, inputs}) => {
    if (process.env.CONTEXT === 'production' && (isProject || hasFunctions)) {
      const redirectsFile = join(constants.PUBLISH_DIR, '_redirects')
      const {stdout: namespace} = await utils.run.command(`nim auth current`)
      const apihost = await getApiHost(utils.run)
      const creds = {namespace, apihost}
      const fnRewrites = hasFunctions
        ? await rewriteRedirects(constants, creds)
        : []
      const redirectRules = await addRedirect(inputs, creds)

      if (fnRewrites.length > 0 || redirectRules.length > 0) {
        let content = ''
        if (existsSync(redirectsFile)) {
          content = await readFile(redirectsFile)
        } else if (!existsSync(constants.PUBLISH_DIR)) {
          const mkdir = require('make-dir')
          await mkdir(constants.PUBLISH_DIR)
        }

        // The rewrites take precedence
        fnRewrites.push(...redirectRules)
        await writeFile(redirectsFile, fnRewrites.join('\n') + '\n')
        await appendFile(redirectsFile, content)

        const rf = await readFile(redirectsFile)
        console.log(`Redirects:\n${rf}`)
      }
    }
  }
}
