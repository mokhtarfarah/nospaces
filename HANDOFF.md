# Nospaces — Handoff

**Read this file at session start.** It's deliberately short. Everything else is split out by how often it changes:

| File | What's in it | When to open it |
|---|---|---|
| **`HANDOFF.md`** (this) | Where we are + what's next | every session |
| `docs/ROADMAP.md` | Open backlog, parked + shelved ideas | picking what to do next |
| `docs/REFERENCE.md` | Stack, env vars, key files, costs, features, architecture, dev hooks | when you need a fact |
| `docs/HANDOFF-archive.md` | Full session-by-session history | rarely — digging up "why did we…" |

---

## 🚦 Where we are

Personal PWA taste library for Farah + Tom (films, books, music, TV). Live at https://nospaces.vercel.app. Phases 1–4 done; **Phase 5 (discovery + taste) in progress.**

**This session (56):** Two Library items. (1) **Scroll-restore root-cause fix** — the iOS-PWA scroll-restore kept failing because it stashed the position in `sessionStorage`, which iOS **wipes** when it kills + relaunches a standalone PWA (a fresh browsing session) — exactly the case it was meant to cover. Switched to `localStorage` + a 6h freshness window (`LibraryScreen.tsx` ~30, ~215, ~228). (2) **"New music tuesday" moved into the FilterSheet** as a `music` section (chip), out of the status-tab row — folded into the `filter · N` count + clear-all; filter button now reachable in the music category even with no tags. typecheck + lint + 56 tests clean. **UNVERIFIED on phone** (both PWA/signed-in only). Detail sheet (s55) **verified good** by Farah.

**Last session (55):** Detail-sheet polish — shared `SheetHero` (`src/components/SheetHero.tsx`) drives both Discover `DetailSheet` + Library read view; rank watermark, medium-aware Library kicker, per-medium desert-island covers. **Verified good.** Full detail → archive.

---

## ▶ Next session — walk the roadmap + verify s56 on phone

Farah wants to **walk the roadmap together next session** (desert-island display rethink, regions map, expansion beyond media — see `docs/ROADMAP.md` "Medium/long-term"). Pick a direction *before* touching code.

**Verify on phone (s56 — deployed, unverified):**
1. **Scroll restore** — open Library, scroll deep, background/kill the PWA, reopen → should land back where you were (not the top). This is the localStorage fix; the old sessionStorage version silently failed on a real OS kill.
2. **"New music tuesday"** — in the **music** category, open `filter` → there's now a `music` section with a `new music tuesday` chip; toggling it counts toward `filter · N` and clears with "clear all". It's gone from the status-tab row.

**Verified this/last session — don't re-check:** detail sheet (`SheetHero`), filter-clip bug (session-49 #5, Farah confirmed working).

**Parked from s55:** bigger detail-sheet cover with **real CSS text-wrap** (deferred — body lives outside `SheetHero` + `overflow:hidden` kills wrapping). Page-level **kicker+rule section dividers** (Taste/Library) is a fast-follow if wanted.

**Also still open (smaller, carried from before):**
- **PageHeader 1.5px rule** — if it reads heavy across pages, softer hairline = one-line change in `src/components/PageHeader.tsx`.
- **#7 — catalog-miss interstitial.** "nothing found — identify with ai?" adds a step mid-flow; kept as a cost gate (paid Sonnet). Farah's call whether to make it automatic. (`AddScreen.tsx:367`)
- **Discover mood chips** — parked, revisit **2026-06-29** after a week of real use. (`docs/ROADMAP.md`)

**Don't touch (genuinely good):** decade grouping, the taste page's vibe-headline → prose → gap → always-loved → desert-island arc, the editorial palette, the faithful-creators logic, **the recommendation engine itself.**

Backlog beyond this queue → `docs/ROADMAP.md`.

---

## 🔁 Doc upkeep (the process that keeps this from rotting)

The reason this got messy before: one file did five jobs, history piled up, and the same fact lived in three places (then drifted — session 42 was a whole cleanup). The split above fixes the structure; these rules keep it clean:

1. **One fact, one home.** A status (e.g. "Sentry is live") lives in exactly one file. Elsewhere, link to it — don't restate it.
2. **End of session: log, then prune.** Write the session entry at the **top** of `docs/HANDOFF-archive.md`. If you finished a roadmap item, **delete** it from `docs/ROADMAP.md` (the log is its record — no ✅ graveyard). Update "Where we are" + the Next-session checklist here.
3. **Keep this file one screen.** Session history → archive. Stable facts → reference. Backlog → roadmap. If `HANDOFF.md` is scrolling, something's in the wrong file.
4. **The Stop hooks nudge all of this** (roadmap reminder, handoff staleness/size, guide reminder). They're cues to do the prune, not noise to dismiss. See `docs/REFERENCE.md` → Dev automation.

---

## 🛠️ Working style

- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted.
- Flag good moments to start a fresh chat (long sessions = expensive).
- Two billing systems — the Anthropic API key (pay-per-token, $20/mo cap) is separate from this Claude Code subscription. Never burn more than 2–3 test API calls; web_search is the pricey one. See `docs/REFERENCE.md` → API costs.
