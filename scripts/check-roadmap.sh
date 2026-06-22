#!/bin/sh
# Fires on Stop. If code shipped this session but the Roadmap section of
# HANDOFF.md wasn't touched, nudge to update it AND pitch new roadmap items.
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

changed=$(
  { git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git show --name-only --format="" HEAD 2>/dev/null
  } | sort -u
)

# Did any app code change? (ignore docs/scripts/config-only sessions)
echo "$changed" | grep -qE '^(src/|api/)' || exit 0

# Did the HANDOFF Roadmap region change this session? Look at the actual diff
# for lines under the Roadmap heading. Cheap heuristic: any HANDOFF diff that
# mentions "Roadmap" or a roadmap status marker (✅/🔄/⏸/⛔).
roadmap_touched=$(
  { git diff HEAD -- HANDOFF.md 2>/dev/null
    git diff --cached -- HANDOFF.md 2>/dev/null
    git show -- HANDOFF.md 2>/dev/null
  } | grep -E '^\+' | grep -qE 'Roadmap|✅|🔄|⏸|⛔|shipped' && echo yes
)
[ "$roadmap_touched" = "yes" ] && exit 0

printf '{"systemMessage": "roadmap reminder: code shipped but the Roadmap in HANDOFF.md was not updated — (1) mark finished items ✅ shipped, and (2) add any NEW roadmap items this work suggests (follow-ups, things you noticed mid-build)."}\n'
