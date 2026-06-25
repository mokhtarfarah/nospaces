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

**Session 80 — eyeball backlog cleared (colour-story, mood masonry, product sheet), pushed to `main` (latest `c082329`). 93 Vitest green, typecheck + eslint + build clean.** Farah tested the s77–s79 shipped work live and reported; 2 fixes shipped. **Colour-story background fix confirmed live** (`palette.ts` — detect backdrop by image border, drop it whatever its colour; balanced cream, no warm-skew). **s78 taste restructure + s79 deciding-card cutout: both confirmed good.** Fixed: **"show taste read" button smash** (was inline-block, flush against "+ add a note" → `display:block`); **mood masonry rebuilt as JS shortest-column masonry** — Farah wanted newest-first across rows *and* gapless, which CSS can't do, so we lay columns out in JS (`MoodWall`, `ThingsScreen.tsx:1882`). Product card "fine for now," she'll use it and report. The mood-masonry rebuild is *not* yet eyeballed live (caveat: tiles can shift columns as images stream in, settling after first view). Full detail → archive (s80).

---

## ▶ Next session (81) — holistic look at the whole app

**Farah wants to step back from the polish queue and do a holistic pass over the app** — judge it as a first-time user with great taste, end to end (media + Things), not item-by-item. Flag anything that reads like a debug label, a dead end, an inside joke, or just doesn't earn its place. **This is a fresh chat — start by asking Farah how she wants to run it** (her walking the screens and narrating? you reading code + her screenshots? a screen-by-screen checklist she reacts to?) rather than diving in blind.

**Seeing the app — the constraint:** the whole thing is **behind Google login**, so you can't browse it yourself. The `nospaces-noauth` harness (port 5180) only renders empty layout — useful for structure/render-safety, useless for anything data-driven (the taste reads, filled boards, the product sheet). So a real holistic pass leans on **Farah's eyes + screenshots**, with you reading the source to back it up. Don't claim a screen "looks fine" you haven't actually seen.

**One thing to eyeball-confirm first** (shipped s80, behind login): the **mood wall** — gapless + newest spreading across the top, and whether the column-shuffle as images load is distracting (if so: store image dims at save time).

The two **for-discussion** items are still parked, pick up if the holistic pass surfaces them (`docs/ROADMAP.md` → "Media library polish"):
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
