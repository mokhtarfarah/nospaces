#!/bin/sh
# Fires on Stop. If code shipped this session but docs/ROADMAP.md wasn't
# touched, nudge to prune finished items AND pitch new ones.
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

changed=$(
  { git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git show --name-only --format="" HEAD 2>/dev/null
  } | sort -u
)

# Did any app code change? (ignore docs/scripts/config-only sessions)
echo "$changed" | grep -qE '^(src/|api/)' || exit 0

# Did docs/ROADMAP.md change this session?
echo "$changed" | grep -q 'docs/ROADMAP\.md' && exit 0

printf '{"systemMessage": "roadmap reminder: code shipped but docs/ROADMAP.md was not updated — (1) DELETE any finished items (the session log is their record, no checkmark graveyard), and (2) add any NEW roadmap items this work suggests (follow-ups, things you noticed mid-build)."}\n'
