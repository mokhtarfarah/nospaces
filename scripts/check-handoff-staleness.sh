#!/bin/sh
# Warns if screen/component files changed this session but HANDOFF.md wasn't updated.
# "Changed this session" = appears in the last commit OR is currently staged/unstaged.

changed=$(
  { git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git show --name-only --format="" HEAD 2>/dev/null
  } | sort -u
)

echo "$changed" | grep -qE 'src/screens/|src/components/(ItemActionSheet|MarkDoneSheet|GapsSheet|DuplicatesSheet)' || exit 0

echo "$changed" | grep -q 'HANDOFF\.md' && exit 0

printf '{"systemMessage": "handoff reminder: screens or key components changed but HANDOFF.md was not updated this session — add a session log entry before closing."}\n'
