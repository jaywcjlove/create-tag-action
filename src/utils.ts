import semver from 'semver'

export const getVersion = (ver: string): string => {
  let currentVersion = ''
  ver.replace(/([v|V]\d(\.\d+){0,2})/i, (str: string) => {
    currentVersion = str
    return str
  })
  return currentVersion
}

/**
 * Version number without a leading `v`, for example `1.2.3` or `1.2.3-beta.1`.
 * Returns `''` only when `version` contains no parsable semver.
 * `semver.valid` keeps prerelease identifiers. A leading `V` is normalized
 * first, because `semver` rejects it and `coerce` would drop the prerelease.
 * `semver.coerce` fills in a missing minor or patch (`v1.2` -> `1.2.0`).
 */
export const toVersionNumber = (version: string): string => {
  if (!version) return ''
  const trimmed = version.trim().replace(/^[vV]/, '')
  return (
    semver.valid(trimmed) ||
    semver.clean(trimmed) ||
    semver.coerce(trimmed)?.version ||
    ''
  )
}

/** Tag form of a version, for example `v1.2.3` or `v1.2.3-beta.1`. */
export const toVersionTag = (version: string): string => {
  const versionNumber = toVersionNumber(version)
  return versionNumber ? `v${versionNumber}` : ''
}
