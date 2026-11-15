import * as core from '@actions/core'
import * as github from '@actions/github'
import FS from 'fs-extra'
import {run} from '../src/main'

jest.mock('@actions/core')
jest.mock('@actions/github', () => ({
  context: {
    repo: {owner: 'octo', repo: 'demo'},
    sha: 'abc123',
    payload: {}
  },
  getOctokit: jest.fn()
}))
jest.mock('fs-extra')

const getInput = core.getInput as jest.MockedFunction<typeof core.getInput>
const getBooleanInput = core.getBooleanInput as jest.MockedFunction<
  typeof core.getBooleanInput
>
const setOutput = core.setOutput as jest.MockedFunction<typeof core.setOutput>
const setFailed = core.setFailed as jest.MockedFunction<typeof core.setFailed>

const getLatestRelease = jest.fn()
const listReleases = jest.fn()
const createRelease = jest.fn()
const createTag = jest.fn()
const createRef = jest.fn()

function output(name: string): string | undefined {
  const calls = setOutput.mock.calls.filter(call => call[0] === name)
  if (calls.length === 0) return undefined
  return String(calls[calls.length - 1][1])
}

function mockRelease(tagName: string): void {
  getLatestRelease.mockResolvedValue({
    status: 200,
    data: {
      tag_name: tagName,
      name: tagName,
      created_at: '2024-01-01T00:00:00Z'
    }
  })
}

describe('outputs.versionNumber', () => {
  beforeEach(() => {
    const inputs: Record<string, string> = {
      token: 'test-token',
      version: '',
      test: '',
      commit: '',
      'package-path': '',
      body: '',
      release: 'false',
      prerelease: 'false',
      draft: 'false'
    }
    getInput.mockImplementation(name => inputs[name] ?? '')
    getBooleanInput.mockImplementation(name => inputs[name] === 'true')
    ;(github.getOctokit as jest.Mock).mockReturnValue({
      rest: {
        repos: {getLatestRelease, createRelease, listReleases},
        git: {createTag, createRef}
      }
    })
    Object.assign(github.context, {
      repo: {owner: 'octo', repo: 'demo'},
      sha: 'abc123',
      payload: {}
    })
    createTag.mockResolvedValue({status: 201, data: {sha: 'tagsha'}})
    createRef.mockResolvedValue({status: 201, data: {}})
    createRelease.mockResolvedValue({status: 201, data: {}})
    listReleases.mockResolvedValue({status: 200, data: []})
    ;(FS.existsSync as jest.Mock).mockReturnValue(false)
    ;(FS.readJson as jest.Mock).mockResolvedValue({})
    mockRelease('v1.2.0')
  })

  test('input version keeps a non-empty versionNumber, including prerelease', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'version') return 'v1.4.0-beta.2'
      return ''
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v1.4.0-beta.2')
    expect(output('versionNumber')).toEqual('1.4.0-beta.2')
    expect(output('preversion')).toEqual('v1.2.0')
    expect(output('preversionNumber')).toEqual('1.2.0')
    expect(output('successful')).toEqual('true')
    expect(output('majorVersion')).toEqual('1')
    expect(output('minorVersion')).toEqual('4')
    expect(output('patchVersion')).toEqual('0')
  })

  test('versionNumber falls back to the previous tag when the commit is not a release', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'test') return '[R|r]elease[d]\\s+[v|V]\\d(\\.\\d+){0,2}'
      if (name === 'commit') return 'docs: update readme'
      return ''
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v1.2.0')
    expect(output('versionNumber')).toEqual('1.2.0')
    expect(output('preversion')).toEqual('v1.2.0')
    expect(output('preversionNumber')).toEqual('1.2.0')
    expect(output('majorVersion')).toEqual('1')
    expect(output('minorVersion')).toEqual('2')
    expect(output('patchVersion')).toEqual('0')
    expect(output('successful')).toEqual('false')
    expect(createTag).not.toHaveBeenCalled()
  })

  test('versionNumber is set when package.json is not newer than the latest tag', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'package-path') return 'package.json'
      return ''
    })
    ;(FS.existsSync as jest.Mock).mockReturnValue(true)
    ;(FS.readJson as jest.Mock).mockResolvedValue({
      name: 'demo',
      version: '1.0.0'
    })
    mockRelease('v2.0.0')

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v1.0.0')
    expect(output('versionNumber')).toEqual('1.0.0')
    expect(output('preversion')).toEqual('v2.0.0')
    expect(output('majorVersion')).toEqual('1')
    expect(output('minorVersion')).toEqual('0')
    expect(output('patchVersion')).toEqual('0')
    expect(output('successful')).toEqual('false')
    expect(createTag).not.toHaveBeenCalled()
  })

  test('commit tag with a capital V still outputs versionNumber', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'test') return '[R|r]elease[d]\\s+[v|V]\\d(\\.\\d+){0,2}'
      if (name === 'commit') return 'released V2.0.0'
      return ''
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v2.0.0')
    expect(output('versionNumber')).toEqual('2.0.0')
    expect(output('preversion')).toEqual('v1.2.0')
    expect(output('majorVersion')).toEqual('2')
    expect(output('successful')).toEqual('true')
    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({tag: 'v2.0.0'})
    )
  })

  test('partial commit version is coerced instead of leaving versionNumber empty', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'test') return '[R|r]elease[d]\\s+[v|V]\\d(\\.\\d+){0,2}'
      if (name === 'commit') return 'released v1.3'
      return ''
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v1.3.0')
    expect(output('versionNumber')).toEqual('1.3.0')
    expect(output('majorVersion')).toEqual('1')
    expect(output('minorVersion')).toEqual('3')
    expect(output('patchVersion')).toEqual('0')
    expect(output('successful')).toEqual('true')
  })

  test('a smaller commit version does not clear versionNumber', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'test') return '[R|r]elease[d]\\s+[v|V]\\d(\\.\\d+){0,2}'
      if (name === 'commit') return 'released v1.0.0'
      return ''
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v1.2.0')
    expect(output('versionNumber')).toEqual('1.2.0')
    expect(output('preversion')).toEqual('v1.2.0')
    expect(output('successful')).toEqual('false')
    expect(createTag).not.toHaveBeenCalled()
  })

  test('prerelease previous tag keeps the prerelease in versionNumber', async () => {
    mockRelease('v1.2.3-beta.1')
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'test') return '[R|r]elease[d]\\s+[v|V]\\d(\\.\\d+){0,2}'
      if (name === 'commit') return 'chore: nothing to tag'
      return ''
    })

    await run()

    expect(output('version')).toEqual('v1.2.3-beta.1')
    expect(output('versionNumber')).toEqual('1.2.3-beta.1')
    expect(output('preversion')).toEqual('v1.2.3-beta.1')
    expect(output('preversionNumber')).toEqual('1.2.3-beta.1')
    expect(output('majorVersion')).toEqual('1')
    expect(output('minorVersion')).toEqual('2')
    expect(output('patchVersion')).toEqual('3')
  })

  test('a capital V on the previous tag still fills every version output', async () => {
    mockRelease('V1.2.3-beta.1')
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'test') return '[R|r]elease[d]\\s+[v|V]\\d(\\.\\d+){0,2}'
      if (name === 'commit') return 'docs: update readme'
      return ''
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v1.2.3-beta.1')
    expect(output('preversion')).toEqual('v1.2.3-beta.1')
    expect(output('preversionNumber')).toEqual('1.2.3-beta.1')
    expect(output('majorVersion')).toEqual('1')
    expect(output('minorVersion')).toEqual('2')
    expect(output('patchVersion')).toEqual('3')
  })

  test('an invalid previous tag does not throw when a new version is created', async () => {
    mockRelease('nightly')
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'version') return 'v1.4.0'
      return ''
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v1.4.0')
    expect(output('versionNumber')).toEqual('1.4.0')
    expect(output('preversion')).toBeUndefined()
    expect(output('preversionNumber')).toBeUndefined()
    expect(output('successful')).toEqual('true')
    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({tag: 'v1.4.0'})
    )
  })

  test('a smaller explicit version keeps its own major minor and patch', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'version') return 'v1.0.0'
      return ''
    })

    await run()

    expect(output('version')).toEqual('v1.0.0')
    expect(output('versionNumber')).toEqual('1.0.0')
    expect(output('preversion')).toEqual('v1.2.0')
    expect(output('majorVersion')).toEqual('1')
    expect(output('minorVersion')).toEqual('0')
    expect(output('patchVersion')).toEqual('0')
    expect(output('successful')).toEqual('false')
    expect(createTag).not.toHaveBeenCalled()
  })

  test('capital V input is normalized and still creates a tag', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'version') return 'V1.4.0'
      return ''
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(output('version')).toEqual('v1.4.0')
    expect(output('versionNumber')).toEqual('1.4.0')
    expect(output('successful')).toEqual('true')
    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({tag: 'v1.4.0'})
    )
  })

  test('successful stays false when tag creation fails', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'version') return 'v1.4.0'
      return ''
    })
    createTag.mockRejectedValue(new Error('api down'))

    await run()

    expect(output('version')).toEqual('v1.4.0')
    expect(output('successful')).toEqual('false')
    expect(setFailed).not.toHaveBeenCalled()
  })

  test('successful is true only after a release is created', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'version') return 'v1.4.0'
      return ''
    })
    getBooleanInput.mockImplementation(name => name === 'release')

    await run()

    expect(createRelease).toHaveBeenCalledWith(
      expect.objectContaining({tag_name: 'v1.4.0'})
    )
    expect(createTag).not.toHaveBeenCalled()
    expect(output('successful')).toEqual('true')
  })

  test('a failed release leaves successful false', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'version') return 'v1.4.0'
      return ''
    })
    getBooleanInput.mockImplementation(name => name === 'release')
    createRelease.mockRejectedValue(new Error('denied'))

    await run()

    expect(output('successful')).toEqual('false')
    expect(setFailed).toHaveBeenCalled()
  })

  test('creating a tag for an older package version reports successful', async () => {
    getInput.mockImplementation(name => {
      if (name === 'token') return 'test-token'
      if (name === 'package-path') return 'package.json'
      return ''
    })
    ;(FS.existsSync as jest.Mock).mockReturnValue(true)
    ;(FS.readJson as jest.Mock).mockResolvedValue({
      name: 'demo',
      version: '1.0.0'
    })
    mockRelease('v2.0.0')
    listReleases.mockResolvedValue({
      status: 200,
      data: [{tag_name: 'v2.0.0', name: 'v2.0.0'}]
    })

    await run()

    expect(setFailed).not.toHaveBeenCalled()
    expect(createTag).toHaveBeenCalledWith(
      expect.objectContaining({tag: 'v1.0.0'})
    )
    expect(output('version')).toEqual('v1.0.0')
    expect(output('majorVersion')).toEqual('1')
    expect(output('successful')).toEqual('true')
  })
})
