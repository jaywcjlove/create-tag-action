create-tag-action
----

[![build-test](https://github.com/jaywcjlove/create-tag-action/workflows/build-test/badge.svg)](https://github.com/actions/typescript-action/actions)

Auto create tags from commit or package.json

## Inputs

#### `token`

Your `GITHUB_TOKEN`. This is required. Why do we need `token`? Read more here: [About the GITHUB_TOKEN secret](https://help.github.com/en/actions/automating-your-workflow-with-github-actions/authenticating-with-the-github_token#about-the-github_token-secret)

#### `version`

Create tag for specified version. Exampe: `version: v1.0.0`

#### `test`

The regular expression matches the submitted content. Exampe: `test: '[R|r]elease[d]\s+[v|V]\d(\.\d+){0,2}'`

#### `package-path`

The path of the `package.json` file.

## Outputs

- `version` The version number of the tag created, example: `v1.0.0`.
- `versionNumber` The version number of the tag created, example: `1.0.0`.
- `preversion` The previous tag version number, example: `1.0.0`.
- `successful` The tag was successfully created.
- `majorVersion` MAJOR version when you make incompatible API changes.
- `minorVersion` MINOR version when you add functionality in a backwards compatible manner, and.
- `patchVersion` PATCH version when you make backwards compatible bug fixes.

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
- name: Create Tag
  id: create_tag
  uses: jaywcjlove/create-tag-action@main
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    package-path: ./package.json
```

Or, Compare the tag `version` number in the `commit content` with the last tag and automatically generate tags

```yml
- name: Create Tag
  id: create_tag
  uses: jaywcjlove/create-tag-action@main
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    test: '[R|r]elease[d]\s+[v|V]\d(\.\d+){0,2}'
```

Use `steps.<job_id>.outputs.successful` to determine whether the version is created successfully, and a changelog will be automatically generated.

```yml
- name: Generate Changelog
  id: changelog
  uses: jaywcjlove/changelog-generator@main
  if: steps.create_tag.outputs.successful
  with:
    token: ${{ secrets.GITHUB_TOKEN }}
    head-ref: ${{steps.create_tag.outputs.version}}
    filter-author: (jaywcjlove|小弟调调™|dependabot\[bot\]|Renovate Bot)
    filter: (^[\s]+?[R|r]elease)|(^[R|r]elease)
```

Use `steps.<job_id>.outputs.successful` to determine whether the version is created successfully, the creation has been released

```yml
- name: Create Release
  uses: ncipollo/release-action@v1
  if: steps.create_tag.outputs.successful
  with:
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

## Related

- [Github Release Changelog Generator](https://github.com/jaywcjlove/changelog-generator) A GitHub Action that compares the commit differences between two branches

## License

The scripts and documentation in this project are released under the [MIT License](./LICENSE)
