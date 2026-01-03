#!/bin/bash
# ===================================
# AUTO CACHE VERSION BUMP SCRIPT
# ===================================
# Run this script on each deploy to auto-bump cache version
# Usage: ./scripts/bump-cache-version.sh

# Generate version string: v-<timestamp>-<git-short-hash>
VERSION="v-$(date +%s)-$(git rev-parse --short HEAD 2>/dev/null || echo 'deploy')"

# Write to cache-version.txt
echo "$VERSION" > cache-version.txt

echo "✅ Cache version bumped to: $VERSION"
echo "   Users will automatically get fresh assets on next page load."
