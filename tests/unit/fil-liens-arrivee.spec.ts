/**
 * Les liens d'arrivée du fil (lot D1, conception §4) : ce qu'une surface écrit, le fil le relit ; rien d'inconnu ne
 * casse le fil ; une ligne absente de l'ordre ne choisit rien d'autre que le défaut.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  estArriveeFil, lienFil, lienPlace, ligneCourante, lireArrivee, PARAM_QUI_POUR,
} from '@/components/matching-fil/filLiens'

const lire = (q: string) => lireArrivee(new URLSearchParams(q))
const SANS = { bienId: null, acheteurId: null, texte: '' }

describe('lireArrivee', () => {
  it('sans paramètre du fil, le fil garde ce qu’il avait retenu', () => {
    expect(lire('')).toEqual({ filtres: null, onglet: null, ligne: null })
    expect(lire('page=2')).toEqual({ filtres: null, onglet: null, ligne: null })
  })

  it('les deux liens d’hier gardent leur sens', () => {
    expect(lire('contact=c1')).toEqual({ filtres: { ...SANS, acheteurId: 'c1' }, onglet: null, ligne: null })
    expect(lire('annonce=p:b1')).toEqual({ filtres: { ...SANS, bienId: 'b1' }, onglet: null, ligne: null })
  })

  it('une annonce du marché ne filtre pas : `m:` n’est pas construit', () => {
    expect(lire('annonce=m:ml1').filtres).toEqual(SANS)
  })

  it('`?attente=` ouvre « Retours de … » dans « En attente », filtré sur l’acheteur', () => {
    expect(lire('attente=c7')).toEqual({ filtres: { ...SANS, acheteurId: 'c7' }, onglet: 'enAttente', ligne: 'attente:c7' })
    // Il l'emporte sur un onglet et une ligne contradictoires.
    expect(lire('attente=c7&onglet=aConclure&ligne=m1')).toMatchObject({ onglet: 'enAttente', ligne: 'attente:c7' })
    // Il l'emporte aussi sur le filtre : `contact=c9` ne doit pas primer sur l'acheteur de la relance.
    expect(lire('attente=c7&contact=c9')).toMatchObject({ onglet: 'enAttente', ligne: 'attente:c7', filtres: { acheteurId: 'c7' } })
  })

  it('une ligne sans onglet ouvre « À proposer »', () => {
    expect(lire('ligne=m5&contact=c10')).toEqual({ filtres: { ...SANS, acheteurId: 'c10' }, onglet: 'aProposer', ligne: 'm5' })
  })

  it('un onglet inconnu ne casse rien : il est ignoré, et les filtres retenus cèdent quand même', () => {
    expect(lire('onglet=nimporte')).toEqual({ filtres: SANS, onglet: null, ligne: null })
    expect(lire('onglet=aConclure&ligne=m2')).toMatchObject({ onglet: 'aConclure', ligne: 'm2' })
  })

  it('une valeur vide ne compte pas', () => {
    expect(lire('ligne=&contact=%20')).toEqual({ filtres: SANS, onglet: null, ligne: null })
  })
})

describe('lienFil ↔ lireArrivee', () => {
  it.each([
    [{ attente: 'c7' }, { onglet: 'enAttente', ligne: 'attente:c7', acheteurId: 'c7' }],
    [{ ligne: 'm5', contact: 'c10' }, { onglet: 'aProposer', ligne: 'm5', acheteurId: 'c10' }],
    [{ onglet: 'aConclure' as const, ligne: 'm17', contact: 'c7' }, { onglet: 'aConclure', ligne: 'm17', acheteurId: 'c7' }],
    [{ ligne: 'marche:c11', contact: 'c11' }, { onglet: 'aProposer', ligne: 'marche:c11', acheteurId: 'c11' }],
    [{ onglet: 'aProposer' as const, contact: 'c1' }, { onglet: 'aProposer', ligne: null, acheteurId: 'c1' }],
  ])('ce qu’une surface écrit, le fil le relit (%o)', (cible, attendu) => {
    const a = lireArrivee(new URLSearchParams(lienFil(cible)))
    expect({ onglet: a.onglet, ligne: a.ligne, acheteurId: a.filtres?.acheteurId }).toEqual(attendu)
  })

  it('« À proposer » ne s’écrit pas', () => {
    expect(lienFil({ onglet: 'aProposer', ligne: 'm5' })).toBe('ligne=m5')
  })

  it('un mandat : le fil filtré sur lui (`?annonce=p:`) ; `?attente=` l’emporte, comme sur le filtre acheteur', () => {
    expect(lireArrivee(new URLSearchParams(lienFil({ onglet: 'aProposer', bien: 'b1' })))).toEqual({
      filtres: { ...SANS, bienId: 'b1' }, onglet: 'aProposer', ligne: null,
    })
    expect(lienFil({ attente: 'c7', bien: 'b1' })).toBe('attente=c7')
  })

  it('« Proposer à des acheteurs », sur la fiche d’un mandat en vente, ouvre « À proposer » filtré sur lui', () => {
    expect(readFileSync(join(process.cwd(), 'src/pages/agent/ListingDetailPage.tsx'), 'utf8')).toMatch(
      /\{bien\.status === 'active' && \(\s*<BfCta vx=\{vx\} onClick=\{\(\) => navigate\(`\/dashboard\/matching\?\$\{lienFil\(\{ onglet: 'aProposer', bien: bien\.id \}\)\}`, avecArrivee\(\)\)\}>\{tr\('fiche\.cta\.propose'\)\}/,
    )
  })

  it('le pager atterrit sur le fil pour chaque lien', () => {
    for (const q of ['contact=c1', 'annonce=p:b1', 'onglet=enAttente', 'ligne=m1', 'attente=c7']) {
      expect(estArriveeFil(new URLSearchParams(q)), q).toBe(true)
    }
    expect(estArriveeFil(new URLSearchParams('page=1'))).toBe(false)
  })

  it('le paramètre des fiches', () => {
    expect(PARAM_QUI_POUR).toBe('qui')
  })
})

describe('lienPlace', () => {
  const base = { id: 'm1', contactId: 'c1', marche: false, reporte: false }
  it('à chaque statut sa place', () => {
    expect(lienPlace(base)).toBe('ligne=m1&contact=c1')
    expect(lienPlace({ ...base, statut: 'suggested', marche: true })).toBe('ligne=marche%3Ac1&contact=c1')
    expect(lienPlace({ ...base, statut: 'sent' })).toBe('attente=c1')
    expect(lienPlace({ ...base, statut: 'interested' })).toBe('onglet=aConclure&ligne=m1&contact=c1')
  })
  it('le fil ne porte plus un refus, une visite planifiée ni un écarté', () => {
    for (const statut of ['rejected', 'visit_planned', 'ignored']) expect(lienPlace({ ...base, statut }), statut).toBeNull()
  })
  it('un suggested reporté ne mène nulle part — hors de l’ordre du fil (`construireFil`)', () => {
    expect(lienPlace({ ...base, statut: 'suggested', reporte: true })).toBeNull()
    expect(lienPlace({ ...base, reporte: true })).toBeNull()
    expect(lienPlace({ ...base, reporte: false })).toBe('ligne=m1&contact=c1')
  })
})

describe('ligneCourante', () => {
  const ordre = ['correction:cs9:prix', 'bien:p3', 'm22', 'marche:c11']
  it('le choix, s’il est dans l’ordre', () => {
    expect(ligneCourante('marche:c11', ordre)).toBe('marche:c11')
    expect(ligneCourante('bien:p3', ordre)).toBe('bien:p3')
  })
  it('une clé absente ne choisit rien d’autre que le défaut : la première ligne à traiter, pas un en-tête de bien', () => {
    expect(ligneCourante('m999', ordre)).toBe('correction:cs9:prix')
    expect(ligneCourante('m999', ['bien:p3', 'm22'])).toBe('m22')
    expect(ligneCourante(null, [])).toBeNull()
  })
})
