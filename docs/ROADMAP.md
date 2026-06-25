# Nospaces — Roadmap

**Open items only**, sorted by horizon (short → medium → long). Shipped work lives in git history + `docs/HANDOFF-archive.md` — deliberately not repeated here so the backlog stays readable. The *active* queue for the very next session lives in `HANDOFF.md`; this file is everything beyond that.

When you finish an item: **delete it from here** (don't leave a ✅ — the session log records it). When work surfaces a new idea, add it under the right horizon.

---

## Standing principle — humanizer prose

**Anywhere the app generates user-facing text with an LLM, it must not FEEL AI-written** — and must carry true, meaningful insight, not generic filler. Reference: `github.com/blader/humanizer`. The guardrails live in one place — **`api/_humanizer.ts`** (`HUMANIZER_GUARDRAILS`), imported by `taste-profile.ts`, `recommend-feeds.ts`, `recommend.ts`. *Any future prose generator must import it too — don't re-paste the block.* (`api/blurb.ts` is extraction, not AI — no guardrails needed.)

---

## Short term — next few sessions

### Awaiting Farah's eyeball (shipped, behind login — verify then delete)
- **Things taste restructure (s78)** — Things is now two bottom tabs (wishlist · taste), and taste splits into sub-tabs (profile · moodboard), mirroring media's profile · desert island. Confirm: (1) sub-tab chips read right; moodboard's add-FAB + paste-to-add still work one level down; (2) the **"always reaching for"** recurring-brands section shows once ≥3 saves from one brand (`recurringBrands(items, 3)` in `lib/things.ts` — drop to 2 if too strict); (3) the **taste icon** is the media smiley (kept in sync by comment in `BottomNav.tsx`); (4) the **`DecidingCard`** grid lead floats on the gray tile (cutout) after "polish images" — Farah confirmed the once-black sneaker reads on gray.
- **Colour-story ribbon (s77)** — the editorial taste tab's colour ribbon is browser-only and was never eyeballed. Samples real pixels client-side (`src/lib/palette.ts`) and **hides itself below 3 colours**, so the failure mode is a *missing* ribbon — most likely a CORS block on Supabase `mood-images` URLs (tainted canvas → skipped). *If no ribbon: check the bucket sends `access-control-allow-origin`, or sample via the same-origin `/api/thing-image` proxy.* **Background handling (Farah, s80 — shipped, needs eyeball):** the ribbon read too gray because it only dropped near-white/near-black backdrops, not gray; a saturation-floor pass fixed gray but also ate cream/ivory (real taste signal). Final approach in `palette.ts` — **detect the backdrop by sampling the image border** (`borderColor`) and drop pixels matching it, *whatever its colour*, so white/gray/cream/kraft backdrops all go while a cream-or-gray **product** in the centre survives. Full-bleed shots (no clean border, edge variance too high) fall back to the chromatically-neutral drop (`mx - mn < 10`). *Tuning knobs if it's off live: border-spread threshold `36` (raise → trust border more often), backdrop-match tolerance `50` (raise → strip more aggressively), fallback neutral threshold `10`.* Also re-confirm **column-major masonry** order (newest down the left column) is acceptable — if she wants strict chronological back, do JS shortest-column masonry instead of CSS columns.

### Media library polish — for discussion (don't auto-fix)
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
- **Self-defined taste — your own keywords / aspirational taste (Farah, s80)** — today the read is **AI-derived** (it infers your vibe from what you saved). Let the user **define their taste themselves** as an option. Two distinct modes: (a) **descriptive override** — "here's how I'd actually describe my taste" (correct/augment the AI read); (b) **aspirational** — "this is the taste I'm reaching for" (a target, maybe different from what you've saved). **Open design question Farah flagged — what is the feedback loop?** If you declare a target, does it (1) just sit as a stated label, (2) bias recommendations toward the aspiration, (3) get measured against actual saves ("you say minimalist but keep saving maximalist" — a gap mirror), or (4) blend with the AI read into one profile? Each is a different product. *Decide the loop with Farah before building. Relates to the media taste page's existing "the gap" section and the Things thread masthead.*
- **Verdict reshape (parked, Farah s75)** — on the media item sheet, "verdict" gets its own genre/vibe/**verdict** tag-row, but it largely repeats the reaction already shown (`· loved it`). Farah registered it "isn't totally working" but parked it — the reshape isn't settled (drop the redundant row? fold verdict into the reaction? make it carry something the reaction doesn't?). *Trigger: Farah comes back with what she wants verdict to be.* (`ItemActionSheet.tsx`, the genre/vibe/verdict rows ~`:708`.) **Tackle with the music-clutter item — same area.**
- **Taste tab: keep or fold (revisit ~2026-07-14)** — **decided s63: KEEP for now.** The fold case rested on two payoffs that both fell through (freeing a nav slot nothing daily is waiting for; the profile + desert island not belonging together — but Farah likes them equally and the island is too new to judge). The profile is what makes the app feel like a mirror, not a tracker — folding it into Discover risks burying the differentiator. *Trigger: revisit mid-July after real desert-island use. If by then the island reads as a Library thing and the profile as a Discover thing, split them.* **If profile ever moves to Discover:** treat it as a masthead, not a block — vibe words become Discover's headline, one tap opens the full profile as a bottom-sheet.
- *Note: the earlier 3-section stats taste page (medium pills, reaction breakdown, verdict counts, effort axis) was **deliberately removed** in the `216e6ca` redesign. Don't assume those sections still exist; revisit only if a stats section is actively wanted back.*

### Things board polish
- **Image-trim quality** — `src/lib/imageTrim.ts` (client canvas) is off-centre on some products and soft when zoomed. Limits = bbox/centroid heuristic + source resolution + CORS (only trims where a shop allows pixel reads; else plain cover-crop). *If it keeps annoying: move the trim **server-side** — we already fetch product images for vision (bypasses CORS, higher-res), so a `sharp`-based trim there fixes both centering and sharpness.*
- **Beauty + home + misc products on the board (Farah, s75)** — broaden past clothing so a skincare buy, a lamp, a random object can live here. **These probably should NOT count toward the taste read** — the thread + per-item "how this fits" line are tuned to fashion attributes (material/palette/vibe); a serum or kettle would muddy the mirror. Likely shape: let the `category` facet carry the non-fashion kinds, and **exclude non-aesthetic categories from `itemAttributes`/`readThread`/`boardTasteSummary`** (a "things I want" shelf alongside the style board, taste-neutral). Decide the exclusion mechanism (category allowlist? per-item `metadata.countsTowardTaste:false`?) with Farah before building. Free.
- **Compare — full web-search version (parked, Farah-flagged)** — Compare already reads each candidate's own product page (description + JSON-LD `aggregateRating`) on Haiku (~$0.001–0.002/call). The **web-search version** (Reddit/blogs) is parked — Farah may decide it's worth the cost ($0.01–0.05+/compare on the capped key) since she already uses Claude/Gemini this way.
- **Paid product search (Google Shopping / SerpApi)** — v1 search-by-name uses AI-suggest (1 Sonnet call → named guesses + approx price, no live images). Real images/prices need a paid metered API. *Add only if AI-suggest proves too thin.*

### Discovery
- **Discover mood chips (revisit 2026-06-29)** — quick-pick vibe chips above the Discover search box, pre-filling the "in the mood for…" query, sourced from `VIBES` in `lib/moods.ts` + the user's top tags + 1–2 utility chips ("short", "surprise me"). Parked: auto-picked chips felt arbitrary and the search box alone covers the case. *Trigger: one week of real use of the rebuilt Discover.*

### Smaller parked ideas (have a trigger)
- **Want-to priority** — pin/tier system for backlog. Adds clutter to every row; help-me-decide + search cover the acute case. *Trigger: backlog grows genuinely unwieldy.*
- **Regions: language axis (`P364`)** — country filter shipped s63; language deliberately deferred. *Trigger: in real use you reach for "French" and a Dardenne/Québécois film isn't there. Then re-pull `P364` (free, one extra `wikidataFields` query) as a second axis; watch for the variant rollup ("Quebec French" → "French").*
- **Empty-library copy** — "go listen to some music you loser" is a music-only inside joke, jarring on a non-music library. Farah chose to keep it (charm for a 2-person app). *Trigger: Farah decides the joke's run its course.* If revisited: rewrite media-agnostic, keep some warmth. (`LibraryScreen.tsx:899`)
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
