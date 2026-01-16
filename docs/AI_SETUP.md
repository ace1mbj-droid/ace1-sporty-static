# Local AI / LLM Setup for ACE#1

This document explains how to install a local LLM endpoint (Ollama or LM Studio), install a VS Code extension, and configure workspace settings safely.

## 1) Install an extension in VS Code
- Open VS Code → Extensions (Cmd+Shift+X)
- Search for the extension you want, e.g., `Ollama` or `Local LLM` or `Code Llama`
- Click **Install** and then **Restart VS Code** if prompted

## 2) Run a local server (Ollama example)
- Install Ollama and run a model locally (recommended example):

```bash
# Install Ollama (macOS / Linux) — follow https://docs.ollama.com
# Pull a model (example: CodeLlama 7b is M1/M2 friendly, ~4GB):
ollama pull codellama:7b
# Run the pulled model as a local service:
ollama run codellama:7b --name codellama
# Alternative: run another model (e.g., Llama2) if you have it:
# ollama run llama2 --name my-llama

# Quick checks:
# list running models/services
ollama ps
# list downloaded images
ollama images
# The Ollama server listens on http://localhost:11434 by default
```

## 3) Configure workspace
- Edit the workspace file `.vscode/ace1-ai-config.json` and set provider URL(s).
- Example (already present in repo):

```json
{
  "providers": {
    "default": "ollama",
    "ollama": { "url": "http://localhost:11434", "apiKey": "" },
    "lmStudio": { "url": "http://localhost:11435", "apiKey": "" }
  },
  "integrations": { "github": true, "supabase": true }
}
```
## 5) Health check (quick test)
You can test your local Ollama/LM Studio server quickly using the included script:

```bash
# From the repo root (Node wrapper with retries):
npm run check:ollama
# or use the original shell script directly:
npm run check:ollama:sh
# or point to a different URL:
node scripts/check-ollama.js http://localhost:11434
```

## 6) VS Code Task (Run from Command Palette)
A convenience Task is included so you can run the check directly from VS Code's Command Palette:

- Open Command Palette (Cmd+Shift+P) → `Tasks: Run Task` → select `Check Ollama`.
- Or open the `Terminal` → `Run Task...` and pick `Check Ollama`.

This is wired to `npm run check:ollama` and will show output in the shared terminal panel.

## 7) Continue (optional, local models)
Continue is an excellent open-source AI code assistant for VS Code that works well with local models. Quick notes:

- Install the Continue extension via the Extensions pane (Cmd+Shift+X) and pin its sidebar.
- Configure models in Continue's `~/.continue/config.json` (Cmd+Shift+P → "Continue: Open config.json").
- Example config to use an Ollama-hosted model:

```json
{
  "models": [
    { "title": "CodeLlama", "provider": "ollama", "model": "codellama:7b-code" }
  ]
}
```

- Pull the model locally and run it with Ollama:
```bash
# Example: CodeLlama 7b (fits M1/M2, ~4GB)
ollama pull codellama:7b
ollama run codellama:7b --name codellama
```

### Install the repo Continue config automatically
To place the sample Continue config from this repo into your user Continue config (backs up any existing config):

```bash
# Prefer to verify Ollama is running (recommended):
npm run continue:config
# If Ollama is not running and you still want to install the config:
# (force will skip the Ollama check and install the config anyway)
npm run continue:config -- --force
# or
bash scripts/setup-continue-local.sh --force
```

After running the script, restart VS Code and open the Continue sidebar; it should show "CodeLlama (local)" and avoid Hub billing.

## Optional: automated start helper
If you want a convenience script that pulls and starts the model for you (backgrounded) use:

```bash
# Start or pull+start the default model (codellama:7b) in background
npm run start:ollama
# Or specify model and name explicitly
./scripts/start-ollama.sh codellama:7b codellama
```

The helper tries to pull the model if missing, starts it in the background, and waits for the HTTP API to respond. Check `/tmp/ollama-<name>.log` for logs if something fails.


- Use Continue commands (highlight code → Cmd+L to autocomplete, or run `/edit` to refactor).

> Security note: Continue and local models avoid cloud API limits and keep your code on-device. Don't store API keys in repo files.

The script probes common endpoints (`/v1/models`, `/models`, `/health`, `/`) and prints a short response preview when successful.
> **Security:** Do NOT commit real API keys or secrets. Set them via your user settings or environment variables.

## 4) Enable in settings
- The workspace `.vscode/settings.json` includes defaults:

```json
"ai.provider": "ollama",
"ai.ollama.serverUrl": "http://localhost:11434",
"ai.enableFor": { "github": true, "supabase": true }
```

## 5) GitHub & Supabase integration
- For GitHub Actions or the Supabase CLI, set secrets in their respective UIs (do not put them in repo files):
  - GitHub: Settings → Secrets and variables → Actions → New repository secret
  - Supabase: Project → Settings → API → Service role keys or secrets

## 6) Test
- In VS Code, confirm the extension points at `http://localhost:11434` and that requests succeed.
- Run a small prompt or code action and ensure results return from your local model.

---
If you want, I can add more automation (scripts to start Ollama/LM Studio locally, or a simple test script that sends a prompt and validates the response).