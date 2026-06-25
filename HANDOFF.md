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

**Session 76 — Mood board SHIPPED + a full feedback round, all deployed to `main`. 90 Vitest green, typecheck + eslint + build clean. NOT runtime-verified beyond Farah's live eyeballing (board behind Google login). The `mood-images` Supabase bucket has been created (Farah ran the SQL).** The mood board is the pure-inspiration half of Things: new `metadata.kind: 'inspiration'` (`lib/things.ts`), images in the `mood-images` bucket (`lib/mood.ts`) or proxied pasted URLs, each given **one ~1¢ vision read** (palette/material/vibe, no cutout) so the mood board **feeds the same taste thread** as the wishlist — `boardTasteSummary`/`readThread` read across BOTH (`tasteItems = things + moods`). **Feedback round shipped:** a `wishlist | mood` **bottom nav** (mirrors the media nav; replaces the top toggle; FAB lifted above it); keywords/thread now show on the **mood tab only** (like media keywords on Taste); **multi-select upload** + FAB-straight-to-photo-picker on mobile + a soft "paste a link" secondary + desktop clipboard-paste; **row-by-row chronological** grid (newest first, aspect preserved, never cropped, sharp 4px gaps); note removed from mood images. Library duplicate-finder now skips `type:'thing'`. s75 eyeball feedback + mood-board followups all logged in `docs/ROADMAP.md`. Full detail → archive (s76).

---

## ▶ Next session (77) — BUILD: Taste synthesis for Things

The mood board is done + deployed (Farah's been eyeballing live). Open straight on the next build:

**Taste synthesis for Things** — a 1–2 sentence "what you're reflecting," shown like the media Taste page's vibe headline. **Combo of saved items + mood board, but works from saved alone too.** One cheap on-demand Haiku call (text-only, cached, **never auto-run**); must import `HUMANIZER_GUARDRAILS`. **Seed = `boardTasteSummary(tasteItems)`** — already reads wishlist + mood together. Match the per-item "how this fits" voice (`api/things-taste-fit.ts`). See memory `things-taste-synthesis`.
- **When building, fix the vibe/tone skew (Farah s76):** the read must narrate *aesthetic register* (warm / refined / lived-in) over a pile of literal materials ("wood", "velvet"). Bias the prompt that way.
- **Decide the open IA question with Farah:** does **taste** become a 3rd bottom-nav tab (wishlist | mood | taste, mirroring media) or **fold into the mood page**? She's leaning on "depends how minimal the synthesis is." The bottom nav currently has 2 tabs waiting for this answer.

**Other open Things work** (`docs/ROADMAP.md`): the s76 polish session (deciding-card grid revert, product-sheet link rework, 7 Library tweaks — two for-discussion: scroll-lock, music clutter); mood-board followups (offset masonry); carried s75 eyeball items.

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
