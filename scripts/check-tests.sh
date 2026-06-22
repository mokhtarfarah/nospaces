#!/bin/sh
# Fires on Stop. Runs the unit tests and warns if any fail.
# Mirrors the typecheck Stop hook. Zero API cost (Vitest, local).
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

# Only bother if any source/test file changed this session (keeps quiet otherwise).
changed=$(
  { git diff --name-only HEAD 2>/dev/null
    git diff --name-only --cached 2>/dev/null
    git show --name-only --format="" HEAD 2>/dev/null
  } | sort -u
)
echo "$changed" | grep -qE '\.(ts|tsx)$' || exit 0

if ! npx vitest run >/tmp/nospaces_test_out 2>&1; then
  printf '{"systemMessage": "tests: unit tests are FAILING — run npm test to see which. fix before committing."}\n'
fi
