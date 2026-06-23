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

**This session (64) — design only, no app code:** Stress-tested the s63 "Things" design and found the core flaw — **reaction collapses for objects** (you self-select for love before rating), so the react→profile loop barely fires in the domain it's meant to power. **Reworked the whole design around _composition over reaction_:** the taste signal is the *set*, attributes (material/palette/form) are the engine, the aesthetic surfaces as a live board masthead from day one. Brand demoted to one facet; "own" shrinks to a "got it" accent; vision call reads *attributes* not identity. **Intent/candidates kept first-class + in v1** (Farah's make-or-break) with a light no-archive resolve. ROADMAP rewritten + re-sliced (Slice 0 = free gut-check incl. the deliberation flow). Cost $0. Pushed to `main` (`6816e01`).

**Last session (63):** Shipped the **regions / country filter** (browser-direct backfill), trimmed the filter sheet to collapsible sections, designed the first "Things" expansion (since superseded by s64). Full detail → archive.

---

## ▶ Next session (65)

**Main job: start BUILDING the "Things" domain — begin with Slice 0 (free).** The design was reworked in s64 around **composition-over-reaction** (full design → `docs/ROADMAP.md` → "Expansion beyond media"; the *why* → s64 archive entry). Don't re-plan it — it's settled. Build order:
- **Slice 0 (free, do first): vertical gut-check.** `api/og-parse.ts` (free, reuse `api/_ssrf.ts`) → paste product link → card on a plain grid. **Must include the intent/candidates flow** (create intent "black clogs" → attach 2–3 candidates → mark a leaning → "pick this one") — it's Farah's make-or-break feature, so a gut-check without it proves nothing. No vocab/switcher yet. Decision gate: does the deliberation flow feel good?
- Then: Slice 1 attribute model + the pure "thread" composition reader (+Vitest, vocab waits for real items) · Slice 2 board + live masthead · Slice 3 domain switcher · **Slice 4 = first PAID surface** (Sonnet vision call that reads *attributes*, not identity — state exact per-call cost before building).
- Key model facts: all on existing `Item`; `type:'thing'`; `metadata.attributes[]` is the engine; `reaction` stays null for things; intent/candidates resolve is light (done + winner flag, **no archive** — losers persist as signal).

**Carried from s63 (check, don't rebuild):**
- **Regions** — shipped, browser-direct backfill. Coverage was still filling in via repeated ⋯ → "pull regions". If it's plateaued with a stubborn `failed` count, slow the pull down (lower concurrency / add pacing in `src/lib/regions.ts`). Language axis `P364` parked in ROADMAP.
- **Filter sheet** — trimmed to collapsible sections; confirm it eyeballs right on phone.

**📅 ~2026-07-14 checkpoint — held decision:**
1. **Taste-tab keep-or-fold** — DECIDED s63: *keep the tab*; revisit after real desert-island use. (Reasoning + profile-as-masthead fold sketch → `docs/ROADMAP.md`.)

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
