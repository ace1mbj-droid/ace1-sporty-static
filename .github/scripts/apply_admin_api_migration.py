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

# Run comprehensive diagnostics before attempting connection
print('\n=== DIAGNOSTIC PHASE ===')
print(f'Target: {host}:{port}')

# DNS resolution diagnostics
print('\n--- DNS Resolution ---')
try:
    import socket
    print(f'Attempting DNS lookup for {host}...')
    addrs = socket.getaddrinfo(host, None)
    ipv4_addrs = [ai[4][0] for ai in addrs if ai[0] == socket.AF_INET]
    ipv6_addrs = [ai[4][0] for ai in addrs if ai[0] == socket.AF_INET6]
    
    if ipv4_addrs:
        print(f'IPv4 addresses: {", ".join(ipv4_addrs)}')
    else:
        print('IPv4 addresses: NONE')
    
    if ipv6_addrs:
        print(f'IPv6 addresses: {", ".join(ipv6_addrs)}')
    else:
        print('IPv6 addresses: NONE')
        
    if not ipv4_addrs and not ipv6_addrs:
        print('WARNING: No IP addresses resolved for host!')
except Exception as e:
    print(f'DNS lookup failed: {e}')

# Check if dig is available for more detailed DNS info
try:
    dig_proc = subprocess.run(['dig', '+short', host], capture_output=True, text=True, timeout=5)
    if dig_proc.returncode == 0 and dig_proc.stdout.strip():
        print(f'dig output: {dig_proc.stdout.strip()}')
except Exception:
    pass  # dig not available or failed

# Network connectivity tests
print('\n--- Network Connectivity Tests ---')

# Test IPv4 connectivity if available
if ipv4_addrs:
    test_ipv4 = ipv4_addrs[0]
    print(f'Testing TCP connection to IPv4 {test_ipv4}:{port}...')
    try:
        nc_proc = subprocess.run(['nc', '-z', '-v', '-w', '3', test_ipv4, str(port)], 
                                capture_output=True, text=True, timeout=5)
        print(f'nc IPv4 result (rc={nc_proc.returncode}): {nc_proc.stderr.strip()}')
    except Exception as e:
        print(f'nc IPv4 test failed: {e}')
    
    # Try telnet as fallback
    try:
        telnet_proc = subprocess.run(['timeout', '3', 'telnet', test_ipv4, str(port)], 
                                    capture_output=True, text=True, timeout=5)
        print(f'telnet IPv4 result (rc={telnet_proc.returncode})')
    except Exception:
        pass

# Test IPv6 connectivity if available
if ipv6_addrs:
    test_ipv6 = ipv6_addrs[0]
    print(f'Testing TCP connection to IPv6 [{test_ipv6}]:{port}...')
    try:
        nc_proc = subprocess.run(['nc', '-z', '-v', '-w', '3', test_ipv6, str(port)], 
                                capture_output=True, text=True, timeout=5)
        print(f'nc IPv6 result (rc={nc_proc.returncode}): {nc_proc.stderr.strip()}')
    except Exception as e:
        print(f'nc IPv6 test failed: {e}')

# Test hostname directly
print(f'Testing TCP connection to hostname {host}:{port}...')
try:
    nc_proc = subprocess.run(['nc', '-z', '-v', '-w', '3', host, str(port)], 
                            capture_output=True, text=True, timeout=5)
    print(f'nc hostname result (rc={nc_proc.returncode}): {nc_proc.stderr.strip()}')
except Exception as e:
    print(f'nc hostname test failed: {e}')

print('\n=== END DIAGNOSTICS ===\n')

# Increase attempts and add verbose output to capture stdout/stderr for diagnostics
max_attempts = 10
for attempt in range(1, max_attempts + 1):
    print(f'\n=== Attempt {attempt}/{max_attempts} ===')
    print(f'Trying explicit host/port connection (prefer IPv4)')

    # Resolve host to IPv4 if possible (to avoid IPv6 routing issues on hosted runners)
    host_to_use = host
    try:
        import socket
        addrs = socket.getaddrinfo(host, None)
        ipv4 = next((ai[4][0] for ai in addrs if ai[0] == socket.AF_INET), None)
        if ipv4:
            host_to_use = ipv4
            print(f'Using IPv4 address: {ipv4}')
        else:
            print(f'No IPv4 available, using hostname: {host}')
    except Exception as e:
        print(f'Host resolution error: {e}')

    cmd = ['psql', '-h', host_to_use, '-p', str(port), '-U', user, '-d', dbname, '-c', sql]
    print(f'Command: psql -h {host_to_use} -p {port} -U {user} -d {dbname} -c <SQL>')
    proc2 = subprocess.run(cmd, env=env, capture_output=True, text=True)
    
    if proc2.stdout.strip():
        print(f'Explicit host/port stdout:\n{proc2.stdout}')
    if proc2.stderr.strip():
        print(f'Explicit host/port stderr:\n{proc2.stderr}')
    
    rc2 = proc2.returncode
    print(f'Return code: {rc2}')
    
    if rc2 == 0:
        print('✓ Migration applied successfully (via explicit host/port)')
        sys.exit(0)

    print(f'\nExplicit connection failed (rc={rc2}), trying percent-encoded URI...')

    # Rebuild a safe URI using percent-encoding for username and password so psql won't mis-parse
    try:
        safe_user = quote(user, safe='')
        safe_password = quote(password, safe='')
        safe_uri = f"postgresql://{safe_user}:{safe_password}@{host}:{port}/{dbname}"
        print(f'Using encoded URI: postgresql://{safe_user}:***@{host}:{port}/{dbname}')
    except Exception as e:
        safe_uri = u
        print(f'URI encoding failed ({e}), using original')

    proc = subprocess.run(['psql', safe_uri, '-c', sql], env=env, capture_output=True, text=True)
    
    if proc.stdout.strip():
        print(f'Direct URI stdout:\n{proc.stdout}')
    if proc.stderr.strip():
        print(f'Direct URI stderr:\n{proc.stderr}')
    
    rc = proc.returncode
    print(f'Return code: {rc}')
    
    if rc == 0:
        print('✓ Migration applied successfully (via direct URI)')
        sys.exit(0)

    print(f'\nBoth methods failed (explicit={rc2}, URI={rc})')
    
    if attempt < max_attempts:
        delay = attempt * 3 + (attempt % 3)
        print(f'Retrying after {delay}s backoff...\n')
        time.sleep(delay)

print('All attempts failed — migration not applied')
print('\n=== SUMMARY ===')
print(f'Total attempts: {max_attempts}')
print(f'Target: {host}:{port}')
print(f'Database: {dbname}')
print(f'User: {user}')
print('Common causes:')
print('  - Network unreachable (GitHub runners may not reach IPv6-only hosts)')
print('  - DNS resolution failure')
print('  - Firewall blocking connections')
print('  - Invalid credentials')
print('\nRecommendation: Apply migration manually via Supabase dashboard or from a machine with DB access')
sys.exit(3)
