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
- **Restaurants, museums, exhibitions, experiences** — same reaction/note/tag model; new types. Taste profile generalises naturally.
- **Calendar integration** — surface relevant items + suggestions based on where Farah will be. "You'll be in Tokyo in March — 3 things from your want-to list."
- **Master "life index"** — nospaces as curated self-portrait across all domains (media, food, places, events). Not a tracker but a mirror + recommendation engine. Every feature decision: does this make the index richer or the curation sharper?

---

## Shelved — decided against (keep for reference)

Tried or considered and rejected. Documented so they're not re-proposed cold.

- **Individual songs** — albums-only is correct. Songs would bloat the library immediately (hundreds vs ~50 albums). Taste model is more meaningful at album level. "Standout tracks" belongs as a note on the album.
- **Letterboxd diary.csv** — adds per-watch dates + repeat-view counts. Dates are cosmetic; repeat viewings need a schema change (one reaction per item today) + a rewatch UI. Disproportionate scope. *Revisit only if rewatch tracking becomes a native feature.*
- **Bandsintown API** — not applied. Approval odds low for a personal app (they gate for commercial partners). TM covers major shows; indie coverage would be nice but not worth planning around. Apply passively; revisit if approved.
- **Descriptive library search** — built then removed. AI maps natural language to filters but applies all matched dimensions simultaneously → tiny intersections. The filter sheet does the job better.
