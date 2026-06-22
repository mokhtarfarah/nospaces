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

**This session (54):** **Rebuilt Discover again** — Farah rejected the session-53 stacked-sections layout. It's now an **editorial single numbered list**: oversized sans rank numerals (clipped by the row), **ghosted real cover art** as each row's background, left-aligned chip menus (Library's `TabChip` pattern), a medium switcher, and **tap-a-pick → detail card** (`DetailSheet`, Library-sheet style: real cover + full "why this" + source + wikipedia). Also shipped a **shared magazine `PageHeader`** (`src/components/PageHeader.tsx`: kicker + small label + 1.5px rule) across **Library / Taste / Discover** — label kept small so Taste's vibe-headline stays the biggest thing. Engine untouched. typecheck + lint + 56 tests clean. **UNVERIFIED signed-in** (OAuth wall) — Farah reviewing on deploy, **feedback next session.** Full detail + watch-items → archive.

**Last session (53):** Built the session-52 Discover spec (type-first sections + mood search) — the layout this session replaced. Mood search / editorial cold-start / engine all carried forward. Full detail → archive.

---

## ▶ Next session — Farah's feedback on the editorial Discover + magazine header

The whole Discover rebuild + the app-wide `PageHeader` are **built and deployed but UNVERIFIED signed-in** (OAuth wall blocks the preview). Farah is reviewing on the live site; **start by collecting her feedback.** Things to look at as a first-time user with taste:

1. **Editorial Discover** — the numbered list, oversized clipped numerals, and **ghosted cover art** (it brings *colour* into an otherwise mono app — does it read editorial or noisy? levers: opacity / blur / flat type-grey tint, all in `DiscoverScreen.tsx → ResultRow`). Tap a pick → **detail card** (`DetailSheet`) should show the real cover + full "why this". Mood search + medium switcher + for-you/further-afield still work.
2. **Magazine `PageHeader`** (Library / Taste / Discover) — the **1.5px black rule** repeats on every page; if it reads heavy, softer hairline = one-line change in `src/components/PageHeader.tsx`. Confirm **Library scroll**: kicker+rule collapse cleanly with the title, pinned chips still behave. Taste's vibe-headline must stay bigger than the "taste" label.

**Also still open (smaller, carried from before):**
- **Session-49 #2 (scroll restore) + #5 (filter clip)** — re-fixed session 52, **unverified on phone** (both PWA-only). Re-test on the deployed build.
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
