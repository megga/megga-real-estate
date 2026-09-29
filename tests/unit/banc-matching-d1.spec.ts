/**
 * Le banc `/dev/crm` et le lot D1 : ses RPC rejouées racontent l'histoire du banc — le retour dû d'Emma (deux biens sans
 * réponse), trois baisses (Antoine revenu, Emma revenue, Julie proposée), le nouveau mandat de Florissant, le marché
 * d'Anastasia —, « Pendant ton absence » reconnaît la relance de proposition, et la boucle d'Antoine garde son bien revenu.
 *
 * ⚠ Les fixtures sont des tableaux de MODULE : chaque test relit un module neuf (`vi.resetModules`).
 */
import { describe, expect, it, vi } from 'vitest'
import { construireSaBoucle, type LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'

async function banc() {
  vi.resetModules()
  const f = await import('@/pages/dev/crmFixtures')
  const rpc = (nom: string) => f.CRM_RPC[nom] as (a: Record<string, unknown>) => unknown
  return { f, rpc }
}

describe('le banc du lot D1', () => {
  it('« Aujourd’hui » : cinq actions dans l’ordre des sortes, sur six', async () => {
    const { rpc } = await banc()
    const lignes = rpc('matching_actions_du_jour')({ p_limite: 5 }) as Record<string, unknown>[]
    expect(lignes.map((l) => [l.genre, l.contact_id ?? l.property_id, l.match_id ?? null])).toEqual([
      ['retour', 'c7', null],
      ['prix', 'c10', 'm5'],
      ['prix', 'c7', 'm20'],
      ['prix', 'c9', 'm15'],
      ['mandat', 'p3', null],
    ])
    expect(lignes[0]).toMatchObject({ nombre: 2, prenom: 'Emma' })
    expect(lignes[1]).toMatchObject({ montant: 250_000, statut: 'suggested' })
    expect(lignes[3]).toMatchObject({ montant: 50_000, statut: 'sent' })
    expect(lignes[4]).toMatchObject({ nombre: 2 })
    expect(lignes.every((l) => l.total === 6)).toBe(true)
    // Au-delà de la coupe : le marché d'Anastasia, une annonce nouvelle et une en baisse. Le bien revenu d'Emma, déjà
    // proposé, n'y figure pas : sa baisse est l'action 2.
    const tout = rpc('matching_actions_du_jour')({ p_limite: 20 }) as Record<string, unknown>[]
    expect(tout).toHaveLength(6)
    expect(tout[5]).toMatchObject({ genre: 'marche', contact_id: 'c11', nouveaux: 1, baisses: 1, titre: null })
  })

  it('« Pendant ton absence » : le retour d’Emma est une relance de proposition, deux biens sans réponse', async () => {
    const { rpc } = await banc()
    const p = rpc('today_absence')({ p_fallback_hours: 72 }) as { since: string; signals: Record<string, unknown>[] }
    expect(p.signals.find((s) => s.id === 'reminder:rb2')).toMatchObject({
      kind: 'reminder', contact_id: 'c7', reminder_type: 'follow_up_sent_property', nb_biens: 2, late: true,
    })
    // Le refus de Julie (m14) est un retour consigné de la fenêtre ; rb1 (Julie) n'est pas échue.
    expect(p.signals.find((s) => s.id === 'match:m14')).toMatchObject({ kind: 'skip', motif: 'prix', reminder_type: null })
    expect(p.signals.some((s) => s.id === 'reminder:rb1')).toBe(false)
  })

  it('après les deux réponses d’Emma, sa relance ne se montre ni dans le segment ni dans l’absence — et ses réponses se datent', async () => {
    const { f, rpc } = await banc()
    // Les deux gestes du fil, écrits comme le PATCH du banc les écrit (`ecrire`, bancSupabase.ts) : le statut, le motif,
    // et `updated_at`. Aucun trigger : rb2 reste `pending` dans la table, `response_at` reste nul.
    const matchs = f.CRM_TABLES.matches as Record<string, unknown>[]
    const consigner = (id: string, patch: Record<string, unknown>) =>
      Object.assign(matchs.find((m) => m.id === id)!, patch, { updated_at: new Date().toISOString() })
    consigner('m18', { status: 'interested', reaction_motif: null })
    consigner('m21', { status: 'rejected', reaction_motif: 'prix' })
    expect((f.CRM_TABLES.reminders as Record<string, unknown>[]).find((r) => r.id === 'rb2')).toMatchObject({ status: 'pending' })

    // La base l'aurait close (`fermer_relance_proposition`) : ni signal — qui sortait avec `nb_biens: 0`, un rappel
    // ordinaire que « Reprendre » aurait écrit `done` —, ni retour à consigner.
    const p = rpc('today_absence')({ p_fallback_hours: 72 }) as { signals: Record<string, unknown>[] }
    expect(p.signals.some((s) => s.id === 'reminder:rb2')).toBe(false)
    const lignes = rpc('matching_actions_du_jour')({ p_limite: 20 }) as Record<string, unknown>[]
    expect(lignes.some((l) => l.genre === 'retour' && l.contact_id === 'c7')).toBe(false)
    // Les deux réponses, datées par le geste (`set_match_response_at`, rejoué sur `updated_at`).
    expect(p.signals.find((s) => s.id === 'match:m18')).toMatchObject({ kind: 'like', contact_id: 'c7' })
    expect(p.signals.find((s) => s.id === 'match:m21')).toMatchObject({ kind: 'skip', motif: 'prix' })
  })

  it('une relance de proposition SANS bien reste un signal, avec `nb_biens: 0` : rien ne la ferme', async () => {
    const { f, rpc } = await banc()
    // La forme qu'écrit `automation-engine` (§4, l'acheteur chaud inactif) : `match_id` nul, aucun `match_ids`. Aucun bien
    // ne la désigne : `fermer_relance_proposition` ne la ferme jamais, et la base la rend comme un rappel ordinaire.
    const rappels = f.CRM_TABLES.reminders as Record<string, unknown>[]
    rappels.push({
      id: 'rb-sans-bien', agency_id: f.AGENCE_BANC.id, contact_id: 'c1', property_id: null, transaction_id: null,
      match_id: null, type: 'follow_up_sent_property', trigger_rule: 'inactivity', trigger_days: 7, status: 'pending',
      trigger_at: new Date(Date.now() - 3_600_000).toISOString(), channel: 'notification', message_template: null,
    })
    const p = rpc('today_absence')({ p_fallback_hours: 72 }) as { signals: Record<string, unknown>[] }
    expect(p.signals.find((s) => s.id === 'reminder:rb-sans-bien')).toMatchObject({
      kind: 'reminder', contact_id: 'c1', reminder_type: 'follow_up_sent_property', nb_biens: 0, late: true,
    })
    // Et pas de retour à consigner : la jointure de la RPC sur les biens `sent` l'écarte.
    const lignes = rpc('matching_actions_du_jour')({ p_limite: 20 }) as Record<string, unknown>[]
    expect(lignes.some((l) => l.genre === 'retour' && l.contact_id === 'c1')).toBe(false)
  })

  it('« Ce qui a bougé » : les acheteurs compatibles d’une annonce, sans les refus', async () => {
    const { rpc } = await banc()
    const r = rpc('pige_acheteurs_compatibles')({ p_annonces: ['ml-boucle-2', 'ml-boucle-3', 'ml-signal-1', 'ml-inconnue'] }) as
      { market_listing_id: string; acheteurs: number }[]
    // ml-boucle-2 : son seul match est le refus de Julie (m14) — il ne compte pas.
    expect(Object.fromEntries(r.map((l) => [l.market_listing_id, l.acheteurs]))).toEqual({ 'ml-boucle-3': 1, 'ml-signal-1': 1 })
  })

  it('« Aujourd’hui » : la file Focus du banc porte des matchs — que « Dossiers » ne montre plus', async () => {
    const { rpc } = await banc()
    const lignes = rpc('focus_top_matches') as unknown as Record<string, unknown>[]
    expect(lignes.map((l) => l.match_id)).toEqual(['m22', 'm23'])
  })

  it('« Sa boucle » d’Antoine garde son bien revenu', async () => {
    const { f } = await banc()
    const lignes = (f.CRM_TABLES.matches as (LigneBoucleContact & { contact_id: string })[]).filter((m) => m.contact_id === 'c10')
    // `maintenant` : l'heure de la lecture, contre laquelle se juge un report. Les fixtures du banc sont datées par rapport
    // à l'horloge (`ilYA`), donc la lecture aussi.
    const b = construireSaBoucle(lignes, new Map(), { id: 'c10', prenom: 'Antoine', nom: 'Lefèvre', telephone: null, email: null, kyc: 'none' }, Date.now())
    expect(b.biens.find((x) => x.m.id === 'm5')).toMatchObject({ etat: 'revenu', lien: 'ligne=m5&contact=c10' })
  })
})
