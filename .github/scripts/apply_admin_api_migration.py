#!/usr/bin/env python3
"""
Safe helper script to apply the migration that adds `admin_api_url` to `public.site_settings`.
This file is intentionally checked into the repository so the CI workflow can run it without
embedding a large heredoc in the workflow file (which previously caused YAML/indentation problems).

Environment input:
- SUPABASE_DB_URL (from GitHub secrets)

Behavior:
- Parse SUPABASE_DB_URL using urllib.parse.urlsplit (handles IPv6 bracketed hosts)
- Try `psql <URI>` first; if that fails, resolve to an IPv4 address if possible and try
  explicit host/port/user/db invocation.
- Capture stdout/stderr for diagnostics and return non-zero codes if migration fails.
"""

import os
import subprocess
import sys
import time
from urllib.parse import urlsplit

u = os.getenv('SUPABASE_DB_URL')
if not u:
    print('ERROR: SUPABASE_DB_URL empty')
    sys.exit(2)

# Robust parsing using urllib.parse.urlsplit
parts = urlsplit(u)
user = parts.username or ''
password = parts.password or ''
host = parts.hostname or ''
port = parts.port or 5432
dbname = (parts.path or '').lstrip('/')
print(f"DBG: host={host or '<missing>'} port={port or '<missing>'} db={dbname or '<missing>'} user={user or '<missing>'}")

if not (host and dbname and user):
    print('ERROR: Failed to parse host/user/db from SUPABASE_DB_URL')
    print('url=', u)
    sys.exit(2)

sql = 'ALTER TABLE IF EXISTS public.site_settings ADD COLUMN IF NOT EXISTS admin_api_url text;'
env = dict(os.environ)
env['PGPASSWORD'] = password

# Increase attempts and add verbose output to capture stdout/stderr for diagnostics
max_attempts = 10
for attempt in range(1, max_attempts + 1):
    print(f'Attempt {attempt}/{max_attempts} - trying direct connection via URI')

    # Try direct connection with the full connection URL first (psql accepts a URI argument)
    proc = subprocess.run(['psql', u, '-c', sql], env=env, capture_output=True, text=True)
    print('Direct attempt stdout:\n', proc.stdout)
    print('Direct attempt stderr:\n', proc.stderr)
    rc = proc.returncode
    if rc == 0:
        print('Migration applied successfully (direct)')
        sys.exit(0)

    print(f'direct psql attempt returned {rc} — trying explicit host/port (fallback)')

    # Resolve host to IPv4 if necessary and use explicit host/port/user/db
    # Prefer a numeric IPv4 address if available to avoid IPv6 routing issues on hosted runners
    try:
        import socket
        addrs = socket.getaddrinfo(host, None)
        ipv4 = next((ai[4][0] for ai in addrs if ai[0] == socket.AF_INET), None)
        host_to_use = ipv4 or host
    except Exception:
        host_to_use = host

    cmd = ['psql', '-h', host_to_use, '-p', str(port), '-U', user, '-d', dbname, '-c', sql]
    proc2 = subprocess.run(cmd, env=env, capture_output=True, text=True)
    print('Fallback stdout:\n', proc2.stdout)
    print('Fallback stderr:\n', proc2.stderr)
    rc2 = proc2.returncode
    if rc2 == 0:
        print('Migration applied successfully (via fallback host/port)')
        sys.exit(0)

    print(f'Both attempts failed (direct={rc}, fallback={rc2}); retrying after backoff')
    # Exponential backoff plus a small jitter
    delay = attempt * 3 + (attempt % 3)
    time.sleep(delay)

print('All attempts failed — migration not applied')
sys.exit(3)
