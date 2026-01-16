#!/usr/bin/env bash
set -euo pipefail

URL="${1:-${OLLAMA_URL:-http://localhost:11434}}"
TRIES=3
SLEEP=1
ENDPOINTS=("/v1/models" "/models" "/health" "/")

echo "Checking Ollama/Local LLM at $URL"

for attempt in $(seq 1 $TRIES); do
  for path in "${ENDPOINTS[@]}"; do
    full="$URL$path"
    echo "--> Trying $full"
    # Use a short curl timeout and capture output
    resp=$(curl -sS -m 5 -H "Accept: application/json" "$full" || true)
    if [ -n "$resp" ]; then
      echo "OK: Received response from $full"
      echo "--- Response preview ---"
      echo "$resp" | head -n 8
      echo "------------------------"
      exit 0
    fi
  done
  echo "Attempt $attempt failed; retrying in $SLEEP seconds..."
  sleep $SLEEP
done

echo "ERROR: Ollama/Local LLM not reachable at $URL (tested endpoints: ${ENDPOINTS[*]})" >&2
exit 2
