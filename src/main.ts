import * as path from 'path'
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
    if (!test && !packagePath) {
      return
    }
    /** current version, example: `v1.0.1` */
    let version = ''
    core.info(`Commit Content: ${commit}`)

    if ((test && !new RegExp(test).test(commit)) || (!test && !packagePath)) {
      return
    }
    if (test && new RegExp(test).test(commit)) {
      version = getVersion(commit)
      if (!version) return
      if (
        listTags.data[0] &&
        !semver.gt(version, (listTags.data[0] as unknown) as string)
      ) {
        return
      }
    } else {
      const resolvePackagePath = path.resolve(__dirname, packagePath)
      console.log('Resolve Package Path1 >>>', resolvePackagePath)
    }
    core.info(`Tag: ${version}`)
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
    core.info(`Tag: ${version}`)
    console.log('List Tags >>>', listTags.data)
  } catch (error) {
    core.setFailed(error.message)
  }
}

try {
  run()
} catch (error) {
  core.setFailed(error.message)
}
