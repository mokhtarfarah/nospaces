#!/bin/sh
# Counts numbered items in the most recent session block in the archive.
# (Session logs live in docs/HANDOFF-archive.md now, not HANDOFF.md.)
# If >= 4, injects a stopping-point suggestion via systemMessage.
# Run as a Stop hook — fires after every Claude turn.

ARCHIVE="$(dirname "$0")/../docs/HANDOFF-archive.md"
[ -f "$ARCHIVE" ] || exit 0

# Extract just the first ### Session block and count lines like "1. " "2. " etc.
count=$(awk '
  /^### Session/ { if (found) exit; found=1; next }
  found && /^[0-9]+\./ { n++ }
  END { print n+0 }
' "$ARCHIVE")

if [ "$count" -ge 4 ]; then
  printf '{"systemMessage": "session length: %d items shipped this session — good stopping point after this item. consider starting a fresh chat for the next task."}\n' "$count"
fi
