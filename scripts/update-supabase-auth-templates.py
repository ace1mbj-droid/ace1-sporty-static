#!/usr/bin/env python3
"""Update Supabase Auth email templates for a hosted project.

Reads HTML templates from docs/email-templates/*.html and updates Supabase Auth
mailer subjects/templates via the Supabase Management API.

Required env vars:
- SUPABASE_ACCESS_TOKEN: a Supabase Dashboard access token
  (https://supabase.com/dashboard/account/tokens)
- SUPABASE_PROJECT_REF: your project ref (e.g. vorqavsuqcjnkjzwkyzr)

Optional env vars:
- ACE1_FROM_NAME: default "ACE#1" (used in subjects only; sender name is set in dashboard if available)

This script intentionally does not store any secrets in the repo.
"""

from __future__ import annotations

import json
import os
import pathlib
import sys
import urllib.error
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
TEMPLATES_DIR = ROOT / "docs" / "email-templates"


def _read_text(path: pathlib.Path) -> str:
    try:
        return path.read_text(encoding="utf-8")
    except FileNotFoundError:
        raise SystemExit(f"Missing template file: {path}")


def _env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def main() -> int:
    access_token = _env("SUPABASE_ACCESS_TOKEN")
    project_ref = _env("SUPABASE_PROJECT_REF")
    from_name = os.getenv("ACE1_FROM_NAME", "ACE#1").strip() or "ACE#1"

    # Subjects: keep simple + brand-forward.
    subjects = {
        "mailer_subjects_confirmation": f"Confirm your {from_name} account",
        "mailer_subjects_recovery": f"Reset your {from_name} password",
        "mailer_subjects_magic_link": f"Your {from_name} login link",
        "mailer_subjects_invite": f"You’re invited to {from_name}",
        "mailer_subjects_email_change": f"Confirm email change for {from_name}",
    }

    payload = {
        **subjects,
        "mailer_templates_confirmation_content": _read_text(TEMPLATES_DIR / "confirm-signup.html"),
        "mailer_templates_recovery_content": _read_text(TEMPLATES_DIR / "reset-password.html"),
        "mailer_templates_magic_link_content": _read_text(TEMPLATES_DIR / "magic-link.html"),
        "mailer_templates_invite_content": _read_text(TEMPLATES_DIR / "invite-user.html"),
        "mailer_templates_email_change_content": _read_text(TEMPLATES_DIR / "change-email.html"),
    }

    url = f"https://api.supabase.com/v1/projects/{project_ref}/config/auth"
    req = urllib.request.Request(
        url,
        method="PATCH",
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
    )

    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            if 200 <= resp.status < 300:
                print("✅ Updated Supabase Auth email templates.")
                # Avoid dumping full response; it can be noisy.
                return 0
            print(f"❌ Unexpected response: HTTP {resp.status}\n{body}")
            return 1
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"❌ HTTP error: {e.code}\n{body}")
        return 1
    except Exception as e:
        print(f"❌ Failed to update templates: {e}")
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
