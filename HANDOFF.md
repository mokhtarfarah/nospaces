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

**This session (58):** Walked the roadmap; Farah picked the **desert-island display rethink**. Reworked `CanonGallery` in `TasteScreen.tsx` from a 3-column cover grid → **Discover-style rows** (ghost cover wash from the right, big title, uppercase meta, and — the point — **`item.note` set as the italic "why"**, which the grid hid entirely). No rank numeral (these aren't ranked). Graceful no-note fallback. New `CanonRow`; deleted dead `CoverTileInner`. Free — pure UI, no API. typecheck + lint clean. **UNVERIFIED on phone** (taste page is auth-gated; preview only reaches Google login). Deployed for Farah to verify next session.

**Last session (57):** Cleared 5 of Farah's 6 s56 observations (2 Discover bugs, Spotify warm-resume scroll root-cause, 2 library-filter calls). Full detail → archive.

---

## ▶ Next session — verify s58, then editorial feel app-wide

**Verify on phone (s58):** desert-island section on the taste page now shows **Discover-style rows** — cover ghosting in from the right, your **note as the italic reason**. Check: (a) it reads as editorial / like Discover, (b) notes written as quick reminders ("standout track: X") don't look odd in the prominent italic slot — if they do, that's *content* cleanup, not code.

**Still pending re-check (s57 follow-ups, may already be fine):** Discover blurb titles read upright/distinct; search shows "all" tab highlighted while a query is active.

**Then the real work:** #6 — **bring the editorial/magazine feel app-wide** (Discover + now the taste desert-island are the benchmark; propose how Library/Add adopt it). Roadmap walk can continue: **taste tab keep-or-fold**, regions map, expansion beyond media (`docs/ROADMAP.md`). Pick a direction *before* touching code.

**Verified earlier — don't re-check:** s56 scroll-restore (cold-kill case) + "new music tuesday"; detail sheet (`SheetHero`); filter-clip bug (session-49 #5).

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
