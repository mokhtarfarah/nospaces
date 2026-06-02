// Letterboxd CSV import helpers.
//
// Letterboxd has no public personal-data API — the only path is the data export
// (Settings → Data → Export Your Data), a ZIP containing CSV files. We parse two:
//   • watchlist.csv  → films you want to watch        (Date, Name, Year, Letterboxd URI)
//   • ratings.csv    → films you watched + rated      (Date, Name, Year, Letterboxd URI, Rating)
//
// Mapping into Nospaces items:
//   watchlist → status 'want_to'
//   ratings   → status 'done' + reaction mapped from the 0.5–5★ rating
// Posters/blurbs are resolved at display time via /api/art, so we only need
// title + year (+ rating) here.

import type { ItemReaction } from './database.types'

export interface ParsedFilm {
  title: string
  year: number | null
  /** ISO timestamp from the CSV's Date column, when present. */
  dateIso: string | null
  /** 0.5–5 in half-steps, only on rated rows. */
  rating: number | null
}

/** A row ready to insert into the `items` table (minus user_id, filled in at save). */
export interface LetterboxdInsert {
  title: string
  type: 'film'
  creator: null
  year: number | null
  status: 'want_to' | 'done'
  reaction: ItemReaction | null
  source: 'manual'
  source_detail: 'letterboxd'
  date_added: string
  date_done: string | null
  metadata: Record<string, unknown>
}

// --- CSV parsing (RFC 4180: quoted fields, escaped quotes, embedded commas/newlines) ---

/** Parse CSV text into rows of string cells. Handles quoted fields with commas/newlines. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false
  // Strip a UTF-8 BOM if present.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text

  for (let i = 0; i < s.length; i++) {
    const c = s[i]
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { cell += '"'; i++ } // escaped quote
        else inQuotes = false
      } else {
        cell += c
      }
    } else if (c === '"') {
      inQuotes = true
    } else if (c === ',') {
      row.push(cell); cell = ''
    } else if (c === '\n' || c === '\r') {
      // Finish the row on newline; swallow \r\n as one break.
      if (c === '\r' && s[i + 1] === '\n') i++
      row.push(cell); cell = ''
      rows.push(row); row = []
    } else {
      cell += c
    }
  }
  // Flush trailing cell/row (file may not end in a newline).
  if (cell !== '' || row.length > 0) { row.push(cell); rows.push(row) }
  // Drop fully-empty rows (e.g. trailing blank line).
  return rows.filter(r => r.some(c => c.trim() !== ''))
}

/** Map a header name to its column index, case-insensitively. */
function columnIndex(header: string[], name: string): number {
  return header.findIndex(h => h.trim().toLowerCase() === name.toLowerCase())
}

function toIso(date: string): string | null {
  const t = date?.trim()
  if (!t) return null
  const d = new Date(t)
  return isNaN(d.getTime()) ? null : d.toISOString()
}

/**
 * Parse a Letterboxd CSV (watchlist or ratings) into films. The presence of a
 * "Rating" column determines whether rows are treated as watched+rated.
 */
export function parseLetterboxdCsv(text: string): ParsedFilm[] {
  const rows = parseCsv(text)
  if (rows.length < 2) return []
  const header = rows[0]
  const iName = columnIndex(header, 'Name')
  const iYear = columnIndex(header, 'Year')
  const iDate = columnIndex(header, 'Date')
  const iRating = columnIndex(header, 'Rating')
  if (iName === -1) return []

  const out: ParsedFilm[] = []
  for (const r of rows.slice(1)) {
    const title = r[iName]?.trim()
    if (!title) continue
    const yearRaw = iYear !== -1 ? parseInt(r[iYear], 10) : NaN
    const ratingRaw = iRating !== -1 ? parseFloat(r[iRating]) : NaN
    out.push({
      title,
      year: isNaN(yearRaw) ? null : yearRaw,
      dateIso: iDate !== -1 ? toIso(r[iDate]) : null,
      rating: isNaN(ratingRaw) ? null : ratingRaw,
    })
  }
  return out
}

/** Map a Letterboxd star rating (0.5–5) to a Nospaces reaction. Half-stars round to nearest whole. */
export function ratingToReaction(rating: number): ItemReaction {
  const r = Math.round(rating)
  if (r >= 5) return 'loved_it'
  if (r >= 4) return 'liked_it'
  if (r >= 3) return 'eh'
  return 'not_for_me'
}

/** Stable dedupe key for a film: lowercased title + year. */
export function filmKey(title: string, year: number | null): string {
  return `${title.trim().toLowerCase()}|${year ?? ''}`
}

export interface BuildResult {
  inserts: LetterboxdInsert[]
  /** Count of parsed films skipped because they already exist in the library. */
  skippedExisting: number
}

/**
 * Combine parsed watchlist + watched + ratings films into insert rows, deduped
 * against each other and against the user's existing film keys.
 *
 * Precedence (highest first): rated (done + reaction) > watched (done, no
 * reaction) > watchlist (want_to).
 */
export function buildInserts(
  watchlist: ParsedFilm[],
  watched: ParsedFilm[],
  ratings: ParsedFilm[],
  existingKeys: Set<string>,
): BuildResult {
  const byKey = new Map<string, LetterboxdInsert>()
  let skippedExisting = 0

  const priority = (status: 'want_to' | 'done', hasRating: boolean) =>
    status === 'done' && hasRating ? 2 : status === 'done' ? 1 : 0

  const add = (f: ParsedFilm, status: 'want_to' | 'done') => {
    const key = filmKey(f.title, f.year)
    if (existingKeys.has(key)) { skippedExisting++; return }
    const existing = byKey.get(key)
    const newPri = priority(status, f.rating != null)
    if (existing) {
      const oldPri = priority(existing.status, existing.reaction != null)
      if (newPri <= oldPri) return
    }
    const now = new Date().toISOString()
    byKey.set(key, {
      title: f.title,
      type: 'film',
      creator: null,
      year: f.year,
      status,
      reaction: status === 'done' && f.rating != null ? ratingToReaction(f.rating) : null,
      source: 'manual',
      source_detail: 'letterboxd',
      date_added: f.dateIso ?? now,
      date_done: status === 'done' ? (f.dateIso ?? now) : null,
      metadata: f.rating != null ? { letterboxdRating: f.rating } : {},
    })
  }

  // Add in ascending priority order so higher-priority entries overwrite lower.
  for (const f of watchlist) add(f, 'want_to')
  for (const f of watched) add(f, 'done')
  for (const f of ratings) add(f, 'done')

  return { inserts: [...byKey.values()], skippedExisting }
}
