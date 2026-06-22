#!/bin/sh
# Warns if screen/component files changed this session but the handoff docs
# weren't updated. Session logs now live in docs/HANDOFF-archive.md; the live
# HANDOFF.md tracks "where we are / next session". Either being touched counts.
# "Changed this session" = appears in the last commit OR is currently staged/unstaged.

changed=$(
  { git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git show --name-only --format="" HEAD 2>/dev/null
  } | sort -u
)

echo "$changed" | grep -qE 'src/screens/|src/components/(ItemActionSheet|MarkDoneSheet|GapsSheet|DuplicatesSheet)' || exit 0

echo "$changed" | grep -qE 'HANDOFF\.md|docs/HANDOFF-archive\.md' && exit 0

printf '{"systemMessage": "handoff reminder: screens or key components changed but the handoff docs were not updated this session — add a session entry to the top of docs/HANDOFF-archive.md and refresh HANDOFF.md (where we are / next session) before closing."}\n'
