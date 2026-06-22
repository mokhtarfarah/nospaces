#!/bin/bash
# Fires on Stop. Reminds Claude to update HANDOFF.md if it wasn't touched this session.
cd /Users/farahmokhtar/nospaces 2>/dev/null || exit 0

# HANDOFF.md modified in working tree (staged or unstaged)?
git diff --name-only HEAD 2>/dev/null | grep -q 'HANDOFF\.md' && exit 0
git diff --name-only --cached 2>/dev/null | grep -q 'HANDOFF\.md' && exit 0

# HANDOFF.md touched in the most recent commit?
git show --name-only --format="" HEAD 2>/dev/null | grep -q 'HANDOFF\.md' && exit 0

printf '{"systemMessage": "handoff reminder: HANDOFF.md was not updated this session — refresh \"where we are\" + the Next-session checklist, log the session to the top of docs/HANDOFF-archive.md, prune finished items from docs/ROADMAP.md, and commit before ending."}\n'
