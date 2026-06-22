#!/bin/sh
# Fires on Stop. Keeps HANDOFF.md lean. When the session log grows past the
# threshold AND you touched HANDOFF this session (natural cleanup moment),
# suggest archiving the oldest sessions to docs/HANDOFF-archive.md.
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

HANDOFF="HANDOFF.md"
[ -f "$HANDOFF" ] || exit 0

KEEP=8   # how many recent sessions to keep inline
sessions=$(grep -c '^### Session' "$HANDOFF" 2>/dev/null)
[ "$sessions" -le "$KEEP" ] && exit 0

# Only nudge when HANDOFF was edited this session, so it lands at the right moment.
touched=$(
  { git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git show --name-only --format="" HEAD 2>/dev/null
  } | grep -q 'HANDOFF\.md' && echo yes
)
[ "$touched" = "yes" ] || exit 0

printf '{"systemMessage": "handoff cleanup: HANDOFF.md has %d session log entries (keep ~%d inline). Move the oldest ones to docs/HANDOFF-archive.md so the handoff stays scannable — keep the Roadmap and Next session sections intact."}\n' "$sessions" "$KEEP"
