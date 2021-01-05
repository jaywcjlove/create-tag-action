import * as core from '@actions/core'
import * as github from '@actions/github'

async function run(): Promise<void> {
  try {
    const myToken = core.getInput('token')
    const octokit = github.getOctokit(myToken)
    const {owner, repo} = github.context.repo
    const commit = await octokit.repos.getCommit({
      owner: (owner as unknown) as string,
      repo: (repo as unknown) as string,
      ref: github.context.ref
    })
    console.log('commit>', JSON.stringify(commit))
    console.log('github.context.repo>', JSON.stringify(github.context.repo))
  } catch (error) {
    core.setFailed(error.message)
  }
}

try {
  run()
} catch (error) {
  core.setFailed(error.message)
}
