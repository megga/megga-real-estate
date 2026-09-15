// Les gestes en lot : un verdict par fil, jamais un refus en bloc (lot.ts).
import { describe, it, expect } from 'vitest'
import { LOT_MAX, appliquerEnLot, lireLot } from './lot.ts'

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`

describe('lireLot', () => {
  it('rend les identifiants dédoublonnés, dans l’ordre reçu', () => {
    expect(lireLot([id(2), id(1), id(2)])).toEqual([id(2), id(1)])
  })
  it('refuse un lot vide, trop long, ou qui n’est pas une liste d’uuid', () => {
    expect(lireLot([])).toBeNull()
    expect(lireLot(Array.from({ length: LOT_MAX + 1 }, (_, i) => id(i)))).toBeNull()
    expect(lireLot([id(1), 'x'])).toBeNull()
    expect(lireLot(id(1))).toBeNull()
    expect(lireLot(null)).toBeNull()
    // Le plafond lui-même passe.
    expect(lireLot(Array.from({ length: LOT_MAX }, (_, i) => id(i)))).toHaveLength(LOT_MAX)
  })
})

describe('appliquerEnLot', () => {
  it('⛔ un fil refusé ne retient pas les autres — un verdict par fil, dans l’ordre', async () => {
    const vus: string[] = []
    const verdicts = await appliquerEnLot([id(1), id(2), id(3)], new Set([id(1), id(2), id(3)]), async (x) => {
      vus.push(x)
      return x === id(2) ? 'provider_failed' : null
    })
    expect(vus).toEqual([id(1), id(2), id(3)])
    expect(verdicts).toEqual([
      { thread_id: id(1), ok: true },
      { thread_id: id(2), ok: false, error: 'provider_failed' },
      { thread_id: id(3), ok: true },
    ])
  })

  it('un fil hors de la boîte est « introuvable », et le geste n’est jamais appelé pour lui', async () => {
    const vus: string[] = []
    const verdicts = await appliquerEnLot([id(1), id(9)], new Set([id(1)]), async (x) => { vus.push(x); return null })
    expect(vus).toEqual([id(1)])
    expect(verdicts[1]).toEqual({ thread_id: id(9), ok: false, error: 'thread_not_found' })
  })

  it('un geste qui LÈVE rend « failed » et le lot continue', async () => {
    const verdicts = await appliquerEnLot([id(1), id(2)], new Set([id(1), id(2)]), async (x) => {
      if (x === id(1)) throw new Error('réseau')
      return null
    })
    expect(verdicts).toEqual([{ thread_id: id(1), ok: false, error: 'failed' }, { thread_id: id(2), ok: true }])
  })
})
