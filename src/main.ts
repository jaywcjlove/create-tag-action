import * as path from 'path'
import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    const myToken = core.getInput('token')
    const packagePath = core.getInput('package-path')
    const octokit = github.getOctokit(myToken)
    const {owner, repo} = github.context.repo
    const commit = github.context.payload.head_commit.message
    const listTags = await octokit.repos.listTags({
      owner: (owner as unknown) as string,
      repo: (repo as unknown) as string
    })
    console.log('commit>', commit)
    console.log('commit>', listTags.data)

    if (packagePath) {
      const resolvePackagePath = path.resolve(__dirname, packagePath)
      console.log('commit>', resolvePackagePath)
    }
  } catch (error) {
    core.setFailed(error.message)
  }
}

try {
  run()
} catch (error) {
  core.setFailed(error.message)
}
