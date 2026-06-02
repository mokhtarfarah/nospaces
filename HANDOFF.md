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
- Email capture: forward any email (or newsletter) to `anything@nospaces.xyz` → AI finds every film/book/music/TV item and saves them to the library

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

## Email capture (DONE ✅ — working as of 2026-06-01)
- Domain: nospaces.xyz (registered on Porkbun). MX records point to inbound.postmarkapp.com — confirmed live.
- Postmark inbound webhook: https://nospaces.vercel.app/api/email
- Forward any email (or whole newsletter) to `anything@nospaces.xyz` (e.g. save@nospaces.xyz). Must be sent from an allowed address (farahmokhtar94@gmail.com or tom.effland@gmail.com).
- AI lists every media item it finds, identifies each (creator/year/type from its own knowledge), and saves them with source = "email". No reply email is sent — items just appear in the library.
- Fixes that got it working: handle title-based specified_items; tell the prompt to IDENTIFY/enrich items instead of copying email text; make the prompt always extract every media item (a plain forwarded newsletter with no note used to save zero); widened body slice to 12k chars.
- ByteString error from earlier (bullet •) handled by cleanEnv()/sanitize() stripping non-ASCII; never reproduced after the prompt fixes.
- Server-side Vercel env vars required: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (not VITE_ prefixed).

## TODO / Roadmap (user-curated — last edited 2026-06-02)

### 🔧 Short-term fixes (small, queued)
1. **Want-to rows have no subtitle** — done items show year/reaction; want-to rows can be blank or just the media type. Add year, and BRAINSTORM other useful info (e.g. source, "added <when>", page count / runtime, tags, who added it). In LibraryScreen ItemRow.
2. **Show your notes** — notes (item.note) are saved (mark-done / edit-reaction) but displayed nowhere. Plan: a "Your note" quote block on the action card (italic, left accent border, distinct from the grey Wikipedia blurb) + maybe a 💬 dot on the row. (Drafted once, reverted to do later.)
3. **Remove duplicates** — find/clear duplicate items (same title + creator/type, case-insensitive); maybe block dupes on save too. (Some dupes may exist from dev test imports.)
4. **Tom's login** — publish the Google OAuth consent screen (console.cloud.google.com → APIs & Services → OAuth consent screen → Publish App).
5. **Action cards: tighter / sleeker / proportional** — clean up the tap card; "something about the pictures isn't totally working." (Same as the design-pass idea below — visual hierarchy, dividers, cover proportions, collapsible blurb. Sticky action footer already added.)
6. **All lowercase?** — experiment: lowercase the whole UI, just for fun / aesthetic.
7. **Where-to-watch → direct links** — replace the streaming logos with links that open the show on each service. Small/clean. (api/watch.ts + WhereToWatchSheet.tsx; whole feature is easy to remove.)

### 🎯 Bigger near-term
1. **Spotify login integration** — OAuth; e.g. add-to-queue, listening history.
2. **Letterboxd integration** — (one-time import and/or sync).
3. **Genre / mood tags + trend analysis** — richer tags, then synthesis/analysis of patterns across the library.
4. **Recommendations** — sourced from user-selected trusted websites/sources.
5. **Add/search UX** — clearer in-app "force exact / try again" (quotes + "look it up online" exist); and/or a super-quick add page.
6. **Screenshot shortcut reliability** — clipboard flow is flaky; improve (Supabase "pending items" approach) or retire it.

### 🧹 Code cleanup (ongoing)
- Continuously evaluate and use best judgment on when to do cleanup. Also periodically double-check security (RLS, auth, exposed keys, input handling). (Dead-code pass already done: removed identify "more" mode, SortSheet, identify-upload, seeds.)

### 💡 Small future ideas
1. **TV season-specific ratings** — rate each season, not just tick-watched.
2. **Optional multi-category** — bring back multi-select via long-press (not the default).
3. **Import with notes/status** — bulk import that keeps reactions + done status (not just "want to"). Email import no longer crashes on long notes (8192 tokens + defensive parse).
4. **Photo-blurb / OCR** — snap a back cover → Claude vision reads the blurb → save it.
5. **Action-card design pass** — polish (see short-term #5).
6. **"+" quick-add in library** — low value unless it's a true inline quick-add (Add tab already covers one-tap).

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
