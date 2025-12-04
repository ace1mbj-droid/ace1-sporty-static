# VS Code MCP setup for ACE#1 (Supabase)

This document explains how to configure the VS Code MCP integration for your Supabase project and run SQL safely from the IDE. The workspace contains a pre-configured `.vscode/mcp.json` that uses flag-based invocation so the runner does not accidentally treat inputs as package tags.

⚠️ Security note: do not commit service_role or personal access tokens to source control. Use the VS Code prompt (password input) to enter the token when starting the MCP server.

## Quick checklist

- Confirm `.vscode/mcp.json` exists and contains default inputs (project-ref, api-url, features). It’s been updated to use flags instead of positional args (fixes EINVALIDTAGNAME).
- Make sure `npx` is available locally (Node 18+ recommended).
- Keep your SUPABASE_ACCESS_TOKEN handy (service role or personal token with SQL permissions).

## Steps (VS Code MCP extension)

1. Open this project in VS Code.
2. Open the Command Palette (Cmd/Ctrl+Shift+P) and run `MCP: Start Server` (or the MCP extension UI).
3. When prompted, enter values:
   - Project ref: `vorqavsuqcjnkjzwkyzr` (or your project ID)
   - API URL: `https://mcp.supabase.com/mcp?project_ref=vorqavsuqcjnkjzwkyzr`
   - Features: `sql`
   - SUPABASE_ACCESS_TOKEN: paste the token (hidden input)

4. Once the MCP server is running, you can use the MCP actions from the extension (or run commands in the terminal) like:

```bash
# Apply SQL file (example)
npx -y @supabase/mcp-server-supabase@0.5.9 --project-ref vorqavsuqcjnkjzwkyzr \
  --api-url "https://mcp.supabase.com/mcp?project_ref=vorqavsuqcjnkjzwkyzr" \
  --features sql --SUPABASE_ACCESS_TOKEN "<TOKEN>" apply-sql ./ace1-sporty-static/sql/enable_admin_header_access.sql
```

5. Recommended order to run the workspace SQL changes:
   1. `sql/optimize_rls_policies.sql` (if not applied already)
   2. `sql/enable_admin_header_access.sql`
   3. `sql/seed_admin.sql` (create admin user, session & user_roles)

## Troubleshooting

- EINVALIDTAGNAME errors: caused by passing human labels or positional args. Use the flag-based form (`--project-ref`, `--api-url`, `--SUPABASE_ACCESS_TOKEN`).
- Invalid API key: ensure the token you use has correct permission (service_role or PAT with SQL rights). If you see 401/Invalid API key, verify the token.

If you want me to run these for you, confirm and I will run the `enable_admin_header_access.sql` and `seed_admin.sql` via the MCP runner.
