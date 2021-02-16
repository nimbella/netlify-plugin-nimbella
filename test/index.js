const path = require('path')

const fs = require('fs')
const mockFs = require('mock-fs')
const build = require('netlify-lambda/lib/build')

const plugin = require('../src')

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
console.log = jest.fn()

afterEach(() => {
  delete require.cache[require.resolve('../src')]
  utils.build.failBuild.mockReset()
  utils.run.command.mockReset()
  utils.cache.has.mockReset()
  utils.cache.restore.mockReset()
  utils.cache.save.mockReset()
  build.run.mockReset()
  console.log.mockReset()
})

describe('preBuild()', () => {
  test('Login to default api host', async () => {
    // Prepare
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    delete process.env.NIMBELLA_API_HOST
    utils.cache.has.mockResolvedValue(false)

    const mockFiles = {
      [require('os').homedir()]: {}
    }
    mockFs(mockFiles)
    await plugin.onPreBuild({
      utils,
      constants: {},
      inputs: {}
    })
    mockFs.restore()

    expect(utils.run.command.mock.calls[0][0]).toEqual(
      `nim auth login somevalue`
    )
  })

  test('Login to specified api host', async () => {
    // Prepare
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.NIMBELLA_API_HOST = 'somehost'
    utils.cache.has.mockResolvedValue(false)

    const mockFiles = {
      [require('os').homedir()]: {}
    }

    mockFs(mockFiles)
    await plugin.onPreBuild({
      utils,
      constants: {},
      inputs: {}
    })
    mockFs.restore()

    expect(utils.run.command.mock.calls[0][0]).toEqual(
      `nim auth login somevalue --apihost somehost`
    )
  })

  test('show token not available message when login token not set', async () => {
    // Prepare
    process.env.NIMBELLA_LOGIN_TOKEN = ''
    utils.cache.has.mockResolvedValue(false)

    await plugin.onPreBuild({
      utils,
      constants: {},
      inputs: {}
    })

    expect(utils.cache.has.mock.calls.length).toBe(1)
    expect(utils.build.failBuild.mock.calls[0][0]).toEqual(
      'Nimbella login token is not available. Please run `netlify addons:create nimbella` at the base of your local project directory linked to your Netlify site.'
    )
  })

  test('Show the current namespace if already logged in', async () => {
    // Prepare
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    utils.run.command.mockReturnValue({
      stdout: 'namespace'
    })
    const mockFiles = {
      [path.join(require('os').homedir(), '.nimbella')]: {}
    }

    mockFs(mockFiles)
    await plugin.onPreBuild({
      utils,
      constants: {},
      inputs: {}
    })
    mockFs.restore()

    expect(utils.cache.restore.mock.calls.length).toBe(1)
    expect(utils.run.command.mock.calls[0][0]).toEqual(`nim auth current`)
    expect(console.log.mock.calls[0][0]).toEqual(
      'Using the following namespace: namespace'
    )
  })
})

describe('onBuild()', () => {
  test('should skip deployment if the context is not production', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'dev'

    const pluginInputs = {
      utils,
      constants: {CONFIG_PATH: './netlify.toml', PUBLISH_DIR: ''},
      inputs: {
        path: ''
      }
    }

    mockFs({})
    await plugin.onPreBuild(pluginInputs)
    await plugin.onBuild(pluginInputs)
    mockFs.restore()

    expect(build.run.mock.calls.length).toBe(0)
    expect(console.log.mock.calls[0][0]).toEqual(
      `Skipping the build and deployment: context (${process.env.CONTEXT}) is not production.`
    )
  })

  test('should skip deployment if set packages directory is not present', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'production'

    const pluginInputs = {
      utils,
      constants: {CONFIG_PATH: './netlify.toml', PUBLISH_DIR: ''},
      inputs: {
        path: ''
      }
    }

    mockFs({
      'netlify.toml': ''
    })
    await plugin.onPreBuild(pluginInputs)
    await plugin.onBuild(pluginInputs)
    mockFs.restore()

    expect(build.run.mock.calls.length).toBe(0)
    expect(console.log.mock.calls[0][0]).toEqual(
      `Skipping the build and deployment: Nimbella project not detected.`
    )
  })

  test("should run nim project deploy if 'packages' directory exists", async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'production'

    const pluginInputs = {
      utils,
      constants: {CONFIG_PATH: './netlify.toml', PUBLISH_DIR: ''},
      inputs: {
        path: ''
      }
    }

    mockFs({
      packages: {}
    })
    await plugin.onPreBuild(pluginInputs)
    await plugin.onBuild(pluginInputs)
    mockFs.restore()

    expect(utils.run.command.mock.calls[1][0]).toEqual(
      `nim project deploy . --exclude=web`
    )
  })

  test('should export .env file', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'production'
    process.env.ENV1 = 'env1value'
    process.env.ENV2 = 'env2value'

    const pluginInputs = {
      utils,
      constants: {CONFIG_PATH: './netlify.toml', PUBLISH_DIR: ''},
      inputs: {
        path: '',
        env: ['ENV1', 'ENV2']
      }
    }

    mockFs({
      packages: {}
    })
    await plugin.onPreBuild(pluginInputs)
    await plugin.onBuild(pluginInputs)
    const redirects = String(fs.readFileSync('.env')).trim().split('\n')
    mockFs.restore()

    expect(redirects[0]).toEqual('ENV1 = env1value')
    expect(redirects[1]).toEqual('ENV2 = env2value')
    expect(console.log.mock.calls[0][0]).toEqual(
      `Forwarding environment variables:`
    )
    expect(console.log.mock.calls[1][0]).toEqual(`\t- ENV1`)
    expect(console.log.mock.calls[2][0]).toEqual(`\t- ENV2`)

    expect(utils.run.command.mock.calls[1][0]).toEqual(
      `nim project deploy . --exclude=web`
    )
  })
})

describe('onPostBuild()', () => {
  test('should create redirects file if none exists', async () => {
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
        path: '/api'
      }
    }

    mockFs({
      packages: {},
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
      }
    })

    await plugin.onPreBuild(pluginInputs)
    await plugin.onPostBuild(pluginInputs)
    const redirects = String(fs.readFileSync('_redirects')).trim().split('\n')
    mockFs.restore()

    expect(redirects.length).toEqual(1)
    expect(redirects[0]).toEqual(
      '/api/* https://somehost/api/v1/web/namespace/:splat 200!'
    )
  })

  test('should merge redirects if _redirects file exists', async () => {
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
        path: '/api'
      }
    }

    mockFs({
      packages: {},
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
      ].join('\n')
    })

    await plugin.onPreBuild(pluginInputs)
    await plugin.onPostBuild(pluginInputs)
    const redirects = String(fs.readFileSync('_redirects')).trim().split('\n')
    mockFs.restore()

    expect(redirects.length).toEqual(3)
    expect(redirects[0]).toEqual(
      '/api/* https://somehost/api/v1/web/namespace/:splat 200!'
    ) // And input directive
    expect(redirects[1]).toEqual('/mypath https://example.com') // Original rewrites come last
    expect(redirects[2]).toEqual('/fn2 /.netlify/functions/fn2 200') // Original rewrites come last
  })
})
