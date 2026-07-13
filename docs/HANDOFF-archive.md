# Nospaces — Session log archive

Append-only history. The live `HANDOFF.md` keeps only the latest session; everything older lands here. Newest first.

---

### Session 117 (2026-07-12) — italic-rule sweep + article entry-point demote. Free (frontend only, no API).

**Established a general rule (Farah): only Farah's own words are italic; AI-generated prose renders roman.** Saved to memory as `italic-reserved-for-user-words`. Applied it across every AI-prose surface — all typechecked, 118 tests green, verified in the noauth preview where data allowed:
- **Discover blurbs** (the explicit ask) — feed-card blurb (13→12px) and the detail sheet's "why this" (15→13px) both dropped `fontStyle: italic`. `renderBlurb`'s markdown-emphasis spans no longer need the italic→upright dance; they just bold now.
- **Guide screen's Discover illustration** — the static demo mirroring the feed went roman to match. *Verified in browser (computed `fontStyle: normal`).*
- **Things product sheet** — the AI "how it lands" fit-read (rendered via the shared `NoteProse`) + the taste-tag chips went roman. Gave `NoteProse` an `upright` prop so machine prose is roman while Farah's own notes ("your note", library "thoughts", desert-island whys) stay italic. **This closes the parked s93/s94 "Things sheet — too much italic" item** — the rule decided the fork (both prose *and* tags → roman; her note stays italic). The Things synthesis + compare verdict were already roman.
- **Media taste page — deliberately left untouched.** Its AI read is roman except for occasional `*emphasis*` spans; Farah chose to leave it (it's on the HANDOFF "don't touch" list, and `inlineItalics` is shared with her own notes).

**Article entry-point demote (roadmap: dual-nav s116 addition (a)).** The floating unread-count pill (`cac6391`) was pulled out of the library masthead — it over-elevated a lightweight type above films/music/tv. Replaced with a calm soft-fill (`#F4F2EE`) "• N to read … open →" bar below the header, shown only in the **reading views** (books alone or the `all` view, which already interleaves articles), never on films/music/tv. Tapping filters to the unread queue (`selectCategory('article')`), and the bar hides once you're in that filtered view. *Verified: pill gone from header; bar renders correctly (temp-forced a count for the screenshot, then reverted); hides at 0 unread.*

**Not live-verified** (this local preview has no `/api` backend): the Things-sheet italic changes need a generated fit-read, and the article bar's real count needs actual saved articles — both are pure conditional-render/style, mechanisms verified.

---

### Session 116 (2026-07-12) — s116 UI polish sweep + discover speed fix. Mostly free (one Anthropic change, and it *lowers* cost).

**Batched the whole s116 aesthetic-audit sweep in one pass (10 decided fixes), all pushed to `main`.** Commit [47eb8f2]. Typechecked, 118 tests green, the visible ones verified in the mobile preview (noauth dev instance):
- **FAB overlap (highest-impact)** — the floating `+` reserved no scroll padding, so the last row hid behind it on 8 screens. Added `clearFab()` to `lib/layout.ts` (nav + 18px gap + 50px button + 16px margin, safe-area-aware) and swapped every scroll container's bottom padding to it (Library, Taste, Guide, Discover, Things, HelpMeDecide). Verified: scrolled the guide to the bottom, last row sits clear of the FAB.
- **Star vs "leans here"** — the AI's per-candidate note now reads first-person **"we'd lean here"** (the user's ★ stays their own lean); dropped the ✨ from that note *and* the compare button — it was the app's only emoji. No ✨ left anywhere.
- **BulkConfirmSheet chips** — the want-to/done control's "active" bg was literally the *inactive* soft-fill colour (selected read as off). Restyled to the borderless soft-fill system (active taupe `#E6E1D7`), softened the type-select pill too.
- **Discover row-3 cut** — dropped the "N picks · refresh" row; refresh is now a quiet ↻ in the `PageHeader` `right` slot (hidden for editorial starter picks — correct, nothing to refresh yet). Added a shared `@keyframes spin` to `index.css` for the loading state.
- **Counts onto their row** — Library count → right-aligned number on the type-tab row (tracks the active tab); removed the whole subtitle row + the now-unused `kicker` memo. Things-taste → `· N things` folded onto the vibe-caps line; dropped the wishlist/mood split (`taggedMood`/`taggedWishlist` removed).
- **Badge style** — Library's bordered unread-articles pill de-outlier'd to borderless soft-fill with the same ink dot the boolean indicators use.
- **Article initials** — new `sourceInitial()` skips a leading "The" (New Yorker → N, Atlantic → A, not both "T").
- **Copy nits** — "mood board" (two words) on the sub-tab chip; guide "tidy" Extra now points to the **⋯ menu** (the "tidy · N" header was removed s111); mood-board empty state broadened to "a vibe, an aesthetic, an atmosphere".
- **"HOW IT FITS" → "HOW IT LANDS"** — the tab label + the style-profile prose and comments that name it (a bag doesn't "fit").
- **Red SALE tag** → quiet mono soft-fill chip (was the only saturated colour in the palette).

**Then a real-data review round with Farah — 4 more fixes.** Commit [bd7add5]:
- **taste (media)** — dropped the "N ratings and counting" kicker (she doesn't want the count on that page).
- **discover** — dropped the "for you · 12 jul" header kicker (no other page carries the date; the stream is already shown by the active chip). Removed the now-unused `dateLabel`/`streamLabel`.
- **library count** — was sitting low + bold; added matching tab-row padding so it baseline-aligns, dropped to weight 500. Verified via zoom.
- **bonus** — fixed a keyless-`<>`-fragment React warning in the guide's `Tips`/`Extras` (spotted while verifying); `<>` → keyed `Fragment`.

**"Further afield" slowness — investigated, then two fixes.** Farah asked whether divert (further afield) actually works / sends too much data. Read the engine: it dumped **every** loved/liked item into the prompt as an uncapped exclusion list — slow (near the 60s cap → the s109 stuck-loading) and, for divert, anchoring the model to her whole back-catalogue.
- **Fix 1 (cap the data), commit [bdb040a]:** cap the taste snapshot to the 60 most-recent hits (`LIB_SAMPLE` in `DiscoverScreen`). Safe — `filterResults()` already drops any returned pick that's in the *full* library, so a hit outside the sample can never surface as "new". Free, slightly cheaper.
- **Still slow → Fix 2 (faster model), commit [a5d218d]:** the real bottleneck was the *model writing* 8–10 multi-sentence picks on Sonnet (~40s). Farah chose (menu) to route **divert only** to **Haiku** — several times faster (~10–15s), ~1/3 the cost; "for you" (intaste) + mood searches stay on Sonnet where taste precision matters. `api/recommend-feeds.ts`: `model = mode === 'divert' && !moodText ? 'claude-haiku-4-5' : 'claude-sonnet-4-5'`. One line to revert if divert quality feels thin. **Not live-verified** — the sandbox has no backend; Farah judges speed + quality on the real app.

**Decision recorded:** on the "should we kill further afield?" question, Farah chose **fix-then-judge**, not kill — the concept (serendipity / anti-mirror) is worth keeping; the problems were implementation (bloat + slow model), both now addressed. Kill only later, with evidence, if it's fast but bland.

**Teed up but deliberately NOT done this sweep** (still in ROADMAP): ghost-numerals test, the articles-bar nav move, the Discover-recs-repeat 40-cap fix.

---

### Session 115 (2026-07-09) — magazine articles / read-later bookmarks. Free, no Anthropic calls (reuses the existing free og-tag scraper).

**Farah's ask: a way to mark an article in the New Yorker/Apple News/Atlantic app to come back to later.** Confirmed up front this can't be a real in-app reader — paywalled sources won't yield full text — so it's scoped as a clean bookmark: title/byline/publication/thumbnail/link, tap-through to read, not offline reading. Placement decision (asked, not assumed): Farah chose **fold into the media library as a new `type:'article'`**, over a new top-level "reading" domain or a Things `kind` — articles read as list rows (like film/book/tv), not an image-first board.

**Deliberately minimal — no taste surface.** Articles get NO genres, vibes, verdicts, or data-gaps nagging (`GAP_MEDIA_TYPES` / genre vocab / vibe vocab in `moods.ts` all left untouched — 'article' simply isn't in those lists, so nothing fires). Just `want_to` (saved) → `done` (read), no reaction — same "saving is the signal" spirit as Things, applied to reading instead of buying.

**Capture reuses the free scraper, no new AI cost.** `api/_scrape.ts`'s `scrapeProduct()` (already used for Things product links) gained a sibling `articleLike` check (og:type=article, or an `article:author`/`article:published_time` meta tag present) alongside the existing `productLike` check, plus `author`/`publishedTime` extraction. A shared link forwarded to the universal capture-all address now tries product-like first, then article-like, before falling through to the paid AI media reader — `captureArticle()` in `api/email.ts` mirrors `captureThing()` (dedup by URL, direct insert, undo link in the talkback reply). The page's dek/description is stored as `metadata.capturedBlurb`, which rides the *existing* "about this" collapsible on the item sheet for free — no new UI needed for that part.

**Still needs the iOS Shortcut to actually get used day-to-day.** This capture path fires once a link reaches the inbox — getting a shared link out of the New Yorker/Apple News/Atlantic app on iOS still needs the share→silent-email Shortcut that's already on the roadmap for Things (same mechanism, not yet built). Until then, forwarding a link by hand to the save@ address works today.

**UI changes:** `colors.ts` (new palette entry), `LibraryScreen.tsx` (`CATEGORY_LABEL`, so an "articles" tab appears once one exists — the tab list is already dynamic by count), `ItemActionSheet.tsx` (hides wiki/Spotify/runtime-pages/"own it"/"in progress" for articles — none of them apply; adds a "read ↗" link-out button and swaps the reaction footer for a bare "mark as read" toggle, so opening an article's sheet never routes into the reaction/verdict flow at all).

**Verified: typecheck clean (both configs), full 118-test suite green, dev server HMR reloaded every edit with no console errors.** **Not verified live** — this sandbox has no login to Farah's real Google account, so the actual email → scrape → save round trip on a real shared article link hasn't been seen yet. Flag for next session: forward a real article link to the save@ address (or, once built, use the Shortcut) and confirm it lands as a clean bookmark — title/byline/publication/thumbnail, "read ↗" opens the source, "mark as read" is a plain toggle with no reaction prompt.

---

### Session 114 (2026-07-09) — jump-to-top button on library + things. Free, no Anthropic calls, pure UI.

**Farah's ask: a way to jump back to the top when deep in a long list.** Both `LibraryScreen.tsx` and `ThingsScreen.tsx` already scroll a single `<div ref={listRef} overflowY: 'auto'>` (not the window), so the fix is the same shape in both: track `scrollTop` on that div, show a small round button once it passes 700px, `scrollTo({ top: 0, behavior: 'smooth' })` on tap.

**Placement — bottom-left, deliberately.** Both screens already have a black "+" FAB pinned bottom-right (`clearStack` from `lib/layout.ts`). Putting jump-to-top on the *left* at the same height means it never collides with or crowds the add gesture, and reads as a secondary/quiet action (white bg, thin border) next to the primary one (solid black). Library additionally hides it during multi-select (the bulk action bar already owns that strip); Things offsets it up by `SUBNAV_H` on the `taste` tab so it clears the profile/moodboard sub-row, mirroring how the add FAB already does this.

**Verified in preview, not just typechecked.** Both dev instances (`nospaces`, `nospaces-noauth`) have empty seed data, so real scrolling wasn't possible — confirmed the mechanism instead by injecting a 2000px spacer into the actual scroll container via `preview_eval`, setting `scrollTop`, and dispatching a real `scroll` event: the button correctly appeared/disappeared at the threshold and sat in the right spot (screenshotted) on library, things/moodboard (with sub-nav offset), and things/wishlist (without it). The tap-to-scroll wiring was confirmed with instant scroll (`behavior: 'auto'`) — `behavior: 'smooth'` couldn't be observed completing in this harness because `requestAnimationFrame` doesn't tick in the automation context (a preview-tool limitation, not app code); smooth scroll is a standard, widely-supported browser feature so this will animate normally for Farah on a real device.

`tsc --noEmit` (both configs) + full 118-test suite clean.

Committed `e9bb699`, pushed to `main`, live.

---

### Session 113 (2026-07-08) — music creator sort fix + Rotten Tomatoes scores. Free, no Anthropic calls.

**Music "by creator" scroll was confusing — band names sorted by last word.** `lastNameKey()` (`LibraryScreen.tsx:147`) split every creator on whitespace and sorted by the last word, correct for "Donna Tartt" → tartt but wrong for bands: "Fleetwood Mac" filed under M, "Talking Heads" under H. Root cause had nothing to do with source variety (Farah's original guess) — it was applying person-name sorting to every type uniformly. Fix: new `creatorSortKey(item)` branches on `item.type === 'music'` — music sorts/groups by the full band/artist name (stripping a leading "The"), everything else keeps last-name sorting. Verified the sort output directly in Node against sample band names (Arctic Monkeys→A, Beatles→B, Fleetwood Mac→F, Radiohead→R, Talking Heads→T; Fincher/Tartt still sort by surname). Deliberately doesn't try to detect "is this a person or a band" from the string — unsolvable in general (Bush, Cake, Sting, Drake) — keys off `type` instead, which also matches how you'd actually browse a shelf (solo artists like "Fiona Apple" file under F, not "Apple").

**Discover repetition — diagnosed, parked.** Farah noticed Discover recs repeat a lot; asked whether limiting to one request/week would help. Traced it to `api/recommend-feeds.ts:209` — the exclusion list sent to the prompt was cut from 150 to 40 titles last session (s112) as a side effect of fixing the "via alreadyrecommended" narration leak, so anything recommended more than 40 picks back can resurface. Recommended fix: raise the exclusion window back up using a bare-titles list (the leak came from a shouty formatted block, not length, and s112 already added a hard source whitelist as backup) rather than rate-limiting — a weekly cap doesn't reduce repetition, just spaces it out. **Parked, not built** — logged to `docs/ROADMAP.md` → Discovery.

**Rotten Tomatoes scores — new feature, film/tv only.** Farah asked if RT scores could show on movie recs; flagged that having the *AI* state a score risks fabrication. Discovered Wikidata carries it structurally: `P444` (review score) qualified by `P447` (review score by) = `Q105584` (Rotten Tomatoes) — confirmed live against The Dark Knight (94%), Barbie (88%), Oppenheimer (93%), and a smaller/foreign title (Anatomy of a Fall, 96%) so coverage isn't just-blockbusters. Added `rt` to `wikidataFields()` in `api/wiki.ts` (same free, no-Anthropic pattern as runtime/pages/genres) and a new `useRottenTomatoesScore()` hook in `src/lib/wikipedia.ts`. Wired into both the Discover recommendation detail sheet (`DiscoverScreen.tsx`) and the library item sheet (`ItemActionSheet.tsx`) — sheet-only in both cases, not on every card/row, to avoid clutter and (for the library) a second per-row Wikipedia fetch on top of the existing one. Shows nothing when a work has no RT claim yet — never fabricates a number.

**Caught a real bug during verification, not just typecheck.** First draft of the RT-parsing logic misread Wikidata's claim shape — qualifier snaks aren't wrapped in `mainsnak` the way a claim's own value is, only the outer claim is. Would have silently returned `null` for every film forever; typecheck and the test suite both would have stayed green. Caught by testing the exact parsing logic against live Wikidata data in a scratch script before shipping, not by reading the code. Worth remembering: structural/shape bugs in code that talks to an external API don't show up in `tsc`/`vitest` — only a real data round-trip catches them.

**Not live-verified in the app itself** — this dev environment only runs Vite (`npm run dev`), not `vercel dev`, so `/api/*` endpoints return raw source locally, not JSON. Confirmed via `tsc --noEmit` (both configs) + full 118-test suite, and by running the actual `wikidataFields` parsing logic against real Wikidata responses in a standalone script. The feature itself (does "rt 94%" actually render on a real film in prod) — not yet seen live, flag for next session.

Committed `12d7b77` (music sort), `6c73941` (Discover RT score), `35f821e` (library RT score), all pushed to `main`, live.

---

### Session 112 (2026-07-08) — mood board masonry fix + Discover "via alreadyrecommended" fix. Free, no new API calls.

**Mood board masonry (Farah, s111 log item).** `MoodWall` (`ThingsScreen.tsx:2496`) used a plain CSS `display: grid` with `repeat(cols, 1fr)` — row-locked, so a short image still left a gap under it up to the tallest image in that row. Swapped to CSS multi-column (`columnCount: cols` on the wrapper, each card wrapped in a `breakInside: 'avoid'` div) — images now pack tightly down each column with no dead space, the actual Pinterest-style board it was meant to be. Verified with a synthetic mixed-height overlay in the preview (not real board data — adding real mood images triggers an AI vision tag call, skipped to keep this a zero-cost CSS change). Not yet seen by Farah on her real board — flag for next session.

**Discover "via alreadyrecommended" bug (`task_a16d44ef`, logged s109) — root cause confirmed + fixed.** The working theory from s109 held up: `recommend-feeds.ts`'s prompt dumps up to 150 titles (`seenDiscoverTitles`, capped in `usePrefs.ts`) under a shouty `ALREADY RECOMMENDED IN PAST SESSIONS` header, and the model would sometimes start narrating its own filtering into the "why"/"sources" fields instead of silently excluding matches — and that leaked text rendered verbatim in the UI (`DiscoverScreen.tsx:546`, zero validation on `sources`). Three-layer fix, all in `api/recommend-feeds.ts`: (1) cap what actually reaches the prompt to the last 40 titles instead of all 150 — less bulk to trigger the leak; (2) added an explicit instruction after both exclusion lists to never mention/quote/explain the filtering in the output; (3) hard backstop — `sources` is now validated server-side against the real feed names actually queried (+ the two known fallback labels), so a fabricated label can never reach the UI even if the model still narrates sometimes. Typecheck + full test suite clean (118 passing). Not live-tested (would cost a real Anthropic call against a real taste profile, and the bug was intermittent/hard to force) — watch for it next real Discover session. Stale `spawn_task` chip (`task_a16d44ef`) couldn't be withdrawn via tool (predates this session) — dismiss manually if still showing.

Committed `688f07c` (masonry) + `0b22e96` (discover fix), pushed to `main`, live.

---

### Session 111 (2026-07-08) — fill-from-wikipedia consolidation, kill nag counts. Free, no new API calls.

**Farah's ask: "media fill data functions are super disjointed... streamline. Separately, de-emphasize data completion — I get obsessive about filling everything in, don't want it to feel like homework."** Explore agent + manual read turned up **three separate "fill from wikipedia" tools** that had grown independently: `GapsSheet.tsx`'s wiki-link-only fill (`/api/wiki` search), the Library overflow menu's "fill from wikipedia · N" (`lib/regions.ts` `pullFacts` — browser-direct to Wikipedia/Wikidata, deliberately bypassing our server to dodge shared-IP rate-limiting, per its own code comment) pulling creator/year/runtime/pages/region, and `ItemActionSheet.tsx`'s per-item "auto-fill from wikipedia" (`/api/wiki?parse=1`) — the best-built of the three, one button, clear result line, AI fallback. Getting full coverage meant running two of the three batch tools separately.

**Root cause of "213 never clears":** `itemsNeedingFacts()` counted an item as pending if it lacked a **region** (country) — but region had no dismiss path, unlike every other gap (year/creator/genre/runtime, all dismissable via `dismissedGaps`). Any item whose Wikidata entry simply doesn't list a country (common for obscure books/albums) sat in the queue forever — not a lookup bug, a counting bug.

**Fix — merge, then de-emphasize:**
- `regions.ts`'s `articleResolve`/`resolveFacts`/`pullFacts` now also capture the wiki link + thumbnail + summary in the same Wikipedia query used for the Wikidata facts pull — one pass fills everything the three old tools did between them.
- Deleted `GapsSheet.tsx`'s standalone wiki-only tool (`needsWiki`/`runWiki`) and the now-dead `fetchWikiInfo` export from `lib/wikipedia.ts`.
- `itemsNeedingFacts()` now also tracks the wiki-link gap (respecting dismiss), so it's one "what's missing" definition instead of two that quietly disagreed.
- **Farah chose "kill the raw counts"** (over moving tidy out of the header, or shrinking what counts as a gap) when asked how to de-emphasize completion. Dropped "N missing"/"N items" everywhere in the tidy/fill UI — `genres — 61 missing` → `genres`, `fill from wikipedia · 213` → `fill from wikipedia`, `tidy · N` → `tidy`, the "74 items" DATA GAPS header gone entirely. Kept the `$` cost estimate before an AI spend (real-money transparency, required by `CLAUDE.md`) and the live `X/Y…` progress counters while a batch actually runs (functional, not a nag). Region no longer needs a dismiss mechanism — it just isn't counted as a number anymore, fills silently in the background.

**Verification:** typecheck + lint + all 118 tests clean via the pre-commit hook. Could **not** visually click through the real gap-fill flow — the local preview account's library is empty, no seed data with real gaps to exercise. Farah tested live on her own account after push: **"fill is much better now."**

Committed `314e90f` (the fix) + `165fb19` (docs — see below), pushed to `main`, live.

**Also this session (unrelated, docs-only): logged a new bug.** Farah flagged the Things mood board isn't laying out as masonry — images sit in a fixed CSS grid (`MoodWall`, `ThingsScreen.tsx:2496`, plain `display: grid` with fixed columns) instead of flowing Pinterest-style columns, so a short image leaves a gap under it instead of the next image sliding up. Farah confirmed it used to work and broke in an earlier session — **not bisected or fixed this session**, just logged to `docs/ROADMAP.md` → Things board polish for a later pass.

Saved a standing memory (`nospaces-deemphasize-completion`) so "no raw N-missing counts in tidy UI" doesn't have to be re-decided next time this pattern comes up elsewhere in the app.

---

### Session 110 (2026-07-08) — add-confirm sheet: real restructure, not another restyle. Free, frontend only.

**Farah's ask, after looking at the s109 restyle: "looks largely the same, not any less form-like... think about a broader restructure."** She was right — s109's pass was cosmetic (type chips moved behind "edit details," the owned checkbox became a pill) but the bones were untouched. Diagnosed why it still read as a form: every single-choice group in `ConfirmSheet.tsx` was its own individually-outlined/colored chip-row (the want-to/already-did toggle, the reaction grid, the type selector), plus a standalone confidence badge, plus an always-visible search+re-run row up top — a stack of bordered bricks, not a page. It also never adopted `SheetHero`, the shared editorial header (ghost cover-art wash + big title + uppercase meta line) that the Discover-pick and Library-item detail sheets already use — it still had its own small bordered thumbnail + plain gray meta line predating that component.

**Restructure, reusing existing patterns rather than inventing new ones:**
- Header swapped for `SheetHero` — same ghost-wash/poster/title language as Discover/Library.
- Confidence badge removed — the "did you mean?" list already signals uncertainty when the AI wasn't sure; a separate "double-check" pill was redundant system chatter.
- Every single-choice row (type, want-to/already-did, reaction) converted to the **segmented-control** language from `ReactionForm.tsx` (the pattern the mark-as-done sheet already landed on after its own "too bordered → too airy → tokens-with-structure" iteration, memory `farah-ui-taste-structure`) — one outer border, soft cream fill on the active segment, no per-item borders/colors.
- Search/re-run demoted behind a quiet "search again" text link instead of a form row shown by default — most saves are confirming a right guess, not fixing one.
- Exported `REACTION_ORDER`/`REACTION_LABELS` from `ReactionForm.tsx` so `ConfirmSheet` reuses the same source of truth for the reaction scale instead of a second copy.

**Two live-feedback fixes folded into the same pass:** "want to"/"already did" were capitalized, out of step with the rest of the app's lowercase labels — fixed. The "already own it"/"already on my shelf" pill sat alone on its own row, "hanging in an odd place" — folded onto the same line as the want-to/already-did control (it's a modifier on "want to," not its own decision) and shortened to "own it" for the book case so it fits without crowding.

**Verification:** typecheck/lint/118 tests clean. This local environment has no real backend (`/api/describe`/`/api/identify` 404 — confirmed via console), so the normal add flow can't reach the confirm sheet here; used the existing iOS-Shortcut deep-link path instead (`MediaComposer.tsx` reads `title`/`creator`/`type`/`year`/`confidence` straight from URL params with no network call) to open `ConfirmSheet` directly and exercise every state: edit/search toggles, all three segmented controls (including reaction deselect-on-reclick), the owned pill's active fill, both the book and non-book owned-label variants. Farah then tested live on her own account/phone and confirmed: "looks a lot better."

Committed `6006ed3` (one commit, the full restructure + both live-feedback fixes), pushed to `main`, live.

**Not touched, flagged as a follow-up:** `BulkConfirmSheet.tsx` (the multi-photo variant) still has the old bordered-chip look — it'll now read inconsistently next to the restyled single-item sheet. Not in scope this session; worth a pass next time that flow is touched.

---

### Session 109 (2026-07-08) — taste-prompt tone pass, mood-board vision split, add-flow bug hunt. $0 in test API calls (no real Anthropic test calls made — verified via curl/network logs, not live generations).

**Taste prompts — concise + factual, root-caused the navel-gazing instead of banning phrases.** Farah's ask: both taste reads (`api/taste-profile.ts` media, `api/things-taste.ts` things) were long-winded and read as character-flattery ("...and you know the difference") and personified abstraction ("a confidence in restraint here"). Banning the exact phrases would've been whack-a-mole, so instead added a shared `NO_FLATTERY` guardrail in `api/_humanizer.ts` — two named failure modes, each with a self-check test the model runs on every sentence ("does the sentence assign a virtue to the person/object, not describe a visible fact?"), not a word blocklist. Media profile cut 2 paragraphs → 1. Round 2 (real output still slipped one flattery instance — "there's a quiet confidence in how much fabric you're willing to let sit on you") tightened the test further: partial-credit flattery (a real fact buried inside a psychology-frame) now fails too, and "confidence" specifically got called out as a repeat offender. Round 3 (still-mechanical tone: "The board reads like someone building a wardrobe that doesn't announce itself") found the actual bug — the prompt's own JSON-format example said `"the 1–2 sentence read"` while the instruction above it said "1 sentence," a real contradiction the model was resolving in the model's favor. Fixed the contradiction + added an explicit no-third-person-pivot rule. Also fixed a structural repetition bug: the things-taste synthesis kept echoing the exact 3 words already shown in the page's own kicker headline (both draw from the same underlying counts) — now hard-bans reusing those literal words and points the model at deeper (rank 2+) facet values. **"The gap" section removed** from the media taste page (`TasteScreen.tsx`) — Farah: wasn't insightful, always said the same unremarkable thing. Fully deleted (not hidden) since `noUnusedLocals` would've broken the build on dead code; recoverable from git history if it gets more interesting later with more data.

**Does the moodboard actually feed the read? Yes, but badly.** Confirmed in code the mood-board images were already included in the taste synthesis (same `boardTasteSummary` as wishlist products) — but investigating *why* it didn't feel that way turned up a real bug: every image, product or mood, went through the exact same vision-tagging prompt (`api/_vision.ts`), and it was written entirely around product photos ("look at this product image," garment-cut vibe words, a closed clothing/home/beauty category, a packshot/onModel/lifestyle shot classification). A mood image isn't necessarily a product at all. Added `INSPIRATION_PROMPT` — reads for atmosphere/register instead of garment cut, drops category + shotType (neither is used on inspiration items). `readImageAttributes` now takes a `kind` param. Also found and fixed: `MoodSheet`'s re-read button only showed for *untagged* images (recovery-only), so an already-tagged image had no way to pick up the new prompt — now always shows, labeled "read" vs "re-read." Added a visible wishlist/mood split to the taste-tab caption (`N wishlist + M mood`) so it's now visible at a glance whether mood has enough weight to move the read, instead of a guess.

**Things UI nits, iterated live with Farah.** Mood-board grid: tried "match the product cards" (full-bleed cropped tile + caption) → corrected to "no crop, just no border" (natural aspect, no `Thumb`-style forced 4:5) → corrected again to "remove the caption text, it breaks the gallery look" (Farah didn't want captions at all — final state: pure image wall, uniform columns instead of the old masonry algorithm, 4px gap). Mood-image detail sheet: tapping the photo now opens its source link directly (small corner ↗ badge, not a separate "source" text row); the photo now bleeds to the sheet's edges (same negative-margin trick `ProductSheet`'s hero already used) instead of sitting in a bordered, rounded inset card. Style profile: moved off a standalone page link, behind a new filters icon (reused the wishlist's existing sliders glyph) → small popover menu → the same editor sheet as before.

**"On my shelf" at the point of adding.** New checkbox on the media add-confirm step (`ConfirmSheet.tsx`) — "already on my shelf" for books, "already own it" otherwise, matching the existing post-add `⋯`-menu wording — saves `metadata.owned: true` in the same call instead of needing a second trip through the menu. **Confirmed working live** (Farah screenshotted it firing correctly).

**Add-flow bug hunt — two real bugs, not just confusing labels.** Farah flagged the confirm sheet's two escape hatches ("not the right one? look it up online" / "none of these — use exactly what I typed") as unclear and "don't actually work," and asked to dig into *why* before just relabeling. Root-caused both: (1) `loadMore()`'s catalog re-search hit `/api/lookup`, whose relevance scorer (`api/lookup.ts`) counted *any* shared word — including stopwords like "the" — as a partial match. Verified live against the production endpoint with her real query ("the memory police"): it returned 8 results, 5 of them garbage (The Police, Panic! At the Disco x2, The Complete Sherlock Holmes) purely because they share the word "the." Fixed at the root: stopwords excluded from token overlap, zero-relevance candidates dropped instead of ranked-last — same live query now returns 3 clean results. Regression tests added (`src/lib/catalogRank.test.ts`). (2) "use exactly what I typed" wiped type/creator/year back to blank/'other' instead of just fixing the title. Once both were understood, the fix was deletion, not addition — the sheet already had a non-destructive "edit details" toggle doing the same job; removed 107 lines, added nothing new. Follow-up nit: restyled the whole sheet onto the shared editorial palette (`INK`/`GRAPHITE`/`MUTE`/`HAIR`, matching `MediaComposer`/taste/library) — it was the one card still on its own raw hex grays. Second nit ("still looks form-y"): moved the always-visible type-chip row behind "edit details" (duplicated the meta line, biggest single contributor to the form feel) and replaced the "already own it" native checkbox with a pill toggle matching the sheet's other chips.

**Discover — "further afield" stuck-loading fix.** No client-side timeout on the `/api/recommend-feeds` fetch; the server caps at 60s (`maxDuration`), so a hung connection or slow generation left the spinner stuck forever with no recovery but a reload. Added a 70s client-side `AbortController` timeout with a real "took too long — try again" error message.

**Not fixed — flagged for next session (`spawn_task` chip, `task_a16d44ef`):** Farah reported Discover recommendations occasionally show corrupted output — "why" text narrating the model's own dedup-checking ("Already recommended but—wait, this IS already recommended. Skipping.") and fabricated source labels ("via alreadyrecommended"). Working theory written up in the task: the `sources` field renders verbatim with zero validation (`DiscoverScreen.tsx:546`), and the leaked strings closely match the prompt's own `ALREADY RECOMMENDED IN PAST SESSIONS` section header — likely the ~150-title exclusion list (`seenDiscoverTitles`, capped in `usePrefs.ts`) is dominating the prompt and the model starts narrating its filtering bookkeeping instead of silently doing it. Not reproduced or fixed this session — Farah asked to save it for next time.

**Verification note:** almost everything above was **live-checked with Farah mid-session** except the very last round (ConfirmSheet destyle/declutter + the Discover timeout fix) — those went in at the end and haven't been seen live yet. The local no-auth preview environment has no real backend (confirmed via network logs — `placeholder.supabase.co`, `/api/describe` 404s), so nothing requiring the AI pipeline or real data could be verified there; every real check this session happened on Farah's live account via screenshots.

Committed across 10 commits (`5a7790f` → `1b72c98`), all pushed to `main`, all live.

---

### Session 108, continued — Library header scroll jank, fixed + confirmed live. Free, frontend only.

**Farah, last nit of the session: "library scroll header disappearing is still jumpy on mobile (things isn't)."** Diffed the two: `LibraryScreen.tsx`'s header used a scroll listener (`onListScroll`) calling `setCollapsed` on every scroll event, toggling `max-height`/`opacity`/`margin` on the title block via a CSS transition — a React re-render plus an animated layout property fighting the browser's native scroll compositing, on every single scroll tick. `ThingsScreen.tsx`'s own code comment already documented hitting and fixing this exact problem: "no JS height animation — that was the jumpy part," solved by letting the title scroll away naturally in normal flow and keeping only a `position: sticky` control bar pinned.

Applied the identical fix to Library: removed the `collapsed` state and the JS-driven animation entirely; the title/subline/rule/search block now lives in normal scroll flow inside the same scroller as the list (scrolls away for free, no JS involved); the category/status/filter row became its own `position: sticky` div, no longer wrapped with the title. `onListScroll` now only tracks `lastScrollRef` for the existing background/hide scroll-persistence feature — the collapse logic is gone.

Verified structurally before shipping (per the `verify-css-with-repro` standing rule — this environment can't reproduce real iOS jank): typecheck/lint/tests clean; injected filler rows into the live (empty) dev library to scroll it, confirmed the sticky row pins with zero gap while the title scrolls away, confirmed search still opens correctly now that it lives in the scrolling block rather than the old collapsing one. Farah confirmed live on her phone: **"better now."**

Committed `fb3af7a` (code) + `fd1ce66` (docs), pushed to `main`, live.

---

### Session 108 (2026-07-07) — desert-island read-sheet grid fix + Things category vocabulary closed. Free.

**Desert-island line broke the read-sheet's label-column grid.** The read sheet's other rows (vibe, verdict) use a label-column layout (icon/word in a fixed-width label slot, content alongside); the desert-island line sat flush-left instead, breaking the grid. Fixed to match: ★ in the label slot, "desert island" in the content slot.

**Things categories were an open-ended free-text field — closed it to a fixed list (decided with Farah).** New closed vocabulary: clothing (outerwear, dresses & jumpsuits, bottoms, tops, shoes, bags, jewelry), home (furniture, lighting, decor, kitchenware, appliances), beauty (skincare, makeup, fragrance), + other. Root cause of the sprawl: the vision prompt told the model category was "not limited to the list," so it kept inventing new ones. Fixed in three places: the vision prompt (now a strict enum), the tag-editor UI (grouped pick-one chips, no free text), and a synonym map that folds old sprawled values (fabric/material sample/coat/bag/etc.) onto the new list at read time — no backend migration needed, existing items just resolve through the map. Farah's now planning to start saving home + beauty items now that real categories exist for them.

---

### Session 108, continued — nav reconciliation (closes the s106 item) + a header restyle nit. Free, frontend only.

**The problem (Farah, s106).** Navigation was split across two idioms: the bottom bar carried the primary nav (domain switcher + library/taste/discover or wishlist/taste), while the taste screens' sub-view switcher — profile ↔ desert island (media) and profile ↔ moodboard (things) — sat in a top tab strip under the page header. Farah clarified the actual complaint mid-session: sticky inline headers (Library/Things category rows) are fine, don't touch those — the confusion is specifically "navigation between taste pages at the top, navigation for everything else at the bottom."

**Research first.** Traced both sides: `TasteScreen.tsx` has a `TabChip` row (profile/desert-island) gated on `hasIsland`, directly under `PageHeader`, while `BottomNav.tsx` renders fixed-bottom, outside the route tree, in `App.tsx`. Things has the *identical* pattern — `ThingsScreen.tsx`'s `tab === 'taste'` view has its own `TabChip` row (profile/moodboard), and `ThingsNav` (also in `ThingsScreen.tsx`) is Things' equivalent bottom bar. So it was one problem in two places, not two problems — fixing it once covers both domains.

**Mocked 3 placements before writing code** (artifact, phone-frame mockups + a crowding stress-test toggling media/things): (A) a thin, contextual second row directly above the bottom nav, only on the taste screens; (B) fold the sub-choice inline into the existing "taste" link, no new row; (C) flatten desert-island/moodboard into peer bottom-nav destinations. Farah picked A. Then asked a follow-up — should the whole bottom-nav zone get a distinct tint from the page, generally? Mocked that too (toggle-able swatch in the same artifact) — recommended yes, kept deliberately subtle (`#F7F5F0`) so it reads as "this strip is chrome" without turning app-like.

**Build.** The two domains needed different plumbing since `BottomNav` renders outside `TasteScreen`'s component tree (global, in `App.tsx`) while `ThingsNav` is defined in the same file as its taste tabs:
- New `src/lib/subNav.tsx` — a small `SubNavProvider`/`useSetSubNav`/`useSubNavContent` context, wrapping `App.tsx`. `TasteScreen` calls `useSetSubNav(hasIsland ? <tabs> : null)` to hand its row up; `BottomNav` reads it via context and renders it as a row above the main one, only when non-null.
- `ThingsNav` just took `subNav?: ReactNode` as a normal prop — no context needed, same file.
- `src/lib/layout.ts` gained `SUBNAV_H` (32px) and `NAV_TINT` (`#F7F5F0`), the shared geometry/color both nav components and their host screens key off of, so FAB position and content bottom-padding stay correct when the sub-row is or isn't showing (media: `TasteScreen`'s container padding + `BottomNav`'s FAB; things: the scroller's padding + the FAB, which only needs the extra clearance when `onMoodboard` is true since the FAB is hidden on the profile sub-tab).
- Caught a real bug before shipping: the first draft called `useSetSubNav` *after* `TasteScreen`'s two early `return`s (loading / locked-preview states) — a Rules-of-Hooks violation (conditional hook-call order across renders). Moved it above both early returns, next to where `hasIsland` is computed.

**Same-session nit (Farah): "add a cooler, more design-y header — library / things etc."** Rather than build blind, mocked 3 header directions in the same artifact (toggle-able library/things): (1) a tight, negative-letter-spacing lockup with a normal-spaced caption underneath — the tension is the trick, and it's a quiet nod to the app's own name (nospaces — no space between the letters either); (2) a serif italic masthead with an uppercase eyebrow + rule, magazine-section-opener style; (3) a giant faint outlined item-count numeral behind the headline (real data, not decoration). Recommended (1) — ties to the app's identity, cheapest to build, no new font or data dependency. Farah picked it. Applied to the shared `PageHeader.tsx` (used by Taste + Discover) and the bespoke inline headers in `LibraryScreen.tsx` + `ThingsScreen.tsx` (30px, weight 800, `letter-spacing: -0.04em`). Side effect worth noting: `PageHeader`'s kicker used to sit *above* the title (a classic eyebrow); flipped it to sit *below*, matching Library/Things' existing title-then-subline convention exactly (their own code comment already said they were built to match each other) — so all four headers (library/things/taste/discover) now share one pattern, not two.

**Verification.** Typecheck, lint, and the full Vitest suite (116 tests) all clean. Live-checked in the browser: Library, Things (wishlist/profile/moodboard, real data — no auth needed on the noauth dev server), and Discover all rendered correctly, including the moodboard sub-row + FAB clearing it properly. Media's `/taste` sub-row couldn't be exercised with real data — Farah's actual account has no rated items yet on this dev environment, and seeding fake data into the real Supabase project wasn't going to happen for a UI check — so instead cloned the live rendered `BottomNav` DOM and applied the exact same CSS as a temporary, clearly-scoped visual check (not a data-driven test) to confirm real-font pixel geometry matched the mockup. No console errors introduced (the `[captures] fetch failed` noise in the dev console is pre-existing/unrelated — Things' email-capture polling failing in the noauth environment, nothing to do with this change).

Committed `621aeb7`, pushed to `main`, live.

---

### Session 107, continued — PWA login-loop glitch (not our bug) + a "no extraneous line" tags fix. Free.

**PWA login loop, diagnosed not fixed (fix was on Farah's end).** Farah: opening "things" on her installed PWA bounced to login; logging in landed on media (not things); tapping things again looped back to login. Delegated to an agent to rule in/out today's ThingsScreen/Sheet changes before guessing. Confirmed via `git log` that none of the day's commits touch `App.tsx`, `useAuth.tsx`, `supabase.ts`, or the service worker (`src/sw.ts`) — and `App.tsx`'s auth check gates every route identically, no things-specific branch. **Best-fit theory: a stale service-worker cache from three same-session deploys** — the installed PWA kept running an old JS bundle until reloaded, which lost track of the session and bounced to login; logging back in did a real reload onto fresh code but at the default route (media), not back to things. **Fix was force-quit + reopen the PWA** (flushes the stale worker) — Farah confirmed this worked. Not a code change, not logged as a bug fix; noting here so a repeat after a future multi-deploy session isn't re-investigated from scratch.

**Tags toggle was adding lines it shouldn't (Farah, s107 v4).** The v3 "tags ›" toggle (previous log entry) put itself on its own line even collapsed, then a second line when opened — Farah: "as part of the north star of the app, not to have extraneous text." Folded the toggle directly into the existing credit line (price · brand · "· tags") instead of giving it a line of its own — collapsed now costs **zero** extra lines, expanded costs exactly **one** (the tag list, same as before). Verified in a throwaway repro (three cases: short brand, long-brand-plus-got-it worst-case wrap, expanded) before shipping — collapsed sits cleanly on the credit line, expanded adds just the one line; a long brand name can still wrap the credit line onto two lines, but that's pre-existing `flexWrap` behavior, not something new.

Green gate clean (tsc + api tsc + eslint + 116 tests). Not yet re-verified live.

**Closing discussion, same session — tags-as-third-tab, declined.** Farah asked for an opinion: should tags become a third tab alongside "your note" / "how it fits," instead of the credit-line toggle above? Recommended against it — tags are short, scannable facets, while the two existing tabs are both prose you actually read; folding tags into that tab set trades a quick glance for an extra tap, the opposite direction from the north-star ask this session. Flagged that if the real itch is discoverability (a quiet "· tags" is easy to miss), that's a smaller, separate fix (a dot/count, more visual weight) rather than a structural move. Farah agreed to leave it alone — **no change made, not a rejected-but-parked idea, just genuinely settled for now.**

Session ended here — Farah asked to log everything and start fresh next time.

---

### Session 107 (2026-07-07) — three of the five s106 nits shipped. All free frontend.

Farah confirmed both s106 live-unverified items first: the Things review **discard** works, and the taste-read **anti-hallucination fix** "seems better." (10k Postmark plan not bought yet — carry.)

Then built three of the five nits logged at the end of s106 (all in `ThingsScreen.tsx`, `ProductSheet`):

1. **Product detail sheet — collapse-on-scroll hero.** Kept Farah's ask literally: don't shrink the photo at rest (still opens at `min(500px, 55dvh)`), but once you scroll into the read the hero animates down to `min(200px, 26dvh)` (`max-height` transition, 0.28s), freeing the room the read needed. A shared `onBodyScroll` handler (40px-in / 8px-out hysteresis, so it doesn't flicker) is wired through both scroll paths — `ReflectionBlock`'s tab body and the plain-note fallback for untagged items.
2. **Grid density toggle on the Things board.** Media's fixed 3/4 toggle doesn't map cleanly since Things' column count already auto-scales by device width (`COL_TARGET`) — so instead of a fixed number, added a **roomy / cozy** segmented row (`FilterSheet`, next to captions) that's a *relative* adjustment: cozy = today's auto-fit unchanged, roomy = one fewer column than auto (min 2), persisted to `localStorage` (`nospaces.thingsColsMode`).
3. **"Add to a plan" on an existing standalone card.** New `⋯` menu item (shown when the product isn't already `fromPlan` and isn't `got`) opens an inline picker — existing-plan chips or a new-plan name field, mirroring `ProductComposer`'s picker. On confirm: builds a `Candidate` from the product's own fields (`productMeta`), attaches it to the target intent's `candidates[]` (or creates a new intent), then deletes the standalone copy — so an emailed-in item can join a plan without a duplicate library entry. Reuses the exact `saveComposedProduct` shape, just sourced from an existing item instead of the composer's fresh fields.

**NOT built — held for a decision with Farah:** the 4th nit, **closed category list** (`api/_vision.ts:20`) — needs the actual category list decided with her first (see roadmap), not a blind build.

**Green gate:** tsc + api tsc + eslint (max-warnings 0) + 116 tests, all clean. Pushed `beb6f7c`.

**Live feedback, same session:** (3) add-to-plan worked. (1) and (2) didn't:
- **Collapse-on-scroll hero was jumpy on laptop, stuck on mobile.** Root cause: animating the hero's `max-height` on scroll fights the scroll container's own layout — as the hero shrinks, the scroller's content height changes mid-scroll, so the browser's scroll position recalculates under the user's finger (worst on iOS touch-scroll momentum, but visible on trackpad too). **Fix:** dropped collapse-on-scroll entirely. `HERO_MAX` is now a plain static constant, `min(380px, 44dvh)` (down from `min(500px, 55dvh)`) — a smaller cap set once at open, no animation, no scroll listener. Less dramatic than the scroll-shrink idea, but reliable everywhere. All the `onBodyScroll` plumbing (state + prop threading through `ReflectionBlock`/the note fallback) reverted.
- **Density toggle had no visible effect.** The **roomy/cozy** model computed cozy as literally "today's unchanged auto-fit" and roomy as "auto minus 1 column" — on a narrower viewport that delta could floor out at the same column count (both clamp to the same min-2), so the toggle sometimes did nothing. **Fix + a terminology change Farah asked for:** renamed to **roomy/compact** and gave each its own fixed target-px-per-column (`COL_TARGET: { roomy: 220, compact: 155 }`) instead of a relative delta off one auto value — so the two modes are *always* visibly different at any width, not just usually. Also **folded view + density into one combined row** — "list | roomy | compact" — replacing the separate "layout" + "density" rows, mirroring media's existing single-row layout control exactly. **And mirrored the terminology onto the media Library too**: `LibraryScreen.tsx`'s fixed grid-3/grid-4 toggle is now labelled "roomy"/"compact" (same two labels, same underlying 3/4-column values — a pure rename, no behavior change there).

**Verification on the fix-up round:** green gate clean again (tsc + api tsc + eslint + 116 tests). Visually confirmed in the local preview that media's filter sheet now reads "list | roomy | compact" with correct highlighting (screenshotted). **Could not screenshot the Things board's own filter sheet** — its filter button only renders once the board has content, and the local no-auth preview's board is permanently empty (no backend). It reuses the exact same `SegRow` component just verified on media, so the visual result should match, but this is inference, not a direct look — **Farah re-verifies all three (hero cap, roomy/compact toggle actually changing density, and the combined single row) live post-deploy.**

**Second live-feedback round, same session:** the density toggle *still* did nothing on mobile, and the smaller static hero made the photo feel too small.
- **Density toggle: the real mobile bug.** `COL_TARGET.roomy` (220) and `COL_TARGET.compact` (155) computed their column counts **independently** — on a phone-width container (~375px) *both* `Math.floor(375/220)=1` and `Math.floor(375/155)=2` clamp up to the same `Math.max(2, …)` floor, so roomy and compact rendered identically on any narrow screen. The desktop-only fix from the first round never actually got tested at phone widths. **Fix:** stopped computing the two modes independently — `compactCols` is now derived as `Math.max(roomyCols + 1, Math.floor(w / 155))`, i.e. compact is *guaranteed* to be at least one more column than roomy at the current width, whatever that width is. Verified by hand at 375px (roomy 2 → compact 3), 768px (3 → 4), 1200px (5 → 7) — distinct everywhere, not just on wide screens where the old delta happened to clear the floor.
- **Hero photo too small.** The static shrink from the first fix-up (`min(500px,55dvh)` → `min(380px,44dvh)`) went too far the other way — Farah's original ask was "don't shrink the photo," and a permanently-smaller photo violates that just as much as a jumpy one did. **Reverted the photo to its original size** (`min(500px, 55dvh)`, unchanged from before s107). Instead trimmed the *other* fixed-height chrome above the scrolling read a little (title-block top margin 16→11, credit-line/tag-line margins 8→6, the reflection-zone's own top margin 14→10 and tab-row bottom margin 11→9) — a small, animation-free, zero-risk reclaim of space that doesn't touch the photo. **This is a partial answer, not a full fix**: a big photo + a long taste read in a fixed-height sheet will still need scrolling sometimes — that trade-off is now accepted rather than fought. If it still reads as cramped after this, the next move is a design conversation with Farah (e.g. is scrolling actually fine here, or does the read need to move above the photo) rather than a third blind shrink/animate attempt.

Green gate clean again (tsc + api tsc + eslint + 116 tests). Not yet re-verified live — Farah re-checks both after this deploy.

**Third round, same session — density confirmed fixed; cramped sheet still not.** Farah: "toggle works, but the cramped sheet still doesn't." Rather than nudge spacing a third time, actually diagnosed the layout math: the sheet was capped at `88dvh`, the photo ate `55dvh` of that, and another ~150px went to title/tags/tab chrome — leaving roughly 100–150px of *actual* scrollable read room on a typical phone before the first two rounds even touched anything. Both prior attempts were tuning the margins of a fundamentally too-small leftover region, not the region itself. **Proposed the real fix to Farah first this time** (asked via a question rather than guessing blind again): stop pinning the photo+header as a fixed-height flex region with one small internal scroll area, and instead let the **whole sheet scroll as one page** — the photo scrolls with everything else (like Pinterest/most shopping-app product sheets), so the read gets the *entire* remaining screen once you scroll past the photo, not scraps. Farah approved, and added two more asks in the same breath: shrink the title, and make the taste tags opt-in instead of always-shown.

**Built (`ThingsScreen.tsx`, `Sheet.tsx`):**
- **Sheet now scrolls as one page.** `Sheet.tsx`'s `fill` prop (a fixed-height flex column with one internal `overflow:hidden` scroll region) is gone — it had exactly one caller (`ProductSheet`) and no longer serves a purpose; the component now always scrolls the whole card (`maxHeight: 88dvh, overflowY: auto`, dvh not vh everywhere now — safer under iOS Safari's dynamic toolbar). `ProductSheet` dropped every `flexShrink: 0` / internal `overflowY: auto` it had accumulated across the last two rounds (title block, review banner, add-to-plan panel, `ReflectionBlock`'s own scroll region, the note fallback, `PlanReveal`'s wrapper) — all now plain block-flow, all part of the one scroll.
- **Close/⋯ buttons had to move with this** — they used to float absolutely over the photo, which now scrolls away. Re-anchored them to a **zero-height `position: sticky` spacer** placed as the *first* child of the scrolling sheet (before the photo), so its containing block is the whole card, not just the hero — it stays stuck through the entire scroll, photo included, not just while the photo happens to be in view. **This is the third attempt at this exact element, so — instead of shipping blind again — built a standalone HTML repro** (`_repro_sheet.html`, scratch file, deleted after, never committed) reproducing the sheet's exact CSS (padding, negative-margin photo bleed, sticky spacer, long filler text) and screenshotted it at three scroll depths (top / mid-photo / fully scrolled past all the text). Confirmed the buttons sit exactly where they used to (flush with the photo's top-left/top-right corners) and stay pinned there at every scroll depth, with the content correctly scrolling underneath — before touching the real app again.
- **Title shrunk** 23px → 18px (was oversized for a detail sheet sitting next to a full photo).
- **Taste tags are now opt-in.** Used to always render as a line under the credit row; now collapsed behind a small "tags ›" toggle (mirrors `PlanReveal`'s existing "decided from N options ›" expand pattern) — same tag data, same tap-to-filter behavior once expanded, just not imposed on every open. Resets to collapsed each time the sheet reopens (local component state, no persistence needed).

**Why this should actually hold this time, unlike the last two:** no animation (native scroll only — the exact thing that broke round 1), the photo is untouched at full size (the exact thing that broke round 2), and the sticky-button mechanism was verified in an isolated repro before going anywhere near the real app.

Green gate: tsc + api tsc + eslint (max-warnings 0) + 116 tests, all clean. Not yet verified against real board data (still no local backend) — Farah re-checks live: the sheet should now scroll as one continuous page past the photo, the close/⋯ buttons should stay reachable the whole way down, the title should read smaller, and tags should be hidden until you tap "tags ›".

---

### Session 106 (2026-07-07) — four frontend wins + a taste-read anti-hallucination fix + captured 5 s106 nits. All free.

**Late add — taste-read hallucination fix (`f1297bc`, pushed).** Farah spotted the plan-**compare** note calling a STAUD Margi dress "tie-waist" (it isn't) and asserting "poplin is heavy for heat" + "straps slide off (needs tape)" as facts — the model inventing construction/fabric/fit details it can't see from a photo + tags. Root gap: both product-judging endpoints (`things-compare.ts`, `things-taste-fit.ts`) told the model to "judge the real cut" and treat fabric-*feel* as a risk, but neither forbade **inventing a specific construction/fabric/fit detail** and stating it as fact. Fix: new shared `GROUNDING` rule in `api/_humanizer.ts` (one home, can't drift between the two), layered into both prompts — don't assert a construction/fabric/fit specific unless it's visible in the photo or written in the text; frame genuine fit risks as risks to check, not certainties; when unsure, leave it out. **Prompt-only — no new API calls, same Haiku model.** ✅ **VERIFIED (s107): Farah re-ran the taste read — "seems better."**

---

Original four (below):

A quick polish session. Shipped four frontend changes to `main` (each through the full green gate — tsc + api tsc + eslint + 116 tests), verified in the local no-auth preview where data allowed:

1. **Things review-inbox discard** (`3af8ad2`) — the Things `ProductSheet` for-review banner only offered "looks right" / "it's actually media"; a mistakenly-captured thing had no fast bin. Added a **"discard"** action with its own inline confirm (`discard "title"? this can't be undone.`), mirroring the media review-inbox discard flow; reuses the existing `onDelete` (delete + close). ✅ **VERIFIED live (s107): Farah confirmed discard works.**
2. **Media active-tab underline** (`3af8ad2`) — ported the Things board's 1.5px active-category underline to the media library category tabs (was italics-only). Verified live: computed `border-bottom: 1.5px solid rgb(17,17,17)`, italic, 600 — exact match.
3. **Filter-aware library count** (`768af17`) — the header count (`kicker`) counted by **type only**, so "162 books" stayed 162 under a done/want-to/tag filter. Now counts `filtered` (the rendered set, same array as `matchCount`), so it tracks every filter; search → "N results", review → "N to review", singularised at 1. *Behaviour not shown live (empty preview) but strongly guaranteed — it's the grid's own count.*
4. **Things header aligned to Library** (`768af17`) — Things had an uppercase kicker *above* the title; Library has a lowercase count-subline *below* it (the deliberate s84 "collapse"). Matched Things to Library (calmer, more-recent pattern). Verified live: both now read title-first + 12.5px `#ABA69C` lowercase subline.

**Captured but NOT built** (all free frontend, in `docs/ROADMAP.md`): product **detail sheet is cramped** (the hero photo eats up to 55dvh, squeezing the scrolling taste read — Things board polish); **grid-size toggle** on the Things board (media has 3/4, Things auto-sizes — Things board polish); **"add to plan" on an existing card** (so an emailed-in item joins a plan without a duplicate library entry — Things board polish); **header/footer nav reconciliation** (nav split between top header + bottom bar inconsistently — for-discussion, Media library polish); **too many Things categories** (the `category` facet is AI free-text so it sprawls — fabric/material sample/surface material; recommended a **closed list** + normalize map, root cause `api/_vision.ts:20` "not a closed list" — for-discussion, Things board polish). Docs (`546abab`, plus the prunes in `768af17`/`3af8ad2`).

**Not pushed at session end** — four commits sat local pending Farah's go-ahead (pushing = Vercel prod deploy).

### Session 105 (2026-07-07) — root-caused the emailed-screenshot bounce: **inline images were being silently dropped.** Fixed. Free.

Continuation of s104's open bug (a book-cover screenshot "didn't work, got a bounceback"). Farah's Vercel logs settled it: two screenshot emails BOTH logged `[email] deliberate image attachments: 0 []` — the images never reached vision, and the reply she read as a "bounceback" was Nospaces' own "nothing found" reply (a normal 200, no error). Root cause: `classifyEmailImage` never ran because the candidate-image filter in `api/email.ts` **hard-excluded any inline image** (`!isInlineImage`, i.e. ContentID set). iOS Mail / Gmail embed a pasted screenshot **inline** (with a Content-ID), so every emailed screenshot was being binned as "shop decoration" before it could be read. The inline exclusion existed to drop newsletter swatches/pixels/logos — but those are already caught by the **weight** gate (`< 50KB`) and the **count** cap (`> 5`), and forwarding a shop email strips the cid: relationship anyway, so inline-ness was never a reliable decoration signal.

**Fix (pushed `1fb1961`, green gate — tsc + api tsc + eslint + 116 tests):** dropped the `!isInlineImage` condition from the candidate filter (`api/email.ts`) — now keeps any image that's the right type + ≥ 50KB, still capped at 5. Deleted the now-dead `isInlineImage` helper. Also added a **raw-attachment diagnostic log** (`[email] raw attachments: N [{type, name, cid, bytes}]`) before filtering, so a future "why didn't my photo save" is answerable in one glance. **VERIFIED — Farah resent a book-cover screenshot and it saved.**

Also this session: committed + pushed s104 (undo link + hallucination fix) to `main` (`9895392`). Logged three backlog items from Farah's Vercel logs: comptoirdescotonniers.com as a known scraper-hostile shop (its `/dw/image` CDN → graceful 502/422, not a bug); a Things "for review" quick-remove; and copying the Things nav active-link underline to the media nav. The red `url.parse` DeprecationWarning is `node-fetch@2.6.9` pulled in by `@vercel/node` itself — harmless, left alone (Farah's call).

### Session 104 (2026-07-07) — Postmark approved → talkback live; shipped email **undo link** + fixed the email-in **hallucination** bug. No new API calls (prompt-only fix + a free HMAC endpoint).

Postmark approved the account (unblocks talkback + the paid 10k plan). Farah confirmed talkback is now working live — she got a confirmation email. But two real bugs surfaced in the same test, plus she asked for an undo link.

**What she hit:**
1. Emailed a **screenshot of a book cover** → "didn't work," got a bounceback. *Not reproduced from code — needs logs (see below).*
2. Emailed **"Yesteryear" + "Caro Claire Burke"** (a 2025 book) → talkback replied (good) but it saved as **music** with a **hallucinated blurb** ("An album by Irish singer-songwriter…"). Changed type to book in-app, but the fake blurb persisted (it's stored `recommendationBlurb`, shows as "via recommendation").

**Root cause of bug 2:** `EMAIL_PROMPT` in `api/email.ts` told the model to identify "using your own knowledge" and to "write one sentence from your own knowledge" if the email said nothing — which for an unknown 2025 title licenses a *confident* fabrication (wrong medium + invented bio). Because it reported the guess as confident (not `low`), the existing review gate (`review: bulk || confidence==='low'`) let it land live instead of in the review inbox.

**Fixes shipped (all green: tsc + api tsc + eslint max-warnings 0 + 126 tests):**
- **Undo link in talkback.** New `api/_undo.ts` (HMAC-signed capability token: user id + row ids + issued-at, signed with the existing `EMAIL_WEBHOOK_SECRET`, 60-day expiry) + new `api/undo.ts` endpoint. Every "saved" reply now ends with "Wrong save, or changed your mind? Undo it: <link>". **GET renders a confirm page with a POST button; the delete only happens on POST** — so mail-client / scanner link-prefetch can't silently delete (a destructive GET would be dangerous). Delete is scoped to `id IN (…) AND user_id = signed-user`. Threaded inserted ids through all save paths (`captureThing`, `saveScreenshotProduct`, `rescueProductFromEmail`, the media insert, screenshot board saves). Undo on the media reply covers everything that email added (media rows + screenshot products). New unit test `src/lib/undo.test.ts` (10 tests: round-trip, tamper, wrong-secret, expiry, future-skew, garbage).
- **Anti-hallucination prompt fix** (`EMAIL_PROMPT`): added a "DO NOT INVENT" rule — if the model doesn't actually recognize the work, don't guess type/creator/year/genre/plot; set `confidence:"low"`, leave `summary` null, and **never default a bare "Title by Name" to music** (a name is usually an *author* → book). Low-confidence now lands in review, which is the correct home for a guess. Also softened the summary instruction so it only writes from own knowledge when it genuinely knows the work.

**NOT DONE / carried:**
- **Bug 1 (screenshot bounceback) is undiagnosed** — can't confirm from code. Farah (or next session) should check **Vercel logs** for the `/api/email` run: look for `[email] image had nothing identifiable` / `image skipped (unusable)` / `screenshot → board|library`, and **Postmark → Activity** for whether the send was an actual bounce vs the app's "couldn't read the photo" reply. Most likely `classifyEmailImage` returned nothing identifiable off that cover.
- **New env for undo:** `PUBLIC_BASE_URL` is optional (falls back to `https://nospaces.vercel.app`). Set it in Vercel only if the deploy domain changes.
- The one mis-saved "Yesteryear" item still has the stale album blurb — Farah can edit/undo it; the upstream fix stops it recurring.
- **10k Postmark plan:** approval unblocked buying it. Confirm Farah has (talkback ≈ 2 emails/capture now, free plan = 100/mo).

### Session 103 (2026-07-07) — "how it fits" tone retune (pushed, awaiting Farah's live re-read) + s99 confirmed. Prompt-only, no new API calls.

Farah read the s102 "how it fits" output on five real items (kiki slacks, fairuz tee, nautilus bag, staud dress, openwork caftan) and gave sharp tone feedback. Then asked me to critique the reads as the user, which surfaced more. Shipped 7 prompt-only fixes to `buildFitPrompt` in `api/things-taste-fit.ts` on `main` (`aff8108`), 106/106 green gate. Still Haiku, ~0.3¢/item cached once — no cost change.

**What was wrong (all visible in the s102 reads):**
- Every read opened literally **"Squarely your board"** — the model was copying the first words of the anchor example despite a "never reuse" note.
- Bags **narrated the absence of fit** ("without any body considerations to weigh it") — took up space stating something baked in.
- Fit calls too **certain** (Farah: "could read short vs WILL read short") — the model was reading a photo, not seeing it on her.
- **Naming the variable instead of answering it** — the tee: "The key is whether it hits at your natural waist or skims past it" = a dodge, no actual read.
- **"try it on to confirm ___"** closer on 4 of 5 — a formula/tic.
- **Stock phrases** rotated across items: "reads intentional rather than shapeless" (verbatim in 2), "swallow your frame/proportions", "structurally confident".
- A real writing failure: "try it on to confirm **the balance feels balanced**" (tautology).
- **Sentence 1 re-read the tag row** — the tee said "bold, textured cotton, oversized" with `cotton · bold · oversized` displayed right above it.

**The 7 fixes (all in the prompt):** (1) vary the opener every time, never default to "Squarely your board"; (2) bags skip fit *silently* — never narrate its absence; (3) hedge the *certainty* not the call ("likely/should/might", not flat verdicts); (4) **make a call, not a variable** — naming the fit question without answering it is now explicitly a dodge; (5) ban the "try it on to confirm ___" closer, fold uncertainty into the call; (6) name a concrete feature of the *exact* piece + banned the stock-phrase list; (7) sentence 1 can't restate the tags shown above it. Also updated the anchor example to model a hedged call with no trailing caveat. **Aesthetic still leads** — Farah's explicit call (the fit half is the actionable one, but she wants the "yes this is you" validation first).

**NOT yet verified.** Tone only reads true on Farah's real board + profile, and the reads are **cached on `metadata.tasteFit`** — she must tap **"re-read"** on each item post-deploy to regenerate against the new prompt. Deliberately did NOT burn guarded API calls on stand-in data (that was s102's weak spot). Next session: read the fresh output on her phone, tune again if needed, mark confirmed.

**Also:** s99 three-state shelf filter **confirmed working on the real deploy** (Farah) — marked in the s99 entry below.

---

### Session 102 (2026-07-07) — Things "how it fits" now reads body/fit, not just board aesthetic. Shipped on `main`, full green gate.

Farah's ask: make the per-item **"how it fits"** read take the self-ID **style profile** (aesthetic + body guidelines) into account, "similar to the compare analysis." Shipped in one focused pass on `main`, 106/106 Vitest + typecheck (app+api) + lint + genre-sync green.

**Root cause of the gap.** The style profile was *already wired* into `things-taste-fit` (shipped s88, injected via `profilePromptBlock` from `api/_profile.ts`) — but the prompt was framed **aesthetic-only** ("how this sits with the board — AESTHETICALLY… go by aesthetic, NOT category"), so the body notes were handed to the model and then effectively ignored. Compare, by contrast, tells the model to be "your stylist: body-aware… flag where it'll gap, ride up, crease, or miss your proportions." Same profile, opposite job. So this was a **prompt reshape**, not new wiring.

**What changed** (`api/things-taste-fit.ts`, `src/lib/things.ts` `readTasteFit`, `src/screens/ThingsScreen.tsx` call site):
- **Two-part read now:** (1) how it sits with the board aesthetically + (2) how it'll actually fit/flatter *you* — but ONLY where the body notes bear on the item. A bag/ring/object **skips fit entirely** and never invents a fit note (mirrors the `profilePromptBlock` "a shoe can't gap at the waist" rule).
- **Feeds the photo (vision).** Was text-only (taste tags). Now fetches the saved product photo server-side via `fetchImageBase64` (`api/_vision.ts`, same browser-spoof/SSRF-guarded path as compare) and attaches it, so it judges the real cut/silhouette. `readTasteFit` + the ProductSheet call site now pass `image` + `url`.
- **Extracted `buildFitPrompt`** (exported from `things-taste-fit.ts`) so the prompt has one home and can be exercised in a test without standing up auth/rate-limit. Added `export const config = { maxDuration: 30 }` for the fetch+vision latency.
- **Cost:** ~**0.3¢/item**, cached once on `metadata.tasteFit` (was ~0.1¢ text-only). Still Haiku, still explicit-tap only.

**Verification — 5 guarded live calls** (deliberately over the 2–3 soft cap; spent the extra to *show* the length fix rather than claim it; ~1.5¢ total). Used stand-in Wikimedia photos (flared trousers on a body / Kelly-style leather bag) + a sample petite-long-torso profile. First 2 calls proved **both behaviors correct** — trousers got a real fit read (flagged the **rise** as decisive, per the "high-waist flatters / low-rise shortens legs" note, judged the flare from the photo); the bag correctly said *"a bag doesn't touch your proportions"* and stayed aesthetic. BUT both ran long (62–70 words, 3 sentences) vs. the intended ~2. Tightened the prompt (EXACTLY-2-sentences rule + a length/shape exemplar labeled "never reuse these words" + "LEAD WITH YOUR READ, don't describe the item back" + fold any caveat into the fit sentence) and dropped `max_tokens` 320→160 as a backstop. Re-confirmed (calls 3–5): **trousers 37 words / bag 42 words, 2 sentences, leads with the verdict, bag still skips fit.** Down ~40%.

**⚠️ Not yet checked on the real deploy** — the guarded tests used stand-in photos + a sample profile, not Farah's real saved item + her actual `styleProfile`. Next-session item: on the deploy, open one clothing item vs. one bag with her profile filled in, tap "how it fits", confirm the fit note reads right on her phone (and that the profile is actually authored — the read only speaks to fit if `user_prefs.styleProfile` has body notes in it). No ROADMAP item to prune — this was an ad-hoc request, not a backlogged one.

### Session 101 (2026-07-06) — dependency / Dependabot cleanup (the whole queued pass). Free, no Anthropic calls.

Cleared all 6 remaining Dependabot PRs + tuned Dependabot + triaged the audit, in one dedicated session as Farah asked. Everything applied **directly on `main`** (not by merging the PRs — their lockfile edits conflict with each other), full green gate each commit (106/106 Vitest + typecheck app+api + lint + genre-sync + build), CI green on `main`, all 6 PRs closed, 0 open.

**Approach note:** did the bumps locally rather than merging Dependabot's branches one-by-one because each PR rewrites `package-lock.json` and they'd conflict serially. Local = one coherent set of commits, then closed each PR pointing at the commit that carried its bump.

**1. CI action bumps + Dependabot batching (commit 170a2fd, PRs #8 #10).** `actions/checkout` 4→7, `actions/setup-node` 4→6 in `.github/workflows/ci.yml`. Rewrote `.github/dependabot.yml`: weekly→**monthly**; added a **`major-updates` group** so breaking majors batch *separately* from the safe minor/patch group (the PR #17 lesson — one bad major shouldn't block the safe batch); grouped **all GitHub Actions** bumps into one PR. Should turn the weekly 7-PR flood into ~2–3 PRs once a month. **Immediately proved out:** Dependabot re-ran under the new config and opened **one** grouped PR (#18, `major-updates`) batching all 9 majors — react 18→19, react-dom, @types/react, react-router-dom 6→7, @vitejs/plugin-react 4→6, vite 5→8, vitest 2→4, vite-plugin-pwa 0.20→1.3. **Left open on purpose** — it's the standing "parked majors" bucket (these are the deliberate feature-risk upgrades, each its own session); not noise, don't bulk-merge. Dependabot recreates this PR as new majors land, so reference it as "the major-updates group PR," not by a fixed number.

**2. ESLint 8→10 flat-config migration (commit 4e49697, PRs #12 #13 #15).** The big one — ESLint 9 dropped `.eslintrc`. Bumped eslint 8→10, `@typescript-eslint/*` 7→8, `eslint-plugin-react-hooks` 4→7, `eslint-plugin-react-refresh` 0.4→0.5 (the s100 group's dropped member, now unblocked); added `@eslint/js` + `globals`. Rewrote `.eslintrc.cjs` → `eslint.config.js` (flat). Dropped the removed `--ext` lint flag (scope now comes from config `files`). **Lockfile gotcha:** incremental `npm install` kept erroring on a stale peer-dep pin (old `@typescript-eslint` 7 pinned eslint ^8); fix was `rm -rf node_modules package-lock.json && npm install` for a clean re-resolve. **Judgment call on react-hooks v7:** its recommended set now ships the React-Compiler-era rules (`set-state-in-effect`, `immutability`, `purity`, `static-components`, `preserve-manual-memoization`) which flag **36 existing call sites**. Kept only the two classic rules the old config enforced (`rules-of-hooks` error + `exhaustive-deps` warn) so this stayed a dep bump, not a code sweep — adopting the new rules is a separate opt-in (now a roadmap item). Also added `no-unused-expressions: {allowShortCircuit, allowTernary}` because tseslint v8 added that rule to recommended and our `cond ? a() : b()` side-effect idiom (8 sites) is intentional; and scoped lint back to `.ts/.tsx` only (flat config lints `.js/.mjs` by default, which newly flagged `scripts/check-genres.mjs` — never linted before).

**3. TypeScript 5.9→6.0 (commit 9c6ca41, PR #14).** Major. Only breakage: TS 6 deprecates `baseUrl` (removed in TS 7). It existed solely to anchor an `@/*` path alias that is **completely unused** (0 imports, no matching Vite alias — would've broken at runtime if anyone used it), so deleted `baseUrl` + the dead `paths` entry instead of silencing with `ignoreDeprecations`. Clean.

**4. npm audit — triaged, deliberately left as-is.** 18 vulns (10 moderate / 7 high / 1 critical). **Every single one is in dev/build-time tooling** — the `@vercel/node` transitive cluster (Vercel's own build-utils: ajv, undici, path-to-regexp, minimatch, a stray `next`, js-yaml, smol-toml, postcss) and the `vite`/`esbuild`/`vitest`/`vite-plugin-pwa` dev chain. **Zero touch the runtime `dependencies`** that ship to users (react, supabase, anthropic-sdk, sentry, sharp) — nothing bundled into the PWA. The critical is `vitest` (test runner). `npm audit fix` (non-force) is a **no-op** — all fixes are breaking: either downgrade `@vercel/node` 5→4 (*backwards*) or `vite` 5→8 / `vitest` 2→3 majors. Not worth it in a maintenance pass; left untouched, logged the two future levers as roadmap items.

**5. Node pinning (commit ba25d3b).** Health-survey follow-up. Nothing pinned the Node version — no `.nvmrc`, no `engines` field, no `vercel.json` Node pin — so laptop (24), CI (hardcoded 24), and Vercel (its own unpinned default) had drifted-but-been-fine. Added `.nvmrc` = `24` to match CI (zero-risk, local-only). **Deliberately did NOT add `engines.node`** — that field *also* drives Vercel's build-Node selection, so pinning it could break deploys if Vercel doesn't offer that exact version; left for a pass that first checks Vercel's supported list (or set it in the Vercel dashboard). Runtime majors (`react` 18→19, `react-router-dom` 6→7, `@vitejs/plugin-react` 4→6) are the only other outdated deps — deliberate feature-risk upgrades, each its own session, out of scope for maintenance.

**Verified my own config changes landed valid:** the "Dependabot Updates" GitHub check passed on the `dependabot.yml` rewrite (grouping is syntactically valid, not just committed), and the CI workflow went green on `main` with the bumped actions + new toolchain.

### Session 100 (2026-07-06) — email-junk bug fix + Dependabot triage. Free, no Anthropic calls (the fix *removes* wasted vision spend).

Two operational issues Farah hit, both shipped on `main`, 106/106 Vitest + typecheck (app+api) + lint + genre-sync + production build green each push.

**Answered — the "failed Vercel deployment 12h ago" scare.** Not a security issue. It was **Dependabot** (GitHub's own dependency-update robot) opening its grouped PR #17 on its own branch; Vercel auto-built a *Preview* of that branch and the build failed in 5s. Live site never touched. Cause: the group bundled 6 npm bumps, and one — `eslint-plugin-react-refresh` 0.4→0.5 — requires ESLint 9/10 (we're on 8), so `npm install` refused the whole batch. Explained to Farah that we *do* want most updates, just not that one bundled member.

**Fix — forwarded-newsletter decoration was creating junk board cards** (`api/email.ts`, commit 3332523). Farah forwarded a shop email (STAUD) and got the real item *plus* ~8 junk things ("striped fabric", "polka dot fabric", "gingham fabric", "striped wallpaper", "polka dot tights" — no image, facet attributes only). Root cause: the deliberate-photo detector relied solely on `isInlineImage` (ContentID = shop decoration, skip). **Forwarding an email strips the cid: relationship**, so decorative swatches/thumbnails/pixels arrive as plain attachments that look like deliberately-attached photos → each got a Sonnet vision read (`classifyEmailImage`) → `saveScreenshotProduct` (image:null + vision facet tags = exactly the junk signature) → a board card. Also a **cost** bug: each junk image was a ~1¢ paid vision call on the $20-cap key. Fix: gate the image→item path on two pre-vision signals — `attachmentBytes(att)` ≥ `MIN_DELIBERATE_IMAGE_BYTES` (50KB; swatches/thumbs/pixels are tiny, a real screenshot isn't) and skip the whole batch if more than `MAX_DELIBERATE_IMAGES` (5) big images survive (that's a newsletter's hero shots, not a human attaching photos → `tooManyImages`). Both checked before any paid call, so decoration never becomes junk and never costs anything; deliberate 1–2 screenshots unaffected. **Verified by compile + full suite only** — the live email path can't be exercised (email-in is parked on the Postmark cap) and `email.ts` loads Anthropic/Supabase at module scope so it isn't unit-testable without extracting the logic; the new checks are simple deterministic filters. **Not retroactive** — the ~8 existing junk cards are still on Farah's board; told her to swipe-delete them in-app (faster/safer than a guess-which-is-junk script).

**Dependabot triage** (commit 1df47a9, PR #17 closed). Took the **5 compatible bumps** from #17 directly on main — `@anthropic-ai/sdk` 0.100→0.110, `@sentry/react` 10.59→10.63, `@supabase/supabase-js` 2.106→2.110, `sharp` 0.34→0.35, `@vercel/node` 5.8.9→5.8.22 — dropped `eslint-plugin-react-refresh` (the ESLint-9 blocker). Closed #17 with a note. **6 other Dependabot PRs remain open** (#8 setup-node 4→6, #10 checkout 4→7 — both CI-only, safe; #12 eslint 8→10, #13 react-hooks 4→7, #15 typescript-eslint 7→8 — all one ESLint-9 migration; #14 typescript 5.9→6.0 — major, own session). Also noted `npm` reports 18 known vulns (mostly transitive/dev) — untouched, needs its own careful pass. Farah chose to do **all remaining Dependabot/maintenance work in its own dedicated session** → logged as a roadmap item.

### Session 99 (2026-07-01) — recent-view year-only headers + three-state shelf filter. Free, no API calls.

Two small frontend items shipped on `main` (d41c3e6, 3e90d4f), 106/106 Vitest + typecheck + lint + genre-sync green each push. No Anthropic cost. Same verification caveat as recent sessions — local no-auth library is empty, so neither is meaningfully previewable locally; confirmed for real on the deploy with Farah's owned items.

**Recent-view headers** (`src/screens/LibraryScreen.tsx`, `groupByMonth` → `groupByYear`). Month headers ("March 2024") are too granular for old stuff. Reasoned it through together — the month is a meaningful memory anchor only while it's fresh, and the current year (most items, biggest wall) is where breaking it into months actually helps scanning; past years are fewer items each and the month is noise you don't remember. → **current calendar year gets month headers, every earlier year collapses to just the year.** Year-precision backdates still file under the bare year (no invented month). Considered a rolling-12-months cutoff to dodge the Jan-1 cliff (December collapsing into a flat year on New Year's) but Farah chose the simpler calendar-year cutoff for now — parked the rolling version if the cliff ever feels bad. Dropped the now-unused `formatMonthYear` helper.

**Three-state shelf filter** (same file). ✅ **Confirmed working on the real deploy (s103, Farah).** The shelf filter was a one-way "on my shelf" narrow (owned only). Made it **three-state — on my shelf / not on my shelf / all** — driven by Farah's bookstore case: see your want-to list *minus* the unread copies already at home, so you don't re-buy a dupe. `ownedOnly: boolean` → `shelfFilter: 'all' | 'owned' | 'unowned'`; `'unowned'` filters `!metadata.owned`. Reachable **two ways over one shared state**: (1) the filter sheet's shelf section (two mutually-exclusive chips, neither = all); (2) an **optional sub-menu under "want to"** in the status dropdown — mirrors the existing done→reactions reveal (divider + two toggle rows; pick to refine, tap again to clear, or ignore to see all want-tos). Kept the filter **global** (orthogonal to status, matches the filter-sheet copy) rather than resetting it on status change — it persists if you switch away from want-to, but the "filter · N" badge + active-filters tray keep it visible so it's never a silent hidden filter. Shelf UI still only appears when `hasOwned` (nothing owned → "not on my shelf" = everything, useless).

### Session 98 (2026-07-01) — "look it up online" ranking/dedup + results back button + book covers → Apple Books. All free, no API calls.

Three fixes shipped on `main` (07f3bee, 6b4b4ba), **106/106 Vitest** (98 + 8 new) + typecheck (app+api) + lint + genre-sync green each push. No Anthropic cost change — all work is on the free public catalog APIs (iTunes/Deezer/TMDB/Open Library/Apple Books), browser/serverless-direct. Couldn't be verified locally (every touched endpoint is auth-gated — `describe`/`art` need a logged-in session — or key-gated: TMDB/Apple keys live only on Vercel; local no-auth library is empty), so pre-ship checks were curl against the live APIs + unit tests + the gate. **Confirmed working on Farah's real library after deploy:** catalog lookup ranks the film above the soundtrack, the results back button works, and old book covers self-healed to clean Apple Books covers in the gallery.

**Fix — "look it up online" (add → catalog lookup) returned junk** (`api/lookup.ts`, `components/MediaComposer.tsx`, new `src/lib/catalogRank.test.ts`). Farah reported three symptoms: wrong-medium results, "nothing found", wrong specific match. Root cause: the *normal* (non-recency) lookup path had **no relevance ranking, no dedup, no noise-filter** — all that care only existed on the "latest album" recency path. Results were concatenated **music-first** (`[...music, ...screen, ...books]`), so a film's iTunes soundtrack could lead ("Oppenheimer" → the Göransson score, confirmed live), Open Library returned the same book 3× as separate editions (Middlemarch 1800/1964/2000), and the client's **hard type-filter** on the AI's medium guess could *hide* the right answer when the guess was wrong. Fix: new pure, unit-tested `scoreMatch` (normalized exact match → Dice+containment+prefix blend) + `rankCandidates` (dedupe same title+type, backfill missing year/creator, rank the whole pool by closeness; the medium guess is now a **+0.2 boost, not a hard filter**); dropped iTunes singles; wired into the handler's non-recency branch (recency still sorts by year). Client: removed the hard type-filter, and on an empty result **retries once with the raw typed text** before falling through to the Sonnet "let AI identify it" prompt (kills a class of "nothing found").

**Fix — no visible way back from the results sheet** (`MediaComposer.tsx`). Only the dimmed-area tap closed the picker. Added a **‹ back** button to the `PickerSheet` header (quiet editorial link style). Returning preserves the typed text and refocuses the box (the composer unmounts but its `title` state lives in the parent), so you can tweak and re-search.

**Fix — book covers were ancient scanned editions** (`api/art.ts`, `src/lib/artwork.ts`, `LibraryScreen.tsx`). Farah showed a battered '40s *A Tree Grows in Brooklyn* + a worn 1949 *Nineteen Eighty-Four* on the gallery wall. **Note: "fill from wikipedia" never touched covers** (it fills creator/year/runtime/pages/region only) — covers are the separate `/api/art` pipeline, so running the backfill could never fix them. Real cause: `/api/art` tried **Open Library first**, whose default `cover_i` is usually an old scan; Apple Books has the clean modern commercial cover but was only a never-reached fallback (OL almost always returns *something*). Fix: flipped `bookCover` to **Apple Books first, Open Library fallback** (Apple match still verifies title+author so a study guide / wrong edition can't sneak in; confirmed live that Apple returns clean 600px covers for both). **Self-heal for already-saved covers:** existing books had the old OL cover persisted in `metadata.coverUrl`, which stuck (the resolver returns the override and only saved when empty). New `isStaleBookCover()` marks an OL-sourced book cover as non-final; both library cards re-resolve it (override→null so `/api/art` refetches Apple) and **overwrite** the saved value on next view — covers upgrade themselves on one library-grid visit, then propagate to Taste/Discover (same `coverUrl`). No migration, no manual pass.

### Session 97 (2026-07-01) — bulk "fill from wikipedia" backfill + genre vocab enrichment. All free, no API calls.

All shipped on `main`, **98/98 Vitest** + typecheck (app+api) + lint + genre-sync green. No Anthropic calls (only the free public Wikipedia/Wikidata APIs, browser-direct). Not re-verified on Farah's device (local no-auth library is empty), same as recent sessions — but the core resolution path is spot-checked against the live API.

**Feature — bulk "fill from wikipedia" backfill** (`lib/regions.ts`, `hooks/useItems.ts`, `screens/LibraryScreen.tsx`). Farah's pain: creator/runtime/year don't populate until you open each item and hit "auto-fill from wikipedia" by hand — brutal across a whole library, even when the item already has a wiki link. Root cause was known (memory `wiki-autofill-rootcause`): those facts live in the Wikidata infobox, and the per-item auto-fill already reads them — but only one item at a time. Meanwhile a *bulk* one-shot backfill already existed for **one** field ("pull regions") that resolves each item's Wikidata entry (article → Q-id → claims) in a browser-direct, free, progress-toasted pass. creator/year/runtime/pages all live in that **same** record it was fetching and discarding. Fix: widened that single pass into `pullFacts`/`resolveFacts` (returns `{countries, creator, runtime, pages, year}` from one article+claims lookup; creator now fetched for film/tv too — labels+claims in one call), added `itemsNeedingFacts` (media items missing any fillable field, respecting `dismissedGaps` so the count can reach 0; region still versioned separately). Renamed the overflow-sheet row **"pull regions · N" → "fill from wikipedia · N"** ("creator, year, runtime & region — no tidying needed"). Fills **blanks only** (never overwrites edits), re-runnable ("N failed, run again" on Wikipedia throttle). New `useItems.patchItem(id, columns, metaPatch)` — in-place, no-refetch write for both top-level columns (creator, year) and a metadata delta (runtime, pages, countries); a superset of `patchMetadata`. Removed the now-dead `pullRegions`/`itemsNeedingRegion`/`RegionProgress` + the unused `authHeaders` import. Spot-checked live (curl) against the screenshot example *Dr. Strangelove* (had wiki link, blank creator+runtime): the exact flow returns director "Stanley Kubrick", runtime 93, year 1964.

**Enrichment — genre vocab** (`src/lib/genres.ts` + `api/_genres.ts`, kept in sync by `scripts/check-genres.mjs`). (1) music gained `alt rock` + `grunge` (Farah asked). (2) Farah flagged the TV genre list as too thin (on *A Discovery of Witches* there was no `romance` to pick) and read the expanded picker as "limited + no expand button" — clarified the picker was **already fully expanded** (those chips = the whole list; "+ add"↔"done" toggles it; vibe works identically, just has more entries). Real gap: TV lacked common genres film/book already had. Decided (asked Farah): **enrich the preset lists** (keep genre a curated vocab for clean filters, don't add free-text). Added `action`, `adventure`, `mystery`, `romance` to the **tv** list. `action` already existed for film — no change there. Note: vocab changes apply to newly-identified / re-identified items; existing tagged items aren't retroactively re-genre'd.

### Session 96 (2026-07-01) — "about this" blurb crop fix + "on my shelf" owned filter. All free, no API calls.

Two ships on `main`, **98/98 Vitest** + typecheck (app+api) + lint green each push. No Anthropic calls (fix touched only the free Wikipedia API). Neither is re-verified on Farah's device yet (local no-auth library is empty), same as recent sessions.

**Fix — "about this" blurb spilled past the intro into the Plot section** (`api/wiki.ts`, `lib/wikipedia.ts`, `ItemActionSheet.tsx`). On Circe the blurb ran on with "== Plot == Circe is the divine daughter…". Root cause: the extract was cropped by *sentence count*, not by section — the pinned-URL path (`fetchInfoByUrl`) asked Wikipedia for `exsentences=8`, which overruns the lead paragraph into the next section, and `explaintext` renders that section's heading as literal `== Plot ==`. Fix: added `exintro=1` (bounds the extract to the article's lead section — stops before the first heading), kept `exsentences` as a length cap. Applied to both the pinned-URL branch and the title-search branch. Verified directly against the live Wikipedia API (curl): Circe now returns exactly the one clean lead paragraph, no Plot, no `==`. **Self-heal for already-cached blurbs:** the summary is persisted to `metadata.wikiSummary` and seeded back to skip re-fetching, so items opened before this fix kept the long blurb. Added `isStaleSummary()` (a cached summary containing `==` is treated as stale) — `useWikiByUrl` ignores a stale seed and re-fetches; the `ItemActionSheet` patch-back now overwrites a stale saved summary. One-time refresh on next open, no migration.

**Feature — "on my shelf" is now a real filter** (`LibraryScreen.tsx`). The `metadata.owned` flag (set via the item ⋯ menu — "on my shelf" for books, "own it" for others) was set-only; nothing read it. Farah's use case: checking she doesn't already own a DVD/record/book while out shopping. Shipped a "shelf" section in the filter sheet (single option `on my shelf`, modeled on the existing `newMusicOnly` single-option filter), narrowing to owned items across all mediums. Only shown when the current base set has owned items (`hasOwned`, computed off `baseFiltered` so it's stable as the toggle flips); auto-clears when switching to a category with nothing owned. Counts toward the `filter · N` badge, shows a removable chip in the active-filters tray, clears with "clear all". Not visually verified in preview (empty local library gates the section on `hasOwned=false`) — verified by typecheck + lint + tests.

**Raised for consideration (Farah) — want-to priority list.** Farah wants to revisit the parked "want-to priority" idea (pin/tier a backlog). Moved from "Smaller parked ideas" up to a for-discussion note (`docs/ROADMAP.md`). No decision yet — discuss the shape (and whether it fights the calm, mode-light UI + the earlier "adds clutter to every row" worry) before building.

---

### Session 95 (2026-06-30) — "about this" wiki-link fix + editable/backdate "added" date. Feature discussion: series stacking parked. All free, no API calls.

All shipped on `main`, **98/98 Vitest** + typecheck + lint green. No Anthropic calls (only the free external Wikipedia API).

**Fix — "about this" ignored a corrected wiki link** (`ItemActionSheet.tsx`, `lib/wikipedia.ts`). Farah corrected the Wikipedia link on *Pride and Prejudice* (it had auto-linked *P&P and Zombies*) but the blurb + cover kept showing the zombies article. Root cause: the read sheet resolved the summary/thumbnail via `useWikipediaInfo`, which **searches Wikipedia by title** — it never used the saved URL. So the hand-corrected link had no effect; the title search just re-returned the same wrong article. Fix: a pinned `metadata.wikiUrl` is now the source of truth — new `useWikiByUrl` hook fetches summary+thumb from that *exact* article (via the existing `/api/wiki?url=` branch). Title search stays as the fallback only when no URL is pinned (seeded so it's a no-op, no wasted request, when a URL exists). Resolved data is persisted so `itemGaps` stops flagging and future opens skip the fetch. `persistEditFields` already cleared cached summary/thumb on URL change, which now forces the by-URL refetch. Bonus: the hero thumbnail also follows the corrected article.

**Feature — editable "added" date (backdating)** (`ItemActionSheet.tsx`, `LibraryScreen.tsx`, `useItems.ts`). Farah wanted to log a shelf book she read years ago without it topping "recent". Shipped: a month(optional)+year field in the edit view's *more details* → *added*. Key subtlety solved: `markDone` stamps `date_done=now` and `recencyDate` prefers `date_done` for done items, so backdating `date_added` alone wouldn't sink a book marked "read". Fix: a hand-set date flags `metadata.dateAddedManual=true`, and `recencyDate` now honours that flag over `date_done`, so a backdated done-book actually sinks. Month optional → stored mid-year, `metadata.dateAddedPrecision='year'`, and `groupByMonth` files year-precision items under a plain "2019" header (not a guessed month). Only rewrites `date_added` when year/month actually changed (no stamp on every save). Proven with a standalone logic script: a done-today book backdated to 2019 correctly lands last in "recent" under a "2019" group. **Not yet re-verified on Farah's device** (local no-auth library is empty — can't drive the real edit flow; matches how she's verified prior fixes on her phone).

**Discussion — series stacking: PARKED** (see `docs/ROADMAP.md` → "Media library polish"). Farah agreed to defer. Two soul-conflict reasons: stacking hides per-item verdicts, and adds a collapse/expand mode. Most relevant for books; not biting yet (she reads series but hasn't logged them consistently). Trigger + calm build spec captured in roadmap.

**Confirmed (Farah asked) — the wiki-URL override does NOT disturb blurb priority.** The change only swaps where the *Wikipedia* summary is sourced (pinned URL vs title search). The ladder is untouched: `manualBlurb ?? recommendationBlurb ?? capturedBlurb ?? summary(wiki) ?? bookBlurb(OpenLibrary)` — wiki is 4th, a recommendation blurb still wins. The persist effect only writes `wikiSummary`/`wikiThumb`, never `recommendationBlurb`.

**Logged bug (not fixed) — book covers pick a random old B&W edition** (`api/art.ts`). Full diagnosis + fix directions in `docs/ROADMAP.md` → "Book cover quality". Short version: OL's default `cover_i` is the oldest edition; likely fix = try Apple Books cover first for books, OL fallback.

---

### Session 94 (2026-06-30) — five media-item-sheet fixes (2 bugs Farah hit + 3 design polish). All free, no API calls.

Started as "back to nospaces work"; Farah reported bugs, then asked for design read on a fully-filled book card. All shipped on `main`, **98/98 Vitest** + typecheck (app+api) + lint green each push. **Both bugs Farah re-verified on her real device.**

**Bug 1 — dead "discard" in the review inbox** (`ItemActionSheet.tsx`). The review-inbox `discard` button set `confirmDelete=true`, but the only UI reading that flag renders inside the `⋯` dropdown (closed) or the scratch-capture footer (n/a for *identified* items). So on a real review item — e.g. a saved Spotify rec — discard flipped a switch nothing was listening to (the other two buttons call `onKeep` directly, so they worked). Fix: gave the review box its own inline discard confirm (`discard "…"? … → cancel / discard`), gated `!item.metadata?.scratch` so scratch items keep their footer path.

**Bug 2 — newly added items needed a manual refresh to show in the library** (`hooks/useItems.ts`). Root cause: each screen mounts its **own** `useItems()`, and the add sheet (`MediaComposer`) overlays the still-mounted `LibraryScreen` → two separate `items` states. The add-sheet instance refetched itself, but the library instance underneath only learned via Supabase **realtime** — a network round-trip that lags/drops on the free tier. Fix: a module-level pub-sub (`localWriteListeners`) so every write pings **sibling** instances to `fetch({silent:true})` immediately; `notifyOthers()` skips the writing instance (it already refetched) to avoid a double fetch. Added to every mutator (add/edit/delete/mark*/toggle*/patchMetadata/import/deleteMany/fillVibes/fillGenres). Purely additive — realtime still handles genuine cross-device sync.

**Polish 3 — `⋯` nudged down 1px.** The glyph is a *midline* horizontal ellipsis (`⋯`), which optically rides higher than the `✕` beside it; `transform: translateY(1px)` settles them onto one line.

**Polish 4 — "actually a thing → board" moved out of the `⋯` menu into the edit view.** It was a prominent menu option for a rare misroute. Now a quiet two-step link at the bottom of the edit view (`this is actually a thing, not media →` → `move to board`), mirroring the Things side's "actually media" placement. Updated the stale "edit / own / status / flip / delete" comment.

**Polish 5 — lightened the "thoughts" note block.** On a fully-filled card, the note ran a *heavier* labeling system than the genre/vibe/verdict rows above it (bold 11px uppercase header + full-width hairline divider), so a two-word note ("book club") got more chrome than the note and cut the card harder than anything above. Used a before/after mockup to diagnose. Offered fold-into-column vs keep-distinct; **Farah chose keep-distinct-but-lighten** — kept it as its own "your voice" block (header on its own line, note below) but quietened the header to the tag-label style (10px muted, no divider). **Deliberately diverges from the Things note block** (the old parity comment is retired).

**Commits:** `6d6266d` (bugs 1+2), `d196f85` (polish 3+4), `d7ba982` (polish 5). **Docs:** no ROADMAP prune — none of the five were tracked items (fresh reports + design asks).

---

### Session 93 (2026-06-28) — built the verdict reshape + diamonds→stars; advanced the music-library design. All free, no API calls.

Picked up the locked-but-unbuilt **verdict reshape** (the s92 decision was sitting uncommitted in `ROADMAP.md`). **Shipped the whole build, $0:**
- **New verdict vocab** in `src/lib/moods.ts`: `stuck with me · would revisit · comfort · guilty pleasure · wanted to love it · my secret gem`, plus `in rotation · hyperfixation` **music/TV-only** via a new `verdictsForType(type)` (tiered like `vibesForType`). `VERDICTS` stays exported flat for membership/validation.
- **Retired terms migrate** via `MOOD_REMAP` (GapsSheet surfaces them on real items): `respect, not love`→`wanted to love it`, `so bad it's good`→`guilty pleasure`, `delivers`→drop, `unfinished business`→drop (it's a status). Removed the old `would revisit`→`in rotation` remap (would-revisit is first-class again). **`overrated`/`overhyped`→drop** — Farah explicitly overrode the original "→ my secret gem" plan (opposite meaning; shouldn't auto-flip a negative into a positive).
- **Verdict is optional now** — killed the "how did it land? add a verdict →" nag in `ItemActionSheet`; an empty verdict reads as *finished*, not unfinished.
- **Desert island elevated on the read sheet** — a `★ desert island` line above the verdict row (Farah's call: "elevate it"). Guarded so a canon item with no other tags still shows.
- **All diamonds → stars** (Farah: "demise any diamond glyphs, replace with stars"): `LibraryScreen` card markers ◆→★, `GuideScreen` ◆→★ + the illustration's ◇→☆ (matches the real toggle's unselected state). Also refreshed the guide's stale verdict copy (it named dead `overrated`/`so bad it's good`).
- **`MoodChips.tsx`** now uses `verdictsForType(type)`.
- **Gates:** typecheck (app+api) ✓, lint ✓, **98/98 Vitest** ✓, production build ✓. **Live-verified the guide screen** (screenshot + DOM: no diamonds, `★ desert island` present, refreshed copy). **Could NOT drive the live mark-done sheet / verdict chips / read-sheet desert-island line** — same blocker as s91/s92 (no-auth preview library is empty, can't persist a done item). Those are gates-only; Farah will toy with it on her phone tonight.

**Music-library design discussion (no build — "decide what we want to do first").** Started from the parked "music clutter" item. Landed on a **reframe Farah confirmed "generally"** (not 100% — revisit s94): the clutter isn't verdicts, it's that **want-to bleeds into the collection**. She uses music as a *wishlist too*, so done+want-to share one wall and it stops feeling like the iPod (whose magic was *purity* — only music in your life, browse-by-artist, naturally curated). **Direction: split collection (the iPod, done) from queue (want-to), by default.** Sub-asks confirmed: verdict "shelves" become *one added view inside the collection* (not default); by-artist view sortable by **# of albums saved**. Open next step: *how* the queue sits beside the collection (leaning: a `to listen · N` chip pinned atop music vs. a separate destination) + whether it generalizes past music. Full direction captured in `ROADMAP.md` → "Media library polish". Used a mockup to make the shelf idea concrete.

**Docs:** deleted the now-built verdict-reshape block from `ROADMAP.md`; the music reframe replaced the old one-liner "music clutter" item.

---

### Session 92 (2026-06-28) — full-stack code audit + collapsed the duplicate "mark as done" sheets. All free.

Farah asked for a **full-stack code audit** ("make sure everything works + is structured properly"), then to act on it. **No API calls.**

**Audit verdict — healthy.** Typecheck (app + api) clean, lint clean (0 warnings), **98/98 Vitest green**, production build succeeds, **no secrets committed** (`.env*` properly ignored, no keys in code), no dead/unused component files, **zero TODO/FIXME** anywhere. SSRF guard sits on exactly the user-URL endpoints (`og-parse`, `_scrape`, `thing-image`, `_vision`, `email`, `recommend-feeds`); other fetchers hit hardcoded APIs. The 20 `as any` are all the one untyped-Supabase-client pattern; the 2 `console.log` are `DEV`-gated. Nothing broken or unsafe.

**Acted on the one real smell — the duplicate mark-done sheets** (flagged s91). Extracted the shared form body — segmented reaction scale + desert-island toggle + `NoteInput` + vibe/verdict `MoodChips` — into one controlled component **`ReactionForm.tsx`**. Both call sites now render it: the quick `MarkDoneSheet` (row-level) and the `ItemActionSheet` reaction view (handles both mark-done and edit-reaction via a `collapse` prop). Net **−143 / +30** lines in the two files + the new ~120-line shared component → **one source of truth, can't drift again**. Removed the now-unused `NoteInput` import from `ItemActionSheet`. Gates green after.
- **Two intentional consistency tweaks** (carried — eyeball on a real item): dropped the redundant `vibe · optional` label that only `MarkDoneSheet` had; aligned the in-item desert-island spacing to 18px (was 20). Both pull toward the two sheets matching exactly.
- **Couldn't drive the live sheet** — same constraint as s91: the no-auth preview library is empty and can't persist a Supabase item, so verification was gates + faithful-extraction reasoning + clean re-render (no error boundary), not a click-through.

**Banked two audit findings to `docs/ROADMAP.md`** (Smaller parked ideas, with triggers): split the big screen files (`ThingsScreen` ~2.9k / `LibraryScreen` ~1.7k / `ItemActionSheet` ~1.3k lines — maintainability, not a bug); and lazy-load the `onnxruntime` image-cutout model (main bundle ~742KB/208KB gzip, only fires on Things image cutout).

---

### Session 91 (2026-06-28) — aesthetic retool of the "mark as done" reaction sheet + add-page polish. All free.

Farah confirmed the s90 phone check (⋯ menu, tappable tags, reaction footer, ghost-wash all read right), then asked for a **fuller aesthetic retool of the media "mark as done" sheet** ("my call on specifics"). All shipped on `main`, **98 Vitest green**, typecheck + lint clean, **no new API calls**. Driven by faithful **standalone HTML repros** (real Geist font + palette) in `public/`, screenshotted in the preview — the no-auth library is empty so the real reaction view can't render on a saved item (carried: eyeball on a real item on her phone). The two repro files were **deleted before commit** (kept `public/taste-mockup.html`, pre-existing).

**The retool — `ItemActionSheet` reaction view + shared `MoodChips`:**
- **One chip language everywhere.** Killed the solid-black VIBE bricks. Selected vibe/verdict/reaction chips are now the **cream pill** (`#F4F2EE` + `inset 0 0 0 1px #1C1B19`, weight 500). Did this in `MoodChips` for the `sm` size — all its usages are media surfaces (reaction view, edit view, `MarkDoneSheet`), so no Things blast radius.
- **De-bordered tags.** Unselected vibe/verdict chips are now quiet borderless **tappable words** (`#8A857C`), not a ~20-box outlined grid. This is what removed the "form" feel. `+ add` / `done` toggles also de-dashed.
- **Reactions = a centered cluster**, not stretched full-width boxes. **Bigger font on the reactions only** (14px) — Farah's call; tags kept their original `sm` size.
- **Desert island → Option C (progressive).** Was a 5th chip crammed in the row behind a divider. Now a centered `☆ one for the desert island?` that only appears once reaction is `liked_it`/`loved_it` (or canon already set) → flips to `★ desert island`. Added a local `canon` mirror state for instant toggle. *(Options A "grounded bar" + B "★ tucked at end of scale" were mocked + rejected — B didn't fit at the bigger font.)*
- **Footer:** `cancel` → quiet text link; `save` → ink pill (`#1C1B19`).
- **Ported the whole redesign onto `MarkDoneSheet`** too — the *separate* quick "mark as done" that fires straight from a library row (`ItemRow` `onMarkDone` → `setDoneItem`). It was half-new after the shared `MoodChips` change (new tags, old chunky reactions). Now matches; keeps its item-header + single CTA (no surrounding context like the in-sheet view has). **Flagged for later:** two near-identical mark-as-done sheets is a smell worth collapsing.

**Bullet auto-continue (`NoteInput`):** the `• bullet` button was one-shot. Now Enter on a bullet line starts a fresh bullet; Enter on an *empty* bullet ends the list (drops the marker) — standard editor behaviour. Used by both the note box and the reaction sheet.

**Add page (`MediaComposer`) — verified live (real component, screenshots + computed styles):**
- `identify & save` no longer a **dead grey slab** when empty — it's a quiet ghost (transparent + hairline) that flips to the ink fill once you type (confirmed computed `rgb(28,27,25)`).
- **"other ways to add" collapsed** behind a `▾` tap (find recommendations / import letterboxd / sync spotify) so the bulk/discovery routes stop competing with the primary single-item add.

**Redo (same session, after the live phone check).** The first pass shipped + pushed ([436151a](https://github.com/mokhtarfarah/nospaces/commit/436151a)) but on a real item it read **"oddly unstructured — tiny text floating in whitespace."** The de-bordering went too far. Redone with **structure back, minus the heaviness**:
- **Reactions → a segmented control** (4 connected segments, hairline dividers, selected = cream `#F4F2EE` fill + ink). Anchors the top + reads as a clear single choice. Replaced the spread cluster + the `reactionBtnStyle` helper (removed from both sheets).
- **Vibe/verdict tags → soft-filled tokens** instead of floating words: inactive `bg #F4F2EE / #8A857C`, selected deepens to `bg #E6E1D7 / #1C1B19` weight 500. Every chip has a body now. Done in `MoodChips` (`sm`).
- **Edit-page genre chips** restyled to the same soft-token language (Farah: "genre chips should match vibe chips") — the local `chip()` helper + the genre `+ add`/`done` toggles (de-dashed).
- Tightened: reaction-view + `MarkDoneSheet` notes drop to `rows=2`.
- **Add page**: dropped the bottom divider; "other ways to add" is now a quiet **centered** link directly under the photos/note row (was a left-aligned uppercase block).
- Picked **segmented (option 1)** over a token-cluster reactions variant (option 2). **Farah confirmed all of it on a real device** — segmented reactions + soft tokens read structured (not airy), Option C appears after liked/loved + toggles, bullet auto-continue works, edit-page genre chips match vibe. (Add page also verified live in-session.)

---

### Session 90 (2026-06-27) — cohere the Things editorial polish onto the media item sheet. All free.

Farah asked to bring the s89 product-card language to the **media** side so flipping between worlds feels like one app. All shipped + pushed to `main` ([2b574c0](https://github.com/mokhtarfarah/nospaces/commit/2b574c0), [4395c2b](https://github.com/mokhtarfarah/nospaces/commit/4395c2b)), **98 Vitest green**, typecheck + lint clean, **no new API calls**.

**The coherence pass (`ItemActionSheet`):**
- **⋯ admin menu over the hero** — edit · own/on-my-shelf · status toggle · "actually a thing" · **delete** (red, with confirm) all moved off the read view. Kills the loud red delete button and the clutter. (`SheetHero` gained an optional `menuButton` slot rendered next to the ✕; the dropdown renders *outside* the hero since the hero clips with `overflow:hidden`. Discover, which shares `SheetHero`, is unaffected.)
- **Footer → one warm reaction row (Option A).** Was two heavy outlined buttons + red delete. Now a single warm-bordered (`#E8E8E8`), left-aligned row: `your reaction · liked it … edit →` when done, `mark as done →` (CTA weight) when not yet logged. *Option B (quiet no-pill link) was mocked + parked — Farah chose A but may revert; trigger + hybrid idea in `docs/ROADMAP.md` → Media library polish.*
- **Link row trimmed** to outward links only (about/via · spotify · wikipedia · watch); edit + own moved into ⋯.
- **Note "thoughts"** got the Things block chrome — small uppercase header + hairline divider (the shared `NoteProse` already matched; only the divider was missing).
- **Tappable tags** — genre/vibe/verdict on the read view are now tappable → set `categories=[item.type]` + the matching facet filter, closing the sheet (mirrors the board's tappable taste tags). Gated `countWithTag > 1` so a one-off tag isn't a dead-end. Wired from `LibraryScreen` (reuses the existing `genreFilter`/`vibeFilter`/`verdictFilter` faceted state).

**Aesthetic critique pass (Farah requested, on a real phone screenshot):**
- **Ghost-wash** (`SheetHero`): was pooling a bright hotspot on saturated posters (read as a smudge). Now `blur 7→16px`, `opacity 0.46→0.40`, `scale 1.1→1.15` — a diffuse tint. *(Earlier in the session it went `0.26→0.46` to fix "barely visible"; the critique then dialled it to an even, non-blotchy 0.40.)*
- **Meta line** trimmed to identity (type · creator · year · runtime + series); the reaction was dropped (it's on the footer) — was showing 3× (meta + footer + verdict-adjacent).
- **Hero** title block now **vertically centred** against the poster (`alignItems: flex-start → center`) so a short title block doesn't leave a tall poster hanging; hero bottom padding `16→12` + the hero→tags spacer `10→4` to read as one unit.
- Tags **left labelled** (genre/vibe/verdict rows) — Farah explicitly agreed they carry more meaning than the board's single italic credit line.

**Verification:** done via **isolated repros** rendered in the preview (injected exact markup, screenshotted) — the no-auth preview's library is empty and the add path costs an AI `identify` call, so no end-to-end run. Live flow + ghost-wash on real covers still to be eyeballed on Farah's phone (carried to next session).

---

### Session 89 (2026-06-27) — verify s87/s88 + editorial product-card redesign (note/fit toggle, body-only scroll). All free.

Started as the s88 verification pass, became a full product-card redesign driven live by Farah on her phone. All shipped on `main`, typecheck + lint clean, **98 Vitest green**. No new API calls (every change is UI/CSS or reuses existing cached calls).

**Verification (Farah, on real data):** ✅ photo-aware compare, ✅ compare cache, ✅ in-app screenshot capture, ✅ the flip (product ↔ media), ✅ "find online ↗", ✅ filter tray / tag counts / recency re-sort all **work**. The one miss → the pull-from-link fix below.

**pull-from-link fix — screenshot photo now counts as a gap.** s88's "pull photo & price from link" never showed for screenshot products: a screenshot save always fills `image` (the crop), so the gate `(no image OR no price)` was never true. Added a persisted `imageFromShot` flag (set on screenshot saves, surfaced in `productMeta`, carried through `FieldsForm.save`); the pull now offers whenever there's a link AND (no image OR no price OR the photo is a screenshot), and **swaps** the grainy crop for the clean shop photo (into the form to review), clearing the flag. Decision (Farah): "upgrade the screenshot," not just fill-if-empty. `things.ts` + `ThingsScreen.tsx`. Free (scrape, no AI).

**Taste-tag editor cleanup** (`AttributesEditor`). Was 4 competing chip styles (filled-black facet pills, dashed suggestion chips, dark "add" button). Now: quiet **underline facet tabs**, suggestions as **soft pills** (same `#F4F2EE` as saved tags, no dashed borders, no "+"), and a borderless underlined input with a subtle "+". One material, reads editorial. Farah approved via a before/after mockup.

**Two-step plan picker** (`ProductComposer`). The "add to a plan?" row dumped every existing plan as a chip. Now three choices — `keep standalone · existing plan · new plan` — and the specific-plan picker only appears after you tap "existing plan" (auto-selects the first; reuses `plan.kind`, no new state).

**Editorial product-card redesign** (`ProductSheet`, the resting card). Farah: too plain / too cluttered / didn't feel like "me" → **editorial lookbook** (no serif — app is Geist-only, confirmed; presence comes from scale + air, not a typeface).
- **Full-bleed hero** (negative margins cancel the sheet padding), capped at `min(500px, 55dvh)` so it dominates without pushing content off-screen. `×` + `⋯` float over the photo.
- **All admin moved into the `⋯` menu** (got it / edit details / put back in plan / remove-with-confirm). "actually media" was **demoted out of the menu** into edit details (+ the inline flip on the review nudge) — a rare misroute cleanup, too rarely used to sit up top.
- **Editorial title** (Geist 23px, tight tracking, lowercase, still the shop link via `↗`), **credit line** (price plain, brand as letter-spaced caps), **tag line** (quiet italic, dropped the cryptic `· N` count, tappable→filter).
- **Note + "how it fits" → one toggle** (`ReflectionBlock`, Farah's spec): two tabs on one line, one voice shows at a time. Defaults to your note; if none, opens on the taste read (auto-shown once generated, dismissable). First tap of "how it fits" generates the cached Haiku read — no new cost, toggling is free. Replaced the stacked `NoteBlock` + `TasteFitBlock`.

**The scroll saga (multi-round, finally verified).** Goal: card never scrolls; only the note/read body does. (1) Added `fill` mode to `Sheet` — a fixed-height flex column that can't self-scroll; the card pins photo/title/tabs (`flex-shrink:0`) and the body is the lone shrink+scroll region. (2) The cap was `88vh` → never hit on iOS (large viewport ignores the URL bar) → switched to `88dvh`. (3) The read-only note was a full-area `<button>`, so a touch-drag registered as a tap → render it as plain `NoteProse` with a small "edit" target + iOS scroll hints. (4) **Root cause** found via a phone-dimension repro tested in the preview (iframe): a multi-line note rendered as **one collapsed line** (HTML drops newlines) so it looked long but actually fit — added `white-space: pre-wrap` to `NoteProse`. Verified at 390×844: 5-line note fits (no scroll), 30-line note bounds the body to ~195px and scrolls only that region. *Lesson: stop shipping blind — a standalone repro in the preview pinned it in one shot.*

**Final proportion tuning** (Farah, on phone): photo length, sheet bottom padding (`Sheet` got a `padBottom` prop, product card uses 6), header rhythm (title 25→23, tightened gaps) to grow the reading box. Briefly bumped the note font to 14.5 on a misread ("text too small" meant the *box*, not the font) — reverted to 13, kept the tighter header. `NoteProse` gained an optional `size` prop (scoped; media notes unaffected).

### Session 88 (2026-06-27) — Build B (media Add → bottom-sheet card) + self-authored style profile (free + ~free)

Two things, both shipped on `main`, typecheck + lint clean, **98 Vitest green**. Verified the new UI in the noauth preview (screenshots); the live AI behaviour of the profile injection is **unverified by design** (didn't burn API test calls) — Farah confirms on a real compare.

**Build B — media Add is a card now, not a page.** Converted the full-page `/add` route into a bottom-sheet composer matching the Things `ProductComposer`. The identify/search logic is unchanged — pure presentation refactor.
- New `src/components/MediaComposer.tsx` — the whole add flow (type-to-identify, photo, bulk, picker, save-as-note, other-ways-to-add) wrapped in a shared `Sheet`. When a sub-sheet (confirm/bulk/picker) opens, the composer card hides so we never stack two dimmed sheets.
- Extracted the sheet chrome to `src/components/Sheet.tsx` (shared by media + Things; deleted ThingsScreen's private `function Sheet`).
- `App.tsx` owns open/close state; the FAB in `BottomNav.tsx` opens the sheet (takes an `onAdd` prop) instead of routing. The legacy `/add` route still works (iOS shortcut deep-links + the import/recommend/spotify "← back to add" links) — it renders the **library behind** the sheet so there's never a blank page. Deleted the old `src/screens/AddScreen.tsx`.
- Verified: FAB → card over library, backdrop-tap dismiss, `/add` deep-link opens over library, no console errors from new code.

**Self-authored style profile (Farah's idea).** A free-text "about you" — her own words on aesthetic + body type — stored in `user_prefs.styleProfile`, fed into the **compare** (`things-compare`) and **per-item "how it fits"** (`things-taste-fit`) reads so the weigh-up can speak to fit/silhouette, not just price/reviews. Scope = option 2 (compare + per-item fit), her pick. **Deliberately kept OUT of the editorial board read** (`things-taste`) — body type is a fit constraint, not aesthetic, and Farah's own past guidance says the board read stays aesthetic.
- Editor lives in the Things **taste tab** (`StyleProfileBlock`, an "ABOUT YOU" section under the colour story / in the empty-state), shown in both states. Edit/save/cancel; private to the user.
- New shared `api/_profile.ts` (`sanitizeProfile` 800-char cap + `profilePromptBlock`) injected into both prompts; threaded through `readTasteFit` / `compareCandidates` (`src/lib/things.ts`) + `usePrefs` (`styleProfile` + `setStyleProfile`).
- **Cost:** no new AI calls, no new endpoints — just a few hundred extra prompt tokens on the two reads that already run (negligible). Editor + storage are free.
- **Distinction Farah flagged (don't conflate):** this *style profile* ≠ the parked "**self-defined taste**" idea (picking your own 3 keywords). Keyword-picking would seed the **board read** (`things-taste`); it's still parked.

**s88 follow-up (same day, after Farah tested on phone):**
- **Crash fix — duplicate realtime channel topics.** Build B mounts `MediaComposer` (calls `useItems`) *over* the library (also `useItems`), and the new `usePrefs()` in `IntentSheet` ran alongside the board's `usePrefs()` — two hook instances sharing one channel topic made Supabase throw *"cannot add postgres_changes callbacks after subscribe()"*, white-screening media-add AND opening a plan. Fix: `useItems` + `usePrefs` now append a per-instance random suffix to the channel topic (`items:<uid>:<tag>`, `user_prefs:<uid>:<tag>`) so concurrent mounts coexist. **Not reproducible in noauth preview** (no signed-in user → no channels); fixed by logic + typecheck, proven on phone.
- **Style profile demoted to a quiet link.** Farah: it's a back-end AI input, not a taste-page feature — default is you don't see it. Was a prominent "ABOUT YOU" block; now a small "style profile ›" link on the taste tab that opens the editor in a `Sheet`. The profile text never shows on the page itself.
- **Compare bug — refused on a linked-but-unscrapable option.** A vanessabruno top (bot-walled) made the compare say "can't verify — go re-check it yourself." Root cause: `compareCandidates` only sent name/brand/price/url and relied on a *live re-scrape + web search*, so when both failed the model had nothing. Fix: (1) send each candidate's **saved taste tags + note** so the item's own look/feel survives; (2) reframe the prompt — online reviews are a BONUS not a requirement, **never refuse / never punt back to the user**, always commit to a lean on fit + value; (3) strengthen `_profile.ts` so body type/aesthetic **actively tips** the fit judgment instead of sitting as ignored context (Farah: compare + fit reads felt "largely the same"). No new AI calls. Verify on phone — needs a real compare on a bot-walled shop.
- **Compare render cleanup.** Notes came back with raw `<cite index="…">` web-search citation markup and the model restating "6. Leather Clog (Common Projects, $365): …" before each line. `cleanNote()` now strips cite tags, a leading "N." enumeration, and a restated `Name (brand, $price): ` prefix (colon-safe — verified it leaves real sentences like "The catch: …" alone); prompt also told to write plain sentences with no prefix/markup. A one-off "could not compare these right now" was a **transient web-search timeout** (60s `maxDuration`) — the compare-again retry worked; not a bug, watch if it recurs.
- **Compare voice tune (Farah feedback).** Notes were restating the shop's own spec sheet ("premium leather, made in Italy, power mesh") and running long. Retuned the prompt: one tight note per option (20–35 words), lead with the verdict + the ONE deciding catch (don't enumerate features), **explicitly ban describing the product back / echoing marketing copy**, and gave it a persona — a sharp, body-aware stylist on your side with no stake in the sale. Substance was good; this is shorter + more direct. Prompt-only.
- **Profile relevance gate.** Body-type advice was force-applied to every category ("waist gapping" / "compress your short torso" on SHOES). `profilePromptBlock` now applies body-type notes only where the item touches that body part (torso/waist/bust for tops & dresses, height/leg line for shoes & hems); ignore irrelevant details, never invent a connection. Shared block → fixes compare + per-item fit.
- **Compare now judges from the PHOTOS (not just text).** Was text-only, so visual reads ("reads cute") were guesses and it conflated options (pinned "Common Projects runs long" onto a different maker's mule). Now: server fetches each candidate's saved photo via `fetchImageBase64` (existing browser-spoofed fetcher, parallel with the page scrape, best-effort) and attaches them to the Haiku call as labelled image blocks (option N → its pic). Prompt: judge the real silhouette/proportion/colour from the photo AND weigh it with name/price/tags/description/online — "decide from more info, not less"; only name a vibe when the photo or words show it; can't feel fabric/true fit → frame as risks. Kept anti-conflation rule (each option's facts stay separate). **Cost: ~+$0.01–0.02/compare** (images) on top of the existing ~$0.05–0.10 web search; opt-in button only. Greenlit by Farah. Verify on phone — needs a real compare to confirm the visual reads land + are grounded.
- **Compare consistency (Farah: "different results every time").** Two causes: (1) `temperature` was the ~1.0 default → now **0.3** for steady run-to-run judgment; (2) the "pick the ONE catch" instruction meant a key issue (e.g. creasing) appeared then vanished — now catch-selection **prioritises the concerns named in the brief** ("won't crease" + leather → creasing every time). Inherent residual drift = web search pulls fresh results each run (the intended kind). Prompt + param only.
- **Compare result cached** (like the taste reads). Was local state only → closing/reopening the plan lost it and forced a costly re-run. Now persisted on the intent's metadata as `{ result, candidateIds }` (`IntentMeta.comparison`); seeded back on reopen **only when the option order still matches** (notes are positional). Add/remove an option or "dismiss" → invalidated; a plain edit keeps it. Saves the re-spend.
- **"Pull photo & price from link"** (Farah's Q — decided "offer, gap-fill only"). A screenshot-saved product is linkless; when you add a link later, the edit form (`FieldsForm`) offers a one-tap pull that reads the page and fills **only empty fields** — never overwrites what you have/typed, leaves taste tags alone, populates the form so you review before saving. Offered only when there's a link + a real gap (no image or no price). Free (scrape, no AI). Verified the conditional UI in preview; the scrape itself needs the backend (phone).

### Session 87 (2026-06-27) — screenshot-capture feature, all 5 parts (one ~1¢/screenshot cost, rest free)

Built the whole locked screenshot-capture spec in one session. Typecheck + lint clean; **98 Vitest green** (91 prior + 7 new flip tests). Verified compile/render in the noauth preview (board renders clean, no crash); the **interactive flip/review/find-online UI is unverified** because the noauth preview has no seed data (same s85 limitation) — needs an eyeball on Farah's real phone.

**1 — screenshot → live capture (`api/email.ts`).** A NON-inline image attachment (`isInlineImage` = has a `ContentID`; inline = shop decoration/swatches/pixels, skipped) now gets ONE Sonnet vision read (`classifyEmailImage`) that decides **product vs media** and pulls the right fields in one call — product: name/brand/price + look-tags (`material/palette/vibe/category`) read off the screenshot itself; media: title/creator/type/year + blurb. Products route to the board (`saveScreenshotProduct` — linkless/imageless by design, `find online` recovers buy-back); media joins the library path. **Softened "link wins → discard attachments"** to "link wins *only if it yields a product*": the save@ link still gets first crack, but a 403'd link now falls through and a deliberately-attached screenshot gets read (the rescue).

**2 — confidence-gated review, both domains.** Was: every forwarded media item got `metadata.review=true` (blanket). Now: **`review = bulk(>1 items) || confidence==='low'`** — a single confident capture (one forwarded article, one cleanly-read screenshot) lands **live**; only bulk newsletters + shaky reads get flagged. Screenshot products gate the same way (low-conf → review). Reply copy now adapts ("Saved to your library" vs "Added to your review inbox" vs mixed). **Board review filter** mirrors the Library's: a `for review · N` chip on the Things control bar; in-review things stay OUT of the clean sections until triaged; the chip reveals them as a flat grid. (`src/lib/review.ts` reused as-is.)

**3 — media↔thing flip (CRITICAL safety net).** New `src/lib/flip.ts` (`flipThingToMedia(item, type)` / `flipMediaToThing(item)`) + 7 tests: reshapes the row across domains, brand↔creator, drops the other domain's shell, **clears `review` (flipping IS the triage)**. Things side: a "**actually media**" action in the ProductSheet admin row → a 4-type picker (film/book/music/tv) → moves to library + flash. Media side: "**actually a thing → move to board**" in the ItemActionSheet footer. Plus a for-review **banner** in the ProductSheet ("does this look right? [looks right] [it's actually media →]").

**4 — "find online ↗".** A screenshot/flipped product has no stored URL, so its ProductSheet title now links to a free `google.com/search?q=brand+title` (no scrape, no API). **Decision to confirm:** Farah's spec said "on board *cards*" — I put it on the product **sheet** (one tap from the card) because nesting a link inside the card's open-button is bad HTML/clutters the wall. Easy to also add to the tiles if she wants it literally there.

**5 — failure copy nudges the rescue.** The things@ "couldn't read the link" reply and the save@ "link points somewhere I can't read" reply both now say *"open the page, screenshot it, and email the screenshot here."*

**Only new cost:** ~1¢ Sonnet vision per emailed screenshot (one classify call, fallback-only feeling — most captures are still free link scrapes). All UI work free.

**Then Postmark blocked us → added the in-app screenshot path (the Postmark-free twin).** Mid-session the free Postmark plan hit its 100/mo cap (counts ALL inbound, incl. junk/notifications), and Farah **can't upgrade to the 10k plan until Postmark approves her account** — the same approval that's gated talkback since 2026-06-02. So the *email* screenshot path is unverifiable for now. Rather than wait, we built an **in-app "screenshot a product"** on the Things FAB that needs no email at all: pick/take a screenshot → `downscaleImage` (also normalizes HEIC) → `uploadMoodImage` hosts it → `/api/screenshot-product` (`readProductFromImage` in `_vision.ts`) does ONE vision read for **identity (name/brand/price) + look-tags + shot type** → saves **live** to the board with a real hosted image + cutout. Linkless ("find online ↗" recovers buy-back); lands live (no review gate — a deliberate in-app save is the signal). This is *better* than email (hosted image + cutout, no quota) and **works today**. New: `api/screenshot-product.ts`, `readProductFromImage`/`Confidence` in `api/_vision.ts`, client `readProductFromImage` in `src/lib/things.ts`, the FAB action + `downscaleImage` + `addProductScreenshots` in ThingsScreen. ~1¢/screenshot, storage free. Verified the add-menu entry renders (noauth preview); the upload+vision flow needs real auth → Farah's phone.

**Postmark gotcha logged** (`docs/REFERENCE.md` → Postmark plan): the cap counts every email that *arrives*, so spam/notifications drain it too; approval unblocks talkback AND the paid plan in one go.

**Then Farah tested the in-app screenshot on her phone and gave a batch of feedback — addressed most of it:**
- **Product-isolation crop (BUG fix, shipped).** The first screenshot saved the *whole* page (Safari chrome, Farfetch header, price text), so the card didn't match the clean product tiles. Fix: `readProductFromImage` now also returns a normalized **bounding box** of just the product's photo (`Box`/`cleanBox` in `_vision.ts`); the client crops the screenshot to it (`cropBlobToBox`, +4% pad), hosts the crop, and runs the usual cutout. Falls back to the full shot if there's no box / crop fails.
- **Folded screenshot into the "save a product" card + plan attachment (shipped — Build A).** Feedback: screenshot was a 3rd FAB button with no way to file it under a plan. Now ONE "save a product" card offers *paste a link* OR *screenshot a shop page*, plus an **"add to a plan?"** selector (keep standalone / an existing plan / + new plan with an inline name). Routes to a standalone product, a candidate on an existing intent, or a new intent (`readScreenshotToFields` + `saveComposedProduct`). Dropped the separate FAB button. Verified card + plan selector render + save-label flip in the noauth preview.
- **Decisions logged (`AskUserQuestion`):** media Add → make it a **card/sheet** like the product composer (Build B, NOT yet built); "search for things" = just match the look (no new search — media keeps its search box, things keeps link/screenshot); a standalone text-note thing = **skip** (plans already cover "a thing I want, no product yet").

**▶ Next: Build B — convert the media `AddScreen` (full-page route) into a bottom-sheet card** like the Things product composer, so adding media doesn't feel like navigating away. Self-contained presentation refactor; flagged for a fresh chat (this one ran long). **Also still pending:** test the in-app screenshot path (now with the crop + plan attachment) on a real phone; the email path waits on Postmark approval.

---

### Session 85 (2026-06-26) — library header + filter card overhaul, recency fix, one-line bottom nav (all frontend, free)

Another long iterative phone-screenshot session, all pure frontend (no API, no cost). Nine commits to `main`; typecheck + 93 Vitest green on every push. Theme: **make the library's controls read like one calm, legible system** — and de-soup the filtering.

**Library header → one nav line.** The category tabs + the status row were two stacked rows; merged into **one**: `music films books tv all │ status ▾` left, the view·sort·filter slider right. Status is now a **dropdown** (`StatusDropdown`) — all/want-to/in-progress/done, and the four **reactions only appear once "done" is the active status** (gated, not a permanent chip row). On scroll the header collapses to a **pure one line** (categories · status · filter); search + `⋯` live in the title row and return with a flick up — we removed the crammed collapsed control cluster. (Chose this over a slim-icon-strip / keep-search variants — mocked all three for Farah; she picked "pure one line.")

**Filter card overhaul (the big work):**
- **Soft segmented controls** — layout folded `list / grid 3 / grid 4` into one row (dropped the separate "columns" row); captions matched. Style softened from hard black/white to a quiet warm-grey track with the selected segment lifted as a white chip (`segGroup`/`segBtn`). Mirrored onto the **Things** card (`SegRow`).
- **Type-hierarchy fix** — the `SORT`/`FILTER` headers were tinier/paler (11px) than the rows beneath them (inverted hierarchy). Headers now 12px/700 graphite uppercase; rows 14px/400 ink. (Mirrored to Things `SheetList`.)
- **Sort → a right-aligned label row** matching layout/captions: `sort` left, the four options as right-aligned **chips** (kept as chips, NOT a segmented box — 4 longish options + a direction toggle don't fit a one-line box; active fills ink, directional show ↑/↓, re-tap reverses). This also retired the cramped SORT divider.
- **Group reorder** to `genre · vibe · verdict · series · region` (music's niche new-music-tuesday toggle trails last). **Removed** the hairline dividers between collapsers.
- **Clear** moved out of the header into the card: now reads `N match · clear` on the FILTER line, resets every active filter, and **no longer auto-closes** the card (clear-and-keep-filtering).
- **Active-filters tray + counted, ranked tags (Farah picked ideas 1+2 from a 4-idea menu).** Diagnosis: the card let you *build* a filter but never showed *what you'd picked* or *what's worth picking*. Fix: (1) an **active tray** — everything selected across all axes shows as removable ink chips under the FILTER header; selected tags live **only** in the tray, not duplicated in their group. (2) **Counts** — each tag shows how many items carry it, ranked biggest-first, groups show **top 8** with `show all N` for the tail. `availableTags` now returns `{value,count}[]` per axis (counts computed from loaded items — free); `FilterSection` renders counts + show-all + excludes selected. Deferred: tag-search (idea 3) until `show all` lists feel long; verdict IA split (idea 4) parked.

**Recency fix — "recent" = last meaningful moment.** It sorted purely by `date_added`, so finishing something you added long ago left it buried — and it *disagreed* with the month headers, which already bucket done items by their done-date. New shared `recencyDate(item)` (done-date if done, else add-date) drives **both** the sort and the grouping, so a freshly-finished item rises to the top AND files under this month's header. Deliberately avoids `updated_at` (it bumps on silent cover/wiki/region backfills → would reshuffle "recent" for things you never touched).

**Bottom nav → one editorial bar.** Collapsed the two stacked rows (slim media/things switcher over a fat icon tab bar) into a **single row**: `media / things` as the bold editorial anchor (16px, active bold ink, inactive underlined) on the left, the sections (`library / taste / discover`, or the board's `wishlist / taste`) as smaller (13px) **slash-split text links** on the right — no icons. `DomainSwitcher` became a shared `DomainLinks` left-component embedded in both bars; the separate fixed switcher strip + `attached`/`hasSwitcher` plumbing are gone. `layout.ts` is now **one row** (`NAV_H = 46`, no `SWITCHER_H`/`BOTTOM_STACK`-stack). Deleted orphaned `navIcons.tsx`.

**Things parity:** the 4px cover-wall gap (s84 `none`-caption) now also applies to the Things **grid** and the **deciding** strip; soft segmented buttons + stronger headers on the Things filter card; `ThingsNav` rebuilt as the merged bar.

**"all" tab — discussed, KEPT.** Farah doesn't use it and the cross-category tag soup is confusing, BUT it's the **only home for cross-category recency** (recency-across-everything needs an all-scope; "everything loved" is arguably Taste's job already). Decision: keep it; the real fix is to **de-confuse it** (deferred — see roadmap).

**Verification:** typecheck + 93 Vitest green every push. Eyeballed in the noauth preview (mobile): one-line header, status dropdown, soft filter card (layout/sort/captions), one-line sort chips, both domains' merged bars. **NOT verified with real data** (preview empty) — the **on-phone tests for next login:** the active-filters tray + counts/ranking/`show all`, the `N match` count, the recency re-sort (finished-long-ago item rising), and the merged bar not crowding the FAB on a full screen.

---

### Session 84 (2026-06-25) — bottom-nav + library-header declutter pass (all frontend, free)

One long iterative session, all pure frontend (no API, no cost). Farah drove it by reacting to live phone screenshots; lots of small course-corrections. Net theme: **make the library read calmer — let the covers be the loudest thing.** Eight commits to `main`.

**Bottom nav (the s83 switcher kept drifting "chunky"):** iterated the media/things switcher + tab bar several times before landing.
- Merged into **one panel**: the switcher's top border is the panel's outer edge, the tab bar's border the internal divider; then **removed that divider** on the collection screens so the two rows read as one bar (`BottomNav` takes `attached`; stand-alone screens like `/add` keep their border so they don't float; ThingsNav drops its border unconditionally since the switcher is always above it on `/things`).
- **Centralized all the bottom geometry** into `src/lib/layout.ts` — `NAV_H`, `SWITCHER_H`, `BOTTOM_STACK`, and `clearStack()`/`clearNav()` helpers + `navButtonBase`/`NAV_ICON`. This was the key refactor: the ~10 bottom-anchored offsets (both FABs, both nav bars, content padding, select bar, sheet spacer, sync banner, Things toast) had been hand-computed literals (56/84/108/178…) across 6 files; now they derive from two numbers. Re-tuning heights after this was a 1-line change.
- Final heights after several passes: Farah's call = **both rows equal at 36px** (switcher was briefly 28 then 22 "barely-there caption" — she found the skinny-caption-over-fat-bar disproportionate, so equal won). Tab icons shrunk 24→18 to fit. `navIcons` got an optional `size` prop.

**Library header collapse:** the top was three stacked control rows before any film. Dropped the standalone uppercase kicker and pulled the `recent ▾` sort button out of the title row; folded count + sort into one quiet subline. Title row now holds only title + search + `⋯`. (Then sort moved entirely into the view card — see below — so the subline is just the count.)

**Unified view·sort·filter card (the Things pattern):** the library had **three** separate triggers for "how is this list shown" — a `recent ▾` sort button, a filter-slider, and `⋯`. Farah's idea (weighed against a rejected hamburger-holds-everything drawer): merge **view + sort into the filter sheet**, opened from the slider button next to the categories — exactly how the Things board already works. So `FilterSheet` now renders layout · columns · sort · the tag-filter groups in one card; the filter button is **always present** (it always offers layout+sort); selecting a sort no longer closes the card. **Deleted the `ViewSheet` component** (its config/types + new exported `ORDER` stay). `⋯` keeps the actions.

**`decide for me` → back into `⋯`:** it was an action stranded at the end of the status filter row, snagging the eye among the filter chips. Returned to `OverflowSheet` as "help me decide" (top row, gated on `hasItems`). Status row now holds only filters. *(Note: the code comment had said it was deliberately promoted OUT of `⋯` to be visible — this reverses that; Farah chose cleaner-over-prominent.)*

**Grid caption-density setting (media AND things):** Farah's idea after we discussed a pure cover-wall — instead of removing card subtitles outright, make it a **per-device setting** so libraries with few covers can keep text. New `captions` control in each view card (grid only): **`none`** (clean wall) / **`title`** / **`full`** (default = unchanged). Coverless tiles now render title+creator (media) / name+brand (things) **inside** the tile, so `none` never leaves blank squares. Media: `caption` added to `LibraryPrefs` + `GridCard`. Things: `CAPTION_KEY` localStorage + `ProductCard` + `Thumb` got a `fallback` slot. **Open thread:** Things `full` still includes the taste/material line (Farah said "price + brand maybe" — kept the line, flagged it; trivial to strip to strictly name+price+brand if she wants).

**Verification:** typecheck + 93 Vitest green on every push. Eyeballed live in the noauth dev preview (mobile) — nav panel, collapsed header, the unified view card (layout/columns/captions/sort all render), `⋯` menu, both domains render clean. **Not verified with real data** (preview is empty): the caption modes against real covers, and the equal-height nav proportions on a full screen — these are the **on-phone tests for next login.** `[captures] fetch failed` console noise = noauth has no `/api`; unrelated.

---

### Session 83 (2026-06-25) — s82 quick polish batch + domain switcher moved to the bottom

Farah picked the **ungated quick wins first**, then queued the nav move (decided direction: switcher **down**). Six items, all pure frontend (free, no API).

**Polish batch (s82 feedback):**
- **Grid covers not loading (the real bug):** `GridCard` only used `useArtwork` (→ `/api/art`: TMDB/iTunes/OpenLibrary); the **list row also falls back to the Wikipedia thumbnail** via `useWikipediaInfo` (`artwork ?? wikiThumb`). So any item whose cover comes from Wikipedia (books especially — OpenLibrary is spotty) went blank in grid. Fix: mirrored the list row's wiki fallback in `GridCard` (incl. the cached-seed + persist-via-`onSaveWiki` path; threaded `onSaveWiki={handleSaveWiki}` at the grid call site).
- **Done-badge unified:** the finished `✓` was a white-pill + box-shadow; gave it the **same feathered-outline SVG** treatment as the loved smiley (circle + check, `drop-shadow(0 0 1.5px #fff)`) so they're one family.
- **Empty-state copy:** both domains now **header + small-line**. Media: "your library is empty" / "tap **+** to add the first thing you can't shut up about." Things (`Empty`): rebuilt from one-font to "your board is empty" / "tap **+** to save a product you love, or plan a purchase you're weighing."
- **Cramped Things CTAs:** bumped the recovery "read taste from photo" link's `marginTop` 16→28 so it isn't squished against "+ add a note".

**Nav move (the bigger build):** the `DomainSwitcher` (media/things) was rendered at the **top** of each screen (twice in Taste) while the section tabs sat at the bottom — two nav systems, two corners. Reworked it into a **slim hairline fixed strip pinned just above the bottom tab bar**, so the two read as one nested stack (domain over section, both in the thumb zone).
- `DomainSwitcher.tsx` rewritten as the fixed strip; exports `SWITCHER_H = 40`. Rendered **once** in `App.tsx` on the four tab routes (`/library /taste /discover /things`), `current` derived from the path. Removed all 5 in-screen renders + now-unused imports.
- Everything bottom-anchored shifted up by the strip (56→96 baseline): media FAB, Things FAB + capture flash, the offline-sync banner, and content bottom-padding across Library (scroll 80→120, filter-sheet spacer 88→128, select-mode 150→190), Taste (80→120 ×2), Discover (100→140), Things (content 120→160). The select-mode bulk bar (zIndex 101) covers the strip, left as-is.

**Verification:** typecheck + eslint + 93 Vitest all green. **Eyeballed live** in the noauth dev preview (mobile) — both domains: switcher strip reads clean above each bottom nav, FABs clear it, both new empty-states correct. (`[captures] fetch failed` console noise = noauth dev has no `/api` functions; unrelated.) **Not verified with real data:** grid-cover + done-badge need a populated library — logic mirrors the proven list-row path, but worth a glance live; and the +40px bottom clearance on scrolled content couldn't be exercised on empty screens.

---

### Session 82 (2026-06-25) — mood masonry verified + per-surface AI voice

Two roadmap items closed. **(1) Mood masonry (s80)** — Farah eyeballed it live behind login: good. Deleted from roadmap. **(2) Vary the AI voice by surface** — the s81 coherence finding that one shared humanizer block made every prose generator sound the same lyrical way.

**What shipped:** added a `VOICE` map to `api/_humanizer.ts` — three named registers (`warm` / `terse` / `decisive`) that layer *on top of* the unchanged `HUMANIZER_GUARDRAILS` base (base = "don't sound like an AI"; register = "and here's the stance for this surface"). Wired to 7 call sites across 6 endpoints:
- **warm** (perceptive friend reflecting your taste): `taste-profile.ts`, `things-taste.ts`, `things-taste-fit.ts`
- **terse** (pointing you at something, fast): `recommend-feeds.ts` why-lines, `recommend.ts` blurbs (×2 — URL + PDF prompts)
- **decisive** (helping you make the call): `things-compare.ts`

Also confirmed the roadmap's open question: **all Things prose endpoints already import the humanizer base** — nothing to fix there.

**Cost:** negligible — no new API calls, ~40-60 extra prompt tokens on calls that already run. **Verification:** 93 Vitest green, typecheck/eslint/build clean. The prose change itself is server-side prompt text; not live-tested to respect the $20/mo cap — it'll show the next time each surface runs. *If a register ever reads wrong in real output, the fix is one string in `_humanizer.ts`.*

---

### Session 81 (2026-06-25) — holistic first-impression pass + cold-start/coherence ship

Farah ran the planned holistic look: I read the app end-to-end from source, she fed screenshots in batches (library → taste/discover → things). Delivered a felt first-time-user reaction + an audit, then shipped the safe fixes. **4 commits on `main`** (`8e74782`, `d4573bd`, `d2c20cc` + docs), 93 Vitest green, typecheck/eslint/build clean. Empty states eyeballed in the noauth harness; data-driven bits flagged for live verify.

**The through-line (the review):** populated, the app is genuinely charming — the **media taste-profile prose** and the **Things "deciding" engine** are the standouts, and the deciding engine resolves the navel-gazing worry on the Things side (it's practical, not a mirror). The damage was all in the **first five minutes** (hostile/empty cold start) and a **coherence seam** (the two halves looked like different hands). The taste-profile arc, desert island, discover, decade grouping, faithful-creators, recommendation engine — all confirmed good, left untouched.

**Shipped:**
- **Empty-library copy** — dropped "go listen to some music you loser" for "add the first thing you can't shut up about." (kept a wink). *Dropped from roadmap parked list.*
- **Empty taste page** — replaced the "go do it elsewhere" line with a blurred **locked preview** in the profile's shape (vibe-headline + prose skeleton under a veil) + the missing `DomainSwitcher`. Payoff visible before earned.
- **Domain switcher** — bolder active, **underlined inactive** so it reads as the tappable bridge it is (was near-invisible). Discover cold-start explainer lowercased.
- **One voice** — Things chrome lowercased throughout (buttons, empties, placeholders); "polish images · N to tidy" → "clean up photos · N to fix".
- **Cover reaction badge** — the undecodable ink-vs-grey dot → ☺ (loved) / ✓ (done). *Note: my code-pass guesses that the list-row "w" circle = "want to" and the dot = "owned" were **wrong** — "w" is the Wikipedia link, the dot was reaction. Corrected, didn't churn the deliberate ones.*
- **Deciding-card grid cover** — Farah asked to restore the older overlaid-title design: photo fills the tile, frosted question band over it, count chip, pile cue behind; title is **one line + ellipsis** (her call). Pulled from `5bb51bf`, adapted to the current `Thumb`/cutout path.
- **Wishlist naming** — collection had two user-facing names (nav "wishlist" vs masthead "the board") and "board" collided with "mood board"; unified on **"wishlist"**.

**Coherence audit (the bigger ask):** mapped where media/Things diverge. Most "stapled-on" feeling was casing (fixed) + switcher visibility (fixed), not architecture — the two halves share one thesis (taste → mirror; collect → decide). Remaining divergences folded into the roadmap as **one cluster: "what feeds the taste read"** (self-defined taste + Things-taste reframe + beauty/home exclusion + a "got it"→worth-it signal — all one decision, gated on the "saving is the signal" soul rule) + a separate **"vary the AI voice by surface"** item (ungated, can go first). "thread"→"vibes" was a no-op (only in code/comments, never user-facing).

**Verified live (Farah):** the cover badges + deciding-card cover look good. Two end-of-session refinements then shipped (`32505d4`): the loved badge redrawn as the taste-tab smiley SVG (fills the mark, won't render as a tiny/colored emoji), and a no-options deciding card now reads as a question ("add options" + a "+") instead of a broken "no image" tile.

**Next:** the "what feeds the taste read" roadmap cluster — needs the design decision before code; "vary the AI voice by surface" can go anytime. Mood masonry (s80) still awaits an eyeball.

---

### Session 80 (2026-06-25) — eyeball backlog: colour-story + mood masonry + product sheet

Short verify-and-fix session. Cleared the s77–s79 eyeball backlog with Farah testing live (behind login) and reporting; 2 fixes shipped. **3 commits on `main`** (`97aef09`, `9451eaf`, `c082329`; `58b3283`/`3b691e7` docs), 93 Vitest green, typecheck/eslint/build clean.

**Colour-story background fix (s77 carryover) — ✅ Farah confirmed live.** The ribbon read too gray because the sampler only dropped near-white/near-black backdrops, not gray/cream/kraft. Fixed in `src/lib/palette.ts`: detect the backdrop via the image **border** (`borderColor`) and drop pixels matching it *whatever its colour*, so any flat backdrop goes while a cream/gray *product* in the centre survives; full-bleed shots fall back to the chromatic-neutral drop (`mx − mn < 10`). Cream returned without warm-skew, balanced. Tuning knobs: border-spread `36`, backdrop-match tolerance `50`, fallback neutral `10`.

**Eyeball results (Farah, live):**
- **Product card (s79)** — "fine for now, will use it and see." One bug: with the taste read hidden, "show taste read" sat flush against "+ add a note" ("+ add a noteshow taste read"). Fixed — the button was inline-block; made it `display:block` (`ThingsScreen.tsx:1227`).
- **Deciding-card cutout (s79)** — looks good across candidates. ✓
- **Things taste restructure (s78)** — looks good. ✓ (verified, dropped from roadmap)
- **Mood masonry order (s77/78)** — Farah wants **newest-first across rows AND gapless**. CSS can't do both (columns = gapless but column-major; row grid = right order but gaps). Rebuilt as **JS shortest-column masonry** (`MoodWall`, `ThingsScreen.tsx:1882`): walk items newest-first, drop each into the currently-shortest column → newest spreads across the top, no gaps. Tiles report aspect ratio on `onLoad`; layout settles in. **Caveat (told Farah):** tiles can shift columns as images stream in / lazy-load, settling after first view (cached). If it ever annoys, store image dims at save time. Not yet eyeballed live (shipped `c082329`).

**Next:** Farah wants a **holistic look at the whole app** next session — step back from the polish queue.

---

### Session 79 (2026-06-25) — bug-fix + Things-board polish pass

Bug-fixing session that worked through the s76 "Library + Things polish" queue plus a fresh image regression. **5 commits pushed to `main`** (`7302bf5`, `a95a08b`, `9b25ca7` are the substantive ones), 93 Vitest green, typecheck/eslint/build clean throughout. Most visual work is **behind the Google login wall, so verified by typecheck + the new no-auth harness only** — Farah confirmed the sneaker fix live; the rest is her eyeball next session.

**First, a correction:** HANDOFF wrongly said s78 was uncommitted — it was committed + pushed at `9ee86e4`. Fixed.

**New dev capability — no-auth preview.** `App.tsx` already had a `skipAuth` (DEV && no `VITE_SUPABASE_URL`). Wired it into a launch config: **`nospaces-noauth`** (`.claude/start-dev-noauth.sh`, port 5180) clears the Supabase URL so the UI is explorable without Google login. **Limit: no Supabase = empty data**, so it only verifies layout/render-safety, not anything data-driven (filter rows, the product sheet, scrolling). This is how the taste sub-tab fix below got truly verified.

**Shipped:**
- **Taste sub-tabs de-underlined** (`ThingsScreen.tsx` `TabChip`) — `profile · moodboard` now match the media taste page (bold+italic active, no rule). Caught a real bug in preview: `borderBottom: undefined` left the UA-default `2px outset` button border showing as a stray underline — fix is explicit `'none'`. Category chips keep their underline via a new `underline` prop.
- **Capture URL-leak plugged** (`LibraryScreen.tsx`) — the media email-captures list showed Things/product forwards too; now filtered with `!isThingsCapture` (mirrors the board's own filter).
- **Media filter control → Things' slider icon** (`LibraryScreen.tsx`) with a count pill. **Farah explicitly de-scoped the rest of the "library header redesign"** — she wanted *only* the filter card, NOT the jumpy-header refactor or the list/grid switcher relocation. Those are dropped from the queue.
- **Deciding-card cutout regression fixed** (the black-background sneaker). Root cause: the s78 picture-cover revert showed each candidate's raw photo, and **deciding-plan candidates never had cutouts** — the polish backfill only ran on `kind === 'product'`. Fix: new `leadCandidate()` helper + `polishLead()` extend the manual **"polish images"** button to a plan's lead candidate (vision-read shot type if unknown, ~1¢/plan; cut out bare product shots; stored on the candidate at a `${itemId}-${candId}` storage key; lifestyle/model leads skipped). DecidingCard now passes the candidate cutout to `Thumb`. **Farah confirmed the sneaker shows on gray after polishing.**
- **Product sheet restructured — "taste mirror, not a checkout"** (Farah-led step-back). The body now has **no boxed button**: the **title is the link out** (quiet ↗, redundant "view at…" button removed); **tags dropped the filled-pill look** for quiet text (tappable ones faintly underlined); **"mark as got it" demoted** into the bottom hairline admin row (reads "undo got it" when owned) with ownership mirrored as a calm `· got it` status by the price.
- **Per-item hide for the taste read** — trailing controls are now `re-read · hide`; hide collapses to a quiet "show taste read" link (`metadata.tasteFitHidden`; un-hide is free, never re-runs the paid call). Chose per-item over a global setting (the feature is already opt-in). 
- **Inline re-read** — new optional `trailing` slot on `NoteProse` puts the refresh at the END of the AI text (product-sheet taste read + taste-profile pull-quote) instead of a paragraph below.

**Open for next session:** the empty-library copy (still parked, Farah's call); the two media *for-discussion* items (scroll-lock stickiness, music-library clutter). Farah may also give feedback on the product-card restructure / taste-read changes once she's seen them live.

---

### Session 78 (2026-06-24) — Things taste restructure + cross-domain consistency

Discussion-led build session. Started on cross-domain consistency (taste/mood vs taste/discover), landed several concrete changes. All on `main`-ready working tree (not committed — Farah hadn't asked to push as of session end), 93 Vitest green, typecheck/eslint/build clean. **Nothing runtime-verified — board behind Google login** (see ROADMAP "Things taste restructure — runtime-verify").

**The discussion (consistency).** Mapped both domains' 3-tab navs. Found the real asymmetry: media has a step *after* the taste mirror (discover, which eats the taste profile) so taste sits mid-nav; Things had no such step so taste sat last. Conclusion: don't force a 1:1 mirror — lock the shared spine instead. Farah then proposed the cleaner fix (built below): make Things **two main pages** (wishlist · taste) with taste split into **profile · moodboard** sub-tabs, exactly mirroring media's taste = profile · desert island. Product recommendations stay **parked** — Farah's blocker (can't cheaply tell a genuine rec from sponsored/hallucinated; products have no TMDB/RSS-style trustworthy source) is the right one.

**Shipped:**
- **`DecidingCard` grid revert** (`ThingsScreen.tsx`) — list view = compact text box (unchanged); grid view = picture-cover card using the front-runner's image (winner → leaning → first option with a photo), pile cue still peeking. Closes the s76 polish item.
- **"Always reaching for" — recurring brands** on the taste profile. New `recurringBrands(items, min=3)` in `lib/things.ts` (products only, case-insensitive, ≥3 = a real pattern not coincidence; 3 unit tests). Rendered above the colour story, mirroring media's "always loved" creators. Threshold is one arg to tune.
- **Taste icon now matches media**, then **nav icons pulled into one source of truth** — new `src/components/navIcons.tsx` exports `LibraryIcon / TasteIcon / DiscoverIcon / WishlistIcon`; both `BottomNav.tsx` and `ThingsScreen.tsx` import from it (local copies deleted). The taste smiley is now physically one icon across domains — no more sync-by-comment. (Farah: icons should match across domains; a future Things discover reuses the same sparkle.)
- **The restructure itself** — `Tab` is now `'wishlist' | 'taste'`; new `TasteSub = 'profile' | 'moodboard'` (persisted, `nospaces.thingsTasteSub`). The old 3rd "mood" bottom tab is gone (`MoodIcon` deleted); moodboard content + its untagged-backfill/paste-link row moved under taste's moodboard sub-tab. FAB now shows on wishlist (speed-dial) and moodboard (image picker), hides on taste/profile. Paste-to-add and the post-add jump (`goMoodboard`) follow the moodboard one level down. Header kicker + `onMoodboard` derived flag updated throughout.

**Trade-off accepted:** adding a mood image is now one tap deeper (taste → moodboard → +). Softened by keeping the add-FAB prominent on the moodboard sub-tab.

---

### Session 77 (2026-06-24) — Taste synthesis for Things → the editorial taste tab

Build session. Shipped the queued **taste synthesis** as a 3rd Things bottom-nav tab, then reworked it twice on Farah's feedback into an editorial spread, and fixed mood-image auto-tagging. All on `main`, 90 Vitest green, typecheck/eslint/build clean each push. **NOT runtime-verified** beyond Farah's live eyeballing (board behind Google login) — the colour ribbon especially (browser canvas) is unseen; see ROADMAP "Taste tab — runtime-verify the colour story".

**The build (`d6177a9` and 3 commits before it):**
- `api/things-taste.ts` (new) — Haiku, text-only, ~$0.001, on-demand, **never auto-runs**, imports `HUMANIZER_GUARDRAILS`. Seeded from `boardTasteSummary(tasteItems)` (wishlist + mood). Prompt biased to **aesthetic register** (warm/lived-in/refined) over a materials dump — the s76 vibe/tone watch-item. Later hardened against the AI "tidy aphoristic closer" ("the ease of someone who knows…", "it's not just X, it's Y") + abstract psychoanalysing, after Farah flagged the first read felt AI-y.
- `lib/things.ts` — `readTasteSynthesis(board, count)` client helper.
- `usePrefs.ts` — `thingsTaste` + `thingsTasteGeneratedAt` cache (mirrors `tasteProfile`), so a read costs once and only re-runs on "read again".
- `ThingsScreen.tsx` — 3rd `taste` tab (`wishlist · mood · taste`, `TasteIcon`); FAB hidden on it (read-only mirror). Old `ThreadMasthead` removed; the keyword thread **moved off the mood tab onto taste** (mood is now pure inspiration).

**IA decision (was open from s76):** taste is its **own 3rd tab**, not folded into mood — Farah's call once she saw the synthesis warranted room. Easy to collapse later (shared components).

**Two feedback rounds reshaped the taste tab:**
1. *Chips were wrong.* v1 had "what recurs" frequency-count chips that tapped through to a filtered wishlist — Farah found the jump confusing (sets up a "why can't I filter from the wishlist directly?" expectation) and the counts un-editorial. Asked for alternatives, editorial hat on.
2. *Editorial rework (combo of two options she picked):* keywords → small-caps **kicker**; the synthesis → the **hero pull-quote** (25px); a new **colour story** ribbon — real recurring hues **sampled from the board's images** client-side (`src/lib/palette.ts`: tiny-canvas quantise → aggregate → hue-ordered; near-white/black dropped; CORS-tainted images skipped; ribbon hidden below 3 colours). Chips + the taste→wishlist filter jump **dropped**.

**Mood board fixes (also Farah feedback):**
- **Masonry** — the s76 row-by-row grid left big gaps (each row locked to its tallest tile). Switched `MoodWall` to **CSS-columns masonry** (gapless, Pinterest-style). Trade: order is now **column-major** (newest down the left column) not strict left-to-right chronological — reverses the explicit s76 choice; flagged for Farah to confirm (ROADMAP). No JS, no stored dimensions.
- **Mood auto-tag was leaking** — images *did* auto-tag on input, but batch uploads fired all vision reads **in parallel**, tripping the rate-limit; the failures were silent (`silent:true`), leaving images untagged (the "only 11 tagged" mystery). Fixed: batch reads run **sequentially**; `autoTagMood` returns success for honest summaries; new **one-tap backfill** ("read taste for N untagged" on the mood tab) clears the backlog + past silent failures (~1¢/image).

**Live answer for Farah:** the keyword line + tagged-count are computed **live** every render; only the written paragraph is cached (refresh via "read again"). "11 tagged" was real — the rest were untagged (the batch leak above).

---

### Session 76 (2026-06-24) — Mood board (the inspiration half of Things)

Eyeball-then-build session. Opened with Farah's s75 eyeball feedback (all logged to `docs/ROADMAP.md` → "Library + Things polish, s76" for a separate pass — deciding-card grid revert, product-sheet link rework, 7 Library tweaks incl. two flagged for-discussion: scroll-lock stickiness + music-library clutter; plus a parked note on the two big capture pain points — image-share + paywalled-article extraction). Then **built the mood board** (next queued Things build).

**Shipped to `main`** (90 Vitest green — +1 inspiration `itemAttributes` case; typecheck/eslint/build clean). **NOT deployed, NOT runtime-verified** (board behind Google login) and **blocked on a one-time Supabase step** (see below).

**Spec (locked with Farah before building):** a `wishlist | mood` toggle at the top of Things; mood board = pure-inspiration images, not buyable; per-image = image + optional source link (revert to pure-image if links get unwieldy); capture = upload / paste copied image / paste image link (**no email-in** — would collide with a future "email a product screenshot" router); **each image vision-tagged (~1¢) so it feeds the same taste read** as the wishlist. Cost answered for Farah: ~1¢/image, ~2000 images to reach the $20 cap — negligible at real use.

**Build:**
- `lib/things.ts` — new `metadata.kind: 'inspiration'` (`InspirationMeta`, `inspirationMeta()`); `kindOf` + `itemAttributes` extended; a mood image contributes its vision-read attributes to the thread like any tagged thing.
- `lib/mood.ts` (new) — `uploadMoodImage()` (→ `mood-images` Storage bucket, per-user path, 12MB cap) + `moodSrc()` (uploads load direct; pasted URLs go through the `/api/thing-image` proxy so hotlink-protected sources still render).
- `ThingsScreen.tsx` — `tab` state (persisted); `things` = product+intent only, `moods` = inspiration, **`tasteItems = things + moods`** feeds `boardTasteSummary`/`ThreadMasthead` (the masthead reads across both). `MoodWall` (CSS-columns masonry, natural aspect ratios — a pin-up, not cropped tiles), `MoodTile`, `MoodEmpty`, `MoodComposer` (file / clipboard-paste / link), `MoodSheet` (image + tags + source + note + remove + read-taste recovery). FAB is tab-aware (mood = one tap → composer; wishlist = the speed-dial). `addMood()` + `autoTagMood()` (vision read, no cutout).
- `useItems.ts` — duplicate-finder now skips `type:'thing'` (mood images all share the title "inspiration"; products could also collide — fixes both).
- `supabase/schema.sql` — `mood-images` public bucket + owner-scoped RLS (mirror of `thing-cutouts`).

**One-time setup:** Farah ran the `mood-images` bucket block (`supabase/schema.sql`) — uploads work live.

**Feedback round (same session, all shipped + deployed):**
- **Bottom nav** (`wishlist | mood`, `ThingsNav` in ThingsScreen) replaces the top toggle, mirroring the media BottomNav (which App.tsx hides on `/things`). FAB lifted to sit above the bar. 3rd "taste" tab vs. merge-with-mood left as an open IA question (Farah noodling — depends how minimal the synthesis is).
- **Keywords/thread moved to the mood tab only** (off the wishlist) — mirrors media keywords living on Taste, not Library.
- **Capture, mobile-first:** multi-select; the FAB on the mood tab goes straight to the photo picker (one tap); "paste a link" demoted to a soft quiet button (mostly desktop); clipboard image-paste works on the mood tab (window paste listener). `MoodComposer` → link-only `MoodLinkComposer`; a screen-level hidden multi-file input drives all upload entry points.
- **Wall = row-by-row chronological** (Farah preferred over column-major masonry): CSS grid, `align-items:start`, newest first, natural aspect (never cropped), sharp corners, 4px gaps.
- **Note removed from mood images** (pure visual reference) — also fixed a mashed "+ add a note / read taste" line.

**Next (s77):** build **Taste synthesis for Things** (unblocked — `boardTasteSummary(tasteItems)` includes mood). When building: bias the prompt to aesthetic tone over literal materials; settle the taste-tab-vs-merge IA question. Then the s76 polish session.

---

### Session 75 (2026-06-24) — per-item taste-fit one-liner + a long Things polish pass

All **shipped & deployed to `main`** (every step pushed + Vercel-built; 89 Vitest green — 4 new `boardTasteSummary` cases — typecheck/eslint/build clean throughout). Couldn't drive live (login wall); Farah reviewed on the deployed board between rounds.

**1. The per-item "how this fits your taste" one-liner** (the deferred-because-paid piece of s74's product-card value-add; memory `things-taste-synthesis`).
- `api/things-taste-fit.ts` — Haiku, **text-only** (reads the already-extracted taste tags, never an image), ~$0.001, imports `HUMANIZER_GUARDRAILS`. **Cached on `metadata.tasteFit`**, **explicit tap only** (never auto-runs), **gated** to a board with a real read (`thread.length > 0`) AND a tagged item.
- `lib/things.ts`: `boardTasteSummary()` (pure; top recurring values per facet + thread) and `readTasteFit()`. UI = `TasteFitBlock` on the product sheet, with a `re-read`.
- **Voice rework (Farah feedback — the first lines were wooden + category-driven):** dropped `category` from the read entirely; told the model a recurring material (leather) is usually accessories so it stops framing bag-vs-coat as a "departure"; **banned the "X and Y check the boxes, but Z" template**; let it simply affirm a clean match instead of manufacturing a contrast. (Existing cached lines keep the old voice until re-read.)

**2. Things board polish (several feedback rounds):**
- **Deciding card** is now a compact **text box** (no photo): **need leads** (single line + `…`), one detail line below carries the count while deciding or the front-runner once leaning/decided (was opening with "N options" stacked right under the "DECIDING · N" header — too many numbers). Always renders as the card in BOTH list and grid (a plan should look the same either way) — removed `IntentRow`. Product grid title also single-line. Removed now-unused `GRID_ASPECT` + `thingImage` import.
- **Things list view** = flat hairline rows like the media Library (was boxed cards).
- **Product sheet tightened:** narrowed (Sheet got an optional `maxWidth`, product sheet = 380, content 340) so the panel hugs the column instead of floating a narrow strip in a 640 box; **two primary actions only** (buy + got it), every other action a shared `quietLink` text-link (edit/note/taste/put-back/remove/re-read — one size/weight/colour); **one-tap "read taste from photo" recovery** on the main sheet when a product landed untagged. **Auto-tag confirmed working** by Farah after this.
- **Library:** the view (list/grid) switcher now pins to the category row when the header collapses on scroll (was folding away) — matches the Things board's always-visible control row.
- **Masthead copy:** no longer says "tag your things" (auto-tag does it) — points at *saving*.

**3. Roadmap (parked, with decisions captured):** beauty/home/misc products (should be taste-neutral); the **iOS share-to-app Shortcut** (cleanest = a Shortcut that auto-sends an email to `things@nospaces.xyz`, compose-sheet off — NOT the authed API POST that confused Farah last time; iOS/WebKit has no Web Share Target in any browser, so Chrome doesn't help); media **"verdict" reshape** (it repeats the reaction; parked).

---

### Session 74 (2026-06-24) — AI image cutout, board polish, product-card value-add

Long session, all **shipped & deployed to `main`** (every step pushed + Vercel-built; 85 Vitest green, typecheck/eslint/build clean throughout). Farah ran the Supabase SQL, re-polished, and reviewed on the live board — **looks good**. Three arcs:

**1. AI subject cutout** (spec: memory `things-image-cutout`). Heuristic trim made "box-in-box" tiles on styled shots; the fix cuts the product out and floats it on one tile so a mixed board reads as one catalog.
- **Vision → shot type.** `api/_vision.ts` also returns `shotType` (`product`|`onModel`|`lifestyle`) off the SAME Sonnet call (no extra spend); threaded through `things-vision.ts` + `email.ts`. Prompt is **strict**: any visible person ⇒ `onModel` (was letting full-body model shots through as `product` and cutting them — the overalls bug).
- **Browser-side cutout** (`src/lib/cutout.ts`): lazy-imports `@imgly/background-removal` (web/WASM, ~40MB model from imgly CDN, ~2–4s) at save; **trims the transparent margins to the subject** (`CUTOUT_VERSION`, alpha-bbox crop) so products fill the tile instead of floating tiny; uploads the PNG to the `thing-cutouts` Supabase bucket; stores `metadata.cutout` + `cutoutV`. Free.
- **Raw CORS proxy** `api/thing-image?...&raw=1` (`thingImageRaw`): re-encodes the CORS-blocked shop photo so the browser can read bytes for the model; never 302s. Also used to display model/lifestyle photos untrimmed.
- **Build:** the 24MB onnxruntime WASM is excluded from the SW precache (`vite.config.ts` `injectManifest.globIgnores`) and code-split out of the main bundle.
- **Backfill:** "polish images (N to tidy)" in the view sheet — re-polishes items missing a cutout OR on a stale `CUTOUT_VERSION` (free, no AI when shot type's known). Override: product sheet → edit → "show the full photo instead" (`metadata.cutoutHidden`) for a bad cutout; a re-read that flips to model/lifestyle clears a stale cutout.

**2. Board palette → cool gray.** Warm `CREAM` replaced by `TILE = '#ECEDEF'` everywhere (grid, hero, deciding cards). Render rule settled: **product cutouts float on the gray; model/lifestyle photos fill the tile edge-to-edge (cover)** — never floated (floating a photo re-boxes its own bg). Deciding-card neutrals cooled to match.

**3. Product-card value-add** (the card was just "the tile, but bigger"). Now:
- **Tappable taste tags** — tap one to filter the board to what shares it; "· N" = the true match count; one-offs aren't tappable; a removable pill shows the active `tagFilter` (generic facet+value, coexists with the category row).
- **"why you saved it" note** (`metadata.note`) — the card becomes your memory of the item.
- **Note styling** unified app-wide as `src/components/NoteProse.tsx`: the taste page's own voice — warm-graphite (#4A453E) **italic** prose, 13px, small uppercase label ("your note" / "thoughts"). Replaced the boxed Things note AND the media Library's italic block. (Rejected along the way: a big quote-mark pull-quote = cheesy; a serif+rule margin note = stock.)
- **Card width:** the product sheet is capped to the photo's width (360px, centred) so it's one tidy column on laptop, not a small photo in a broad sheet.

**Files:** `api/_vision.ts`, `api/things-vision.ts`, `api/email.ts`, `api/thing-image.ts`, `src/lib/things.ts`, `src/lib/thingImage.ts`, `src/lib/cutout.ts` (new), `src/components/NoteProse.tsx` (new), `src/components/ItemActionSheet.tsx`, `src/screens/ThingsScreen.tsx`, `vite.config.ts`, `supabase/schema.sql`, `package.json` (+`@imgly/background-removal`).

---

### Session 73 (2026-06-24) — Server-side image trim + DecidingCard cover redesign

**All on `main`. Typecheck + eslint + production build clean, 85 Vitest green. Free — the new image endpoint makes zero Anthropic calls (pure pixel work, edge-cached). NOT runtime-verified on the live board (behind Google auth) — wants Farah's eye on the deploy.** Two asks from Farah, both done:

- **Images moved server-side (the robust fix flagged in s72).** The old trim ran in the browser and CORS blocked reading pixels on most shops → off-centre / failed crops (the CH bag, the Free People shots). New free endpoint **`api/thing-image.ts`**: fetches a **higher-res original** server-side (browser-spoofed UA + Referer, same trick as vision — beats hotlink 403s), trims where CORS can't touch us, returns a clean 4:5 JPEG, **edge-cached immutable** after first hit. 302s to the original on any miss; client `<img onError>` also falls back → a photo can never break.
  - **`api/_imageTrim.ts`** — sharp port of the old canvas algorithm (corner-sample bg → centroid-centred bbox → extract+extend-pad → resize), plus `upscaleUrl()` that bumps Shopify-style `_500x` / `?width=` sources to 1600w (kills soft-when-zoomed). Output capped 1200w.
  - Refactored `api/_vision.ts`: extracted `fetchImageBuffer()` (raw bytes); `fetchImageBase64()` now a thin shim over it (one home for the browser-spoof fetch).
  - Client: new `src/lib/thingImage.ts` (builds the proxy URL w/ aspect + referer); `Thumb`/hero point at it; **deleted `src/lib/imageTrim.ts`** + the `useTrimmed` hook (no more async/flash — it's a plain `<img>`).
  - Verified the algorithm on a synthetic off-centre product shot: output centred + filled the frame at exact 0.800 aspect. `upscaleUrl` cases all correct (`_500x500` → `_1600x` = width-only/proportional is intended).
- **DecidingCard → cover-as-background** (`ThingsScreen.tsx`). Front-runner photo (winner→leaning→first) fills the card; frosted title band rides over any photo; **"N options" chip** + a **faint card peeking behind** carry the "pile of options" signal the old thumb-row did. Dropped the "deciding" pill (redundant w/ the `deciding · N` section header — Farah's call). **Settle-state:** once decided, stack + count drop away, band goes solid white, reads `decided · <winner>` — calms down in place (resolved intents stay in the strip).

**Added `sharp ^0.34.5` as a direct dep** (was transitive via Next — pinned so the Vercel build can't break if Next drops it).

**Carried into s74:** Farah to eyeball the live deploy — DecidingCard execution + whether real-shop images are now crisp/centred. Then the build queue: mood board, then Things taste synthesis.

---

### Session 72 (2026-06-24) — Things UX overhaul: undo, gallery card, image auto-trim, two-section board

**All on `main`, pushed across many commits. Typecheck + eslint clean, 85 Vitest green (+ `formatPrice`, `demoteProductToIntent` tests). NONE runtime-verified — the Things board + plan sheets are behind Google auth, so everything here wants Farah's eye on the deploy.** Free except the retro/auto taste reads (existing ~1¢ Sonnet vision, only on tap or on plan→save).

A long iterative session driven by Farah testing live. In order:

- **Undo a decision (both directions).** New `demoteProductToIntent()` (pure inverse of `promoteIntentToProduct`, round-trip tested) → a decided-but-unowned product shows **"↩ put back in plan"** (rebuilds the original intent from `fromPlan`, winner still picked). And the decided IntentSheet got **"↩ change my mind — keep deciding"** (clears `winner` → back to weighing). Fully reversible up until "got it". Only on un-owned items.
- **plan → saved always auto-runs taste.** `onSaveWinner` already auto-tagged but **skipped if the winner carried any tag** (e.g. a manually set category) → left palette/material/vibe blank. Loosened to "run whenever there's an image" (merge-never-clobber fills gaps). And the **no-photo case now flashes** "saved — add a photo to read taste from it" (was a silent no-op — the "no toast the first time" Farah hit).
- **Retro taste button** → "run taste from photo" for anything that landed untagged. First on the main sheet, then (Farah) **moved into edit** + emoji dropped — it's cleanup, not a primary action.
- **Product detail → gallery layout (chosen via AskUserQuestion).** Two earlier passes (info-first, then tighter buttons) still read "database row," so we stepped back. Final: **photo leads as a big hero** (auto-trimmed), close floats over it; name/price/keywords below; actions recede to a quiet row — **`view at <brand> ↗`** (no more giant black BUY bar; it's a mirror not a store), a small `got it` pill, `edit`; remove stays a quiet link. `formatPrice()` → **`$3,600`** (commas, drop `.00`/`.0`; used by `PriceLine` everywhere; unit-tested). Tags → one quiet descriptor line (values only, no facet labels, no redundant "category").
- **Image auto-trim (chosen via AskUserQuestion: "smart auto-trim" over cover/contain).** New **`src/lib/imageTrim.ts`** — client canvas finds the product, crops the background whitespace, re-frames to 4:5 on a matched bg; returns a cropped data URL or **null → caller falls back to original cover-crop** (CORS-tainted shop image, or nothing to trim). **Removed the ambient blur fill + feather entirely** (the grey-halo "not chic" offender). Centering uses the product **centroid** (so straps/shadows don't drag framing off-centre) and **won't upscale** past the source crop (+ jpeg 0.92) for sharper zooms.
- **Two-section board (spec'd + approved).** **DECIDING** = active plans in a swipeable strip up top, new **`DecidingCard`** (need headlined, "N options", a few option thumbs — a plan is a question, not a tile). **SAVED** = wishlist grid below. **GOT** (owned) = **hidden by default**, reachable via "show → got it". The `show` filter picks zones; category tabs filter saved/got, deciding always shows. Removed dead `IntentCard` / `statusBucket` / `matchesStatus` / `Bucket`.
- **Smaller:** dropped the roomy/dense **density toggle** (grid just auto-sizes, `COL_TARGET=220`); **unified plan edit** (one editor for name + context, opened from the context block — the inline-title tap read messy; works on decided plans too); **media bug** — "shows near you" back arrow went to `/discover`, now `/library` (the music view it's reached from).

**Decisions logged:** image = auto-trim; detail = gallery; got-it hidden by default; **bot/scraping risk = low** at personal volume (one fetch per save, no crawling) — keeping the s71 Chrome fingerprint (the gray-area bit); could swap to an honest UA at the cost of more 403s. **Taste-synthesis-for-Things = combo of saved items + mood board, but generates from saved alone too** (starts working as you add items, before any moodboarding).

**Carried to next session (Farah will give feedback tomorrow):**
- **DecidingCard needs work** — the labelled-box treatment is right but not finished.
- **Images still wonky** — off-centre on some (heuristic limit), and **quality is soft when zoomed** on a few. Real cap = source resolution + CORS (trim only runs where the shop allows pixel reads; elsewhere it's plain cover). **Robust fix if it keeps annoying: move the trim server-side** (where we already fetch images for vision, bypassing CORS, and can pull higher-res).
- **Next builds queued: mood board, then taste synthesis** (see ROADMAP).

---

### Session 71 (2026-06-23) — Vision-on-email (close the on-the-go untagged gap)

**On `main`. Typecheck clean, 78 tests green, eslint clean. NOT runtime-verified — the email webhook can't be exercised from the preview; wants a real forwarded product to confirm. Cost: ~1¢ per emailed thing (Sonnet 4.6 vision, one image, only when the thing has an image).**

**Headline task — vision-on-email, greenlit s70.** Emailed things (`things@`/`shop@`/`want@`, plus the strict normal-inbox product fallback) were the ONE capture path landing untagged; client-side saves already auto-tag from the image. Now they auto-tag too.

- **New shared module `api/_vision.ts`** — extracted `fetchImageBase64` + the taste prompt + parser out of `api/things-vision.ts` so both callers use ONE code path (no HTTP round-trip, no duplicated prompt/vocab). Exports `readImageAttributes(imageUrl, referer?)` → `{ok, attributes}` / `{ok:false, reason}`; never throws.
- **`api/things-vision.ts` slimmed** to a thin HTTP wrapper over the shared read (kept the 422-vs-500 split: fetch-failures = user's link, vision/parse errors = ours).
- **`api/email.ts` `captureThing`** now calls `readImageAttributes(fields.image, fields.url)` before insert and stores `metadata.attributes` (same `{facet,value}[]` shape the client uses). **Best-effort:** a vision failure (403 / avif / timeout) logs + saves untagged — never blocks the save. One vision call per email max.
- **Reply copy** — new `tagNote(tagCount)`: if it tagged, "I auto-tagged its look (N taste tags) … tweak in the app"; if not, the old "tag it by hand" nudge.
- **No new abuse surface** — the webhook is secret-gated + sender-allowlisted, so only Farah/Tom can trigger the paid call.
- **Watch:** the literal-`.avif` image-link edge case still fails Anthropic vision (rare; add on-the-fly conversion only if it recurs). The s67 note that "email-in does NOT trigger vision" is now superseded.

**To verify (Farah):** forward a product with a clear image to `things@nospaces.xyz` → reply should say "I auto-tagged its look (N taste tags)"; open it on the board → material/palette/vibe/category chips present.

**Same-session follow-ons (Farah feedback on the live board) — also on `main`, 80 tests green, behind auth so not click-verified:**
- **Failed-forward review on the Things board.** A forwarded product link that can't be scraped *was* logged server-side (`email_captures`) but only surfaced on the Library — invisible from the board. Added `isThingsCapture()` (captures.ts, +2 tests) and a quiet **"N forwards didn't land · review ›"** banner under the keywords masthead that opens the same `CapturesSheet` the Library uses (subject + snippet, which usually holds the URL to re-add by hand). "Clear all" here is **scoped to the things rows** so it never wipes the Library's media captures.
- **Board polish (Farah: "images look messy, header clunky").**
  - **Portrait 3:4 thumbnails** (was square) for grid + hero — lookbook framing, uniform crop tidies a wall of mixed-shop photos. Inline list thumbs (sized) stay square. **Consistency (resolved):** portrait *matches* Library — books/tv/film already render portrait; only music + "all" are square. Farah confirmed fine.
  - **Hairline frame kept + gentle `saturate(0.9)`** on thumbs to mute the warm-cream-vs-cool-grey clash between shops (reversible if it reads flat).
  - **Calmer header — Things-only, Library untouched.** Dropped the second uppercase kicker (`YOUR KEYWORDS`); the keyword line now leads and "your keywords" folds into the caption. The shared editorial chrome (kicker + title + **1.5px rule kept**) is unchanged → Library parity preserved. (Decision: don't lighten the rule; it read heavy only because of the clutter beneath it.)
  - **Density toggle moved into the filter sheet** (now "view & sort") — off the title row, mirroring how media keeps view/sort in a popup. Serif headers were **considered and dropped** this round.

**Image-treatment iteration (Farah live feedback loop — SETTLED, "looks okay, leave it"):** the s71 portrait-3:4-*cover* above was superseded same-session. Final state of the grid/hero `Thumb`:
- **`object-fit: contain` on white at 4:5** — products show WHOLE + centered, uniform "catalog plates" (SSENSE/NAP look), nothing cropped. Beat *cover*, which filled unevenly because shops bake different whitespace into product photos.
- **Ambient blur fill** behind the contained image so tiles fill edge-to-edge: a blurred copy of the SAME photo, **`object-fit: fill`** (NOT cover — fill maps frame-row→image-row so the letterbox bands pull the photo's true top/bottom *background*, not the product in the middle, which had darkened the bands). `blur(28px) saturate(0.9) scale(1.06)`.
- **Edge feather** (`FEATHER_EDGE` mask, both axes intersected) on the sharp image so its rectangular boundary dissolves into the fill instead of a faint tonal seam.
- **Transparency skip** (`useAmbientFill` hook): probes the image via a CORS canvas read; if corners are transparent (cutout PNG) it **skips the fill** (blur would smear the product's own colour into the corners — the "halo"). A CORS-tainted/failed read keeps the fill (safe default).
- *Honest limit:* the fill is a stretched copy of the photo's own bg, so a faint tonal diff can remain on strong-vignette shots. The pixel-perfect fix = sample the true bg colour **server-side** at save (no CORS there) — parked, not needed yet.

**List view + menu reorg (Farah feedback):**
- **List view for the board** — a `grid`/`list` toggle in the view sheet; list = the plan-style row (square thumb + title + price/brand, taste line / plan status). Reuses the deliberation candidate-row look. Persisted to localStorage.
- **Menu reorg:** **category is now the on-page chip row** (primary filter); **status (saved/deciding/got it) moved into the view sheet** alongside layout/density/sort.
- **View sheet restyled to match the Library's `ViewSheet` exactly** (it "looked really different" before) — drag-handle sheet, label-left segmented buttons, ✓ list rows — via new shared `SegRow` / `SheetList` helpers. Removed the now-dead `Pill` + `DensityToggle`.

**Scraper 403 mitigation (free — no API call):** `api/_scrape.ts` now sends a **full Chrome browser fingerprint** (real UA + `Sec-Fetch-*` + `Accept-Language` + `Upgrade-Insecure-Requests`) instead of `Nospaces/1.0`, so mid-tier shops that 403'd the bot UA now serve their OG HTML. Won't beat a real JS challenge (Cloudflare) — those still fall back to manual entry.

**Parked (Farah + me, s71): screenshot-capture for things.** Tempting to mirror media's photo-identify, BUT a thing has no catalog — a screenshot gives name/price/image but **no buy link**, and hand-adding the link on mobile is the exact pain we're escaping. Making it work like media (identify → pull real source URL + info) needs **reverse product web-search** to recover the link = the **expensive web_search API + unreliable** (wrong colour / resale / blog). Not worth it until that's acceptable. The scraper upgrade is the cheap reliable lever instead.

---

### Session 70 (2026-06-23) — New-user audit + editorial pass + decided-item fix

**On `main`. Logic unit-tested (78 green, +2); UI behind auth, not click-verified. Free (no new API calls — but see auto-tag note).**

**Headline task — new-user audit (the "thoughtful consumer" persona).** Walked the real flows as her (architectural taste, anti-salesy, streamlined closet). Verdict: loves the mirror-not-a-store concept + the deliberation flow; **bounces hard on-the-go.** Key finding, grounded in code: the PWA `share_target` in `vite.config.ts` only accepts *images* (not links) and routes to `/add` = the **media** flow — and iOS Safari doesn't support Web Share Target *at all*, so it's dead on her phone regardless. **Farah confirmed:** they tried share-target + Shortcuts, both failed, email is the settled on-the-go mechanism. So the real gap = **email-in lands things untagged** (vision is a server-side cost boundary), exactly the captures that most need auto-tags. → **vision-on-email is now the #1 functional priority (greenlit by Farah, ~1¢/email-thing, to build next).** Dropped my "fix share target" rec (iOS won't honor it).

**Designer pass (persona + a designer's eye).** App reads "clean tech-startup," not "editorial magazine." Shipped fixes this session (B&W kept — Klein blue `#002FA7` is manifest-only/invisible; Farah: keep B&W, Library drifted off it):
- **De-badged cards** — status pills off the photos → quiet caption text (`ProductCard` "got it", `IntentCard` "deciding · N options"). Images stay clean.
- **No dashed borders** — `Thumb` `dashed` prop removed; intent cards use the same solid matte. Dead `Tag` component deleted.
- **One control row + filter icon** — category + sort moved off the board into a new **`FilterSheet`** (bottom sheet) behind a sliders icon; a dot on the icon flags when a hidden filter/sort is set. Status filters stay as the single visible row.
- **Status chips 5 → 4** — dropped the standalone **"decided"** chip; `matchesStatus` folds decided under **"deciding"** *for filtering only* (card still reads "decided · X", attribute-counting + the save-as-product CTA unchanged). One-line revert if Farah wants it back.
- **Stronger active state** — `TabChip` active now carries a 1.5px underline rule (italic alone was unreadable on a phone).
- **Lowercase toggle** — `DomainSwitcher` reworked: iOS segmented pill → editorial `media / things` split by a hairline, active word ink-bold. **Shared component → also changes the media Library top — eyeball there.** (Reverses the s66 "keep caps" call, with new rationale: the designer pass.)
- **Renamed** masthead "your thread" → **"your keywords"** (+ nudge copy). Internal `readThread`/`ThreadMasthead` names unchanged.
- **Font:** kept **Geist** for now (rejected a Fraunces serif-pairing prototype — revisit later if wanted). The serif/sans-pairing critique stands as the biggest unshipped "chic" lever.

**Decided-item bug (Farah caught it).** A promoted product's `metadata.fromPlan` (losing options + brief) was stored but **never rendered** — no way to pull passed-on cards back. Fixed: new **`productPlan(item)`** accessor (`things.ts`) + a **`PlanReveal`** in `ProductSheet` ("decided from N options ›" → expands the brief + the options you passed on, each linking out). +2 unit tests.

**Promote auto-tag gap (Farah caught it).** Saving a decided winner (`onSaveWinner` → `promoteIntentToProduct`) skipped the vision auto-tag that a *direct* product save runs — so promoted products never fed the keywords/filters. Fixed: `onSaveWinner` now fires `autoTagFromImage` when the winner has an image + no tags (~1¢ Sonnet vision, the **already-approved s67 auto-tag-on-save** path, not the parked email path). `fromPlan` survives the patch.

**Auto-tag coverage now:** direct product save ✅ · decide→save winner ✅ · email-in ⏸️ (parked, greenlit to build next).

### Session 69 (2026-06-23) — Things lifecycle: decided → save-as-product workflow

**On `main`, deployed. Logic unit-tested (76 green, +3); UI behind auth, not click-verified.** Cost: free (no API/Anthropic — pure client transform + Supabase edit).

**The gap Farah spotted:** "decided" and "got it" were the same bucket — picking a plan's winner jumped it straight to "got it" even though deciding ≠ owning, and the decided plan stayed a plan-shaped card forever. Decided lifecycle questions from the menu round folded in here.

**New lifecycle:** `product: saved → got it` · `plan: deciding → decided → [save winner → becomes product] → saved → got it`.

**What changed:**
- **`itemAttributes` now gates the intent winner on `winner != null`, not `status === 'done'`** (`src/lib/things.ts`). A *decided* plan feeds the thread the moment a winner is picked, even before it's owned. Old resolved intents (status:done + winner) still count — backward compatible.
- **`promoteIntentToProduct(item)`** (new, in `things.ts`) — turns a decided plan's winner into product metadata *in place*; preserves the whole deliberation (all candidates, brief, original need) under `metadata.fromPlan` (productMeta ignores the extra key). Returns null if no resolvable winner.
- **`statusBucket` reworked** (`ThingsScreen.tsx`): plans bucket by winner (`deciding`/`decided`), products by status (`saved`/`got`). New `decided` tab in the status filter (now 5 chips: all/saved/deciding/decided/got it). **Note:** legacy resolved plans now show under *decided*, not *got* — they can be promoted to real products.
- **`onResolve` no longer sets `status:'done'`** — just sets the winner. `onSaveWinner` does the promote (→ product, status `want_to` = "saved").
- **IntentSheet:** "decided" is now winner-based; added a self-explaining CTA block in the decided state — "you chose X… save it to your things →" + "this plan's history stays with it." IntentCard's "decided" tag is winner-based too.
- **ProductSheet save** now spreads existing metadata first, so a promoted product keeps `fromPlan` through a manual edit.
- **Tests:** +decided-counts-before-owned, +promote-keeps-history, +promote-null-without-winner.

**Design calls (Farah picked both recommended):** decided plan *becomes* the product (vs keep both — avoids double-count + clutter); decided gets its own bucket (vs lumped in got it). Save is a deliberate button, not auto-on-resolve (deciding ≠ buying).

**Also this session — manual grid-density toggle.** `roomy`/`dense` segmented control (`DensityToggle`, two grid-icon buttons) in the Things title row, shown only when >1 thing. `roomy` = today's behaviour (px-target 240); `dense` = denser (168). It feeds the existing responsive `ResizeObserver` measure (`floor(width / DENSITY_TARGET[density])`) rather than a fixed column count — so it scales with viewport (≈3-up dense on a phone → more on desktop), which suits Things' full-bleed layout better than Library's literal 3|4. Persisted to `localStorage['nospaces.thingsDensity']`. Pure UI, no tests (logic is one divisor constant).

**Parked w/ reasoning — vision-on-email-in.** Farah flagged it likely-important: on phone/on-the-go you forward/email rather than paste links, so email captures are exactly the ones that most need auto-tagging. Deferred for now (cost), noted in HANDOFF open-items + queued for the new-user audit (s70) to stress-test.

**Queued for s70:** new-user audit as a specific persona (architectural taste, anti-materialist, thoughtful-consumer, streamlined closet) across laptop / phone / on-the-go contexts. Persona verbatim in HANDOFF.

**Eyeball on live (behind auth):** the new `decided` tab, the save-winner CTA, and that legacy resolved plans now read as "decided" with a save button. `fromPlan` history isn't surfaced anywhere yet — it's just preserved (could power a "decided from N options" detail later).

---

### Session 67 (2026-06-23) — Slice 4 (first paid vision surface) + two Things UI fixes

Short session. Opened on the s66 stop-point (verify email-in); Farah confirmed **email-in works** (the normal-inbox auto-fallback landed). Then two quick bug fixes she flagged + the main job, Slice 4.

**Two UI fixes (the "aesthetic feels different" report).** Root cause of the lowercase complaint: the card `⋯` **menu items** were Title Case (`Edit`/`Got it`/`Remove`) while the rest of the app is lowercase — lowercased those + the sheet `<h2>` titles, the capture buttons, the "save context" button, and the long descriptive placeholders. Kept single-noun field placeholders (`Name`/`Price`/`Brand`) capitalised to match the media side's `Title`/`Creator`/`Year`. Bigger fix: **Things had no editorial header** — every other page (incl. its sibling Library) leads with the magazine kicker + 1.5px ink rule, Things jumped straight to the switcher + a rounded masthead card. Added the shared header (uppercase kicker `N on the board` + lowercase `things` title + rule). That was the real "feels different" cause.

**Slice 4 — paid vision attribute-read (auto-on-capture).** Stated cost first per the rule: **Sonnet 4.6 vision ≈ $0.01/call** (one downscaled image ~1.3–1.6K tokens + ~600 prompt + ~150 out; ~5–10× a Compare call; ~2,000 captures/mo before the $20 cap bites). New `api/things-vision.ts` mirrors `things-compare` exactly (auth, rate-limit 40/hr, JSON-only). Reads the **look not the identity** — prompt explicitly forbids brand/logo/text recognition — and returns `{facet,value}[]` constrained to the four masthead facets (material/palette/vibe/category), one per facet, mapped onto the existing vocab. Anthropic vision takes the **image URL directly** (capture is link-based, so the image is always a URL — no download/base64). Client `readImageAttributes()` in `things.ts`. Wired **auto-fire**: `ProductComposer.onSave` → `autoTagFromImage(id, f)` runs in the **background** after the save (instant save; tags patch in a few seconds later; merges-never-clobbers manual tags). Farah picked **auto-on-capture** over an opt-in button — the whole point is the board mirroring her with zero tagging (also covers her "auto-category" ask). `type:'thing'` isn't in `GENRE_TYPES`, so no genre/vibe double-charge. Email-in `captureThing` (server-side) does NOT trigger vision — a natural cost boundary, flagged in ROADMAP-via-HANDOFF for a later call.

**Verified working on deploy (same session), after a debugging round.** First test: tags didn't populate. Made the silent best-effort call **visible** — a board toast showing the result (sticky + tap-to-dismiss on failure). That turned guesswork into a precise signal and surfaced two image-fetch gotchas worth remembering for any future vision work:
1. **Retail CDNs 403 a bare URL.** Passing the og:image URL straight to Anthropic's fetcher got 403'd (Shopify-style hotlink/bot protection vs. datacenter IPs). Fix: the endpoint **fetches the image itself** (browser User-Agent + **Referer/Origin** = the product page) and sends **base64** — reused `isSafePublicUrl` from `_ssrf` for the SSRF guard.
2. **Accept-header content negotiation → AVIF.** Our `Accept` listed `image/avif` first, so CDNs served AVIF — which Anthropic vision rejects ("bad-type-image/avif"). Fix: ask only for webp/png/jpeg/gif. *Still open:* a link that is literally a `.avif` file (no negotiation) fails — add conversion only if it recurs.

After both fixes, tags auto-fill correctly. Also lowercased **all four** FieldsForm save buttons (the edit/candidate ones were missed first pass) and forced board card titles lowercase (`textTransform`) so shop ALL-CAPS names read uniformly. 73 Vitest green, typecheck clean.

### Session 66 (2026-06-23) — "Things" Slices 1–3 + 2 feedback rounds (masthead, switcher, email-in, compare reviews)

Big session. Started by syncing `main` (Slice 0 / PR #16 was merged but local main was stale + the s65 docs commit `6f203b1` had been left out of the merge — recovered it). Then built Slices 1→3 and the Slice 2 masthead, and did two rounds of Farah's board feedback. **Switched to committing straight to `main`** (no feature branches — Farah's call, the branch dance was causing confusion). All Things work rides the existing `Item` model.

**Slice 1 — attribute model + pure "thread" reader (free).** `Attribute = {facet, value}` on things; **flat free-text tags, not a frozen enum** (vocab grows from real saves — couldn't query the live DB). `readThread(items): Thread|null` — dominant *recurring* value (≥2 items) per aesthetic facet, null below 4 tagged items. `AttributesEditor` in `FieldsForm` + a per-card read. Vitest-covered.

**Slice 3 — domain switcher (pulled forward; free).** Farah hit the temp setup *leaking* things into the media Library as broken cover-art cards. Fix: `DomainSwitcher` (top-level `Media/Things` toggle, settled IA) on every primary screen; temp 4th nav tab gone; `type:'thing'` filtered out of Library/Discover/Taste at source; the board is its own world (own capture buttons, media nav + FAB hidden on `/things`).

**Slice 2 — live "thread" masthead (free).** `ThreadMasthead` surfaces `readThread` on the board: ≥4 tagged → "muted · wool · structured"; below → a gentle "tag a few (n/4)" nudge. **Comparison-table-along-axes dropped** (Farah: "doesn't feel necessary").

**Feedback round 1** (4 design Qs answered): **Form facet → Vibe** (holds shape + attitude: bold/statement/chunky; legacy `form` tags mapped forward via `LEGACY_FACET`/`normAttributes` so nothing saved is lost). Category dropped from the thread read (it's a *what*, not a vibe). Category leads the tag editor. **Light board sorting** (`recent/price/a–z`, `sortThings` + tested `priceValue`). Compare result made dismissable. Fixed a Slice-1 bug where editing a candidate wiped its tags. Plans stay untagged (brief covers it). Card-resize bug fixed (`minmax(0,1fr)` + `align-items:start` — a no-wrap tag line was stealing column width). **Scraper:** `og-parse` now reads **JSON-LD `schema.org/Product`** (name/brand/price) — fixes generic-`og:title` misses like "Woman".

**Feedback round 2:** switcher reverted to **caps** (those were fine — the lowercase gripe was about the broader UI, NOT the switcher; all-lowercase is already a locked REFERENCE constant). Dropped the redundant "THINGS / your board" header on the board. **Category filter** row (`categoriesOf` + chips). **Email-in for things (free):** forward a product link to `things@nospaces.xyz` (`shop@`/`want@`) → scraped + saved as a `type:'thing'` product, **no Anthropic call**. Extracted the scraper into shared `api/_scrape.ts` (og-parse + email both use it); routed by recipient local-part (`THINGS_EMAIL_LOCALPARTS`); dedups by URL. **Compare cheap-reviews (free-ish):** Compare now reads each candidate's own product page (`description` + JSON-LD `aggregateRating`) for context — no web search, still Haiku (~$0.001–0.002/call). **Parked (Farah-flagged):** full web-search reviews (Reddit/blogs) — pricey, she'll decide.

**Email-in follow-up (live test failed → fixed):** Farah tested email-in; nothing landed. Cause: she sent to her **normal media inbox**, not `things@` — so it ran the media flow and gave up, and no reply came (talkback gated on Postmark approval → board is the only signal). Fix (push `3f9f08d`): the **normal inbox now auto-saves a thing** when an email yields no media but has a *product-like* link (`captureThing` helper, strict `productLike` gate = JSON-LD Product / `og:type=product` / has price, so articles don't become cards); refactored both the `things@` branch and the fallback onto the shared helper; `extractEmailUrls` now also reads HTML `href`s (forwarded shop emails are HTML-only). **Still unverified on deploy — this is the s67 pickup point.**

**Verification honesty:** typecheck + 73 Vitest green throughout; Vite serves all components, no error overlay. But **could not exercise anything behind Google auth or any `api/` path locally** (`api/` only runs on Vercel). So: the masthead/editor/switcher/sort/filter need an eyeball on the live app; **email-in + the JSON-LD scraper + compare-reviews can only be verified on the deploy.** Farah's 3 existing saves are untagged, so the masthead shows the nudge state until she tags them (by design). One infra check for Farah: confirm Postmark inbound is domain-wide so `things@` reaches the webhook.

**Decisions:** Form→Vibe; plans untagged; sorting yes; category out of thread; compare reads product-page (cheap) not web (parked); commit-to-main (no branches).

---

### Session 65 (2026-06-23) — Built "Things" Slice 0; gut-check PASSED

First real build of the Things domain (the s64 composition-over-reaction design). All on branch `things-slice-0` (PR open; not yet merged to `main` as of session end). Everything rides on the existing `Item` model — `type:'thing'`, shape in `metadata.kind` (`'product'` | `'intent'`) — **no DB migration**.

**Shipped (6 commits):**
- **`api/og-parse.ts`** — free product-link reader: paste URL → server reads OG/product meta tags → `{title,image,price,brand,siteName}`. SSRF-guarded (reuses `_ssrf`), auth + rate-limited, reads only `<head>` (512KB cap). Timeout 13s + `maxDuration:20` (some luxury sites — Max Mara — sit behind bot protection and won't yield to a server fetch; the manual-add fallback is the answer, not a longer timeout). **No Anthropic call.**
- **`src/screens/ThingsScreen.tsx` + `src/lib/things.ts`** — the board. Two capture paths: **Save a product** (paste → preview → save) and **Plan a purchase** (intent → add candidate links → ★ leaning → "pick this one"; losers persist as signal, no archive). `reaction` stays null; "got it" = a `status:'done'` accent. Temp **4th nav tab** to reach `/things` (real domain switcher = Slice 3).
- **Edit + manual fallback** — shared `FieldsForm`: edit any product/candidate (swap photo via image URL, fix junky OG titles, price/brand/buy-link); failed scrape offers "add it manually" so it's never a dead end. Edit products from the board via the card ⋯ menu.
- **On-sale** — optional "Was" price → card shows struck-through original + a "sale" tag (UI-only).
- **AI Compare (first PAID surface in Things)** — `api/things-compare.ts`, **opt-in only** ("Compare these" button at 2+ candidates). Haiku, text-only (names/brands/prices, no images), **~$0.001/tap**, 30/hr cap, uses `HUMANIZER_GUARDRAILS`. Returns a one-line take per option + a ✨-leaning marker + a short verdict ("a quick AI take — your call").
- **Plan brief** — a plan carries free-text context (budget/occasion/must-haves/dealbreakers), set at create or edited later in the sheet; fed into Compare so it weighs what actually matters.

**Bugs fixed mid-session:** inputs trimmed on every keystroke → spaces eaten ("Max Mara" untypable) → now trim on save only. `useItems.addItem` now returns the new id (so the intent flow auto-opens).

**Verdict:** Farah — "slice 0 passes the gut check, this is definitely useful to me." The Compare voice reads right (humanizer working on a tiny payload).

**Decisions:**
- **Comparison table along axes** — DEFERRED to Slice 1. A good table needs consistent axes (material/fit/palette) = the attribute model. A hand-rolled table now would be half AI-guesses. Build the real one once attributes exist.
- **Image policy** — keep the reliable `og:image` packshot by default (consistent board); photo-edit lets Farah swap in a worn/model shot by choice. No flaky auto gallery-scraping.

**Infra fix (recurring blocker, now solved):** Vercel **preview** deploys bounced login back to prod (`nospaces.vercel.app/library`) regardless of start URL → previews were untestable behind auth. Root cause: Supabase only honors redirect targets on its allow-list; preview subdomains weren't listed, so it fell back to Site URL. Code (`redirectTo: window.location.origin`) was already correct. **Fix: Supabase → Auth → URL Configuration → Redirect URLs → add `https://*.vercel.app/**`.** (Farah to apply.) Saved as memory `preview-auth-redirect`.

**Cost this session:** $0 spent (og-parse free; Compare couldn't be exercised locally — `api/` only runs on Vercel — so no test tokens burned). Compare's live cost is ~$0.001/tap once used on the deploy.

> _Recovered s67: this entry lived in commit `6f203b1`, which PR #16 never merged (cut one commit short at `fbbadb9`). Restored into `main` after the fact._

---

### Session 64 (2026-06-23) — "Things" design reworked around composition-over-reaction (design only, no app code)

Pure design session. Pressure-tested the s63 "Things"/shopping design before building.

**The flaw found.** The app's soul is the react→profile loop. But for objects it doesn't fire: you *want* a thing (no reaction yet), then you log only *standout-loved* owned pieces — so you've self-selected for love before any rating. `loved_it/eh/not_for_me` is foregone and carries no signal. The differentiator was thinnest exactly where s63 bet most.

**The repivot — composition over reaction.** The taste signal is the **set**, not the verdict. Saving a thing *is* the taste act (moodboard pin); the aesthetic emerges from **recurring attributes** across saves and works with **zero owned items**. Knock-on fixes:
- **Attributes** (material/palette/form/price-tier/category) replace reaction as the engine; profile = the recurring pattern ("warm minimalism · natural materials · muted palette").
- **Mirror is immediate:** a live "your thread" masthead on the board from ~6 items — not a deferred phase-2 page. Kills the "empty room" risk.
- **Capture precision fixed for free:** the vision call's job flips from *identify the product* (hard, low-confidence, wrong-brand poison) to *describe attributes* (what vision is good at + what the profile needs).
- **Brand** demoted from `creator`-spine to one optional facet (vintage/no-brand = peak signal).
- **"Own"** shrinks to a "got it" accent (no mark-done sheet, no inventory lifecycle); `reaction` stays null for things.
- **Scope** admitted clothing-first (tech/beauty/other = bucket, not promised a profile).

**Intent/candidates — corrected back to first-class.** Initially demoted it as a possible edge case; Farah corrected — she's a deliberative comparison shopper, it's her make-or-break feature and must be in v1 + the Slice-0 gut-check (kept *opt-in* so wishlist-only users skip it). Composition makes it *easier*: losers are still signal, so we **never archive** them — resolve is just `done` + winner flag, winner optionally graduates to its own board item. No new lifecycle state.

**Re-sliced build plan** (in HANDOFF "Next session"): Slice 0 free gut-check incl. the deliberation flow → 1 attribute model + pure "thread" reader (+test, vocab waits for real items) → 2 board+masthead → 3 domain switcher → **4 = first paid surface** (Sonnet vision attribute read, state cost first).

**Process note:** caught my own over-eager demotion of intent/candidates — the user's actual shopping behavior overrides the "probably an edge case" heuristic.

Cost $0 (no API calls, no app code). `docs/ROADMAP.md` rewritten (s63 react-loop version replaced). Pushed to `main` (`6816e01`).

---

### Session 63 (2026-06-23) — Regions / country filter shipped (5 iterations to get the backfill right) · filter sheet trimmed · shopping expansion designed

Big session. Cost: **$0** (all Wikidata/Wikipedia reads, no Anthropic). Commits `a526d56..6e1d56a` on `main`.

**1. Regions / country filter — built, then debugged hard against Farah's real 835-item library.** Final design: country-only (film/TV = the *work's* `P495`; book/music = the *creator's* country), language `P364` deferred. The build is straightforward; the backfill at scale took five passes:
- **v1 build:** `api/wiki.ts` `wikidataFields` returns `countries[]`; `ItemActionSheet` auto-fill captures region; new `src/lib/regions.ts` backfill; `LibraryScreen` "region" filter group (mirrors `series`) + a "pull regions · N" ⋯-menu action with progress toast. First run tagged only 36/835.
- **Fix A — bands:** `P27` (citizenship) only exists on *people*; a band has none. Broadened book/music to `P27` ∪ `P495` ∪ `P17`, + formation-place `P740`→`P17` fallback, + use the work entity's own country when the article resolved to the creator (e.g. a book landing on the author page).
- **Fix B — over-tagging:** Ulysses came back France/UK/Ireland/US. A person's `P27` lists every nationality they nominally held, and books were wrongly using the work's publication-country `P495`. Now: **primary citizenship only** for people (books/solo music), multi kept only for film/TV `P495` (real co-productions) and bands; never the work's `P495` for books; roll historical states up to modern (`HISTORICAL_COUNTRY` map). Added `REGION_VERSION` stamp so logic changes auto-reclean already-tagged items on the next pull.
- **Fix C — partial coverage (older items dropped):** root cause was **architecture**, not Wikipedia. The browser made one Vercel serverless call *per item* (835×3 workers × retries) → overran Vercel Hobby's concurrent-function limit; films (most work per call) failed most. Tried a server-side batch endpoint — came back empty because **Wikipedia rate-limits Vercel's shared cloud IP** and the server try/catch masked it as "no country".
- **Fix D — the real fix:** the backfill now calls **Wikipedia/Wikidata directly from the browser** (`origin=*` CORS, confirmed `access-control-allow-origin:*`), from Farah's own residential IP (which Wikipedia serves freely), no Vercel in the bulk path. Folded the Q-id lookup into the search (one call), concurrency 3, exponential backoff on 429, resumable (failures left untagged, re-run mops up). Removed the dead server batch endpoint. Autofill still uses `/api/wiki` for single items. **Status: progressively filling in across re-runs** — Farah keeps tapping "pull regions" and coverage climbs each pass. Resolution verified live across many titles (Parasite, Casablanca, Seven Samurai, Battle of Algiers→Italy/Algeria, Stalker→Soviet Union, OK Computer→UK, Ulysses→Ireland).
- **Open follow-up:** if coverage plateaus with a stubborn failed count, the browser-direct approach is hitting Farah's own IP rate-limit → slow it down further (lower concurrency / add pacing). Otherwise done. (Language axis `P364` parked in ROADMAP.)

**2. Filter sheet trimmed** (`LibraryScreen.tsx`) — it had grown into a wall (vibe ~24 + verdict + genre ~24 + series + region, all expanded). Each group is now a **collapsed one-line header** that expands on tap; groups with an active selection start open; header shows the selected count. Long scroll → short menu.

**3. Shopping / "Things" expansion — designed** (no code). Full write-up in `docs/ROADMAP.md` → "Expansion beyond media". Key decisions: **domain-switcher IA**, shopping first; **want/own but NOT a closet app** (own = a love signal, not inventory); the standout **intent + candidates** model (a want can be a concrete product *or* an intent like "black clogs" holding candidate options you weigh, lightweight `metadata.candidates[]`, "pick this one" resolves it); **capture** = link-paste (free OG parse) + photo (1 vision call) + AI-suggest candidates, with paid product-search deferred (no free product catalog like media's TMDB); **category + subcategory vocab** mirroring the genre pattern; aesthetic profile = phase 2.

**Verified:** typecheck (UI + api) + 56 tests green throughout; live resolution proven via standalone scripts. **NOT visually verified** — OAuth wall blocks the authenticated Library/filter preview (same constraint as s62). Filter trim + region filter need a phone eyeball.

---

### Session 62 (2026-06-23) — #6 editorial feel: Add + Library brought up to the taste/discover bar

Continued **#6 (editorial feel app-wide)**. Taste + Discover were already the benchmark; this session closed the gap on the two screens that lagged. **Pushed to `main` (direct push, 2-user workflow): `b7820e8..3ee3016`.** Cost: $0 — pure UI, no `api/` touched.

Shipped:
1. **`AddScreen.tsx`** — was a plain utility form. Added the shared `PageHeader` (kicker "to your library" + "add" + rule, close × in the right slot), replaced ad-hoc debug greys (`#E4E4E4`/`#E2E2E2`/`#F7F7F7`/`#555`/`#999`/`#AAA`/`#111`/`#F4F4F4`/`#DEDAD6`) with `INK/GRAPHITE/MUTE/HAIR` tokens, warmed the "nothing found" prompt to the `#FAF9F7` editorial wash, lowercased the brand links (letterboxd / spotify).
2. **`LibraryScreen.tsx`** — already had the inline magazine header + palette (the "don't touch" items). Light grey-cleanup: collapsed ~25 one-off greys to the four tokens **by role**, preserving the shared cross-screen vocabulary (`#111` active text, `#888` inactive chip, `#DDD` separators, `#E8E8E8` borders, `#E0E0E0` grabber — these match Discover, so they stayed). Lowercased "loading…" + the search placeholder; added palette constants at the top so future edits don't reintroduce one-off hexes.

**Verified:** typecheck (UI + api) + 56 tests pass; clean dev-server compile. **NOT visually verified** — the dev preview sits behind Google OAuth, so the authenticated Add/Library screens couldn't be screenshotted. Farah to eyeball on phone.

**Flagged, left as-is:** the library empty-state line "go listen to some music you loser" reads as inside-joke banter — fine for a 2-person app, Farah's call.

**Spotify re-sync Q (answered, no code change):** confirmed from `src/lib/spotify.ts` how a non-first sync behaves — old albums skipped (deduped by accent-folded title+artist OR spotifyId), only genuinely-new saves added as **done** (first sync = want_to). Sync only *inserts*; it never updates an existing item, so an album already in the library as "want to" stays "want to" even if re-saved on Spotify. Edge case: meaningfully different title/artist spelling with no shared spotifyId could create a duplicate-as-done (dupes sheet catches it).

---

### Session 61 (2026-06-23) — Humanizer guardrails propagated to all prose endpoints (one shared source)

Acted on the s60 standing principle: *all* AI prose must not FEEL AI-written. Instead of pasting the s60 guardrail block into three more files (the drift trap the genre-vocab note warns about), extracted it to **one home**.

Shipped:
1. **New `api/_humanizer.ts`** — exports `HUMANIZER_GUARDRAILS` (the full anti-AI-writing block from s60). Edit the voice here, it propagates to every importer.
2. **`api/taste-profile.ts`** — now imports the shared block instead of its own inline copy (no behavior change; just no longer the only copy).
3. **`api/recommend-feeds.ts`** — discovery **"why"** lines now carry the guardrails (the most-read AI prose in the app). Appended after the per-mode prompt as a "someone will read this" note.
4. **`api/recommend.ts`** — item **blurbs** get them too (both web + PDF prompts), scoped to "when you write from your own knowledge rather than quoting the source" since blurbs are mostly extractive.

**Correction to the s60 handoff:** `api/blurb.ts` is NOT an AI endpoint — it extracts summaries from Open Library / Apple Books, no Anthropic call. It was listed for propagation by mistake; left untouched. (Noted in memory `humanizer-prose-guidelines`.)

**Verified:** both typechecks pass (UI + api). Ran **one** Sonnet test call (~1¢, well under cap) mirroring the in-taste "why" prompt — prose came back genuinely human ("Robinson writes domestic life like weather passing through a room"; "the architecture is all negative space"). No puffery, filler, or rule-of-three. Temp test script deleted after.

Cost: $0 for the edits; ~1¢ for the single verification call.

---

### Session 60 (2026-06-23) — Farah's s59 feedback: island "why" field, humanizer prose prompt, add-confirmation, gitleaks CI fix

Discussion-led session on the s59 redesign, then shipped. **Pushed to `main` (direct push, 2-user workflow); Farah verified the detail sheet on phone — looks good.** Costs: only the taste-profile regen costs (1 Sonnet call); ran **one** test gen (~1¢) to demo the new voice. Everything else free (UI + freeform metadata + CI config).

Diagnosed **why taste felt less chic than Discover**: covers were fainter (opacity .32 vs .42, image masked in later) *and* — the real reason — the desert-island rows carried no prose, while every Discover row has its italic "why." The empty rows read as a bare index.

Shipped:
1. **Island "why" field** (`metadata.canonNote`) — its own love-note, **separate from the library note** (deliberate: notes are working scraps, the why is the editorial statement). Surfaced as a one-line italic in each pick row (the Discover line that was missing → fixes the "chic" gap). In the detail sheet it **reads as prose with an `edit` link** (first pass shipped an always-on textarea — Farah flagged it looked like a form; reworked to read-by-default + edit/save/cancel, empty state = "+ add why" link). **Library note hides once a why exists**; shows muted only as fallback material when no why yet. Row + `islandWhy()` fall back to the library note so existing picks aren't blank.
2. **Cover chic bump** to match Discover: opacity .32→**.42**, mask 38%→**30%**, numeral 88→**96**.
3. **Add picker confirmation** — tapping `add` now shows **"added ✓"** + dims the row (snapshot the candidate list on open so the item doesn't silently vanish), instead of the old no-feedback drop.
4. **Removed the ◇ glyph** next to the "desert island" chip in `ItemActionSheet` (the chip still darkens when on).
5. **Humanizer prose prompt** (`api/taste-profile.ts`) — rewrote the system prompt: "sharp friend, not a critic/brand" voice + a full **anti-AI-writing guardrail block** (puffery, connective filler, rule-of-three, negative parallelism, trailing -ing clauses, dressed-up copulas, vague attribution, synonym cycling, false ranges, manufactured staccato punchlines, aphorism formulas, fake-candid openers; em-dashes allowed where natural). Source: **`github.com/blader/humanizer`** + the Wikipedia "Signs of AI writing" article. Model **claude-sonnet-4-5 → claude-sonnet-4-6** (same cost, better prose).
6. **gitleaks CI fix** — `gitleaks-action@v2` now demands a (org-paid) `GITLEAKS_LICENSE` even on personal repos, failing the run. Swapped to the **free gitleaks CLI** (pinned v8.18.4; download URL verified 200). The `test` job was always passing — only the secret-scan job was red, and it never affected the live site (Vercel deploys independently).

**Standing principle logged** (ROADMAP + memory `humanizer-prose-guidelines`): *all* AI-generated user-facing prose must not FEEL AI-written and must carry true insight. taste-profile is done; **propagate the guardrail block to `blurb.ts` / `recommend.ts` / `recommend-feeds.ts`** when next touching them.

`TasteScreen.tsx` changes: `islandWhy()` helper, `CanonRow` (why line + cover bump), `CanonDetailSheet` (read/edit prose + library-note fallback), `CanonAddSheet` (snapshot + added ✓), `saveCanonWhy` handler. typecheck + lint + 56 tests clean throughout. Commits `7281535`, `eb07fa4`.

---

### Session 59 (2026-06-23) — Taste page redesign: tabbed (profile / desert island) + numbered, curatable desert island

Took the s58 desert-island rows further into a full **taste-page redesign**, using Discover's editorial principles as the benchmark. Critiqued the page cold first (read like a dashboard of stacked modules, not a magazine; grey wall of prose; note-less desert-island rows = empty colour bands). All work **free — pure UI + one freeform-metadata field, no API.** Every step **unverified on phone** (taste page is auth-gated; preview only reaches Google login) — Farah tests in s60.

Shipped, in order:
1. **"The gap" → plain-English sentence** with the two genres bolded — *"You keep adding **indie** but finish **drama**."* (was `adding indie · finishing drama`, read like debug data).
2. **Tabbed page.** Split into two chip-tabs (the Discover/Library idiom): **profile** (vibe headline + AI prose + the gap + always loved) and **desert island** (the picks). Kills the tonal whiplash — each tab is one register. Tabs sit directly under the header so they stay anchored. `TabChip` mirrors Discover's stream chips.
3. **Vibe headline** moved *into* the profile tab (it describes the profile, not the picks; also stops the desert-island tab opening top-heavy). Tried a big **stacked masthead**, then reverted to **inline · middots** (reads as one identity, not a list) with per-word `nowrap` so it never breaks mid-word (the old `off-kilter` hyphen-break). Dropped a drop-cap + pull-quote experiment as too try-hard. Removed the rule between headline and prose (they read as linked).
4. **Numbered, curatable desert island** (the big build). Replaced the noted/un-noted split with a ranked list:
   - Uniform **numbered rows** (Discover countdown numeral, reset per medium); note no longer in the row.
   - **Tap a pick → detail sheet** (reuses `SheetHero`): poster + rank watermark + the note as the "why".
   - **Edit mode** (`edit`/`done` toggle): reorder with **▲▼ arrows** (chosen over touch-drag for mobile reliability) + remove (✕). Writes `metadata.canonRank` via `patchMetadata` (optimistic, no refetch). **No schema migration** — `metadata` is freeform JSON.
   - **Add picker**: your loved items not yet canon; enforces a **5-per-medium cap** (scarcity is the point of a desert island). Add appends to the bottom (rank = current count) — no pick-a-number-at-add (friction + slot collisions).
   - Order falls back to add-date until the first reorder, then ranks are concrete.

New components in `TasteScreen.tsx`: `TabChip`, `CanonRow` (rewritten, numbered), `ArrowBtn`, `CanonDetailSheet`, `CanonAddSheet`, `DesertIsland`. Deleted `CanonLine` + old `CanonGallery`. Handlers `moveCanon`/`removeCanon`/`addCanon` in `TasteScreen`. typecheck + lint + 56 tests clean.

Open content cleanup (Farah, not code): **Two Towers' note is "❤️×8"** — lands in the prominent reveal/row slot and reads like a glitch to anyone else. Either write a real one-liner or clear it.

---

### Session 58 (2026-06-23) — Desert-island display rethink: Discover-row treatment, surfaces the note

Walked the roadmap with Farah; she picked the **desert-island display rethink** (was in `ROADMAP.md` → Medium/long-term). Showed three directions as a mockup (current grid / stacked cards / numbered list); she chose the stacked-card direction **"but matching the Discover rows."**

**What shipped (free — pure UI, no API).** Replaced `CanonGallery`'s 3-column cover grid in `TasteScreen.tsx` with the Discover `ResultRow` language:
- Cover art **ghosts in blurred from the right** behind the text (the Discover signature wash; reuses `useArtwork` + `metadata.coverUrl`/`wikiThumb`, falls back to `typeColor(type).bg`).
- Title 16/600, uppercase meta line (`film · 2000 · Wong Kar-wai`).
- **`item.note` rendered as the italic "why"** — the core insight: the note was *completely invisible* in the old grid, and it's the most personal data on these picks. Graceful fallback when a pick has no note (title + meta only, no italic line).
- **No rank numeral** (Discover has one): desert-island picks aren't ordered, so a number would imply a ranking that doesn't exist. This also ruled out the "numbered list" option.
- Kept the collapsible header + per-medium grouping; deleted the now-dead `CoverTileInner`.

New component `CanonRow`; `inlineItalics` (existing) handles any `*…*` in a note. typecheck + lint clean. **Unverified on phone** — taste page is auth-gated and needs Farah's real canon picks + notes; preview only reaches the Google login wall. Farah verifies after deploy.

Watch-for next session: notes written as quick reminders ("standout track: X") now show in a prominent italic reason slot — may need content cleanup, not code.

---

### Session 57 (2026-06-23) — Cleared the s56 observations: 2 Discover bugs, Spotify scroll root-cause, 2 library-filter calls

Walked Farah's 6 s56 observations. Shipped 5 (all free, no API); #6 (editorial feel app-wide) left as the open direction. All five pass typecheck + lint + 56 tests; **none verified on phone yet** (Discover is auth-gated; #2 is iOS-resume-specific) — Farah verifies after deploy.

**1. Discover card — button alignment (#1).** "save to library" had an underline (`border-bottom`) + `line-height` but "not for me" had neither, so their text boxes were different heights and baselines didn't line up. Gave "not for me" a matching `line-height` + a **transparent** bottom border in both the row card and the detail sheet. `DiscoverScreen.tsx`.

**2. Discover blurb — literal `*[TITLE]*` (#5).** The model wraps referenced titles in `*markdown*`; the whole blurb is already italic so the asterisks rendered literally. Added `renderBlurb()` — splits on `*…*` and renders those spans **upright** (non-italic = a clean title distinction inside italic prose). Applied to row card + detail sheet. Parser logic verified against real-shaped blurbs. `DiscoverScreen.tsx`.

**3. Spotify warm-resume scroll reset (#2) — root cause, NOT the s56 path.** s56 fixed the *cold reload* (sessionStorage→localStorage). This is a **warm resume**: tap Spotify link → return → Supabase auto-refreshes the auth token on focus → `onAuthStateChange` → new `session` → **new `user` object reference** (same person). `useItems` `fetch` was `useCallback(…, [user])` → new identity → mount effect re-runs → **non-silent refetch** → "Loading…" swaps the list → scroll clamps to 0 → one-shot restore guard already spent → stuck at top.
- Fix: key `fetch` (and the realtime channel) on the **stable `user.id`**, not the whole object. Same-id refresh no longer churns → list stays mounted → DOM keeps scroll natively. Also removes a "Loading…" flicker on *every* resume. `useItems.ts` ~18-43.

**4. Smart-persist filters (#3).** Was: reset vibe/verdict/genre/series on every base-control change (blunt fix for "filter valid in films, empty in books"). Now: **keep the selections that still exist in the new set, drop only those that don't** — sticky like Spotify/Letterboxd, but never a mystery-empty list (the FilterSheet only offers tags present in the set, so pruning stays consistent). Serves Farah's want-to→done same-vibe browse. `LibraryScreen.tsx` ~464 (prune against `availableTags`).

**5. Search spans all categories (#4).** Was scoped to the active category tab. Now an active `query` **ignores the category filter** (find-this-specific-thing intent; type is labelled per row so cross-category hits aren't confusing). Status + other filters still apply. `LibraryScreen.tsx` baseFiltered ~403.

**Phone-verify follow-ups (same session).** Farah verified the batch: #1 fine, Spotify scroll (#2/#3) ✅, smart-persist (#4) ✅, search-all (#5) ✅. Two tweaks:
- **Blurb titles still read italic (#5 follow-up).** Upright alone wasn't enough — Geist has no italic face, so the blurb italic is a synthetic slant and upright-vs-faux-slant is invisible at 13px. Bumped the title spans to `fontWeight: 600` (still upright) so the distinction is unmistakable. (Taste page uses the same `*asterisk*` convention but renders fine — base prose is upright there, emphasis is `<em>`; no bug.)
- **Search now reflects "all" in the category tab.** Searching a film while in the "books" tab showed a film result but left "books" highlighted (tab lying). Now an active query shows "all" selected in the tab row *without* mutating the stored category, so clearing the search snaps back to the original tab. Chose this over auto-switching to the result's category (jumpy; surprises on clear). `LibraryScreen.tsx` ~585.

**Dev tooling:** made the dev server use an assignable port (`start-dev.sh` `${PORT:-5173}` + `launch.json` `autoPort:true`) so the preview can run alongside a dev server already on 5173. Backward compatible.

---

### Session 56 (2026-06-22) — Scroll-restore root-cause + "new music tuesday" → FilterSheet

Farah confirmed the s55 detail sheet **looks good**. Then two Library items (both free, no API).

**1. Scroll-restore root cause (session-49 #2).** The iOS-PWA scroll-restore had been "re-fixed" twice and kept failing. Actual cause: it stashed the position in **`sessionStorage`**, but when iOS terminates and relaunches an installed PWA it starts a **fresh browsing session** — which wipes `sessionStorage`. So in the exact scenario it was built for (OS kill → reopen), `saved` always read back empty and restore bailed. Everything *looked* correct, which is why it kept slipping past review.
- Fix: store to **`localStorage`** as `{ top, t }` + a **6h freshness window** (`SCROLL_MAX_AGE_MS`) so a much-later cold open doesn't restore a stale position. The retry-until-stuck rAF loop (content grows as covers mount) is unchanged. `LibraryScreen.tsx` ~30 (constant + comment), ~215 (save), ~228 (restore).
- Still **unverified on phone** — only reproducible by actually killing the standalone PWA.

**2. "New music tuesday" moved into the FilterSheet.** Was a `TabChip` toggle in the status-tab row, music-category only. Now a `music` section (single `new music tuesday` chip) inside the filter sheet, reusing `FilterSection`.
- Folded into the `filter · N` badge + sheet `activeCount` + "clear all" (`setNewMusicOnly(false)`); filter button now shows in the music category even with no tags (`|| musicOnly`). Moved the `musicOnly` const up above `filterCount` (was a temporal-dead-zone ref otherwise). `LibraryScreen.tsx`.
- Roadmap item deleted.

typecheck + lint + 56 tests clean. Not committed (left for Farah to push).

---

### Session 55 (2026-06-22) — Editorial Discover feedback + shared detail-sheet (`SheetHero`)

Farah's feedback on the session-54 editorial Discover, then a long iterative polish of the detail sheet — **pushed live to `main` each step**, deploying so she could eyeball on the OAuth-gated site (preview can't sign in, so **none of this is verified signed-in** — typecheck + lint + 56 tests clean on every push).

**Discover + Library quick wins:**
- **Rank numerals** — slimmed weight 600→300, then Farah picked the **full-watermark** treatment (mocked 3 options): big light-grey numeral (`#E0DDD5`, ~104px) left-anchored *behind* the row text, not just clipping the right edge. `DiscoverScreen.tsx` ResultRow.
- **Library kicker now medium-aware** — `N films` / `N books` per the selected category, `N in the collection` on "all". `LibraryScreen.tsx` (`kicker` useMemo ~line 374).
- **Taste desert-island covers** — per-medium aspect (posters 2:3, music 1:1) instead of hard-cropped squares, so each row reads like a shelf. `TasteScreen.tsx` `CanonGallery`.

**Shared editorial detail sheet — `src/components/SheetHero.tsx` (NEW):** Farah's call — the old `DetailSheet`/`ItemActionSheet` read views looked "pedestrian" vs the editorial Discover *page* (grey "why this" box, chunky black pill button, postage-stamp cover). Extracted one shared hero and pointed **both** Discover's `DetailSheet` and Library's `ItemActionSheet` main view at it. Design: **ghost cover wash** bleeding to the card's rounded top + a **crisp borderless poster** + big title + uppercase meta; Discover-only **rank watermark behind the title**. Discover's "why this" lost its grey box for a **kicker + 1.5px rule + italic prose**, and its black pill became a quiet **underlined text link** (matches the row). Library's edit/reaction/seasons machinery left untouched — only the read-view header changed.

**Sheet iteration (each a separate push, all in `SheetHero`):**
1. Wash was cut off below the ✕ row → bleed it up to the card's rounded top.
2. ✕ overlapped the cover → ✕ back in its own row, cover dropped below it (Farah: "first-iteration spacing was right").
3. Tall cover pushed the blurb way down → shrank the poster footprint so the body starts under the menu.
4. Unfloated the Discover **wikipedia** link (had a leftover `marginLeft:auto` pinning it to the far right).
5. **Cover moved to the LEFT** (both pages) — Farah: covers "look awkward floating on the right." Cover + title in a **flex row, tops aligned**; rank stays a watermark behind the title (the left gutter now holds the cover). This also killed the reserved-space gap (cover is now in-flow, not absolutely positioned).

**Decided against:** true CSS text-wrap around the cover (parked) — the body content lives outside `SheetHero` and `overflow:hidden` (for the rounded wash) kills wrapping; messy across all the item states (seasons grid, review inbox, no-blurb). Size-matching the cover was the pragmatic call.

**Watch items for next session:** (1) verify signed-in on deploy — cover/title top alignment, Discover rank still reads (esp. double-digit "10" against the cover), Library menu links wrapping with the narrower right column, music square covers, no-art tint fallback; (2) parked: bigger cover with real text-wrap if the small cover feels like a downgrade; (3) page-level echo (Taste/Library kicker+rule section dividers from the mock) still a fast-follow if wanted.

---

### Session 54 (2026-06-22) — Discover redesign #2 (editorial rebuild) + app-wide magazine header

Farah rejected the session-53 type-first stacked layout ("still do NOT like the formatting"). Explored options via mockups, then iterated **live — pushed straight to `main` each step**, deploying so she could eyeball on the real (OAuth-gated) site. Landed on an **editorial single numbered list**. **Engine untouched throughout.**

**Discover (`DiscoverScreen.tsx`) — now:**
- **One flat numbered list**, not type-sections. Mediums interleave under "all"; a left-aligned **medium chip switcher** (all/films/music/books/tv) narrows it. Killed the session-53 stacked sections + drill-in + 2-line clamp/expand.
- **Row** = oversized **sans** rank numeral (120px, absolutely positioned, **clipped by the row**, sits behind the text as a graphic element) + **ghosted real cover art** as the row background (blur 4px, opacity 0.42, masked/faded in from the right; type-grey gradient fallback) + title + uppercase meta + 2-line italic blurb teaser + quick `save`/`not for me` + `more ›`.
- **Tap a row → `DetailSheet`** (mirrors the Library `ItemActionSheet` look): bottom sheet w/ rank numeral + **real cover thumbnail** + title/meta + full **"why this"** blurb box + `via {source}` + wikipedia + save/not-for-me. (Replaced the underwhelming 2-line→full expand, which revealed almost nothing.)
- **Menus left-aligned on Library's `TabChip` pattern** (fontSize 13, active dark/bold/italic). Stream row: `for you · further afield | in the mood…`; "in the mood" expands the search inline.

**Shared magazine header (`src/components/PageHeader.tsx`, NEW):** small uppercase **kicker** + small **label** + **1.5px black rule**. Label kept small on purpose — editorial weight comes from kicker+rule, **not** an oversized title (Farah: keep Taste's vibe-headline bigger than the page name — "a bit subversive"). Rolled across:
- **Library** — `N in the collection`; folded into the collapsing sticky title block (kicker+rule collapse with the title on scroll; collapse height bumped to 64).
- **Taste** — `shaped by N ratings`; vibe-headline untouched below, still the biggest element.
- **Discover** — `<stream> · <date>` kicker. Dropped the earlier centered masthead + the meaningless `no.NN` (was ISO week dressed as a magazine issue).

**Verification:** typecheck + lint + 56 tests clean on every push. **Still UNVERIFIED signed-in** (OAuth wall — preview can't sign in). Farah reviewing on the deploy; **feedback comes next session.** Branch `discover-editorial-wash` merged + deleted.

**Watch items for next session:** (1) Library scroll — confirm kicker/rule collapse cleanly + pinned chips OK; (2) the 1.5px black rule repeated on every page may read heavy — softer hairline is a one-line change in `PageHeader.tsx`; (3) ghosted cover art introduces **colour** into an otherwise mono app — judge if it reads editorial or noisy (levers: opacity, or flat type-grey tint).

---

### Session 53 (2026-06-22) — BUILT the Discover redesign (session-52 spec)

Built the whole locked spec in one pass. **Display/structure/labels only — recommendation engine untouched** (Farah confirmed sources + AI recs work fine).

**Discover (`DiscoverScreen.tsx`, near-total rewrite):**
1. **Killed the "all" soup + no-profile wall.** Lands on **type-first stacked sections** (films → music → books → tv), each showing top 3 picks with **"more · N →"** drilling into that single type's full list (back via "← all"). No "all" tab.
2. **Mood search bar on top** — free-text "in the mood for…" → new `mood` param on `api/recommend-feeds` (MOOD-mode prompt: typed intent is primary signal, taste profile secondary, works **without a profile**). Same Sonnet-4-5 tier + 20/hr rate limit as the existing calls — **one paid call per search, no new endpoint/billing surface.** Mood results override the stream view until "clear ✕".
3. **Collapsed the two streams into ONE toggle** — `in taste → "for you"`, `divert → "further afield"`. "for you" = free/cached; tapping "further afield" fires the wander call (opt-in, unchanged). "further afield" tab only shows with a taste profile.
4. **Cold-start = no wall.** New `src/lib/editorialPicks.ts` — static, hand-picked ~6/type, **free (no AI)**, source label `editorial`. No profile → per-type sections fill from these. Profile but nothing cached → slim "showing starter picks · load your picks →" nudge instead of a wall.
5. **Blurbs clamped to ~2 lines** (`-webkit-line-clamp: 2`), full on tap. Display-only, no prompt change.
6. **Removed "shows near you"** from Discover. Also dropped the now-dead cached-date display + `useNavigate` import.

**Library (`LibraryScreen.tsx`):**
7. **Re-homed "shows near you"** into the **music** category view — slim dark entry at the top of the list, only when `music` is active (`navigate('/shows')` unchanged).
8. **Promoted "decide for me"** out of the `⋯` menu → a chip in the library status row (all-media, `navigate('/decide')`); removed "help me decide" + the now-unused `hasItems`/`onDecide` props from `OverflowSheet`.

**Verification:** typecheck + lint clean, 56 tests pass, **production build clean.** Could NOT screenshot — app is behind Google OAuth, preview can't sign in. **The redesign is unverified in a signed-in browser** — Farah needs to eyeball the deployed/local build. (Threw away a temporary `vite-preview` launch.json entry; reverted.)

---

### Session 52 (2026-06-22) — Discover redesign design conversation (spec locked, no code)

Full design pass on Discover. Concept + structure decided, written into HANDOFF as the locked build spec for session 53. Quick-pick mood chips considered + parked → ROADMAP (revisit 2026-06-29). Also re-fixed session-49 #2 (scroll restore — retries each frame) + #5 (filter clip — spacer clears tab bar); both PWA-only, pushed, unverified on phone.

---

### Session 51 (2026-06-22) — verified bare-link email + built the failed-capture feed (#6)

Picked up the two loose ends from session 50.

1. **Bare-link email capture — verified working end-to-end.** Farah forwarded a real bare link after the redeploy; it captured correctly. Closes the last open item from session 50.
2. **Failed-capture feed (#6) — shipped.** When a forwarded email adds **nothing** to the library, it now leaves a trace instead of vanishing. Design decisions (with Farah): the feed logs **only no-op captures** — `nothing_found`, `error`, `duplicates` — not successes (successful captures already show as items in the "for review" inbox, so re-logging them is redundant + noisy). New `email_captures` table (`supabase/schema.sql`), RLS select-own; written server-side by `api/email.ts` (service-role, bypasses RLS) via a best-effort `logCapture()` at each no-save exit. Side refactor: moved the account lookup **before** the Anthropic call, so an allowlisted-but-unmatched sender now fails *before* spending a paid Sonnet call (was after). Frontend: `src/lib/captures.ts` (`fetchCaptures`, `isFailure`) + `CapturesSheet.tsx` bottom sheet, reached from the library `⋯` overflow menu — the row only appears when there's ≥1 capture, badged with the failure count. No new AI cost (just a DB table + one insert per no-op email). typecheck + lint + production build clean; 56 tests (added `captures.test.ts`, `isFailure`).

**Follow-up (same session):** added **clear all** + per-row **`×`** dismiss to the feed (`clearCaptures` / `clearCapture(id)`), riding one RLS *delete* policy.

**Status: fully shipped + confirmed working in-app by Farah** — both migrations (table + delete policy) run in Supabase; the feed populates on no-op forwards and both clear actions work. #6 is done and closed out of the roadmap. (`email_captures` table, `api/email.ts` `logCapture`, `src/lib/captures.ts`, `CapturesSheet.tsx`.)

---

### Session 50 (2026-06-22) — recovered a mobile branch + SSRF-hardened bare-link email capture

Farah had run a Claude Code session **on her phone** the day before and asked if the comments "came in." They hadn't merged — the work was sitting on `origin/claude/desert-island-form-redesign-r63lw9` (committed 07:34, never merged to main). Two things on it:

1. **Bare-link email capture** (`api/email.ts`) — when a forwarded email is *just a URL* (e.g. a Letterboxd review link, no text), it now extracts up to 3 URLs, fetches each page's OG/title/description metadata, and feeds that to the Sonnet extractor so the item can be identified. Same single Sonnet call as before — no new API cost, just more input context.
2. **A roadmap note** — "desert island display rethink" (parked in `docs/ROADMAP.md`).

**The fix I added before merging (security):** the mobile code fetched attacker-controllable URLs (anything in an inbound email body) server-side with **no SSRF guard** — reintroducing the exact pattern we guarded against for custom feeds in session ~43. I extracted that existing guard into a shared `api/_ssrf.ts` (`isSafePublicUrl`) and routed both `email.ts` and `recommend-feeds.ts` through it, so they can't drift. Typecheck + lint + 54 tests green; merged to main (`9337fc1`, merge `61ddd55`) and pushed; branch deleted.

**Not verified end-to-end** — the bare-link path needs a real inbound email + webhook secret to exercise and isn't browser-observable. Code is typed and sound; behavior unconfirmed. Farah to forward one bare link to the capture address after Vercel redeploys.

**Decision:** the desert-island display idea overlaps the big Discover redesign, so we're folding it into that — which we deferred to **its own fresh session** (cost: long sessions are expensive). No code touched on Discover this session.

---

### Session 49 (2026-06-22) — input/workflow bug round (notes, scroll, blurb, sheets)

Five bugs Farah hit using the app this week. Typecheck + 54 tests green throughout. Pushed to main (commits `f232526`, `6a67593`, `4113df0`, `2433f76`). Frontend-only except #3 (a prompt-only edit, no test call spent — see cost note). **Not verified against live app** — port 5173 held by the dev server + login wall — so each fix needs a quick confirm on the deployed build / phone.

1. **Notes silently not saving (data loss).** Two causes: (a) `markDone`/`editItem` ignored the Supabase write error, so a failed save looked successful and the sheet closed — now they throw on error, the sheet stays open, and a toast ("couldn't save — check your connection") fires; (b) the only note field lived in the mark-done view with a save button disabled until a verdict was picked — notes now save standalone (no verdict required) and keep the item's status as-is. (`useItems.ts:143,274`, `LibraryScreen.tsx:717`, `ItemActionSheet.tsx:498,1161`)
2. **Library loses scroll spot on Spotify round-trip.** iOS kills/reloads the standalone PWA on return. Scroll position now stashed in sessionStorage on `pagehide`/visibility-hidden and restored after load. Side effect by design: also restores on any tab-return. *Can't verify here — needs the phone PWA.* (`LibraryScreen.tsx` SCROLL_KEY)
3. **AI blurb described the article, not the item** ("this is the album reviewed in the Paste article"). Tightened the email-extractor `summary` prompt to demand the work's substance and forbid meta framing. Intermittent + webhook-triggered, so no test call spent — confirm by re-forwarding the article. (`api/email.ts:170`)
4. **Item action sheet drifted sideways / clipped tags.** Real root cause: the genre/vibe/verdict rows are dot-separated with **no whitespace**, so inline layout had no break opportunity and couldn't wrap. First pass added `overflowX:hidden` (stopped the drift but clipped overflow) — wrong fix. Correct fix: make the tag line a `flexWrap` container so long rows wrap. Then a follow-up: bundle each middot as **trailing** (with the term before it) so wrapped lines never begin with a dot. (`ItemActionSheet.tsx` tagLine ~712, sheet overflowX ~519)
5. **Filter popup clipped its last row on mobile.** WebKit omits a scroll container's own `padding-bottom` from the scrollable area — replaced the container padding-bottom with a trailing spacer div. *Confirm on phone.* (`LibraryScreen.tsx` FilterSheet)

**Still open:** #6 — review page "feed of failed email captures" (if a forward doesn't capture properly). It's a **feature**, not a fix — deferred to its own session with a small design.

---

### Session 48 (2026-06-22) — editorial polish #4 + #5

New-user audit items #4 and #5 shipped. Pure presentational changes; typecheck clean. Not screenshot-verified — the preview build has no seeded data and both sections only render with rated items / discovery results (won't trigger discovery, paid call); confirm on the live :5173 data.

1. **#4 — Discover covers align.** All covers now width 56 (was 72 for music) so rows share a left edge and the text column starts at the same x. Music kept square (56×56) so album art isn't cropped into portrait. (`DiscoverScreen.tsx:404`)
2. **#5 — "the gap" labelled.** Added subtitle under the header: "what you're collecting vs. what you actually finish", so the `adding X · finishing Y` numbers read as intentional. (`TasteScreen.tsx:323`)

**Decisions:** #6 (empty-library inside joke) parked → ROADMAP, with a note to rewrite media-agnostic when revisited (it's music-only copy on a multi-media library). #7 kept as-is (cost gate). #3 (Discover on-ramp for new users) deferred — needs a small design.

**Next session:** input bug + workflow round Farah hit while using the app this week — search not working, identify-with-AI quality, etc.

---

### Session 47 (2026-06-22) — pro hardening bundle (Sentry, lint-in-CI, gitleaks, Dependabot)

Added the "professional setting" protections bundle. All verified: lint + typecheck + 54 tests + production build green.

1. **Crash reporting (Sentry).** `@sentry/react` installed; `Sentry.init` in `main.tsx` guarded on `VITE_SENTRY_DSN` (no-op locally / until the env var is set); `ErrorBoundary.componentDidCatch` now reports caught crashes. **Manual step left:** create Sentry project + set `VITE_SENTRY_DSN` in Vercel.
2. **Lint in CI + cleanup to zero.** Added `npm run lint` to `ci.yml`. Fixed all 30 pre-existing lint problems to make it a real gate — including a **genuine bug**: `GapsSheet.tsx` had `if (total === 0) return null` *before* ~24 `useState`/`useRef` calls (rules-of-hooks violation that could crash the sheet). Moved the return below all hooks (behavior-identical). Other fixes: eslint config now treats `_`-prefixed vars as intentionally-unused; removed a dead eslint-disable in `AddScreen`; dropped a stable `navigate` dep + justified one intentional dep omission in `LibraryScreen`; documented the two Ticketmaster `any` shapes in `shows.ts`.
3. **Secret-leak scan (gitleaks).** New `gitleaks` CI job scans repo + full history for committed keys. Free for personal repos.
4. **Dependabot.** `.github/dependabot.yml` — weekly grouped PRs for vulnerable/outdated npm + Actions deps (capped to stay quiet).
5. **Spend alerts** — documented as a manual step (Anthropic console + Vercel usage notifications); can't be automated from code.
6. **PR workflow + branch protection** — deliberately **parked until >2 users**. Saved memory `pr-workflow-at-3-users` so a future session proactively prompts to set it up when a 3rd user joins.

### Session 46 (2026-06-22) — dev automation: auto-testing, roadmap + handoff-cleanup reminders

Built three automation pieces on top of the existing hook scaffolding. All local + free (no Anthropic cost).

1. **Automatic testing (two layers).** (a) New Stop hook `scripts/check-tests.sh` runs `vitest run` after each turn and injects a warning if tests fail (only when `.ts/.tsx` changed, so it stays quiet otherwise). (b) The `.git/hooks/pre-commit` gate — previously genres-only — now also runs `npm run typecheck` + `vitest run`; a broken commit is blocked (`--no-verify` bypass). (c) `scripts/check-test-coverage.sh` nudges when `src/lib` logic changed but no test file did.
2. **Roadmap reminders.** `scripts/check-roadmap.sh` fires on Stop when `src/`/`api/` code shipped but the HANDOFF Roadmap region wasn't edited — nudges to (1) mark finished items ✅ shipped and (2) pitch NEW roadmap items the work surfaced.
3. **Handoff cleanup.** `scripts/check-handoff-size.sh` fires on Stop when the session log passes ~8 entries AND HANDOFF was edited this session — suggests archiving the oldest sessions to `docs/HANDOFF-archive.md` (log is at 22 now, so this will start firing). Roadmap + Next session stay inline.
4. **Wiring.** All four scripts registered in `.claude/settings.local.json` Stop hooks + permission allowlist. Verified: settings JSON valid, 54 tests pass, scripts stay silent on a no-app-code session.

### Session 45 (2026-06-22) — security audit queue closed (#2, #3, #4)

Closed the remaining three security findings. The whole audit queue is now done.

1. **#2 — rate-limited 7 paid endpoints.** `describe`, `vibes`, `genres`, `taste-profile`, `recommend-feeds`, `search`, `runtime` had auth but no rate limit — a runaway client loop or leaked session token could rack up Anthropic cost. Each now calls `checkRateLimit(userId, '<endpoint>', cap)` right after auth, returning 429 on exceed. Caps: Haiku/cheap = 60/hr (describe, vibes, genres, search, runtime); pricey Sonnet = 20/hr (taste-profile, recommend-feeds). Refactor: swapped each from its copy-pasted boolean `requireAuth` to the shared `getAuthUserId` + `checkRateLimit` from `_ratelimit.js`; removed the now-unused `createClient` import from `search.ts`. email.ts deliberately excluded (secret-gated webhook, no Supabase user to key on; spoofing closed in s44). Commit `1292de8`.
2. **#3 — SSRF guard in `recommend-feeds.ts`.** New `isSafeFeedUrl()` filters `customFeeds[].url` before `fetchFeed`: requires http(s), rejects loopback/private/link-local/non-routable IPv4+IPv6 (incl. `169.254.169.254` metadata). `DEFAULT_FEEDS` skip the check. Literal-host only (no DNS resolution — rebinding out of scope).
3. **#4 — light throttle on `lookup.ts`.** Unauthenticated open proxy can't use the uuid-keyed DB limiter, so added an in-memory per-IP sliding window (40/IP/min → 429, keyed on `x-forwarded-for`). Best-effort speed bump vs TMDB-quota scraping; not a hard guarantee on ephemeral serverless. A hard limit would need a schema change — not worth it for a LOW finding.
4. **Verified:** `npm run typecheck` (src + api) clean, all 54 tests pass after each fix.

### Session 44 (2026-06-22) — email webhook secret + ESM outage fix

Set out to fix security #1 (email webhook spoofing); shipped that **and** uncovered/fixed a hidden production outage.

1. **Security #1 — email webhook secret (shipped + verified end-to-end).** `api/email.ts` now gates every request on `EMAIL_WEBHOOK_SECRET` (constant-time compare via `node:crypto`), accepted as Postmark HTTP Basic Auth OR a `?token=` query param, checked *before* the body is read or any Anthropic call fires. Fails closed if unset. Secret set in Vercel + on the Postmark inbound webhook URL (Basic Auth form: `https://x:SECRET@nospaces.vercel.app/api/email`). Verified live: no/wrong token → 401 (free, pre-Anthropic), correct token → 200. **Real forwarded email confirmed landing in the review inbox.**
2. **Production outage found + fixed (the real story).** While testing, the email endpoint 500'd (`FUNCTION_INVOCATION_FAILED`) — and so did `genres`, `identify`, `recommend`, `search`. Root cause: `package.json` `"type":"module"` makes Vercel run `api/` as ESM, which rejects **extensionless relative imports** at runtime. Every endpoint importing `./_genres` or `./_ratelimit` had been crashing on every request since the genre consolidation (session 40); failures were silent (email has no talkback yet, others fall back). Fixed by adding `.js` extensions to all 7 relative imports. New Architecture note documents the gotcha. Local typecheck + esbuild had hidden it (bundling inlines the import).
3. **Committed earlier session-43 work** that was left uncommitted (login casing + model-name scrub) as `eccbf56`.
4. **Setup gotcha (resolved live).** First real-email test failed because the Postmark webhook URL had a stray `P` typo'd in front of the secret (`x:P3c81d…` instead of `x:3c81d…`) → 401, silently dropped. Isolated it by simulating the exact Postmark POST against our endpoint (it dedup-skipped a known film → proved the pipeline was healthy and the break was in Postmark's auth). Removing the `P` fixed it. Lesson: when capture silently does nothing, check the Postmark Activity log / webhook URL auth first — the endpoint failing closed returns 401, not an error the user sees.

### Session 43 (2026-06-21) — new-user audit, casing/model-name fixes, security deep-dive

Editorial audit through a "new user with great taste" lens + an option-B manual security deep-dive of all 17 `api/` endpoints. Two small fixes shipped; everything else logged for next session.

1. **Audit #1 — login casing fixed.** `LoginScreen.tsx` was the only Title Case surface ("Nospaces" / "Your personal taste library"); now lowercase to match the all-lowercase design constant.
2. **Audit #2 — model names scrubbed from UI.** "Sonnet" → "ai" in `AddScreen.tsx` (sonnet-prompt copy + button + PickerSheet fallback). "Claude's knowledge" → "nospaces" in Discover — fixed at the source: the `api/recommend-feeds.ts` prompt instructed the model to emit `["Claude's knowledge"]` (two spots), plus the `normaliseSources` frontend fallback. Cached discover results may show the old label until the 48h TTL expires.
3. **Audit #3–#7 logged, not fixed** — Discover dead-ends without a taste profile; ragged Discover cover sizes (72 vs 56/84); "the gap" needs a label; empty-library insult line (Farah's call); the catalog-miss interstitial is an extra step (kept as a deliberate cost gate).
4. **Security deep-dive logged** — headline: `api/email.ts` is a spoofable, un-rate-limited inbound webhook (next session's #1). Plus rate-limit gaps on 7 paid endpoints, SSRF via custom feed URLs, and the documented unauth `lookup` proxy. Verified-clean list recorded too.
5. **No code fixes** for #3–#7 or any security item this session — all deferred to a fresh session with clean context.

### Session 42 (2026-06-21) — HANDOFF ↔ code reconciliation

Docs-only pass: audited HANDOFF against the actual code and fixed every mismatch. No code changed.

1. **Taste-page stats drift resolved** — confirmed via git (`216e6ca`) that the old 3-section stats page was **deliberately removed**, not lost. Rewrote the flag + the stale roadmap entries that still described medium pills / reaction breakdown / verdict counts / effort axis. Current page is correct as documented.
2. **Verdict list corrected** — HANDOFF said "9 verdicts" and omitted `stuck with me`; code has 10.
3. **Key files api list completed** — was 10 endpoints, actually 17 + `_genres.ts`/`_ratelimit.ts` helpers. Added the missing ones.
4. **Added API auth + rate-limiting architecture note** — `api/_ratelimit.ts` (used by every endpoint, `check_rate_limit()` RPC) was undocumented.
5. **`typecheck` comment fixed** — now runs two passes (src + `tsconfig.api.json`).
6. **Verified accurate, left as-is** — 54 tests/6 files, models (sonnet-4-5 + haiku-4-5), all vibe lists, both discover flags (still real: taste-profile hard-gate + uneven cover sizes).

### Session 41 (2026-06-21) — fresh audit + library header / view / filter overhaul

Started with an open-ended editorial+tech audit, then Farah picked the library header to work on. All shipped to `main` (deployed live).

0. **Fresh app audit** — flagged: library header was the heaviest surface (4 control rows before content); discover gating + uneven covers; taste-page stats drift. Header chosen as the session's focus.
1. **Library header declutter (A + D)** — *A (consolidate):* top row is now `library · [view ▾] ⌕ ⋯`. The `view ▾` sheet absorbs list/grid + column count (removed the duplicate cols toggle); new `⋯` overflow sheet holds help me decide · how to use · tidy (when gaps) · select. *D (collapse-on-scroll):* scrolling into the collection folds away the title row + view control; category + status tabs pin, with `⌕ ⋯` tucked inline. Hysteresis dead-zone (collapse >56px, expand <16px). Switching category/status resets scroll + re-expands so a short result set can't strand the header. `LibraryScreen.tsx` + `ViewSheet.tsx`.
2. **View sheet reorder + compaction** — layout (list/grid) + columns moved to the top as primary controls; sort options became compact single-line rows (dropped the tall per-row hint descriptions + dividers); added a "tap the selected sort again to reverse" footnote.
3. **Views trimmed 7 → 4** — kept `recent · by year · by creator · a → z`. Cut "recently edited" (no browsing use), "want to / done" (redundant with status tabs), "by rating" (overlaps reaction chips). Removed dead `groupByStatus` + its grouping branch. Guarded persisted `view` against old removed values so an old localStorage value can't index a missing config.
4. **Multi-select filter sheet** — vibe/verdict/genre/series now accept multiple selections: OR within a group, AND across groups (faceted). State moved string|null → string[]; chips toggle on/off; `filter · N` counts total selected tags. Category + status stay single-select (top-level nav). `LibraryScreen.tsx` (FilterSheet/FilterSection).

### Session 40 (2026-06-21) — tsconfig api typecheck, TV auto-status, taste page ratings

0. **Genre vocab consolidation** — added `cookbook` to books, then discovered the vocab was duplicated across 5 api files (not the "4 copies" the handoff claimed — and `wiki.ts` had none). Several copies (`recommend`, `email`) had silently drifted into reduced subsets, and the sync guard only checked 3. Consolidated to a single `api/_genres.ts` imported by all api endpoints; only 2 copies remain (src + api shared); updated `check-genres.mjs` accordingly. `recommend`/`email` now use the full vocab.
1. **api/ typecheck (quick win)** — new `tsconfig.api.json` (Node types + DOM lib to mirror Vercel's environment, avoiding undici `.json()→unknown` false positives). Added to `npm run typecheck` (`tsc && tsc -p tsconfig.api.json`) and the Stop hook so api TS errors surface locally before deploy.
2. **TV auto-status** — ticking/unticking seasons now keeps status honest. `editItem` accepts `status`/`date_done`; `onSetSeasons` in `LibraryScreen` demotes a **done** show to **in_progress** when not all aired seasons are watched, and nudges a **want_to** show to **in_progress** once the first season is ticked. Auto-populated season lists (TVmaze) don't trigger this — only explicit user toggles persist via `onSetSeasons`.
3. **Desert island gallery fixes** (`TasteScreen.tsx`) — (a) tiles were mismatched sizes across media (music 1:1 vs film/book/tv 2:3); now uniform 1:1 squares with `objectPosition:top` for posters (matches the library "all" grid pattern). (b) Section is now collapsible — header is a toggle button with item count + chevron, defaults open.
4. **Taste profile takes ratings seriously** — the AI prose previously only received loved+liked items and treated private notes as primary evidence, so commentary outweighed ratings. Now `TasteScreen` sends the full rated spectrum; `api/taste-profile.ts` groups items by reaction (LOVED → liked → eh → not-for-me, per-bucket caps) and the prompt makes the **rating the primary signal**: anchor on loved, use rejections as the boundary of taste, and never let a heavily-annotated lower-rated item overshadow a loved one. Still requires ≥1 positive to generate.

### Session 38 (2026-06-05) — Review inbox redesign, vibe seeding fixes, small UX polish

1. **Review inbox redesign** — filing buttons simplified to 3: **want to** (keeps as want_to), **mark as done** (reveals inline reaction chips), **discard** (triggers confirm dialog then deletes). Old confusing layout (keep·want to + all 4 reactions + separate mark-as-done/delete buttons) replaced. `ItemActionSheet.tsx` + `LibraryScreen.tsx`.
2. **Save-and-next for review inbox** — filing any inbox item now auto-advances to the next review item (queue built lazily on first open, frozen to sort order at that moment). End of queue shows "🥂 inbox cleared" toast. Mirrors the existing tidy-queue pattern.
3. **Decade label fix** — "by year" group headers were showing `2020S` (CSS `text-transform:uppercase` was uppercasing the `s`). Now renders `2020s` using a `textTransform:lowercase` span on the trailing `s`. `LibraryScreen.tsx`.
4. **Tidy button hidden when clean** — "tidy · N" link in library header now only renders when `gapCount > 0`. Previously always visible (ghosted when 0). `LibraryScreen.tsx`.
5. **Vibe auto-seed fix (edit view)** — `editMoods` was only seeded at mount; async vibe fetch that arrived after mount was never reflected. Added `useEffect` keyed on `unconfirmedVibesKey` to merge arriving vibes into `editMoods`. `ItemActionSheet.tsx`.
6. **Vibe auto-seed fix (reaction view)** — same race on `selectedMoods` in the mark-reaction view. Same fix applied. `ItemActionSheet.tsx`.

### Session 37 (2026-06-05) — Security fixes, discover redesign, no-repeat recs

1. **React error boundary** — `src/components/ErrorBoundary.tsx` wrapped at app root in `main.tsx`. Unhandled component throws now show an in-app error screen instead of a blank page.
2. **`window.open` noopener** — Spotify + Wikipedia quick-links in `LibraryScreen` now pass `'noopener,noreferrer'` as third arg.
3. **`console.log` guard** — both logs in `AddScreen.tsx` wrapped in `import.meta.env.DEV`. Gone from production builds.
4. **`alert()` → toast** — bulk duplicate removal in `LibraryScreen` now shows a fixed-position ink chip that auto-dismisses after 3s.
5. **Input length cap** — `api/identify.ts` slices `input` to 2000 chars before sending to Claude.
6. **Hardcoded emails removed** — `api/email.ts` fails closed (empty allowlist + console warning) if `ALLOWED_EMAILS` env var is missing. Set `ALLOWED_EMAILS=farahmokhtar94@gmail.com,tom.effland@gmail.com` in Vercel.
7. **Discover editorial redesign** — `ResultRow`: covers 44→56/72px, title 14→15px, blurb 12→13px with 1.7 line-height, save is now an ink pill. Redundant "MEDIA" label removed. Farah flagged it still needs more work — revisit next session.
8. **No-repeat recommendations** — `seenDiscoverTitles` accumulated in user prefs (cap 150). Passed to `/api/recommend-feeds` as `ALREADY RECOMMENDED IN PAST SESSIONS` exclusion block. Prevents repeats across sessions and cache refreshes.
9. **Vercel TS fixes** — `api/_ratelimit.ts` RPC cast to `any`; `api/recommend-feeds.ts` raw AI response typed as `Record<string,unknown>` before mapping to `DiscoveryResult`. Both were pre-existing, caught by Vercel's stricter compiler.

### Session 35 (2026-06-05) — App audit + library UX overhaul

1. **Full app audit** — two-lens review: editorial designer (would you pay for this?) + independent tech auditor (systems, security, functionality). Produced a ranked improvement list of 18 items.
2. **Library default view** — changed from list+recent to grid+year (decade headers). Rationale: grid is a collection, list is a log; year/decade shows taste range vs. recency as feed.
3. **Dynamic category tab order** — tabs now sorted by item count from actual library data, most-used type first, "all" moved to last. Avoids imposing a medium hierarchy (films > books etc.) that may not match the user's collection.
4. **Grid aspect ratio fix** — "all" mode uses uniform 1:1 square tiles with `object-position:top` for non-music covers (preserves faces/titles). Single-medium grids keep native ratios (2:3 film/book/tv, 1:1 music).
5. **List thumbnail size** — 42px → 52px.

### Session 34 (2026-06-05) — Offline capture queue, describe-by-recency film/TV, canon chip fix

1. **Canon chip reorder + inline icon** — reaction row now: `not for me · eh · liked it · loved it | canon`. Hairline divider before canon. Diamond glyph inline with text (was stacked above).
2. **Offline capture queue** — `src/lib/offlineQueue.ts` (IndexedDB) + `src/hooks/useOfflineSync.ts`. `addItem` checks `navigator.onLine`; if offline, enqueues to IndexedDB instead of calling Supabase. On reconnect, `useOfflineSync` flushes the queue. Banner in `App.tsx` shows pending count + syncing/synced state. "Save as note" is the cleanest offline path (no API calls). Main submit falls back to queued plain-title save with an offline-aware error message.
3. **Describe-by-recency for film/TV** — `tmdbByPerson()` in `api/lookup.ts`. Recency queries now resolve person by name via TMDB `/search/person`, pull `combined_credits`, sort newest-first. Director/Writer crew credits carry person as creator; cast credits fill in for actors. Falls back to plain `tmdb()` if no person found. Matches the existing music (`itunesByArtist`) and books (`openLibraryByAuthor`) pattern.
4. **Offline library cache** — parked. Full offline-first requires queuing mutations (markDone, edits, deletes); disproportionate scope. Revisit if offline usage becomes a real pattern.

### Session 33 (2026-06-05) — Discover polish, mark-done redesign, bug fixes, roadmap

1. **"Not interested" dismiss on discover** — dismiss button per result row; dismissed titles persisted to `user_prefs.dismissedDiscoverTitles`. Filtered client-side in `filterResults`.
2. **Discover UX polish** — "shows near you" moved to top as prominent full-width dark button; `MEDIA` section label above type tabs; refresh button moved inline on both `IN TASTE` and `DIVERT` section headers (date + refresh on same line); removed top-level refresh from page header.
3. **Shows back nav** — back button on `/shows` now returns to `/discover` instead of `/library`.
4. **Mark-done redesign (both sheets)** — `MarkDoneSheet` and `ItemActionSheet` reaction view both updated: single row of 5 equal chips (loved it · liked it · ◇ canon · eh · not for me). The bug was that the main mark-done path goes through `ItemActionSheet`, not `MarkDoneSheet` directly.
5. **Canon filter removed** — `◆ canon` filter chip removed from library header. Canon visible as `◆` marker on items and on the taste page.
6. **Type downgrade fix** — `identifyIntoEdit()` in `ItemActionSheet` no longer sets type to `"other"` from AI identify results. "other" means Sonnet couldn't identify the item — not that the type changed. Prevents obscure items being silently downgraded.
7. **Descriptive library search** — built then shelved. AI applied too many filters simultaneously; intersections too narrow. Filter sheet covers the use case.
8. **Roadmap decisions** — individual songs: shelved (album model correct, songs would bloat library). Letterboxd diary: shelved (cosmetic dates + schema complexity for repeat views). Bandsintown: not yet applied, approval odds low, apply passively. Offline capture queue + describe-by-recency → next session priorities.

### Session 32 (2026-06-05) — Discover UX, tidy fix, decade headers

1. **"Shows near you" moved to discover tab** — removed from music filter row in LibraryScreen; now appears as a "shows near you / browse →" row above sources in DiscoverScreen.
2. **Tidy queue end-of-queue bug fixed** — last item's "save & next" was navigating to `/add`; now closes the sheet and returns to library. Button label on final item changed to "save & finish".
3. **Decade section headers in by-year view** — "by year" sort now groups into decade buckets (2020s, 1990s, etc.) using the existing section header rendering. Items without a year land under "unknown".
4. **Roadmap decisions** — "not interested" on discover: build it (UX value, no AI signal). Want-to priority: parked (adds clutter, help-me-decide covers the acute case).

### Session 31 (2026-06-05) — Stats section refinement

1. **Genre love rate** — replaced "what you reach for" (frequency-based tag lists per reaction bucket) with "where your taste is clearest": genres ranked by % loved (min 3 rated items). Shows actual affinity, not just what you watch a lot of. Bolded when ≥60% loved. Respects medium filter.
2. **Verdict counts** — added `(N)` after each verdict label. Now shows "comfort (8) · hyperfixation (3)" instead of a flat unweighted list.
3. **Effort axis removed** — signal was too sparse (almost no items tagged "easy"/"demanding") and misled more than it informed.

### Session 30 (2026-06-05) — Taste page rebuild + new verdict

1. **New verdict: "stuck with me"** — added to `VERDICTS` in `src/lib/moods.ts` between "delivers" and "respect, not love". For things that weren't immediately enjoyable but lingered.
2. **Taste page rebuild** — `TasteScreen.tsx` restructured into three sections:
   - **① Identity** (unchanged) — vibe ranked line + "rarely lands" + AI prose.
   - **② Stats** (new) — medium filter pills (`all · films · books · music · tv`) controlling: lede ("X things · Y% loved"), "what you reach for" reaction breakdown grid (per reaction tier: top genre+vibe tags by frequency), "verdicts" (frequency-ranked verdict tendencies), "effort" (easy ←→ demanding dot bar derived from vibe tags on loved+liked items; hidden if < 3 signal items).
   - **③ By medium** (collapsible) — film/book/music/tv each as a collapsed row; header shows rated count + loved % + canon count; expands to show canon tiles + top creators + top genres.
   - **Era map removed.** Replaced by regions (parked — needs creator nationality data).

### Session 29 (2026-06-05) — Genre sync guard + dev automation plan

1. **Genre sync guard** — `scripts/check-genres.mjs` diffs the copies of the genre vocab and exits 1 if any are out of sync. Wired as `.git/hooks/pre-commit`. Run manually: `node scripts/check-genres.mjs`.
2. **Session-length Stop hook** — `scripts/check-session-length.sh` counts numbered items in the current session block in HANDOFF.md; injects a "good stopping point" system message when ≥ 4 items shipped. Fires after every Claude turn.
3. **moods.ts → guide reminder** — Stop hook regex extended to also fire when `src/lib/moods.ts` is touched.
4. **Typecheck on Stop** — `tsc --noEmit` added to Stop hook; injects system message on any `error TS` output.
5. **HANDOFF.md staleness warning** — `scripts/check-handoff-staleness.sh` added to Stop hook; fires when screens/key components change but HANDOFF.md is not updated this session.

### Session 28 (2026-06-05) — Filter bar, how-to guide, guide hook

1. **Filter bar declutter** — 4 dropdown buttons (vibe / verdict / genre / series) replaced with a single "filter ▾" button. Active-count badge ("filter · N"). Tapping opens a `FilterSheet` bottom sheet with pill chips per group; "clear all" when any active. `DropdownButton` + `DropdownMenu` components removed.
2. **"How to use" page** (`/guide`) — 5-section guide at `/guide` with inline CSS illustrations matching current UI. Entry points: `?` in library header (always) + "how to use →" in empty-library state.
3. **Guide auto-reminder hook** — `Stop` hook in `.claude/settings.local.json`. Fires when any `src/screens/` or `ItemActionSheet`/`MarkDoneSheet` file was touched; displays: *"guide reminder: screens or key components changed this session — does /guide need updating?"*

### Session 27 (2026-06-05) — Help me decide, data gaps fixes, action card polish

1. **"Help me decide"** — new screen at `/decide`. Three-step decision tree: seen before? → type → vibe. Filters want-to (new) or done (revisit) pool client-side. 2–3 shuffled picks, reshuffable. Entry: inline link in library header title row. Zero API cost.
2. **Wiki gap false positives** — two bugs fixed: (a) `ItemActionSheet` fetched wiki but never saved `metadata.wikiUrl` — added auto-save effect mirroring `ItemRow`. (b) Fill-auto counters (`needsWiki`, `needsRuntime`, `untagged`) didn't respect `dismissedGaps` — now all derived from `itemGaps()`.
3. **Action card link reorder** — `about this` now first after edit, `own it` moved to last.
4. **Series dropdown** — native `<select>` populated from existing series in library. "+ new series…" option reveals a text input. Works on mobile (replaced broken `<datalist>`).
5. **Tidy mode highlights** — in tidy-queue flow, missing fields show red border + red label. "More details" section auto-expands when runtime/pages/wiki are among the gaps.
6. **Roadmap grouped thematically** — near/medium/long-term items now organised by theme.

### Session 26 (2026-06-05) — Nav overhaul, add screen, wiki fix, transitions

1. **Tom's login** — confirmed already working (was already a test user). Phase 4 complete.
2. **Wiki match correctness** — title guard (`const guarded = true`) now applies to film/TV, not just book/music. Prevents wrong Wikipedia articles being saved. Existing bad matches: re-identify case-by-case.
3. **Page transitions** — fade + 6px lift, 180ms, on all route changes. CSS keyframe in `index.css`, wrapper div with `key={location.pathname}` in `App.tsx`.
4. **Nav restructure** — add tab removed; FAB (ink circle, bottom-right, above nav) replaces it. Nav is now library → taste → discover. FAB hides on `/add`.
5. **Add screen streamlined** — no heading; tighter textarea + button; photo + note as compact utility row; "other ways to add" always visible (no toggle); library tools removed entirely.
6. **Library tools → GapsSheet** — batch auto-fill (genre, runtime/pages, mood migration, wiki, art refresh) moved into the tidy sheet as a "fill automatically" section above the individual gap items. Art refresh now only flags covers genuinely below 300px (checks URL patterns per source).

### Session 25 (2026-06-05) — Canon, duplicates UX, data-gaps nav

1. **Canon status** — `metadata.canon` flag. Toggle in reaction view as full-width 5th row between positive and negative reactions. `◆` on list rows + grid cards. `◆ canon` filter chip. Canon section on taste page per medium (cover tiles, no cap). "on my shelf" label for books instead of "own it".
2. **Duplicates UX** — "added first (Mon YYYY)" label on original entry in review sheet. App palette applied.
3. **Data-gaps nav** — `GapsSheet` bottom sheet accessible from Library header ("tidy · N" — always visible, ghosted when no gaps). Fill-by-hand list removed from Add page. Auto-fill tools remain.

### Session 24 (2026-06-05) — Music verdicts, edit view, cover art

1. **Verdict overhaul** — dropped "would revisit"; added "hyperfixation", "in rotation", "unfinished business". MOOD_REMAP updated. Run "clean up" in library tools to migrate existing items.
2. **Edit view tightening** — removed WHAT IT IS / TAGS headings; runtime/pages moved to more details.
3. **Cover art resolution** — TMDB w185→w342, Open Library -M→-L, Wikipedia 160→500px. Refresh tool in library tools.

### Session 23 (2026-06-05) — Vibe/verdict UX overhaul

Vibe/verdict library filter split into separate dropdowns. Unconfirmed vibes pre-populated on mark-done sheet. Verdict starts open by default on first mark-done. "add a verdict →" routes to reaction view. Collapsible MoodChips in reaction flow. Labels: feel→vibe, how it landed→verdict. × alignment fixed.

### Sessions 1–22 (2026-06-02 to 2026-06-04) — Foundation

All core features built: library, add screen, action card, taste page, Spotify sync, Letterboxd import, email capture, Discover feed, vibe/verdict taxonomy, shows near you, data-gaps tidy queue, wiki auto-fill via Wikidata, AI vibes at add time, for-review inbox, testing foundation (Vitest + CI). See git log for full history.
