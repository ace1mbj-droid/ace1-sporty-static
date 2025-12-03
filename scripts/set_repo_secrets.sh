#!/usr/bin/env bash
set -euo pipefail

# Helper to set GitHub repo secrets using gh CLI
# Usage: ./scripts/set_repo_secrets.sh [owner/repo]
# If repo is omitted, it will try to infer from git remote

REPO_SLUG="${1:-}"
if [[ -z "${REPO_SLUG}" ]]; then
  if git remote get-url origin >/dev/null 2>&1; then
    url=$(git remote get-url origin)
    # Support SSH and HTTPS remotes
    if [[ "$url" =~ git@github.com:(.*)\.git ]]; then
      REPO_SLUG="${BASH_REMATCH[1]}"
    elif [[ "$url" =~ https://github.com/(.*)\.git ]]; then
      REPO_SLUG="${BASH_REMATCH[1]}"
    elif [[ "$url" =~ https://github.com/(.*)$ ]]; then
      REPO_SLUG="${BASH_REMATCH[1]}"
    fi
  fi
fi

if [[ -z "${REPO_SLUG}" ]]; then
  echo "Could not infer owner/repo. Pass it explicitly, e.g.:"
  echo "  ./scripts/set_repo_secrets.sh ace1mbj-droid/ace1-sporty-static"
  exit 1
fi

echo "Target repository: $REPO_SLUG"

if ! command -v gh >/dev/null 2>&1; then
  echo "Error: GitHub CLI 'gh' is not installed."
  echo "Install: https://cli.github.com/ and run 'gh auth login' first."
  exit 1
fi

if ! gh auth status -h github.com >/dev/null 2>&1; then
  echo "You are not logged into GitHub CLI. Run: gh auth login"
  exit 1
fi

read -r -p "Set FTP secrets now? (y/N) " ftp_yes
if [[ "${ftp_yes,,}" == "y" ]]; then
  read -r -p "FTP_HOST: " FTP_HOST
  read -r -p "FTP_USER: " FTP_USER
  read -r -s -p "FTP_PASSWORD: " FTP_PASSWORD; echo
  gh secret set FTP_HOST --repo "$REPO_SLUG" --body "$FTP_HOST"
  gh secret set FTP_USER --repo "$REPO_SLUG" --body "$FTP_USER"
  gh secret set FTP_PASSWORD --repo "$REPO_SLUG" --body "$FTP_PASSWORD"
fi

read -r -p "Set Supabase secrets now? (y/N) " sb_yes
if [[ "${sb_yes,,}" == "y" ]]; then
  read -r -p "SUPABASE_PROJECT_REF (e.g. vorqavsuqcjnkjzwkyzr): " SUPABASE_PROJECT_REF
  read -r -s -p "SUPABASE_ACCESS_TOKEN: " SUPABASE_ACCESS_TOKEN; echo
  read -r -p "(Optional) SUPABASE_DB_URL: " SUPABASE_DB_URL || true
  gh secret set SUPABASE_PROJECT_REF --repo "$REPO_SLUG" --body "$SUPABASE_PROJECT_REF"
  gh secret set SUPABASE_ACCESS_TOKEN --repo "$REPO_SLUG" --body "$SUPABASE_ACCESS_TOKEN"
  if [[ -n "${SUPABASE_DB_URL:-}" ]]; then
    gh secret set SUPABASE_DB_URL --repo "$REPO_SLUG" --body "$SUPABASE_DB_URL"
  fi
fi

read -r -p "Set Razorpay secrets now? (y/N) " rz_yes
if [[ "${rz_yes,,}" == "y" ]]; then
  read -r -p "RZ_KEY: " RZ_KEY
  read -r -s -p "RZ_SECRET: " RZ_SECRET; echo
  gh secret set RZ_KEY --repo "$REPO_SLUG" --body "$RZ_KEY"
  gh secret set RZ_SECRET --repo "$REPO_SLUG" --body "$RZ_SECRET"
fi

echo "Done. Review secrets at: https://github.com/$REPO_SLUG/settings/secrets/actions"
