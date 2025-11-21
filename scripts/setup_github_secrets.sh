#!/usr/bin/env bash
set -euo pipefail

# Usage:
# export GITHUB_REPO="<owner/repo>"
# export SUPABASE_ACCESS_TOKEN="..."
# export SUPABASE_PROJECT_REF="..."
# export SUPABASE_DB_URL="postgres://..."
# export RZ_KEY="..." RZ_SECRET="..."
# export FTP_HOST="..." FTP_USER="..." FTP_PASSWORD="..."
# ./scripts/setup_github_secrets.sh

: ${GITHUB_REPO:?"Set GITHUB_REPO=owner/repo"}

echo "Setting GitHub repository secrets for $GITHUB_REPO"

set -x

# supabase
gh secret set SUPABASE_ACCESS_TOKEN -b "$SUPABASE_ACCESS_TOKEN" -R "$GITHUB_REPO"
gh secret set SUPABASE_PROJECT_REF -b "$SUPABASE_PROJECT_REF" -R "$GITHUB_REPO"
gh secret set SUPABASE_DB_URL -b "$SUPABASE_DB_URL" -R "$GITHUB_REPO"

# razorpay
gh secret set RZ_KEY -b "$RZ_KEY" -R "$GITHUB_REPO"
gh secret set RZ_SECRET -b "$RZ_SECRET" -R "$GITHUB_REPO"

# ftp
gh secret set FTP_HOST -b "$FTP_HOST" -R "$GITHUB_REPO"
gh secret set FTP_USER -b "$FTP_USER" -R "$GITHUB_REPO"
gh secret set FTP_PASSWORD -b "$FTP_PASSWORD" -R "$GITHUB_REPO"

# optionally add SUPABASE_SERVICE_ROLE_KEY for local supabase secret (not for frontend)
if [ ! -z "${SUPABASE_SERVICE_ROLE_KEY:-}" ]; then
  gh secret set SUPABASE_SERVICE_ROLE_KEY -b "$SUPABASE_SERVICE_ROLE_KEY" -R "$GITHUB_REPO"
fi

set +x

echo "Done. Verify the secrets in https://github.com/$GITHUB_REPO/settings/secrets/actions"
