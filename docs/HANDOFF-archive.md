# Nospaces — Session log archive

Append-only history. The live `HANDOFF.md` keeps only the latest session; everything older lands here. Newest first.

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
