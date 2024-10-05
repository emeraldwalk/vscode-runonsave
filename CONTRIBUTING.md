## Release Process

### Setup

Update version in `package.json`

### Verification

1. Verify contents to publish `vsce ls`
1. Package local `.vsix` for testing `npm run package:latest`

### Publishing

#### Pre-Release

TODO: figure out best options here. Default seems to update package version and create commit + tag.
Issue here is have to then downgrade back to regular release version.

```sh
# Update pre-release version in command before running it
scripts/pre-release.sh 0.3.X
```

#### Release

```sh
vsce publish patch
git push
git push --tags
```
