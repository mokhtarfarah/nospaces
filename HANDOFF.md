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

**This session (57):** Cleared 5 of Farah's 6 s56 observations (all free, no API). (1) **Discover button alignment** — gave "not for me" a matching line-height + transparent bottom border so it lines up with the underlined "save". (2) **Discover blurb `*[TITLE]*`** — `renderBlurb()` strips the model's markdown asterisks and renders referenced titles upright inside the italic prose. (3) **Spotify warm-resume scroll reset** — root-caused to the auth token-refresh on focus handing `useItems` a new `user` object → non-silent refetch → list collapse → scroll-to-top; fixed by keying `fetch` + realtime on the stable `user.id`. (4) **Smart-persist filters** — keep selections that still apply across status/category switches, drop only the ones absent in the new set. (5) **Search spans all categories** — an active query ignores the category tab. typecheck + lint + 56 tests clean. **ALL UNVERIFIED on phone** (Discover auth-gated; Spotify case is iOS-resume-specific). Only #6 (editorial feel app-wide) remains from s56 → `docs/ROADMAP.md`.

**Last session (56):** Scroll-restore root-cause (sessionStorage→localStorage for the OS-kill case) + "new music tuesday" moved into the FilterSheet. Full detail → archive.

---

## ▶ Next session — verify s57 on phone, then editorial direction + roadmap walk

**Verify on phone (s57 — pending deploy, unverified):**
1. **Discover buttons** — "save to library" + "not for me" baselines now align (row card *and* the tapped-detail sheet).
2. **Discover blurb** — referenced titles show as plain upright text, no literal `*asterisks*`.
3. **Spotify scroll (the big one)** — Library, scroll deep → tap an album's Spotify link → save in Spotify → return to nospaces → **should stay where you were, no "Loading…" flash**. This is the warm-resume fix; different mechanism from s56.
4. **Smart-persist filters** — set a vibe (e.g. "sexy") in want-to, flip to done → it stays on; switch to a category with no matching tag → it quietly drops (no empty-list-for-no-reason).
5. **Search all categories** — in the film tab, search for a book/album by name → it now shows up.

**Then:** #6 — **bring the editorial/magazine feel app-wide** (Discover is the benchmark; propose how Library/Taste/Add adopt it). And Farah wants to **walk the roadmap together** (desert-island display rethink, regions map, expansion beyond media — `docs/ROADMAP.md` "Medium/long-term"). Pick a direction *before* touching code.

**Verified earlier — don't re-check:** s56 scroll-restore (cold-kill case) + "new music tuesday" still need Farah's phone pass too if not yet done; detail sheet (`SheetHero`) and filter-clip bug (session-49 #5) confirmed working.

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
