# Nospaces — Handoff

## 🚦 Current state

| Phase | Status | Summary |
|---|---|---|
| Phase 1 — Stop the bleeding | ✅ Done | Mobile, status, genres, header |
| Phase 2 — Action card + editing | ✅ Done | Two-verb read, auto-fill, type-fix, unconfirmed vibes, labelled tags |
| Phase 3 — Cohesion + tag system | ✅ Done | Vibe/verdict split, canon, data-gaps nav, edit tightening |
| Phase 4 — Data management | ✅ Done | Cover art · data-gaps nav · Tom's login |
| Phase 5 — Discovery + taste | 🔄 In progress | Help-me-decide, how to use, taste page rebuild |

**▶ START HERE:** See "Next session" at the bottom.

## Next session

Priority order:

1. **Move "shows near you" to discover** — currently surfaced in the music filter row; conceptually belongs on the discover tab. UI move only, no data change.
2. **Decade filter** — derived from `item.year`, pure client-side. Lives inside the `filter ↓` sheet (already exists) once built.
3. **Regions map** — creator origin/nationality breakdown on the taste page. Data dependency: `item.creator` is a name string with no country stored. Options: add a country field, or batch-pull from Wikidata. Parked until data strategy is decided.
4. **"About this" when no blurb** — clarified: the separate Wikipedia ↗︎ link already covers the no-blurb case. No change needed — closing this item.

---

## App

Personal PWA taste library for Farah + Tom. Films, books, music, TV. https://nospaces.vercel.app. Two users: farahmokhtar94@gmail.com, tom.effland@gmail.com.

**North star:** one-stop media library + taste-tracking / curation source. The whole point: see all my media easily, at a glance, including on the go. Design mentality: clean, easy, productive, sleek/editorial. Every UX and feature choice serves "at a glance + low friction."

**Design constants:** all-lowercase UI. No emoji anywhere — use text/SVG glyphs; if a unicode symbol might emoji-render on iOS, append `︎` (U+FE0E). Palette: ink `#1C1B19`, graphite `#6F6B64`, mute `#ABA69C`, hairline `#ECEAE6`. Typeface: Geist.

---

## Stack

React + TypeScript + Vite PWA · Supabase (okxuzqqzqpuyepgiskqp) · Google OAuth · Anthropic claude-sonnet-4-5 · Vercel · Postmark inbound (nospaces.xyz) · Repo: github.com/mokhtarfarah/nospaces

### Local dev
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
cd /Users/farahmokhtar/nospaces && npm run dev  # localhost:5173
```

### Testing
```bash
npm test             # Vitest, run once
npm run test:watch   # re-run on change
npm run typecheck    # tsc --noEmit
```
54 tests across `letterboxd`, `gaps`, `spotify`, `shows`, `genres`, `review`. CI runs on every push (GitHub Actions, free). **When adding pure logic, add a test.**

---

## Key files

- `src/screens/LibraryScreen.tsx` — library UI + filter/sort/gaps/dupes
- `src/screens/AddScreen.tsx` — add screen + library tools (auto-fill)
- `src/screens/TasteScreen.tsx` — taste snapshot page
- `src/components/ItemActionSheet.tsx` — action card (read/edit/reaction views)
- `src/components/MarkDoneSheet.tsx` — mark-as-done sheet
- `src/components/GapsSheet.tsx` — data-gaps tidy sheet (accessible from Library header)
- `src/components/DuplicatesSheet.tsx` — duplicate review sheet
- `src/hooks/useItems.ts` — all item CRUD + toggleOwned, toggleCanon, duplicateGroups
- `src/lib/moods.ts` — vibe/verdict vocab + MOOD_REMAP. Edit freely.
- `src/lib/genres.ts` — genre vocab per type. ⚠️ **FOUR copies — update all when adding genres:**
  1. `src/lib/genres.ts` (source of truth for frontend)
  2. `api/genres.ts` (inline — can't import from src/ in Vercel serverless)
  3. `api/identify.ts` (inline)
  4. `api/wiki.ts` (inline in `wikidataFields`)
- `api/{identify,genres,email,art,blurb,lookup,watch,wiki,vibes,runtime}.ts`
- `supabase/schema.sql`

---

## API costs

**Two completely separate billing systems.**

| System | What it is | How billed |
|---|---|---|
| **Claude Code (this chat)** | Farah's Claude Code subscription | Flat subscription — no per-token cost |
| **Nospaces `ANTHROPIC_API_KEY`** | Pay-as-you-go API key in Vercel | Charged per token. Can run out. |

**Per-call estimates:**
- `/api/identify` (Sonnet, single item): ~$0.01
- `/api/genres` or `/api/vibes` (Haiku): ~$0.001
- `/api/recommend` with web_search: **~$0.15–0.20** ← expensive
- `/api/recommend` PDF upload (no web_search): ~$0.05–0.10
- All other endpoints (blurb, art, wiki, shows): free (external APIs)

**Rules:** never run more than 2–3 test API calls to verify a feature. web_search is the most expensive tool — never in loops or exploratory tests. Flag cost impact whenever suggesting a new Anthropic API feature.

---

## Vercel env vars

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side)
- `POSTMARK_SERVER_TOKEN` — needed to activate email talkback (not yet active — waiting on Postmark account approval for sending to gmail, submitted 2026-06-02)
- `POSTMARK_FROM` — optional reply-from override
- `TICKETMASTER_API_KEY` — shows near you (Ticketmaster/Live Nation only)
- `TMDB_API_KEY` — film/TV catalog search in `/api/lookup`

---

## Features

### Email capture
Forward anything to `anything@nospaces.xyz`. AI finds every media item + saves as `want_to`. Photo attachments (incl. HEIC) work. **Big photos don't work via email** — Vercel caps at 4.5MB; Postmark always inlines full attachment; Gmail can't shrink. Use in-app "Add from a photo" instead (downscales to 1600px client-side). **Talkback** (replies to sender): code live, waiting on Postmark account approval.

**DKIM verified (2026-06-02):** was blocked by a Porkbun wildcard CNAME (`*`). Fixed by deleting the wildcard and adding Postmark's DKIM TXT record directly. Selector: `20260602022450pm._domainkey`. Verify: `dig +short 20260602022450pm._domainkey.nospaces.xyz TXT`.

### Spotify sync
Add → "Sync from Spotify" → `/spotify`. Pulls Saved Albums on demand (PKCE OAuth, fully client-side). First sync → all as `want_to`. Subsequent syncs → only new albums as `done`. Deduped by title+artist and `metadata.spotifyId`. Stored: `type:'music'`, `source_detail:'spotify'`, `metadata.{spotifyId,spotifyUrl,coverUrl}`.

### Letterboxd import
Add → "Import from Letterboxd" → `/import`. Upload `watchlist.csv`, `watched.csv`, `ratings.csv`. Ratings→reactions: 5★→loved it, 4/4.5★→liked it, 3/3.5★→eh, ≤2★→not for me. Deduped by title+year. Imports arrive with null creator (no director in CSV) — re-identify fixes one at a time.

### Shows near you
Music category → "shows near you" → `/shows`. Ticketmaster Discovery API. Two tabs: near me (GPS/city list) + all tours (worldwide by artist). Covers TM/Live Nation only — indie venues missing. Bandsintown API gated (applied, not approved). Shape is ready to merge both sources when approved.

### iOS Shortcut — RETIRED
iOS doesn't support PWA file share targets. Use screenshot → share → Mail → forward to nospaces address instead.

### Input paths (summary)
1. Type/describe → Haiku intent → catalog (iTunes/TMDB/OpenLibrary) → PickerSheet → ConfirmSheet
2. Catalog miss → Sonnet identify → ConfirmSheet
3. Single/bulk photo → Sonnet vision → ConfirmSheet / BulkConfirmSheet
4. Save as note (scratch) → no AI, triage later
5. Email forward → Sonnet → bulk save want_to
6. Letterboxd CSV → no AI, stars→reaction
7. Spotify sync → no AI
8. Recommendations PDF → Sonnet → checklist → want_to

---

## Architecture decisions

### Vibe/verdict taxonomy (locked)
- **Verdicts** = your relationship to the work → always manual, AI never suggests. Stored in `moods[]`.
- **Vibes** = properties of the work → AI suggests (unconfirmed), user confirms. Stored in `moods[]` (confirmed) or `metadata.unconfirmedVibes` (unconfirmed, never in moods until user confirms).
- **Axis metadata** in `moods.ts` groups cross-medium synonyms for the recommender.

**Current verdicts (9):** comfort · guilty pleasure · hyperfixation · in rotation · unfinished business · delivers · respect, not love · overrated · so bad it's good

**Current vibes:**
- Core (all media): hazy · dark · melancholic · nostalgic · romantic · off-kilter · epic · playful · sexy · sharp · lush
- Narrative (film/tv/book): intense · heavy · easy · demanding · funny · cozy · earnest
- Film/TV only: arthouse · fun
- Music only: hype · raw · danceable · groovy · mellow · hypnotic
- Book only: propulsive · dense · lyrical · immersive · literary · spare

### Canon
Stored as `metadata.canon: true`. Toggle lives in the reaction view — sits between "liked it" / "loved it" and "eh" / "not for me" rows, styled as the 5th reaction button. Saves immediately (like `toggleOwned`). `◆` marker on library rows and grid cards. `◆ canon` filter chip in library. Canon items shown per-medium on taste page (cover tiles, no cap). Canon is NOT a verdict — it's a curatorial identity statement, not a description of how something landed.

### Wikipedia
Proxied through Vercel (`api/wiki.ts`) to avoid CORS. Multi-fallback cascade (4 queries per item). Film/TV resolution is lenient (trusts top hit, no title guard) — meaning film/TV items may get the wrong article. Books/music use title guard. Persisted to `metadata.wikiUrl/wikiThumb/wikiSummary` via `patchMetadata`. Wikidata fields (year, runtime, director, author, pages) read from structured claims, not article prose.

### Genre vocab — four copies
Vercel serverless can't import from `src/` in `api/`. All four copies must be updated manually when adding genres. See Key files above.

### Action card structure
Read view: flat link row (edit · on my shelf/own it · about this · wikipedia · watch). Unconfirmed vibes shown muted. "add a verdict →" nudge on done items with no verdict → opens reaction view with verdict expanded. Edit view: auto-fill button at top, more-details collapsed section. Reaction view: reaction grid → canon → note → vibe/verdict chips → save.

### Data gaps
`itemGaps()` in `src/lib/gaps.ts` checks: year, creator, genre, runtime/pages, wikiUrl. Gaps accessible from Library header as persistent "tidy · N" link. Opens `GapsSheet` bottom sheet with filter chips + item list → deep-links into `/library?item=&edit=1&tidy=1` tidy-queue flow. Auto-fill tools (batch genre, runtime, wiki, art refresh, cleanup) remain on the Add page under "library tools."

---

## Roadmap

### Near-term

**Library UX**
- **Filter bar declutter** — ✅ shipped. Single "filter ▾" button with active-count badge; opens bottom sheet with pill chips for vibe/verdict/genre/series.
- **Decade filter** — derived from `item.year`, pure client-side, zero API cost. Lives inside the `filter ↓` sheet once built.
- **"Help me decide" decision tree** — ✅ shipped. Guided 3-step flow (seen before? → type → vibe) from `/decide`. Entry: inline link in library header.

**Action card / edit view**
- **Action card link order** — ✅ shipped. New order: edit · about this · spotify · wikipedia · watch · own it.
- **"Add to series" dropdown** — ✅ shipped. Native `<select>` of existing series + "+ new series…" option that reveals a text input. Works on mobile.
- **Data-gaps tidy mode: highlight missing fields** — ✅ shipped. Missing fields show red border/label in tidy-queue flow; more-details auto-expands when runtime/pages/wiki are gaps.

**Data quality / tidy**
- **Wiki gap false positives** — ✅ fixed. Two bugs: (1) ItemActionSheet fetched wiki but never saved it — added auto-save effect. (2) Fill-auto counters didn't respect dismissedGaps — now all derived from itemGaps().
- **Wiki match correctness** — title guard shipped. Existing bad matches: re-identify case-by-case.
- **Data-gaps tidy mode: highlight missing fields** — in tidy-queue flow (`?tidy=1`), show missing fields in red and auto-expand them in edit view. Only in tidy mode.

**Onboarding**
- **"How to use" tutorial page** — ✅ shipped. `/guide` — 5 sections, inline CSS illustrations, accurate to current UI. Entry: `?` in library header + empty-state link. Auto-reminder hook fires when screens change.

**Discovery**
- **Move "shows near you" to discover tab** — currently in music filter row; belongs on discover. UI move only.

**Dev automation (next 3 to build)**
- **Typecheck on Stop hook** — ✅ done. Stop hook runs `tsc --noEmit` and injects a system message if any `error TS` lines are found.
- **HANDOFF.md staleness warning** — ✅ done. `scripts/check-handoff-staleness.sh` fires on Stop; warns if screens/key components changed but HANDOFF.md wasn't updated.
- **moods.ts → guide reminder** — ✅ done. Stop hook regex now includes `src/lib/moods.ts`.

### Medium-term

**Taste & stats**
- **Taste page rebuild** — ✅ shipped. Three sections: identity (vibe ranked line + AI prose) → stats (lede, reaction breakdown, verdict tendencies, effort axis; filterable by medium) → by medium (collapsible cards per type).
- **Regions map** — creator origin breakdown. Parked: needs nationality data (not stored). Next step: decide between manual country field vs Wikidata batch-pull.
- **Taste stats: reaction breakdown** — ✅ shipped as part of taste page rebuild.

**Taxonomy / vocabulary**
- **New verdict: "stuck with me"** — ✅ shipped. Between "delivers" and "respect, not love". For things that weren't immediately enjoyable but lingered.
- **Want-to priority** — pin or tier system for backlog items, especially books and music. Affects sort order and help-me-decide weighting.

**Discovery & search**
- **Discovery improvements** — "not interested" / dismiss on Discover suggestions; divert mode as data accumulates.
- **Descriptive library search** — "cozy films I haven't watched" → light AI step maps sentence to existing filters.

**Data & input**
- **Individual songs** — currently albums-only for music.
- **Describe-by-recency for film/TV** — "that new Villeneuve movie" via TMDB person→credits. Music/books already work.
- **Letterboxd diary.csv** — per-watch dates and repeat viewings. Not imported yet.
- **Bandsintown API** — broader show coverage. Applied, not approved. Proxy + Show shape ready to merge.

**Infrastructure**
- **Offline capture queue** — IndexedDB, save offline, sync on reconnect. PWA service worker already in place.

### Long-term

- **Restaurants, museums, exhibitions, experiences** — expand beyond media. Same reaction/note/tag model; new types. Taste profile generalises naturally.
- **Calendar integration** — surface relevant items + suggestions based on where Farah will be. "You'll be in Tokyo in March — 3 things from your want-to list."
- **Master "life index"** — nospaces as curated self-portrait across all domains (media, food, places, events). Not a tracker but a mirror + recommendation engine. Every feature decision: does this make the index richer or the curation sharper?

---

## Recent session log

### Session 30 (2026-06-05) — Taste page rebuild + new verdict

1. **New verdict: "stuck with me"** — added to `VERDICTS` in `src/lib/moods.ts` between "delivers" and "respect, not love". For things that weren't immediately enjoyable but lingered.
2. **Taste page rebuild** — `TasteScreen.tsx` restructured into three sections:
   - **① Identity** (unchanged) — vibe ranked line + "rarely lands" + AI prose.
   - **② Stats** (new) — medium filter pills (`all · films · books · music · tv`) controlling: lede ("X things · Y% loved"), "what you reach for" reaction breakdown grid (per reaction tier: top genre+vibe tags by frequency), "verdicts" (frequency-ranked verdict tendencies), "effort" (easy ←→ demanding dot bar derived from vibe tags on loved+liked items; hidden if < 3 signal items).
   - **③ By medium** (collapsible) — film/book/music/tv each as a collapsed row; header shows rated count + loved % + canon count; expands to show canon tiles + top creators + top genres.
   - **Era map removed.** Replaced by regions (parked — needs creator nationality data).

### Session 29 (2026-06-05) — Genre sync guard + dev automation plan

1. **Genre sync guard** — `scripts/check-genres.mjs` diffs the three copies of the genre vocab (`src/lib/genres.ts`, `api/genres.ts`, `api/identify.ts`) and exits 1 if any are out of sync. Wired as `.git/hooks/pre-commit` — blocks commits when copies diverge. Run manually: `node scripts/check-genres.mjs`.
2. **Session-length Stop hook** — `scripts/check-session-length.sh` counts numbered items in the current session block in HANDOFF.md; injects a "good stopping point" system message when ≥ 4 items shipped. Fires after every Claude turn.
3. **moods.ts → guide reminder** — Stop hook regex extended to also fire when `src/lib/moods.ts` is touched (new verdicts/vibes require updating the guide's reaction section).
4. **Typecheck on Stop** — `tsc --noEmit` added to Stop hook; injects system message on any `error TS` output.
5. **HANDOFF.md staleness warning** — `scripts/check-handoff-staleness.sh` added to Stop hook; fires when screens/key components change but HANDOFF.md is not updated this session.

### Session 28 (2026-06-05) — Filter bar, how-to guide, guide hook

1. **Filter bar declutter** — 4 dropdown buttons (vibe / verdict / genre / series) replaced with a single "filter ▾" button. Active-count badge ("filter · N"). Tapping opens a `FilterSheet` bottom sheet with pill chips per group; "clear all" when any active. `DropdownButton` + `DropdownMenu` components removed.
2. **"How to use" page** (`/guide`) — 5-section guide at `/guide` with inline CSS illustrations matching current UI. Entry points: `?` in library header (always) + "how to use →" in empty-library state.
   - Section 01: saving things — 3 numbered paths (type / photo / email), each with full description text inside the illustration. "nospaces finds it and fills in the details" as a bold footer. Letterboxd + Spotify as extras.
   - Section 02: logging a reaction — illustration matches current `MarkDoneSheet` layout (loved/liked → full-width canon → eh/not for me → vibe chips). Canon tip here. In progress + note as extras.
   - Section 03: your library — illustration shows current filter bar + thumbnail rows. Data gaps + series as extras (series: no TV seasons).
   - Section 04: discover — shows actual `ResultRow` layout (cover + "via [source]" + italic why blurb + save). No vibe chips (not a real feature — noted for roadmap).
   - Section 05: taste — shows real taste page (vibe chip hero + `CategoryCard` with canon tiles + ranked genres).
   - "A few more things" block removed — redistributed as per-section extras.
3. **Guide auto-reminder hook** — `Stop` hook in `.claude/settings.local.json`. Fires when any `src/screens/` or `ItemActionSheet`/`MarkDoneSheet` file was touched; displays: *"guide reminder: screens or key components changed this session — does /guide need updating?"*

### Session 27 (2026-06-05) — Help me decide, data gaps fixes, action card polish

1. **"Help me decide"** — new screen at `/decide`. Three-step decision tree: seen before? → type → vibe. Filters want-to (new) or done (revisit) pool client-side. 2–3 shuffled picks, reshuffable. Entry: inline link in library header title row. Zero API cost.
2. **Wiki gap false positives** — two bugs fixed: (a) `ItemActionSheet` fetched wiki but never saved `metadata.wikiUrl` — added auto-save effect mirroring `ItemRow`. (b) Fill-auto counters (`needsWiki`, `needsRuntime`, `untagged`) didn't respect `dismissedGaps` — now all derived from `itemGaps()`.
3. **Action card link reorder** — `about this` now first after edit, `own it` moved to last.
4. **Series dropdown** — native `<select>` populated from existing series in library. "+ new series…" option reveals a text input. Works on mobile (replaced broken `<datalist>`).
5. **Tidy mode highlights** — in tidy-queue flow, missing fields show red border + red label. "More details" section auto-expands when runtime/pages/wiki are among the gaps.
6. **Roadmap grouped thematically** — near/medium/long-term items now organised by theme (Library UX, Action card, Data quality, Taste & stats, etc.).

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

---

## Working style

- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted.
- Flag good moments to start a fresh chat (long sessions = expensive).
