# Nospaces — Roadmap

**Open items only**, sorted by horizon (short → medium → long). Shipped work lives in git history + `docs/HANDOFF-archive.md` — deliberately not repeated here so the backlog stays readable. The *active* queue for the very next session lives in `HANDOFF.md`; this file is everything beyond that.

When you finish an item: **delete it from here** (don't leave a ✅ — the session log records it). When work surfaces a new idea, add it under the right horizon.

---

## Standing principle — humanizer prose

**Anywhere the app generates user-facing text with an LLM, it must not FEEL AI-written** — and must carry true, meaningful insight, not generic filler. Reference: `github.com/blader/humanizer`. The guardrails live in one place — **`api/_humanizer.ts`** (`HUMANIZER_GUARDRAILS`), imported by `taste-profile.ts`, `recommend-feeds.ts`, `recommend.ts`. *Any future prose generator must import it too — don't re-paste the block.* (`api/blurb.ts` is extraction, not AI — no guardrails needed.)

---

## Short term — next few sessions

### Nav placement — a decision (Farah flagged priority, s82)
- **Domain switcher + section tabs are split top/bottom — bring them together.** Today the media/things switcher floats at the **top** (`DomainSwitcher.tsx`) and the library/taste/discover tabs sit at the **bottom** (`BottomNav.tsx`) — two nav systems in two corners, reads disjointed. Options: move the section tabs up to the top, or move the domain switcher down to the bottom. **Recommended (Claude, s82): move the switcher DOWN to a slim row just above the bottom tab bar — don't move the tabs up.** Rationale: bottom is the thumb zone (a top nav was deliberately removed before); the two are *nested* (media/things = which world, library/taste/discover = where in it), so stacking them bottom reads as that hierarchy. Caution: two stacked bottom elements add weight — keep the switcher row hairline-thin (it already is). *Decide direction with Farah, then it's a small build.*

### Quick polish & fixes (s82 feedback — mostly small)
- **Empty-state copy is inconsistent across the two domains.** Media (`LibraryScreen.tsx`) uses a **header + smaller-font line** ("your library is empty." / "add the first thing you can't shut up about."); Things (`ThingsScreen.tsx`) puts it all in one small font. Make both the header + small-line shape: media = "your library is empty." / "tap + to add the first thing you can't shut up about." ; things = "your board is empty." / "tap + to save a product you love, or plan a purchase you're weighing."
- **Done-badge styling is inconsistent (loved vs finished).** On grid cards the **loved smiley** (`LibraryScreen.tsx:1396`) has the cute feathered white outline (`drop-shadow(0 0 1.5px #fff)`) so it pops; the **finished check** (`:1409`) uses a different treatment (white-pill background + box-shadow, a plain `✓` glyph). Give the check the same feathered-outline look as the smiley so they're one family.
- **Random covers don't load in grid/gallery view** in the library, even though the same items show artwork in list/card view. Likely a `GridCard` artwork-resolution gap vs `ItemRow` (`LibraryScreen.tsx` ~`:793` grid branch vs the row branch). Investigate which art field grid reads.
- **"read taste from photo" is cramped against "add note"** — the two CTAs are squished together (Things board). Give them breathing room / fix the layout.

### User guide overhaul (s82)
- **Guide is stale and media-only — needs screenshots refreshed + a Things half.** `GuideScreen.tsx` has out-of-date images and covers media only. **Split the guide into two tabs — media and things** — and bring all screenshots up to date. (Reuses the media/things framing the app already has.)

### Media library polish — for discussion (don't auto-fix)
- **Gallery density — strip subtitles, tighten to a moodboard-like grid (idea, Farah s82).** In grid view, drop the subtitle under each item and reduce spacing so it reads more like the Things moodboard (but gridded). *Open problem:* with no cover art you can't tell what an item is — so pair it with a **title-on-card** fallback (write the name onto the tile when there's no artwork). Consider applying the same treatment to **both** media and things. Practical? Decide before building.
- **"Decide for me" placement (idea, Farah s82 — low priority).** The "decide for me" entry point floats oddly and isn't used much. Possible: move it into a separate tab/section within the library rather than floating. Farah's own note: "probably doesn't warrant, but for consideration." *Trigger: revisit if it keeps looking out of place after the nav decision above.*
- **Scroll-lock is too sticky** — Repro: scroll down in media → back to top → switch to Things → back to media → media is **still scrolled down** (restores old position, ignoring that you'd scrolled to top). Scroll lock was on purpose, so this needs thought. Open question: make the media/things switcher more accessible so you don't fight the lock — or does that clutter the UI? Discuss before touching.
- **Music library is getting cluttered** — needs organizing (e.g. "in rotation" / "classics" shelves). Think fresh. **Pair with the verdict reshape below** (same area, same session).

### Capture — the input pain (its own session; mostly free)
The friction that still hurts, across both media and Things, is getting things *in* from a phone. Four threads, one session:
- **iOS share-to-app via an Apple Shortcut (do next session)** — share a link straight to the board instead of email-in's two-step. iOS forces every browser onto WebKit and WebKit doesn't support Web Share Target *at all*, so share-sheet capture is Android-only — a Shortcut is the only iOS path. A previous attempt failed because it did an HTTP POST with Supabase JWT/JSON (the hard, fragile way). **Cleanest rebuild — do NOT POST to the API; just auto-send the email:** a Shortcut that accepts a shared URL → "Send Email" pre-addressed to `things@nospaces.xyz`, URL in the body, **compose sheet OFF so it sends silently**. Reuses the 100%-working email-in path verbatim; identity is automatic (sends from Farah's allowlisted iPhone Mail, `ALLOWED_EMAILS`). **Goal: absolute simplest setup** — ideally a shareable Shortcut link she just installs. Free, no AI. NOTE: REFERENCE still says "iOS Shortcut — RETIRED"; update it when this ships. See memory `ios-share-target-dead`.
- **Can't share an *image* directly into the app** — the Shortcut email path covers links but not images (Web Share Target being dead is the blocker). Figure out the least-painful mobile path for image-share.
- **Can't pull recs out of a paywalled article** without screenshotting each rec or saving the page as a PDF — both unwieldy on a phone, especially inside a publisher app (New Yorker etc.). Figure out the least-painful extraction path.
- **Screenshot-capture fallback for a thing** — when a shop link won't scrape (Cloudflare etc.), snap/pick a screenshot and AI fills it (mirrors media's `processImageFile`; client pattern exists in `AddScreen`). **Blocker:** a thing has no catalog, so a screenshot gives name/price/image but **no buy link** — and a linkless board entry is half-dead. Recovering the link needs **reverse product web-search** = expensive + unreliable (wrong colour / resale / blog). *Trigger: web-search-to-recover-link becomes acceptable on cost + accuracy, OR a cheaper product-lookup source appears.*

---

## Medium term

### Taste profile
- **What feeds the taste read — one decision (consolidates the threads below).** A single design call several open items all depend on: **what should the taste profile be built from, and in what proportion — what you _saved_ (aspiration), what you _chose/kept_ (behaviour), or what you _declared_ (self-definition)?** Settle this once and it answers all of:
  - **Self-defined taste (Farah, s80)** — today the read is AI-derived (infers your vibe from your saves). Let the user define it too: (a) a **descriptive override** ("here's how I'd actually describe my taste") and/or (b) an **aspirational target** ("the taste I'm reaching for"). The open question is the **feedback loop**: does a declared taste just sit as a label, bias recommendations, blend into the AI read, or get measured against actual saves as a **"gap mirror"** ("you say minimalist but keep saving maximalist")?
  - **Keep the Things taste-read practical, not navel-gazing (s81 review)** — its prose reads identity off a *wishlist* (aspiration, thin signal), which tips toward a hall of mirrors. Either gate it behind a real signal threshold or reframe it toward use ("what you keep circling") rather than an identity portrait. The media taste page stays the one identity mirror.
  - **Beauty/home/misc exclusion** — the mechanism for keeping non-fashion objects out of the aesthetic read (detail under Things board polish). Same plumbing question: what counts toward `itemAttributes` / `readThread` / `boardTasteSummary`.
  - **"Got it" → a worth-it signal (s81)** — the Things terminal state is a dead end (no reflection), unlike media's `done`→reaction. A light **"worth it / fine / returned"** could feed *decision quality* (did my picks pan out?) **without** polluting the set-based aesthetic read.
  - ⚠️ **Soul tension to resolve first:** the Things design soul says *for objects, **saving — not rating — is the taste signal**; `reaction` left null by design* (see "design soul" below). So any post-acquisition signal must inform **decisions**, not the aesthetic mirror. The "gap mirror" (aspiration vs. behaviour) is the unifying frame; relates to the media taste page's existing "the gap" section. *Decide the whole loop with Farah before building.*
- **Things taste read — by-category + through-line shape (Farah, s82).** Today the Things taste read narrates one overall aesthetic register. Farah wants it to *also* go **category by category** — "you gravitate toward button-downs / loose pants / slouchy leather bags," naming the recurring shapes per category (proportion play, slouchy bags, etc.) — **and then** tie those threads together into the single aesthetic. So: per-category observations → one synthesis, not just the synthesis. (`api/things-taste.ts` + the facet/thread data it reads.) *Relates to the "what feeds the taste read" decision above — this is the output shape, not the input source.*
- **Taste vocab needs finer distinctions (Farah, s82).** The vibe/taste words are too coarse — "refined relaxed" should be distinguishable from plain "relaxed," etc. The vocab needs more defined, differentiated terms so two nearby-but-different aesthetics don't collapse to the same word. (Affects the vibe vocab feeding both media taste prose and Things attributes — check `lib/moods.ts` `VIBES` and the Things facet vocab.)
- **Verdict reshape (parked, Farah s75)** — on the media item sheet, "verdict" gets its own genre/vibe/**verdict** tag-row, but it largely repeats the reaction already shown (`· loved it`). Farah registered it "isn't totally working" but parked it — the reshape isn't settled (drop the redundant row? fold verdict into the reaction? make it carry something the reaction doesn't?). *Trigger: Farah comes back with what she wants verdict to be.* (`ItemActionSheet.tsx`, the genre/vibe/verdict rows ~`:708`.) **Tackle with the music-clutter item — same area.**
- **Taste tab: keep or fold (revisit ~2026-07-14)** — **decided s63: KEEP for now.** The fold case rested on two payoffs that both fell through (freeing a nav slot nothing daily is waiting for; the profile + desert island not belonging together — but Farah likes them equally and the island is too new to judge). The profile is what makes the app feel like a mirror, not a tracker — folding it into Discover risks burying the differentiator. *Trigger: revisit mid-July after real desert-island use. If by then the island reads as a Library thing and the profile as a Discover thing, split them.* **If profile ever moves to Discover:** treat it as a masthead, not a block — vibe words become Discover's headline, one tap opens the full profile as a bottom-sheet.
- *Note: the earlier 3-section stats taste page (medium pills, reaction breakdown, verdict counts, effort axis) was **deliberately removed** in the `216e6ca` redesign. Don't assume those sections still exist; revisit only if a stats section is actively wanted back.*

### Things board polish
- **Image-trim quality** — `src/lib/imageTrim.ts` (client canvas) is off-centre on some products and soft when zoomed. Limits = bbox/centroid heuristic + source resolution + CORS (only trims where a shop allows pixel reads; else plain cover-crop). *If it keeps annoying: move the trim **server-side** — we already fetch product images for vision (bypasses CORS, higher-res), so a `sharp`-based trim there fixes both centering and sharpness.*
- **Beauty + home + misc products on the board (Farah, s75)** — broaden past clothing so a skincare buy, a lamp, a random object can live here. **These probably should NOT count toward the taste read** — the thread + per-item "how this fits" line are tuned to fashion attributes (material/palette/vibe); a serum or kettle would muddy the mirror. Likely shape: let the `category` facet carry the non-fashion kinds, and **exclude non-aesthetic categories from `itemAttributes`/`readThread`/`boardTasteSummary`** (a "things I want" shelf alongside the style board, taste-neutral). Decide the exclusion mechanism (category allowlist? per-item `metadata.countsTowardTaste:false`?) with Farah before building. Free. *The exclusion-from-taste-read half is part of "What feeds the taste read" under Taste profile — decide it there.*
- **Multiple winners in a plan (Farah, s82)** — today a plan/intent resolves to one winner. Let a plan keep **more than one** chosen item (you might buy two of the candidates, or want both options on the board). Touches the resolve flow + the winner flag (currently single). Decide whether "winner" becomes a set.
- **Compare — full web-search version (parked, Farah-flagged)** — Compare already reads each candidate's own product page (description + JSON-LD `aggregateRating`) on Haiku (~$0.001–0.002/call). The **web-search version** (Reddit/blogs) is parked — Farah may decide it's worth the cost ($0.01–0.05+/compare on the capped key) since she already uses Claude/Gemini this way.
- **Paid product search (Google Shopping / SerpApi)** — v1 search-by-name uses AI-suggest (1 Sonnet call → named guesses + approx price, no live images). Real images/prices need a paid metered API. *Add only if AI-suggest proves too thin.*

### Discovery
- **Discover mood chips (revisit 2026-06-29)** — quick-pick vibe chips above the Discover search box, pre-filling the "in the mood for…" query, sourced from `VIBES` in `lib/moods.ts` + the user's top tags + 1–2 utility chips ("short", "surprise me"). Parked: auto-picked chips felt arbitrary and the search box alone covers the case. *Trigger: one week of real use of the rebuilt Discover.*

### Smaller parked ideas (have a trigger)
- **Want-to priority** — pin/tier system for backlog. Adds clutter to every row; help-me-decide + search cover the acute case. *Trigger: backlog grows genuinely unwieldy.*
- **Regions: language axis (`P364`)** — country filter shipped s63; language deliberately deferred. *Trigger: in real use you reach for "French" and a Dardenne/Québécois film isn't there. Then re-pull `P364` (free, one extra `wikidataFields` query) as a second axis; watch for the variant rollup ("Quebec French" → "French").*
- **Offline library cache** — full offline-first requires queuing mutations (markDone, edits, deletes) — different scope from the shipped capture queue. *Trigger: offline usage becomes a real pattern.*
- **Email talkback** — code is live; waiting on Postmark approval for sending to Gmail (submitted 2026-06-02). *Trigger: Postmark approves; set `POSTMARK_SERVER_TOKEN` in Vercel.*
- **PR workflow + branch protection** — direct pushes to `main` are fine for a solo dev / 2 users. *Trigger: a 3rd user joins (memory `pr-workflow-at-3-users` will prompt).*

---

## Long term — the big vision

**Expansion beyond media.** The spine already generalises — every item runs one loop: *want it → have it → react to it → that feeds a taste profile.* That fits more than media:
- **Places** (restaurants, bars, museums, shows): want to go → been → taste in experiences. *Lowest-friction next domain — reuses reaction + location-aware discovery almost as-is.*
- **Things** (shopping): SHIPPED as the active workstream. See its design soul below.

**IA — decided: domain switcher** (shipped for media/things). A top-level mode toggle; shared `Item` model, taste engine, and capture under the hood; each domain gets a tuned display (media = list, things = visual board, places = list/map). One "you" profile with a section per domain. (Rejected: one blended stream — incoherent. Rejected: separate apps — most work, least coherent.)

**The guardrail (don't lose the soul).** What makes nospaces *itself* is the react → profile loop. **Rule for any new domain: if it doesn't eventually feed a taste/aesthetic profile, it doesn't belong.** A pure save-everything list = Notion/Pinterest = dilutes the mirror.

**Things — design soul (still-true principles, for future polish + new domains):**
- **The signal is the _set_, not the _verdict_.** You don't *react* to a coat — the act of **saving** it is the taste statement (like pinning a moodboard). The aesthetic emerges from **what your saves have in common**, read live off the whole collection, and works with **zero owned items** (a wishlist alone is a self-portrait). Spine: **save → the set speaks → profile**. *Why: for objects you self-select for love before you'd ever rate, so a reaction carries no signal; composition is the signal that actually exists.*
- **Model:** `type:'thing'`; `reaction` left null; `status` `want_to` = saved/wishlist, `done` = a small "got it" accent (not a lifecycle, not inventory). `metadata.attributes[]` (`{facet,value}`: material/palette/**vibe** [shape+attitude]/priceTier/category, flat free-text) is the composition engine. `metadata.candidates[]` on intents.
- **Intent / candidates are first-class** (Farah is a deliberative comparison shopper). Start an intent (*"black clogs"*), collect candidates, mark a `leaning`, resolve. The candidates you *didn't* pick are still signal; the intent persists as a decision record. Light resolve — done + winner flag, **no archive** (losers persist).
- **Brand = one optional facet, not the spine** — often empty, and that's correct (vintage/secondhand/no-brand is peak signal). "Always reaching for" is a minor read.
- **Scope: clothing-first, honestly** — the composition engine is tuned to fashion attributes. Clothing (+ maybe home) get the real aesthetic read; tech/beauty/other are an allowed bucket, not promised a profile. Attribute vocab waits for real saved items (don't invent the taxonomy in a vacuum).
- **Shopping recommendations = skip** — recs need a product catalog and turn commercial fast; the curated wishlist + aesthetic *is* the value.

**Calendar integration** — surface relevant items + suggestions by where Farah will be. "You'll be in Tokyo in March — 3 things from your want-to list."

**Master "life index"** — nospaces as a curated self-portrait across all domains (media, food, places, events). Not a tracker but a mirror + recommendation engine. Every feature decision: does this make the index richer or the curation sharper?

---

## Ops / manual steps (need Farah — can't be automated)

- **Vercel spend management** — ⏳ skipped. Spend Management threw a "strange error" (likely the free Hobby plan, where it doesn't apply). Vercel usage notifications already on. *Revisit only if moving to Pro:* Settings → Billing → Spend Management, cap ~$30–40.
- **Anthropic spend cap** — done ($20/mo hard cap). Standing reminder: if hit, all AI features fail silently until month reset; fix = raise the cap.

---

## Shelved — decided against (keep so they're not re-proposed cold)

- **Individual songs** — albums-only is correct. Songs would bloat the library (hundreds vs ~50 albums); taste is more meaningful at album level. "Standout tracks" belongs as a note on the album.
- **Letterboxd diary.csv** — per-watch dates are cosmetic; repeat viewings need a schema change (one reaction per item today) + a rewatch UI. Disproportionate scope. *Revisit only if rewatch tracking becomes a native feature.*
- **Bandsintown API** — approval odds low for a personal app (they gate for commercial partners). TM covers major shows. Apply passively; revisit if approved.
- **Descriptive library search** — built then removed. AI maps language to filters but applies all matched dimensions at once → tiny intersections. The filter sheet does it better.
- **Comparison table along axes (Things)** — dropped (Farah, s66 — "doesn't feel necessary"). The live thread masthead covers the read.
