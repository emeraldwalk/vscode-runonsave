# Pre-release vscode extension. Requires version as argument.
if [ $# -ne 1 ]; then
    echo "Pre-release version required."
    exit 1
fi

set -e

# explicit version or minor/major/patch to increment
version=$1
tag=v$version-pre

vsce publish \
 --allow-star-activation \
 --no-git-tag-version \
 --pre-release \
 $version

git tag $tag
git push --tags