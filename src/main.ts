import * as path from 'path'
import * as fs from 'fs'
import * as semver from 'semver'
import * as core from '@actions/core'
import * as github from '@actions/github'

const getVersion = (ver: string): string => {
  let currentVersion = ''
  ver.replace(/([v|V]\d(\.\d+){0,2})/i, (str: string) => {
    currentVersion = str
    return str
  })
  return currentVersion
}

async function run(): Promise<void> {
  try {
    const myToken = core.getInput('token')
    const test = core.getInput('test')
    const packagePath = core.getInput('package-path')
    const octokit = github.getOctokit(myToken)
    const {owner, repo} = github.context.repo
    const commit: string = github.context.payload.head_commit.message
    const listTags = await octokit.repos.listTags({
      owner: (owner as unknown) as string,
      repo: (repo as unknown) as string
    })
    const preTag =
      listTags.data[0] && listTags.data[0].name ? listTags.data[0].name : ''
    if (!test && !packagePath) {
      core.setFailed(
        'Please setting\x1b[33m test\x1b[0m or \x1b[33m package-path\x1b[0m!'
      )
      return
    }
    /** current version, example: `v1.0.1` */
    let version = ''
    core.info(`Commit Content: \x1b[33m${commit}\x1b[0m`)

    if (test && !new RegExp(test).test(commit)) {
      core.info(`\x1b[34mThis is not a tagged push.\x1b[0m`)
      return
    }

    if (test && new RegExp(test).test(commit)) {
      version = getVersion(commit)
      if (!version) return
      if (preTag && !semver.gt(version, preTag)) {
        return
      }
    } else {
      const resolvePackagePath = path.resolve(__dirname, '..', packagePath)
      if (!/^package.json$/.test(path.basename(resolvePackagePath))) {
        core.setFailed(`Must specify package.json file!`)
        return
      }
      if (!fs.existsSync(resolvePackagePath)) {
        core.setFailed(`File ${resolvePackagePath} does not exist!`)
        return
      }
      const pkg = require(resolvePackagePath)
      if (!pkg.version) {
        core.setFailed(
          `The \x1b[31mversion\x1b[0m feild in package.json does not exist!`
        )
        return
      }
      version = `v${pkg.version}`
      if (preTag && !semver.gt(pkg.version, preTag)) {
        core.info(
          `The new tag \x1b[33m${pkg.version}\x1b[0m is smaller than \x1b[32m${listTags.data[0].name}\x1b[0m.\x1b[33m Do not create label.\x1b[0m`
        )
        return
      }
      console.log('Resolve Package Path1 >>>', resolvePackagePath)
      console.log('pkg.version >>>', pkg.version)
      console.log('listTags.data >>>', preTag)
    }
    if (preTag) {
      core.info(
        `Create tag \x1b[33m${preTag}\x1b[0m => \x1b[32m${version}\x1b[0m`
      )
    }
    if (!version) return
    const tag_rsp = await octokit.git.createTag({
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

    const ref_rsp = await octokit.git.createRef({
      ...github.context.repo,
      ref: `refs/tags/${version}`,
      sha: tag_rsp.data.sha
    })

    if (ref_rsp.status !== 201) {
      core.setFailed(`Failed to create tag ref(status = ${tag_rsp.status})`)
      return
    }

    core.info(
      `Tagged \x1b[32m${tag_rsp.data.sha}\x1b[0m as \x1b[32m${version}\x1b[0m!`
    )
  } catch (error) {
    core.setFailed(error.message)
  }
}

try {
  run()
} catch (error) {
  core.setFailed(error.message)
}
