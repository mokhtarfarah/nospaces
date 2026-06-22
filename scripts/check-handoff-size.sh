#!/bin/sh
# Fires on Stop. Keeps HANDOFF.md to one screen. Session logs now live in
# docs/HANDOFF-archive.md, so HANDOFF should never carry session entries and
# should stay short. If it grows past the line threshold, nudge to move
# content out (history -> archive, facts -> REFERENCE, backlog -> ROADMAP).
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

HANDOFF="HANDOFF.md"
[ -f "$HANDOFF" ] || exit 0

MAX=120   # one screen-ish; HANDOFF should stay around here
lines=$(wc -l < "$HANDOFF" 2>/dev/null | tr -d ' ')
[ "$lines" -le "$MAX" ] && exit 0

printf '{"systemMessage": "handoff cleanup: HANDOFF.md is %d lines (aim for <%d, one screen). Move content to the right file — session history to docs/HANDOFF-archive.md, stable facts to docs/REFERENCE.md, backlog to docs/ROADMAP.md. Keep only: where we are, next session, doc upkeep, working style."}\n' "$lines" "$MAX"
