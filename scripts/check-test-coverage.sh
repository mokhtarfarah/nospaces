#!/bin/sh
# Fires on Stop. If pure-logic files in src/lib changed but no test file did,
# nudge to add a test (the "when adding pure logic, add a test" rule).
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

changed=$(
  { git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git show --name-only --format="" HEAD 2>/dev/null
  } | sort -u
)

# Pure-logic changed?
echo "$changed" | grep -qE 'src/lib/.*\.ts$' || exit 0
# A test file changed? then assume covered.
echo "$changed" | grep -qE '\.(test|spec)\.ts$|__tests__/|/test/' && exit 0

printf '{"systemMessage": "test reminder: logic in src/lib changed but no test was added/updated — add a Vitest case for the new behaviour."}\n'
