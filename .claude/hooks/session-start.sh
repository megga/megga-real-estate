#!/bin/bash
# Session-start health check for megga-real-estate.
# Synchronous: prints a brief status snapshot at the start of every Claude
# Code session so we know immediately what state the repo and prod are in.
# Always exits 0 — warnings are informational, not blocking.

set -u

cd "${CLAUDE_PROJECT_DIR:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}" 2>/dev/null || true

echo "── megga-real-estate · session start ──"

# 1. Branch
branch=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "?")
if [ "$branch" = "main" ]; then
  echo "branch     : main  ⚠  (work usually happens on a feature branch)"
else
  echo "branch     : $branch"
fi

# 2. Working tree + unpushed commits
dirty=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null || echo "")
ahead=0
behind=0
if [ -n "$upstream" ]; then
  ahead=$(git rev-list --count "$upstream"..HEAD 2>/dev/null || echo 0)
  behind=$(git rev-list --count HEAD.."$upstream" 2>/dev/null || echo 0)
fi
status_msg="$dirty file(s) modified, $ahead ahead, $behind behind"
if [ "$dirty" -gt 0 ] || [ "$ahead" -gt 0 ]; then
  echo "tree       : $status_msg  ⚠"
else
  echo "tree       : clean"
fi

# 3. Last commit on main (proxy for last deploy — `main` push triggers the
# Cloudflare Pages + Supabase migrations workflow).
git fetch --quiet origin main 2>/dev/null || true
main_info=$(git log origin/main -1 --pretty=format:'%h|%s|%cr' 2>/dev/null || echo "?|?|?")
main_sha=$(echo "$main_info" | cut -d'|' -f1)
main_msg=$(echo "$main_info" | cut -d'|' -f2 | cut -c1-50)
main_age=$(echo "$main_info" | cut -d'|' -f3)
echo "main HEAD  : $main_sha  $main_age  — $main_msg"

# 4. Local migrations dated today or later that aren't yet on origin/main.
# These are the changes a `git push origin main` would deploy to prod.
today=$(date -u +%Y%m%d)
unshipped=""
if [ -d supabase/migrations ]; then
  for f in supabase/migrations/*.sql; do
    [ -e "$f" ] || continue
    base=$(basename "$f")
    stamp="${base%%_*}"
    if [ "$stamp" -ge "$today" ] 2>/dev/null; then
      # On origin/main?
      if ! git cat-file -e "origin/main:supabase/migrations/$base" 2>/dev/null; then
        unshipped="$unshipped $base"
      fi
    fi
  done
fi
if [ -n "$unshipped" ]; then
  echo "migrations :$unshipped  ⚠ not yet on origin/main"
else
  echo "migrations : up to date with origin/main"
fi

# 5. Liveness check on the production vitrine (megga.ch).
# On sonde la RACINE : c'est une page PUBLIQUE du gate Basic Auth pré-lancement
# (sites/megga-vitrine/_worker.js), donc un 200 prouve que la vitrine ET son
# worker sont en vie. L'ancienne sonde visait /louer, qui n'est plus une page
# de la vitrine depuis le pivot CRM-first et répond 401 par construction
# (défaut du gate) — elle criait ⚠ à chaque session sans aucune panne.
http=$(curl -s -o /dev/null -w '%{http_code}' --max-time 5 https://megga.ch/ 2>/dev/null || echo "000")
case "$http" in
  200) echo "vitrine    : 200 OK" ;;
  000) echo "vitrine    : timeout / no response  ⚠" ;;
  *)   echo "vitrine    : HTTP $http  ⚠" ;;
esac

# 6. Warm ruflo's ephemeral memory with the committed MEGGA system knowledge.
# Background, best-effort, non-blocking. Durable knowledge = docs/system-map.md; this
# just re-seeds ruflo's LOCAL semantic memory each session (100% local, no API, no tokens).
# Disable with RUFLO_NO_AUTOSEED=1.
if [ "${RUFLO_NO_AUTOSEED:-0}" != "1" ] && [ -f scripts/ruflo-seed-memory.mjs ] && [ -f .claude-flow/knowledge/megga-memory.seed.json ]; then
  ( node scripts/ruflo-seed-memory.mjs >/tmp/ruflo-seed.log 2>&1 & ) >/dev/null 2>&1 || true
  echo "ruflo      : memory seed dispatched in background (RUFLO_NO_AUTOSEED=1 to skip)"
fi

echo "──────────────────────────────────────"
exit 0
