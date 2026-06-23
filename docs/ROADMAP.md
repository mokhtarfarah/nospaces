# Nospaces — Roadmap

**Open items only.** Shipped work lives in git history + `docs/HANDOFF-archive.md` — it is deliberately not repeated here so the backlog stays readable. The *active* queue for the next session lives in `HANDOFF.md`; this file is everything beyond that.

When you finish a roadmap item: delete it from here (don't leave a ✅ checkmark — the session log records it). When work surfaces a new idea, add it here.

---

## Standing principle — humanizer prose

**Anywhere the app generates user-facing text with an LLM, it must not FEEL AI-written** — and must carry true, meaningful insight, not generic filler. Reference: `github.com/blader/humanizer` (catalogued signs of AI writing + fixes). The guardrails now live in one place — **`api/_humanizer.ts`** (`HUMANIZER_GUARDRAILS`), imported by `taste-profile.ts`, `recommend-feeds.ts`, and `recommend.ts` (s61). *Any future prose generator must import it too — don't re-paste the block.* (`api/blurb.ts` is extraction, not AI — no guardrails needed.)

---

## Parked — real ideas, deliberately not now

Each has a reason it's parked and a trigger to revisit. Don't re-raise without new signal.

- **Discover mood chips (revisit 2026-06-29)** — quick-pick vibe chips above the Discover search box, pre-filling the "in the mood for…" query. Sourced from the app's existing vibe vocab (`VIBES` in `lib/moods.ts`), personalized to the user's top taste tags + 1–2 utility chips ("short", "surprise me"). Parked because auto-picked chips felt a little arbitrary and the search box alone covers the case. *Trigger: one week of real use of the rebuilt Discover (2026-06-29) — re-raise with Farah then.*
- **Empty-library copy** — "go listen to some music you loser" is a music-only inside joke; jarring to a stranger and wrong on a non-music library. **Flagged again in s62's editorial pass; Farah chose to keep it** (charm for a 2-person app). Parked, not killed. If revisited: rewrite as something media-agnostic (the library spans films/books/music/TV), keep a bit of warmth. (`LibraryScreen.tsx:899`) *Trigger: Farah decides the joke's run its course.*
- **Want-to priority** — pin/tier system for backlog. Parked: adds clutter to every want-to row; help-me-decide + search already cover the acute case. *Trigger: backlog grows genuinely unwieldy.*
- **Regions: add language axis (`P364`) — only if country feels wrong in real use** — the country filter shipped s63 (built country-only). Language was deliberately deferred, not pulled. *Trigger: in real use you reach for "French" and a Dardenne/Québécois film isn't there (i.e. country alone can't express a shared-language cinema). Then re-pull `P364` — still free, one extra query in `wikidataFields` — and add it as a second filter axis. Watch for the variant-rollup chore ("Quebec French"/"Belgian French" → "French"). Don't build it speculatively: we still don't know Farah's library even contains the diaspora cases that justify it.*
- **Offline library cache** — full offline-first requires queuing mutations (markDone, edits, deletes) — different scope from the capture queue already shipped. *Trigger: offline usage becomes a real pattern.*
- **Email talkback** — code is live; waiting on Postmark account approval for sending to Gmail (submitted 2026-06-02). *Trigger: Postmark approves; set `POSTMARK_SERVER_TOKEN` in Vercel.*
- **PR workflow + branch protection** — direct pushes to `main` are fine for a solo dev / 2 users. Parked until >2 users. Memory `pr-workflow-at-3-users` will prompt to set it up when a 3rd user joins.

---

## Ops / manual steps (need Farah — can't be automated)

- **Anthropic spend cap** — ✅ done. $20/mo hard cap set. NOTE: hard stop — if hit, all AI features fail silently until month reset; fix = raise the cap. (Kept here as a standing reminder, not an open task.)
- **Vercel spend management** — ⏳ skipped. Spend Management threw a "strange error" (likely the free Hobby plan, where it doesn't apply). Vercel usage notifications already on. *Revisit only if moving to Pro:* Settings → Billing → Spend Management, cap ~$30–40.

---

## Medium / long-term ideas

**Taste & stats**
- The earlier 3-section stats version of the taste page (medium pills, reaction breakdown, verdict counts, effort axis) was **deliberately removed** in the `216e6ca` redesign. Current page: vibe headline → AI prose → "the gap" → "always loved" → desert island gallery. Don't assume the stats sections still exist. Revisit only if a stats section is actively wanted back.
- **Taste tab: keep or fold (revisit ~2026-07-14)** — **decided in s63: KEEP the tab for now.** The fold case rested on two payoffs that both fell through: (1) freeing the nav slot — but nothing daily is waiting for it; (2) the profile and desert island not belonging together — but Farah likes them equally and the desert island is too new (added s62) to judge its natural home. The profile is also the thing that makes the app feel like a mirror, not a tracker — folding it into Discover risks burying the differentiator. *Trigger: revisit ~mid-July after a few weeks of real desert-island use. If by then the island reads as a Library thing and the profile as a Discover thing, split them: island → a pinned/filtered view in Library; profile → Discover.* **If we ever move the profile to Discover:** treat it as a masthead, not a block — vibe words become Discover's headline (in Farah's own words), one tap opens the full profile as a bottom-sheet. Keeps emphasis without costing the recs any vertical space.

**Expansion beyond media (long-term)**

Design discussed in depth s63 (Farah + Claude). Decisions captured below — this is a real, scoped plan, not a vague someday.

**Organising principle — the spine already generalises.** Every item runs one loop: *want it → have it → react to it → that feeds a taste profile.* That fits far more than media:
- **Media** (today): watchlist → watched/read → taste in stories.
- **Places** (restaurants, bars, museums, shows): want to go → been → taste in experiences. *Lowest-friction extension — reuses reaction + discovery (now location-aware) almost as-is.*
- **Things** (shopping/wishlist): wishlist → owned → your *aesthetic*. *Higher value to Farah, more divergent; designed first (below).*

**IA — decided: domain switcher.** A top-level mode toggle (media / places / things). Shared `Item` model, taste engine, and capture under the hood; each domain gets a display tuned to it (media = list, things = visual board, places = list/map). One "you" profile with a section per domain. (Rejected: one blended library — a film and a sweater in one stream reads incoherent. Rejected: separate apps — least coherent, most work.)

**The guardrail (don't lose the soul).** What makes nospaces *itself* is the react → profile loop. **Rule for any new domain: if it doesn't eventually feed a taste/aesthetic profile, it doesn't belong.** A pure save-everything list = Notion/Pinterest = dilutes the mirror.

**Things / shopping — v1 design (reworked s64 around _composition over reaction_; supersedes the s63 react-loop version):**

> **Build status:** **Slices 0–1 SHIPPED (s65–s66, on `main`).** Slice 0 = board, both capture paths, the intent→candidates→leaning→pick deliberation loop, free `og-parse`, edit/manual-fallback, on-sale price, opt-in AI Compare (Haiku, first paid surface), plan **brief**. Slice 1 = `metadata.attributes[]` (`{facet,value}`: material/palette/form/category/priceTier, flat free-text not a frozen enum) + the pure `readThread()` "thread" reader (recurring tag per facet, null below 4 tagged items, 14 Vitest cases) + `AttributesEditor` capture UI. **Slice 3 SHIPPED early (s66)** — domain switcher: top-level `Media / Things` toggle (`src/components/DomainSwitcher.tsx`) on every primary screen; the temp 4th bottom-nav tab is gone; things no longer leak into the media library/taste/discover (filtered at source by `type !== 'thing'`); on the board the media nav + FAB step aside (board has its own capture). **Slice 2 SHIPPED (s66, masthead only)** — the board's live "thread" masthead (`ThreadMasthead` surfaces `readThread`): once ≥4 things are tagged it shows the recurring read ("muted · wool · structured"), below threshold a gentle "tag a few" nudge with an `n/4` counter. **The comparison-table-along-axes was dropped** (Farah, s66 — "doesn't feel necessary"). **s66 board-feedback pass:** category dropped from the thread; card-resize bug fixed (minmax/align-start); domain switcher lowercased; **Form facet renamed → Vibe** (holds shape + attitude: bold/statement/chunky; legacy `form` tags mapped forward via `LEGACY_FACET`); category leads the tag editor; light board **sorting** (recent/price/a–z, `sortThings` + `priceValue`); Compare result now dismissable; fixed a Slice-1 bug where editing a candidate wiped its tags. Plans stay untagged (brief covers it — Farah's call). **Scraper:** `og-parse` now reads **JSON-LD `schema.org/Product`** (name/brand/price) — fixes generic-`og:title` misses like "Woman" (free; verify on deploy, `api/` doesn't run locally).

**Email-in for things — SHIPPED s66.** Forward a product link to `things@nospaces.xyz` (`shop@`/`want@`) → scraped + saved to the board, free (no Anthropic; shared `api/_scrape.ts`, extracted from og-parse). Routed by recipient local-part. Details → REFERENCE → Email capture.

**Also shipped s66 (2nd feedback round):** switcher reverted to caps (they were fine; the lowercase gripe was about the broader UI, not the switcher); dropped the redundant "THINGS / your board" header on the board (switcher already says it); **category filter** row on the board (`categoriesOf` + chips).

**Still TODO from the s66 feedback batch:**
- **Compare cheap-reviews** — feed each candidate's own product-page text into the Haiku take (no web search, near-free). *Parked, Farah-flagged:* the **full web-search version** (Reddit/blogs) — she may decide it's worth the cost ($0.01–0.05+/compare on the capped key) since she already uses Claude/Gemini this way.
- **Auto-category** — the natural Slice-4 vision hook (and JSON-LD often carries category too).

 **Next: Slice 4** = paid Sonnet vision attribute-read for photo/link-image capture (state exact per-call cost first; Compare proved the paid plumbing). **Open follow-up:** the masthead only lights up once items are actually tagged — Farah's existing saves are untagged, so first-run shows the nudge state until she tags them (by design). The slice details below describe the *original* full plan; the shipped pieces are done — **don't rebuild** (see s65/s66 archive).

**The pivot — the taste signal is the _set_, not the _verdict_.** You don't *react* to a coat; the act of **saving** it is already the taste statement (like pinning a moodboard). The aesthetic emerges from **what your saves have in common**, read live off the whole collection — and works with **zero owned items** (a wishlist alone is a self-portrait). New spine: **save → the set speaks → profile** (vs media's want→have→react→profile). _Why the rework: for objects, reaction collapses — you self-select for love before you'd ever rate, so `loved_it/eh/not_for_me` is foregone and carries no signal. Composition is the signal that actually exists. Full critique → s64 archive entry._

- **Reuses `Item`, but reaction is _not_ the engine.** `type:'thing'`, `status`: `want_to` = saved/wishlist, `done` = a small "got it" accent (NOT a lifecycle, NOT inventory — just slightly strengthens an item's weight in the profile). **`reaction` is left null for things** — admit things ≠ media at the model level. `metadata.attributes[]` is the new core: **material** (wool/leather/linen…), **palette** (muted/earth/monochrome…), **form** (oversized/tailored/structured…), price tier, category. Plus `image`, `price`, `buy-link`, optional `brand`.
- **The profile reads attributes, and the mirror shows up _immediately_.** The aesthetic is just the recurring pattern across the set — *"warm minimalism · natural materials · muted palette · investment outerwear"* — computable from ~6 items. So a light profile is the **board's masthead from day one** ("your thread: muted · natural · structured"), refreshing as you add — NOT a deferred phase-2 page. Kills the "empty room / feels like a stub" risk; five saves and the board reflects you back.
- **Brand = one optional facet, not the spine.** (Reversed from s63's `creator`=brand.) Brand is just another attribute tag — *often empty, and that's correct*: vintage/secondhand/no-brand are peak taste signal. "Your brands" demotes to a minor read ("you gravitate to COS, Toteme, and a lot of vintage"). Nothing structural leans on it.
- **"Own" is a minor accent (not a closet app).** No mark-done sheet, no reaction prompt, no archive lifecycle — just a "got it" dot. The wishlist already carries the signal, so there's no inventory gravity well pulling you toward bulk-logging your wardrobe. (Closet/outfit management = a different product; out of scope.) *Optional phase-2 signal that's genuinely different: "still love it" vs "fell off" months after owning = staying-power/regret, not the foregone buy-moment verdict.*
- **Intent/candidates — FIRST-CLASS and in v1 (Farah is a deliberative comparison shopper; this is her make-or-break feature).** Two capture paths, both first-class: (a) **save a concrete product** (the simple/default path — not everyone needs intents), and (b) **start an intent** (*"black clogs"* — a need, no product yet) that collects **candidate options** you weigh over time, mark a `leaning`, and eventually resolve. Intent is *opt-in* (a distinct "plan a purchase" entry, not forced on every save) but fully built, not a footnote. Bonus under composition: **the candidates you _didn't_ pick are still signal** (weighing four black clogs = loud evidence you want black clogs), and the whole intent persists as a **decision record** ("here's how I chose"). **Lifecycle stays light — no archive state needed:** `metadata.candidates[]` is a flat list on the intent item; "pick this one" sets the intent `done` + flags the winner; **losers persist in the record** (they're signal + history, not deleted); the winner *optionally* graduates to its own owned `thing` on the board. The only heavy part I'd flagged — archiving losers — is simply dropped: we keep them.
- **Capture (make-or-break) — AI reads _attributes_, not _identity_.** The reframe fixes the old precision problem: vision is good at vibes, bad at facts, and attributes are exactly what the profile needs.
  - **Paste/share a product link** → server reads OpenGraph/product tags → auto-fills image + title + price (+ brand if present). **Free** (just fetches the page; reuse `_ssrf.ts`). The primary flow.
  - **Photo / link-image** → 1 Sonnet vision call **describes attributes** (material/palette/form/category) rather than guessing the exact product. Lower-stakes than identity (a wrong brand was poison; "muted, wool, oversized" being roughly right is fine + useful). Per-use cost like the catalog-miss flow. *Farah wants this — v1.*
  - **Search by name**: products have **no free unified catalog** (no TMDB/Wikidata). v1 = **AI-suggest** (1 Sonnet call → named guesses + approx price, no reliable live images). **Paid product search (Google Shopping / SerpApi)** = real images/prices but metered against the $20 cap → **add only if AI-suggest proves too thin** (use-before-you-build).
- **Scope: clothing-first, honestly.** The composition engine is tuned to fashion attributes (material/palette/form). **Clothing (+ maybe home) get the real aesthetic read; tech/beauty/other are an allowed bucket but _not promised_ a profile in v1.** It's a *style* app under a "things" hood — stop pretending the four categories are equals. **Attribute vocab should wait for real saved items** (don't invent the taxonomy in a vacuum — same lesson as letting the aesthetic profile wait for real data).
- **Shopping recommendations = skip.** Recs need a product catalog and turn commercial fast. The curated wishlist + aesthetic *is* the value.
- **Net effect on build vs s63:** dropped — reaction flow, mark-done sheet, archive state. Kept + first-class — intent/candidates (light resolve: done + winner flag, no archive). Data model = `type:'thing'` + `metadata.attributes[]` + `metadata.candidates[]` (on intents). New build pieces: `thing` type + the two capture paths (concrete product / intent), the **free OG-parse endpoint**, the candidate-weighing + light-resolve UI, the visual board with its **live "thread" masthead**, the domain switcher (IA), and the attribute-reading vision call (first paid surface — state cost before building).

- **Calendar integration** — surface relevant items + suggestions based on where Farah will be. "You'll be in Tokyo in March — 3 things from your want-to list."
- **Master "life index"** — nospaces as curated self-portrait across all domains (media, food, places, events). Not a tracker but a mirror + recommendation engine. Every feature decision: does this make the index richer or the curation sharper?

---

## Shelved — decided against (keep for reference)

Tried or considered and rejected. Documented so they're not re-proposed cold.

- **Individual songs** — albums-only is correct. Songs would bloat the library immediately (hundreds vs ~50 albums). Taste model is more meaningful at album level. "Standout tracks" belongs as a note on the album.
- **Letterboxd diary.csv** — adds per-watch dates + repeat-view counts. Dates are cosmetic; repeat viewings need a schema change (one reaction per item today) + a rewatch UI. Disproportionate scope. *Revisit only if rewatch tracking becomes a native feature.*
- **Bandsintown API** — not applied. Approval odds low for a personal app (they gate for commercial partners). TM covers major shows; indie coverage would be nice but not worth planning around. Apply passively; revisit if approved.
- **Descriptive library search** — built then removed. AI maps natural language to filters but applies all matched dimensions simultaneously → tiny intersections. The filter sheet does the job better.
