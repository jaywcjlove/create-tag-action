import * as core from '@actions/core'
import semver from 'semver'

export const getVersion = (ver: string): string => {
  let currentVersion = ''
  ver.replace(/([v|V]\d(\.\d+){0,2})/i, (str: string) => {
    currentVersion = str
    return str
  })
  return currentVersion
}

export const setOutputValue = (version: string) => {
  let preversion = semver.coerce(version)?.version || ''
  let preversionNumber = semver.coerce(version)?.raw || ''
  core.setOutput('version', preversion)
  core.setOutput('preversion', preversion)
  core.setOutput('preversionNumber', preversionNumber)
  core.setOutput('majorVersion', semver.major(version))
  core.setOutput('minorVersion', semver.minor(version))
  core.setOutput('patchVersion', semver.patch(version))
}