/**
 * Garde-fou : les filtres et regroupements de « Mes biens » (`src/lib/biensFiltres.ts`).
 *
 * Ce qu'ils doivent tenir, et qu'un écran ne montre pas d'un coup d'œil : un critère vide
 * ne retire rien ; deux critères se CUMULENT ; « l'agence du compte » est la valeur vide
 * de `partner_agency`, et passe en TÊTE quand on regroupe par agence ; « non renseigné »
 * passe en dernier partout ailleurs.
 */
import { describe, it, expect } from 'vitest'
import type { CrmBien } from '@/components/crm/mockData'
import { FILTRES_VIDES, filtrerBiens, grouperBiens, nombreFiltresActifs, valeursPresentes } from '@/lib/biensFiltres'

const MAINTENANT = Date.parse('2026-09-16T12:00:00Z')
const dansJours = (j: number) => new Date(MAINTENANT + j * 86_400_000).toISOString()

function bien(p: Partial<CrmBien> & { id: string }): CrmBien {
  return {
    ref: p.id, status: 'active', type: 'appartement', transaction: 'vente', title: p.id, addr: '', canton: 'GE',
    price: 1_000_000, rent: null, charges: null, area: 100, rooms: 4, beds: 3, baths: 1, year: 2000, energy: '',
    ownerContactId: null, mandat: { type: 'simple' }, visibility: 'agency', stats: { views: 0, favorites: 0, visitRequests: 0 },
    photoCount: 0, signedPhotoCount: 0, accent: '', ...p,
  }
}

const BIENS = [
  bien({ id: 'a', canton: 'GE', city: 'Genève', agentId: 'u1', partnerAgency: null, price: 1_450_000, rooms: 4.5, mandat: { type: 'exclusif', expiresAt: dansJours(20) } }),
  bien({ id: 'b', canton: 'VD', city: 'Lausanne', agentId: 'u2', partnerAgency: 'naef', price: 820_000, rooms: 3.5, mandat: { type: 'simple', expiresAt: dansJours(200) } }),
  bien({ id: 'c', canton: 'GE', city: 'Carouge', agentId: 'u2', partnerAgency: 'cardis', transaction: 'location', price: null, rent: 2_450, rooms: 2.5 }),
  bien({ id: 'd', canton: '', city: undefined, agentId: null, partnerAgency: null, status: 'draft', price: null, rooms: 0 }),
]
const ids = (bs: CrmBien[]) => bs.map((b) => b.id)

describe('Mes biens — filtres', () => {
  it('sans critère, rien n’est retiré', () => {
    expect(ids(filtrerBiens(BIENS, FILTRES_VIDES, MAINTENANT))).toEqual(['a', 'b', 'c', 'd'])
    expect(nombreFiltresActifs(FILTRES_VIDES)).toBe(0)
  })

  it('les valeurs d’un même axe s’additionnent, deux axes se cumulent', () => {
    const f = { ...FILTRES_VIDES, cantons: ['GE', 'VD'], agents: ['u2'] }
    expect(ids(filtrerBiens(BIENS, f, MAINTENANT))).toEqual(['b', 'c'])
    expect(nombreFiltresActifs(f)).toBe(3)
  })

  it('« l’agence du compte » est la valeur vide de partner_agency', () => {
    expect(ids(filtrerBiens(BIENS, { ...FILTRES_VIDES, agences: [''] }, MAINTENANT))).toEqual(['a', 'd'])
    expect(ids(filtrerBiens(BIENS, { ...FILTRES_VIDES, agences: ['naef', 'cardis'] }, MAINTENANT))).toEqual(['b', 'c'])
  })

  it('le prix compare la vente, sinon le loyer ; un bien sans prix sort dès qu’une borne est posée', () => {
    expect(ids(filtrerBiens(BIENS, { ...FILTRES_VIDES, prixMin: 1_000_000 }, MAINTENANT))).toEqual(['a'])
    expect(ids(filtrerBiens(BIENS, { ...FILTRES_VIDES, prixMax: 5_000 }, MAINTENANT))).toEqual(['c'])
  })

  it('pièces minimum et mandat qui expire bientôt', () => {
    expect(ids(filtrerBiens(BIENS, { ...FILTRES_VIDES, piecesMin: 3 }, MAINTENANT))).toEqual(['a', 'b'])
    expect(ids(filtrerBiens(BIENS, { ...FILTRES_VIDES, mandatBientot: true }, MAINTENANT))).toEqual(['a'])
  })

  it('la palette compte chaque valeur présente', () => {
    expect([...valeursPresentes(BIENS, 'canton')]).toEqual([['GE', 2], ['VD', 1], ['', 1]])
  })
})

describe('Mes biens — regroupements', () => {
  const libelle = (c: string) => ({ naef: 'Naef Immobilier', cardis: "Cardis Sotheby's", GE: 'Genève', VD: 'Vaud' } as Record<string, string>)[c] ?? c

  it('par agence : l’agence du compte en tête, puis les partenaires par nom', () => {
    const g = grouperBiens(BIENS, 'agence', libelle, 'fr-CH')
    expect(g.map((x) => x.cle)).toEqual(['', 'cardis', 'naef'])
    expect(ids(g[0].biens)).toEqual(['a', 'd'])
  })

  it('ailleurs, « non renseigné » passe en dernier', () => {
    expect(grouperBiens(BIENS, 'canton', libelle, 'fr-CH').map((x) => x.cle)).toEqual(['GE', 'VD', ''])
    expect(grouperBiens(BIENS, 'agent', libelle, 'fr-CH').map((x) => x.cle)).toEqual(['u1', 'u2', ''])
  })

  it('par statut : dans l’ordre de vie d’une annonce, pas l’alphabet', () => {
    expect(grouperBiens(BIENS, 'statut', libelle, 'fr-CH').map((x) => x.cle)).toEqual(['active', 'draft'])
  })
})
