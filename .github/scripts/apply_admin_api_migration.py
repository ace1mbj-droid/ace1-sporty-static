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
from urllib.parse import urlsplit, quote


def parse_supabase_db_url(u: str):
    """Parse the SUPABASE_DB_URL robustly.
    Prefer urllib.parse.urlsplit but fall back to a permissive extractor if urlsplit
    raises ValueError for unusual or malformed netlocs.

    Returns (user, password, host, port, dbname)
    """
    try:
        # urlsplit is strict and will raise ValueError for bracketed non-IP hosts;
        # prefer it when it works so we get proper decoding of usernames/passwords.
        parts = urlsplit(u)
        user = parts.username or ''
        password = parts.password or ''
        host = parts.hostname or ''
        port = parts.port or 5432
        dbname = (parts.path or '').lstrip('/')
        return user, password, host, port, dbname
    except ValueError:
        # Fall back to a permissive parse (handles passwords containing '@' and
        # unbracketed hosts that urlsplit may choke on).
        rest = u.split('://', 1)[1] if '://' in u else u
        netloc = rest.split('/', 1)[0]
        dbname = rest.split('/', 1)[1] if '/' in rest else ''

        # credentials might contain ':' and '@', so split at the last '@' if present
        creds_split = netloc.rsplit('@', 1)
        if len(creds_split) == 2:
            creds, hostport = creds_split
            if ':' in creds:
                user, password = creds.split(':', 1)
            else:
                user, password = creds, ''
        else:
            hostport = creds_split[0]
            user = ''
            password = ''

        # handle IPv6 bracketed host or host:port
        host = hostport
        port = 5432
        if host.startswith('[') and ']' in host:
            closing = host.find(']')
            host = host[1:closing]
            rem = hostport[closing+1:]
            if rem.startswith(':'):
                _p = rem[1:]
                if _p:
                    port = int(_p)
        elif ':' in hostport:
            # split on last colon in case IPv6 was not bracketed but contains ':'
            parts_hp = hostport.rsplit(':', 1)
            host = parts_hp[0]
            try:
                port = int(parts_hp[1])
            except Exception:
                port = 5432

        return user, password, host, port, dbname


u = os.getenv('SUPABASE_DB_URL')
if not u:
    print('ERROR: SUPABASE_DB_URL empty')
    sys.exit(2)

# Robust parsing using urllib.parse.urlsplit
user, password, host, port, dbname = parse_supabase_db_url(u)
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
    print(f'Attempt {attempt}/{max_attempts} - trying explicit host/port connection (prefer IPv4)')

    # Resolve host to IPv4 if possible (to avoid IPv6 routing issues on hosted runners)
    try:
        import socket
        addrs = socket.getaddrinfo(host, None)
        ipv4 = next((ai[4][0] for ai in addrs if ai[0] == socket.AF_INET), None)
        if ipv4:
            host_to_use = ipv4
            print(f'DEBUG: resolved IPv4 {ipv4} for host {host}; using numeric IPv4 address')
        else:
            host_to_use = host
            print(f'DEBUG: no IPv4 address available for {host}; using original host for DNS resolution')
    except Exception as e:
        host_to_use = host
        print('DEBUG: host resolution error, using host as-is:', e)
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
        print('Migration applied successfully (via explicit host/port)')
        sys.exit(0)

    print(f'explicit host/port attempt returned {rc2}; trying direct URI as a secondary fallback')

    # Try direct connection with the full connection URL as a secondary fallback
    # Rebuild a safe URI using percent-encoding for username and password so psql won't mis-parse
    try:
        # Only reconstruct if we can parse parts; otherwise use original environment URI (u)
        safe_user = quote(user, safe='')
        safe_password = quote(password, safe='')
        safe_uri = f"postgresql://{safe_user}:{safe_password}@{host}:{port}/{dbname}"
    except Exception:
        safe_uri = u

    proc = subprocess.run(['psql', safe_uri, '-c', sql], env=env, capture_output=True, text=True)
    print('Direct attempt stdout:\n', proc.stdout)
    print('Direct attempt stderr:\n', proc.stderr)
    rc = proc.returncode
    if rc == 0:
        print('Migration applied successfully (via direct URI)')
        sys.exit(0)

    print(f'both explicit and direct attempts failed (explicit={rc2}, direct={rc}); retrying after backoff')
    # Exponential backoff plus a small jitter
    delay = attempt * 3 + (attempt % 3)
    time.sleep(delay)

print('All attempts failed — migration not applied')
sys.exit(3)
