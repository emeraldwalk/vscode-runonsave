## Testing

Unit tests run via `vitest`. The `src/test` folder is excluded from the extension build (`tsconfig.json`). They are included when running tests (`tsconfig.unit.json`).

Run tests by running:

```sh
npm test
```

## Release Process

1. Ensure on commit to be released
   - For pre-release, this should technically work from any commit since package.json isn't update, but typically will be latest `main`
   - For release, this needs to be latest main since it will bump the package.json version
1. Make sure all unit tests pass `npm test`
1. Verify contents to publish `vsce ls`
1. Package local `.vsix` for testing `npm run package:latest`

### Publishing

#### Pre-Release

1. Determine the last pre-release version via:

```sh
git fetch --tags && git tag --list | grep pre
```

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
