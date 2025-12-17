# Pre-release vscode extension. Requires version as argument.
if [ $# -ne 1 ]; then
    echo "Pre-release version required."
    exit 1
fi

set -e

# explicit version or minor/major/patch to increment
version=$1

vsce publish \
 --allow-star-activation \
 --no-git-tag-version \
 --pre-release \
 $version

# Read the actual version from package.json after publish
new_version=$(node -p "require('./package.json').version")
tag="v${new_version}-pre"

git add package*.json
git commit -m "$tag"
git tag "$tag"

git push --tags
git push