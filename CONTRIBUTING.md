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

1. Main branch should stay on pre-release versions
1. Checkout to latest commit on `main`
1. Run `npm install`
1. Run the following script to do a pre-release:

```sh
# Update the arg to the next patch version
scripts/pre-release.sh patch
```

#### Release

Releases will create a release/vX.X.X branch from a pre-release tag and increment the version there and tag the release commit.

1. Checkout to pre-release tag to publish
1. Adjust the tag version to corresponding release version.
   e.g. v1.1.2-pre -> 1.0.2

```sh
./scripts/publish.sh 1.0.x
```
