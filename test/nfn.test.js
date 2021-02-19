const fs = require('fs')
const mockFs = require('mock-fs')
const path = require('path')
const build = require('netlify-lambda/lib/build')
const plugin = require('../src')
const {
  constructEnvFileAsJson,
  deployActions,
  rewriteRedirects
} = require('../src/nfn')

// eslint-disable-next-line camelcase
const node_modules = mockFs.load(path.resolve(__dirname, '../node_modules'))

const utils = {
  cache: {
    restore: jest.fn(),
    save: jest.fn(),
    has: jest.fn()
  },
  run: {
    command: jest.fn()
  },
  build: {
    failBuild: jest.fn()
  }
}

jest.mock('netlify-lambda/lib/build')
jest.mock('chalk', () => ({yellow: (_) => _}))

console.log = jest.fn()
console.warn = jest.fn()

afterEach(() => {
  delete require.cache[require.resolve('../src')]
  utils.build.failBuild.mockReset()
  utils.run.command.mockReset()
  utils.cache.has.mockReset()
  utils.cache.restore.mockReset()
  utils.cache.save.mockReset()
  build.run.mockReset()
  console.log.mockReset()
  console.warn.mockReset()
})

describe('preBuild()', () => {
  test('Should fail build if a Nimbella project and functions directory are both present', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'

    const pluginInputs = {
      utils,
      inputs: {functions: 'somePath'}
    }

    mockFs({
      packages: {},
      somePath: {},
      // eslint-disable-next-line camelcase
      node_modules
    })

    await plugin.onPreBuild(pluginInputs)
    mockFs.restore()

    expect(utils.build.failBuild.mock.calls[0][0]).toEqual(
      'Detected both a Nimbella project and a functions directory. Use one or the other.'
    )
  })
})

describe('onBuild', () => {
  test('Should build functions if functions input is set in config ', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'production'

    const pluginInputs = {
      utils,
      inputs: {functions: 'somePath'}
    }

    mockFs({
      somePath: {},
      // eslint-disable-next-line camelcase
      node_modules
    })

    await plugin.onPreBuild(pluginInputs)
    await plugin.onBuild(pluginInputs)
    mockFs.restore()

    expect(build.run.mock.calls[0][0]).toMatch(/functions-build-\d+/)
  })

  test('Should export env.json file', async () => {
    process.env.ENV1 = 'someenv1'
    process.env.ENV2 = 'someenv2'

    mockFs({})
    const envFile = await constructEnvFileAsJson({
      envs: ['ENV1', 'ENV2']
    })
    const envsJson = String(fs.readFileSync(envFile))
    mockFs.restore()

    expect(JSON.parse(envsJson)).toEqual({ENV1: 'someenv1', ENV2: 'someenv2'})
  })

  test('Should proxy entire domain if deploying web assets', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'production'

    utils.run.command = jest.fn((cmd) => {
      if (cmd === 'nim auth current') return {stdout: 'namespace'}
      if (cmd === 'nim auth current --apihost') return {stdout: 'somehost'}
      return {stdout: '???'}
    })

    const pluginInputs = {
      utils,
      constants: {CONFIG_PATH: 'netlify.toml', PUBLISH_DIR: ''},
      inputs: {
        path: '/api',
        functions: 'somePath'
      }
    }

    mockFs({
      somePath: {},
      'netlify.toml': `
        [[redirects]]
        from = "/home"
        to = "/index.html"
        status = 200

        [[redirects]]
        from = "/somefn"
        to = "/.netlify/functions/fn"
        status = 200
      `,
      'some-dir': {
        'create.js': '',
        'update.js': ''
      },
      _redirects: [
        '/mypath https://example.com',
        '/fn2 /.netlify/functions/fn2 200'
      ].join('\n'),
      // eslint-disable-next-line camelcase
      node_modules
    })

    await plugin.onPreBuild(pluginInputs)
    await plugin.onPostBuild(pluginInputs)
    const redirects = String(fs.readFileSync('_redirects')).trim().split('\n')
    mockFs.restore()

    expect(redirects).toEqual([
      '/fn2 https://somehost/api/v1/web/namespace/default/fn2 200!', // Rewrite from _redires
      '/somefn https://somehost/api/v1/web/namespace/default/fn 200!', // Rewrite from toml file
      '/api/* https://somehost/api/v1/web/namespace/default/:splat 200!', // Inputs.path redirect
      '/mypath https://example.com', // Original redirects come last
      '/fn2 /.netlify/functions/fn2 200' // Original redirects come last
    ])
  })
})

describe('supporting functions', () => {
  test('Should deploy actions', async () => {
    mockFs({
      somePath: {'jshello.js': '', 'pyhello.py': ''},
      'env.json': '{}',
      // eslint-disable-next-line camelcase
      node_modules
    })

    utils.run.command.mockResolvedValue({
      stderr: '',
      exitCode: 0,
      failed: false
    })

    await deployActions({
      run: utils.run,
      envsFile: 'env.json',
      functionsDir: 'somePath',
      timeout: '120',
      memory: '256'
    })
    mockFs.restore()

    expect(utils.run.command.mock.calls[0][0]).toEqual(
      'nim action update jshello somePath/jshello.js --web=raw --timeout=120 --memory=256 --kind nodejs-lambda:10 --main handler --env-file=env.json'
    )
    expect(utils.run.command.mock.calls[1][0]).toEqual(
      'nim action update pyhello somePath/pyhello.py --web=raw --timeout=120 --memory=256 --env-file=env.json'
    )
    expect(console.warn.mock.calls[0][0]).toEqual(
      'pyhello.py: Lambda compatibility is not available for this function.'
    )
  })

  test('Should deploy actions with default limits', async () => {
    mockFs({
      somePath: {'jshello.js': '', 'pyhello.py': ''},
      'env.json': '{}',
      // eslint-disable-next-line camelcase
      node_modules
    })

    utils.run.command.mockResolvedValue({
      stderr: '',
      exitCode: 0,
      failed: false
    })

    await deployActions({
      run: utils.run,
      envsFile: 'env.json',
      functionsDir: 'somePath'
    })
    mockFs.restore()

    expect(utils.run.command.mock.calls[0][0]).toEqual(
      'nim action update jshello somePath/jshello.js --web=raw --kind nodejs-lambda:10 --main handler --env-file=env.json'
    )
    expect(utils.run.command.mock.calls[1][0]).toEqual(
      'nim action update pyhello somePath/pyhello.py --web=raw --env-file=env.json'
    )
    expect(console.warn.mock.calls[0][0]).toEqual(
      'pyhello.py: Lambda compatibility is not available for this function.'
    )
  })

  test('Should rewrite matching redirects', async () => {
    const pluginInputs = {
      constants: {
        CONFIG_PATH: 'netlify.toml',
        PUBLISH_DIR: ''
      }
    }

    mockFs({
      'netlify.toml': `
        [[redirects]]
        from = "/home"
        to = "/index.html"
        status = 200

        [[redirects]]
        from = "/somefn"
        to = "/.netlify/functions/fn"
        status = 200
      `,
      _redirects: [
        '/mypath https://example.com',
        '/fn2 /.netlify/functions/fn2 200'
      ].join('\n'),
      // eslint-disable-next-line camelcase
      node_modules
    })

    const redirects = await rewriteRedirects(pluginInputs.constants, {
      namespace: 'namespace',
      apihost: 'somehost'
    })
    mockFs.restore()

    expect(console.log.mock.calls[0][0]).toEqual(
      `Found _redirects file. Rewriting rules that redirect (200 rewrites) to '/.netlify/functions/*'.`
    )

    expect(console.log.mock.calls[1][0]).toEqual(
      `Found redirect rules in netlify.toml. Rewriting rules that redirect (200 rewrites) to '/.netlify/functions/*'.`
    )

    expect(redirects.length).toEqual(2)
    expect(redirects[0]).toEqual(
      '/fn2 https://somehost/api/v1/web/namespace/default/fn2 200!'
    )
    expect(redirects[1]).toEqual(
      '/somefn https://somehost/api/v1/web/namespace/default/fn 200!'
    )
  })
})
