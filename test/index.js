const path = require('path')

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
  test('should build functions if functions input is set in config ', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'

    mockFs({
      functions: {},
      'netlify.toml': ''
    })
    await plugin.onPreBuild({
      utils,
      constants: {CONFIG_PATH: './netlify.toml'},
      inputs: {functions: 'functions'}
    })
    await plugin.onBuild({
      utils,
      inputs: {functions: 'functions'}
    })
    mockFs.restore()

    expect(build.run.mock.calls[0][1]).toEqual('functions')
  })

  test('should not build functions if set functions directory is not present', async () => {
    mockFs({
      packages: {},
      'netlify.toml': ''
    })
    await plugin.onPreBuild({
      utils,
      constants: {CONFIG_PATH: './netlify.toml'},
      inputs: {functions: 'abcd'}
    })
    await plugin.onBuild({
      utils,
      inputs: {functions: 'abcd'}
    })
    mockFs.restore()

    expect(build.run.mock.calls.length).toBe(0)
  })
})

describe('onPostBuild()', () => {
  test('should skip deployment if the context is not production', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'dev'
    utils.run.command.mockReturnValue({
      stdout: 'namespace'
    })
    const pluginInputs = {
      utils,
      constants: {CONFIG_PATH: './netlify.toml', PUBLISH_DIR: ''},
      inputs: {
        path: '',
        functions: ''
      }
    }

    mockFs({})
    await plugin.onPostBuild(pluginInputs)
    mockFs.restore()

    expect(console.log.mock.calls[0][0]).toEqual(
      `Skipping the deployment to Nimbella as the context (${process.env.CONTEXT}) is not production.`
    )
  })

  test("should run nim project deploy if 'packages' directory exists", async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'production'
    utils.run.command.mockReturnValue({
      stdout: 'namespace'
    })
    const pluginInputs = {
      utils,
      constants: {CONFIG_PATH: './netlify.toml', PUBLISH_DIR: ''},
      inputs: {
        path: '',
        functions: ''
      }
    }

    mockFs({
      packages: {}
    })
    await plugin.onPreBuild(pluginInputs)
    await plugin.onPostBuild(pluginInputs)
    mockFs.restore()

    expect(utils.run.command.mock.calls[2][0]).toEqual(
      `nim project deploy . --exclude=web`
    )
  })

  test('should rewrite existing redirects to .netlify/functions/ in netlify.toml if functions are used', async () => {
    process.env.NIMBELLA_LOGIN_TOKEN = 'somevalue'
    process.env.CONTEXT = 'production'
    utils.run.command.mockReturnValue({
      stdout: 'namespace'
    })
    const pluginInputs = {
      utils,
      constants: {CONFIG_PATH: 'netlify.toml', PUBLISH_DIR: ''},
      inputs: {
        path: '',
        functions: 'some-dir'
      }
    }

    mockFs({
      'netlify.toml': `
        [[redirects]]
        from = "/*"
        to = "/index.html"
        status = 200
        `,
      'some-dir': {
        'create.js': '',
        'update.js': ''
      }
    })
    await plugin.onPreBuild(pluginInputs)
    await plugin.onPostBuild(pluginInputs)
    mockFs.restore()
    expect(console.log.mock.calls[1][0]).toEqual(
      "Found redirect rules in netlify.toml. We will rewrite rules that redirect (200 rewrites) to '/.netlify/functions/*'."
    )
  })
})
