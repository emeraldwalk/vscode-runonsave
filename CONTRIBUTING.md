## Testing

Unit tests run via `vitest`. The `src/test` folder is excluded from the extension build (`tsconfig.json`). They are included when running tests (`tsconfig.unit.json`).

Run tests by running:

```sh
npm test
```

## Release Process

### Setup

Update version in `package.json`

### Verification

1. Make sure all unit tests pass `npm test`
1. Verify contents to publish `vsce ls`
1. Package local `.vsix` for testing `npm run package:latest`

### Publishing

#### Pre-Release

1. Determine the last pre-release version via `git tag --list | grep pre`
1. Determine the next patch version (e.g. 0.3.2 -> 0.3.3)
1. Run the following script to do a pre-release:

```sh
# Update the arg to the next patch version
scripts/pre-release.sh 0.3.X
```

> Note that the package.json version stays on the release sequence. Pre-release won't update the package.json

#### Release

```sh
vsce publish patch --allow-star-activation
git push
git push --tags
```
