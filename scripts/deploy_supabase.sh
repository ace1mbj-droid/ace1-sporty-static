#!/usr/bin/env bash
set -euo pipefail

# Usage:
# SUPABASE_ACCESS_TOKEN=... SUPABASE_PROJECT_REF=... SUPABASE_DB_URL=... RZ_KEY=... RZ_SECRET=... ./scripts/deploy_supabase.sh

PROJECT_REF=${SUPABASE_PROJECT_REF:-}
ACCESS_TOKEN=${SUPABASE_ACCESS_TOKEN:-}
DB_URL=${SUPABASE_DB_URL:-}

if [ -z "$PROJECT_REF" ] || [ -z "$ACCESS_TOKEN" ] || [ -z "$DB_URL" ]; then
  echo "Missing required env vars. Provide SUPABASE_ACCESS_TOKEN, SUPABASE_PROJECT_REF, SUPABASE_DB_URL"
  exit 1
fi

echo "Installing supabase CLI and dependencies (node + psql)"
# Install supabase cli via npm
npm i -g supabase@latest || true

# Install psql client for DB migrations
if ! command -v psql >/dev/null 2>&1; then
  echo "Installing postgresql-client"
  if [[ "$OSTYPE" == "darwin"* ]]; then
    brew install libpq || true
    # Manually add to PATH on mac if needed
    export PATH="/opt/homebrew/opt/libpq/bin:$PATH"
  else
    sudo apt-get update && sudo apt-get install -y postgresql-client
  fi
fi

echo "Login to Supabase CLI"
# The CLI use for non-interactive workflows requires token
supabase login --token "$ACCESS_TOKEN"

echo "Linking project ref: $PROJECT_REF"
supabase link --project-ref $PROJECT_REF

# Push SQL schema via psql (we expect SUPABASE_DB_URL to be a connection string w/ service role or user w/ create privileges)
echo "Pushing schema via psql"
psql "$DB_URL" -f supabase/schema.sql
psql "$DB_URL" -f supabase/rls.sql

# Deploy Edge Functions
echo "Deploying Edge Functions"
# Deploy functions by iterating directory
for f in supabase/functions/*; do
  if [ -d "$f" ]; then
    FN_NAME=$(basename "$f")
    echo "Deploying function: $FN_NAME"
    supabase functions deploy "$FN_NAME" --project-ref "$PROJECT_REF" --no-verify
  fi
done

# Set secrets for edge functions with secure envs
if [ -n "${RZ_KEY:-}" ] && [ -n "${RZ_SECRET:-}" ]; then
  echo "Setting secure Secrets in Supabase (RZ_KEY, RZ_SECRET)."
  # May require supabase secrets command syntax; adjust if CLI changes.
  supabase secrets set RZ_KEY="$RZ_KEY" RZ_SECRET="$RZ_SECRET" --project-ref "$PROJECT_REF"
fi

echo "Supabase deploy finished"
