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

**Session 79 — bug-fix + Things-board polish pass, all pushed to `main` (latest `9b25ca7`). 93 Vitest green, typecheck + eslint + build clean.** Worked through the s76 polish queue + a fresh image regression. Shipped: **taste sub-tabs de-underlined** (now match media); **capture URL-leak plugged** (media list no longer shows Things forwards); **media filter control → Things' slider icon** (Farah de-scoped the rest of the header redesign — *only* the filter card, no jumpy-header/switcher work); the **deciding-card cutout fix** (the black sneaker — candidates now get cutouts via the "polish images" button, ~1¢/plan; **Farah confirmed it reads on gray**); a **product-sheet restructure** ("taste mirror, not a checkout" — title is the link, got-it demoted to the bottom row + `· got it` status by price, calmer tags, no body button); **per-item hide for the taste read**; and **inline re-read** at the end of AI text. New dev capability: **`nospaces-noauth`** launch config explores the UI without Google login (empty data — layout checks only). Most visual work verified by typecheck + no-auth harness only; the product sheet + taste profile need real data, so they're Farah's eyeball. Full detail → archive (s79).

---

## ▶ Next session (80) — hear Farah's eyeball, then the remaining for-discussion items

**First: hear what Farah found** testing the **s79 product-card restructure** (got-it demoted, calmer tags, title-as-link, per-item hide on the taste read, inline re-read) and the **deciding-card cutout** — all live, none but the sneaker confirmed. She said she'd give feedback this session if any.

Also still pending eyeball from before s79:
- **s78 Things taste restructure** — verify checklist in `docs/ROADMAP.md` → "Things taste restructure — runtime-verify" (sub-tab chips, moodboard add-FAB one level down, recurring-brands threshold, taste icon).
- **s77 colour-story ribbon** (browser-canvas, never seen — likely a `mood-images` CORS block) + the **column-major masonry** order confirm (`docs/ROADMAP.md` → "runtime-verify the colour story").

Then the two remaining **for-discussion** items (`docs/ROADMAP.md` → "Library (media) polish"):
- **scroll-lock stickiness** (don't auto-fix — needs a decision on switcher accessibility);
- **music-library clutter** (pair with the parked media "verdict" reshape — same area, same session).

**Carried:** the two big capture pain points (image-share + paywalled-article extraction — own session); iOS share-to-app Shortcut (email-auto-send path); beauty/home/misc taste-neutral products; empty-library copy (parked, Farah's call).

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
