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

**Session 121 — article list rows show the magazine; email account-lookup hardened. Free (no API). Pushed to `main` ([82aa33f], [83eea1c]).** (1) Library **list view** article rows now read **`title · magazine · author`** (was `title · author`) — the publication comes from `metadata.siteName`→hostname via a new shared `articleSourceName()` helper, reused by the grid tiles too. **Not eyeballed — empty sandbox; Farah to check on real data** (esp. a no-`siteName` article's hostname fallback, and one item whose title already leads with the author's name). (2) An emailed article bounced with *"user not found."* Root-caused as a **transient `listUsers()` blip** (only 2 users, so not pagination; re-send saved it, so not a persistent key/from-address issue). Shipped hardening regardless: **paginated** the lookup + **split** the failure messages so a lookup error now says *"couldn't reach the account database… try again"* (retryable) vs a real no-match. Typecheck clean, **125 tests green**. Full detail → archive (s121).

**Session 120 — library filters → one two-tier "filters" menu. Free (frontend only, no API). Pushed to `main` ([79c5bde]).** Replaced the "status" dropdown + the sheet's tag-filter half with a single **"filters"** two-tier menu (tier 1 = axes: status · shelf · genre · vibe · verdict · series · region + a new-music toggle; tier 2 = that axis's options behind a `‹ back`). Status keeps its done→verdict and want-to→shelf refinements inline. Button gets an active-count badge + a clear-all footer; the **right-hand sheet is now view+sort only**. Typecheck clean, **125 tests green**. **Verified live** in the no-auth preview: status/verdict path + the trimmed sheet all work. **The tag-facet rows need real data (empty sandbox) — Farah to eyeball on her library.** This is the "status folds into filter" slice of the queued menu-nav pass; the type-row + dual-nav sub-tab pieces stay queued. Full detail → archive (s120).

*(s119 colour-story skin gate + music "classic" shelf; s118 UI-nits; s117 italic-rule sweep — full detail in archive. s119's two builds still need eyeballing, see below.)*

## ▶ Next session (122)

**s115/116/117 all confirmed live (s118, Farah on her phone)** — article "to read" bar, italic sweep, "all" filter, further-afield-on-Haiku (fast *and* still adventurous — it earned its place), FAB clearance, and the s115 article email round-trip. These are done; don't re-queue them.

**Eyeball on real data (I couldn't — sandbox has no backend):** four builds — **(a, s121) article list rows** now read `title · magazine · author` — open the library **list** view (not grid) on articles and confirm the publication reads right; watch a no-`siteName` article's hostname fallback ("newyorker" vs "The New Yorker") and the one item whose title already leads with its author (may double up). **(b, s120) the new "filters" menu** on the library: tap **filters**, confirm the tag-facet rows appear on a single medium (genre/vibe/verdict/series/region + shelf) and multi-select narrows the list; status→done still reveals the four verdicts; the right slider sheet is view+sort only. **(c, s119) the colour-story ribbon** on the Things taste page (a monochrome board should show **no skin-brown swatches**, camel/tan/leather still reads). **(d, s119) the music "classic" shelf** — open a music album's ⋯ menu → "mark as classic", then the music view's **all · classic · new** filter should split them (must work on a *want-to* album, not just done).

**Email capture (s121, resolved but worth knowing):** the *"user not found"* bounce was a **transient `listUsers()` blip** — if it recurs, the reply now names the cause; the fix is to **re-send once**. No open action.

**The next real design pass — menu-nav (Tier 1).** The **filter-bar** slice is now done (s120 — filters live in one two-tier menu). Remaining as ONE decision: the per-medium **type-row** (music/films/books/tv) and the **dual-nav sub-tab** placement. **s119 recommendation (mocked, awaiting Farah's go):** mirror the Things board — type-tabs own the sticky row, the count becomes a **labeled subline under the title** (that's the "count is wrong" fix — it's placement, not math; `filtered.length` is correct). Sub-tabs **lift out of the bottom nav into a page-level segmented control** so the nav returns to one clean row. Detail → `docs/ROADMAP.md` → "Dual-nav sub-tab row".

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
