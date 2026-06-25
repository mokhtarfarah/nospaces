import { describe, it, expect } from 'vitest'
import { readThread, boardTasteSummary, itemAttributes, promoteIntentToProduct, demoteProductToIntent, productPlan, normValue, priceValue, formatPrice, type Attribute } from './things'
import type { Item } from './database.types'

// Minimal thing factory — only the fields the thread logic reads matter.
function thing(partial: Partial<Item>): Item {
  return {
    id: Math.random().toString(36).slice(2), user_id: 'u', title: 't', creator: null,
    type: 'thing', year: null, status: 'want_to', reaction: null, note: null,
    source: 'manual', source_detail: null, recommended_by: null, metadata: {},
    tags: [], moods: [], date_added: '', date_done: null, created_at: '', updated_at: '',
    ...partial,
  }
}

function product(attributes: Attribute[]): Item {
  return thing({ metadata: { kind: 'product', title: 't', attributes } })
}

const a = (facet: Attribute['facet'], value: string): Attribute => ({ facet, value })

describe('normValue', () => {
  it('trims and lowercases', () => {
    expect(normValue('  Wool ')).toBe('wool')
    expect(normValue('MUTED')).toBe('muted')
  })
})

describe('priceValue', () => {
  it('reads common formats', () => {
    expect(priceValue('$630.00')).toBe(630)
    expect(priceValue('416')).toBe(416)
    expect(priceValue('£1,299.00')).toBe(1299)
    expect(priceValue('1.299,00 €')).toBe(1299)
    expect(priceValue('$1,250')).toBe(1250)
  })
  it('returns null when there is no number', () => {
    expect(priceValue(null)).toBeNull()
    expect(priceValue('')).toBeNull()
    expect(priceValue('Price on request')).toBeNull()
  })
})

describe('formatPrice', () => {
  it('adds thousands separators and drops trailing .00 / .0', () => {
    expect(formatPrice('$3600.00')).toBe('$3,600')
    expect(formatPrice('$295.0')).toBe('$295')
    expect(formatPrice('1250')).toBe('1,250')
    expect(formatPrice('£1,299.00')).toBe('£1,299')
  })
  it('keeps real cents', () => {
    expect(formatPrice('$12.99')).toBe('$12.99')
  })
  it('leaves untouched what it can’t safely reformat', () => {
    expect(formatPrice('Price on request')).toBe('Price on request')
    expect(formatPrice('1.299,00 €')).toBe('1.299,00 €') // trailing-symbol locale
    expect(formatPrice(null)).toBeNull()
  })
})

describe('itemAttributes', () => {
  it('reads a product’s own attributes', () => {
    expect(itemAttributes(product([a('material', 'wool')]))).toEqual([a('material', 'wool')])
  })

  it('returns nothing for a non-thing', () => {
    expect(itemAttributes(thing({ type: 'film', metadata: {} }))).toEqual([])
  })

  it('reads a mood-board image’s own attributes (it feeds the thread too)', () => {
    const mood = thing({ metadata: { kind: 'inspiration', image: 'https://x/y.png', attributes: [a('palette', 'muted')] } })
    expect(itemAttributes(mood)).toEqual([a('palette', 'muted')])
  })

  it('returns nothing for an unresolved intent (not yet a settled signal)', () => {
    const intent = thing({
      status: 'want_to',
      metadata: { kind: 'intent', candidates: [{ id: 'c1', title: 'x', image: null, price: null, brand: null, siteName: null, url: null, attributes: [a('material', 'leather')] }], leaning: 'c1' },
    })
    expect(itemAttributes(intent)).toEqual([])
  })

  it('reads the winner’s attributes from a resolved intent', () => {
    const intent = thing({
      status: 'done',
      metadata: {
        kind: 'intent', winner: 'c2',
        candidates: [
          { id: 'c1', title: 'x', image: null, price: null, brand: null, siteName: null, url: null, attributes: [a('palette', 'bold')] },
          { id: 'c2', title: 'y', image: null, price: null, brand: null, siteName: null, url: null, attributes: [a('palette', 'muted')] },
        ],
      },
    })
    expect(itemAttributes(intent)).toEqual([a('palette', 'muted')])
  })

  it('counts a decided intent’s winner even before it’s marked owned', () => {
    // Gated on winner, not status: a plan still in want_to but with a winner picked
    // is "decided" and its choice already feeds the thread.
    const intent = thing({
      status: 'want_to',
      metadata: {
        kind: 'intent', winner: 'c1',
        candidates: [{ id: 'c1', title: 'y', image: null, price: null, brand: null, siteName: null, url: null, attributes: [a('palette', 'muted')] }],
      },
    })
    expect(itemAttributes(intent)).toEqual([a('palette', 'muted')])
  })
})

describe('promoteIntentToProduct', () => {
  it('turns the winner into product metadata and keeps the plan’s history', () => {
    const intent = thing({
      title: 'black clogs',
      metadata: {
        kind: 'intent', winner: 'c2', brief: 'under $200',
        candidates: [
          { id: 'c1', title: 'x', image: null, price: '250', brand: 'A', siteName: null, url: null, attributes: [a('palette', 'bold')] },
          { id: 'c2', title: 'y', image: 'img', price: '180', brand: 'B', siteName: 's', url: 'u', attributes: [a('palette', 'muted')] },
        ],
      },
    })
    const meta = promoteIntentToProduct(intent)!
    expect(meta.kind).toBe('product')
    expect(meta.title).toBe('y')
    expect(meta.price).toBe('180')
    expect(meta.brand).toBe('B')
    expect(meta.attributes).toEqual([a('palette', 'muted')])
    // The whole deliberation is preserved, not just the winner.
    expect(meta.fromPlan.need).toBe('black clogs')
    expect(meta.fromPlan.brief).toBe('under $200')
    expect(meta.fromPlan.candidates).toHaveLength(2)
    expect(meta.fromPlan.winner).toBe('c2')
  })

  it('returns null when there’s no resolvable winner', () => {
    const intent = thing({ metadata: { kind: 'intent', leaning: 'c1', candidates: [{ id: 'c1', title: 'x', image: null, price: null, brand: null, siteName: null, url: null }] } })
    expect(promoteIntentToProduct(intent)).toBeNull()
  })
})

describe('productPlan', () => {
  it('reads back the deliberation a promoted product carries', () => {
    const intent = thing({
      title: 'black clogs',
      metadata: {
        kind: 'intent', winner: 'c2', brief: 'under $200',
        candidates: [
          { id: 'c1', title: 'x', image: null, price: '250', brand: 'A', siteName: null, url: 'u1' },
          { id: 'c2', title: 'y', image: 'img', price: '180', brand: 'B', siteName: null, url: 'u2' },
        ],
      },
    })
    // Simulate the promote: store the returned meta on the item.
    const promoted = thing({ title: 'y', metadata: promoteIntentToProduct(intent)! })
    const plan = productPlan(promoted)!
    expect(plan.need).toBe('black clogs')
    expect(plan.winner).toBe('c2')
    expect(plan.candidates).toHaveLength(2)
  })

  it('is null for a product saved directly (no plan history)', () => {
    expect(productPlan(product([a('palette', 'muted')]))).toBeNull()
  })
})

describe('demoteProductToIntent', () => {
  it('round-trips a promoted product back to the plan it came from', () => {
    const intent = thing({
      title: 'black clogs',
      metadata: {
        kind: 'intent', winner: 'c2', brief: 'under $200',
        candidates: [
          { id: 'c1', title: 'x', image: null, price: '250', brand: 'A', siteName: null, url: 'u1' },
          { id: 'c2', title: 'y', image: 'img', price: '180', brand: 'B', siteName: null, url: 'u2' },
        ],
      },
    })
    const promoted = thing({ title: 'y', metadata: promoteIntentToProduct(intent)! })
    const back = demoteProductToIntent(promoted)!
    expect(back.title).toBe('black clogs')
    expect(back.meta.kind).toBe('intent')
    // winner stays picked, so it reads "decided" — exactly the pre-save state.
    expect(back.meta.winner).toBe('c2')
    expect(back.meta.brief).toBe('under $200')
    expect(back.meta.candidates).toHaveLength(2)
    // the product wrapper is gone — clean intent metadata, no fromPlan key.
    expect('fromPlan' in back.meta).toBe(false)
  })

  it('is null for a product with no plan history (nothing to revert to)', () => {
    expect(demoteProductToIntent(product([a('palette', 'muted')]))).toBeNull()
  })
})

describe('readThread', () => {
  it('returns null below the minimum number of tagged items', () => {
    const items = [product([a('palette', 'muted')]), product([a('palette', 'muted')]), product([a('palette', 'muted')])]
    expect(readThread(items)).toBeNull()
  })

  it('ignores untagged items when counting toward the minimum', () => {
    const items = [
      product([a('palette', 'muted')]),
      product([]), // untagged — doesn't count
      product([a('palette', 'muted')]),
      product([a('palette', 'muted')]),
    ]
    expect(readThread(items)).toBeNull() // only 3 tagged
  })

  it('surfaces the dominant value per facet, one token each', () => {
    const items = [
      product([a('palette', 'muted'), a('material', 'wool'), a('vibe', 'structured')]),
      product([a('palette', 'muted'), a('material', 'wool'), a('vibe', 'structured')]),
      product([a('palette', 'muted'), a('material', 'linen'), a('vibe', 'relaxed')]),
      product([a('palette', 'muted'), a('material', 'wool'), a('vibe', 'structured')]),
    ]
    const t = readThread(items)
    // facet order is palette, material, form, category
    expect(t).toEqual({ tokens: ['muted', 'wool', 'structured'], basis: 4 })
  })

  it('drops values that do not recur (appear in only one item)', () => {
    const items = [
      product([a('palette', 'muted')]),
      product([a('palette', 'muted')]),
      product([a('palette', 'bold')]), // singleton — excluded
      product([a('palette', 'muted')]),
    ]
    expect(readThread(items)?.tokens).toEqual(['muted'])
  })

  it('counts items, not occurrences — repeats within one item don’t inflate', () => {
    const items = [
      product([a('material', 'wool'), a('material', 'wool')]), // still one item
      product([a('material', 'wool')]),
      product([a('material', 'linen')]),
      product([a('material', 'linen')]),
    ]
    // wool and linen each appear in 2 items → wool wins on insertion-order tie
    expect(readThread(items)?.tokens).toEqual(['wool'])
  })

  it('is case/space insensitive when grouping values', () => {
    const items = [
      product([a('palette', 'Muted')]),
      product([a('palette', ' muted ')]),
      product([a('palette', 'MUTED')]),
      product([a('palette', 'muted')]),
    ]
    expect(readThread(items)?.tokens).toEqual(['muted'])
  })

  it('reads one token per aesthetic facet and leaves category/price out of the thread', () => {
    const all: Attribute[] = [
      a('palette', 'muted'), a('material', 'wool'), a('vibe', 'structured'), a('category', 'coat'), a('priceTier', 'splurge'),
    ]
    const items = [product(all), product(all), product(all), product(all)]
    const t = readThread(items)
    expect(t?.tokens).toEqual(['muted', 'wool', 'structured'])
    expect(t?.tokens).not.toContain('coat')
    expect(t?.tokens).not.toContain('splurge')
  })

  it('returns null when nothing recurs even with enough items', () => {
    const items = [
      product([a('palette', 'muted')]),
      product([a('palette', 'bold')]),
      product([a('palette', 'warm')]),
      product([a('palette', 'pastel')]),
    ]
    expect(readThread(items)).toBeNull()
  })

  it('maps legacy "form" tags forward to "vibe" so nothing saved before the rename is lost', () => {
    // attributes saved under the old 'form' facet key (pre-s66 rename)
    const legacy = { facet: 'form', value: 'structured' } as unknown as Attribute
    const items = [
      product([a('palette', 'muted'), legacy]),
      product([a('palette', 'muted'), legacy]),
      product([a('palette', 'muted')]),
      product([a('palette', 'muted')]),
    ]
    // 'structured' should count under vibe and land in the thread
    expect(readThread(items)?.tokens).toEqual(['muted', 'structured'])
  })

  it('folds a resolved intent’s winner into the read', () => {
    const intentWinner = thing({
      status: 'done',
      metadata: {
        kind: 'intent', winner: 'c1',
        candidates: [{ id: 'c1', title: 'y', image: null, price: null, brand: null, siteName: null, url: null, attributes: [a('material', 'wool')] }],
      },
    })
    const items = [
      product([a('material', 'wool')]),
      product([a('material', 'wool')]),
      product([a('material', 'linen')]),
      intentWinner,
    ]
    expect(readThread(items)?.tokens).toEqual(['wool'])
  })
})

describe('boardTasteSummary', () => {
  it('lists recurring values per facet, sorted by item count, with the thread', () => {
    const items = [
      product([a('palette', 'muted'), a('material', 'wool')]),
      product([a('palette', 'muted'), a('material', 'wool')]),
      product([a('palette', 'muted'), a('material', 'linen')]),
      product([a('palette', 'earth'), a('material', 'wool')]),
    ]
    const s = boardTasteSummary(items)
    // muted (3 items) leads earth (1, dropped — under RECUR_MIN); wool (3) leads linen (1, dropped)
    expect(s.facets.palette).toEqual([['muted', 3]])
    expect(s.facets.material).toEqual([['wool', 3]])
    expect(s.thread).toEqual(['muted', 'wool'])
  })

  it('keeps category in the summary even though the thread leaves it out', () => {
    const items = [
      product([a('category', 'coat'), a('palette', 'muted')]),
      product([a('category', 'coat'), a('palette', 'muted')]),
      product([a('category', 'bag'), a('palette', 'muted')]),
      product([a('category', 'bag'), a('palette', 'muted')]),
    ]
    const s = boardTasteSummary(items)
    expect(s.facets.category).toEqual(expect.arrayContaining([['coat', 2], ['bag', 2]]))
    expect(s.thread).not.toContain('coat')
  })

  it('drops one-off values (a value only one item carries)', () => {
    const items = [
      product([a('vibe', 'structured')]),
      product([a('vibe', 'structured')]),
      product([a('vibe', 'relaxed')]), // singleton
    ]
    expect(boardTasteSummary(items).facets.vibe).toEqual([['structured', 2]])
  })

  it('returns an empty thread on a sparse board (no read yet)', () => {
    expect(boardTasteSummary([product([a('palette', 'muted')])]).thread).toEqual([])
  })
})
