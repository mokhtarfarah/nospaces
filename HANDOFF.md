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

Personal PWA taste library for Farah + Tom (films, books, music, TV) **+ a Things side** (shopping / wishlist). Live at https://nospaces.vercel.app. Phases 1–4 done; **Phase 5 (discovery + taste) in progress.** Things is the active workstream.

**Session 90 — cohered the Things editorial polish onto the media item sheet.** All shipped on `main`, 98 Vitest green + typecheck + lint clean, no new API calls. The media `ItemActionSheet` now reads like the s89 product card: a **⋯ admin menu** over the hero holds edit/own/status/flip/**delete** (with confirm), clearing the read view of clutter and the loud red delete button; the footer drops to **one warm left-aligned reaction row** (`Option A` — `your reaction · liked it … edit →` when done, `mark as done →` CTA when not); the link row is **outward links only** (about/via · spotify · wiki · watch); the **note** gets the Things divider chrome; **genre/vibe/verdict tags are tappable → filter the library** to that medium+tag (gated `count>1`). Plus an aesthetic critique pass: **ghost-wash** diffused (`blur 16px, opacity 0.40` — no hotspot), **meta line** trimmed to identity (reaction dropped), **hero** title block centred against the poster + tighter gap. `SheetHero` gained an optional `menuButton` slot (Discover unaffected). Verified by **isolated repros** (no-auth preview has no data; the add path costs an AI call). Tags left **labelled** (Farah's call). Footer **Option B parked** to revisit → `docs/ROADMAP.md`. Full detail → archive (s90). *(Prior: s89 — editorial product-card redesign; s88 — media-add sheet + style profile.)*

## ▶ Next session (91) — no fixed queue

**Quick phone check (carried from s90):** on a real media item — does the **⋯ menu** feel right (edit/own/status/delete), does tapping a **vibe/genre/verdict** filter the library to that medium+tag, and does the new **reaction footer** (Option A) read calm (and the **ghost-wash** look even, not blotchy, on a saturated poster)? If the footer still reads too "app-y", Option B (quiet link) is mocked + parked in `docs/ROADMAP.md`.

**Also still worth a check:** the s89 **pull-from-link fix** — screenshot a product, add a link, edit → does "pull photo & price" now appear and **swap the screenshot for the clean shop photo**? (Only fires on *newly* screenshot-saved products — the `imageFromShot` flag isn't backfilled onto older ones.)

**⛔ Email-in testing still PARKED.** Postmark hit its 100/mo free cap AND won't let Farah buy the 10k plan until they **approve the account** (same approval that gates talkback). So the *email* screenshot path + the email-driven `for review · N` inbox wait for approval (Farah pays for 10k then). Don't propose emailing screenshots until then. Detail → `docs/REFERENCE.md` → Postmark plan.

**Open question carried over:** "find online ↗" lives on the product *sheet*, not the card tiles — open whether Farah wants it on the tiles too (`docs/ROADMAP.md`).

No fixed queue. The big remaining taste item is gated on a decision with Farah:
- **"What feeds the taste read"** — the consolidated design decision (self-defined taste + Things-taste reframe + beauty/home exclusion + a "got it"→worth-it signal). **Gated:** decide the feedback loop *with Farah first*, honouring the "saving is the signal" soul rule. No code until decided.

Ungated alternatives if she's not ready to decide the above: the **user-guide overhaul** (stale + media-only — split into media/things tabs, refresh screenshots; own session, free); the **capture pain points** (iOS share-shortcut email path, image-share, paywalled-article extraction — own session, mostly free); or the **scraper-403 fingerprint** real-world check (does a previously-403 shop read now?).

**Newly unblocked (in `docs/ROADMAP.md` → "Media library polish"):** the **"all" de-confusion** — hide per-medium tag filters when category is "all" + default "all" to recency (decided s85, just needs a session); and **filter tag-search** (idea 3, *after* the s85 counts land if `show all` lists still feel long). **For-discussion (parked, same section):** scroll-lock stickiness (recheck after the s85 nav merge); music-library clutter (pair with the verdict reshape).

**Things model facts:** all on `Item`; `type:'thing'`; `metadata.kind` = `product`|`intent`|`inspiration` (mood-board image); `metadata.attributes[]` (`{facet,value}`) is the composition engine; a promoted plan keeps `metadata.fromPlan` (reversible via `demoteProductToIntent`); resolve = `done` + winner flag, **no archive** (losers persist). The taste read runs over wishlist + mood together (`tasteItems`).

**Don't touch (genuinely good):** decade grouping; the taste page's vibe-headline → prose → gap → always-loved → desert-island arc; the editorial palette; the faithful-creators logic; **the recommendation engine itself.** (All re-confirmed in the s81 review.)

Backlog beyond this → `docs/ROADMAP.md`.

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
