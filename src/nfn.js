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
      const command = [
        `nim action update ${actionName} ${join(functionsDir, file)}`,
        `--timeout=${Number(timeout)} --memory=${Number(memory)} `,
        `--web=raw`
      ]

      if (extension === 'js') {
        // Run node functions with lambda compatibility
        command.push('--kind nodejs-lambda:10 --main handler')
      } else {
        const chalk = require('chalk')

        // Else let the cli infer the kind based on the file extension
        console.warn(`
           ${chalk.yellow(
             file + ': Lambda compatibility is not available for this function.'
           )}
           The main handler must be called 'main', must accept a JSON object as input, and return JSON object as output.
           The function will run as Apache OpenWhisk action on the Nimbella Cloud.
           See https://github.com/apache/openwhisk/blob/master/docs/actions.md#languages-and-runtimes
           for examples of serverless function signatures that are comptatible.`)
      }

      if (envsFile) {
        command.push(`--env-file=${envsFile}`)
      }

      const {stderr, exitCode, failed} = await run.command(command.join(' '), {
        reject: false,
        stdout: 'ignore'
      })

      const message = exitCode === 0 && !failed ? 'done.' : String(stderr)
      console.log(`Deployed ${file}: ${message}`)
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

async function buildAndDeployNetlifyFunctions({utils, inputs}) {
  const cpx = require('cpx')
  const build = require('netlify-lambda/lib/build')
  const functionsBuildDir = `functions-build-${Date.now()}`

  try {
    const stats = await build.run(functionsBuildDir)
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
  buildAndDeployNetlifyFunctions
}
