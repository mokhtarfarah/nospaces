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

**Session 78 — Things taste page RESTRUCTURED + cross-domain consistency, committed + pushed to `main` (`9ee86e4`). 93 Vitest green, typecheck + eslint + build clean. NOTHING runtime-verified — board behind Google login.** Things is now **two bottom tabs** (`wishlist · taste`), and **taste splits into sub-tabs `profile · moodboard`** — mirroring media's taste = profile · desert island (the old 3rd "mood" tab is gone, moodboard moved under taste). Also shipped: the **`DecidingCard` grid revert** (picture-cover in grid, text-box in list — closes the s76 item); **"always reaching for"** recurring-brands on the taste profile (`recurringBrands(items, 3)` in `lib/things.ts`, mirrors media "always loved"); and the **taste icon now matches media** (smiley, kept in sync by comment with `BottomNav.tsx`). Product recommendations stay **parked** (no trustworthy non-sponsored/non-hallucinated source). Full detail → archive (s78).

---

## ▶ Next session (79) — hear Farah's eyeball, then Library polish

**s78 is committed + pushed (`9ee86e4`).** Hear what she found testing the **restructured Things taste page** live — full verify checklist in `docs/ROADMAP.md` → "Things taste restructure — runtime-verify" (sub-tab chips, moodboard add-FAB one level down, recurring-brands threshold, taste icon, deciding grid card). Still also open from s77: the **colour-story ribbon** (browser-canvas, never seen — likely a `mood-images` CORS block) + the **column-major masonry** order confirm (`docs/ROADMAP.md` → "runtime-verify the colour story").

Then the queued **Library polish session** (`docs/ROADMAP.md`):
- **Things:** product-sheet link rework (hyperlink the title, make tags less obtrusive — one calm hierarchy).
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
