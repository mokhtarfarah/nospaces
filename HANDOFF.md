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

**This session (68) — Things↔Library parity, both phases. On `main`, deployed.** Phase 1 (nits #2a/#2b): product card tap → internal `ProductSheet` (buy link behind an explicit button); floating `+` speed-dial replaces the two in-body capture buttons. Phase 2 (nit #3 umbrella): sticky collapsing header (switcher+title+rule+masthead fold on scroll, sort+category rows pin) via a `100dvh` flex column + inner scroller, and a shared `TabChip` (ink+bold+italic active, no underline) matching Library. Behind auth → **eyeball on live; not click-verified in preview.**

**Last session (67) — Slice 4 (paid vision) shipped + VERIFIED working on deploy + UI fixes. All on `main`.**
- **Slice 4 — paid vision attribute-read. WORKING on the live app.** `api/things-vision.ts` (Sonnet 4.6 vision, **~$0.01/call**, one image, rate-limited 40/hr, mirrors `things-compare`). Reads taste tags (material·palette·vibe·category) off a product image — the LOOK, not identity (no brand/logo/text). Client `readImageAttributes()` in `things.ts`. **Fires automatically in the background** after a product save that has an image + no manual tags (`autoTagFromImage` in `ThingsScreen`, merges-never-clobbers). Farah chose **auto-on-capture**. A board **toast** shows the result (sticky + tap-to-dismiss on failure, so it's never a silent no-op).
- **Two image-fetch gotchas found + fixed in verification** (key lessons for any future vision work): (1) passing the og:image URL straight to Anthropic gets **403'd** by retail CDNs — so the endpoint **fetches the image itself** with a browser UA + **Referer/Origin** (the product page) and sends base64. (2) Our `Accept` header listed `image/avif` first → CDNs content-negotiated to **AVIF, which Anthropic vision rejects** → "bad-type-image/avif". Fixed by asking only for webp/png/jpeg/gif. *Open edge case:* a link that is **literally** a `.avif` file (no negotiation) would still fail — add on-the-fly conversion only if it recurs.
- **UI fixes:** all menu links + **all four save buttons** lowercased; sheet titles, buttons, long placeholders lowercased (single-noun fields `Name`/`Price` kept caps to match media's `Title`/`Creator`); **editorial header** added to Things (kicker + `things` + 1.5px rule) to match Library — the "feels different" fix; **board product/intent card titles forced lowercase** (textTransform) so shop ALL-CAPS names read uniformly.
- Email-in `captureThing` does NOT trigger vision (server-side path) — a deliberate cost boundary; email things won't auto-tag. 73 Vitest green, typecheck clean.

**Last session (65):** Built "Things" Slice 0 — gut-check PASSED, merged via PR #16. Free `og-parse` reader · board + both capture paths · deliberation loop · sale price · opt-in AI Compare + plan brief. (s65 archive entry was recovered after PR #16 cut one commit short.)

---

## ▶ Next session (69)

**Slice 4 (paid vision) is DONE + verified working** (tags auto-fill from a saved product's image; ~1¢/save). Nothing to re-verify there.

**s68 shipped both phases (on `main`, deployed) — Things↔Library parity, nits #2 + #3.**
- **Phase 1:** product card tap → internal `ProductSheet` (buy link behind an explicit **"buy ↗"** button, no accidental exits; per-card `⋯` gone, got-it/edit/remove in the sheet w/ remove confirm). Floating `+` speed-dial replaces the two in-body buttons.
- **Phase 2:** sticky collapsing header (switcher+title+rule+masthead fold on scroll, sort+category rows pin) via a `100dvh` flex column + inner scroller; shared `TabChip` matching Library.
- ⚠️ **EYEBALL ON LIVE:** all of s68 is behind Google auth, so **NONE** of it was click-verified in preview — only typecheck + 73 tests + clean load. Farah confirmed phase 1 reads "okay for now"; phase 2 still wants a scroll-behavior eyeball.

**PICK UP HERE / open from the umbrella (#3) — only minor bits left:**
- Container shape: Things is a centered `maxWidth:640` column; Library is full-bleed. Only visible on a wide desktop window (phone is identical). Left as-is because full-bleed blows up the 2-up grid on desktop — revisit only if wanted.
- Optionally tone the beige "your thread" masthead toward Library's palette (kept deliberately — it's the soul of Things).
- If phase-2 scroll/collapse feels off on a short board (few items barely scroll), reconsider whether collapse earns its keep here.

**Judgement calls on the now-working vision (worth an eye):**
- **Tag quality as a first-time user** — right *granularity*? Read human, not like debug labels? Tune the prompt in `api/things-vision.ts` if off. Does auto-tagging feel magic or intrusive?
- **Tag the existing saves** (or re-save them so vision tags them) — masthead shows "tag a few (0/4)" until ≥4 tagged; that's the real thread gut-check.

**Still needs an eyeball on the live app (carried from s66):**
- **JSON-LD scraper** (re-add the link that returned "Woman" — name/price should fill now) · **Compare cheap-reviews** (run Compare on 2+ linked candidates — should cite details/ratings).
- **Behind auth (eyeball):** masthead, Vibe rename, sorting, category filter, switcher-in-caps.
- **Supabase preview-auth fix** still pending (`https://*.vercel.app/**` in Redirect URLs) — memory `preview-auth-redirect`.

**Open Things items:** vision doesn't fire on **email-in** captures (server-side path) — decide if that's worth wiring (more cost, but auto-tags everything). Literal-`.avif` image links still fail (rare; add conversion only if it recurs). Full **web-search Compare reviews** (Reddit/blogs) — parked, pricey, Farah-flagged. Watch: is `FieldsForm` crowded now (fields + sale + taste tags)?

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
