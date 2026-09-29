/**
 * Le banc `/dev/crm` et le lot E1 : un mandat VENDU, sur lequel Julie n'a pas encore répondu et qui intéresse Emma —
 * « En attente » et « À conclure » le gardent, son état écrit ; « À proposer » ne le montre plus (décision 12a).
 *
 * ⚠ Le banc ne note pas (`src/` ne charge pas le barème Deno) : ses deux matchs portent les notes du vrai moteur, que ce
 * fichier confronte à `calculateScoreV2`. ⚠ Les fixtures sont des tableaux de MODULE : chaque test relit un module neuf
 * (`vi.resetModules`).
 */
import { describe, expect, it, vi } from 'vitest'
import { calculateScoreV2, DEFAULT_SCORING_CONFIG } from '../../supabase/functions/_shared/matching-normalize'
import { cleEtatMandat } from '@/components/matching-fil/filBoucle'
import { versBien, type LigneBien } from '@/hooks/useMatchingFil'

type Ligne = Record<string, unknown> & { id: string }

async function banc() {
  vi.resetModules()
  const f = await import('@/pages/dev/crmFixtures')
  const ligne = (nom: string, id: string): Ligne => {
    const l = (f.CRM_TABLES[nom] as Ligne[]).find((x) => x.id === id)
    if (!l) throw new Error(`${nom}/${id} absent du banc`)
    return l
  }
  return { ligne }
}

describe('le banc du lot E1 — un mandat vendu', () => {
  it('Petit-Saconnex est vendu ; Julie n’a pas répondu, Emma est intéressée — et le fil écrit « Vendu »', async () => {
    const { ligne } = await banc()
    const bien = ligne('properties', 'p4')
    expect(bien.status).toBe('sold')
    expect(ligne('matches', 'm26')).toMatchObject({ contact_id: 'c9', property_id: 'p4', status: 'sent' })
    expect(ligne('matches', 'm27')).toMatchObject({ contact_id: 'c7', property_id: 'p4', status: 'interested' })
    // La jointure porte l'état de la table : « Sa boucle » le lit.
    for (const id of ['m26', 'm27']) expect((ligne('matches', id).property as { status: string }).status, id).toBe('sold')
    expect(cleEtatMandat(versBien(bien as unknown as LigneBien))).toBe('listings:status.sold')
  })

  it('ses deux matchs portent la note du moteur, raisons comprises', async () => {
    const { ligne } = await banc()
    const bien = ligne('properties', 'p4')
    for (const id of ['m26', 'm27']) {
      const m = ligne('matches', id)
      const criteres = ligne('client_searches', m.client_search_id as string).criteria as Record<string, unknown>
      const note = calculateScoreV2(bien, criteres, DEFAULT_SCORING_CONFIG, null, Date.now())
      expect({ id, score: m.score, reasons: m.reasons }).toEqual({ id, score: note.total, reasons: note.reasons })
    }
  })
})
