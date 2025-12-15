# Pre-release vscode extension. Requires version as argument.
if [ $# -ne 1 ]; then
    echo "Pre-release version required."
    exit 1
fi

set -e

vsce publish \
 --no-git-tag-version \
 --no-update-package-json \
 --pre-release \
 $1

git tag v$1-pre

git push --tags