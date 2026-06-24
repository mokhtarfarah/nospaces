# Nospaces — Handoff

**Read this file at session start.** It's deliberately short. Everything else is split out by how often it changes:

| File | What's in it | When to open it |
|---|---|---|
| **`HANDOFF.md`** (this) | Where we are + what's next | every session |
| `docs/ROADMAP.md` | Open backlog, parked + shelved ideas | picking what to do next |
| `docs/REFERENCE.md` | Stack, env vars, key files, costs, features, architecture, dev hooks | when you need a fact |
| `docs/HANDOFF-archive.md` | Full session-by-session history | rarely — digging up "why did we…" |

---

## 🚦 Where we are

Personal PWA taste library for Farah + Tom (films, books, music, TV). Live at https://nospaces.vercel.app. Phases 1–4 done; **Phase 5 (discovery + taste) in progress.**

**This session (66) — Things Slices 1–3 + masthead + two feedback rounds. All on `main` (no branches now).** Slice 1 = attribute model + pure `readThread`. Slice 3 = `DomainSwitcher` (Media/Things toggle) + stop things leaking into the media Library. Slice 2 = `ThreadMasthead` (≥4 tagged → "muted · wool · structured", else a nudge). Then Farah's feedback: **Form facet → Vibe** (holds bold/statement/chunky; legacy tags mapped forward), category out of the thread, board **sorting** + **category filter**, dismissable Compare, JSON-LD scraper fix (the "Woman"/no-price misses), **email-in**, and **Compare cheap-reviews** (reads each product page's description + on-page rating, still Haiku ~$0.001–0.002, no web search). Comparison-table dropped. 73 Vitest green. Full detail + decisions → archive (s66).

**Email-in: VERIFIED working (s67).** Farah retested → it landed. The normal-inbox auto-fallback (`captureThing` + `productLike` gate) and `things@` both work. Done.

**This session (67) — Slice 4 (paid vision) + two UI fixes. On `main`, NOT yet verified on deploy (api/ + auth don't run locally).**
- **Slice 4 — paid vision attribute-read.** New `api/things-vision.ts` (Sonnet 4.6 vision, **~$0.01/call**, one image, rate-limited 40/hr, mirrors `things-compare`). Reads taste tags (material·palette·vibe·category) off a product image — the LOOK, not identity (no brand/logo/text). Client: `readImageAttributes()` in `things.ts`. **Fires automatically in the background** after a product save that has an image + no manual tags (`autoTagFromImage` in `ThingsScreen`, merges-never-clobbers). Farah chose **auto-on-capture** (the board mirrors you with zero tagging). Email-in `captureThing` does NOT trigger it (server-side path) — a natural cost boundary, but email things won't auto-tag.
- **Two UI fixes:** menu links lowercased (`edit`·`got it`·`remove`, sheet titles, buttons, long placeholders — single-noun fields like `Name`/`Price` kept caps to match media's `Title`/`Creator`); **editorial header added** to Things (uppercase kicker `N on the board` + lowercase `things` title + 1.5px ink rule) to match its sibling Library — this was the "feels different" fix.
- 73 Vitest green, typecheck clean. **Vision endpoint UNVERIFIED — needs a real save-with-image on deploy (will spend ~1¢).**

**Last session (65):** Built "Things" Slice 0 — gut-check PASSED, merged via PR #16. Free `og-parse` reader · board + both capture paths · deliberation loop · sale price · opt-in AI Compare + plan brief. (s65 archive entry was recovered after PR #16 cut one commit short.)

---

## ▶ Next session (68)

**PICK UP HERE — verify Slice 4 (paid vision) on the live deploy.** It's built but unverified (api/ + auth don't run locally).
1. **Save a product with an image** in the app (paste a clothing/object link) → wait ~2 min for the Vercel build → it saves instantly, then within a few seconds the **taste tags should auto-fill** (material/palette/vibe/category) and the masthead should start reading them. Costs **~1¢** per save — don't loop it.
2. **If tags don't appear:** check the Vercel function logs for `[things-vision]`; confirm `ANTHROPIC_API_KEY` is set; confirm the image URL is public (Anthropic fetches it directly — a bot-walled CDN image will fail). The read is best-effort, so failure = silently no tags.
3. **Judge the tags as a first-time user** — are they the right *granularity* and do they read human, not like debug labels? Tune the prompt in `api/things-vision.ts` if they're off. Watch: does auto-tagging feel magic or intrusive? (Farah can remove any via the "what matters" editor.)

**Still needs an eyeball on the live app (carried from s66/67):**
- **Two UI fixes from s67:** menu links now lowercase; Things now has the editorial kicker+rule header — confirm it reads right and matches Library.
- **JSON-LD scraper** (re-add the link that returned "Woman" — name/price should fill now) · **Compare cheap-reviews** (run Compare on 2+ linked candidates — should cite details/ratings).
- **Behind auth (eyeball):** masthead, Vibe rename, sorting, category filter, switcher-in-caps.
- **Supabase preview-auth fix** still pending (`https://*.vercel.app/**` in Redirect URLs) — memory `preview-auth-redirect`.
- **Tag the 3 existing saves** (or re-save them so vision tags them) — masthead shows "tag a few (0/4)" until ≥4 tagged; this is the real thread gut-check.

**Open Things items:** vision doesn't fire on **email-in** captures (server-side path) — decide if that's worth wiring (more cost, but auto-tags everything). Full **web-search Compare reviews** (Reddit/blogs) — parked, pricey, Farah-flagged. Watch: is `FieldsForm` crowded now (fields + sale + taste tags)?

**Carried from s65 (Slice 0 — check, don't rebuild):** board, deliberation loop, edit/manual fallback, sale price, AI Compare voice + plan brief. Slice 0 passed the gut check. Watch: does Compare still read human on real items? Is the plan sheet busy?

**Key model facts:** all on existing `Item`; `type:'thing'`; `metadata.kind` = `product`|`intent`; `metadata.attributes[]` (`{facet,value}`) is the composition engine; `reaction` stays null; resolve = `done` + winner flag, **no archive** (losers persist).

**Carried from s63 (check, don't rebuild):**
- **Regions** — shipped, browser-direct backfill. Coverage was still filling in via repeated ⋯ → "pull regions". If it's plateaued with a stubborn `failed` count, slow the pull down (lower concurrency / add pacing in `src/lib/regions.ts`). Language axis `P364` parked in ROADMAP.
- **Filter sheet** — trimmed to collapsible sections; confirm it eyeballs right on phone.

**📅 ~2026-07-14 checkpoint — held decision:**
1. **Taste-tab keep-or-fold** — DECIDED s63: *keep the tab*; revisit after real desert-island use. (Reasoning + profile-as-masthead fold sketch → `docs/ROADMAP.md`.)

**Still pending re-check (s57 follow-ups, may already be fine):** Discover blurb titles read upright/distinct; search shows "all" tab highlighted while a query is active.

**Verified earlier — don't re-check:** s56 scroll-restore (cold-kill case) + "new music tuesday"; detail sheet (`SheetHero`); filter-clip bug (session-49 #5).

**Parked from s55:** bigger detail-sheet cover with **real CSS text-wrap** (deferred — body lives outside `SheetHero` + `overflow:hidden` kills wrapping). Page-level **kicker+rule section dividers** (Taste/Library) is a fast-follow if wanted.

**Also still open (smaller, carried from before):**
- **PageHeader 1.5px rule** — if it reads heavy across pages, softer hairline = one-line change in `src/components/PageHeader.tsx`.
- **#7 — catalog-miss interstitial.** "nothing found — identify with ai?" adds a step mid-flow; kept as a cost gate (paid Sonnet). Farah's call whether to make it automatic. (`AddScreen.tsx:367`)
- **Discover mood chips** — parked, revisit **2026-06-29** after a week of real use. (`docs/ROADMAP.md`)

**Don't touch (genuinely good):** decade grouping, the taste page's vibe-headline → prose → gap → always-loved → desert-island arc, the editorial palette, the faithful-creators logic, **the recommendation engine itself.**

Backlog beyond this queue → `docs/ROADMAP.md`.

---

## 🔁 Doc upkeep (the process that keeps this from rotting)

The reason this got messy before: one file did five jobs, history piled up, and the same fact lived in three places (then drifted — session 42 was a whole cleanup). The split above fixes the structure; these rules keep it clean:

1. **One fact, one home.** A status (e.g. "Sentry is live") lives in exactly one file. Elsewhere, link to it — don't restate it.
2. **End of session: log, then prune.** Write the session entry at the **top** of `docs/HANDOFF-archive.md`. If you finished a roadmap item, **delete** it from `docs/ROADMAP.md` (the log is its record — no ✅ graveyard). Update "Where we are" + the Next-session checklist here.
3. **Keep this file one screen.** Session history → archive. Stable facts → reference. Backlog → roadmap. If `HANDOFF.md` is scrolling, something's in the wrong file.
4. **The Stop hooks nudge all of this** (roadmap reminder, handoff staleness/size, guide reminder). They're cues to do the prune, not noise to dismiss. See `docs/REFERENCE.md` → Dev automation.

---

## 🛠️ Working style

- Farah = product person, not engineer. ELI5, short sentences, no jargon.
- Menus are fine — she decides. Add a recommendation + plain-language why on technical calls.
- Light verification by default. Flag when exhaustive is warranted.
- Flag good moments to start a fresh chat (long sessions = expensive).
- Two billing systems — the Anthropic API key (pay-per-token, $20/mo cap) is separate from this Claude Code subscription. Never burn more than 2–3 test API calls; web_search is the pricey one. See `docs/REFERENCE.md` → API costs.
