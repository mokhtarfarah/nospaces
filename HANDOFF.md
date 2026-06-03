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

## Key files
- `src/screens/LibraryScreen.tsx` — library UI
- `src/screens/AddScreen.tsx` — add screen (AI, photo, shortcut)
- `src/screens/TasteScreen.tsx` — taste snapshot (3rd nav tab)
- `src/screens/ImportScreen.tsx` — Letterboxd CSV import
- `src/lib/letterboxd.ts` — Letterboxd parsing + mapping logic (pure, unit-tested)
- `src/lib/genres.ts` — **editable** genre vocab per type (film/tv/book/music). Edit here to add/remove genres.
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

## TODO / Roadmap (last edited 2026-06-03, updated session 12 end)

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
- **Input workflow audit**

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
   - **TODO (come back to): typeface.** Currently using the refined **sans** (existing Helvetica Neue) as a placeholder. Considered editorial serifs via a quick mockup at `public/taste-mockup.html` (open at `localhost:5173/taste-mockup.html` — shows Bodoni Moda / Cormorant / Playfair in the chosen treatment). Decision deferred. When revisiting: pick a serif for section heads + lead terms (Bodoni Moda = sharp Vogue, Cormorant = luxe/timeless), load via Google Fonts or self-host; premium options that nail the look are Canela / Domaine / GT Sectra / Reckless (paid). Delete the mockup file once decided.
   - **Parked future axes:** *effort* (project/easy — pairs with runtime/pages data) and *occasion* (derived backlog filter — "what do I put on tonight"; never hand-tagged). See memory `taste-tags-structure`.

5. **🔭 Inferred-taste model (research thread, not scheduled).** A model that profiles Farah's taste *beyond the hand-applied tags* — reading the actual titles + reactions (and notes) to describe taste in its own words and recommend. What it'd take:
   - **Input signal:** the library is already a rich dataset — every item's title/creator/year/type, reaction (loved→not-for-me), vibes/verdicts, notes. The model reasons over the *names themselves* (it knows what "Phantom Thread" or "Fishmans" connote), not just our tag vocab. So even untagged items carry signal.
   - **v1 (cheap, ~1 session): "describe my taste" pass. ⭐ PRIORITIZED — Farah wants this ON THE TASTE PAGE.** Send the loved/liked list (titles + reactions + notes) to Claude → get a short editorial taste profile in prose ("you lean toward slow, melancholic character studies and warm lo-fi…") → render it at the top of the taste page (fits the editorial aesthetic). Pure read, no new infra; cache the result so it isn't re-generated every load (regenerate on a button or when the library changes meaningfully). Good candidate to build right after / alongside recommendations since it shares plumbing.
   - **v2: taste-aware ranking.** When recommendations pulls a candidate list, score/rank each candidate against the taste profile + library (cheap re-rank call). Recommendations #3 v3 already anticipates this.
   - **v3: generative recommendations** — ask the model directly "given this taste, what 10 films am I missing?" No external list needed. Risk: hallucinated/recency-blind picks (model's training cutoff), so pair with a catalog/`/api/lookup` resolve to confirm each pick is real.
   - **Honest limits:** it's vibes-based reasoning, not a trained recommender — no collaborative filtering ("people like you also…"), and it can't know 2026 releases past its cutoff without web fetch. Strength is *describing* taste and *explaining* picks, which fits the editorial north star. Revisit after recommendations v1 ships (it shares most of the plumbing).

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
00. ✅ **Action / edit-reaction polish (session 14).** (a) **Universal link style** — new `.tlink` class in `src/index.css` (graphite `#6F6B64` at rest, inks to `#1C1B19` + underline on hover, no permanent underline). Applied to every action-card link: edit, re-identify, about-this toggle, spotify, wikipedia, watch, see-source, edit-tags. Roll out to other screens (LibraryScreen header buttons etc.) as a follow-up. (b) **Note display** — editorial: lowercase `note` mute label + 2px ink left rule + darker italic (`#2A2926`); distinct from the lighter blurb without the old heavy 3px bar. (c) **Owned pill** — subtle when selected (ghost/hairline, mute text) instead of a filled black blob. (d) **Edit-reaction + mark-done** — `note` input moved **above** the vibe selectors (tags are now editable on the card, so the note is the priority in the reaction flow).
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

### 📥 Input workflow streamlining (next audit after session 9)
Full list of all input sources the app currently supports → friction analysis → streamlining ideas. To be generated by Claude as a dedicated pass after the session 9 fixes ship. Sources to cover: type-to-add (AI identify), photo add (single + bulk), email forward, iOS shortcut (screenshot), Letterboxd CSV import, Spotify sync, describe-to-add (pending), scratch/quick-capture. Output: a table of each source with pros + friction points, then a set of concrete improvement proposals ranked by effort.

### 🌱 Bigger / later
- Genre/mood tags + taste analysis → now the active "Taste arc" above
- Recommendations from trusted sources → now in the "Taste arc" above
- Tom's login (publish Google OAuth consent screen)
- Optional multi-category select (long-press)
- **`diary.csv` rewatches** — Letterboxd diary has per-watch dates and logs repeat viewings. Not imported yet.
- **Descriptive queries for films** — same TMDB-resolution pattern as music, not built yet.

### 🧹 Cleanup (ongoing)
Security + dead code. Check RLS, auth, exposed keys periodically.

## Working style reminders (for Claude)
- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted (prod deploys, data changes, subtle bugs).
- Flag good moments to start a fresh chat (long sessions = expensive).
- Suggest Sonnet for routine work, Opus for gnarly debugging / architecture.
