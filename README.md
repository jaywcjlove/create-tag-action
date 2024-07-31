create-tag-action
===

[![Buy me a coffee](https://img.shields.io/badge/Buy%20me%20a%20coffee-048754?logo=buymeacoffee)](https://jaywcjlove.github.io/#/sponsor)
[![CI](https://github.com/jaywcjlove/create-tag-action/actions/workflows/create-tag.yml/badge.svg)](https://github.com/jaywcjlove/create-tag-action/actions/workflows/create-tag.yml)
[![Repo Dependents](https://badgen.net/github/dependents-repo/jaywcjlove/create-tag-action)](https://github.com/jaywcjlove/create-tag-action/network/dependents)

Auto create tags from commit or package.json

## Inputs

- `token` Your `GITHUB_TOKEN`. This is required. Why do we need `token`? Read more here: [About the GITHUB_TOKEN secret](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret). Default: `${{ github.token }}`
- `version` Create tag for specified version. Exampe: `version: v1.0.0`
- `test` The regular expression matches the submitted content. Exampe: `test: '[R|r]elease[d]\s+[v|V]\d(\.\d+){0,2}'`
- `commit` The regular expression matches the submitted content. Default: `{github.context.payload?.head_commit?.message}`
- `package-path` The path of the `package.json` file. Default `package.json`.
- `release` Optionally marks this tag as `release`. Set to `true` to enable.
- `prerelease` Optionally marks this release as `prerelease`. Set to `true` to enable.
- `draft` Optionally marks this release as a `draft` release. Set to true to enable.
- `body` An optional body for the release.

## Outputs

- `version` The version number of the tag created, example: `v1.0.0`.
- `versionNumber` The version number of the tag created, example: `1.0.0`.
- `preversion` The previous tag version number, example: `v1.0.0`.
- `preversionNumber` The previous tag version number of the tag created. example: `1.0.0`.
- `successful` The tag was successfully created. example: `"true"`.
- `majorVersion` MAJOR version when you make incompatible API changes.
- `minorVersion` MINOR version when you add functionality in a backwards compatible manner, and.
- `patchVersion` PATCH version when you make backwards compatible bug fixes.

```yml
- run: echo "version - ${{ steps.create_tag.outputs.version }}"
- run: echo "version || preversion - ${{ steps.create_tag.outputs.version || steps.create_tag.outputs.preversion }}"
- run: echo "versionNumber - ${{ steps.create_tag.outputs.versionNumber }}"
- run: echo "versionNumber || preversionNumber - ${{ steps.create_tag.outputs.versionNumber || steps.create_tag.outputs.preversionNumber }}"
- run: echo "majorVersion - ${{ steps.create_tag.outputs.majorVersion }}"
- run: echo "minorVersion - ${{ steps.create_tag.outputs.minorVersion }}"
- run: echo "patchVersion - ${{ steps.create_tag.outputs.patchVersion }}"
- run: echo "preversion - ${{ steps.create_tag.outputs.preversion }}"
- run: echo "successful - ${{ steps.create_tag.outputs.successful }}"
```

> [!WARNING]
> In the new action, you need to add the [`permissions`](https://docs.github.com/en/actions/using-jobs/assigning-permissions-to-jobs) configuration:
> 
> ```yml
> jobs: 
>   tags:
>     runs-on: ubuntu-latest
>     permissions:
>       contents: write
>     steps:
>       - name: Create Tag
>         id: create_tag
>         uses: jaywcjlove/create-tag-action@main
>         if: env.previous_tag
>         with:
>           test: '[R|r]elease[d]\s+[v|V]\d(\.\d+){0,2}'
> ```

## Example Usage

First, we must listen for `push` events

```yml
on:
  push:
    branches:
      - master
    paths-ignore:
      - '.github/**/*.yml'
      - '.gitignore'
```

Compare the tag `version` number in `package.json` with the last tag and automatically generate tags

```yml
- run: echo "previous_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo '')" >> $GITHUB_ENV
- name: Create Tag
  id: create_tag
  uses: jaywcjlove/create-tag-action@main
  if: env.previous_tag
  with:
    package-path: ./package.json
```

Or, Compare the tag `version` number in the `commit content` with the last tag and automatically generate tags

```yml
- run: echo "previous_tag=$(git describe --tags --abbrev=0 2>/dev/null || echo '')" >> $GITHUB_ENV
- name: Create Tag
  id: create_tag
  uses: jaywcjlove/create-tag-action@main
  if: env.previous_tag
  with:
    test: '[R|r]elease[d]\s+[v|V]\d(\.\d+){0,2}'
```

Use `steps.<job_id>.outputs.successful` to determine whether the version is created successfully, and a changelog will be automatically generated.

```yml
- name: Generate Changelog
  id: changelog
  uses: jaywcjlove/changelog-generator@main
  if: steps.create_tag.outputs.successful == 'true'
  with:
    head-ref: ${{steps.create_tag.outputs.version}}
    filter-author: (jaywcjlove|小弟调调™|dependabot\[bot\]|Renovate Bot)
    filter: (^[\s]+?[R|r]elease)|(^[R|r]elease)
```

Use `steps.<job_id>.outputs.successful` to determine whether the version is created successfully, the creation has been released

```yml
- name: Create Release
  uses: ncipollo/release-action@v1
  if: steps.create_tag.outputs.successful == 'true'
  with:
    allowUpdates: true
    token: ${{ secrets.GITHUB_TOKEN }}
    name: ${{ steps.create_tag.outputs.version }}
    tag: ${{ steps.create_tag.outputs.version }}
    body: |
      ```bash
      npm i @uiw/react-heat-map@${{steps.create_tag.outputs.versionNumber}}
      ```

      ${{ steps.changelog.outputs.compareurl }}
      ${{ steps.changelog.outputs.changelog }}
```

OR use `jaywcjlove/create-tag-action@main` create release: 

```yml
- name: Create Release
  uses: jaywcjlove/create-tag-action@main
  id: release
  if: steps.create_tag.outputs.successful == 'true'
  with:
    version: ${{steps.create_tag.outputs.version}}
    release: true
    body: |
      ```bash
      npm i @uiw/react-heat-map@${{steps.create_tag.outputs.versionNumber}}
      ```

      ${{ steps.changelog.outputs.compareurl }}
      ${{ steps.changelog.outputs.changelog }}

- name: Release Upload Assets
  uses: jaywcjlove/github-action-upload-assets@main
  continue-on-error: true
  with:
    tag: ${{ steps.release.outputs.version }}
    asset-path: '["./target/release/sgo-*"]'
```

## See Also

- [Github Release Changelog Generator](https://github.com/jaywcjlove/changelog-generator) A GitHub Action that compares the commit differences between two branches
- [Github Action Contributors](https://github.com/jaywcjlove/github-action-contributors) Github action generates dynamic image URL for contributor list to display it!
- [Generated Badges](https://github.com/jaywcjlove/generated-badges) Create a badge using GitHub Actions and GitHub Workflow CPU time (no 3rd parties servers)
- [Create Coverage Badges](https://github.com/jaywcjlove/coverage-badges-cli) Create coverage badges from coverage reports. (no 3rd parties servers)
- [Github Action package](https://github.com/jaywcjlove/github-action-package) Read and modify the contents of `package.json`.

## Example

- [react-code-preview](https://github.com/uiwjs/react-code-preview/blob/fb9829440a21fddbb57100db62ae113be3c01161/.github/workflows/ci.yml#L35-L40)
- [react-md-editor](https://github.com/uiwjs/react-md-editor/blob/e3293bca45bff08110ef5e9119d907db2ec95baa/.github/workflows/ci.yml#L23-L28)
- [react-markdown-preview](https://github.com/uiwjs/react-markdown-preview/blob/b230eba6526786cbd7318e514276fd05ae58edc9/.github/workflows/ci.yml#L21-L26)
- [react-native-uiw](https://github.com/uiwjs/react-native-uiw/blob/9876540e78df61b5c5d906451b3c76bb2168c23c/.github/workflows/ci.yml#L22-L27)

## License

The scripts and documentation in this project are released under the [MIT License](./LICENSE)
