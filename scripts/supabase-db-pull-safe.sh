#!/usr/bin/env bash
set -euo pipefail

# Runs `supabase db pull --yes` but treats "No schema changes found" as success.
# This avoids failing CI/tasks when the DB is already in sync.

tmp_out="$(mktemp)"

set +e
supabase db pull --yes 2>&1 | tee "$tmp_out"
exit_code=${PIPESTATUS[0]}
set -e

if [[ $exit_code -eq 0 ]]; then
  exit 0
fi

if grep -q "No schema changes found" "$tmp_out"; then
  exit 0
fi

exit "$exit_code"
