#!/bin/bash
# Fires on Stop. Reminds Claude to update HANDOFF.md if it wasn't touched this session.
cd /Users/farahmokhtar/nospaces 2>/dev/null || exit 0

# HANDOFF.md modified in working tree (staged or unstaged)?
git diff --name-only HEAD 2>/dev/null | grep -q 'HANDOFF\.md' && exit 0
git diff --name-only --cached 2>/dev/null | grep -q 'HANDOFF\.md' && exit 0

# HANDOFF.md touched in the most recent commit?
git show --name-only --format="" HEAD 2>/dev/null | grep -q 'HANDOFF\.md' && exit 0

printf '{"systemMessage": "handoff reminder: HANDOFF.md was not updated this session — add a session log entry, revise the Next session priorities, and commit it before ending."}\n'
