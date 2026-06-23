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

**This session (60):** Acted on Farah's s59 feedback (verified on phone — good). Shipped: (1) **island "why" field** (`metadata.canonNote`) — separate from the library note, reads as prose + `edit` link in the detail sheet, surfaced as the italic line in each pick row (the Discover touch that was missing); library note hides once a why exists; (2) **covers bumped to match Discover** (opacity .42, mask 30%, numeral 96) — the "not as chic" fix; (3) add picker now shows **"added ✓"**; (4) removed the ◇ glyph by the desert-island chip; (5) **humanizer prose prompt** — anti-AI-writing guardrails (`github.com/blader/humanizer`) + "sharp friend" voice, model → **sonnet-4-6**; (6) **gitleaks CI fix** (free CLI, no license gate). Standing principle logged: all AI prose must not *feel* AI-written. Commits `7281535`, `eb07fa4`. Full detail → archive.

**Last session (59):** Full taste-page redesign — tabbed (profile / desert island) + numbered, curatable desert island. Full detail → archive.

---

## ▶ Next session (61)

Taste is now done (redesigned s59, polished s60 + phone-verified). Pick a direction *before* touching code:

1. **#6 — editorial feel app-wide** continues. Taste + Discover are the benchmark; **Library + Add** are what's left to bring up to that bar.
2. **Propagate the humanizer guardrails** (new s60) to the other prose endpoints — `api/blurb.ts`, `api/recommend.ts`, `api/recommend-feeds.ts`. The block in `api/taste-profile.ts` is the template. *Standing principle: all AI prose must not feel AI-written.* (`docs/ROADMAP.md`)
3. Or continue the roadmap walk: **taste tab keep-or-fold**, regions map, expansion beyond media (`docs/ROADMAP.md`).

**Still pending re-check (s57 follow-ups, may already be fine):** Discover blurb titles read upright/distinct; search shows "all" tab highlighted while a query is active.

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
