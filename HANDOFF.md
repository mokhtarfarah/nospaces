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

**Session 76 — Mood board SHIPPED (the pure-inspiration half of Things). On `main`, NOT yet deployed; 90 Vitest green, typecheck + eslint + build clean. NOT runtime-verified (board behind Google login) AND blocked on a one-time Supabase step (see ⚠️ below).** A `wishlist | mood` toggle at the top of Things (`tab` state, persisted) flips between the buyable board and a masonry wall of inspiration images. New `metadata.kind: 'inspiration'` (in `lib/things.ts`); capture = upload a file / paste a copied image / paste an image link (no email — would clash with a future product-screenshot router); stored in a new `mood-images` Supabase bucket via `lib/mood.ts` (uploads) or kept as a proxied URL (pastes). Each image gets **one ~1¢ vision read** (palette/material/vibe, no cutout) so the mood board **feeds the same taste thread** as the wishlist — `boardTasteSummary`/`readThread` now read across BOTH (`tasteItems = things + moods`). Also fixed: the library duplicate-finder now skips `type:'thing'` (mood images all share the title "inspiration"). Session 75's eyeball-checklist feedback (deciding-card grid revert, product-sheet link rework, + 7 Library/Things tweaks) is logged in `docs/ROADMAP.md` → "Library + Things polish, s76" for a separate polish session. Full detail → archive (s76).

> **⚠️ ONE-TIME before mood uploads work live:** run the `mood-images` bucket block at the bottom of `supabase/schema.sql` in Supabase (bucket + RLS). Until then file uploads fail (pasted image *links* still work). Mirror of the s74 `thing-cutouts` step.

---

## ▶ Next session (77)

**FIRST — two things to do/eyeball (s76 mood board couldn't be driven live here — login wall):**

1. **Run the `mood-images` SQL** (the ⚠️ above) in Supabase, then **deploy**. Until the bucket exists, mood-image *uploads* fail (pasted links still save).
2. **Eyeball the mood board** once deployed: the `wishlist | mood` toggle; add an image three ways (upload / paste a copied image / paste a link); confirm it tiles as a masonry wall, opens a detail sheet, and that a couple of saved images push fresh keywords into the thread masthead (mood feeds the same read). Watch the ~1¢-per-image vision toast fires once and caches.
3. **Carried eyeball from s75** (still un-checked live): taste-fit re-read voice; deciding-card grid; list view; product-sheet links; pinned Library switcher.

**Then build:**
- **Taste synthesis for Things** — a 1–2 sentence "what you're reflecting." **Combo of saved items + mood board, but works from saved alone too.** One cheap on-demand Haiku call (cached, never auto-run); mirrors the media Taste page; must import `HUMANIZER_GUARDRAILS`. Seed = `boardTasteSummary()` (now reads wishlist + mood). See memory `things-taste-synthesis`.
- **The s76 polish session** (`docs/ROADMAP.md` → "Library + Things polish, s76"): deciding-card grid revert, product-sheet link rework, + 7 Library tweaks (two flagged for discussion: scroll-lock stickiness, music-library clutter).

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
