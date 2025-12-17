#!/bin/bash
#
# Publish Script for VS Code Run On Save Extension
#
# This script publishes a new version of the vscode-runonsave extension to the
# VS Code Marketplace. It creates a release branch, publishes the extension,
# and tags the release.
#
# Usage: ./scripts/publish.sh <version>
# Example: ./scripts/publish.sh 1.0.x
if [ $# -ne 1 ]; then
    echo "Version required."
    exit 1
fi

set -e

# explicit version
version=$1
tag=v$version-release

git checkout -b release/$version

vsce publish \
 --allow-star-activation \
 --no-git-tag-version \
 $version

git add package*.json
git commit -m "$tag"
git tag "$tag"

git push --tags
git push -u origin HEAD

git checkout main