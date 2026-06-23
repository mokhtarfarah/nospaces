# Nospaces — Session log archive

Append-only history. The live `HANDOFF.md` keeps only the latest session; everything older lands here. Newest first.

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
