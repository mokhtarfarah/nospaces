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

**Session 125 — "non-fiction" reframed from a shortcut into a real derived genre chip. Free (frontend only, no API). NOT pushed yet.** Farah on the s124 build: she wanted "non-fiction" to be *another category you click like any other genre* (memoir + nonfiction, history + nonfiction), not an overarching shortcut. Reframed it as a **derived genre**: any book with a non-fiction genre now shows a plain **"non-fiction"** chip in the alpha-sorted genre list (no stored tag, no re-tagging, always in sync). `NONFICTION_GENRE` + `hasNonfictionGenre()` in `src/lib/genres.ts`; the facet build bumps it once per non-fiction book; the filter matches it by roll-up. Removed the whole s124 shortcut machinery (memo/handler/props/special-cased MenuItem) — it's now a normal `tagPanel` chip. Gate green — typecheck+lint clean, genre-sync passes, **130 tests (+3)**. **NOT eyeballed — empty sandbox, no data in the genre filter.** Full detail → archive (s125).

**Session 124 — genre filter now sorts A→Z + (superseded by s125) a "non-fiction" grouping on the book genre filter. Free (frontend only, no API). NOT pushed yet.** Farah brought four roadmap ideas; I built the two free ones and captured the other two. **(1)** The genre filter used to lead with the most-used genre (all facets were hit-count-ranked); genre is the one facet you *look up* not *browse*, so it now sorts **alphabetically** (new `alpha()` sorter in `LibraryScreen.tsx`; other facets stay ranked). **(2, reworked s125)** The "non-fiction" grouping (`NONFICTION_GENRES` in `src/lib/genres.ts`) — first shipped as a top-of-list shortcut, then reframed s125 into a normal derived chip. **(3)** *De-emphasize the media/things switcher* → folded into the open nav-pass roadmap item (it's the 21px bold "masthead"; solve it inside that one nav decision). **(4)** *"Add my own categories"* → reframed & captured: articles/podcasts were code additions, not user actions; a real category system is a big refactor against the app's soul — better to just name a type and I add it. Full detail → archive (s124).

**Session 123 — photo identification reframed (read the title, don't recognize it) + clear-filters keeps the tab. Free (prompt-only). Pushed to `main` ([3ce41e1]).** Farah: emailed photos of brand-new books kept failing to read. Root cause = the vision prompts asked the AI to *recognize* the work, so a legible-but-unknown cover was dropped as "nothing identifiable" (exactly what s105 predicted). Fixed both photo paths — **`classifyEmailImage`** (`api/email.ts`) and the image branch of **`api/identify.ts`** — to **transcribe the printed title/author off the image**; newness no longer matters, confidence now tracks legibility not recognition. Same one vision call, **no cost change**. (Typed-text ID is still catalog-first, AI-fallback — unchanged; only *photos* are AI-first, by necessity.) Batch cap (MAX_DELIBERATE_IMAGES=5) ruled out — Farah sends 1–2/email. **Also: "clear filters" no longer resets the medium tab** — clears status/shelf/genre/vibe/verdict/series/region/search but leaves you in film/book/etc. Gate green (125 tests). **Not eyeballed — sandbox has no email backend / empty library.** Full detail → archive (s123).

**Session 122 — podcasts added (mirrored on articles) + removed the s119 music "classic" shelf. Free (og-scrape only, no API). Pushed to `main` ([f824723], [3a28790], [b586b66]).** Podcasts are now a link-saved, email-only listen-later bookmark, behaving exactly like articles: forward an Apple/Spotify/Overcast/etc. link to `save@` → og-scrape → saved `want_to` (reply *"saved to listen later"*), an og:image cover + source-name band, mark-done with no reaction, kept out of taste/genre/recs, hidden from the tab row and surfaced by a new **"to listen"** bar. Both bookmark queues (article "to read" + podcast "to listen") now live in the **all view only** — the article bar was pulled out of the books view for symmetry (was books+all since s115; eyeball that it feels right). Built on one shared **`isBookmark()`** predicate (`src/lib/colors.ts`) so article + podcast stay in lockstep instead of drifting across ~15 branches. Typecheck (src+api) + lint clean, **125 tests green**, no-auth preview boots clean; podcast **detection** sanity-checked with a 12-case node harness (all pass). **Not eyeballed on real data — empty sandbox, no backend.** **Also removed the s119 music "classic" shelf** (mark-as-classic + the all·classic·new lens + `toggleClassic`/`metadata.classic`) — Farah decided it wasn't thought through. Full detail → archive (s122).

**Session 121 — article list rows show the magazine; email account-lookup hardened. Free (no API). Pushed to `main` ([82aa33f], [83eea1c]).** (1) Library **list view** article rows now read **`title · magazine · author`** (was `title · author`) — the publication comes from `metadata.siteName`→hostname via a new shared `articleSourceName()` helper, reused by the grid tiles too. **Not eyeballed — empty sandbox; Farah to check on real data** (esp. a no-`siteName` article's hostname fallback, and one item whose title already leads with the author's name). (2) An emailed article bounced with *"user not found."* Root-caused as a **transient `listUsers()` blip** (only 2 users, so not pagination; re-send saved it, so not a persistent key/from-address issue). Shipped hardening regardless: **paginated** the lookup + **split** the failure messages so a lookup error now says *"couldn't reach the account database… try again"* (retryable) vs a real no-match. Typecheck clean, **125 tests green**. Full detail → archive (s121).

**Session 120 — library filters → one two-tier "filters" menu. Free (frontend only, no API). Pushed to `main` ([79c5bde]).** Replaced the "status" dropdown + the sheet's tag-filter half with a single **"filters"** two-tier menu (tier 1 = axes: status · shelf · genre · vibe · verdict · series · region + a new-music toggle; tier 2 = that axis's options behind a `‹ back`). Status keeps its done→verdict and want-to→shelf refinements inline. Button gets an active-count badge + a clear-all footer; the **right-hand sheet is now view+sort only**. Typecheck clean, **125 tests green**. **Verified live** in the no-auth preview: status/verdict path + the trimmed sheet all work. **The tag-facet rows need real data (empty sandbox) — Farah to eyeball on her library.** This is the "status folds into filter" slice of the queued menu-nav pass; the type-row + dual-nav sub-tab pieces stay queued. Full detail → archive (s120).

*(s120 library filters → one two-tier "filters" menu; s119 colour-story skin gate + music "classic" shelf **[removed s122]**; s118 UI-nits; s117 italic-rule sweep — full detail in archive.)*

## ▶ Next session (125)

**s115/116/117 all confirmed live (s118, Farah on her phone)** — article "to read" bar, italic sweep, "all" filter, further-afield-on-Haiku (fast *and* still adventurous — it earned its place), FAB clearance, and the s115 article email round-trip. These are done; don't re-queue them.

**Eyeball on real data (I couldn't — sandbox has no backend):** **(h, s124+s125) genre filter** — open **filters → genre** on books: the list now reads **A→Z** (not most-used first), and **"non-fiction"** is a normal chip sitting alphabetically in the list (under "n", not pinned on top). Tapping it should show every non-fiction book (biography/memoir/history/…); tapping "memoir" still narrows to just memoirs; both coexist. Confirm it only appears on books, and that the vibe/verdict/region facets are still ranked biggest-first. **(f, s123) photo identification** — re-send one of the screenshots that failed (e.g. *The Plunge* — a Goodreads/NYT page or a bare cover): does it now save as a book by the right author instead of bouncing "couldn't read the photo"? Then try the **in-app add-a-photo** on a new book — same fix, should read the cover too. **(g, s123) clear filters** — go into a medium (say books), set a filter or two, tap **clear all**: filters clear but you STAY on books (no bounce to "all"). Then the earlier stack — **(e, s122) podcasts** — forward a real Apple/Spotify/Overcast episode link to `save@`: does it land as a podcast (reply *"saved to listen later"*, not "read later"), render the show/platform as its source name, mark-done with no reaction, and show the **"to listen"** bar in the all view? (Spotify: only `/show/` + `/episode/` links should catch — an album/track link should still route to media, not podcast.) **(a, s121) article list rows** now read `title · magazine · author` — open the library **list** view (not grid) on articles and confirm the publication reads right; watch a no-`siteName` article's hostname fallback ("newyorker" vs "The New Yorker") and the one item whose title already leads with its author (may double up). **(b, s120) the new "filters" menu** on the library: tap **filters**, confirm the tag-facet rows appear on a single medium (genre/vibe/verdict/series/region + shelf) and multi-select narrows the list; status→done still reveals the four verdicts; the right slider sheet is view+sort only. **(c, s119) the colour-story ribbon** on the Things taste page (a monochrome board should show **no skin-brown swatches**, camel/tan/leather still reads). *(The s119 music "classic" shelf was **removed** in s122 — Farah decided it wasn't thought through; no longer needs eyeballing.)*

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
