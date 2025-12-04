#!/usr/bin/env bash
set -euo pipefail

# This script runs in CI on pull requests.
# It ensures: 1) schema changes (sql/, supabase/schema.sql, supabase/functions/) are accompanied
# by a migration file added/modified under supabase/migrations/; 2) no dump/backup files are added.

BASE_REF=${1:-"origin/${GITHUB_BASE_REF:-main}"}

echo "Checking changes against base ref: ${BASE_REF}"

# Fetch base ref if missing
git fetch origin ${GITHUB_BASE_REF:-main} --depth=1 || true

# Compute changed files between base and current HEAD
CHANGED_FILES=$(git diff --name-only origin/${GITHUB_BASE_REF:-main}...HEAD || true)

echo "Changed files:"\n"${CHANGED_FILES}"

failed=false

# If schema-related files changed, require a migration change as well
if echo "${CHANGED_FILES}" | grep -Eq "(^|/)sql/|(^|/)supabase/schema.sql|(^|/)supabase/functions/"; then
  if ! echo "${CHANGED_FILES}" | grep -Eq "(^|/)supabase/migrations/"; then
    echo "ERROR: Schema or function files changed but no migration under supabase/migrations/ was added or updated." >&2
    echo "If your change modifies the DB schema or functions, add a migration file in supabase/migrations/." >&2
    failed=true
  else
    echo "Schema changes were accompanied by migration updates.";
  fi
fi

# Disallow adding dump or backup files anywhere (defensive)
ADDED_FILES=$(git diff --name-status origin/${GITHUB_BASE_REF:-main}...HEAD | awk '/^A/ {print $2}') || true
if [ -n "${ADDED_FILES}" ]; then
  for f in ${ADDED_FILES}; do
    # normalize to lower case for matching
    lc=$(echo "${f}" | tr '[:upper:]' '[:lower:]')

    # disallow top-level or nested dumps/backups with obvious names
    if echo "${lc}" | grep -Eq "(^|/)(dump|backup|snapshot)"; then
      echo "ERROR: Added file appears to be a dump/backup: ${f} — please don't commit DB dumps or backups to the repo." >&2
      failed=true
    fi

    # disallow .dump extension anywhere
    if echo "${lc}" | grep -Eq "\.dump$"; then
      echo "ERROR: Added file with .dump extension: ${f} — do not commit database dumps." >&2
      failed=true
    fi

    # disallow sql-like dumps added outside allowed migrations/sql directories
    if echo "${lc}" | grep -Eq "\.sql$"; then
      # allow migrations and SQL helper files under sql/; disallow large root SQL files with dump-like names
      if ! echo "${f}" | grep -Eq "(^|/)supabase/migrations/|(^|/)sql/|(^|/)supabase/schema.sql$"; then
        # If file name contains dump/backup/snapshot/seed_like or is large, warn/fail
        if echo "${lc}" | grep -Eq "(dump|backup|snapshot)"; then
          echo "ERROR: Added SQL file looks like a dump/backup: ${f} — do not commit." >&2
          failed=true
        fi
      fi
    fi
  done
fi

if [ "${failed}" = true ]; then
  echo "One or more CI checks failed — see messages above." >&2
  exit 1
fi

echo "CI checks passed: migrations present for schema changes, and no dumps/backups added."
