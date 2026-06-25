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

**Session 77 — Taste synthesis SHIPPED as the editorial taste tab, + two feedback rounds + a mood auto-tag fix, all deployed to `main`. 90 Vitest green, typecheck + eslint + build clean. NOT runtime-verified beyond Farah's live eyeballing (board behind Google login) — the colour ribbon especially is unseen.** Things now has a 3rd bottom-nav tab (`wishlist · mood · taste`). The **taste tab** reads the whole board (wishlist + mood) back as one aesthetic, editorial-spread style: keywords as a small-caps **kicker**, the AI synthesis as the **hero pull-quote** (one ~$0.001 on-demand Haiku call, cached in `user_prefs`, never auto-runs — `api/things-taste.ts`, imports `HUMANIZER_GUARDRAILS`, prompt biased to aesthetic register + hardened against AI "tidy closer" tics), and a **colour story** ribbon of real hues **sampled from the board's images** client-side (`src/lib/palette.ts`). The earlier frequency-count chips + a taste→wishlist filter jump were **dropped** (Farah: confusing). **Mood board fixes:** the wall is now **CSS-columns masonry** (gapless/Pinterest — trade: column-major order, flagged for confirm); and mood images now **auto-tag reliably** — batch uploads were firing vision reads in parallel and silently rate-limit-failing (the "only 11 tagged" leak), now sequential + a one-tap **"read taste for N untagged" backfill** on the mood tab. Full detail → archive (s77).

---

## ▶ Next session (78) — first, hear Farah's s77 eyeball; then the Things/Library polish session

Open by checking what Farah found testing the s77 taste tab live. **One thing genuinely needs runtime confirmation:** the **colour-story ribbon** is browser-canvas only and was never seen — its failure mode is a *missing* ribbon (most likely a Supabase `mood-images` CORS block; fix = bucket CORS header, or sample via the same-origin `/api/thing-image` proxy). Also confirm the **column-major masonry** order is acceptable (it reversed the s76 chronological choice). Both detailed in `docs/ROADMAP.md` → "Taste tab — runtime-verify the colour story".

Then the queued **Things + Library polish session** (`docs/ROADMAP.md`):
- **Things:** `DecidingCard` should revert to picture-cover in **grid** view (text-box only in list); product-sheet link rework (hyperlink the title, make tags less obtrusive — one calm hierarchy).
- **Library (media):** failed-capture list leaks product URLs (filter to media-domain only); jumpy header on add (apply the Things fix); filter-icon consistency; list/grid switcher off the header line; **two for-discussion** — scroll-lock stickiness + music-library clutter (pair the latter with the parked media "verdict" reshape).

**Carried:** the two big capture pain points (image-share + paywalled-article extraction — own session); iOS share-to-app Shortcut (email-auto-send path); beauty/home/misc taste-neutral products.

**Carried (still open):**
- Scraper-403 fingerprint wants a real-world check (does a previously-403 shop read now?).
- New parked items in `docs/ROADMAP.md`: beauty/home/misc products (taste-neutral), the iOS share-to-app Shortcut (email-auto-send path), the media "verdict" reshape.
- **Things model facts:** all on `Item`; `type:'thing'`; `metadata.kind` = `product`|`intent`|`inspiration` (mood-board image, s76); `metadata.attributes[]` (`{facet,value}`) is the composition engine; a promoted plan keeps `metadata.fromPlan` (reversible via `demoteProductToIntent`); resolve = `done` + winner flag, **no archive** (losers persist). The taste read runs over wishlist + mood together (`tasteItems`).

**Don't touch (genuinely good):** decade grouping; the taste page's vibe-headline → prose → gap → always-loved → desert-island arc; the editorial palette; the faithful-creators logic; **the recommendation engine itself.**

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
