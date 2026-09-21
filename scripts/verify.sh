#!/usr/bin/env bash
# The check that would have caught the Suggest outage: build the app the
# way the host builds it, serve it the way the host serves it, and open
# every page in a real browser.
#
# One command, because the reason this was skipped for a whole session was
# never disagreement about its value - it was that doing it by hand is
# eight steps and `next dev` is already running.
set -euo pipefail

PORT="${SMOKE_PORT:-3222}"
export SMOKE_BASE_URL="http://localhost:${PORT}"
# A real key is never needed: the smoke test opens pages, it does not ask
# Claude anything. A placeholder keeps the SDK constructor happy.
export ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY:-smoke-test-placeholder}"
# Tells the smoke test which rules apply. Derived from the same three
# variables lib/auth.js reads, so the test's idea of "are accounts on"
# cannot drift from the app's.
if [ -n "${AUTH_SECRET:-}" ] && [ -n "${AUTH_GOOGLE_ID:-}" ] && [ -n "${AUTH_GOOGLE_SECRET:-}" ]; then
  export SMOKE_AUTH_CONFIGURED="true"
  # next start runs in production mode without Vercel's own env, where
  # Auth.js refuses an untrusted host. On Vercel this is automatic.
  export AUTH_TRUST_HOST="${AUTH_TRUST_HOST:-true}"
else
  export SMOKE_AUTH_CONFIGURED="false"
fi

cleanup() {
  if [ -n "${SERVER_PID:-}" ]; then
    kill "$SERVER_PID" 2>/dev/null || true
    wait "$SERVER_PID" 2>/dev/null || true
  fi
  # next start leaves a child holding the port when its parent is killed,
  # which makes the next run fail to bind for no visible reason.
  fuser -k "${PORT}/tcp" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> lint"
npm run lint

echo "==> build (production, as the host builds it)"
npm run build

echo "==> serving on :${PORT}"
npx next start -p "$PORT" > /tmp/smoke-server.log 2>&1 &
SERVER_PID=$!

for _ in $(seq 1 30); do
  if curl -sf -o /dev/null "$SMOKE_BASE_URL/"; then break; fi
  sleep 1
done
if ! curl -sf -o /dev/null "$SMOKE_BASE_URL/"; then
  echo "server never came up; last lines of its log:"
  tail -20 /tmp/smoke-server.log
  exit 1
fi

echo "==> smoke test"
node scripts/smoke.mjs
