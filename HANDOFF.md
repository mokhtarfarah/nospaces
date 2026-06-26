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

**Session 85 — library header + filter card overhaul, recency fix, one-line bottom nav, all on `main`. 93 Vitest green + typecheck clean on every push; eyeballed in the noauth preview.** Another long iterative phone-screenshot session (all frontend, free). Landed: **library header → one nav line** (`music films books tv all │ status ▾` + the filter slider; status is a dropdown with reactions gated under "done"; collapsed = pure one line, search/`⋯` revealed on scroll-up). **Filter card overhaul** — soft segmented `list / grid 3 / grid 4` (columns row gone), fixed type hierarchy (headers outrank rows), sort as a right-aligned chip row, group reorder `genre·vibe·verdict·series·region`, dividers removed, clear → `N match · clear` on the FILTER line (no auto-close), and the headline change: an **active-filters tray** (selected tags across all axes as removable chips, not duplicated in groups) + **counted, ranked tags** (count per tag, top 8 + `show all N`). **Recency fix:** "recent" now sorts by *last meaningful moment* (done-date if done, else add-date) via a shared `recencyDate()` that also drives month grouping — a freshly-finished old item rises AND files under this month. **Bottom nav → one editorial bar:** `media / things` (bold, left) · sections slash-split (smaller, right), no icons; `layout.ts` is one row now (`NAV_H=46`, no `SWITCHER_H`); orphaned `navIcons.tsx` deleted. Things got parity throughout. Full detail → archive (s85). **"all" tab:** discussed, KEPT (only home for cross-category recency); de-confusion deferred → roadmap.

---

## ▶ Next session (86) — open: pick from the roadmap

**First: eyeball s85 on a real phone (preview was empty, so the new filter logic is unverified):** the **active-filters tray** + tag **counts/ranking/`show all`** + the `N match` count; the **recency re-sort** (an item you added long ago but recently marked done should rise to the top under this month's header); and the **merged bottom bar** not crowding the FAB on a populated screen. Also still open from s84: the Things `full`-caption trim (keep the taste/material line or strip to name+price+brand?). After that:

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
