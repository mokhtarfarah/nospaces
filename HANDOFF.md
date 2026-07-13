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

**Session 117 — italic-rule sweep + article entry-point demote. Frontend only, no API. Committed to `main`.** New general rule (Farah): *only her own words are italic; AI prose renders roman* (saved to memory `italic-reserved-for-user-words`). Applied to the Discover blurbs (the ask — also smaller), the Guide's Discover illustration, and the Things product sheet (fit-read + taste tags → roman via a new `NoteProse upright` prop) — **which closes the parked s93/s94 "too much italic" item.** Media taste page left untouched (Farah's call — it's on the don't-touch list). Then the **article entry-point demote**: floating unread pill out of the masthead → a calm "• N to read … open →" bar in the reading views (books + all) only. Then **"all" tab de-confusion** (closes an s85 roadmap item): the per-medium facet filters (genre/vibe/verdict) now hide in the cross-category "all" view — only universal facets (region/shelf) show; recency-default was already in place. Typechecked, 118 tests green; verified in preview where data allowed. Full detail → archive (s117).

**Session 116 — s116 UI polish sweep (10 fixes) + discover speed fix. 4 commits, pushed to `main` (live).** The whole aesthetic-audit sweep in one batched pass: FAB overlap (new `clearFab()` in `lib/layout.ts` — the big one, was hiding the last row on 8 screens), "we'd lean here" wording + ✨ dropped, BulkConfirmSheet chips → soft-fill, Discover row-3 cut (refresh → header ↻), counts folded onto their row, badge unified, article initials skip "The", copy nits ("mood board", tidy→⋯ menu, empty state), "HOW IT LANDS", SALE tag de-saturated. Then a real-data review with Farah: dropped the taste count + the discover date kicker, baseline-aligned the library count (+ fixed a stray React key warning). Then **"further afield" speed**: capped the taste snapshot to 60 recent hits (`LIB_SAMPLE`), and — the real bottleneck being model write-time — routed **divert only to Haiku** (`api/recommend-feeds.ts`; ~40s→~10-15s, ~1/3 cost; "for you"/mood stay on Sonnet). All typechecked, 118 tests green; UI verified in preview. **Not live-verified:** the article email round-trip (s115), and the divert speed+quality on Haiku — sandbox has no backend. Full detail → archive (s116).

**Session 115 — magazine articles / read-later bookmarks (`type:'article'`). Committed + live.** Bare bookmark, capture via the free og-scraper; still needs an iOS Shortcut for one-tap. Email→save round-trip still not live-verified. Full detail → archive (s115).

## ▶ Next session (118)

**Confirm s117 live:** (a) the **article "to read" bar** — with real unread articles, does it show in books + the all view (not films/music/tv), read calm, and jump into the unread queue on tap? (b) the **italic sweep** on real data — Discover blurbs + Things fit-read/tags read as clean roman, and Farah's own notes still italic? (c) **"all" filter** — opening the filter sheet in "all" on the real (tagged) library shows only region/shelf, no genre/vibe/verdict soup?

**Confirm s116 live (the whole point of that session's judge-half):**
- **Further afield on Haiku** — does it load fast now (no spinner-forever)? AND do the picks still feel genuinely *further out*, not dumbed-down? If fast but bland → move divert back to Sonnet (one line in `api/recommend-feeds.ts`), or cut it with evidence. If fast + surprising → it's earned its place.
- **Library count** — baseline-aligned + non-bold on Farah's real (full) tab row?
- **FAB clearance** — does the last row/pick actually clear the `+` when scrolling her real long library / wishlist / mood board? (preview only had empty seed data.)
- Skim the rest of the sweep on real data: "we'd lean here", the restyled BulkConfirmSheet (multi-photo add), Discover's ↻ refresh, "· N things" on the taste caps line, the mono SALE chip.

**Confirm s115 live:** forward a real article link to the save@ address — lands as a clean bookmark, "read ↗" opens the source, "mark as read" is a plain toggle. If not, check `/api/email` logs for whether `articleLike` tripped.

**Confirm s114 live (still open):** does the jump-to-top button show + work scrolling Farah's real long lists — preview couldn't test with real data.

**Carried from s113, still not confirmed live:** does "rt 94%" actually render on a real film in the library sheet + Discover sheet? Does music "by creator" actually read cleaner now scrolling Farah's real collection?

**Carried from s112:** mood-board masonry **looks confirmed** — the s116 audit screenshots show a proper flowing masonry on Farah's real board. Still open: does a real Discover session ever leak "via <garbage>" sources again?

**Carried from s109:** further-afield stuck-loading is now addressed at the root (s116 Haiku move — see the s116 confirm above; the old 70s client timeout is still there as a backstop). Still not confirmed live: the things-taste synthesis tone after its 3rd prompt fix; the mood-board vision split — re-tag a mood image and see if the tags read more like register/atmosphere words now, less like garment-cut.

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
