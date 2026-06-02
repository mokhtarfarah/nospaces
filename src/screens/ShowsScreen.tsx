import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useItems } from '../hooks/useItems'
import { usePrefs } from '../hooks/usePrefs'
import {
  likedArtists, lovedArtistKeys, fetchAllShows, milesBetween, geocodeCity,
  RADIUS_OPTIONS,
  type Show, type City,
} from '../lib/shows'

type Origin = { name: string; lat: number; lng: number } | null
type Mode = 'near' | 'all'

export function ShowsScreen() {
  const { items, loading: itemsLoading } = useItems()
  const { cities, setCities } = usePrefs()
  const navigate = useNavigate()

  const artists = useMemo(() => likedArtists(items), [items])
  const lovedKeys = useMemo(() => lovedArtistKeys(items), [items])

  const [mode, setMode] = useState<Mode>('near')
  const [shows, setShows] = useState<Show[]>([])
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [scanning, setScanning] = useState(false)
  // near-me controls
  const [origin, setOrigin] = useState<Origin>(null)
  const [radius, setRadius] = useState<number | null>(100) // miles
  const [locating, setLocating] = useState(false)
  const [locError, setLocError] = useState('')
  // editing the saved city list
  const [editCities, setEditCities] = useState(false)
  const [newCity, setNewCity] = useState('')
  const [addingCity, setAddingCity] = useState(false)
  const [cityError, setCityError] = useState('')
  // all-tours controls
  const [lovedOnly, setLovedOnly] = useState(false)
  const [place, setPlace] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set()) // artists shown open on "all tours"
  const ran = useRef(false)

  function toggleArtist(artist: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(artist) ? next.delete(artist) : next.add(artist)
      return next
    })
  }

  // Kick off the scan once items have loaded and we have artists to look up.
  useEffect(() => {
    if (ran.current || itemsLoading) return
    if (artists.length === 0) return
    ran.current = true
    setScanning(true)
    setProgress({ done: 0, total: artists.length })
    const acc: Show[] = []
    const seen = new Set<string>()
    fetchAllShows(artists, (done, total, batch) => {
      for (const s of batch) {
        if (s.datetime && !seen.has(s.id)) { seen.add(s.id); acc.push(s) }
      }
      setProgress({ done, total })
      setShows([...acc])
    }).finally(() => setScanning(false))
  }, [artists, itemsLoading])

  function useMyLocation() {
    setLocError('')
    if (!('geolocation' in navigator)) { setLocError('location isn’t available on this device'); return }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setOrigin({ name: 'your location', lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocating(false)
      },
      () => { setLocError('couldn’t get your location — pick a city instead'); setLocating(false) },
      { timeout: 10000 },
    )
  }

  function pickCity(c: City) {
    setLocError('')
    setOrigin({ name: c.name, lat: c.lat, lng: c.lng })
  }

  async function addCity() {
    const q = newCity.trim()
    if (!q || addingCity) return
    setCityError('')
    if (cities.some(c => c.name.toLowerCase() === q.toLowerCase())) { setNewCity(''); return }
    setAddingCity(true)
    const found = await geocodeCity(q)
    setAddingCity(false)
    if (!found) { setCityError(`couldn’t find “${q}” — try a city name`); return }
    if (cities.some(c => c.name.toLowerCase() === found.name.toLowerCase())) { setNewCity(''); return }
    setCities([...cities, found])
    setNewCity('')
  }

  function removeCity(c: City) {
    setCities(cities.filter(x => x.name !== c.name))
    if (origin?.name === c.name) setOrigin(null)
  }

  // Upcoming-only base list (drop anything in the past), shared by both modes.
  const upcoming = useMemo(() => {
    const cutoff = Date.now() - 86_400_000 // include today
    return shows.filter(s => {
      const t = new Date(s.datetime).getTime()
      return Number.isFinite(t) && t >= cutoff
    })
  }, [shows])

  // ---- near-me view: distance filter + sort by date, grouped by month ----
  const nearGrouped = useMemo(() => {
    let list = upcoming
    if (origin && radius != null) {
      list = list.filter(s => s.lat != null && s.lng != null
        && milesBetween(origin.lat, origin.lng, s.lat, s.lng) <= radius)
    }
    list = [...list].sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime())
    const m = new Map<string, Show[]>()
    for (const s of list) {
      const key = new Date(s.datetime).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
      if (!m.has(key)) m.set(key, [])
      m.get(key)!.push(s)
    }
    return m
  }, [upcoming, origin, radius])

  // ---- all-tours view: grouped by artist, loved bands first ----
  const byArtist = useMemo(() => {
    const q = place.trim().toLowerCase()
    let list = upcoming
    if (q) list = list.filter(s => s.city.toLowerCase().includes(q))
    if (lovedOnly) list = list.filter(s => lovedKeys.has(s.artist.toLowerCase()))

    const groups = new Map<string, Show[]>()
    for (const s of list) {
      if (!groups.has(s.artist)) groups.set(s.artist, [])
      groups.get(s.artist)!.push(s)
    }
    return [...groups.entries()]
      .map(([artist, ss]) => ({
        artist,
        loved: lovedKeys.has(artist.toLowerCase()),
        shows: ss.sort((a, b) => new Date(a.datetime).getTime() - new Date(b.datetime).getTime()),
      }))
      // loved first, then by who plays soonest, then alphabetical
      .sort((a, b) =>
        Number(b.loved) - Number(a.loved)
        || new Date(a.shows[0].datetime).getTime() - new Date(b.shows[0].datetime).getTime()
        || a.artist.localeCompare(b.artist))
  }, [upcoming, place, lovedOnly, lovedKeys])

  return (
    <div style={{ padding: '56px 16px 96px', background: '#fff', minHeight: '100dvh' }}>
      <button
        onClick={() => navigate('/library')}
        style={{ border: 'none', background: 'none', color: '#999', fontSize: 13, padding: 0, marginBottom: 16, cursor: 'pointer' }}
      >
        ← back
      </button>

      <h1 style={{ fontSize: 22, fontWeight: 600, margin: '0 0 6px', letterSpacing: '-0.2px' }}>
        shows
      </h1>
      <p style={{ fontSize: 14, color: '#777', lineHeight: 1.5, margin: '0 0 16px' }}>
        upcoming tour dates for the {artists.length} artist{artists.length === 1 ? '' : 's'} you’ve
        liked or loved.
      </p>

      {/* Mode tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        <Tab label="near me" active={mode === 'near'} onClick={() => setMode('near')} />
        <Tab label="all tours" active={mode === 'all'} onClick={() => setMode('all')} />
      </div>

      {mode === 'near' ? (
        <div style={{ border: '1px solid #EEE', borderRadius: 14, padding: 14, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: 13, color: '#555' }}>
              {origin ? <>showing near <b>{origin.name}</b></> : 'where are you?'}
            </span>
            <button
              onClick={useMyLocation}
              disabled={locating}
              style={{ flexShrink: 0, padding: '6px 12px', borderRadius: 16, border: '1px solid #111', background: '#111', color: '#fff', fontSize: 12, fontWeight: 500, cursor: locating ? 'default' : 'pointer' }}
            >
              {locating ? 'locating…' : '📍 use my location'}
            </button>
          </div>
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {cities.map(c => (
                editCities ? (
                  <button
                    key={c.name}
                    onClick={() => removeCity(c)}
                    style={{ padding: '5px 11px', borderRadius: 16, fontSize: 12, cursor: 'pointer', border: '1px solid #E0B4B4', background: '#FCF3F3', color: '#B0392B' }}
                  >
                    {c.name.toLowerCase()} ✕
                  </button>
                ) : (
                  <Chip key={c.name} label={c.name.toLowerCase()} active={origin?.name === c.name} onClick={() => pickCity(c)} />
                )
              ))}
              <button
                onClick={() => { setEditCities(v => !v); setCityError(''); setNewCity('') }}
                style={{ border: 'none', background: 'none', color: '#999', fontSize: 12, cursor: 'pointer', padding: '5px 4px', textDecoration: 'underline', textUnderlineOffset: 2 }}
              >
                {editCities ? 'done' : 'edit'}
              </button>
            </div>
            {editCities && (
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <input
                  value={newCity}
                  onChange={e => setNewCity(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addCity() }}
                  placeholder="add a city — e.g. barcelona"
                  style={{ flex: 1, minWidth: 0, padding: '8px 10px', border: '1px solid #ddd', borderRadius: 10, fontSize: 13, outline: 'none' }}
                />
                <button
                  onClick={addCity}
                  disabled={addingCity || !newCity.trim()}
                  style={{ flexShrink: 0, padding: '8px 14px', borderRadius: 10, border: 'none', background: addingCity || !newCity.trim() ? '#E2E2E2' : '#111', color: '#fff', fontSize: 13, fontWeight: 600, cursor: addingCity || !newCity.trim() ? 'default' : 'pointer' }}
                >
                  {addingCity ? 'adding…' : 'add'}
                </button>
              </div>
            )}
            {cityError && <p style={{ color: '#C0392B', fontSize: 12, margin: '8px 0 0' }}>{cityError}</p>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#AAA', marginRight: 2 }}>within</span>
            {RADIUS_OPTIONS.map(r => (
              <Chip key={r.label} label={r.label} active={radius === r.miles} onClick={() => setRadius(r.miles)} />
            ))}
          </div>
          {locError && <p style={{ color: '#C0392B', fontSize: 12, margin: '10px 0 0' }}>{locError}</p>}
        </div>
      ) : (
        <div style={{ marginBottom: 16 }}>
          <input
            value={place}
            onChange={e => setPlace(e.target.value)}
            placeholder="filter by place (optional) — e.g. spain, japan, berlin"
            style={{ width: '100%', boxSizing: 'border-box', padding: '10px 12px', border: '1px solid #ddd', borderRadius: 10, fontSize: 14, outline: 'none', marginBottom: 10 }}
          />
          <Chip label="♥ loved only" active={lovedOnly} onClick={() => setLovedOnly(v => !v)} />
        </div>
      )}

      {/* Scan progress */}
      {scanning && (
        <p style={{ fontSize: 13, color: '#999', margin: '0 0 14px' }}>
          checking tour dates… {progress.done}/{progress.total}
        </p>
      )}

      {/* Results */}
      {itemsLoading ? null : artists.length === 0 ? (
        <Empty text="like or love some music first — then their tour dates show up here." />
      ) : mode === 'near' ? (
        nearGrouped.size === 0 && !scanning ? (
          <Empty text={origin
            ? `no upcoming shows within ${RADIUS_OPTIONS.find(r => r.miles === radius)?.label ?? 'range'} of ${origin.name}. try “all tours” to see everywhere.`
            : 'set your location above, or switch to “all tours” to browse everywhere.'} />
        ) : (
          Array.from(nearGrouped.entries()).map(([month, monthShows]) => (
            <div key={month}>
              <SectionLabel text={month} />
              {monthShows.map(s => <ShowRow key={s.id} show={s} origin={origin} />)}
            </div>
          ))
        )
      ) : (
        byArtist.length === 0 && !scanning ? (
          <Empty text={place.trim()
            ? `none of your artists have shows matching “${place.trim()}”.`
            : lovedOnly ? 'no upcoming shows for your loved artists right now.' : 'no upcoming shows found for your artists.'} />
        ) : (
          byArtist.map(({ artist, loved, shows }) => {
            const open = expanded.has(artist)
            return (
              <div key={artist} style={{ marginBottom: open ? 18 : 0 }}>
                <button
                  onClick={() => toggleArtist(artist)}
                  style={{ display: 'flex', alignItems: 'baseline', gap: 8, width: '100%', textAlign: 'left', padding: '12px 0 10px', borderBottom: '1px solid #EEE', background: 'none', border: 'none', borderBottomStyle: 'solid', cursor: 'pointer' }}
                >
                  <span style={{ fontSize: 11, color: '#BBB', alignSelf: 'center', width: 10, flexShrink: 0 }}>{open ? '▾' : '▸'}</span>
                  <span style={{ fontSize: 16, fontWeight: 700, color: '#111' }}>{loved && <span style={{ color: '#111' }}>♥ </span>}{artist}</span>
                  <span style={{ fontSize: 12, color: '#AAA', marginLeft: 'auto', alignSelf: 'center' }}>{shows.length} date{shows.length === 1 ? '' : 's'}</span>
                </button>
                {open && shows.map(s => <ShowRow key={s.id} show={s} origin={null} showDate />)}
              </div>
            )
          })
        )
      )}
    </div>
  )
}

function ShowRow({ show, origin, showDate }: { show: Show; origin: Origin; showDate?: boolean }) {
  const d = new Date(show.datetime)
  // near-me rows show weekday+day (month is the section header); by-artist rows
  // show the full date since they're not grouped by month.
  const label = showDate
    ? d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
  const dist = origin && show.lat != null && show.lng != null
    ? Math.round(milesBetween(origin.lat, origin.lng, show.lat, show.lng))
    : null

  const body = (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid #F2F2F2', alignItems: 'baseline' }}>
      <div style={{ width: showDate ? 92 : 52, flexShrink: 0, fontSize: 12, color: '#999', lineHeight: 1.3 }}>{label}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {!showDate && <div style={{ fontSize: 15, fontWeight: 600, color: '#111' }}>{show.artist}</div>}
        <div style={{ fontSize: showDate ? 14 : 13, color: showDate ? '#444' : '#777', marginTop: showDate ? 0 : 1 }}>
          {[show.venue, show.city].filter(Boolean).join(' · ')}
          {dist != null && <span style={{ color: '#AAA' }}>  ·  {dist} mi</span>}
        </div>
      </div>
      {show.url && <span style={{ flexShrink: 0, fontSize: 12, color: '#111', alignSelf: 'center' }}>tickets ↗</span>}
    </div>
  )

  return show.url
    ? <a href={show.url} target="_blank" rel="noreferrer" style={{ textDecoration: 'none', display: 'block' }}>{body}</a>
    : body
}

function Tab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 16px', borderRadius: 18, fontSize: 13, cursor: 'pointer',
        border: `1px solid ${active ? '#111' : '#DDD'}`,
        background: active ? '#111' : '#fff',
        color: active ? '#fff' : '#555', fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

function Chip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '5px 11px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
        border: `1px solid ${active ? '#111' : '#DDD'}`,
        background: active ? '#111' : '#fff',
        color: active ? '#fff' : '#555', fontWeight: active ? 600 : 400,
      }}
    >
      {label}
    </button>
  )
}

function SectionLabel({ text }: { text: string }) {
  return (
    <div style={{ padding: '18px 0 8px', fontSize: 11, fontWeight: 600, color: '#AEAEAE', letterSpacing: '0.9px', textTransform: 'uppercase' }}>
      {text}
    </div>
  )
}

function Empty({ text }: { text: string }) {
  return <p style={{ fontSize: 14, color: '#999', lineHeight: 1.5, textAlign: 'center', padding: '32px 16px' }}>{text}</p>
}
