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

Personal PWA taste library for Farah + Tom (films, books, music, TV) **+ a Things side** (shopping / wishlist). Live at https://nospaces.vercel.app. Phases 1–4 done; **Phase 5 (discovery + taste) in progress.** Things is the active workstream.

**Session 109 — taste-prompt tone pass + mood-board vision split + add-flow bug hunt, 10 commits, all pushed to `main` (live).** Rewrote both taste prompts (media + things) for conciseness and factuality; root-caused the navel-gazing instead of banning phrases (new shared `NO_FLATTERY` guardrail in `api/_humanizer.ts`, two named failure modes with self-check tests, not a word blocklist — took 3 rounds to actually land, including a real prompt bug: the JSON-format hint contradicted the "1 sentence" instruction). Removed "the gap" section (media taste page) — wasn't insightful. Split mood-board images onto their own vision prompt (`api/_vision.ts` `INSPIRATION_PROMPT`) instead of the product-shaped one they were sharing — real bug, not a vibe: garment-cut vocabulary was being forced onto non-clothing images. Several Things UI nits iterated live with Farah (mood grid → pure image wall, no captions, no crop; mood-sheet photo now bleeds to the sheet edges; style profile moved behind a filters icon). New feature: "on my shelf" checkbox at the point of adding media (confirmed working live). Found + fixed two real bugs in the add-confirm sheet's escape hatches (a stopword bug in the catalog search ranker was surfacing "Panic! At the Disco" for a book search — fixed at the root in `api/lookup.ts` with regression tests; a destructive reset was wiping correct AI guesses) — the fix was deletion (107 lines gone, nothing lost), since a non-destructive "edit details" toggle already existed. Restyled + decluttered that same sheet. Added a client-side timeout to Discover's "further afield" fetch (was hanging forever with no client-side timeout, server caps at 60s). Full detail → archive (s109) — it's a long entry, worth reading before touching any of these files again.

**Not fixed, flagged for pickup — a spawn_task chip should be sitting in the UI (`task_a16d44ef`):** Discover recommendations occasionally show corrupted output (the model narrating its own dedup-checking into the "why" text and fake source labels like "via alreadyrecommended"). Working theory + repro steps are in the task description — start there, don't re-diagnose from scratch.

## ▶ Next session (110) — verify s109 live first, then pick from below

**Verify s109's last round — this went in at the very end and Farah hasn't seen it yet:** the add-confirm sheet's restyle/declutter (type chips now hidden behind "edit details", the owned-checkbox is now a pill toggle) and the Discover stuck-loading timeout fix (hard to force — just watch for it not hanging next time "further afield" is slow).

**Also worth a real check, addressed this session but not fully confirmed live:** the things-taste synthesis after the last (3rd) prompt fix (mechanical "the board reads like" tone); the mood-board vision split — re-tag a mood image and see if the tags read more like register/atmosphere words now, less like garment-cut.

**Do first (housekeeping):**
- **Confirm the 10k Postmark plan is bought.** Approval unblocked it; talkback ≈ 2 emails/capture and the free plan is only 100/mo, so real use will blow the cap fast. Detail → `docs/REFERENCE.md` → Postmark plan.

**Still carried, low-priority one-off checks:** the ~8 junk board cards from the old email bug (s100) may still be there — check she deleted them. The s89 **pull-from-link fix** — screenshot a product, add a link, edit → does "pull photo & price" swap the screenshot for the clean shop photo? (Only fires on *newly* screenshot-saved products.)

No fixed queue beyond the above. The big remaining taste item is still gated on a decision with Farah — **s109's tone fixes were surface-level (prose quality), not this:**
- **"What feeds the taste read"** — the consolidated design decision (self-defined taste + Things-taste reframe + beauty/home exclusion + a "got it"→worth-it signal). **Gated:** decide the feedback loop *with Farah first*, honouring the "saving is the signal" soul rule. No code until decided. Detail → `docs/ROADMAP.md` → "Taste profile".

**Things model facts:** all on `Item`; `type:'thing'`; `metadata.kind` = `product`|`intent`|`inspiration` (mood-board image); `metadata.attributes[]` (`{facet,value}`) is the composition engine; a promoted plan keeps `metadata.fromPlan` (reversible via `demoteProductToIntent`); resolve = `done` + winner flag, **no archive** (losers persist). The taste read runs over wishlist + mood together (`tasteItems`).

**Don't touch (genuinely good):** decade grouping; the taste page's vibe-headline → prose → always-loved → desert-island arc; the editorial palette; the faithful-creators logic; **the recommendation engine itself.** (All re-confirmed in the s81 review.)

Backlog beyond this → `docs/ROADMAP.md` (music-library iPod reframe, "all" tab de-confusion, want-to priority list, user-guide overhaul, capture pain points, and more).

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
