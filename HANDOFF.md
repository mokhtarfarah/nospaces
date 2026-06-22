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

**Last session (51):** (1) **bare-link email capture verified working** end-to-end (Farah forwarded a real bare link post-redeploy) — closes session 50's open item. (2) **Shipped + verified the failed-capture feed (#6):** forwarded emails that add nothing now log to the `email_captures` table (`nothing_found` / `error` / `duplicates` only — successes already show in the review inbox) and surface via an "email captures" row in the library `⋯` menu → `CapturesSheet`, with **clear all** + per-row `×`. Both Supabase migrations run; Farah confirmed it works in-app. Also: account lookup now runs before the Sonnet call, so an unmatched sender fails cheaply. #6 is fully done.

**This session (52):** (1) Re-fixed session-49 **#2 (scroll restore)** — now retries each frame until the saved offset sticks — and **#5 (filter clip)** — spacer bumped to clear the tab bar when the sheet is short. Pushed; both PWA-only so **unverified on phone.** Session-49 #1/#3/#4 confirmed fixed by Farah; #2/#5 had failed first time. (2) **Discover redesign = full design conversation, spec now locked** (see Next session). No code written on it — next session builds.

**Still open from session 49:** #2 + #5 re-fixed this session but still need a phone confirm on the deployed build.

---

## ▶ Next session — BUILD the Discover redesign (spec locked, session 52)

Design conversation is **done** — concept + structure decided. This is now a **build**, not a design task. Do NOT rebuild the recommendation ENGINE: Farah confirmed sources + AI recs work fine; this is purely **display / structure / labels**.

**Backbone decided — everything splits into *grounded-in-your-library* vs *new-to-you*:**
- *Grounded* (act on what you have) → lives in **Library**: `help me decide` (exists at `/decide`, picks from backlog) + `shows near you` (concerts from loved artists).
- *New-to-you* (find what you don't have) → lives in **Discover**.

**Discover rebuild (new-to-you only) — `DiscoverScreen.tsx` is a near-total rewrite:**
1. **Kill the "all" soup + the no-profile wall.** Land on **type-first stacked sections** (films → music → books → tv), each showing 2–3 strongest picks, with **"more →"** drilling into that single type's full list. No "all" tab. (Wall is `DiscoverScreen.tsx:84,202`.)
2. **Mood search bar on top** — free-text "in the mood for…" pulls recs from the prompt. COST: one paid AI call per search; reuse the `recommend-feeds` path (add a prompt param), Sonnet-tier, rate-limit 20/hr like the other pricey endpoints. *(Quick-pick chips above the box were considered + PARKED → ROADMAP, revisit 2026-06-29.)*
3. **Rename the streams off the jargon** + collapse to ONE toggle: `in taste → "for you"`, `divert → "further afield"` as a single top toggle (for you ⇄ further afield), not two stacked sections. "for you" = free/cached; tapping "further afield" fires the wander call (opt-in cost, unchanged).
4. **Cold-start = no wall:** with no taste profile, the per-medium sections fill from **editorial picks** (same layout) instead of "make a taste profile first."
5. **Blurbs:** show the existing AI `why`, **clamped to ~2 lines** in the feed, full on tap. Display-only, no prompt change, no cost.
6. **Remove "shows near you"** from Discover entirely.

**Library changes (the grounded side):**
7. **Move "shows near you" into the music category view** — it's intrinsically music (no "book near you"). Slim entry at the top of the library when `music` is the active category; remove from Discover. (`LibraryScreen.tsx` type-tab row ~534; `ShowsScreen.tsx` unchanged, just re-homed.)
8. **Promote "help me decide" out of the ⋯ menu** → a single **"decide for me" chip in the library status row** (all-media; `/decide` already exists). One chip, no new row, nothing buried. (`LibraryScreen.tsx:1300` today; OverflowSheet.)

**Mockups from the design session:** type-first stacked film/music/book/tv sections + mood-search bar on top (the agreed direction; hero-pick concept was tried and rejected — Farah wants the list, not one big card).

**Also still open (smaller):**
- **Session-49 #2 (scroll restore) + #5 (filter clip)** — re-fixed session 52, **unverified on phone** (both are PWA-only behaviors). Re-test on the deployed build.
- **#7 — catalog-miss interstitial.** "nothing found — identify with ai?" adds a step mid-flow; kept as a cost gate (paid Sonnet). Farah's call whether to make it automatic. (`AddScreen.tsx:367`)

**Don't touch (genuinely good):** library header restraint, decade grouping, the taste page's vibe-headline → prose → gap → always-loved → desert-island arc, the editorial palette, the faithful-creators logic, **the recommendation engine itself.**

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
