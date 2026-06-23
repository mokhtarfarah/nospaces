import { describe, it, expect } from 'vitest'
import { readThread, itemAttributes, normValue, type Attribute } from './things'
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

describe('itemAttributes', () => {
  it('reads a product’s own attributes', () => {
    expect(itemAttributes(product([a('material', 'wool')]))).toEqual([a('material', 'wool')])
  })

  it('returns nothing for a non-thing', () => {
    expect(itemAttributes(thing({ type: 'film', metadata: {} }))).toEqual([])
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
      product([a('palette', 'muted'), a('material', 'wool'), a('form', 'structured')]),
      product([a('palette', 'muted'), a('material', 'wool'), a('form', 'structured')]),
      product([a('palette', 'muted'), a('material', 'linen'), a('form', 'relaxed')]),
      product([a('palette', 'muted'), a('material', 'wool'), a('form', 'structured')]),
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

  it('caps the read at four tokens', () => {
    const five: Attribute[] = [
      a('palette', 'muted'), a('material', 'wool'), a('form', 'structured'), a('category', 'coat'), a('priceTier', 'splurge'),
    ]
    const items = [product(five), product(five), product(five), product(five)]
    expect(readThread(items)?.tokens).toHaveLength(4)
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
