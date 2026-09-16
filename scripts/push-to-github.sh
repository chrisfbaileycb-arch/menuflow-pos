#!/usr/bin/env bash
# MenuFlow POS — one-shot push to your GitHub repo.
#
#   GH_TOKEN=ghp_xxx ./scripts/push-to-github.sh                 # creates repo if missing, then pushes
#   GH_TOKEN=ghp_xxx REPO=me/menuflow-pos ./scripts/push-to-github.sh
#   ./scripts/push-to-github.sh git@github.com:me/menuflow-pos.git   # push only, using your ssh key
#
# Token needs only: "Administration: read & write" + "Contents: read & write"
# (fine-grained, scoped to the single repository). It is used for one request and
# never written to .git/config or a credential helper.

set -euo pipefail

REPO="${REPO:-chrisfbaileycb-arch/menuflow-pos}"
BRANCH="${BRANCH:-main}"
API="https://api.github.com"
cd "$(dirname "$0")/.."
ROOT="$(pwd)"

echo "==> repo     : $REPO"
echo "==> branch   : $BRANCH"
echo "==> workspace: $ROOT"

# --- preflight: the shipped artifact must be green before it leaves the machine ---
echo "==> verify (49 workflows, citations, dry-runs)"
node server/verify-cli.js >/tmp/menuflow-push-verify.log 2>&1 \
  || { echo "verify FAILED — see /tmp/menuflow-push-verify.log"; tail -20 /tmp/menuflow-push-verify.log; exit 1; }
grep -q "RESULT: PASS" /tmp/menuflow-push-verify.log \
  || { echo "verify did not PASS"; tail -20 /tmp/menuflow-push-verify.log; exit 1; }
echo "    $(grep -E 'RESULT:' /tmp/menuflow-push-verify.log | tr -s ' ')"

if [ -n "${RUN_TESTS:-}" ]; then
  echo "==> tests"
  npm test >/tmp/menuflow-push-tests.log 2>&1 \
    || { echo "tests FAILED — see /tmp/menuflow-push-tests.log"; tail -30 /tmp/menuflow-push-tests.log; exit 1; }
  echo "    $(grep -E 'ALL SUITES PASSED' /tmp/menuflow-push-tests.log)"
fi

# --- commit anything uncommitted so the pushed tree is reproducible ---
if [ -n "$(git status --porcelain)" ]; then
  echo "==> committing local changes"
  git add -A
  # identity supplied inline so the script never has to mutate your git config
  git -c user.name="${GIT_AUTHOR_NAME:-MenuFlow POS}" \
      -c user.email="${GIT_AUTHOR_EMAIL:-menuflow@signalf.dev}" \
      commit -qm "MenuFlow POS — pre-push snapshot $(date -u +%Y-%m-%dT%H:%MZ)"
else
  echo "==> working tree clean ($(git rev-parse --short HEAD))"
fi

# --- resolve the remote ---
if [ $# -ge 1 ]; then
  URL="$1"
elif [ -n "${GH_TOKEN:-}${GITHUB_TOKEN:-}" ]; then
  TOKEN="${GH_TOKEN:-$GITHUB_TOKEN}"
  OWNER="${REPO%%/*}"; NAME="${REPO##*/}"
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -H "Authorization: Bearer $TOKEN" "$API/repos/$REPO")
  if [ "$CODE" = "404" ]; then
    echo "==> repo $REPO not found — creating it"
    curl -s -f -X POST -H "Authorization: Bearer $TOKEN" -H 'Accept: application/vnd.github+json' \
      -d "{\"name\":\"$NAME\",\"description\":\"Multi-platform restaurant POS operations console: verified, executable workflows grounded in owner's manuals; audit-before-action engine, import/export, 7 platforms.\",\"private\":${PRIVATE:-false},\"has_issues\":true,\"has_wiki\":false}" \
      "$API/user/repos" >/dev/null
    echo "    created https://github.com/$REPO"
  elif [ "$CODE" = "200" ]; then
    echo "==> repo exists (200)"
  else
    echo "!! unexpected HTTP $CODE from GitHub API — check the token scopes"; exit 1
  fi
  URL="https://x-access-token:${TOKEN}@github.com/${REPO}.git"
else
  echo "!! no GH_TOKEN and no remote URL given."
  echo "   fix it either way:"
  echo "     a) make the repo public on github.com/new, then:  $0 https://github.com/$REPO.git"
  echo "     b) give me a fine-grained PAT:                      GH_TOKEN=... $0"
  exit 2
fi

echo "==> pushing $BRANCH -> $REPO"
git remote remove origin >/dev/null 2>&1 || true
git remote add origin "$URL"
git push -u --force origin "$BRANCH"
git remote remove origin >/dev/null 2>&1 || true   # leave no token behind

echo "==> done: https://github.com/$REPO/tree/$BRANCH"
