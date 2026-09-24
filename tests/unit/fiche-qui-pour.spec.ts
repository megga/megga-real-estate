/**
 * « Qui pour ce bien ? » (lots C et D1, conception §7) : un compatible REPORTÉ dit jusqu'à quand, un REVENU dit à quel
 * prix il avait été refusé — ni l'un ni l'autre ne passe pour une suggestion ordinaire —, et une fiche lit les matchs DU
 * bien, jamais ceux de l'agence.
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  etatCompatible, STATUTS_COMPATIBLES, trierCompatibles, versCompatible, type Compatible,
} from '@/components/matching-fil/filQuiPour'

const T = Date.parse('2026-09-23T10:00:00Z')
const base: Compatible = { id: 'm1', score: 90, reporteJusquau: null, acheteur: { id: 'c1', prenom: 'Julie', nom: 'Morand' } }
const suivi = (statut: 'suggested' | 'sent' | 'interested' | 'visit_planned' | 'rejected', champs: Record<string, unknown> = {}) => ({
  ...base, suivi: { statut, proposeLe: '2026-09-20T09:00:00Z', reponduLe: null, motif: null, note: null, prixPropose: null, apprisLe: null, ...champs },
})

describe('etatCompatible', () => {
  it('un reporté dit jusqu’à quand ; un report échu n’en est plus un', () => {
    expect(etatCompatible({ ...base, reporteJusquau: '2026-09-30T00:00:00Z' }, T)).toEqual({ cle: 'reporte', date: '2026-09-30T00:00:00Z' })
    expect(etatCompatible({ ...base, reporteJusquau: '2026-09-01T00:00:00Z' }, T)).toEqual({ cle: 'aProposer' })
  })

  it('un revenu dit à quel prix il avait été refusé', () => {
    expect(etatCompatible(suivi('suggested', { motif: 'prix', prixPropose: 3_450_000 }), T)).toEqual({ cle: 'revenu', prix: 3_450_000 })
  })

  it('un revenu sans prix proposé n’est qu’un bien à proposer : il n’a pas de prix à dire', () => {
    expect(etatCompatible(suivi('suggested', { motif: 'prix' }), T)).toEqual({ cle: 'aProposer' })
  })

  it('un revenu reporté dit son report : le report passe devant', () => {
    const revenu = suivi('suggested', { motif: 'prix', prixPropose: 3_450_000 })
    expect(etatCompatible({ ...revenu, reporteJusquau: '2026-09-30T00:00:00Z' }, T)).toEqual({ cle: 'reporte', date: '2026-09-30T00:00:00Z' })
  })

  it('les autres états', () => {
    expect(etatCompatible(base, T)).toEqual({ cle: 'aProposer' })
    expect(etatCompatible(suivi('sent'), T)).toEqual({ cle: 'propose', date: '2026-09-20T09:00:00Z' })
    expect(etatCompatible(suivi('sent', { proposeLe: null }), T)).toEqual({ cle: 'proposeSansDate' })
    expect(etatCompatible(suivi('interested'), T)).toEqual({ cle: 'interesse' })
    expect(etatCompatible(suivi('visit_planned'), T)).toEqual({ cle: 'visite' })
    expect(etatCompatible(suivi('rejected', { motif: 'quartier' }), T)).toEqual({ cle: 'refuse', motif: 'fil.motifs.quartier' })
    // Un code que le geste n'écrit pas ne s'affiche pas en brut.
    expect(etatCompatible(suivi('rejected', { motif: 'recherche_ajustee' }), T)).toEqual({ cle: 'refuseSansMotif' })
  })
})

describe('trierCompatibles', () => {
  it('par score, l’id départage', () => {
    const tries = trierCompatibles([{ ...base, id: 'b', score: 80 }, { ...base, id: 'a', score: 80 }, { ...base, id: 'c', score: 95 }])
    expect(tries.map((m) => m.id)).toEqual(['c', 'a', 'b'])
  })
})

describe('versCompatible', () => {
  const ligne = {
    id: 'm5', contact_id: 'c10', score: '97', status: 'suggested', snoozed_until: null, sent_at: '2026-09-03T00:00:00Z',
    response_at: '2026-09-05T00:00:00Z', reaction_motif: 'prix', reaction_note: null, prix_propose: '3450000',
  }
  it('un bien revenu garde son suivi ; une suggestion jamais proposée n’en a pas', () => {
    expect(versCompatible(ligne, { first_name: 'Antoine', last_name: 'Lefèvre' })).toMatchObject({
      id: 'm5', score: 97, acheteur: { id: 'c10', prenom: 'Antoine', nom: 'Lefèvre' },
      suivi: { statut: 'suggested', motif: 'prix', prixPropose: 3_450_000 },
    })
    expect(versCompatible({ ...ligne, reaction_motif: null, prix_propose: null }, { first_name: 'A', last_name: 'B' })!.suivi).toBeUndefined()
  })
  it('le report ne vaut que pour un match à proposer', () => {
    const acheteur = { first_name: 'Antoine', last_name: 'Lefèvre' }
    const futur = '2026-09-30T00:00:00Z'
    expect(versCompatible({ ...ligne, snoozed_until: futur }, acheteur)!.reporteJusquau).toBe(futur)
    // `snoozeMatch` reporte par id, quel que soit le statut : un bien PROPOSÉ puis reporté reste « Proposé », comme
    // dans « Sa boucle » et dans le fil.
    const propose = versCompatible({ ...ligne, status: 'sent', snoozed_until: futur }, acheteur)!
    expect(propose.reporteJusquau).toBeNull()
    expect(etatCompatible(propose, T)).toEqual({ cle: 'propose', date: '2026-09-03T00:00:00Z' })
  })
  it('sans acheteur lisible, rien', () => {
    expect(versCompatible(ligne, undefined)).toBeNull()
  })
})

describe('la fiche lit les matchs DU bien (lecture du code)', () => {
  const source = (f: string) => readFileSync(f, 'utf8')

  it('aucune fiche ne charge les matchs de l’agence', () => {
    for (const f of ['src/pages/agent/ListingDetailPage.tsx', 'src/pages/agent/ExternalListingDetailPage.tsx']) {
      const code = source(f)
      expect(code, f).not.toMatch(/\buseMatching\(/)
      expect(code, f).toMatch(/<QuiPourFiche\b/)
    }
  })

  it('la requête est ciblée sur le bien, bornée, et cloisonnée à l’agence', () => {
    const code = source('src/hooks/useQuiPourCeBien.ts')
    expect(code).toMatch(/genre === 'mandat' \? 'property_id' : 'market_listing_id'/)
    expect(code).toMatch(/\.eq\(colonne, /)
    expect(code).toMatch(/\.eq\('agency_id', /)
    expect(code).toMatch(/\.limit\(MAX_COMPATIBLES\)/)
    expect(source('src/components/matching-fil/QuiPourFiche.tsx')).toMatch(/useQuiPourCeBien\(/)
  })

  it('« Réactiver » rafraîchit aussi la liste de la fiche', () => {
    // La clé de la fiche vit SOUS le préfixe du fil : l'invalidation de `[CLE_FIL]` qui suit « Réactiver » la couvre,
    // comme elle couvre chaque geste du fil. Sous une clé à part, il faudrait une seconde invalidation — et un geste du
    // fil laisserait la fiche dire « À proposer » d'un acheteur déjà proposé, le temps de son `staleTime`.
    expect(source('src/hooks/useQuiPourCeBien.ts')).toMatch(/queryKey: \[CLE_FIL, CLE_QUI_POUR/)
    expect(source('src/hooks/useAnciensProspects.ts')).toMatch(/invalidateQueries\(\{ queryKey: \[CLE_FIL\] \}\)/)
  })
})

describe('la base compte les mêmes compatibles (lecture de la migration du lot D1)', () => {
  it('les statuts de `mandats` et de `pige_acheteurs_compatibles` sont exactement `STATUTS_COMPATIBLES`', () => {
    // Les compatibles se comptent EN DUR côté base : une liste changée d'un côté ferait dire deux comptes au même bien —
    // la fiche, l'écran de fin et le banc lisent `STATUTS_COMPATIBLES`, « Aujourd'hui » et « Ce qui a bougé » la base.
    // Migration trouvée par son suffixe : elle se redate le jour de la fusion.
    const dossier = 'supabase/migrations'
    const fichier = readdirSync(dossier).find((f) => f.endsWith('_matching_surfaces.sql'))
    expect(fichier, 'migration du lot D1 introuvable').toBeDefined()
    const sql = readFileSync(join(dossier, fichier!), 'utf8')
    const entre = (debut: string, fin: string): string => {
      const i = sql.indexOf(debut)
      const j = sql.indexOf(fin, i + debut.length)
      expect(i, debut).toBeGreaterThanOrEqual(0)
      expect(j, fin).toBeGreaterThan(i)
      return sql.slice(i, j)
    }
    const zones: Record<string, string> = {
      mandats: entre('mandats as (', 'signaux as ('),
      pige_acheteurs_compatibles: entre('function public.pige_acheteurs_compatibles(', '$$;'),
    }
    const attendu = [...STATUTS_COMPATIBLES].sort()
    for (const [zone, code] of Object.entries(zones)) {
      const listes = [...code.matchAll(/m\.status in \(([^)]*)\)/g)]
        .map((x) => [...(x[1] ?? '').matchAll(/'([^']+)'/g)].map((y) => y[1]).sort())
      // Au moins une par zone : une zone où la liste aurait changé de forme ne garderait plus rien.
      expect(listes.length, zone).toBeGreaterThan(0)
      for (const l of listes) expect(l, zone).toEqual(attendu)
    }
  })
})

