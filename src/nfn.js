const {existsSync} = require('fs')
const {readdir, writeFile} = require('fs').promises
const {join} = require('path')
const {tmpdir} = require('os')

/**
 * Deploys actions under a directory. Currently limited to lambda functions.
 *
 * @param {function} run - function provided under utils by Netlify to build event functions.
 * @param {string} functionsDir - Path to the functions/actions directory.
 * @param {string} timeout - Max allowed duration for each function activation.
 * @param {string} memory - Max memory allowed for each function activation.
 * @param {string} envsFile - Path to environment file (optional).
 */
async function deployActions({run, functionsDir, timeout, memory, envsFile}) {
  const files = await readdir(functionsDir)

  await Promise.all(
    files.map(async (file) => {
      const [actionName, extension] = file.split('.') // This assume name.ext format
      const command = [`nim action update ${actionName} ${join(functionsDir, file)} --web=raw`]

      if (timeout) {
        command.push(`--timeout=${Number(timeout)}`)
      }

      if (memory) {
        command.push(`--memory=${Number(memory)}`)
      }

      if (extension === 'js') {
        // Run node functions with lambda compatibility
        command.push('--kind nodejs-lambda:10 --main handler')
      } else {
        const chalk = require('chalk')

        // Else let the cli infer the kind based on the file extension
        console.warn(
          chalk.yellow(
            file + ': Lambda compatibility is not available for this function.'
          ),
          `The main handler must be called 'main', must accept a JSON object as input, and return JSON object as output.`,
          'The function will run as Apache OpenWhisk action on the Nimbella Cloud.',
          'See https://github.com/apache/openwhisk/blob/master/docs/actions.md#languages-and-runtimes',
          'for examples of serverless function signatures that are comptatible.'
        )
      }

      if (envsFile) {
        command.push(`--env-file=${envsFile}`)
      }

      const {stderr, exitCode, failed} = await run.command(command.join(' '), {
        reject: false,
        stdout: 'ignore'
      })

      const message = exitCode === 0 && !failed ? 'done.' : String(stderr)
      console.log(`Deployment status ${file}: ${message}`)
    })
  )
}

async function constructEnvFileAsJson(inputs) {
  if (inputs.envs && inputs.envs.length > 0) {
    const toExport = {}
    const filename = join(tmpdir(), 'env.json')

    inputs.envs.forEach((env) => {
      toExport[env] = process.env[env]
    })

    await writeFile(filename, JSON.stringify(toExport))
    return filename
  }
}

// Scans the _redirects file and netlify.toml for redirects that map to
// '/.netlify/functions/*' as their target. These are remapped to new endpoints.
// The first set of rewrites is pre-pended to the _redirects file, then the second
// set, if any, because precedence is top to bottom.
async function rewriteRedirects(constants, {apihost, namespace}) {
  const redirects = []

  const {
    parseRedirectsFormat,
    parseNetlifyConfig
  } = require('netlify-redirect-parser')

  const filterRedirects = async (description, filename, parser) => {
    if (filename && existsSync(filename)) {
      console.log(
        `Found ${description}. Rewriting rules that redirect (200 rewrites) to '/.netlify/functions/*'.`
      )
      const {success} = await parser(filename)
      const toAdd = success.filter(
        (redirect) =>
          redirect.status === 200 &&
          redirect.to &&
          redirect.to.startsWith('/.netlify/functions/')
      )
      redirects.push(...toAdd)
    }
  }

  const redirectsFile = join(constants.PUBLISH_DIR, '_redirects')
  await filterRedirects('_redirects file', redirectsFile, parseRedirectsFormat)

  const configFile = constants.CONFIG_PATH
  await filterRedirects(
    'redirect rules in netlify.toml',
    configFile,
    parseNetlifyConfig
  )

  return redirects.map((redirect) => {
    const redirectPath = redirect.to.split('/.netlify/functions/')[1]
    return `${
      redirect.from || redirect.path
    } https://${apihost}/api/v1/web/${namespace}/default/${redirectPath} 200!`
  })
}

async function buildAndDeployNetlifyFunctions({utils, inputs}) {
  const cpx = require('cpx')
  const build = require('netlify-lambda/lib/build')
  const functionsBuildDir = `functions-build-${Date.now()}`

  try {
    const stats = await build.run(functionsBuildDir, inputs.functions)
    console.log(stats.toString(stats.compilation.options.stats))
    // Copy any remaining files that do not end with '.js'.
    // Arguably we should not do this, if the functions are Netlify
    // functions (Lambda) they will not run as is in the OpenWhisk
    // runtime used by Nimbella. Will issue warning during deploy.
    cpx.copySync(inputs.functions + '/**/*.!(js)', functionsBuildDir)
  } catch (error) {
    utils.build.failBuild('Failed to build the functions', {error})
    return
  }

  try {
    const envsFile = await constructEnvFileAsJson(inputs)
    await deployActions({
      run: utils.run,
      envsFile,
      functionsDir: functionsBuildDir,
      timeout: inputs.timeout, // Default setting applies
      memory: inputs.memory // Default setting applies
    })
  } catch (error) {
    utils.build.failBuild('Failed to deploy the functions', {error})
  }
}

module.exports = {
  deployActions,
  constructEnvFileAsJson,
  rewriteRedirects,
  buildAndDeployNetlifyFunctions
}
