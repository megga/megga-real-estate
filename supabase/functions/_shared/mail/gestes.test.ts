// Un geste chez Gmail ou Graph, en appels GROUPÉS (gestes.ts) — rejoué contre un faux `fetch`
// qui compte les appels : c'est leur nombre que la revue du 15.09.2026 mettait en cause.
import { describe, it, expect } from 'vitest'
import { gesteChezLeFournisseur, refusDuFil, renommagesDe, type MessageDuGeste } from './gestes.ts'
import { GMAIL_BATCH_MAX, gmailBatchModify } from './gmail.ts'
import { GRAPH_BATCH_MAX, IMMUTABLE_ID_PREFER, graphBatch } from './graph.ts'

interface Appel { url: string; corps: Record<string, unknown> }
type Repondre = (a: Appel) => Response

function fauxFetch(repondre: Repondre) {
  const appels: Appel[] = []
  const fetch = (async (url: string, init?: RequestInit) => {
    const a = { url: String(url), corps: JSON.parse(String(init?.body ?? '{}')) as Record<string, unknown> }
    appels.push(a)
    return repondre(a)
  }) as unknown as typeof globalThis.fetch
  return { fetch, appels }
}
const vide = () => new Response(null, { status: 204 })
const entrant = (id: string): MessageDuGeste => ({ provider_message_id: id, direction: 'inbound' })
const sortant = (id: string): MessageDuGeste => ({ provider_message_id: id, direction: 'outbound' })

/** Le `$batch` de Graph : chaque requête reçoit `reponse(requête)`, rendues dans le désordre. */
const batchGraph = (reponse: (r: { id: string; url: string; body: Record<string, unknown> }) => { status: number; body?: unknown }): Repondre => (a) => {
  const requetes = (a.corps.requests ?? []) as { id: string; url: string; body: Record<string, unknown> }[]
  return Response.json({ responses: requetes.map((r) => ({ id: r.id, ...reponse(r) })).reverse() })
}

describe('Gmail : messages.batchModify', () => {
  it('⛔ douze fils de cinq messages : UN appel, plus soixante', async () => {
    const { fetch, appels } = fauxFetch(vide)
    const msgs = Array.from({ length: 60 }, (_, i) => entrant(`m${i}`))
    const r = await gesteChezLeFournisseur('gmail', 'tok', 'trash', msgs, { fetch })
    expect(appels).toHaveLength(1)
    expect(appels[0].url).toMatch(/\/messages\/batchModify$/)
    expect(appels[0].corps).toEqual({ ids: msgs.map((m) => m.provider_message_id), addLabelIds: ['TRASH'], removeLabelIds: ['INBOX'] })
    expect([...r.refuses]).toEqual([])
  })

  it('un appel par JEU de libellés : INBOX ne se pose que sur les entrants', async () => {
    const { fetch, appels } = fauxFetch(vide)
    await gesteChezLeFournisseur('gmail', 'tok', 'untrash', [entrant('a'), sortant('b'), entrant('c'), { provider_message_id: 'pending:<x@a>', direction: 'outbound' }], { fetch })
    expect(appels.map((a) => a.corps)).toEqual([
      { ids: ['a', 'c'], addLabelIds: ['INBOX'], removeLabelIds: ['TRASH'] },
      { ids: ['b'], addLabelIds: [], removeLabelIds: ['TRASH'] },
    ])
  })

  it('au-delà de mille identifiants, un appel de plus ; un appel refusé refuse SES messages, pas les autres', async () => {
    let n = 0
    const { fetch, appels } = fauxFetch(() => (++n === 1 ? new Response('quota', { status: 429 }) : vide()))
    const ids = Array.from({ length: GMAIL_BATCH_MAX + 1 }, (_, i) => `m${i}`)
    const refuses = await gmailBatchModify('tok', ids, [], ['UNREAD'], { fetch })
    expect(appels.map((a) => (a.corps.ids as string[]).length)).toEqual([GMAIL_BATCH_MAX, 1])
    expect(refuses).toEqual(ids.slice(0, GMAIL_BATCH_MAX))
  })

  it('un geste sans libellé à changer ne fait aucun appel', async () => {
    const { fetch, appels } = fauxFetch(vide)
    expect([...(await gesteChezLeFournisseur('gmail', 'tok', 'unarchive', [sortant('b')], { fetch })).refuses]).toEqual([])
    expect(appels).toEqual([])
  })
})

describe('Graph : $batch', () => {
  it('⛔ trente-six déplacements : deux appels de vingt au plus — chaque requête porte l id immuable', async () => {
    const { fetch, appels } = fauxFetch(batchGraph((r) => ({ status: 201, body: { id: r.url.split('/')[3] } })))
    const msgs = Array.from({ length: 36 }, (_, i) => entrant(`AAMk${i}`))
    const r = await gesteChezLeFournisseur('outlook', 'tok', 'archive', msgs, { fetch })
    expect(appels.map((a) => a.url)).toEqual(['https://graph.microsoft.com/v1.0/$batch', 'https://graph.microsoft.com/v1.0/$batch'])
    expect(appels.map((a) => (a.corps.requests as unknown[]).length)).toEqual([GRAPH_BATCH_MAX, 16])
    const premiere = (appels[0].corps.requests as { method: string; url: string; body: unknown; headers: Record<string, string> }[])[0]
    expect(premiere).toMatchObject({ method: 'POST', url: '/me/messages/AAMk0/move', body: { destinationId: 'archive' } })
    expect(premiere.headers.Prefer).toBe(IMMUTABLE_ID_PREFER)
    expect([...r.refuses]).toEqual([])
  })

  it('un statut PAR MESSAGE : le refusé est rendu, le déplacé rend son nouvel id — réponses dans le désordre', async () => {
    const { fetch } = fauxFetch(batchGraph((r) => (r.url.includes('/B/') ? { status: 429 } : { status: 201, body: { id: `${r.url.split('/')[3]}-neuf` } })))
    const r = await gesteChezLeFournisseur('outlook', 'tok', 'trash', [entrant('A'), entrant('B'), entrant('C'), sortant('S')], { fetch })
    expect([...r.refuses]).toEqual(['B'])
    expect(r.renamed).toEqual({ A: 'A-neuf', C: 'C-neuf' })
  })

  it('lu, étoile : un PATCH par message dans le lot ; une copie « Envoyés » ne se déplace pas', async () => {
    const { fetch, appels } = fauxFetch(batchGraph(() => ({ status: 200, body: {} })))
    await gesteChezLeFournisseur('outlook', 'tok', 'star', [entrant('A'), sortant('S')], { fetch })
    await gesteChezLeFournisseur('outlook', 'tok', 'archive', [sortant('S')], { fetch })
    expect(appels).toHaveLength(1)
    expect(appels[0].corps.requests).toEqual([
      expect.objectContaining({ method: 'PATCH', url: '/me/messages/A', body: { flag: { flagStatus: 'flagged' } } }),
      expect.objectContaining({ method: 'PATCH', url: '/me/messages/S', body: { flag: { flagStatus: 'flagged' } } }),
    ])
  })

  it('un $batch refusé en entier refuse chacune de ses requêtes', async () => {
    const { fetch } = fauxFetch(() => new Response('boom', { status: 503 }))
    expect(await graphBatch('tok', [{ method: 'PATCH', url: '/me/messages/A', body: {} }, { method: 'PATCH', url: '/me/messages/B', body: {} }], { fetch }))
      .toEqual([{ status: 503, body: null }, { status: 503, body: null }])
  })
})

describe('un verdict par fil', () => {
  const fait = { renamed: { A: 'A2', B: 'B2' }, refuses: new Set(['C']) }
  it('un fil dont UN message a été refusé est refusé ; les autres passent', () => {
    expect(refusDuFil([entrant('A'), entrant('C')], fait)).toBe('provider_failed')
    expect(refusDuFil([entrant('A'), sortant('B')], fait)).toBeNull()
  })
  it('renommagesDe ne rend que les renommages des messages du fil', () => {
    expect(renommagesDe(fait.renamed, [entrant('A'), entrant('C')])).toEqual({ A: 'A2' })
  })
})
