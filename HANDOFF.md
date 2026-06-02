# Nospaces — Session Handoff Note

## What this app is
A personal PWA taste library for Farah and her husband Tom. Captures films, books, music, TV. Lives at https://nospaces.vercel.app. Two users only: farahmokhtar94@gmail.com and tom.effland@gmail.com.

## Tech stack
- **Frontend**: React + TypeScript + Vite PWA
- **Database**: Supabase (project: okxuzqqzqpuyepgiskqp)
- **Auth**: Google OAuth (only the two emails above can log in)
- **AI**: Anthropic claude-sonnet-4-5
- **Hosting**: Vercel
- **Email**: Postmark inbound → /api/email (domain: nospaces.xyz)
- **Repo**: github.com/mokhtarfarah/nospaces

## What's working ✅
- Google login (Farah works, Tom has auth issue — needs Google OAuth consent screen published)
- Library screen: filters, sort, colored left borders, month dividers, legend
- Add screen: AI identification via text → confirm sheet → save
- Photo button: opens camera + photo library picker, runs vision AI
- Mark as done with reactions (loved it / liked it / eh / not for me)
- Edit items (title, creator, type, year)
- Edit reaction/note after marking done
- Delete items (tap row → action sheet → delete with confirmation)
- "From Shortcut" button: reads clipboard URL from iOS Shortcut result
- Email capture: forward any email (or newsletter) to `anything@nospaces.xyz` → AI finds every film/book/music/TV item and saves them to the library (incl. photo attachments — fixed 2026-06-02)

## iOS Shortcut (partially working)
User has a manual Shortcut built in iOS Shortcuts app:
1. Receive image from Share Sheet
2. Convert to JPEG
3. POST to https://nospaces.vercel.app/api/identify-upload
4. Get Dictionary from response
5. Get Value for "open_url"
6. Copy Dictionary Value to Clipboard
7. Open URLs: https://nospaces.vercel.app/add (hardcoded)
8. Delete Photos

Flow: share screenshot → shortcut runs → app opens → tap "From Shortcut" → tap "Paste" → confirm sheet appears.

**Known issue**: clipboard sometimes empty on second run. Reliability could be improved.

## Email capture (✅ fixed 2026-06-02 — picture attachments now work)
- **Root cause:** picture emails saved nothing. Text-only emails were fine (verified live `{"saved":1}`). The image step rejected iPhone photos: Anthropic only accepts jpeg/png/gif/webp, but iPhone photos are **HEIC**, and some clients label attachments `image/jpeg; name=…` (params) — both got rejected, and the error was swallowed by an empty `catch`, so nothing saved.
- **Fix (`api/email.ts`):** normalize the media type (strip params, map jpg→jpeg, fall back to filename ext), **convert HEIC/HEIF → JPEG via `heic-convert`** (quality 0.6, steps down for huge 48MP photos to stay under Anthropic's ~5MB limit), handle **all** image attachments not just the first, drop items with no title, and **log errors instead of swallowing** them.
- Verified end-to-end with a real `.HEIC`: convert → valid JPEG → Anthropic reads it. Added dep: `heic-convert`.
- History/setup below stays for reference.

- Domain: nospaces.xyz (registered on Porkbun). MX records point to inbound.postmarkapp.com — confirmed live.
- Postmark inbound webhook: https://nospaces.vercel.app/api/email
- Forward any email (or whole newsletter) to `anything@nospaces.xyz` (e.g. save@nospaces.xyz). Must be sent from an allowed address (farahmokhtar94@gmail.com or tom.effland@gmail.com).
- AI lists every media item it finds, identifies each (creator/year/type from its own knowledge), and saves them with source = "email". No reply email is sent — items just appear in the library.
- Fixes that got it working: handle title-based specified_items; tell the prompt to IDENTIFY/enrich items instead of copying email text; make the prompt always extract every media item (a plain forwarded newsletter with no note used to save zero); widened body slice to 12k chars.
- ByteString error from earlier (bullet •) handled by cleanEnv()/sanitize() stripping non-ASCII; never reproduced after the prompt fixes.
- Server-side Vercel env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (not VITE_ prefixed).

## TODO / Roadmap (user-curated — last edited 2026-06-02)

### 🚨 Now / broken (do first)
1. ✅ **Email upload broken (picture emails)** — FIXED 2026-06-02. iPhone HEIC photos + parametered media-types were rejected and the error swallowed. Now converts HEIC→JPEG, normalizes types, logs failures. See Email capture section.
2. **iOS zoom-on-type** — page zooms in when you tap an input to type. Fix by making input font-size ≥16px (or viewport `maximum-scale=1`). Annoying, small fix.
3. **Revert to where you were after editing an action card** — after you edit, you lose your place (scroll position / open card). Should return you to exactly where you were.

### 📥 Seamless capture (make uploading effortless — user theme)
1. **Mark-as-done at identify time** — let you log a *done* item (reaction/note) right on the identify/confirm page, so it's 1 step not 2.
2. **Bulk picture upload** — pick many screenshots/photos at once → AI runs on each → confirm/save in a batch.
3. **Manual source field** — let you set/enter where an item came from (who recommended it / which site/newsletter) in add, upload, or edit. Decide where that data is useful (subtitle? filter? "recs that landed"?).
4. **How to add music / songs** — clarify the music flow: today it's albums-oriented; figure out adding individual songs + the cleanest "add music" path.
5. **Descriptive/relative queries** (designed, not built): e.g. "rosalía latest album", "newest Nolan movie" — AI can't reliably name "latest" (knowledge cutoff). Plan: identify prompt also returns an `intent` { creator, type, ordinal: latest|newest|first|debut }; server resolves the real title from a LIVE catalog — music via Deezer (artist → albums sorted by release_date; verified: Rosalía → "LUX" 2025), film/TV via TMDB person credits. Fall back to the AI guess if resolution fails. Implement in `api/identify.ts`.
6. **Screenshot shortcut reliability** — clipboard flow is flaky; improve (Supabase "pending items" approach) or retire it.
7. **Photo-blurb / OCR** — snap a back cover → Claude vision reads the blurb → save it.

### 🎬 Integrations (user wants these)
1. **Spotify login** — OAuth; e.g. add-to-queue, listening history, saved albums.
2. **Letterboxd** — one-time CSV import and/or sync.

### 🃏 Action card
1. **Mark as done / edit reaction in the card** — do it inline on the action card (not only via the row action sheet).
2. **Fix notes display** — show your note *below the blurb*, formatted nicely / user-friendly (current "Your note" block needs a pass).
3. 🔄 **Design polish** — first pass done (albums square covers, others 2:3 posters, larger cover, tighter spacing). NEEDS USER EYE on real covers; deeper pass possible (dividers, collapsible blurb).
4. **Manually link an item to a specific online/Wikipedia entry** — when auto-resolution picks the wrong entry (wrong edition/cover/blurb), let the user set the correct source. Plan: a "link" field in Edit details (paste a Wikipedia/URL) stored in `metadata.wikiUrl`; card's link/cover/blurb prefer the manual override; ideally fetch cover+blurb from that exact page. Could also offer a "pick the right one" chooser from search results.
5. **"Want to reread/rewatch" button** — flag a *done* item to revisit, keeping its done status + reaction/note. Store as `metadata.revisit` boolean (no schema change); button on the card for done items (label adapts: reread/rewatch/relisten by type); add a "Revisit" filter chip. Recommended, low effort.

### 📚 Library content / types
1. **Book & movie series** — group a series the way TV shows group seasons. Not strictly needed for books (sort-by-author covers it) but nice for movie franchises.
2. **Magazines / articles** — add as new media type(s).
3. **TV season-specific ratings** — rate each season, not just tick-watched.

### 🔀 Sort & grouping
1. **Recently edited** — sort/group by last-edited, not just date-added.
2. **By year — ascending & descending** — both directions.
3. **Split each category into "want to" + "done"** — two sub-lists under each category header.
4. **Subtitle extras** — decide what else to show on rows (length: pages/runtime; "added when"; tags; who added it / source).

### 🎨 Polish / experiments
1. **All lowercase?** — experiment: lowercase the whole UI, for aesthetic. (Not started.)
2. ✅ **Where-to-watch → links** — provider logos link to the title's search on that service (majors mapped; others fall back to JustWatch).
3. **Remove duplicates** — ✅ banner done (keeps best of each group). Block-on-save still optional TODO.

### 🌱 Bigger / later
1. **Genre / mood tags + trend analysis** — richer tags, then synthesis/analysis of patterns across the library.
2. **Recommendations** — sourced from user-selected trusted websites/sources.
3. **Tom's login** — publish the Google OAuth consent screen (console.cloud.google.com → APIs & Services → OAuth consent screen → Publish App). (SKIPPED for now.)
4. **Optional multi-category** — bring back multi-select via long-press (not the default).
5. **Import with notes/status** — bulk import that keeps reactions + done status (not just "want to").

### 🧹 Code cleanup (ongoing)
- Continuously evaluate and use best judgment on when to do cleanup. Also periodically double-check security (RLS, auth, exposed keys, input handling). (Dead-code pass already done: removed identify "more" mode, SortSheet, identify-upload, seeds.)

## Key files
- `src/screens/LibraryScreen.tsx` — main library UI
- `src/screens/AddScreen.tsx` — add screen with AI, photo, shortcut button
- `src/components/MarkDoneSheet.tsx` — reaction sheet
- `src/components/ItemActionSheet.tsx` — edit/delete/edit-reaction sheet
- `src/components/ConfirmSheet.tsx` — AI result confirmation
- `src/hooks/useItems.ts` — all Supabase data operations
- `src/hooks/useAuth.tsx` — Google OAuth, allowed emails list
- `api/identify.ts` — text/image AI identification (JSON body)
- `api/email.ts` — Postmark inbound email parsing
- `api/art.ts` — best-source cover/poster (TMDB/Deezer/iTunes/Open Library/Apple Books)
- `api/blurb.ts` — book blurb fallback (Open Library / Apple Books)
- `api/lookup.ts` — real-catalog "look it up online" search
- `api/watch.ts` — where-to-watch (TMDB), used by WhereToWatchSheet
- `src/components/ViewSheet.tsx` — the View menu (presets = sort + grouping); owns SortOption type
- `src/lib/{artwork,blurb,wikipedia,seasons}.ts` — client hooks for the above
- `supabase/schema.sql` — full DB schema with RLS

## Tone with user
Use ELI5 / caveman speak. Short sentences. No jargon. User is not an engineer. She has been very patient but gets frustrated with repeated debugging loops — be decisive, don't ask her to run the same thing twice.

## Environment variables (Vercel)
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- ANTHROPIC_API_KEY
- SUPABASE_URL (server-side, for email API)
- SUPABASE_SERVICE_ROLE_KEY (server-side, for email API — suspect this has a stray char)
- POSTMARK_SERVER_TOKEN (server-side — **needed for email talkback / confirmation replies**; until set, replies just no-op and saving still works). Get from Postmark → Servers → [server] → API Tokens. Also requires nospaces.xyz verified for *sending* (DKIM + Return-Path DNS on Porkbun).
- POSTMARK_FROM (optional override for the reply From address, e.g. `Nospaces <hello@nospaces.xyz>`; defaults to the @nospaces.xyz address the mail was sent to)

## Local dev
```bash
export NVM_DIR="$HOME/.nvm" && source "$NVM_DIR/nvm.sh"
cd /Users/farahmokhtar/nospaces
npm run dev
# app runs at localhost:5173
```

## Build plan (original)
- **Day 1 — Foundation** ✅ — PWA scaffold (Vite), Vercel deploy, Supabase + items schema, Google OAuth (2 accounts), basic Library + Add screens.
- **Day 2 — UI** ✅ — full Library UI (filter rows, sort, colored left borders, month dividers, legend), list item component, mark-done sheet w/ reactions, empty states.
- **Day 3 — AI + capture** ✅ — Anthropic connected, quick-add text → AI → confirm → save, photo → vision AI → confirm → save, iOS share sheet extension.
- **Day 4 — Email capture + polish** — inbound email parsing via Postmark ✅; multi-recommendation reply flow (NOTE: built as auto-save-all, not an email reply flow — revisit if a reply/confirm-by-email step is wanted); fix broken things; start using for real ✅.
- **Week 2** — Spotify OAuth + API (listening history, saved albums); Letterboxd one-time CSV import; grid / card view toggle.

## Long-term wishlist (not scheduled)
- Card / grid view toggle
- Gmail / newsletter auto-parsing (passive, no forwarding needed)
- Spotify two-way sync (add to queue in app → appears in Spotify)
- Letterboxd one-time import
- Apple Books / Kindle integration
- Restaurant / place tracking (beyond media)
- Personal taste graph — AI pattern recognition across logged items
- AI recommendations based on selected sources
- Person-based recommendations (weight by how often a person's suggestions land)
- Shared lists / household view
- Confidence indicator visible in UI for uncertain AI identifications
- Group-by setting (month / year / none) as a user preference
- Auto-import from a designated iOS Photos album
