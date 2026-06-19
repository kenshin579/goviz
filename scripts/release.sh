#!/usr/bin/env bash
set -euo pipefail

# Create and push a release tag, which triggers .github/workflows/release.yml
# to build the macOS app and publish a GitHub Release.
#
# Usage: scripts/release.sh vX.Y.Z

if [ "$#" -ne 1 ]; then
  echo "usage: $0 vX.Y.Z" >&2
  exit 1
fi
version="$1"

if ! [[ "$version" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
  echo "error: version must look like v1.2.3 (got '$version')" >&2
  exit 1
fi

branch="$(git rev-parse --abbrev-ref HEAD)"
if [ "$branch" != "main" ]; then
  echo "error: release from 'main', not '$branch'" >&2
  exit 1
fi

if [ -n "$(git status --porcelain)" ]; then
  echo "error: working tree is not clean; commit or stash first" >&2
  exit 1
fi

git fetch --quiet origin main
if [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
  echo "error: local main is out of sync with origin/main; pull/push first" >&2
  exit 1
fi

if git rev-parse -q --verify "refs/tags/$version" >/dev/null 2>&1; then
  echo "error: local tag $version already exists" >&2
  exit 1
fi
if git ls-remote --tags --exit-code origin "refs/tags/$version" >/dev/null 2>&1; then
  echo "error: remote tag $version already exists" >&2
  exit 1
fi

git tag -a "$version" -m "Release $version"
git push origin "$version"

echo "Pushed tag $version — the release workflow will build and publish it."
