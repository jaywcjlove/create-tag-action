import * as core from '@actions/core'
import * as github from '@actions/github'
import FS from 'fs-extra'
import path from 'path'
import semver from 'semver'
import {getVersion, toVersionNumber, toVersionTag} from './utils'

/** `version`, `versionNumber`, and major/minor/patch for one version string. */
const outputReleaseVersion = (version: string): string => {
  const versionNumber = toVersionNumber(version)
  const versionTag = toVersionTag(version)
  if (!versionNumber || !versionTag) return ''
  core.setOutput('version', versionTag)
  core.setOutput('versionNumber', versionNumber)
  core.setOutput('majorVersion', semver.major(versionNumber))
  core.setOutput('minorVersion', semver.minor(versionNumber))
  core.setOutput('patchVersion', semver.patch(versionNumber))
  return versionTag
}

const outputPreviousVersion = (version: string): void => {
  const versionNumber = toVersionNumber(version)
  const versionTag = toVersionTag(version)
  if (!versionNumber || !versionTag) return
  core.setOutput('preversion', versionTag)
  core.setOutput('preversionNumber', versionNumber)
  outputReleaseVersion(version)
}

/** A previous tag that cannot be parsed does not block a new tag. */
const isNewer = (next: string, previous: string): boolean => {
  const nextNumber = toVersionNumber(next)
  const previousNumber = toVersionNumber(previous)
  if (!nextNumber || !previousNumber) return true
  return semver.gt(nextNumber, previousNumber)
}

export async function run(): Promise<void> {
  try {
    const myToken = core.getInput('token')
    /** The regular expression matches the submitted content. */
    const test = core.getInput('test')
    /** An optional body for the release. */
    const body = core.getInput('body') || ''
    /** Optionally marks this tag as `release`. Set to `true` to enable. */
    const release = core.getBooleanInput('release') || false
    /** Optionally marks this release as `prerelease`. Set to `true` to enable. */
    const prerelease = core.getBooleanInput('prerelease') || false
    /** Optionally marks this release as a draft release. Set to true to enable. */
    const draft = core.getBooleanInput('draft') || false
    /** Compare the tag `version` number in the `commit content` with the last tag and automatically generate tags */
    const commit: string =
      core.getInput('commit') ||
      github.context.payload?.head_commit?.message ||
      ''
    /** The path of the `package.json` file. Default `package.json`. */
    const packagePath = core.getInput('package-path')
    // Example: v1.0.0
    const inputVersion = core.getInput('version')
    const octokit = github.getOctokit(myToken)
    const {owner, repo} = github.context.repo
    core.info(`commit: ${commit || '\x1b[31;1mNo commit found\x1b[0m'}`)
    const latestRelease = await octokit.rest.repos.getLatestRelease({
      owner,
      repo
    })
    core.setOutput('successful', false)
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
    // Example: v1.2.1
    const preTag = latestRelease.data.tag_name || ''

    if (preTag && toVersionNumber(preTag)) {
      outputPreviousVersion(preTag)
    } else if (preTag) {
      core.warning(`Invalid version number \x1b[31;1m"${preTag}"\x1b[0m.`)
    }

    if (inputVersion && !toVersionNumber(inputVersion)) {
      core.setFailed(
        `Invalid version number \x1b[31;1m"${inputVersion}"\x1b[0m.`
      )
      return
    }

    if (inputVersion && toVersionNumber(inputVersion)) {
      const inputTag = outputReleaseVersion(inputVersion)
      core.info(`${owner} ${repo} ${inputTag} - ${preTag} -${prerelease}`)
      core.info(
        `Tagged \x1b[32m${inputTag}\x1b[0m!, Pre Tag: \x1b[33m${preTag}\x1b[0m `
      )
      if (!isNewer(inputVersion, preTag)) {
        core.info(
          `The new tag \x1b[33m${inputTag}\x1b[0m is smaller than \x1b[32m${preTag}\x1b[0m.\x1b[33m Do not create tag.\x1b[0m`
        )
        core.setOutput('successful', false)
        return
      }
      if (release) {
        await octokit.rest.repos.createRelease({
          owner,
          repo,
          prerelease,
          draft,
          tag_name: inputTag,
          body: body || ''
        })
        core.info(`Created Released \x1b[32m${inputTag || ' - '}\x1b[0m`)
        core.setOutput('successful', true)
      } else {
        const tagSha = await createTag(myToken, inputTag)
        core.info(
          `Tagged \x1b[32m${
            tagSha || ' - '
          }\x1b[0m as \x1b[32m${inputTag}\x1b[0m!, Pre Tag: \x1b[33m${preTag}\x1b[0m`
        )
        core.setOutput('successful', Boolean(tagSha))
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

      if (!isNewer(version, preTag)) {
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
      const pkgVersionNumber = toVersionNumber(`${pkg.version}`)
      if (!isNewer(`${pkg.version}`, preTag)) {
        const listRelease = await octokit.rest.repos.listReleases({owner, repo})
        core.startGroup(`Get Release List:`)
        if (listRelease.data && listRelease.data.length > 0) {
          for (const item of listRelease.data) {
            core.info(`${item.tag_name} -> ${item.name}`)
          }
        }
        core.endGroup()
        core.info(
          `The new tag \x1b[33m${pkg.version}\x1b[0m is smaller than \x1b[32m${preTag}\x1b[0m.\x1b[33m Do not create tag.\x1b[0m`
        )
        let created = false
        if (listRelease.data && listRelease.data.length > 0) {
          const {tag_name} = listRelease.data[0]
          const listedNumber = toVersionNumber(tag_name || '')
          const sameRelease = Boolean(
            listedNumber &&
            pkgVersionNumber &&
            listedNumber === pkgVersionNumber
          )
          core.info(
            `The new Released \x1b[33m${pkg.version}\x1b[0m >= \x1b[32m${tag_name}\x1b[0m.`
          )
          core.info(`CreateRelease: - ${preTag} - ${!!prerelease}`)
          core.info(
            `v1 > v2: ${
              listedNumber ? semver.gt(pkgVersionNumber, listedNumber) : false
            }, v${pkg.version} -> ${tag_name || ''}, ${release}`
          )
          core.info(
            `v1 <eq> v2: ${sameRelease}, v${pkg.version} -> ${
              tag_name || ''
            }, ${release}`
          )
          if (tag_name && !sameRelease) {
            const packageTag = toVersionTag(`${pkg.version}`)
            if (release) {
              await octokit.rest.repos.createRelease({
                owner,
                repo,
                prerelease: !!prerelease,
                tag_name: packageTag,
                body: body || ''
              })
              created = true
              core.info(`Created Released: - ${packageTag}`)
              core.info(`Created Released \x1b[32m${tag_name || ' - '}\x1b[0m`)
              core.info(
                `Created Released Body: \x1b[32m${body || ' - '}\x1b[0m`
              )
            } else {
              const tagSha = await createTag(myToken, packageTag)
              created = Boolean(tagSha)
              core.info(
                `Tagged \x1b[32m${
                  tagSha || ' - '
                }\x1b[0m as \x1b[32m${packageTag}\x1b[0m!, Pre Tag: \x1b[33m${preTag}\x1b[0m`
              )
              core.info(
                `Created Tag: - pkg.version: v${pkg.version}, version: ${packageTag}`
              )
              core.info(`Created Tag \x1b[32m${tag_name || ' - '}\x1b[0m`)
              core.info(`Created Tag Body: \x1b[32m${body || ' - '}\x1b[0m`)
              core.info(`Pre Tag: \x1b[32m${preTag || ' - '}\x1b[0m`)
            }
          }
        }
        core.info(`version: ${owner} ${repo} ${version} - ${preTag}`)
        outputReleaseVersion(version || preTag)
        core.setOutput('successful', created)
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
    const versionTag = outputReleaseVersion(version || preTag)
    if (!versionTag) return
    core.info(`${owner} ${repo} ${versionTag} - ${preTag}`)
    core.info(`output version: \x1b[33m${versionTag}\x1b[0m`)
    core.info(
      `output versionNumber: \x1b[33m${toVersionNumber(versionTag)}\x1b[0m`
    )
    const majorVersion = semver.major(toVersionNumber(versionTag))
    const minorVersion = semver.minor(toVersionNumber(versionTag))
    const patchVersion = semver.patch(toVersionNumber(versionTag))
    core.info(`output majorVersion: \x1b[33m${majorVersion}\x1b[0m`)
    core.info(`output minorVersion: \x1b[33m${minorVersion}\x1b[0m`)
    core.info(`output patchVersion: \x1b[33m${patchVersion}\x1b[0m`)

    if (release) {
      await octokit.rest.repos.createRelease({
        owner,
        repo,
        prerelease: !!prerelease,
        tag_name: versionTag,
        body: body || ''
      })
      core.setOutput('successful', true)
      core.info(`output successful: \x1b[33m${true}\x1b[0m`)
      core.info(`Created Released \x1b[32m${versionTag || ' - '}\x1b[0m`)
      core.info(
        `Tagged \x1b[32m${versionTag}\x1b[0m!, Pre Tag: \x1b[33m${preTag}\x1b[0m`
      )
    } else {
      const tagSha = await createTag(myToken, versionTag)
      const created = Boolean(tagSha)
      core.setOutput('successful', created)
      core.info(`output successful: \x1b[33m${created}\x1b[0m`)
      core.info(
        `Tagged \x1b[32m${
          tagSha || ' - '
        }\x1b[0m as \x1b[32m${versionTag}\x1b[0m!, Pre Tag: \x1b[33m${preTag}\x1b[0m`
      )
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`ERROR:${error.name}:${error.message}`)
    } else {
      core.setFailed(`ERROR:${error}`)
    }
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
      `CreateTag Result Data (${github.context.repo.owner}/${
        github.context.repo.repo
      }): \x1b[33m${tag_rsp.status || '-'}\x1b[0m `
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
      core.warning(`CREATER_ERROR: ${version}: ${error.message}`)
    } else {
      core.setFailed(`CREATER_ERR:${error}`)
    }
  }
}

// ncc folds `require.main === module` to false and drops this call.
// Jest sets JEST_WORKER_ID, so tests can import `run` without starting it.
if (!process.env.JEST_WORKER_ID) {
  try {
    run()
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(`CREATE_TAG_ERROR:${error.message}`)
    } else {
      core.setFailed(`CREATE_TAG_ERR:${error}`)
    }
  }
}
