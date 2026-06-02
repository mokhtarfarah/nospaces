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

## Email capture (IN PROGRESS — currently broken)
- Domain: nospaces.xyz (registered on Porkbun)
- Postmark set up, MX records added to Porkbun DNS (may still be propagating)
- Postmark inbound webhook: https://nospaces.vercel.app/api/email ✅
- /api/email.ts is built and deployed
- **Current bug**: TypeError: Cannot convert argument to a ByteString — happening at character index 23, value 8226 (bullet point •). Suspect stray character in SUPABASE_SERVICE_ROLE_KEY env var on Vercel. Last fix: sanitize all env vars with cleanEnv() function. Not yet confirmed working.
- **To debug**: Vercel → Logs → look for [email] log lines after sending test email to 2cd0b69cd3e551c9eb6f7d4c4379846e@inbound.postmarkapp.com
- **Also needed**: SUPABASE_SERVICE_ROLE_KEY and SUPABASE_URL must be set in Vercel env vars (not VITE_ prefixed — server-side only)

## Planned next (user requested)
1. **Finish debugging email** — ByteString error, possibly bad env var
2. **Day 4 review** — check what's left from the original Day 4 plan
3. **Cosmetic changes** — user has specific UI tweaks in mind (details TBD)
4. **Tom's login** — publish Google OAuth consent screen (console.cloud.google.com → APIs & Services → OAuth consent screen → Publish App)
5. **Music organization** — ability to organize/filter by artist more prominently
6. **Screenshot shortcut reliability** — clipboard approach is flaky, consider Supabase "pending items" approach instead

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
