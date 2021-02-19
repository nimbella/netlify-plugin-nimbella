const fs = require('fs')
const mockFs = require('mock-fs')
const path = require('path')
const build = require('netlify-lambda/lib/build')
const plugin = require('../src')
const {constructEnvFileAsJson, deployActions} = require('../src/nfn')

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
      node_modules: mockFs.load(path.resolve(__dirname, '../node_modules'))
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
      node_modules: mockFs.load(path.resolve(__dirname, '../node_modules'))
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

  test('Should deploy actions', async () => {
    mockFs({
      somePath: {'jshello.js': '', 'pyhello.py': ''},
      'env.json': '{}',
      // eslint-disable-next-line camelcase
      node_modules: mockFs.load(path.resolve(__dirname, '../node_modules'))
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
      'nim action update jshello somePath/jshello.js --timeout=120 --memory=256  --web=raw --kind nodejs-lambda:10 --main handler --env-file=env.json'
    )
    expect(utils.run.command.mock.calls[1][0]).toEqual(
      'nim action update pyhello somePath/pyhello.py --timeout=120 --memory=256  --web=raw --env-file=env.json'
    )
    expect(console.warn.mock.calls[0][0].split('\n')[1].trim()).toEqual(
      'pyhello.py: Lambda compatibility is not available for this function.'
    )
  })
})
