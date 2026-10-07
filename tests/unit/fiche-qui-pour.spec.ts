/**
 * « Qui pour ce bien ? » (lots C et D1, conception §7) : un compatible REPORTÉ dit jusqu'à quand, un REVENU dit à quel
 * prix il avait été refusé — ni l'un ni l'autre ne passe pour une suggestion ordinaire —, et une fiche lit les matchs DU
 * bien, jamais ceux de l'agence.
 *
 * Lot E1 : le panneau du fil compte les compatibles comme les fiches, sans les refus (décision 13a) ; sur une fiche, un
 * compatible à proposer d'un bien qui ne se propose plus — annonce retirée, mandat qui n'est plus en vente (décision
 * 12a) — ne mène nulle part dans le fil.
 *
 * Étape 5b-1 : l'état d'un compatible s'écrit à un seul endroit, `texteEtatCompatible` (`filAffichage.ts`).
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import i18next, { type TFunction } from 'i18next'
import deMatching from '@/i18n/locales/de/matching.json'
import enMatching from '@/i18n/locales/en/matching.json'
import frMatching from '@/i18n/locales/fr/matching.json'
import itMatching from '@/i18n/locales/it/matching.json'
import {
  aDesCompatiblesAProposer, compatiblesDuFil, etatCompatible, lienCompatible, STATUTS_COMPATIBLES, trierCompatibles,
  versCompatible, type Compatible, type EtatCompatible,
} from '@/components/matching-fil/filQuiPour'
import { DELAI_RECHERCHE_MS, etatAcquereurs } from '@/components/crm/biens/nouveau/acquereurs'
import { dateCourte, texteEtatCompatible } from '@/components/matching-fil/filAffichage'
import { MOTIFS_REFUS } from '@/components/matching-fil/filBoucle'

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

describe('lot E1 — « Qui pour ce bien ? » du fil compte comme les fiches, sans les refus (décision 13a)', () => {
  // Ce que le fil connaît d'un mandat : ses matchs à proposer (sans suivi s'ils n'ont jamais été proposés) et sa boucle,
  // refus compris — le fil les lit pour « Apprendre ».
  const surLeBien = (c: Compatible, bienId = 'p1') => ({ ...c, bien: { id: bienId } })
  const connus = [
    surLeBien({ ...base, id: 'm-jamais' }),
    surLeBien({ ...suivi('suggested', { motif: 'prix', prixPropose: 3_450_000 }), id: 'm-revenu' }),
    surLeBien({ ...base, id: 'm-reporte', reporteJusquau: '2026-09-30T00:00:00Z' }),
    surLeBien({ ...suivi('sent'), id: 'm-propose' }),
    surLeBien({ ...suivi('interested'), id: 'm-interesse' }),
    surLeBien({ ...suivi('visit_planned'), id: 'm-visite' }),
    surLeBien({ ...suivi('rejected', { motif: 'quartier' }), id: 'm-refus' }),
    surLeBien({ ...base, id: 'm-autre-bien' }, 'p2'),
    { ...base, id: 'm-annonce', bien: { id: 'p1', marche: { ref: 'MG-FL-1', sourceUrl: null } } },
  ]

  it('un refus sort de la liste, donc du compte ; un match jamais proposé reste', () => {
    const compatibles = compatiblesDuFil(connus, 'p1')
    expect(compatibles.map((m) => m.id)).toEqual(['m-jamais', 'm-revenu', 'm-reporte', 'm-propose', 'm-interesse', 'm-visite'])
    // Le panneau titre « N acquéreurs compatibles » sur ce qu'on lui passe (`QuiPourCeBien`) : 6, pas 7.
    expect(trierCompatibles(compatibles)).toHaveLength(6)
  })

  it('un statut passe s’il est dans `STATUTS_COMPATIBLES`, la liste des fiches, et seulement alors', () => {
    for (const statut of ['suggested', 'sent', 'interested', 'visit_planned', 'rejected'] as const) {
      const garde = compatiblesDuFil([surLeBien({ ...suivi(statut), id: statut })], 'p1').length === 1
      expect(garde, statut).toBe((STATUTS_COMPATIBLES as readonly string[]).includes(statut))
    }
  })
})

describe('lot E1 — sur la fiche d’un mandat qui n’est plus en vente, « Ouvrir » ne mène plus à « À proposer » (décision 12a)', () => {
  const vendu = { marche: false, occasion: false }
  const enVente = { marche: false, occasion: true }

  it('un acquéreur à proposer, revenu ou reporté ne mène nulle part : le fil ne propose plus ce mandat', () => {
    expect(lienCompatible(base, vendu, T)).toBeNull()
    expect(lienCompatible(suivi('suggested', { motif: 'prix', prixPropose: 3_450_000 }), vendu, T)).toBeNull()
    expect(lienCompatible({ ...base, reporteJusquau: '2026-09-30T00:00:00Z' }, vendu, T)).toBeNull()
    // En vente, le même mène à sa ligne d'« À proposer ».
    expect(lienCompatible(base, enVente, T)).toBe('ligne=m1&contact=c1')
  })

  it('un proposé ou un intéressé garde sa place : « Retours de … » et « À conclure » gardent le mandat', () => {
    expect(lienCompatible(suivi('sent'), vendu, T)).toBe('attente=c1')
    expect(lienCompatible(suivi('interested'), vendu, T)).toBe('onglet=aConclure&ligne=m1&contact=c1')
  })

  it('une annonce retirée suit la même règle : son acquéreur à proposer n’a plus de ligne « Marché »', () => {
    expect(lienCompatible(base, { marche: true, occasion: false }, T)).toBeNull()
    expect(lienCompatible(base, { marche: true, occasion: true }, T)).toBe('ligne=marche%3Ac1&contact=c1')
    expect(lienCompatible(suivi('sent'), { marche: true, occasion: false }, T)).toBe('attente=c1')
  })

  it('la ligne qui dit pourquoi ne parle que si un compatible listé est à proposer', () => {
    // Un brouillon sans compatible, un mandat vendu dont les acquéreurs sont tous en cours : rien à expliquer.
    expect(aDesCompatiblesAProposer([])).toBe(false)
    expect(aDesCompatiblesAProposer([suivi('sent'), suivi('interested'), suivi('visit_planned')])).toBe(false)
    // Un à proposer, revenu ou reporté perd « Ouvrir » : la ligne le dit.
    expect(aDesCompatiblesAProposer([suivi('sent'), base])).toBe(true)
    expect(aDesCompatiblesAProposer([suivi('suggested', { motif: 'prix', prixPropose: 3_450_000 })])).toBe(true)
    expect(aDesCompatiblesAProposer([{ ...base, reporteJusquau: '2026-09-30T00:00:00Z' }])).toBe(true)
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

  it('lot E1 : le panneau du fil trie par la règle des fiches, et la fiche d’un mandat dit s’il est encore en vente', () => {
    expect(source('src/components/matching-fil/MatchingFil.tsx')).toMatch(/compatiblesDuFil\(\[\.\.\.visibles, \.\.\.visiblesBoucle\], bienQuiPour\)/)
    // La règle du fil (`enVente`, `versBien`) : un mandat est en vente s'il est `active` ; la fiche ne lit pas un mandat
    // supprimé (`useProperty`).
    expect(source('src/pages/agent/ListingDetailPage.tsx')).toMatch(/horsVente=\{bien\.status !== 'active'\}/)
    expect(source('src/components/matching-fil/QuiPourFiche.tsx')).toMatch(/occasion: !retiree && !horsVente/)
    // La ligne d'un mandat hors vente ne se montre que si elle explique un « Ouvrir » absent.
    expect(source('src/components/matching-fil/QuiPourFiche.tsx'))
      .toMatch(/\{horsVente && aDesCompatiblesAProposer\(compatibles\) && <p style=\{aide\}>\{t\('fil\.quiPour\.horsVente'\)\}<\/p>\}/)
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

describe('le nouveau mandat', () => {
  it('cherche, puis compte, ou dit qu’il n’y a personne après 30 secondes', () => {
    expect(DELAI_RECHERCHE_MS).toBe(30_000)
    expect(etatAcquereurs(null, false, false)).toEqual({ genre: 'recherche' })
    expect(etatAcquereurs(0, false, false)).toEqual({ genre: 'recherche' })
    expect(etatAcquereurs(0, true, false)).toEqual({ genre: 'aucun' })
    expect(etatAcquereurs(4, true, false)).toEqual({ genre: 'trouves', nombre: 4 })
    // Un compte en échec n'est pas « aucun » : ce serait une affirmation fausse.
    expect(etatAcquereurs(null, true, true)).toEqual({ genre: 'erreur' })
  })

  it('des acquéreurs trouvés se disent AVANT les 30 secondes, et l’emportent sur une erreur', () => {
    // Le chemin nominal : une version qui lirait `ecoule` en premier passerait le test précédent, tout en affichant
    // « Recherche… » pendant 30 s devant 4 acheteurs déjà trouvés.
    expect(etatAcquereurs(4, false, false)).toEqual({ genre: 'trouves', nombre: 4 })
    // Un rafraîchissement en échec garde ses données : 4 acheteurs lus restent 4 acheteurs.
    expect(etatAcquereurs(4, false, true)).toEqual({ genre: 'trouves', nombre: 4 })
    expect(etatAcquereurs(0, false, true)).toEqual({ genre: 'erreur' })
  })
})

describe('texteEtatCompatible — un état s’écrit partout de la même façon (« Qui pour ce bien ? », fiche d’affaire)', () => {
  // Le faux `t` MARQUE ce qu'il traduit (‹clé›), ses valeurs accolées en JSON : on lit la clé choisie, ce qu'elle
  // reçoit, et qu'un motif passe bien par `t`.
  const t = ((cle: string, o?: Record<string, unknown>) => (o ? `‹${cle}› ${JSON.stringify(o)}` : `‹${cle}›`)) as unknown as TFunction

  it('chaque état a sa clé, et ses valeurs écrites — une date courte, un montant, un motif traduit', () => {
    expect(texteEtatCompatible({ cle: 'reporte', date: '2026-10-03T08:00:00Z' }, false, t)).toBe('‹fil.quiPour.etat.reporte› {"date":"03.10"}')
    expect(texteEtatCompatible({ cle: 'revenu', prix: 1_560_000 }, false, t)).toBe(`‹fil.quiPour.etat.revenu› {"prix":"CHF 1'560'000"}`)
    expect(texteEtatCompatible({ cle: 'propose', date: '2026-09-24T08:00:00Z' }, false, t)).toBe('‹fil.quiPour.etat.propose› {"date":"24.09"}')
    expect(texteEtatCompatible({ cle: 'refuse', motif: 'fil.motifs.prix' }, false, t)).toBe('‹fil.quiPour.etat.refuse› {"motif":"‹fil.motifs.prix›"}')
    for (const cle of ['aProposer', 'proposeSansDate', 'interesse', 'visite', 'refuseSansMotif'] as const) {
      expect(texteEtatCompatible({ cle }, false, t)).toBe(`‹fil.quiPour.etat.${cle}›`)
    }
  })

  it('le prix d’un revenu en location se dit par mois', () => {
    expect(texteEtatCompatible({ cle: 'revenu', prix: 2_950 }, true, t))
      .toBe(`‹fil.quiPour.etat.revenu› ${JSON.stringify({ prix: `‹fil.valeurs.parMois› ${JSON.stringify({ valeur: "CHF 2'950" })}` })}`)
  })

  it('dans les quatre langues, chaque état s’écrit en toutes lettres, avec ses valeurs — chaque motif de refus compris', () => {
    // `filAffichage.ts` est un module pur : la porte `lint:i18n-keys` ne le lit pas (elle ne collecte que les fichiers qui
    // appellent `useTranslation`). Les clés `fil.quiPour.etat.*` sont donc gardées ICI, avec un vrai i18next.
    const REPORTE = '2026-10-03T08:00:00Z'
    const PROPOSE = '2026-09-24T08:00:00Z'
    // Ce que chaque texte doit porter en plus de ses lettres : sa valeur écrite, s'il en a une.
    const etats: [EtatCompatible, string | null][] = [
      [{ cle: 'reporte', date: REPORTE }, dateCourte(REPORTE)], [{ cle: 'aProposer' }, null],
      [{ cle: 'revenu', prix: 1_560_000 }, "1'560'000"], [{ cle: 'propose', date: PROPOSE }, dateCourte(PROPOSE)],
      [{ cle: 'proposeSansDate' }, null], [{ cle: 'interesse' }, null], [{ cle: 'visite' }, null],
      [{ cle: 'refuseSansMotif' }, null],
      ...MOTIFS_REFUS.map((m): [EtatCompatible, string | null] => [{ cle: 'refuse', motif: `fil.motifs.${m}` }, null]),
    ]
    for (const [lng, matching] of Object.entries({ fr: frMatching, en: enMatching, de: deMatching, it: itMatching })) {
      const i18n = i18next.createInstance()
      void i18n.init({
        lng, fallbackLng: false, resources: { [lng]: { matching } }, ns: ['matching'], defaultNS: 'matching',
        initImmediate: false, interpolation: { escapeValue: false },
      })
      const tLangue = i18n.getFixedT(lng, 'matching')
      for (const [e, valeur] of etats) {
        for (const location of [false, true]) {
          const texte = texteEtatCompatible(e, location, tLangue)
          const cas = `${lng} · ${e.cle}${e.cle === 'refuse' ? ` · ${e.motif}` : ''}${location ? ' · location' : ''}`
          expect(texte, cas).not.toMatch(/\bfil\.[A-Za-z]|\{\{|\}\}/)
          expect(texte, cas).toMatch(/\p{L}/u)
          if (valeur) expect(texte, cas).toContain(valeur)
        }
      }
    }
  })
})
