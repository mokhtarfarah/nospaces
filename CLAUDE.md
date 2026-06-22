# Nospaces — Claude Instructions

At the start of every session, read `HANDOFF.md` in this repo root — it's short (one screen) and tells you where things are + what's next. It points to three on-demand files when you need more: `docs/REFERENCE.md` (stack, env vars, key files, costs, architecture, dev hooks), `docs/ROADMAP.md` (open backlog + parked/shelved ideas), and `docs/HANDOFF-archive.md` (full session history).

Doc upkeep rule: keep `HANDOFF.md` to one screen. New session logs go to the **top** of `docs/HANDOFF-archive.md`; finished roadmap items get **deleted** from `docs/ROADMAP.md` (no ✅ graveyard); each fact lives in exactly one file. See HANDOFF.md → "Doc upkeep" for the full process.

## How to work here

- **Always state cost before building.** Any change touching an `api/` endpoint or adding an Anthropic call: say the cost impact up front (even "free — external API"). Never run more than 2–3 test API calls; never `web_search` in a loop. The pay-per-token key has a $20/mo hard cap. See `docs/REFERENCE.md` → API costs.
- **Judge UI as a first-time user with great taste**, not as Farah-who-built-it. Proactively flag anything that reads like a debug label, an inside joke, or a dead end — even when not asked.
- **Show, don't claim.** Don't say "done" or "works" without proof — a screenshot, test output, or the actual behavior. If something wasn't verified, say so plainly.
