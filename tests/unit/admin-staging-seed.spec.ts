// Le jeu de données synthétique de la console (étape 15, spec §10.8), éprouvé SANS base.
//
// Le générateur est pur : c'est ce qui permet de le tester ici, en unitaire, plutôt qu'en
// CI backend. Ce fichier vérifie trois choses que le script d'application ne peut pas
// vérifier lui-même :
//
//   1. LE DÉTERMINISME. « Versionné » ne veut rien dire si deux exécutions produisent deux
//      jeux différents : on ne pourrait ni rejouer une démo, ni comparer deux mesures de
//      performance d'un jour sur l'autre.
//   2. LA COUVERTURE DES ÉTATS D'ÉCRAN. Un seed qui ne produirait que des agences saines
//      laisserait les files du poste de triage vides et la règle de MRR jamais exercée —
//      la démo du gate G1 montrerait un écran qui marche par chance.
//   3. LA CONFORMITÉ nLPD ET C2. Aucune donnée routable, et la grille à TROIS plans, pas
//      les quatre prix de démonstration que §5.7 proscrit.

import { describe, it, expect } from 'vitest'
// @ts-expect-error — helper de scripts, en JS pur : c'est le runtime Node, pas le bundle.
import { genererSeed, PLANS, DOMAINE } from '../../scripts/_shared/admin-staging-seed.mjs'

interface Agence {
  slug: string; nom: string; ville: string; canton: string
  plan: string; statut: string; sub: string | null; periode: string | null
  anciennete: number; sieges: number; evenements: number
}
interface Compte {
  agence: string; role: string; email: string; nomComplet: string
  jamaisConnecte: boolean; inactifDepuisJours: number
}
interface Seed { agences: Agence[]; comptes: Compte[]; meta: Record<string, unknown> }

const seed = (): Seed => genererSeed() as Seed

describe('seed staging de la console (étape 15)', () => {
  it('LE DÉTERMINISME — deux générations rendent le même jeu', () => {
    // Sans cette propriété, « seed synthétique VERSIONNÉ » est un abus de langage.
    expect(seed()).toEqual(seed())
  })

  it('rend exactement 14 agences et 56 comptes (§10.8)', () => {
    const s = seed()
    expect(s.agences).toHaveLength(14)
    expect(s.comptes).toHaveLength(56)
    // Le total de comptes doit être la somme des sièges déclarés, pas un nombre choisi
    // pour tomber juste : sinon ajouter une agence désaccorderait les deux en silence.
    const sieges = s.agences.reduce((n, a) => n + a.sieges, 0)
    expect(s.comptes.length, 'comptes = somme des sièges').toBe(sieges)
  })

  it('LA GRILLE C2 — trois plans, jamais les quatre de la démonstration', () => {
    const s = seed()
    expect(PLANS).toEqual(['starter', 'pro', 'entreprise'])
    // « agency » / « enterprise » sont les valeurs de l'enum agencies.plan qui n'ont AUCUN
    // prix au catalogue (décision PO n° 3, ouverte). Les semer produirait un MRR faux.
    for (const a of s.agences) {
      expect(PLANS, `l'agence ${a.slug} porte un plan hors catalogue : ${a.plan}`).toContain(a.plan)
    }
    // Les trois plans sont représentés, sinon un pan de l'écran Plans reste non exercé.
    expect(new Set(s.agences.map((a) => a.plan))).toEqual(new Set(PLANS))
  })

  it('LA COUVERTURE — chaque état des écrans est atteignable', () => {
    const s = seed()
    const subs = s.agences.map((a) => a.sub)

    // Les deux files du poste de triage (§5.7) doivent être non vides à la démo.
    expect(subs, 'la file des essais').toContain('trialing')
    expect(subs, 'la file des impayés').toContain('past_due')
    expect(subs, 'un abonnement résilié ne compte plus').toContain('canceled')
    expect(subs, 'sans abonnement — le cas le plus fréquent en production').toContain(null)

    // La règle de MRR de §4.3 n'est éprouvée que si une agence SUSPENDUE existe.
    expect(s.agences.some((a) => a.statut === 'suspended'), 'au moins une agence suspendue').toBe(true)

    // « Dormante » exige plus de 30 jours : créer une agence émet un `activity_events`, et
    // la table refuse l'UPDATE — une agence récente a forcément une activité récente.
    expect(s.agences.some((a) => a.anciennete > 30), 'une agence assez ancienne pour dormir').toBe(true)

    // Les deux états de compte de §5.4.
    expect(s.comptes.some((c) => c.jamaisConnecte), '« invité, jamais connecté »').toBe(true)
    expect(s.comptes.some((c) => c.inactifDepuisJours >= 30), 'un compte au-delà du seuil de 30 j').toBe(true)

    // Les quatre rôles, sinon le registre Utilisateurs n'a qu'une seule couleur.
    expect(new Set(s.comptes.map((c) => c.role)))
      .toEqual(new Set(['admin', 'manager', 'agent', 'assistant']))
  })

  it('chaque agence a exactement un administrateur', () => {
    // Anti-lockout : §5.4 refuse de rétrograder le dernier admin d'une agence active. Un
    // seed sans admin rendrait ce garde-fou intestable.
    const s = seed()
    for (const a of s.agences) {
      const admins = s.comptes.filter((c) => c.agence === a.slug && c.role === 'admin')
      expect(admins, `l'agence ${a.slug} doit avoir un et un seul admin`).toHaveLength(1)
    }
  })

  it('nLPD — rien de routable, rien d\'emprunté à la production', () => {
    const s = seed()
    expect(DOMAINE).toBe('megga-staging.invalid')
    for (const c of s.comptes) {
      // `.invalid` est réservé par la RFC 2606 : aucun de ces comptes ne peut recevoir de
      // courrier par accident, même si une intégration se trompait d'environnement.
      expect(c.email, `${c.email} doit être non routable`).toMatch(/@megga-staging\.invalid$/)
      // Et surtout pas le domaine allowlisté super-admin, qui promouvrait ces comptes.
      expect(c.email).not.toContain('megga-test.local')
      expect(c.email).not.toContain('@megga.ch')
    }
    // Les adresses sont uniques : deux comptes homonymes restent deux comptes.
    expect(new Set(s.comptes.map((c) => c.email)).size).toBe(s.comptes.length)
    expect(new Set(s.agences.map((a) => a.slug)).size).toBe(s.agences.length)
  })

  it('le volume d\'activité est borné et reproductible', () => {
    const s = seed()
    for (const a of s.agences) {
      expect(a.evenements, `${a.slug} : volume hors bornes`).toBeGreaterThanOrEqual(20)
      expect(a.evenements).toBeLessThan(80)
    }
    // Reproductible : la même agence porte le même volume d'une génération à l'autre.
    expect(seed().agences.map((a) => a.evenements)).toEqual(s.agences.map((a) => a.evenements))
  })
})
