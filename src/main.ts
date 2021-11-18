import * as core from '@actions/core'
import * as github from '@actions/github'
import FS from 'fs-extra'
import path from 'path'
import semver from 'semver'
import {getVersion} from './utils'

async function run(): Promise<void> {
  try {
    const myToken = core.getInput('token')
    const test = core.getInput('test')
    const packagePath = core.getInput('package-path')
    // Example: v1.0.0
    const inputVersion = core.getInput('version')
    const octokit = github.getOctokit(myToken)
    const {owner, repo} = github.context.repo
    const commit: string = github.context.payload.head_commit.message
    const listTags = await octokit.rest.repos.listTags({owner, repo})
    if (listTags.status !== 200) {
      core.setFailed(`Failed to get tag lists (status=${listTags.status})`)
      return
    }
    core.info(`Repos ${owner}/${repo} List Tag`)
    core.startGroup(`Tag List Info:`)
    core.info(`${JSON.stringify(listTags, null, 2)}`)
    core.endGroup()
    for (const tagData of listTags.data) {
      core.startGroup(`Tag: ${tagData.name} ${tagData.commit.sha}`)
      core.info(`${JSON.stringify(tagData, null, 2)}`)
      core.endGroup()
    }
    const reltag = await octokit.rest.repos.getReleaseByTag()
    core.startGroup(`Release By Tag Info:`)
    core.info(`${JSON.stringify(reltag, null, 2)}`)
    core.endGroup()
    const preTag =
      listTags.data[0] && listTags.data[0].name ? listTags.data[0].name : ''

    if (preTag) {
      core.setOutput('preversion', semver.coerce(preTag)?.version)
      core.setOutput('preversionNumber', semver.coerce(preTag)?.raw)
      core.setOutput('majorVersion', semver.major(preTag))
      core.setOutput('minorVersion', semver.minor(preTag))
      core.setOutput('patchVersion', semver.patch(preTag))
    }

    if (inputVersion) {
      const tagSha = await createTag(myToken, inputVersion)
      core.setOutput('version', inputVersion)
      core.setOutput('versionNumber', semver.coerce(inputVersion)?.raw)
      core.setOutput('successful', true)
      core.setOutput('majorVersion', semver.major(inputVersion))
      core.setOutput('minorVersion', semver.minor(inputVersion))
      core.setOutput('patchVersion', semver.patch(inputVersion))
      core.info(
        `Tagged \x1b[32m${
          tagSha || ' - '
        }\x1b[0m as \x1b[32m${inputVersion}\x1b[0m!, Pre Tag: \x1b[33m${preTag}\x1b[0m`
      )
      return
    }
    if (!test && !packagePath) {
      core.setFailed(
        'Please setting\x1b[33m test\x1b[0m/\x1b[33m package-path\x1b[0m or Specify\x1b[33m version\x1b[0m!'
      )
      return
    }
    /** current version, example: `v1.0.1` */
    let version = ''
    core.info(`Commit Content: \x1b[34m${commit}\x1b[0m`)

    if (test && !new RegExp(test).test(commit)) {
      core.info(`\x1b[33mThis is not a tagged push.\x1b[0m`)
      return
    }
    if (test && new RegExp(test).test(commit)) {
      version = getVersion(commit)
      if (!version) return
      if (preTag && !semver.gt(version, preTag)) {
        core.info(
          `The new tag \x1b[33m${version}\x1b[0m is smaller than \x1b[32m${preTag}\x1b[0m.\x1b[33m Do not create tag.\x1b[0m`
        )
        return
      }
    }
    if (!test && packagePath) {
      const resolvePackagePath = path.resolve(process.cwd(), packagePath)
      if (!/^package.json$/.test(path.basename(resolvePackagePath))) {
        core.setFailed(`Must specify\x1b[31m package.json\x1b[0m file!`)
        return
      }
      if (!FS.existsSync(resolvePackagePath)) {
        core.setFailed(
          `File \x1b[31m${resolvePackagePath}\x1b[0m does not exist!`
        )
        return
      }
      const pkg = await FS.readJson(resolvePackagePath)
      core.info(`Package Name: \x1b[33m${pkg.name || '-'}\x1b[0m`)
      core.info(`Package Description: \x1b[33m${pkg.description || '-'}\x1b[0m`)
      core.startGroup(
        `Package Data: \x1b[33m${pkg.name || '-'}@\x1b[0m\x1b[33m${
          pkg.version || '-'
        }\x1b[0m`
      )
      core.info(`${JSON.stringify(pkg, null, 2)}`)
      core.endGroup()
      if (!pkg.version) {
        core.setFailed(
          `The \x1b[31mversion\x1b[0m feild in package.json does not exist!`
        )
        return
      }
      version = `v${pkg.version}`
      if (preTag && !semver.gt(pkg.version, preTag)) {
        core.info(
          `The new tag \x1b[33m${pkg.version}\x1b[0m is smaller than \x1b[32m${preTag}\x1b[0m.\x1b[33m Do not create tag.\x1b[0m`
        )
        return
      }
      core.info(`Resolve Package Path \x1b[33m${resolvePackagePath}\x1b[0m`)
    }
    if (!version) return
    if (preTag) {
      core.info(
        `Create tag \x1b[33m${preTag}\x1b[0m => \x1b[32m${version}\x1b[0m`
      )
    } else {
      core.info(`Create tag \x1b[32m${version}\x1b[0m`)
    }

    const tagSha = await createTag(myToken, version)

    core.setOutput('version', version || preTag)
    core.setOutput('versionNumber', semver.coerce(version || preTag)?.raw)
    core.setOutput('successful', true)

    core.setOutput('majorVersion', semver.major(version))
    core.setOutput('minorVersion', semver.minor(version))
    core.setOutput('patchVersion', semver.patch(version))

    core.info(
      `Tagged \x1b[32m${
        tagSha || ' - '
      }\x1b[0m as \x1b[32m${version}\x1b[0m!, Pre Tag: \x1b[33m${preTag}\x1b[0m`
    )
  } catch (error) {
    // @ts-ignore
    core.setFailed(error.message)
  }
}

async function createTag(
  token: string,
  version: string
): Promise<string | undefined> {
  const octokit = github.getOctokit(token)
  const tag_rsp = await octokit.rest.git.createTag({
    ...github.context.repo,
    tag: version,
    message: core.getInput('message'),
    object: github.context.sha,
    type: 'commit'
  })
  if (tag_rsp.status !== 201) {
    core.setFailed(`Failed to create tag object (status=${tag_rsp.status})`)
    return
  }
  core.startGroup(
    `CreateTag Result Data: \x1b[33m${tag_rsp.status || '-'}\x1b[0m `
  )
  core.info(`${JSON.stringify(tag_rsp, null, 2)}`)
  core.endGroup()

  const ref_rsp = await octokit.rest.git.createRef({
    ...github.context.repo,
    ref: `refs/tags/${version}`,
    sha: tag_rsp.data.sha
  })

  if (ref_rsp.status !== 201) {
    core.setFailed(`Failed to create tag ref(status = ${tag_rsp.status})`)
    return
  }
  core.startGroup(
    `CreateRef Result Data: \x1b[33m${tag_rsp.status || '-'}\x1b[0m `
  )
  core.info(`${JSON.stringify(tag_rsp, null, 2)}`)
  core.endGroup()
  return tag_rsp.data.sha
}

try {
  run()
} catch (error) {
  // @ts-ignore
  core.setFailed(error.message)
}
