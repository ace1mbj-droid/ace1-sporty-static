# History Rewrite Plan — Remove Sensitive/Unwanted References

**Purpose:**
This document outlines the safe, tested steps to rewrite git history to remove specific references (e.g., `SamKirkland`, `SamKirkland/FTP-Deploy-Action`, `185.224.138.135`, or any other sensitive strings). The process is tested on a local mirror first and includes backups, validation, communication, and rollback plans.

---

## Preconditions (must be satisfied before final push)
- Mirror backup created and archived: `/Users/jai_das13/repo-backups/ace1-sporty-static-mirror.git` (tar saved).
- Audit completed and list of strings to remove agreed upon.
- All contributors notified and a maintenance window scheduled (no pushes during the operation).
- Repository owner has admin privileges and can rotate secrets after push.
- A test-run of the rewrite has been completed on the mirror and validated locally.

---

## High-level steps (summary)
1. Freeze repository: ask all contributors to stop pushing.
2. Create an up-to-date mirror backup (already done).
3. Run the final rewrite on the mirror and verify results.
4. During maintenance window: force-push the rewritten refs (branches + tags) to origin.
5. Invalidate tokens / rotate any exposed credentials.
6. Notify contributors (re-clone instructions) and monitor CI.
7. Clean up artifacts and close out with a final report.

---

## Exact commands (run from a safe environment; examples assume use of the mirror)

### 0) Safety checks (local)
- Confirm current origin URL and last commits:
```
cd /path/to/working/clone
git remote -v
git log --oneline -n 5
```

### 1) Backup (done)
```
git clone --mirror git@github.com:owner/repo.git repo-mirror.git
cd repo-mirror.git
# compress backup
tar czf ../repo-mirror-backup-$(date +%F-%s).tar.gz .
```

### 2) Final rewrite on mirror (already tested)
- Use `git-filter-repo` (fast and safe when used on a mirror):
```
# (on a machine with git-filter-repo installed)
export FILTER_REPO_ALLOW_BARE_REPOS=1
cd /path/to/repo-mirror.git
# apply prepared replace rules
git-filter-repo --replace-text /tmp/replace-final.txt --commit-callback /tmp/commit-callback-final.py --force
```
- After rewrite, run validation searches for all target patterns:
```
PATTERNS=("<redacted: USERNAME_OR_HANDLE>" "FTP-Deploy-Action" "<redacted: IP_ADDRESS>" "<redacted: FTP_USERNAME>")
for p in "${PATTERNS[@]}"; do
  git log --all --pretty=fuller --grep="$p" -i -n 10 || true
  git rev-list --all | xargs -n1 -P4 git grep -n --break --heading -e "$p" || true
done
```

### 3) Prepare maintenance window and take final pre-push snapshot
- Create a tag of the current remote to allow easy restore if needed:
```
# create a restore tag on origin (optional)
# NOTE: requires direct push to origin before rewrite push
git ls-remote --heads origin
# locally create a tag pointing to current main commit
git fetch origin main
git tag pre-rewrite-backup-$(date +%F-%s) origin/main
git push origin --tags
```

### 4) Force-push rewritten history to origin (ALL branches and tags)
- Important: perform only during the approved maintenance window and with agreement from the team.
```
cd /path/to/repo-mirror.git
# set origin to SSH to avoid https credential issues (change as needed):
git remote set-url origin git@github.com:ace1mbj-droid/ace1-sporty-static.git
# push branches
git push --force --all origin
# push tags
git push --force --tags origin
```

---

## Post-push steps (immediate)
- Rotate repo secrets and external credentials (FTP password, service keys, tokens) immediately.
- Ask contributors to re-clone or follow these steps:
```
# If you have local changes, stash or create patches first
# Quick reset (unsafe for uncommitted local changes):
git fetch origin
git reset --hard origin/main
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```
- Re-run CI and monitor for failures; revert if necessary (see rollback below).

---

## Rollback plan
- If push caused a major issue, restore from the mirror backup:
```
# on a clean machine with the mirror backup (repo-mirror-backup.tar.gz)
git clone --mirror /path/to/repo-mirror-backup.git restore-mirror.git
cd restore-mirror.git
git remote set-url origin git@github.com:ace1mbj-droid/ace1-sporty-static.git
git push --force --all origin
git push --force --tags origin
```
- Communicate fast and revert any downstream changes (CI, deployments) as appropriate.

---

## Cleaning GitHub artifacts
- Download and inspect Action artifacts if they may contain sensitive data and remove them or redact locally; if needed, contact GitHub Support to request deletion of specific artifacts that cannot be deleted via UI.

---

## Communication templates
- Short maintenance notification (to team):
```
Subject: Repo history rewrite maintenance: [DATE/TIME]
Body: We will be performing a coordinated history rewrite to remove historical references. Please stop all pushes between [START] and [END]. After the rewrite, you must re-clone or reset your local copies. I will announce completion and provide re-clone instructions.
```
- Post-completion message (for PRs/issues):
```
We completed the history rewrite to scrub historical references. If you previously had a fork/branch, please re-clone the repo. If you have unpushed local work, stash it before performing the reset. See docs/HISTORY_REWRITE_PLAN.md for exact steps.
```

---

## Checklist (pre-push)
- [ ] Mirror backup verified and stored off-site.
- [ ] Final replace rules file & commit-callback tested on mirror.
- [ ] Team notified and maintenance window scheduled.
- [ ] Repo secrets rotation plan in place.
- [ ] Rollback test validated using the backup.

---

## Final notes
- Keep the backup archive for at least 30 days post-change. After verification, delete the backup only when everyone confirms there are no regressions.
- If you want, I can run the final commit-callback pass on the mirror to remove the last few lines (I already tested targeted fixes) and then prepare the final push artifacts for your approval.


*Document created by automation on 2026-01-16.*
