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

**Session 119 — colour-story skin gate + music "classic" shelf. Free (no API). Pushed to `main`.** (1) Mocked a menu-nav direction (mirror the Things board; sub-tabs lift into a page-level segment) — Farah deferred, so **menu-nav stays queued (Tier 1) with that direction on record.** (2) Shipped the s118 **palette-protected skin gate** (`src/lib/palette.ts`): builds a known-good palette from the clean packshot cutouts and drops flesh pixels on worn/mood shots unless a cutout confirms the colour — skin goes, camel/leather stays. (3) Built a music **"classic" shelf** (`metadata.classic` — NOT `canon`, which is the desert island): a status-agnostic album flag (works on want-to + done, so it can't be a verdict), toggled from the album ⋯ menu, with an **"all · classic · new"** filter in the music view. Typecheck clean, **125 tests green** (+7 in `palette.test.ts`). **Neither visually verified — no-auth sandbox has no backend (media/board can't persist); Farah to eyeball both on real data.** Also captured 2 backlog items (library-search troubleshoot, in-app article-link paste). Full detail → archive (s119).

**Session 118 — s118 UI nits sweep. Frontend only, no API. Committed + pushed to `main` ([e2a75e3]).** Revisited the full roadmap with Farah + tiered it, then **verified the whole pending stack live — she confirmed all of s115/116/117** (article bar, italic sweep, "all" filter, further-afield-on-Haiku, FAB clearance, article email round-trip). One caveat: the **share-shortcut (sharing a link straight from an app, not email-forward) is flaky** — parked with a diagnostic path under Capture. Then six small nits: articles bar de-inboxed ("N articles", no dot); shows-near-you + articles bars unified (light cream fill, de-pilled radius 10→4, Farah picked "squared"); **nav dividers** — slash kept only on the `media/things` toggle, dropped from the section links; mood-board "paste a link" folded into the **+** speed-dial; Things taste page trimmed (dropped "taste" subtitle + "N things" count). **Deferred: the filter-bar count + declutter** — folded into the menu-nav design pass (the recurring type-row problem), not half-fixed. Then two follow-on fixes: **entry bars aligned to the gallery image edges** (shared `galleryPadX`), and a **Things bug — a new image address wasn't taking** (a stale cached cutout shadowed the raw photo; now dropped when the image changes, product + candidate edits). Typecheck clean, 118 tests green. **Not visually verified — live app is login-gated, Farah to eyeball on phone.** Full detail → archive (s118).

**Session 117 — italic-rule sweep + article entry-point demote. Frontend only, no API. Committed to `main`.** New general rule (Farah): *only her own words are italic; AI prose renders roman* (saved to memory `italic-reserved-for-user-words`). Applied to the Discover blurbs (the ask — also smaller), the Guide's Discover illustration, and the Things product sheet (fit-read + taste tags → roman via a new `NoteProse upright` prop) — **which closes the parked s93/s94 "too much italic" item.** Media taste page left untouched (Farah's call — it's on the don't-touch list). Then the **article entry-point demote**: floating unread pill out of the masthead → a calm "• N to read … open →" bar in the reading views (books + all) only. Then **"all" tab de-confusion** (closes an s85 roadmap item): the per-medium facet filters (genre/vibe/verdict) now hide in the cross-category "all" view — only universal facets (region/shelf) show; recency-default was already in place. Typechecked, 118 tests green; verified in preview where data allowed. Full detail → archive (s117).

## ▶ Next session (120)

**s115/116/117 all confirmed live (s118, Farah on her phone)** — article "to read" bar, italic sweep, "all" filter, further-afield-on-Haiku (fast *and* still adventurous — it earned its place), FAB clearance, and the s115 article email round-trip. These are done; don't re-queue them.

**Eyeball on real data (I couldn't — sandbox has no backend):** two s119 builds — **(a) the colour-story ribbon** on the Things taste page (a monochrome board should show **no skin-brown swatches**, camel/tan/leather still reads); **(b) the music "classic" shelf** — open a music album's ⋯ menu → "mark as classic", then the music view's **all · classic · new** filter should split them (and it must work on a *want-to* album, not just done). Plus the carried s118 nits: the two entry bars (light + squared + matching), the nav bars (slash only on `media/things`), the mood-board **+** speed-dial, and the Things taste page (no "taste" subtitle, no count).

**The next real design pass — menu-nav (Tier 1) — direction now on record (s119).** Farah: *"we keep coming back to this one."* Do it as ONE decision: the per-medium **type-row** (music/films/books/tv), the **filter-bar** declutter, and the **dual-nav sub-tab** placement. **s119 recommendation (mocked, awaiting Farah's go):** mirror the Things board — type-tabs own the sticky row, **status folds into the filter sheet**, the count becomes a **labeled subline under the title** (that's the "count is wrong" fix — it's placement, not math; `filtered.length` is correct). Sub-tabs **lift out of the bottom nav into a page-level segmented control** so the nav returns to one clean row. Detail → `docs/ROADMAP.md` → "Dual-nav sub-tab row".

**New from s119 (Farah flagged, captured to ROADMAP, not yet started):**
- **Library search isn't matching well — troubleshoot.** Plain substring on title/creator/tags; breaks on multi-word cross-field queries, typos, accents. **Get a concrete failing example from Farah before rebuilding the matcher** — and clarify what "troubleshoot with other input methods" means (voice dictation vs. typed vs. paste?). Detail → ROADMAP → "Library search".
- **In-app "paste an article link" to add directly** — not only email. The composer's paste accepts images only today. Reuse the email path's extraction. Detail → ROADMAP → Capture.

**Capture (Tier 1, mostly free) — threads that fold together:**
- **⚠️ Troubleshoot the flaky share-shortcut** — sharing a link *straight from an app* (not email-forward) has failed intermittently; at least one test article didn't land. Diagnostic path in `docs/ROADMAP.md` → Capture. The plain email-in path is confirmed working.
- **iOS share Shortcut rebuild** — the clean version (auto-send an email to `save@`, no fragile API POST). Spec'd in ROADMAP → Capture. Build + troubleshoot in the same pass.

**Do first (housekeeping):**
- **Confirm the 10k Postmark plan is bought.** Approval unblocked it; talkback ≈ 2 emails/capture and the free plan is only 100/mo, so real use will blow the cap fast. Detail → `docs/REFERENCE.md` → Postmark plan.

**Still carried, low-priority one-off checks (not yet confirmed live):** s114 jump-to-top on real long lists; s113 "rt 94%" on a real film + music "by creator" reading cleaner; s112 whether Discover ever still leaks "via <garbage>" sources; s109 things-taste synthesis tone + the mood-board vision split (re-tag a mood image → do tags read more like register/atmosphere, less like garment-cut?).

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
