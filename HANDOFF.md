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

**This session (55):** Farah's **feedback on the editorial Discover**, then a long polish of the **detail sheet**. Shipped: full-watermark rank numerals (big light-grey number behind the row text), **medium-aware Library kicker** (`N films`/`N books`), and **per-medium desert-island covers** (posters 2:3, music 1:1). Biggest piece: a **shared `SheetHero`** (`src/components/SheetHero.tsx`) now drives the detail view for **both** Discover (`DetailSheet`) and Library (`ItemActionSheet` read view) — ghost cover wash to the rounded top, **cover on the LEFT** (flex row, tops aligned), rank watermark behind the title (Discover only), kicker+rule "why this", text-link actions. Killed the old grey "why" box + black pill. Engine untouched. typecheck + lint + 56 tests clean every push. **UNVERIFIED signed-in** (OAuth wall) — Farah reviewing on deploy. Full detail + watch-items → archive.

**Last session (54):** Editorial single-numbered-list Discover rebuild + app-wide magazine `PageHeader` (kicker + small label + 1.5px rule across Library/Taste/Discover). Carried forward. Full detail → archive.

---

## ▶ Next session — verify the detail sheet + Discover signed-in

The session-55 detail-sheet work is **built and deployed but UNVERIFIED signed-in** (OAuth wall blocks the preview). **Start by eyeballing it on the live site.**

1. **`SheetHero` (Discover pick + Library item)** — confirm: cover/title **tops align**; Discover **rank watermark** still reads behind the title (esp. double-digit "10" against the cover); **Library menu links** (`edit · about · spotify · wiki · watch · own it`) wrap tidily now the right column is narrower; **music** covers render square; **no-art** items fall back to the soft type-tint wash, not a blank gap.
2. **Discover row watermark + medium-aware kicker + desert-island covers** — quick sanity check on deploy.

**Parked from this session:** bigger cover with **real CSS text-wrap** around it (deferred — body content lives outside `SheetHero` + `overflow:hidden` for the wash kills wrapping; only worth it if the small cover feels like a downgrade). Page-level echo (Taste/Library **kicker+rule section dividers** from the mock) is a fast-follow if wanted.

**Also still open (smaller, carried from before):**
- **Session-49 #2 (scroll restore) + #5 (filter clip)** — re-fixed session 52, **unverified on phone** (both PWA-only). Re-test on the deployed build.
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
