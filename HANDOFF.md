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

**Session 95 — "about this" wiki-link fix + editable/backdate "added" date.** All free, shipped on `main`, 98 Vitest green + typecheck + lint clean, no API calls (only the free Wikipedia API). (1) **"about this" ignored a corrected wiki link** — the read sheet resolved the blurb/cover by *searching Wikipedia by title*, never using the saved URL, so Farah's hand-corrected P&P link had no effect (title search just re-found the wrong *P&P & Zombies* article). Now a pinned `metadata.wikiUrl` is the source of truth (new `useWikiByUrl` fetches summary+thumb from that exact article; title search is the fallback only when no URL is pinned). (2) **Editable "added" date (backdating)** — month(optional)+year field in edit → *more details* → *added*, so a book read years ago sinks out of "recent". Solved the `markDone`→`date_done`→`recencyDate` trap by flagging `metadata.dateAddedManual` (recency now honours it even for done items); month-optional stores year-precision + groups under a plain "2019" header. **Not yet re-verified on Farah's device** (local no-auth library is empty). (3) **Series stacking discussed → PARKED** (soul-conflict: hides per-item verdicts + adds a mode; not biting yet). Full detail → archive (s95). *(Prior: s94 — five item-sheet fixes; s93 — verdict reshape + diamonds→stars.)*

## ▶ Next session (96) — start with the music-library decision

**First thing: re-look at the music-library "iPod collection" reframe** (`docs/ROADMAP.md` → "Media library polish"). Farah confirmed the direction "generally" but **isn't 100% — she wants to look again before any build.** The core idea: the music clutter is **want-to bleeding into the collection**; split *collection (the iPod, done — browse by artist, naturally curated)* from *queue (want-to)* by default. Sub-asks already locked: verdict "shelves" = one added view *inside* the collection (not default); by-artist view sortable by **# of albums saved**. Open layout step: *how* the queue sits beside the collection (leaning: a `to listen · N` chip atop music) + whether it generalizes past music. Confirm the framing with her, then it's a free frontend build.

**Still open — `★ desert island` read-sheet placement (untouched s94).** The line sits flush-left and breaks the genre/vibe/verdict label-column grid (see `docs/ROADMAP.md`, "Desert-island read-sheet placement"). A quick frontend tweak whenever — and note the s94 "thoughts" block just moved to the *quiet 10px muted label* style, so match the desert-island line to that same label family when you place it.

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
