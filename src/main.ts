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
    const body = core.getInput('body') || ''
    const release = core.getInput('release')
    const prerelease = core.getInput('prerelease')
    const packagePath = core.getInput('package-path')
    // Example: v1.0.0
    const inputVersion = core.getInput('version')
    const octokit = github.getOctokit(myToken)
    const {owner, repo} = github.context.repo
    const commit: string = github.context.payload.head_commit.message
    const latestRelease = await octokit.rest.repos.getLatestRelease({
      owner,
      repo
    })
    if (latestRelease.status !== 200) {
      core.setFailed(
        `Failed to get latest release (status=${latestRelease.status})`
      )
      return
    }
    core.startGroup(
      `Latest Release Info: (\x1b[33;1m${latestRelease.data.tag_name}\x1b[0m) created_at(\x1b[37;1m${latestRelease.data.created_at}\x1b[0m)`
    )
    core.info(`${JSON.stringify(latestRelease.data, null, 2)}`)
    core.endGroup()
    core.startGroup(`Payload Info:`)
    core.info(`${JSON.stringify(github.context.payload, null, 2)}`)
    core.endGroup()
    core.info(`Repos ${owner}/${repo} List Tag`)
    let preversion = ''
    let preversionNumber = ''
    // Example: v1.2.1
    const preTag = latestRelease.data.tag_name || ''

    if (preTag && semver.valid(preTag)) {
      preversion = semver.coerce(preTag)?.version || ''
      preversionNumber = semver.coerce(preTag)?.raw || ''
      core.setOutput('version', preversion)
      core.setOutput('preversion', preversion)
      core.setOutput('preversionNumber', preversionNumber)
      core.setOutput('majorVersion', semver.major(preTag))
      core.setOutput('minorVersion', semver.minor(preTag))
      core.setOutput('patchVersion', semver.patch(preTag))
    }

    if (preTag && !semver.valid(preTag)) {
      core.warning(`Invalid version number \x1b[31;1m"${preTag}"\x1b[0m.`)
    }

    if (inputVersion && !semver.valid(inputVersion)) {
      core.setFailed(
        `Invalid version number \x1b[31;1m"${inputVersion}"\x1b[0m.`
      )
      return
    }

    if (inputVersion && semver.valid(inputVersion)) {
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

      core.info(`${owner} ${repo} ${inputVersion} - ${preTag} -${!!prerelease}`)
      if (release) {
        // octokit.rest.repos.createRelease
        await octokit.rest.repos.createRelease({
          owner,
          repo,
          prerelease: !!prerelease,
          tag_name: inputVersion,
          body: body || ''
        })
        core.info(`Created Released \x1b[32m${inputVersion || ' - '}\x1b[0m`)
      }
      return
    }
    if (!test && !packagePath) {
      core.setFailed(
        'Please setting\x1b[33m test\x1b[0m/\x1b[33m package-path\x1b[0m or Specify\x1b[33m version\x1b[0m! \n Please configure\x1b[33m package-path\x1b[0m'
      )
      return
    }
    /** current version, example: `v1.0.1` */
    let version = ''
    core.info(`Commit Content: \x1b[34m${commit}\x1b[0m`)

    if (test && !new RegExp(test).test(commit)) {
      core.info(
        `This is the feature of\x1b[35;1m "test" + "last commit"\x1b[0m to automatically create tags. \x1b[33mThis is not a tagged push.\x1b[0m ${commit}`
      )
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
      if (semver.valid(preTag) && !semver.gt(pkg.version, preTag)) {
        const listRelease = await octokit.rest.repos.listReleases({owner, repo})
        core.startGroup(`Get Release List:`)
        core.info(`${JSON.stringify(listRelease, null, 2)}`)
        core.endGroup()
        core.info(
          `The new tag \x1b[33m${pkg.version}\x1b[0m is smaller than \x1b[32m${preTag}\x1b[0m.\x1b[33m Do not create tag.\x1b[0m`
        )
        if (listRelease.data && listRelease.data.length > 0) {
          const {tag_name} = listRelease.data[0]
          core.info(
            `The new Released \x1b[33m${pkg.version}\x1b[0m >= \x1b[32m${tag_name}\x1b[0m.`
          )
          core.info(`CreateRelease: - ${preTag} - ${!!prerelease}`)
          core.info(`v1 > v2: ${semver.gt(`v${pkg.version}`, tag_name || '')}`)
          if (tag_name && semver.gt(`v${pkg.version}`, tag_name) && release) {
            await octokit.rest.repos.createRelease({
              owner,
              repo,
              prerelease: !!prerelease,
              tag_name: `v${pkg.version}`,
              body: body || ''
            })
            core.info(`Created Released \x1b[32m${tag_name || ' - '}\x1b[0m`)
            core.info(`Created Released Body: \x1b[32m${body || ' - '}\x1b[0m`)
          }
        }
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
    core.info(`${owner} ${repo} ${version} - ${preTag}`)
    core.setOutput('version', version || preTag)
    core.info(`output version: \x1b[33m${version || preTag}\x1b[0m`)
    if (semver.valid(version || preTag)) {
      core.setOutput('versionNumber', semver.coerce(version || preTag)?.raw)
      core.info(
        `output versionNumber: \x1b[33m${
          semver.coerce(version || preTag)?.raw
        }\x1b[0m`
      )
    }
    core.setOutput('successful', true)
    core.info(`output successful: \x1b[33m${true}\x1b[0m`)

    core.setOutput('majorVersion', semver.major(version))
    core.info(`output majorVersion: \x1b[33m${semver.major(version)}\x1b[0m`)
    core.setOutput('minorVersion', semver.minor(version))
    core.info(`output minorVersion: \x1b[33m${semver.minor(version)}\x1b[0m`)
    core.setOutput('patchVersion', semver.patch(version))
    core.info(`output patchVersion: \x1b[33m${semver.patch(version)}\x1b[0m`)

    if (release) {
      await octokit.rest.repos.createRelease({
        owner,
        repo,
        prerelease: !!prerelease,
        tag_name: version || preTag,
        body: body || ''
      })
      core.info(`Created Released \x1b[32m${inputVersion || ' - '}\x1b[0m`)
    }

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
  try {
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
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`CREATER_ERROR:${error.message}`)
    } else {
      core.setFailed(`CREATER_ERR:${error}`)
    }
  }
}

try {
  run()
} catch (error) {
  if (error instanceof Error) {
    core.setFailed(`CREATE_TAG_ERROR:${error.message}`)
  } else {
    core.setFailed(`CREATE_TAG_ERR:${error}`)
  }
}
