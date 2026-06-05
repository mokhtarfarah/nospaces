# Nospaces — Handoff

## App
Personal PWA taste library for Farah + Tom. Films, books, music, TV. https://nospaces.vercel.app. Two users: farahmokhtar94@gmail.com, tom.effland@gmail.com.

## North star (read before every design call)
Nospaces is a **one-stop media library + taste-tracking / curation source** — Farah's single source of truth for everything she's watched, read, listened to, and wants to. The whole point: **see all my media easily, at a glance, including on the go.**

Design mentality: **clean, easy, productive, sleek/editorial.** Every UX and feature choice serves "at a glance + low friction." Claude should proactively suggest tweaks that push toward this (and flag things that fight it). When in doubt, favor clarity and calm over more options.

## Stack
React + TypeScript + Vite PWA · Supabase (okxuzqqzqpuyepgiskqp) · Google OAuth · Anthropic claude-sonnet-4-5 · Vercel · Postmark inbound (nospaces.xyz) · Repo: github.com/mokhtarfarah/nospaces

## Local dev
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
cd /Users/farahmokhtar/nospaces && npm run dev  # localhost:5173
```

## Testing (added session 18)
```bash
npm test        # run all unit tests once (Vitest)
npm run test:watch   # re-run on change while developing
npm run typecheck    # tsc --noEmit (also runs inside `npm run build`)
```
- **What's covered:** pure logic that breaks silently — `letterboxd` (CSV parse, star→reaction, dedup, insert build), `gaps`, `spotify` (dedup/insert), `shows` (distance, liked/loved artists), `genres` (`isGenreTag`), `review` (inbox membership). Tests live next to the code as `*.test.ts` under `src/lib/`.
- **NOT covered:** React components/screens, API endpoints (no live API calls in tests — keeps it free + fast). Add component tests later only if a screen keeps regressing.
- **CI gate:** `.github/workflows/ci.yml` runs typecheck + tests on every push/PR to GitHub (free GitHub Actions, **zero Anthropic/token cost**). A red check = broken build before it reaches Vercel. **When adding pure logic, add a test for it.**

## Key files
- `src/screens/LibraryScreen.tsx` — library UI
- `src/screens/AddScreen.tsx` — add screen (AI, photo, shortcut)
- `src/screens/TasteScreen.tsx` — taste snapshot (3rd nav tab)
- `src/screens/ImportScreen.tsx` — Letterboxd CSV import
- `src/lib/letterboxd.ts` — Letterboxd parsing + mapping logic (pure, unit-tested)
- `src/lib/genres.ts` — **editable** genre vocab per type (film/tv/book/music). Edit here to add/remove genres. ⚠️ **THREE manual copies — update all when changing genres:** `src/lib/genres.ts` (source of truth), `GENRE_VOCAB` in `api/wiki.ts` (wiki auto-fill), and `GENRE_VOCAB` in `api/genres.ts` (genre auto-fill on add + wiki-fill). Drift here silently drops genres (e.g. a book genre missing from `api/genres.ts` gets filtered out). Synced as of session 18 (incl. `historical fiction`, `memoir`).
- `src/lib/moods.ts` — **editable** mood/vibe list. Edit here to add/remove moods.
- `src/components/{MarkDoneSheet,ItemActionSheet,ConfirmSheet,ViewSheet,NoteInput}.tsx`
- `src/hooks/{useItems,useAuth}.tsx`
- `api/{identify,genres,email,art,blurb,lookup,watch}.ts`
- `src/lib/{artwork,blurb,wikipedia,seasons}.ts`
- `supabase/schema.sql`

## API costs — read before every session

**Two completely separate billing systems. Do not confuse them.**

| System | What it is | How billed |
|---|---|---|
| **Claude Code (this chat)** | Farah's Claude Code subscription | Flat subscription — no per-token cost, no risk of running out mid-session |
| **Nospaces `ANTHROPIC_API_KEY`** | Pay-as-you-go API key in Vercel | Charged per token. Balance can run out. Top up at console.anthropic.com → Billing |

**Per-call cost estimates for the app:**
- `/api/identify` (Sonnet, single item): ~$0.01
- `/api/genres` (Haiku, batch): ~$0.001
- `/api/recommend` text/URL query (Sonnet + web_search): **~$0.15–0.20** ← expensive
- `/api/recommend` PDF upload (Sonnet, no web_search): ~$0.05–0.10
- All other endpoints (blurb, art, wiki, shows): free (external APIs, no Anthropic)

**Rules for Claude during development sessions:**
- **Never run more than 2–3 test API calls** to verify a feature. Confirm the approach in code/types first; test sparingly.
- **web_search is the most expensive tool** ($10/1,000 searches + token cost). Never run it in loops or exploratory tests.
- If verifying something can be done by reading types or code, do that instead of making a live call.
- Flag the cost impact whenever suggesting a new Anthropic API feature (web_search, PDF, etc.).

## Vercel env vars
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (frontend)
- `ANTHROPIC_API_KEY`
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (server-side, email API)
- `POSTMARK_SERVER_TOKEN` — **needed to activate email talkback** (get from Postmark → Servers → API Tokens). Not set yet → talkback silently no-ops, saving still works.
- `POSTMARK_FROM` — optional reply-from override (e.g. `Nospaces <hello@nospaces.xyz>`)
- `TICKETMASTER_API_KEY` — ✅ **set.** Powers the "shows near you" tour-dates feature (Discovery API key from https://developer.ticketmaster.com). ⚠️ Coverage is Ticketmaster/Live Nation inventory only — indie + non-TM-ticketed shows won't appear (see Music section for the Bandsintown follow-up).
- `TMDB_API_KEY` — ✅ **set** (Production + Preview). Powers film/TV catalog search in `/api/lookup` (used by describe-to-add).

## Email capture
Forward anything to `anything@nospaces.xyz` from an allowed address. AI finds every media item + saves as `want_to`. Photo attachments (incl. HEIC) work.

**Newsletter blurbs (session 14):** each item's per-item `summary` from the email (the newsletter's own words about it — prompt now tells the model to quote/paraphrase the email, not invent) is saved as `metadata.recommendationBlurb` with `recommended_by = <newsletter name>`. The action card shows it under a "via [newsletter]" toggle — same display as recommendation-list items (e.g. New Music Tuesday album descriptions). Header source label dedups against the blurb toggle so the source isn't named twice. **Only applies to newly forwarded emails** — existing items can't be backfilled (the newsletter text isn't stored).

**Big photo attachments don't work via email (by design, 2026-06-02).** Vercel caps inbound requests at 4.5MB (hard limit, not configurable); Postmark always inlines the full attachment; Gmail can't shrink attachments. So a full-res photo email → HTTP 413, whole email rejected (all-or-nothing). Text/newsletters and small screenshots always work. **For big photos use the in-app "Add from a photo" button** — it now downscales to 1600px/JPEG client-side (`prepareImage` in AddScreen.tsx), so it always fits, runs faster, and handles HEIC. No email re-architecture planned.

**Talkback** (code live, not yet active): replies to sender with what was saved. To activate:
1. ✅ Postmark DKIM verified (Return-Path ✅, MX ✅, DKIM ✅ — see DKIM fix below, now resolved)
2. Add `POSTMARK_SERVER_TOKEN` to Vercel env vars → redeploy
3. ⏳ **Waiting on Postmark account approval** (submitted 2026-06-02, needed to send to gmail). Talkback goes live once approved.

### DKIM verified ✅ (root cause found + fixed 2026-06-02)
DKIM wasn't slow, it was **blocked**. Porkbun has a **wildcard CNAME** (`*.nospaces.xyz → pixie.porkbun.com`, their URL-forwarding/parking). It intercepts the DKIM lookup (`*._domainkey.nospaces.xyz`) and answers with parking junk, so Postmark never sees the signing key. Confirmed: a made-up subdomain still resolves to pixie.porkbun.com. MX (`inbound.postmarkapp.com`) and Return-Path (`pm-bounces → pm.mtasv.net`) work because they have explicit records that override the wildcard.
**Fix:** In Porkbun DNS, (1) delete the wildcard `*` record, (2) add Postmark's exact DKIM record (hostname + `k=rsa;p=...` value from Postmark → Sending → Domains → nospaces.xyz → DKIM). Then DKIM goes green.

**Status as of 2026-06-02:** ✅ Wildcard deleted. ✅ DKIM TXT record added clean — selector `20260602022450pm._domainkey`, exactly one record, value matches Postmark char-for-char (an earlier attempt had a duplicate + a `0`-for-`O` typo, both fixed; verified via `dig`). ✅ **Postmark now shows DKIM verified.** Return-Path also ✅ verified. Talkback reply now only needs **Postmark account approval** (still pending) before replies land.
**To re-check the DNS record anytime:** `dig +short 20260602022450pm._domainkey.nospaces.xyz TXT` (should return exactly one `k=rsa;...` line containing `SaMgQ1OJ2eY` with a capital O).

## Spotify sync ✅ DONE (built 2026-06-02, live)
Add screen → "Sync from Spotify" → `/spotify`. Pulls your **Saved Albums** on demand (no background sync).
- **Fully client-side OAuth** (Authorization Code + PKCE). No Client Secret, no server function, no token storage. `src/lib/spotify.ts` (logic) + `src/screens/SpotifyScreen.tsx` (UI, mirrors ImportScreen).
- **Status rule:** first ever sync → all albums as `want_to` (backlog to triage). Every sync after → only *newly saved* albums, as `done` (no reaction; Farah adds her own). Detected by whether any `source_detail==='spotify'` item already exists.
- Deduped vs existing music by title+artist key AND by `metadata.spotifyId`.
- Stored as `type:'music'`, `source:'manual'`, `source_detail:'spotify'`, `metadata.{spotifyId,spotifyUrl,coverUrl}`. Posters resolve via `/api/art` (Deezer/iTunes) at display time.

✅ **Fully activated** — Spotify dev app created, Client ID in Vercel, users added. Working in prod.

## iOS Shortcut (flaky)
Share screenshot → POST to `/api/identify-upload` → copy URL to clipboard → open app → tap "From Shortcut" → paste → confirm. Clipboard sometimes empty on second run.

## Letterboxd import ✅ DONE (built 2026-06-02, live)
Add screen → "Import from Letterboxd" → `/import`. Upload `watchlist.csv`, `watched.csv`, `ratings.csv` from Letterboxd Settings → Data → Export (all three at once is fine). Detected by filename.
- `ratings.csv` → `done` + reaction: 5★ → loved it, 4/4.5★ → liked it, 3/3.5★ → eh, ≤2★ → not for me (half-stars round to nearest)
- `watched.csv` → `done`, no reaction
- `watchlist.csv` → `want_to`
- Deduped vs existing films (title+year); rated > watched > watchlist when a film appears in multiple files
- Stored as `type:film`, `source:'manual'`, `source_detail:'letterboxd'`, `metadata.letterboxdRating`
- Posters/blurbs resolve via `/api/art` at display time — nothing extra to do

✅ **Tested with real export.** No public Letterboxd API exists for sync — CSV is the only path.

## TODO / Roadmap (last edited 2026-06-04, updated session 21)

---

## 🗺 MASTER ROADMAP

This is the single source of truth for nospaces direction. Each session should pull from here. Update it when things ship or priorities shift.

### Phase 1 — Stop the bleeding ✅ DONE (session 20, 2026-06-04)

All shipped to `main`:
- ✅ Mobile bottom cutoff fixed — `calc(80px + env(safe-area-inset-bottom))` on all pages
- ✅ TV season button resize fixed — `minWidth: 44` keeps checked/unchecked same width
- ✅ Header pattern unified — small `fontSize: 15` heading + `20px` top padding on Add, Taste, Shows, Library (all match Discover)
- ✅ "library" heading added back — small, consistent with other pages; bottom nav stays (correct for mobile PWA ergonomics)
- ✅ In progress status — `ItemStatus` now `want_to | in_progress | done`; filter chip in library; "mark as in progress" on action card; Supabase migration ✅ run
- ✅ Music genres expanded — added: art pop, experimental, funk, glam rock, new wave, post-punk
- ✅ Verdict removed — "they don't make 'em like this" dropped from vocab + MOOD_REMAP (cleanup tool will strip from existing items)
- ✅ Genre 3-copy problem fixed — `api/genres.ts` + `api/wiki.ts` now import from `src/lib/genres.ts`; one place to edit genres forever

### Phase 2 — Action card + editing flow ✅ DONE (session 21, 2026-06-04)

All shipped to `main`. Eyeballed in prod. Working.

**✅ DONE session 21 — the wiki auto-fill fix** (branch `phase2-wiki-autofill-fix`, committed, NOT pushed):
- Root cause found: fill-from-wiki missed runtime/director/author/pages because `api/wiki.ts` parsed the article *prose* (`explaintext`), which strips the infobox where those facts live. See memory `wiki-autofill-rootcause`.
- Fixed: `wikidataFields()` in `api/wiki.ts` now reads structured **Wikidata** claims (P577/P571/P580 year, P2047 runtime, P57/P170 director/creator, P50 author, P175/P86 artist, P1104 pages). No Anthropic call for these fields. Verified across film/tv/book/music incl. co-directors. Genre still via `/api/genres`.
- Gaps (expected, not bugs): Wikidata often lacks book page counts; a wrong stored wiki link (e.g. "The Goldfinch" → the painting) fills wrong facts → that's what the escape hatch below is for.

**✅ DONE session 21 — card restructure (all 6 steps).** Branch `phase2-wiki-autofill-fix`, committed, NOT pushed. Mockup deleted. Built in `src/components/ItemActionSheet.tsx` + `src/hooks/useItems.ts`. typecheck + 54 tests + build all green. ⚠️ **Auth-gated — NOT eyeballed logged-in.** Verify next session in prod: open an item → read view shows labelled genre/vibe/verdict lines + just `edit`/`own it`; open edit → one `auto-fill from wikipedia` (or `identify with ai`) button at top, type chips fixable, tags grouped, details collapsed; change type → film-only tags drop on save. Add a new film/book → AI vibes appear muted on the vibe line, confirm on edit-save. What each step became:
1. ✅ Two verbs: read view = `edit` + `own it` only. Dropped the inline `edit tags`/`+ tags` toggle + the `from: quick add` source label (source moved into edit → more details).
2. ✅ Merged `auto-fill` button at top of edit. Wiki link stored → Wikidata fetch (fills blanks only); no link → AI `identify` (replaces fields). After running, a callout shows what it filled + which article + a `wrong article? identify instead →` escape hatch. Alternatives populate the edit fields (no auto-save).
3. ✅ Type fixable. `persistEditFields()` saves the chosen `type` AND drops genres/vibes outside the new type's vocab. Removed the old `applyCandidate()` hardcoded-type auto-save path.
4. ✅ Vibes auto-applied UNCONFIRMED. `useItems.addItem` fires `/api/vibes` alongside `/api/genres`, stores results in `metadata.unconfirmedVibes` (NEVER moods). Bulk imports skipped (`importItems`). Taste page + recommender read `moods`, so they already only count confirmed vibes — no change needed there. Confirm = open edit + save. Removed the old on-open `/api/vibes` fetch + `suggestedVibes`/`dismissedSuggestions`.
5. ✅ Labelled tag lines on read view. Unconfirmed vibes muted on the vibe line. Done items with no verdict get a small `how did it land? add a verdict →` nudge → opens edit.
6. ✅ `more details` collapsed `<details>`: reference link, series, cover url, source, your description.

**Old plan (locked decisions, kept for reference):**
1. **Two verbs only.** Read view shows `edit` (whole item) + the reaction control. Drop the "edit tags" link + the "from: quick add" source label from the read view (fold into edit).
2. **Merge re-identify + fill-from-wiki → one `auto-fill` button** at top of edit view. Wiki link present → Wikidata fetch (`/api/wiki?url=…&type=…&parse=1`, already returns the structured fields). No link → AI identify (label flips to `identify`). **After it runs, show what it pulled + which article, with a one-tap "wrong article? re-identify" escape hatch** (handles wrong stored links).
3. **Type fixable.** Type chips in edit are authoritative; whatever's picked wins on save. Fixes `applyCandidate()` hardcoding `item.type`. When type changes, decide tag handling (drop genres/vibes not in the new type's vocab).
4. **Vibes auto-applied but UNCONFIRMED.** AI fills vibes at add-time (like genre) — call `/api/vibes` in `useItems.addItem` background patch alongside the `/api/genres` call; skip on bulk imports (Letterboxd/Spotify) for cost. Mark them provisional in metadata (e.g. `metadata.unconfirmedVibes: string[]`). **Taste page + recommender must only count vibes the user has actually touched/confirmed** — else the taste mirror reflects AI guesses. Remove the old "suggested" dashed-chip + "ignore" mechanism (`suggestedVibes`/`dismissedSuggestions` in ItemActionSheet, the on-open `/api/vibes` fetch).
5. **Labelled tag lines** on read view (genre / vibe / verdict each get a small label). Tags grouped together in edit (genre + vibe + verdict in one section). Verdict: for *done* items with no verdict set, add a small prompt nudge (Phase 2 audit item, not yet solved).
6. **Other tucked into "more details"** (collapsed): reference link, series, cover url, source, your blurb.

**Audit findings (session 20):**
- Type override is broken — `applyCandidate()` hardcodes `item.type`, so re-identify can never fix a wrong type
- Fill-from-wiki only shows the button after you manually type a Wikipedia URL — if the URL is already stored, button should appear immediately
- Edit view shows no item title — you lose context of what you're editing
- Suggested vibes are disconnected from the tags editing flow — they appear separately, should be inside "edit tags"
- Genre line on main view has no label — "thriller · crime" floating with no intro
- "edit tags" misnaming — it edits genre + vibe + verdict, should just be "tags"
- Verdict hidden unless you open "edit tags" — needs more surface area for done items
- Four confusingly similar verbs: "edit", "edit tags", "mark reaction", "edit reaction"

**To build (one pass, mock before building):**
- Fix type override: edit view save + re-identify both respect the type dropdown
- Fill-from-wiki: show button immediately if `wikiUrl` already stored
- Edit view shows item title at top
- Rename "edit tags" → "tags" everywhere
- Suggested vibes move inside the "tags" expanded area
- After tapping a suggested vibe, show similar ones inline (not dismiss all)
- "Tags" links straight to suggestions, visible and actionable
- Genre line gets a small label on main view
- Genre · vibe · verdict on one scannable line (or better visual grouping)
- Verdict prominent for done items with no verdict set — small prompt
- Edit-reaction view shows which item you're on
- Fiction/non-fiction clearer on items (especially books)

**Parked for after Phase 2:**
- Re-identify with full type override (allow fixing type without delete-and-re-add)
- Fill-from-wiki reliability — investigate `parse=1` endpoint
- "own it" → "on my shelf" for books

### Phase 3 — Cohesion + tag system

- Vibe and verdict as separate filters in library (currently mixed)
- Decide vibe filtering on "all" page (risk of noise — needs UX decision first)
- Page transitions feel like one product (shared design language, consistent spacing)
- Canon status field — lightweight pin for ~10 defining items, separate from reaction scale

### Phase 4 — Data management

- Move data-gaps nav from Add page → Library as a dedicated linked page with easy in/out
- Cover-art quality pass — biggest visual/tastemaker payoff; own dedicated session
- Offline capture queue (IndexedDB) — save offline, sync on reconnect
- Tom's login — publish Google OAuth consent screen
- Wiki match correctness — film/TV resolution lenient (trusts top hit, no title guard). Spot-check items whose saved `wikiUrl` title doesn't match the item title

### Phase 5 — Discovery + taste insights

**Taste page refresh (whole pass):**
- Rebuild now that vibe/verdict taxonomy is locked (was built before overhaul)
- Go deeper than ranked tag lists:
  - Effort axis (easy ↔ demanding) — pairs with runtime/pages data
  - Cross-type vibe patterns ("you gravitate toward hazy + melancholic across all media")
  - Verdict tendencies ("comfort" vs "overrated" — what you keep vs reject)
  - Era/decade clustering if year data is rich enough
  - **Regional split** — creator origin analysis: "70% of your favourite films are by European directors", "you lean toward British literary fiction". Pure client-side from creator names + optional Wikipedia nationality metadata. No API cost. Reveals geographic taste patterns that feel genuinely surprising.
  - **Aspirational vs actual taste** — gap between what you save as want-to vs what you actually rate highly. Mirror insight: "you save a lot of X but rarely love it."
- Think like a tastemaker's annual report, not a sorted list

**Discovery improvements:**
- "Not interested" / dismiss on Discover suggestions — richer signal for the recommender
- Divert mode improvements as data accumulates

### Long-term (directional, not scheduled)

- Restaurants, museums, exhibitions, experiences — expand beyond media; same reaction/note/tag model
- Calendar integration — surface relevant items + suggestions based on where Farah will be
- Master "life index" — nospaces as curated self-portrait across all domains
- Bandsintown API access (if/when approved) — broader show coverage beyond Ticketmaster
- Describe-by-recency for film/TV (TMDB person→credits path — music/books already work)
- Individual songs (currently albums-only for music)

---

### 📌 Session 21 (2026-06-04) — Phase 2 shipped + genre/vibe bug fixes

**Shipped to `main` / live (all verified in prod):**

1. ✅ **Phase 2 card restructure** — full rebuild of `ItemActionSheet.tsx`. See Phase 2 section for the 6-step breakdown. Short version: two-verb read view (edit + own it), merged auto-fill button, type-fixable, labelled tag lines, unconfirmed vibes, more-details collapsed.
2. ✅ **One flat link row** — `edit · own it · about this · wikipedia · watch` all on one row (was split into two rows, no hierarchy between actions and links).
3. ✅ **Better escape hatch** — after auto-fill in edit view, "wrong article?" now offers two options: `identify with ai →` OR `paste a different wikipedia link ↓`. Second option opens more-details and focuses the URL field. Changing the URL resets the callout so auto-fill can re-run against the new article.
4. ✅ **In progress → want to** — "move back to want to" text link added to the in_progress footer (was one-way — you could mark in progress but had no escape).
5. ✅ **`api/genres` 500 fixed** — the import `from '../src/lib/genres'` was silently failing in Vercel's serverless bundler (`tsconfig.json` has `"include": ["src"]` which doesn't cover the `api/` layer). Every background genre fill has been returning 500 since session 18 — hidden by a silent catch. Fixed by inlining the GENRE_VOCAB directly in `api/genres.ts`.
6. ✅ **`api/identify.ts` GENRE_VOCAB synced** — was missing genres added in Phase 1: `historical fiction`, `memoir`, `art pop`, `experimental`, `funk`, `glam rock`, `new wave`, `post-punk`. Items identified via AI were getting wrong/missing genre suggestions.
7. ✅ **On-open genre + vibe fill** — items that were added while the genre API was broken (or where add-time fills returned empty) now auto-fill on first card open. One `useEffect` on `item.id` checks for missing genres AND missing vibes; fires whichever API calls are needed; writes genres to `tags` and vibes to `metadata.unconfirmedVibes`. Subsequent opens skip both (data already present). Cost: ~$0.002/item, one-time.

**Genre vocab — FOUR copies now. Update all when adding genres:**
- `src/lib/genres.ts` — frontend source of truth (chip editors, filters, isGenreTag)
- `api/genres.ts` — background fill endpoint (inline copy, can't import from src/)
- `api/identify.ts` — AI identify endpoint (inline copy)
- `api/wiki.ts` — Wikidata parse genres list (inline in the `wikidataFields` function)

**▶ NEXT SESSION STARTS HERE:** Phase 3. See roadmap below. Suggested priorities in order:

1. **Vibe + verdict as separate filters** (Phase 3, S) — currently mixed in the mood filter. Split into two filter chips. Needs a UX decision first: show vibes filter on "all" tab or only per-type?
2. **Taste page rebuild** (Phase 5, L) — now that vibe/verdict taxonomy is locked and vibes are actually filling, the taste page reflects real data. Good time to rebuild it: cross-type vibe patterns, effort axis, verdict tendencies. This is the "tastemaker mirror" — the killer feature.
3. **Cover-art quality pass** (Phase 4, M) — biggest visual impact. Low-res / inconsistent art cheapens the grid. Own session.
4. **Canon / pinned favorites** (Phase 3, S) — lightweight pin for ~10 defining items, separate from the reaction scale.

---

### 📌 Session 20 (2026-06-04) — Phase 1 fixes + roadmap

**Shipped to `main` / live:**
See Phase 1 section above.

**SQL run by Farah:** `items_status_check` constraint updated to include `in_progress`.

**▶ NEXT SESSION STARTS HERE:** Phase 2 — action card + editing flow (see Phase 2 section above). Start by mocking the restructured card before building.

---

### 📌 Session 17 summary (2026-06-03) — tidy queue, edit view overhaul, wiki auto-fill

**Shipped to `main` / live:**
1. ✅ **"Save & next" tidy queue** — fill-by-hand list walks through gappy items in place: tap → edit view → "save & next ›" saves + advances; "skip ›" skips temporarily; "nothing to fill — dismiss" permanently dismisses all gaps. Header shows "tidying · N of total". `itemGaps`/`gapQueue`/`dismissGaps` in shared `src/lib/gaps.ts`.
2. ✅ **"for review" chip rename** — "? scratch" → "for review" (prototype inbox label). Internal `metadata.scratch` flag unchanged.
3. ✅ **Edit view overhaul** — type chips moved to top; genre chip editor (active chips + collapsible picker); runtime/pages input; Wikipedia URL field; tighter layout (`smInput`, gap 6, grouped rows). Re-identify removed from main card header (kept in edit view top-right).
4. ✅ **Wiki auto-fill** — paste a Wikipedia URL in the edit view → "fill from wiki →" button appears → Haiku parses year, creator, runtime/pages, genres from the article extract + categories (categories added to fix genre — Wikipedia stores genre in infobox, not prose). Pre-fills only empty fields. ~$0.002/call.
5. ✅ **Genre count discrepancy fixed** — "fill automatically" untagged count now uses `isGenreTag()` (same as fill-by-hand), so items with descriptor tags but no genre tag are counted consistently in both.
6. ✅ **Dismiss gaps** — ✓ button on each gap row permanently dismisses all current gaps for that item (`metadata.dismissedGaps[]`); `itemGaps()` skips dismissed gaps. Also reachable from tidy edit view ("nothing to fill — dismiss").
7. ✅ **Library header slim** — removed "Library" h1 (redundant with nav tab); "N col" toggle moved to compact bare number next to grid icon; controls tightened to 11–13px.
8. ✅ **"historical fiction" added** to book genre vocab. `GENRE_VOCAB` in `api/wiki.ts` also updated (kept in sync manually — update both when adding genres).

**▶ NEXT SESSION STARTS HERE:**

### 📌 Session 19 (2026-06-04) — AI vibe suggester + Discover feature

**Shipped to `main` / live:**

1. ✅ **Mood cleanup migration run** — old tags remapped (atmospheric→hazy, artsy→arthouse, upbeat→fun, relaxed→easy; tearjerker/feel-good/dreamy/life-changing dropped). `MOOD_REMAP` in `src/lib/moods.ts`.
2. ✅ **"For review" inbox verified** — working in prod (auth-gated, couldn't test in preview earlier).
3. ✅ **AI vibe suggester** — `api/vibes.ts` (Haiku, ~$0.001/call). On card open, suggests 1–3 vibes from the type-specific vocab as faded dashed chips below the tag area. Tap to apply, "ignore" to dismiss. Never auto-applied. `ItemActionSheet.tsx` — `suggestedVibes` + `dismissedSuggestions` state, `useEffect` on `item.id`.
4. ✅ **Discover feature** — full feed-grounded recommendation engine. New route `/discover`, 4th bottom nav tab (4-pointed star icon, last after taste).
   - **Sources:** 30 curated feeds — Substacks (Pandora Sykes, George Saunders, Jess White, Record Store, Honest Broker, The Reveal, Molly Young, Patti Smith), editorial RSS (Bandcamp Daily, Aquarium Drunkard, Pitchfork, Vulture, Film Comment, Roger Ebert, Literary Hub, The Millions, The Marginalian, The Guardian, The Atlantic, The New Yorker, NME), Reddit (r/booksuggestions, r/literature, r/52books, r/ifyoulikeblank, r/indieheads, r/vinyl, r/TrueFilm, r/Letterboxd, r/MovieSuggestions, r/televisionsuggestions). Config in `src/lib/feeds.ts`.
   - **Architecture:** `api/recommend-feeds.ts` — fetches feeds in parallel (5s timeout each), parses RSS/Atom XML, passes content + taste profile + library to Sonnet. ~$0.03–0.05/run. `maxDuration: 60`.
   - **Two modes:** In-taste (feeds as context + Claude knowledge, best matches) and Divert (Claude draws from own knowledge, leads with what's different before explaining the thread back). Separate prompts, genuinely different results.
   - **UI:** Type tabs as primary nav (film/book/music/tv/all). In-taste auto-loads, divert lazy-loads on demand. Editorial aesthetic matching taste/library (INK/GRAPHITE/MUTE/HAIR palette, hairlines, no card borders). Cover art + Wikipedia links per result. Multi-source corroboration: `sources: string[]` — shows "via Pandora Sykes + 1 more" when multiple sources mention a title.
   - **48h cache** per mode in `user_prefs.discoveryCache`. Add/remove custom feeds stored in `user_prefs.customFeeds`.
   - **Save flow:** `+ save` → `saved ✓︎`. Stores `source_detail: "discover · George Saunders"` (shows on action card as "from discover · George Saunders") + `metadata.recommendationBlurb` (the "why" text, shows under "about this ▾" toggle). Blurb toggle reads "via George Saunders" not "via recommendation" — fixed via `metadata.discoverSource`.
5. ✅ **`useItems.addItem`** extended with optional `source_detail` param (backward compatible).
6. ✅ **`usePrefs`** extended with `discoveryCache` + `customFeeds` + setters.

### 🔜 Next session priorities

→ **See Master Roadmap above** — Phase 2 is next. Action card + editing flow redesign. Start by mocking before building.

### 🧹 Small nits (parked, do whenever)
- **"own it" label for books** — `own it` / `own it ✓︎` doesn't feel right for physical books. Find a better word (e.g. `on my shelf`, `have it`). Only needs to change for `type === 'book'` in the action card header link.
- **Action card rework** — Farah flagged the card needs a general pass. Needs more detail before implementing — ask what specifically feels off (layout, order, missing info, clutter, etc.).

### 📌 Session 18 (continued) — polish + vibe/verdict taxonomy overhaul

**Shipped after the main session 18 summary:**
1. ✅ **CI fixed** — pinned GitHub Actions to Node 24 (Supabase client throws on Node 20).
2. ✅ **Diacritics folded in dedupe keys** — "Rosalía" ↔ "Rosalia" now match in `albumKey`, `filmKey`, `useItems` dup detection.
3. ✅ **Email dedup against library** — forwarded emails now skip items already in your library; re-forwarding is safe (only the missing one gets added). Reply reports skipped count.
4. ✅ **Reference link works for any site** (option 2) — paste Goodreads/StoryGraph/any URL; card link labeled by site (`goodreads ↗`). Auto-fill stays Wikipedia-only.
5. ✅ **Own-it restyled** — plain text link matching edit/edit-tags, moved third in header, shows `own it ✓︎` when active.
6. ✅ **Blurb pre-fills in edit view** — existing rec/captured/wiki blurb is visible in the box so it's not accidentally overwritten. Untouched echoes don't promote to manualBlurb.
7. ✅ **Tidy queue respects gap-type filter** — "missing genre" filter now scopes the save & next walk to genre-less items only.
8. ✅ **Clear-filters is just ×** — moved next to sort dropdown (left header), no word.
9. ✅ **Wiki auto-fill genre fixed** — genre now comes from `/api/genres` (title-knowledge inference) instead of Wikipedia categories (which rarely carry a clean genre label). `api/genres.ts` book vocab was stale (missing `historical fiction`, `memoir`) — synced. ⚠️ THREE vocab copies must stay in sync: `src/lib/genres.ts`, `api/wiki.ts` GENRE_VOCAB, `api/genres.ts` GENRE_VOCAB.
10. ✅ **"memoir" added** to book genre vocab (all three copies).
11. ✅ ***noted* in subtitle** — note indicator replaced pencil glyph with italic `noted` in the middot subtitle line (list + grid).
12. ✅ **Vibe/verdict taxonomy overhauled** — full redesign after extended design session. See moods section below.

**⚠️ ACTION NEEDED: run "clean up" in library tools** (Add page → library tools → clean up →) to remap old vibe tags on existing items: atmospheric→hazy, artsy→arthouse, upbeat→fun, relaxed→easy; drops tearjerker, feel-good, dreamy, life-changing, just-really-really-good, overhyped. ✅ Done session 19.

### 🧹 Small nits (parked, do whenever)
- **"own it" label for books** — `own it` / `own it ✓︎` doesn't feel right for physical books. Find a better word (e.g. `on my shelf`, `have it`). Only needs to change for `type === 'book'` in the action card header link.
- **Action card rework** — Farah flagged the card needs a general pass. Needs more detail before implementing — ask what specifically feels off (layout, order, missing info, clutter, etc.).

### Vibe/verdict taxonomy (locked session 18, implement AI suggester next)

**Design principles:**
- Verdicts = your relationship to the work → **always manual, AI never suggests**
- Vibes = properties of the work itself → **AI suggests, you confirm**
- Vibes are tiered by medium (not one flat list) so each type shows only relevant words
- Axis metadata (in moods.ts, not user-visible) groups cross-medium synonyms so recommender can reason "hype/intense/propulsive = high energy" across media
- Effort axis is the one explicit bipolar pair (easy ↔ demanding/dense) — powers the "what do I watch tonight" filter

**Verdicts (all media):** comfort · guilty pleasure · would revisit · delivers · they don't make 'em like this · respect, not love · overrated · so bad it's good

**Vibes:**
- Core (all 4 media): hazy · dark · melancholic · nostalgic · romantic · off-kilter · epic · playful · sexy · sharp · lush
- Narrative (film/tv/book): intense · heavy · easy · demanding · funny · cozy · earnest
- Film/TV only: arthouse · fun
- Music only: hype · raw · danceable · groovy · mellow · hypnotic
- Book only: propulsive · dense · lyrical · immersive · literary · spare

**🔜 NEXT: AI vibe suggester** — cheap Haiku call (~$0.001) at identify time or card open, proposes 1–3 vibes from the type-appropriate vocab based on model's knowledge of the title. Shown as faded "suggested" chips; user confirms or ignores. Never auto-applied. Vocab is now locked and stable — good to build.

### 📌 Session 18 summary (2026-06-03) — testing foundation + the "for review" inbox

**Shipped to `main` / live (NOT yet eyeballed logged-in by Farah — see verify note):**
1. ✅ **Testing foundation (Vitest + CI gate).** First automated tests in the repo (the old "unit-tested" claim was aspirational). 53 tests across `letterboxd`, `gaps`, `spotify`, `shows`, `genres`, `review`. `npm test` / `npm run typecheck` / GitHub Actions `ci.yml`. See **Testing** section above. The tests already caught a real edge case → spun off as a task (diacritics in dedupe keys: "Rosalía" normalizes to `rosala`, won't dedupe vs "Rosalia"; low impact).
2. ✅ **The "for review" inbox (roadmap items A + D).** Forwarded emails, recommendation PDFs, and un-identified "save & identify later" notes now land in a **review inbox** instead of dropping silently into the library. New pure module `src/lib/review.ts` (`inReview`, `reviewCount`, `clearReviewMeta` — unit-tested). Membership is a `metadata.review` flag — **no DB migration**, fully reversible, and **only affects newly-captured items** (existing library untouched; legacy `scratch` items are treated as in-review until triaged).
   - **Surface:** the existing "for review" chip in the library header now shows a **count** (`for review · N`) and only appears when items are waiting. Review items are **hidden from the main grid** until triaged.
   - **Wired at 3 save paths:** scratch save (`AddScreen.handleSaveAsScratch`), email (`api/email.ts` rows), recs (`RecommendScreen` inserts).
   - **Keep flow:** opening a review item shows an **"in your review inbox — file it"** banner on the action card with buttons: `keep · want to` (clears review, stays want_to) + the 4 reactions (logs as done, preserving note/moods, clears review). New optional `onKeep` prop on `ItemActionSheet`.
   - **Manual one-at-a-time adds and bulk photos intentionally stay OUT** of the inbox (already reviewed at capture).
   - ⚠️ **Recommendations PDF was included per Farah's choice** — but recs already go through their own select-checklist at save time, so this adds a *second* triage pass. If that feels redundant, removing it is a one-liner (delete `review: true` from `RecommendScreen.tsx` metadata).

**Follow-up fixes (same session, after first push):**
- ✅ **CI was red on first run** — `@supabase/supabase-js` throws a "Node.js 20 without native WebCrypto" error at client construction, and the pure-logic tests import it transitively (`shows.ts` → `supabase.ts`). Fixed by pinning CI to **Node 24** (matches local). *Minor future cleanup: decouple pure functions in `shows.ts` from the supabase client import so tests don't pull in a network client at all.*
- ✅ **Diacritics now folded in dedupe keys** (`albumKey`, `filmKey`, `useItems` dup keys) — "Rosalía" ↔ "Rosalia" now dedupe. (Was the day-one bug the tests caught.)
- ✅ **Email forwards now dedupe against the library** — `api/email.ts` previously inserted every parsed item with no dedup, so re-forwarding to recover an AI-missed item duplicated the ones already saved. Now deduped by type + folded title + creator; reply reports skipped count. **Root cause of "3 books → only 2 saved" was AI extraction variance** (the model occasionally misses one item — inherent, not truncation); the dedup makes **resending safe** (only the missing one gets added).

**🔎 VERIFY NEXT SESSION (auth-gated, couldn't test in preview):** log in → forward an email (or save a rec) → confirm the **`for review · N`** chip appears → tap an item → confirm the **"file it"** banner shows and `keep`/reaction buttons move it into the library + drop the count. Also: re-forward the same email and confirm **no duplicates** appear (dedup working).

### 📌 Session 16 summary (2026-06-03) — cosmetic queue cleared + input audit started

**Shipped to `main` / live:**
1. ✅ **Genre auto-fill bug fixed** — the *main* typed path (catalog-pick), bulk photo, iOS shortcut, and email all used to save with **empty genres** (only the Sonnet text-identify path filled them). `addItem` (`src/hooks/useItems.ts`) now fires `/api/genres` (Haiku, cheap) in the background for any tagless film/tv/book/music and patches the row; the email prompt (`api/email.ts`) now requests genres per-type too. This was the Snatch / Anatomy of a Fall / New Music Tuesday "no genre" bug.
2. ✅ **Manual blurb** — action-card **edit** view has an "about this" textarea → `metadata.manualBlurb`, top priority over auto blurbs (manual > recommendation > photo-captured > wiki > book). Shows under the existing "about this ▾" toggle. Edit-view only (not the add sheet), uniform across all items.
3. ✅ **Library filter row cohesion** — whole row is now one flat language: dropdowns (vibe/genre/series) + reaction + new-music chips all converted to `TabChip`. Active state = **ink + italics** (tried italic instead of underline; Farah keeping it for now). `FilterChip` deleted.
4. ✅ **Series filter** only shows for a single film/book/tv category (`seriesRelevant`) — gone from "all" and music.
5. ✅ **Action card** — header order now `edit · re-identify · own it? · +tags/edit tags`; the tags open/collapse toggle lives **only in the header** (`done ▴`), removed the duplicate body button. Genre chips match `MoodChips` exactly. Lead term in tag lines **no longer bold** (matches taste page).
6. ✅ **Taste page** — `RankedLine` lead term no longer bold (order carries ranking).
7. ✅ **Library tools** — "fill automatically" block is collapsible (`autoOpen`); tighter spacing; **fill-by-hand has a gap-type filter** ("missing wiki / genre / creator / …"); rows **deep-link straight into the action card's *edit* view** (`?item=…&edit=1` → `initialEdit` prop on `ItemActionSheet`).
8. ✅ **Library grid** — **3 col / 4 col toggle** (persisted per-device; 4 for desktop where 3 was too big/low-res); grid cards now show the **same subtitle** as list rows (type · year · seasons · genre · reaction).
9. ✅ **Clear-all-filters** — subtle "clear ×" in the library header, shown only when a filter is narrowing the list.
10. ✅ **Font decided: Geist** (compared vs DM Sans / Plus Jakarta Sans via a mockup, now deleted).
11. ✅ **Bulk photo "already did" toggle** — whole-batch want-to/done toggle on `BulkConfirmSheet` (reactions added per item later, like Spotify sync). `handleBulkConfirm` threads status → `addItem` done flag.
12. ✅ **Un-identified captures are no longer a dead-end** — the action card now offers "mark as done / edit reaction" alongside "identify now" for scratch items, so you can log a reaction + note now and identify whenever. Resolves the parked scratch model toward "save now, identify later" (kept the triage filter — didn't rip the concept out). *Capture-time reaction (react in the same tap as save-as-note) intentionally not built — you react right after, by opening the item.*

**▶ OPEN TO-DOS (carry forward, session 17):**
- ✅ **(A) email "pending inbox" — SHIPPED session 18** (see session 18 summary). `metadata.review` flag + `src/lib/review.ts` + "file it" keep flow on the action card. Email + recs + scratch land in the inbox; bulk photo intentionally left out. **Remaining bit of original (A):** the recommendations-PDF checklist UI was NOT extracted into a shared component (the inbox uses a per-item "file it" banner instead of a multi-select checklist). If a batch select/deselect-all triage surface is wanted, that's a follow-up.
- **(B) Offline capture queue** M/L. IndexedDB queue holds captures while offline, syncs on reconnect. "On the go" north star.
- **(C) "In progress" status** S/M. Third status (`want_to` / `in_progress` / `done`) for things started but stalled. Needs one SQL migration (Farah runs in Supabase dashboard): `alter table public.items drop constraint items_status_check; alter table public.items add constraint items_status_check check (status in ('want_to','in_progress','done'));`. Then: update `ItemStatus` type, add filter chip in library, add "mark as in progress" on action card. **Design resolved: no reaction until marked done (behaves like want_to).**
- ✅ **(D) "for review" = the one inbox — SHIPPED session 18.** Forwarded email items now land here. Flag moved from `metadata.scratch` to a dedicated `metadata.review` (legacy scratch still treated as in-review). Chip shows a live count.

**iOS Shortcut — DECIDED: skip / leave retired.** The Web Share **Target** API (PWA receiving a shared *image file*) is **not supported by iOS WebKit** — that's why nospaces never appeared in the Photos share sheet (platform limitation, not a config bug; don't chase the manifest). Workaround Farah will use instead: **screenshot → share to Mail → forward to the nospaces address** (Mail *is* a share target on iOS), which captures without keeping the screenshot. Rebuilding the Shortcut+`/api/identify-upload` is possible later but not worth it now. (A `GET` text/URL share target *could* work on iOS for sharing links — minor, not scheduled.)

**The pitch / mental model (use on onboarding / empty state): "add things 4 ways — Type it · Snap it · Forward it · Sync it."** Type = title or description (+ save-as-note). Snap = photo/screenshot, single or bulk (+ paste). Forward = email anything (text or photo) to the nospaces address. Sync = Letterboxd / Spotify / recommendations PDF.

**Other decisions / open from session 16–17:**
- ✅ **"Save & next" tidy queue — SHIPPED session 17.** See session 17 summary above.
- ✅ **Edit view overhaul — SHIPPED session 17.** Genre chips, runtime/pages, wiki URL, type chips at top, dismiss. See session 17 summary.
- 🔜 **Cover-art quality pass (biggest tastemaker payoff).** Low-res / inconsistent covers cheapen the grid. Need higher-res art source or consistent fallback. Image quality = identity.
- 🔜 **Default library view → want-to** — tiny one-line change; held until Farah finishes importing.
- 🔜 **"Canon" / pinned favorites** — lightweight pin for ~10 defining items, separate from the reaction scale. Medium.
- **Tastemaker critique (design north star reminder):** the target user wants a **mirror + curator**, not a tracker. Mirror = the taste-page prose (the killer feature — keep expanding it). Curator = catalog-grounded recommendations (roadmap endgame). The library itself should feel like a **collection on display** (→ better art + more curated default), not an inbox. Guard the editorial restraint (lowercase, monochrome, no emoji, editorial type).

### 📌 Session 12 summary (2026-06-03) — action card overhaul + small fixes

All shipped to `main` / live:
1. ✅ **Blurb source duplication fix** — recommendation items no longer show "from [list]" in the header when the blurb toggle already says "via [list]". URL link kept (different affordance).
2. ✅ **Manual genre edit** — genre chips on action card are now fully interactive. Shows active genres only (dark chips with ×). `+ genre` dashed button expands the full type vocab for picking. Saves immediately via `onSetTags`. Same pattern as mood chips.
3. ✅ **Action card density overhaul** — genre active-only chips + expander (replaces 16-chip wall). Mood chips now single horizontal scroll rows (FEEL + HOW IT LANDED). HOW IT LANDED hidden entirely for `want_to` items (can't know how it landed before finishing). Spotify / Wikipedia / Watch moved inline with blurb toggle row — one light text-link row, no pill buttons.
4. ✅ **Spotify link** — synced albums link directly to album page. Manually-added music falls back to Spotify search (kept — search link preferred over no link).

**Still open (next session):**
- ✅ **Describe-to-add recency sort (music + books)** — SHIPPED (session 14). "rosalía's latest album" → LUX (2025) first; "Ottessa Moshfegh's latest book" → Lapvona (2022) first. Client-side year sort alone wasn't enough — each catalog's relevance search buries or omits the newest release. Fix:
  - (1) `api/describe.ts` returns `sortByRecency` (regex on temporal words — latest/new/recent/newest/current/this year).
  - (2) `api/lookup.ts`, **music** `itunesByArtist()`: resolve artist → `lookup?id=…&entity=album` full discography → drop singles (`- Single` suffix or trackCount <4) → collapse deluxe variants ("LUX (Complete Works)", "MOTOMAMI +") onto base title (shortest name, earliest year) → sort newest-first. (iTunes relevance search omitted MOTOMAMI + LUX entirely.)
  - (2b) `api/lookup.ts`, **books** `openLibraryByAuthor()`: search by `author=`, dedupe editions onto base title (split on " / "), drop non-Latin translations, sort by `first_publish_year` desc. Open Library's own `sort=new` is unusable (floats recent *reprints* of old books); `first_publish_year` is the cleanest real date. Verified across Moshfegh/Rooney/McCarthy — latest real book lands at/near #1; some box-set/foreign-edition noise remains below but it's a picker so user chooses.
  - (3) `AddScreen` threads the flag through `catalogLookup(q, recency)`; handler floats newest across all types when recency.
  - **Film/TV recency NOT built** ("that new Villeneuve movie") — TMDB needs a person-search → credits path (different shape from search/multi, which returns the person and gets filtered out). Own session.
- ✅ **Series tag** — SHIPPED (session 14). Free-text `metadata.series` field. Input in the action-card edit view (shown for film/book/tv only). `↳ series name` line on the action card under the subtitle. `series ▾` filter dropdown in the library header (same pattern as vibe/genre; only appears when items have a series). Manual entry only — no AI auto-detect (deferrable later).
- **Visual element on taste page hero** — covers/collage
- ✅ **Input workflow audit** — DONE session 16 (see "Input workflow streamlining" section below).

---

### 📌 Session 10 summary (2026-06-02) — taste page overhaul

All shipped to `main` / live:
1. ✅ **"Describe my taste" AI prose block** — `api/taste-profile.ts`. Sends loved/liked items to Claude Sonnet → editorial paragraph + bullets. Cached in `user_prefs`. See more/see less inline. Regenerate button.
2. ✅ **Taste page layout overhaul** — non-collapsible hero header (vibes chips + prose, heavy INK divider). Compact bordered category cards (FILMS/BOOKS/MUSIC/TV) with title + rated/loved%, go-to creators, genres. Verdicts section removed.
3. ✅ **Creator loyalty** — go-to creators (2+ items, reaction-scored) per category card.
4. ✅ **LibraryTools** moved to Add page, collapsed behind "library tools" link.

---

### 📌 Sessions 6–9 summary (2026-06-02) — key features shipped

- ✅ **Recommendations v1** (`/recommend`, PDF-upload only) — `RecommendScreen.tsx` + `api/recommend.ts`. Claude reads PDF → ranked items with blurbs → deduped vs library → checklist → save as `want_to`. Max 3MB PDF. `source_detail:'recommendation'`.
- ✅ **Spotify sync** — saved-albums on demand, PKCE OAuth, deduped, `source_detail:'spotify'`. See Spotify section above.
- ✅ **Letterboxd CSV import** — watchlist/watched/ratings, deduped, reactions mapped from star ratings. See Letterboxd section above.
- ✅ **Shows near you** — Ticketmaster, two tabs (near me + all tours), editable city list, tribute-band noise fixed. `ShowsScreen.tsx`, `api/shows.ts`.
- ✅ **Vibe tags split** — VIBES (feel) + VERDICTS (how it landed) in `src/lib/moods.ts`. `MoodChips` component.
- ✅ **Re-identify match picker** — surfaces candidates, pick the right one. `ItemActionSheet.tsx`.
- ✅ **Various small fixes** — scratch always visible, hide "from: quick add", leaner list subtitle, runtime on action card.


### 📥 Seamless capture
1. ✅ **Mark-as-done at identify time** — "want to / already did" toggle on confirm screen; saves status+reaction in one step.
2. ✅ **Scratch sheet** — "save a description" path on the Add screen for things you can't identify yet. Saves as `metadata.scratch=true, type='other'` with raw text as title. Appears under a "scratch" filter chip in the library. Action card shows a prominent "identify now" button for scratch items. No schema change — uses existing columns. Built session 3.
3. ✅ **Bulk photo upload** — "add from photos" accepts multiple files. Single pick → single ConfirmSheet. Multi-pick → BulkConfirmSheet: identifies all in parallel, each row checkable/editable, saves all as want_to. Low-confidence results start unchecked.
4. **Manual source field** — set where an item came from (person/site/newsletter). Decide where it surfaces.
5. **Music / songs** — today albums-only. Figure out adding individual songs + cleanest flow.
6. **Describe-to-add ✅ BUILT (session 13).** "rosalía's latest album", "that new Villeneuve movie" → `api/describe.ts` (Haiku) parses intent {searchQuery, type} → `/api/lookup` catalog (iTunes/TMDB/Open Library) → `PickerSheet` in AddScreen → ConfirmSheet. Falls back to Sonnet with explicit prompt when catalog returns nothing. **Known issue:** recency words ("latest", "new") are stripped from search query, so results sort by relevance not date. Fix: add `sortByRecency` flag from Haiku + sort picker candidates by year desc. **Future state Option B:** for vague plot-description queries with no named entity ("thriller about a woman in the forest"), route to `/api/identify` (Sonnet) instead — not built; add a query classifier if needed.
7. **Descriptive library search (A) — LOWER priority.** Search your *own* library in plain language ("cozy films I haven't watched", "intense books"). Mostly a light AI step that turns a sentence into filters you already support (status + vibe/genre tags). ~1 session. Do alongside (B) only if cheap; otherwise defer.
7. **Screenshot shortcut reliability** — clipboard flow flaky. Improve or retire.
8. **Photo-blurb / OCR** — snap back cover → Claude reads blurb → save.
10. **🤔 Quick-capture rethink + offline (parked, session 8).** Open product question: is the dedicated "scratch" model right, or is a plain un-ID'd entry (saved now, identified/edited later) simpler? And should it work **offline**? Today scratch saves `type:'other', metadata.scratch=true` and needs network (Supabase write). Offline path: PWA service worker is already in place — add a local queue (IndexedDB) that holds new captures while offline and syncs on reconnect. Decide the model before building. (Session 8 made the scratch link always-visible as an interim fix — see #9.)
9. ✅ **Scratch page not reachable from Add** (flagged session 7, fixed session 8 — link now always visible) — the scratch "save a description" path exists but there's no obvious way into it from the Add screen. Add a clear entry point / button on AddScreen so scratch is accessible. (Defer to its own session.)

### 🎬 Integrations
1. ✅ **Spotify** — saved-albums sync live (built 2026-06-02). Spotify buttons now deep-link directly to the album page (`open.spotify.com/album/ID`) for synced items; falls back to search for manually added music. See "Spotify sync" section above. Still TODO/v2: top artists/tracks "insights" view, ongoing auto-sync, individual songs.
2. ✅ **Letterboxd** — CSV import live. See "Letterboxd import" section above.

### 🌟 Taste arc (throughline: tags → taste → recommendations)
1. ✅ **Genre + mood tags (foundation).** Built session 3.
   - **Genre** = what it *is*. AI auto-picks 1–3 from a fixed vocab per type at identify time. Stored in `tags text[]`. Vocab in `src/lib/genres.ts` — edit freely.
   - **Mood/vibe** = how it *felt* ("comfort", "gripping", "project", "nostalgia", "classic", etc). Tap chips on the action card main view (saves immediately) or at mark-done time. Stored in `moods text[]` column — **requires Supabase migration if not yet run:** `alter table public.items add column if not exists moods text[] not null default '{}';`. Vocab in `src/lib/moods.ts` — edit freely.
   - Genre chips (light grey) and mood chips (black) displayed on action card main view.
   - **Backfill:** "tag my library" button on the Taste screen runs all untagged items through `/api/genres` (Haiku model, cheap) in batches of 5 with live progress + cancel. Run this once after the first deploy to populate historical items.
   - **`classic` moved verdict → genre (session 14).** Was a VERDICT ("how it landed"); now a **genre** on film + tv (`src/lib/genres.ts`). Skipped music (clashes with the existing `classical` genre) and book (already has `classics`). Existing items with a `classic` mood are migrated by the **mood-migration tool** (Add → library tools, "clean up"): it strips `classic` from `moods[]` and adds it to `tags[]` (`classics` for books, `classic` otherwise). **Run "clean up" once** so old `classic` tags aren't orphaned. Also added **`period piece`** genre to film/tv/book.
2. ✅ **Taste snapshot screen** (`/taste`, 3rd nav tab). Built session 3. **⤵ Layout fully superseded in session 6 — see #4 below for the current structure.** (Original: genres split by type, vibes cross-type, reaction bars, "what doesn't land" — all ranked pill chips.)
   - Scoring (unchanged): loved +2, liked +1, eh 0, not-for-me −1. Minimum 1 data point to show.
   - All client-side from `useItems`, no extra API calls.
3. ✅ **Recommendations v1 — LIVE (session 9, 2026-06-02).** Add screen → "find recommendations" → `/recommend` (`RecommendScreen.tsx` + `api/recommend.ts`). **PDF-upload only** (web_search path removed — too expensive + slow for Hobby plan; Pro plan needed). iOS flow: open article → share → print → pinch-out preview → share PDF → upload in app. Claude reads PDF as a document block (`anthropic-beta: pdfs-2024-09-25` header required) → returns ranked items with blurbs, genres, rank numbers → deduped vs library → checklist with select/deselect all → save as `want_to`. Saved rows: `source:'manual'`, `source_detail:'recommendation'`, `recommended_by:<list name>`, `metadata.recommendationBlurb`. **Max PDF size: 3MB** (Vercel 4.5MB hard limit; base64 adds 33%). `maxDuration: 120`. Works great for paywalled sites (NYT, Vulture, New Yorker) — save PDF while logged in. **Email path also works** for newsletters (forward to nospaces.xyz) but bulk-saves everything with no blurbs/selection. v2: web_search path could return if Anthropic costs drop or a cheaper search API is found.
4. **Taste page** — reorganized **category-first** (session 6). Overall **vibes** + **verdicts** (cross-type) at the top; then one collapsible **CategoryCard** per medium (film/book/music/tv, tv last) holding that medium's ratings bar, genres-you-love, era, backlog, and doesn't-land. Chips capped + two-tier. Genre tags now partitioned from free-text descriptors via `isGenreTag` (descriptors stay searchable, hidden from genre surfaces). Vibe tags split into two axes — VIBES (feel) + VERDICTS (how it landed) in `src/lib/moods.ts`.
   - **TODO (future): visual element on taste page hero.** The top zone (vibes + prose) is all text. Once the page is stable, add something visual — cover of the most-loved item, or a small collage of top covers across media. Makes the page feel personal and less like a dashboard.
   - **TODO (future, low priority): "MySpace top 8" for music** — let the user manually pin a few favourite artists on the taste page, like a top 8. Nice personalisation touch but unnecessary until the page feels more complete.
   - **TODO (come back to): per-category vibes/verdicts.** Right now vibes/verdicts are overall-only. Later, optionally break them down inside each CategoryCard (your *film* vibes vs *book* vibes). Needs enough tagged data per type to be worth it.
   - **Aesthetic overhaul (session 6):** taste page restyled editorial/highbrow (Vogue/New Yorker/Paris Review language) — monochrome ink-on-white, **no pills** (tags render as typographic ranked lines, lead term emphasized, middot-separated), hairline rules, typographic ratings line instead of the colored bar. Palette: ink `#1C1B19`, graphite `#6F6B64`, mute `#ABA69C`, hairline `#ECEAE6`.
     - ⚠️ **Farah still doesn't love it (parked end of session 6).** The current editorial direction isn't landing yet — needs another aesthetic pass. Open questions when revisiting: the typeface (still placeholder sans — see below), and likely the overall feel/layout of the insight rendering. Don't assume the monochrome-typographic-lines direction is final; be ready to explore alternatives.
   - ✅ **Typeface: Geist** — decided and live. No further action.
   - **Parked future axes:** *effort* (project/easy — pairs with runtime/pages data) and *occasion* (derived backlog filter — "what do I put on tonight"; never hand-tagged). See memory `taste-tags-structure`.

5. **🔜 AI-suggested mood/vibe tags (session 17 request).** Currently moods are 100% manual. Claude should suggest 1–2 vibes per item based on what it knows about the title, creator, genre, and wiki summary — shown as "suggested" chips the user confirms or dismisses (never auto-applied, since vibes are subjective). Implementation: at identify time or on action card open, call Haiku with item metadata → returns up to 2 suggested VIBES from our vocab. Display as faded chips with a "✓ add" affordance. Cheap (~$0.001). **Also: the current vibe/verdict vocab needs a refinement pass** — current VIBES: atmospheric · dark · melancholic · intense · epic · off-kilter · earnest · tearjerker · romantic · artsy · nostalgic · cozy · relaxed · upbeat · funny. Current VERDICTS: life-changing · just really really good · comfort · guilty pleasure · so bad it's good · overhyped. The split feels right but individual terms may need tuning — do this before building AI suggestion so the training target is final. Edit `src/lib/moods.ts` freely.

6. **🔭 Inferred-taste model (research thread, not scheduled).** A model that profiles Farah's taste *beyond the hand-applied tags* — reading the actual titles + reactions (and notes) to describe taste in its own words and recommend. What it'd take:
   - **Input signal:** the library is already a rich dataset — every item's title/creator/year/type, reaction (loved→not-for-me), vibes/verdicts, notes. The model reasons over the *names themselves* (it knows what "Phantom Thread" or "Fishmans" connote), not just our tag vocab. So even untagged items carry signal.
   - **v1 (cheap, ~1 session): "describe my taste" pass. ⭐ PRIORITIZED — Farah wants this ON THE TASTE PAGE.** Send the loved/liked list (titles + reactions + notes) to Claude → get a short editorial taste profile in prose ("you lean toward slow, melancholic character studies and warm lo-fi…") → render it at the top of the taste page (fits the editorial aesthetic). Pure read, no new infra; cache the result so it isn't re-generated every load (regenerate on a button or when the library changes meaningfully). Good candidate to build right after / alongside recommendations since it shares plumbing.
   - **v2: taste-aware ranking.** When recommendations pulls a candidate list, score/rank each candidate against the taste profile + library (cheap re-rank call). Recommendations #3 v3 already anticipates this.
   - **v3: web-research-grounded recommendations (session 17 request).** Ask Claude to find recommendations from trusted sources — Pitchfork, Letterboxd, NYT, The Wire, Vulture, Goodreads, niche forums — grounded in the taste profile so picks are explained against *her* taste, not generic lists. Two modes: (a) **in-taste** — "more of what I love, things I haven't seen yet"; (b) **divert** — "something genuinely new but coherent with my sensibility — push me without losing me." Cost: web_search is expensive (~$0.15–0.20/call); batching by type (one call for films, one for music, etc.) and caching results for days would make it viable. **Requires Anthropic API balance** — flag before running. This is the endgame curator feature.
   - **Honest limits:** no collaborative filtering ("people like you also…"). Strength is *describing* taste and *explaining* picks in prose — fits the editorial north star. web_search + taste profile is the right pairing once cost is acceptable.

### 🃏 Action card
1. ✅ **Mark done / edit reaction inline** — "mark as done" in action sheet footer for want_to items; transitions to reaction view inside the sheet (no second overlay). "edit reaction" for done items.
2. ✅ **Notes display** — note renders below the blurb. Bullet-list support: lines starting with -, *, • render as a list. `NoteInput` component (shared) has a "• bullet" button that inserts at cursor. Font 14px, 3-row textarea.
3. ✅ **Genre + mood chips on action card** — genre chips (light grey), mood chips (black), fully interactive (tap to toggle, saves immediately). Works on want_to and done items.
4. ✅ **"Owned" toggle** — `⌂ own it?` pill on action card header. Saves as `metadata.owned=true`. `⌂` marker on list rows. `⌂ owned` filter chip in library header.
5. ✅ **✕ close button** — top-right of both ItemActionSheet and MarkDoneSheet. Action card opens to 96dvh. Top padding tightened.
6. **Design polish** — editorial identity pass done (all-lowercase, 3-col grid, square music grid). Needs eye on real covers.
7. **⚠️ Manual Wikipedia override — BUILT then REVERTED (session 14), revisit.** Added a "wikipedia url (override if wrong)" input in the edit view that re-resolved an exact article via a new `api/wiki.ts?page=<url>` branch (`titles=`+`redirects=1`, SSRF-guarded to `*.wikipedia.org`), persisting `metadata.wikiUrl/wikiThumb/wikiSummary` + a `wikiManual:true` authoritative flag. **Reverted before commit** because Farah noticed a bunch of existing Wikipedia links went missing after the change — suspected regression, not root-caused yet. The revert restored `api/wiki.ts`, `src/lib/wikipedia.ts`, and the `ItemActionSheet` edit view to their pre-change state. **Before re-attempting:** figure out *why* links disappeared — likely suspects to investigate: the `wikiSeed`/`wikiManual` gating change at the `useWikipediaInfo` call site (did it stop seeding valid stored links?), or the new top-of-handler `page` branch in `api/wiki.ts` interfering with normal lookups. Reproduce locally with items that had working links first.
8. ✅ **Manual cover art edit** — paste image URL in edit view → stored in `metadata.coverUrl`.
9. ✅ **Re-identify** — on main card (auto-saves title/creator/type/year/tags/runtime/pages, sheet stays open) + in edit view (populates fields for review) + prominent "identify now" for scratch items.
10. ✅ **Re-identify type anchor** — re-identify now passes `typeHint: item.type` + year in the input string, preventing a film from silently reverting to the book it was adapted from. Auto-save never overrides the stored type. `clearWikiCache` called after re-identify so Wikipedia re-fetches with updated values.
11. ✅ **Action card editorial redesign — "text + reveal" tags (session 14, Variant B).** The main card is now a clean reading surface: genre / feel / how-it-landed render as **typographic middot lines** (lead term bold, no pills, taste-page style) instead of chip walls. An **"edit tags ▾"** link reveals the chip editors inline (genre full vocab + `MoodChips`); "+ add tags" when none set; "done ▴" collapses. Also: **"edit" moved up top** next to own-it?/re-identify (text link); **bottom footer trimmed** to just `[mark as done / edit reaction]` + `delete`. Mockup approved via `public/card-mockup.html` (deleted after). `MoodChips` still has the unused `collapsible` prop from the prior pass — harmless, can prune later. Mark-as-done flow unchanged (full vocab).
13. **✏️ Manual genre edit** (small tweak, requested session 8) — let the user add/remove an item's genre tags by hand on the action card (today genres are AI-auto-picked only; vibes/verdicts are already hand-toggleable, genres are not). Edit against the genres vocab in `src/lib/genres.ts`. Small, self-contained.
15. ✅ **Wikipedia label de-dup (session 14)** — the blurb toggle no longer reads "via Wikipedia" when the "wikipedia ↗" link is right beside it (looked duplicative). Falls back to the neutral "about this" only in that case; recommendation/newsletter items keep "via [source]".
14. **🔁 Blurb source duplication** (flagged session 9) — for recommendation items the source name appears twice: once as "from [list]" in the header attribution, and again as "via [list] ▾" on the body blurb toggle. Fix: hide the header "from [source]" label when a body blurb toggle is already showing the same source, or merge the two into a single row. Small, cosmetic.
12. ✅ **Remove "from: quick add" on the card** (shipped session 8) — was flagged session 7 — the source label "from: quick add" is noise (it's the obvious default). Hide it on the action card (and any row subtitle) when `source === 'quick_add'`. Keep meaningful sources (letterboxd, spotify, email, etc.) visible. (Defer to its own session.)

### 🔗 Wikipedia coverage
- ✅ Multi-fallback cascade: tries up to 4 queries per film (with year → without year → drop "The" → bare title). Films/TV trust search result; books/music use title guard.
- ✅ **Proxied through Vercel** (`api/wiki.ts`) — all Wikipedia calls happen server-side. Eliminated browser CORS errors entirely. Includes proper `User-Agent` header (required by Wikipedia API terms for server-side calls).
- ✅ **Throttled to 6 concurrent requests** (was 3, bumped session 14 for faster warm-up) — `MAX_CONCURRENT` in `src/lib/wikipedia.ts`.
- ✅ **Persisted to item metadata** — once resolved, `metadata.wikiUrl/wikiThumb/wikiSummary` are saved to Supabase via `patchMetadata` (local state update + DB write, no full refetch). Future loads skip the API call entirely and read from DB. **Caveat:** persistence only fires for library rows that actually render (scroll into view); the action card does NOT persist. So a big library warms gradually unless you run the backfill ↓.
- **📌 TODO (next session, 2026-06-04): spot-check wiki match correctness.** The backfill cleared the whole "missing links" badge to 0, which is expected but slightly suspicious: film/TV resolution is **lenient** (trusts the top Wikipedia search hit, no title guard — only book/music are guarded), so film/TV items almost always get *a* link even if it's the *wrong* article. The badge only tracks presence, not correctness. Task: scan items whose saved `metadata.wikiUrl` article title doesn't reasonably match the item title (the wrong-match suspects) and surface just those for review (re-identify fixes them). This is also the real motivation to revisit the tabled **manual Wikipedia override** (#7 in Action card section).
- ✅ **"fill in links" backfill (session 14)** — library tools on the Add screen (`LibraryTools` in `AddScreen.tsx`) now has a wiki backfill alongside tag/runtime/mood: counts items missing `metadata.wikiUrl` (film/tv/book/music), runs them through `fetchWikiInfo` (exported non-hook resolve in `wikipedia.ts`) in batches of 6, saves resolved url/thumb/summary to the DB. One pass = whole library warm permanently. Items with no Wikipedia page are skipped (nothing to save; retried next run). Endpoint health verified live — `/api/wiki` returns correct data in ~0.3s; "missing links" was always just the gradual warm-up, never a breakage.
- **Backfill missing directors** — Letterboxd imports arrive with null creator (CSV has no director column). Re-identify button handles this one at a time. Bulk backfill not built yet.
- **Still missing:** foreign-language titles where Wikipedia article name differs entirely from item title (e.g. Ponyo). Needs a different approach if this becomes a priority.

### 📚 Content / types
1. ✅ **Book & film series tag** — SHIPPED (session 14). `metadata.series` free-text field, edit-view input (film/book/tv), `↳` label on action card, `series ▾` library filter. Decision held: series tag (not TV-season model) because each book/film is its own experience with its own reaction/note. Future option: AI auto-detect the series at identify time (not built — manual entry only for now).
2. **Magazines / articles** — new media type(s).
3. **TV season ratings** — per-season, not just whole show.

### 🔀 Sort & filter
-1. ✅ **Filters persist across refresh (session 14)** — main library filters/view (`categories`, `statusFilter`, `reactionFilter`, `view`, `dir`, `layout`) are saved to `localStorage` (`nospaces.libraryPrefs`) and restored on load via lazy `useState(loadPrefs)` initializers + a save `useEffect`. A refresh no longer resets to "all / recent". (Vibe/genre/series sub-filters intentionally not persisted — they reset on category change anyway.)
-1. ✅ **Search clear (×) button (session 14)** — clears the query in one tap (appears inside the search field when non-empty). Also **iOS focus-zoom fixed** — action-card edit inputs + NoteInput textarea bumped to 16px (Safari only zooms on focus when font-size < 16px); no viewport lockdown needed.
0. ✅ **Multiselect + bulk delete (session 14)** — "select" button in the library header toggles select mode. Rows show a left checkbox + highlight; grid cards show a check overlay + dim unselected. Tapping a row/card toggles selection (instead of opening it); row quick-actions hidden in select mode. Floating action bar above the bottom nav: `N selected` · `select all`/`clear` (operates on the currently filtered set) · `delete` (two-tap confirm → `deleteMany`). "cancel" exits. State in `LibraryScreen` (`selectMode`, `selectedIds`, `confirmBulkDelete`). Bulk delete is the only bulk action for now — could add bulk status/tag later.
1. ✅ **Recently edited** sort option — sorts by `updated_at`, reversible.
2. ✅ **By year** ascending + descending — tap ↑/↓ arrow in header to flip any directional sort. All directional sorts (recent, edited, creator, a→z, year) reversible this way.
3. ✅ **Split "want to" / "done"** — "Want to / Done" view mode added 2026-06-02.
4. ✅ **Subtitle extras** — both done and want-to rows now show: type · year · first mood (if any) · runtime/pages (if available) · reaction (done only). `api/runtime.ts` (Haiku) captures runtime/pages at identify time going forward. Taste screen has a "fill in" backfill button to populate existing items.
5. **Added date / source in subtitle** — still open if wanted.
6. **🐛 Subtitle mood display logic unclear** — when an item has multiple moods, which one shows in the subtitle? Currently appears to be the first in the array, but this isn't intentional/documented. Decide the rule (e.g. first selected, highest priority, most recently added) and make it explicit.
7. ✅ **Filter by vibe / genre in library** — two compact dropdown buttons (`vibe ▾` / `genre ▾`). **Session 6: moved onto the same row as the status chips** (`all / want to / done`), each wrapped so its menu still anchors under its button; row wraps if crowded. Only shown when the current view has tagged items. Both can be active simultaneously (cross-filter). Auto-resets when category/status changes. The `genre` dropdown lists **real genres only** (`isGenreTag`); descriptors are excluded but still searchable. Real-time sync also added so mobile changes appear on desktop without refresh (Supabase `postgres_changes` subscription in `useItems.ts`).
   - **Note:** the library `vibe` dropdown still lists VIBES + VERDICTS mixed (only the taste page splits the two axes). Possible small follow-up to split it there too.

### 🎨 Polish
000. ✅ **No emojis in the UI (convention, session 14).** Farah wants zero emoji anywhere. (a) Symbol glyphs that iOS renders as colour emoji (`↗`, `▶`, `♥`) now carry a **text-presentation variation selector `U+FE0E`** (e.g. `↗︎`, `▶︎`, `♥︎`) so mobile matches the clean monochrome desktop rendering. Applied to wikipedia/watch/see-source (ItemActionSheet), JustWatch/provider links (WhereToWatchSheet), tickets (ShowsScreen), loved hearts (ShowsScreen). (b) **Type-emoji cover fallbacks removed** — the `🎬/📺/🎵/📚` placeholder (shown when an item has no cover) is now the **lowercase type word** in the accent colour (ItemActionSheet, ConfirmSheet, LibraryScreen `Thumb`, AddScreen bulk rows; `TYPE_EMOJI`/`TYPE_ICON` maps deleted). (c) Decorative trailing emoji removed from success messages (Import 🎬 / Recommend ✨ / Spotify 🎧) and the `📍` pins (shows-near-you, use-my-location). **When adding UI, use text/SVG glyphs, never emoji** — and if a unicode symbol might emoji-render on iOS, append `︎` (U+FE0E).
00. ✅ **Action / edit-reaction polish (session 14).** (a) **Universal link style** — `.tlink` class in `src/index.css`. **Option A (final):** no underline at rest (graphite `#6F6B64`), inks to `#1C1B19` + underline on hover (hover desktop-only). Applied to every action-card link (edit, re-identify, about-this, spotify, wikipedia, watch, see-source, edit-tags). Roll out to other screens as follow-up. (b) **Note display** — editorial: mute uppercase `note` label + flush-left quiet italic graphite (`#57534E`), **no left bar/indent** (the earlier 2px ink bar read as too loud/different — removed so it sits with the rest of the card). (f) **Hybrid vibes (session 14):** full vibe picker **only on first "mark as done"** (`status === 'want_to'`). On "edit reaction" (done item) it's minimal — a quiet "edit tags ▾" link reveals the vibe picker on demand (`reactionTagsOpen`). MarkDoneSheet keeps the full picker. (g) Footer **edit-reaction + delete equal halves**. (h) **Card order:** tags now render **above** the thoughts/note. (i) **"note" renamed to "thoughts"** (card label + NoteInput). (j) **Manual source edit** — "source" free-text input in the edit view writes `source_detail` (e.g. "a friend", "NYT"); `editItem` + `onEdit` extended to accept `source_detail`. Shows as "from [source]" on the card. (c) **Owned pill** — subtle ghost/hairline when selected, not a filled black blob. (d) **Note moved above vibe selectors** on edit-reaction + mark-done. (e) **Editorial labels + reaction buttons** — shared `sectionHeading`/`fieldLabel`/`reactionBtnStyle` in ItemActionSheet (mirrored in MarkDoneSheet): headings ink `#1C1B19`; field labels mute uppercase (`vibe · optional`, `note`); reaction buttons now **monochrome** (active = ink border + warm `#F4F2EE` fill) instead of per-type colour. NoteInput label also unified to the mute-uppercase style.
0. ✅ **Header declutter (session 3)** — reaction chips only show when "done" status is active (hidden for "all" and "want to"). Category → want-to/done fast path kept. Removed "recently added" chips from the Add screen.
1. ✅ **All lowercase** — done; h1/h2/h3 via CSS, all chips/buttons/sheet copy updated.
2. ✅ **Grid card** — 3 columns, square for music-only view, bigger title + creator line, reaction dot on done items.
3. **Letterboxd source label** — small "from Letterboxd" badge in the action card for imported items (`source_detail === 'letterboxd'`). Helps spot anything that imported wrong.
4. **Dedup after Letterboxd import** — slight title variants can slip through. Worth running remove-duplicates after first import.
5. ✅ **Remove-duplicates: show before deleting** — review sheet shows each duplicate group; pick which to keep before deleting.
6. ✅ **Action card header tightened** — reduced top padding + ✕ row margin on both ItemActionSheet and MarkDoneSheet.

### 🎵 Music
- ✅ **Touring dates / "shows near you"** — built session 7. Entry point: a `📍 shows near you` button in the **music category** filter row (only shows when viewing music alone), → `/shows` (`ShowsScreen.tsx`).
  - Pulls upcoming tour dates for every artist you've **liked or loved** (positive-reaction music only; `likedArtists()` in `src/lib/shows.ts`). Whole-backlog music is intentionally excluded.
  - API: **Ticketmaster Discovery**, proxied through `api/shows.ts` (attaches `TICKETMASTER_API_KEY`, keyword=artist + classificationName=music + startDateTime=now, filters fuzzy keyword hits down to events whose billed attraction matches the artist, normalises to `{id, artist, datetime, venue, city, lat, lng, url}`, caches 12h).
    - **Why not Bandsintown:** their public API is now gated — an unregistered `app_id` returns `"User is not authorized... explicit deny"`. Songkick's API is dead. Ticketmaster is the only free/instant option, but **only covers TM/Live Nation inventory** (misses indie venues, AXS/DICE/Eventbrite, much international).
    - **🔭 FUTURE TODO (not now):** apply for Bandsintown API access (broader coverage). The proxy + normalised `Show` shape already support merging sources — fetch both, map to `Show[]`, dedupe by id. Do this only if/when Bandsintown approves.
  - Client fetches all artists with concurrency 5 and **streams results in** with a live `done/total` count (`fetchAllShows`).
  - **Two modes (tabs at top):**
    - **near me** — location-first. Primary = device GPS (`📍 use my location`); fallback = a **user-editable city list** (tap **edit** → add/remove cities). `HOME_CITIES` in `src/lib/shows.ts` is just the default seed; once edited, the full list is **persisted per-user and synced across devices** via the new `user_prefs` table (`usePrefs` hook, `prefs.cities`). Adding a city geocodes it via `/api/geocode` (OpenStreetMap Nominatim — free, no key). Distance filter via haversine (`milesBetween`); radius chips 25/50/100/250 mi + "anywhere" (default 100 mi). Shows with no venue coords are dropped when a radius is active. Grouped by month.
    - **all tours** — band-first, for *planning a trip around a band* (no location needed). Every upcoming show worldwide, **grouped by artist**, with **loved bands floated to the top** (♥). A `♥ loved only` filter and an optional free-text **place filter** (matches the venue city string — "spain", "japan", "berlin") narrow it. Each artist block lists its full run of dates + cities. This is the answer to "where is my favourite band playing, maybe I'll travel to see them."
  - Every row links to the Bandsintown ticket/event URL.
  - ✅ **Supabase migration run** — the `public.user_prefs` table (in `supabase/schema.sql`) is live, so the synced city list works.
  - **Not yet eyeballed in-app by Farah** (key + migration both done) — needs a logged-in session + `vercel dev`/prod to exercise `/api/shows`. Spot-check in prod: load music → shows near you, set a city, confirm dates appear.
  - v2 ideas: badge on the music action card ("on tour near you"), notify on new dates, per-show "interested" save.

### 📥 Input workflow streamlining — AUDIT DONE (session 16)

**Every input path (12):**
1. **Type a title** → `describe` (Haiku intent) → `lookup` catalog (iTunes/TMDB/OpenLibrary) → PickerSheet → ConfirmSheet. (the primary path)
2. **Describe it** ("rosalía's latest album") → same path; recency words float newest first.
2b. **Catalog miss → Sonnet** → "identify with Sonnet" prompt → `identify` (text) → ConfirmSheet.
3. **Single photo** → `prepareImage` (shrink/HEIC→JPEG) → `identify` (Sonnet vision) → ConfirmSheet.
4. **Bulk photos** → parallel `identify` → BulkConfirmSheet. ⚠️ saves **want_to only** (no "already did").
5. **iOS share-sheet image** (PWA share target) → cached blob → `identify` → ConfirmSheet.
6. **Desktop paste** (Cmd/Ctrl+V image) → `identify` → ConfirmSheet.
7. **iOS Shortcut (screenshot)** → in-app "From Shortcut" reads URL params → ConfirmSheet. 🔴 **likely broken** — HANDOFF says it POSTs to `/api/identify-upload` but **that endpoint does not exist** in `api/`. Matches the "flaky" note. **Decide: rebuild or retire.**
8. **Save as note (scratch)** → `type:'other', metadata.scratch=true`, no AI.
9. **Email forward** (`anything@nospaces.xyz`) → `api/email` (Sonnet) → bulk save **want_to**, no per-item reaction/selection.
10. **Letterboxd CSV** (`/import`) — no AI, stars→reaction.
11. **Spotify sync** (`/spotify`) — no AI.
12. **Recommendations PDF** (`/recommend`) — Sonnet reads PDF → checklist → want_to.

**Two engines:** typed text → catalog first (cheap Haiku + free catalog APIs), Sonnet only on catalog miss. Photos/email → always Sonnet (must see/read). Imports/sync → no AI.

**Friction findings:**
- 🟢 **Genre gap — FIXED session 16** (catalog/bulk/shortcut/email all saved tagless; now auto-filled).
- 🟢 **iOS Shortcut — DECIDED: leave retired** (iOS doesn't support PWA file share targets; use screenshot→share→Mail→forward instead). See next-session note above.
- 🟢 **Bulk photos "already did" — FIXED session 16** (whole-batch toggle).
- 🟢 **Scratch dead-end — FIXED session 16** (can now react/note un-ID'd captures).
- 🟡 **Email = bulk want_to dump** — no reaction/selection; big-photo 413 (by design). → addressed by **(A) review checklist + pending inbox** next session.
- 🟡 **No offline capture** → **(B) offline queue** next session.

**Remaining improvement ideas (ranked):**
| Effort | Idea |
|---|---|
| M/L | **(A)** shared review checklist + email pending-inbox (see next-session note) |
| M/L | **(B)** offline capture queue (IndexedDB) — save offline, sync on reconnect |
| M | film/TV **describe-by-recency** ("that new Villeneuve movie") via TMDB person→credits — *extends describe-to-add, NOT a new search; music/books recency already work* |

### 🌱 Bigger / later
- Genre/mood tags + taste analysis → now the active "Taste arc" above
- Recommendations from trusted sources → now in the "Taste arc" above
- Tom's login (publish Google OAuth consent screen)
- Optional multi-category select (long-press)
- **`diary.csv` rewatches** — Letterboxd diary has per-watch dates and logs repeat viewings. Not imported yet.
- **Descriptive queries for films** — same TMDB-resolution pattern as music, not built yet.

### 🔭 Long-term vision (session 17, not scheduled)

These are directional ideas to keep in mind — they affect how the app is designed even before they're built.

- **Restaurants, museums, exhibitions, experiences** — expand beyond media to places and events. A restaurant you want to try, a museum show, a hiking trail. Same reaction/note/tag model; new types. The "taste profile" generalises naturally ("you gravitate toward small Japanese restaurants and brutalist architecture"). Medium lift once the type system is abstracted.

- **Calendar integration** — connect to calendar to see where Farah will be at a given time and proactively surface relevant shows, exhibitions, restaurants nearby. e.g. "you'll be in Tokyo in March — here are 3 things from your want-to list and 2 new suggestions." Requires calendar API access (Google Calendar OAuth) + location-aware recommendation logic. **Longer-term.**

- **Master "life index"** — the north star vision: nospaces becomes the single place where Farah's taste, experiences, and intentions live across all domains (media, food, places, events). Not a tracker but a *curated self-portrait* that also acts as a recommendation engine. Every new feature should be evaluated against this: does it make the index richer or the curation sharper? **Design principle, not a feature.** Hold it loosely — validate by seeing how the app feels once the library + taste arc is mature.

### 🧹 Cleanup (ongoing)
Security + dead code. Check RLS, auth, exposed keys periodically.

## Working style reminders (for Claude)
- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted (prod deploys, data changes, subtle bugs).
- Flag good moments to start a fresh chat (long sessions = expensive).
- Suggest Sonnet for routine work, Opus for gnarly debugging / architecture.
