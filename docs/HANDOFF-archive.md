# Nospaces — Session log archive

Append-only history. The live `HANDOFF.md` keeps only the latest session; everything older lands here. Newest first.

---

### Session 99 (2026-07-01) — recent-view year-only headers + three-state shelf filter. Free, no API calls.

Two small frontend items shipped on `main` (d41c3e6, 3e90d4f), 106/106 Vitest + typecheck + lint + genre-sync green each push. No Anthropic cost. Same verification caveat as recent sessions — local no-auth library is empty, so neither is meaningfully previewable locally; confirmed for real on the deploy with Farah's owned items.

**Recent-view headers** (`src/screens/LibraryScreen.tsx`, `groupByMonth` → `groupByYear`). Month headers ("March 2024") are too granular for old stuff. Reasoned it through together — the month is a meaningful memory anchor only while it's fresh, and the current year (most items, biggest wall) is where breaking it into months actually helps scanning; past years are fewer items each and the month is noise you don't remember. → **current calendar year gets month headers, every earlier year collapses to just the year.** Year-precision backdates still file under the bare year (no invented month). Considered a rolling-12-months cutoff to dodge the Jan-1 cliff (December collapsing into a flat year on New Year's) but Farah chose the simpler calendar-year cutoff for now — parked the rolling version if the cliff ever feels bad. Dropped the now-unused `formatMonthYear` helper.

**Three-state shelf filter** (same file). The shelf filter was a one-way "on my shelf" narrow (owned only). Made it **three-state — on my shelf / not on my shelf / all** — driven by Farah's bookstore case: see your want-to list *minus* the unread copies already at home, so you don't re-buy a dupe. `ownedOnly: boolean` → `shelfFilter: 'all' | 'owned' | 'unowned'`; `'unowned'` filters `!metadata.owned`. Reachable **two ways over one shared state**: (1) the filter sheet's shelf section (two mutually-exclusive chips, neither = all); (2) an **optional sub-menu under "want to"** in the status dropdown — mirrors the existing done→reactions reveal (divider + two toggle rows; pick to refine, tap again to clear, or ignore to see all want-tos). Kept the filter **global** (orthogonal to status, matches the filter-sheet copy) rather than resetting it on status change — it persists if you switch away from want-to, but the "filter · N" badge + active-filters tray keep it visible so it's never a silent hidden filter. Shelf UI still only appears when `hasOwned` (nothing owned → "not on my shelf" = everything, useless).

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
