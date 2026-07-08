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

**Session 112 — mood board masonry fix + Discover "via alreadyrecommended" fix. 2 commits, pushed to `main` (live).** Mood board (`MoodWall`, `ThingsScreen.tsx:2496`) switched from row-locked CSS grid to real CSS multi-column masonry — images now pack tight down each column, no more dead gaps under short images. Verified with a synthetic test overlay (not real board data, to keep it a zero-cost CSS-only change); not yet seen on Farah's real board. Separately, root-caused and fixed the s109 Discover bug (`task_a16d44ef`): a 150-title exclusion list under a shouty prompt header was making the model narrate its own filtering into the "why"/"sources" text (e.g. "via alreadyrecommended"), which then rendered verbatim with zero validation. Fixed in `api/recommend-feeds.ts` with three layers — smaller exclusion list sent to the prompt (40 not 150), an explicit "don't narrate this" instruction, and a hard server-side whitelist on `sources` so a fabricated label can never reach the UI regardless. Typecheck + full test suite clean; not live-tested (would cost a real API call against a real taste profile, and the bug was intermittent). Full detail → archive (s112).

**Not touched, flagged for pickup:** `BulkConfirmSheet.tsx` (multi-photo add) still has the old bordered-chip look from pre-s110 — will read inconsistently next to the restyled single-item sheet.

## ▶ Next session (113)

**Confirm both s112 fixes live:** does the mood board actually look like a flowing masonry on Farah's real board (not just the synthetic test)? Does a real Discover session ever leak "via <garbage>" sources again, or narrate its filtering into the "why" text?

**Carried from s109, still not confirmed live:** the Discover "further afield" stuck-loading timeout fix (hard to force — just watch for it not hanging next time it's slow); the things-taste synthesis tone after its 3rd prompt fix; the mood-board vision split — re-tag a mood image and see if the tags read more like register/atmosphere words now, less like garment-cut.

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
