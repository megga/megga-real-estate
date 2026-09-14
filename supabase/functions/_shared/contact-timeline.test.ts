// supabase/functions/_shared/contact-timeline.test.ts
// Les faits d'un contact pour les outils IA : deux lectures bornées à l'agence, datées par le
// fait. Faux client : on regarde les REQUÊTES, et on rend des lignes choisies.
import { describe, it, expect, vi } from 'vitest'
import { ACTIONS_COURRIER, dateDuFait, lireFaitsContact } from './contact-timeline.ts'

interface Appel { table: string; select: string; filtres: [string, unknown][]; ordre: [string, unknown] | null }
type Ligne = { action: string; object_label: string | null; created_at: string; sent_at: string | null; message_id?: string | null }

/**
 * `reponse` rend les lignes de la lecture, ou un message d'erreur PostgREST. `spam` : ce que
 * rend la lecture des courriers au spam (`mail_messages`) — des identifiants, ou une erreur.
 */
function faux(reponse: (a: Appel) => Ligne[] | string, spam: string[] | string = []) {
  const appels: Appel[] = []
  const from = (table: string) => {
    expect(['activity_events', 'mail_messages']).toContain(table)
    const a: Appel = { table, select: '', filtres: [], ordre: null }
    const b = {
      select: (s: string) => { a.select = s; return b },
      eq: (c: string, v: unknown) => { a.filtres.push([`eq:${c}`, v]); return b },
      in: (c: string, v: unknown) => { a.filtres.push([`in:${c}`, v]); return b },
      not: (c: string, op: string, v: unknown) => { a.filtres.push([`not.${op}:${c}`, v]); return b },
      order: (c: string, o: unknown) => { a.ordre = [c, o]; return b },
      limit: (n: number) => { a.filtres.push(['limit', n]); return b },
      then: (res: (v: { data: unknown[] | null; error: { message: string } | null }) => unknown) => {
        appels.push(a)
        const r = table === 'mail_messages' ? (typeof spam === 'string' ? spam : spam.map((id) => ({ id }))) : reponse(a)
        return Promise.resolve(typeof r === 'string' ? { data: null, error: { message: r } } : { data: r, error: null }).then(res)
      },
    }
    return b
  }
  return { client: { from } as never, appels }
}

const estCourrier = (a: Appel) => a.filtres.some(([k]) => k === 'in:action')

describe('lireFaitsContact — les derniers faits d’un contact, datés par le fait', () => {
  it('deux lectures, toutes deux bornées au contact ET à l’agence, sans metadata entière', async () => {
    const { client, appels } = faux(() => [])
    await lireFaitsContact(client, 'ag-1', 'c1', 5)
    expect(appels).toHaveLength(2)
    for (const a of appels) {
      expect(a.filtres).toEqual(expect.arrayContaining([['eq:entity_type', 'contact'], ['eq:entity_id', 'c1'], ['eq:agency_id', 'ag-1'], ['limit', 5]]))
    }
    const autres = appels.find((a) => !estCourrier(a))!
    const courriers = appels.find(estCourrier)!
    expect(autres.select).toBe('action, object_label, created_at, sent_at:metadata->>sent_at')
    // L'identifiant du message, pour écarter le spam — lu, jamais rendu (cf. le test suivant).
    expect(courriers.select).toBe('action, object_label, created_at, sent_at:metadata->>sent_at, message_id:metadata->>message_id')
    expect(autres.filtres).toContainEqual(['not.in:action', '(email_received,email_sent)'])
    expect(autres.ordre).toEqual(['created_at', { ascending: false }])
    expect(courriers.filtres).toContainEqual(['in:action', ['email_received', 'email_sent']])
    expect(courriers.ordre).toEqual(['metadata->>sent_at', { ascending: false, nullsFirst: false }])
  })

  it('après une passe initiale : la « dernière action » est la plus RÉCENTE, pas le courrier le plus vieux', async () => {
    const connexion = '2026-09-13T08:00:00+00:00'
    const { client } = faux((a) => estCourrier(a)
      ? [
          { action: 'email_received', object_label: null, created_at: connexion, sent_at: '2026-09-10T09:00:00.000Z' },
          { action: 'email_sent', object_label: null, created_at: connexion, sent_at: '2026-06-20T09:00:00.000Z' },
        ]
      : [{ action: 'note_added', object_label: 'Rappel banque', created_at: '2026-09-01T10:00:00+00:00', sent_at: null }])
    const faits = await lireFaitsContact(client, 'ag-1', 'c1', 5)
    expect(faits.map((f) => f.occurred_at)).toEqual(['2026-09-10T09:00:00.000Z', '2026-09-01T10:00:00+00:00', '2026-06-20T09:00:00.000Z'])
    expect(faits[0]).toEqual({ action: 'email_received', object_label: null, occurred_at: '2026-09-10T09:00:00.000Z' })
  })

  it('⛔ un courrier signalé comme spam APRÈS son rattachement n’est plus un fait du dossier', async () => {
    const { client, appels } = faux((a) => estCourrier(a)
      ? [
          { action: 'email_received', object_label: null, created_at: '2026-09-13T08:00:00+00:00', sent_at: '2026-09-12T09:00:00.000Z', message_id: 'm-spam' },
          { action: 'email_received', object_label: null, created_at: '2026-09-13T08:00:00+00:00', sent_at: '2026-09-11T09:00:00.000Z', message_id: 'm-vrai' },
        ]
      : [], ['m-spam'])
    const faits = await lireFaitsContact(client, 'ag-1', 'c1', 5)
    expect(faits).toEqual([{ action: 'email_received', object_label: null, occurred_at: '2026-09-11T09:00:00.000Z' }])
    const lecture = appels.find((a) => a.table === 'mail_messages')!
    expect(lecture.filtres).toEqual(expect.arrayContaining([['in:id', ['m-spam', 'm-vrai']], ['eq:agency_id', 'ag-1'], ['eq:is_spam', true]]))
  })

  it('la lecture du spam en échec n’écarte rien, et aucun courrier : aucune lecture du spam', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const lignes = (a: Appel) => estCourrier(a) ? [{ action: 'email_sent', object_label: null, created_at: '2026-09-13T08:00:00+00:00', sent_at: '2026-09-12T09:00:00.000Z', message_id: 'm1' }] : []
    expect(await lireFaitsContact(faux(lignes, 'statement timeout').client, 'ag-1', 'c1', 5)).toHaveLength(1)
    expect(err).toHaveBeenCalledTimes(1)
    err.mockRestore()
    const vide = faux(() => [])
    await lireFaitsContact(vide.client, 'ag-1', 'c1', 5)
    expect(vide.appels.map((a) => a.table)).toEqual(['activity_events', 'activity_events'])
  })

  it('borne la réunion à la limite demandée', async () => {
    const { client } = faux((a) => Array.from({ length: 5 }, (_, i) => ({
      action: estCourrier(a) ? 'email_received' : 'note_added', object_label: null,
      created_at: `2026-09-0${i + 1}T10:00:00+00:00`, sent_at: estCourrier(a) ? `2026-08-0${i + 1}T10:00:00.000Z` : null,
    })))
    expect(await lireFaitsContact(client, 'ag-1', 'c1', 5)).toHaveLength(5)
  })

  // La moitié d'une réunion ment : sans les autres actions, un courrier de juin devenait la
  // « dernière action au dossier » citée au modèle, devant une note de la veille.
  it('une lecture en échec rend AUCUN fait, pas la moitié', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    for (const panne of [estCourrier, (a: Appel) => !estCourrier(a)]) {
      const { client } = faux((a) => panne(a) ? 'statement timeout'
        : [{ action: estCourrier(a) ? 'email_sent' : 'note_added', object_label: null, created_at: '2026-09-01T10:00:00+00:00', sent_at: '2026-06-20T09:00:00.000Z' }])
      expect(await lireFaitsContact(client, 'ag-1', 'c1', 5)).toEqual([])
    }
    expect(err).toHaveBeenCalledTimes(2)
    err.mockRestore()
  })

  it('sans agence, aucune lecture : le client est service-role, rien ne bornerait', async () => {
    const { client, appels } = faux(() => [])
    expect(await lireFaitsContact(client, null, 'c1', 5)).toEqual([])
    expect(appels).toEqual([])
  })

  it('dateDuFait : courrier borné par l’enregistrement ; autre action = created_at', () => {
    expect(dateDuFait({ action: 'email_sent', object_label: null, created_at: '2026-09-13T08:00:00+00:00', sent_at: '2100-01-01T00:00:00.000Z' })).toBe('2026-09-13T08:00:00.000Z')
    expect(dateDuFait({ action: 'note_added', object_label: null, created_at: '2026-09-13T08:00:00+00:00', sent_at: '2026-01-01T00:00:00.000Z' })).toBe('2026-09-13T08:00:00+00:00')
    expect(ACTIONS_COURRIER).toEqual(['email_received', 'email_sent'])
  })
})
