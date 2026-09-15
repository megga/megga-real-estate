// Les gestes en lot : un verdict par fil, jamais un refus en bloc (lot.ts).
import { describe, it, expect } from 'vitest'
import { LOT_MAX, appliquerEnLot, lireLot, lireToutesLesPages, rienASignaler } from './lot.ts'

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

// ⛔ « Spam » sur un fil sans message reçu : le fil prenait `is_spam` sans qu'un seul de ses
// messages le porte, et le premier recalcul le rendait à « Envoyés » (revue du 15.09.2026).
describe('rienASignaler', () => {
  it('« Spam » sur un fil qui n a rien reçu : rien à signaler', () => {
    expect(rienASignaler('spam', [{ direction: 'outbound' }, { direction: 'outbound' }])).toBe(true)
    expect(rienASignaler('spam', [])).toBe(true)
  })
  it('un seul message reçu suffit ; et les autres gestes ne sont pas concernés', () => {
    expect(rienASignaler('spam', [{ direction: 'outbound' }, { direction: 'inbound' }])).toBe(false)
    expect(rienASignaler('archive', [{ direction: 'outbound' }])).toBe(false)
    expect(rienASignaler('not_spam', [{ direction: 'outbound' }])).toBe(false)
  })
})

// ⛔ PostgREST plafonne une réponse (`max_rows`) sans le dire (revue du 15.09.2026).
describe('lireToutesLesPages', () => {
  const table = Array.from({ length: 12 }, (_, i) => i)
  /** Un PostgREST dont le `max_rows` (3) est plus bas que la page demandée (5). */
  const plafonne = (maxRows: number) => async (de: number, a: number) => ({ data: table.slice(de, Math.min(a + 1, de + maxRows)), error: null })
  it('lit TOUT, même sous un max_rows plus bas que la page demandée', async () => {
    expect((await lireToutesLesPages(plafonne(3), 5)).lignes).toEqual(table)
  })
  it('s arrête à une page vide, et rend l erreur d une page', async () => {
    let n = 0
    const r = await lireToutesLesPages(async (de) => (++n === 2 ? { data: null, error: { message: 'boom' } } : { data: table.slice(de, de + 5), error: null }), 5)
    expect(r.error).toEqual({ message: 'boom' })
    expect(r.lignes).toHaveLength(5)
  })
})

