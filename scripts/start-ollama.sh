#!/usr/bin/env bash
set -euo pipefail

# start-ollama.sh: Best-effort helper to pull and run an Ollama model locally
# Usage:
#   ./scripts/start-ollama.sh [model] [name]
# Examples:
#   ./scripts/start-ollama.sh codellama:7b codellama
#   MODEL=codellama:7b NAME=codellama ./scripts/start-ollama.sh

MODEL="${1:-${MODEL:-codellama:7b}}"
NAME="${2:-${NAME:-codellama}}"
OLLAMA_URL="${OLLAMA_URL:-http://localhost:11434}"
LOGFILE="/tmp/ollama-${NAME}.log"
TRIES=${TRIES:-20}
SLEEP=${SLEEP:-3}

command -v ollama >/dev/null 2>&1 || {
  echo "ERROR: 'ollama' not found in PATH. Install Ollama first: https://docs.ollama.com" >&2
  exit 1
}

echo "Model: $MODEL"
echo "Service name: $NAME"

# Check if model is already running
if ollama ps 2>/dev/null | grep -E "\b${NAME}\b|${MODEL}" >/dev/null 2>&1; then
  echo "Ollama model '${NAME}' appears to already be running (or listed)."
  echo "Use 'ollama ps' to inspect or 'ollama stop $NAME' to stop it."
  exit 0
fi

# Check if model image is available
if ! ollama images 2>/dev/null | grep -E "\b${MODEL}\b" >/dev/null 2>&1; then
  echo "Model '$MODEL' not found locally — attempting to pull (this may take a while)..."
  if ! ollama pull "$MODEL"; then
    echo "ERROR: Failed to pull model '$MODEL'. See: https://docs.ollama.com" >&2
    exit 2
  fi
else
  echo "Model '$MODEL' is available locally."
fi

# Start the model in the background
echo "Starting model with: ollama run $MODEL --name $NAME"
# Use nohup to detach and capture logs
nohup ollama run "$MODEL" --name "$NAME" > "$LOGFILE" 2>&1 &
PID=$!
sleep 1

echo "Waiting for Ollama service to respond at $OLLAMA_URL (check logs: $LOGFILE)"

# Poll health endpoints
endpoints=("/v1/models" "/models" "/health" "/")
count=0
while [ $count -lt $TRIES ]; do
  for p in "${endpoints[@]}"; do
    if curl -sS -m 3 "$OLLAMA_URL$p" >/dev/null 2>&1; then
      echo "Ollama responded on endpoint: $p"
      echo "Started successfully (PID: $PID). Logs: $LOGFILE"
      exit 0
    fi
  done
  count=$((count+1))
  echo "Attempt $count/$TRIES: Ollama not up yet — sleeping ${SLEEP}s..."
  sleep $SLEEP
done

echo "ERROR: Ollama did not respond within $((TRIES*SLEEP)) seconds. Check log: $LOGFILE" >&2
echo "Tail last 40 lines of log:"
if [ -f "$LOGFILE" ]; then
  tail -n 40 "$LOGFILE" || true
fi
exit 3
