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

## Planned next (user requested)
1. **Cosmetic + minor feature tweaks** — IN PROGRESS. User has specific UI tweaks and small features in mind (details being gathered).
2. **Tom's login** — publish Google OAuth consent screen (console.cloud.google.com → APIs & Services → OAuth consent screen → Publish App)
3. **Music organization** — ability to organize/filter by artist more prominently
4. **Screenshot shortcut reliability** — clipboard approach is flaky, consider Supabase "pending items" approach instead
5. **Day 4 review** — NOTE: no written Day 4 plan exists in the repo; was likely a verbal plan from an old session. Ask the user what it covered.

## Short-term TODOs (near-term, not full wishlist)
- **Where-to-watch links** — v1 currently shows provider logos in a popup (api/watch.ts + WhereToWatchSheet.tsx, TMDB key set). LATER: replace the logos with direct clickable links that open the show on the relevant service. Easy to remove the whole feature: delete those 2 files + revert the 3-line hook in ItemActionSheet.
- **Add/search improvements** — searching a string that isn't a famous work (e.g. "my new band believe") returns wrong famous results with no way to force the literal string. DONE so far: quotation marks now force an exact/literal match (api/identify.ts), and the confirm sheet has "show more options". STILL WANTED: a clearer in-UI way to force exact search / regenerate without quotes; revisit overall add-screen search UX.
- DONE: ~~Sorting clarity~~ (single View menu + grid toggle). ~~Missing artwork~~ (TMDB/iTunes/Open Library via api/art.ts).

## Key files
- `src/screens/LibraryScreen.tsx` — main library UI
- `src/screens/AddScreen.tsx` — add screen with AI, photo, shortcut button
- `src/components/MarkDoneSheet.tsx` — reaction sheet
- `src/components/ItemActionSheet.tsx` — edit/delete/edit-reaction sheet
- `src/components/ConfirmSheet.tsx` — AI result confirmation
- `src/hooks/useItems.ts` — all Supabase data operations
- `src/hooks/useAuth.tsx` — Google OAuth, allowed emails list
- `api/identify.ts` — text/image AI identification (JSON body)
- `api/identify-upload.ts` — raw binary image upload (for iOS Shortcut)
- `api/email.ts` — Postmark inbound email parsing
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
