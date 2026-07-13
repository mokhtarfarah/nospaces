import { describe, it, expect } from 'vitest'
import { isSkin, nearKnownGood, type RGB } from './palette'

// The colour-story skin gate (s118). sampleBoardColors itself needs a canvas/Image
// (browser only), so we test the two pure predicates the gate is built from — they're
// where the actual "keep camel, drop skin" decision lives.
describe('skin gate', () => {
  describe('isSkin — broad warm-flesh detector', () => {
    it('flags model skin tones across the range', () => {
      expect(isSkin(255, 224, 189)).toBe(true) // pale
      expect(isSkin(198, 155, 122)).toBe(true) // mid
      expect(isSkin(141, 96, 66)).toBe(true)   // deep
    })

    it('does NOT flag neutrals — grey/white/black backgrounds are handled elsewhere', () => {
      expect(isSkin(128, 128, 128)).toBe(false) // grey (channels equal)
      expect(isSkin(245, 245, 245)).toBe(false) // near-white
      expect(isSkin(20, 20, 20)).toBe(false)    // near-black (too dark)
    })

    it('does NOT flag cool colours — a blue/green garment is never skin', () => {
      expect(isSkin(60, 90, 160)).toBe(false)  // blue (b dominant)
      expect(isSkin(90, 140, 90)).toBe(false)  // green (g >= r)
    })

    it('DOES flag camel/tan/leather — intentional: the palette gate protects those, not isSkin', () => {
      // Camel sits right on top of skin in RGB — this is exactly why we can't gate on
      // isSkin alone and instead protect colours confirmed by a clean cutout.
      expect(isSkin(193, 154, 107)).toBe(true) // camel
      expect(isSkin(160, 120, 85)).toBe(true)  // tan leather
    })
  })

  describe('nearKnownGood — the cutout-confirmed protection', () => {
    const cutoutPalette: RGB[] = [
      { r: 193, g: 154, b: 107 }, // a camel garment, confirmed by a clean cutout
      { r: 30, g: 30, b: 34 },    // a near-black piece
    ]

    it('protects a colour a clean cutout confirmed (camel survives)', () => {
      expect(nearKnownGood(196, 150, 110, cutoutPalette)).toBe(true)
    })

    it('does not protect a flesh tone absent from every cutout (skin gets dropped)', () => {
      // A model's skin on a monochrome board: warm, isSkin=true, but no cutout vouches for it.
      const skin = { r: 210, g: 165, b: 130 }
      expect(isSkin(skin.r, skin.g, skin.b)).toBe(true)
      expect(nearKnownGood(skin.r, skin.g, skin.b, cutoutPalette)).toBe(false)
    })

    it('protects nothing when there are no clean cutouts (empty palette)', () => {
      // The known gap: a board with no packshot cutouts can gate a real warm colour.
      expect(nearKnownGood(193, 154, 107, [])).toBe(false)
    })
  })
})
