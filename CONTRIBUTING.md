## Testing

Unit tests run via `vitest`. The `src/test` folder is excluded from the extension build (`tsconfig.json`). They are included when running tests (`tsconfig.unit.json`).

Run tests by running:

```sh
npm test
```

## Release Process

1. Ensure on commit to be released
   - For pre-release, this should be the latest `main` since `package.json` version will be updated
   - For release, this will be a previously released pre-release tag. The version will not be updated in the `main` branch, only in the newly created release branch
1. Make sure all unit tests pass `npm test`
1. Verify contents to publish `vsce ls`
1. Package local `.vsix` for testing `npm run package:latest`

### Publishing

To verify auth token still works, run:

```sh
npx vsce login <publisher>
```

When prompted for PAT, can copy $VSCE_PAT value. If it still works, we're good, otherwise need to generate new one in Azure DevOps.

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
