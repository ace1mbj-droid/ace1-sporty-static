#!/usr/bin/env bash
set -euo pipefail

TARGET_DIR="$HOME/.continue"
TARGET_FILE="$TARGET_DIR/config.json"
BACKUP_SUFFIX="$(date +%Y%m%d%H%M%S)"
REPO_FILE="$(pwd)/.continue/config.json"

# Options: --force to skip Ollama health check
FORCE=false
OLLAMA_URL="${1:-${OLLAMA_URL:-http://localhost:11434}}"
if [ "$1" = "--force" ]; then
  FORCE=true
  OLLAMA_URL="${2:-${OLLAMA_URL:-http://localhost:11434}}"
fi

if [ ! -f "$REPO_FILE" ]; then
  echo "ERROR: repo sample config not found at $REPO_FILE" >&2
  exit 1
fi

# Small helper to probe Ollama endpoints
check_ollama() {
  local url="$1"
  local endpoints=("/v1/models" "/models" "/health" "/")
  for p in "${endpoints[@]}"; do
    if curl -sS -m 3 "$url$p" >/dev/null 2>&1; then
      return 0
    fi
  done
  return 1
}

if [ "$FORCE" = false ]; then
  echo "Checking for a running Ollama server at $OLLAMA_URL"
  if check_ollama "$OLLAMA_URL"; then
    echo "Ollama appears to be running — proceeding to write Continue config."
  else
    echo "WARNING: No response from Ollama at $OLLAMA_URL." >&2
    echo "If Ollama isn't running, Continue may still try to use the Hub (which can incur billing)."
    echo "Start Ollama (e.g., 'ollama run codellama:7b') or rerun with --force to override."
    exit 2
  fi
else
  echo "Force mode: skipping Ollama endpoint check and installing config anyway."
fi

mkdir -p "$TARGET_DIR"
if [ -f "$TARGET_FILE" ]; then
  echo "Found existing Continue config at $TARGET_FILE, backing up to ${TARGET_FILE}.bak.$BACKUP_SUFFIX"
  cp "$TARGET_FILE" "${TARGET_FILE}.bak.$BACKUP_SUFFIX"
fi

cp "$REPO_FILE" "$TARGET_FILE"
chmod 600 "$TARGET_FILE"

echo "Wrote Continue local config to $TARGET_FILE"
echo "Contents:" 
sed -n '1,120p' "$TARGET_FILE"

echo "\nNext steps:"
echo "  1) Ensure Ollama is installed and a model pulled, e.g.:"
echo "     ollama pull codellama:7b"
echo "  2) Restart VS Code and open the Continue sidebar."
echo "  3) Use autocomplete (Cmd+L) or chat in Continue; it should use the local Codellama model via Ollama."
echo "If you prefer not to overwrite existing config, restore the backup:"
echo "  cp ${TARGET_FILE}.bak.$BACKUP_SUFFIX $TARGET_FILE"
