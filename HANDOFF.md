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

**Session 115 — magazine articles / read-later bookmarks. Code done, typechecked + tested, NOT committed yet (Farah hasn't been asked).** New `type:'article'` in the media library — a bare bookmark (title/byline/publication/thumbnail/link), no genres/vibes/verdicts, just saved→read. Capture reuses the existing free og-tag scraper (`api/_scrape.ts` gained `articleLike`/`author`/`publishedTime`; `captureArticle()` in `api/email.ts` mirrors `captureThing()`) — a shared link to the save@ address now tries product-like, then article-like, before falling to the paid AI reader. Still needs the (not-yet-built) iOS Shortcut to be a real one-tap capture from New Yorker/Apple News/etc — until then, forward the link by hand. **Not live-verified** — this sandbox can't log into Farah's real Google account, so the actual email→save round trip hasn't been seen. Full detail → archive (s115).

**Session 114 — jump-to-top button on library + things. 1 commit, pushed to `main` (live).** Farah's ask: a fast way back up when deep in a long list. Both screens already scroll one `<div ref={listRef}>` (not the window), so the fix is identical in shape: a small round button appears once you've scrolled ~700px, smooth-scrolls back to top on tap. Deliberately placed bottom-**left** (the black "+" add FAB already owns bottom-right) so the two never collide and the secondary action reads quieter (white/outlined vs. solid black). Library hides it during multi-select; Things offsets it above the taste sub-nav row when present. Verified in preview via a synthetic scroll injection (both dev instances have empty seed data) — button showed/hid at the right threshold and sat correctly in all three spots (library, things/moodboard, things/wishlist); smooth-scroll animation itself couldn't be observed completing in the preview harness (`requestAnimationFrame` doesn't tick there) but instant scroll confirmed the wiring, and smooth scroll is a standard browser feature. Full detail → archive (s114).

**Not touched, flagged for pickup:** `BulkConfirmSheet.tsx` (multi-photo add) still has the old bordered-chip look from pre-s110 — will read inconsistently next to the restyled single-item sheet.

## ▶ Next session (116)

**Confirm s115 live:** forward a real article link to the save@ address and confirm it lands as a clean bookmark (title/byline/publication/thumbnail), "read ↗" opens the source, "mark as read" is a plain toggle with no reaction prompt. If it doesn't land, check `/api/email` logs for whether `articleLike` tripped.

**Confirm s114 live:** does the jump-to-top button actually show up and work when scrolling Farah's real (long) library and wishlist/mood board — the preview couldn't test this with real data.

**Carried from s113, still not confirmed live:** does "rt 94%" actually render on a real film in the library sheet + Discover sheet? Does music "by creator" actually read cleaner now scrolling Farah's real collection?

**Carried from s112, still not confirmed live:** does the mood board actually look like a flowing masonry on Farah's real board? Does a real Discover session ever leak "via <garbage>" sources again?

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
