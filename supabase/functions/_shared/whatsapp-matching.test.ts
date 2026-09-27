/**
 * Le modèle PUR du matching dans le copilote WhatsApp (lot D2), éprouvé sans base.
 *
 * Ce que ces tests refusent : un bien choisi parmi plusieurs candidats, un refusé ou un reporté rendu par
 * `get_matches`, un état faux, un signal inventé, plus de huit biens ou de dix acheteurs, une annulation de visite qui
 * défairait ce que la visite n'a pas posé. La confrontation aux règles du fil vit dans
 * `tests/unit/whatsapp-matching-fil.spec.ts`.
 */
import { describe, it, expect } from 'vitest'
import {
  bienDAnnonce, bienDeMandat, bienEnClair, candidats, etatMatch, expliquer, motsDe, retourDeVisite, signalEnClair,
  signalMatch, vueAcheteurs, vueGetMatches, MAX_BIENS, MAX_ACHETEURS, type BienWa, type LigneAnnonce, type LigneMandat,
  type LigneMatch,
} from './whatsapp-matching'

const MAINTENANT = Date.parse('2026-09-24T08:00:00Z')
const ilYA = (jours: number) => new Date(MAINTENANT - jours * 86_400_000).toISOString()
const dans = (jours: number) => new Date(MAINTENANT + jours * 86_400_000).toISOString()

const annonce = (o: Partial<LigneAnnonce> = {}): LigneAnnonce => ({
  id: 'a1', title: 'Attique 4 p. Florissant', type: 'apartment', transaction_type: 'buy', price: 1_500_000,
  current_price: null, rooms: 4, surface_m2: 120, bedrooms: 3, address: 'Route de Florissant 12', city: 'Genève',
  canton: 'GE', features: ['Terrasse', 'Ascenseur'], year_built: 2019, year_renovated: null, first_seen_at: ilYA(60),
  price_at_first_seen: 1_500_000, price_reduced_at: null, status: 'active', ...o,
})
const mandat = (o: Partial<LigneMandat> = {}): LigneMandat => ({
  id: 'p1', title: 'Villa contemporaine', type: 'house', transaction_type: 'buy', price: 4_200_000, rooms: 7,
  surface_m2: 280, bedrooms: 5, address: 'Chemin des Hauts 3', city: 'Cologny', canton: 'GE', features: { piscine: true },
  condition: 'renovated', year_built: 1995, off_market: true, mandate_signed_at: null, published_at: ilYA(40), status: 'active', ...o,
})
const match = (o: Partial<LigneMatch> = {}): LigneMatch => ({
  id: 'm1', contact_id: 'c1', status: 'suggested', score: 80, reasons: null, client_search_id: null,
  property_id: null, market_listing_id: 'a1', snoozed_until: null, sent_at: null, response_at: null,
  reaction_motif: null, reaction_note: null, prix_propose: null, created_at: ilYA(30), ...o,
})

describe('etatMatch — où en est un acheteur', () => {
  it('à proposer, reporté (le report ne vaut que pour un match à proposer), revenu', () => {
    expect(etatMatch(match(), MAINTENANT)).toEqual({ code: 'a_proposer' })
    expect(etatMatch(match({ snoozed_until: dans(3) }), MAINTENANT)).toEqual({ code: 'reporte', jusqua: '27.09.2026' })
    // Un report échu ne compte plus.
    expect(etatMatch(match({ snoozed_until: ilYA(1) }), MAINTENANT)).toEqual({ code: 'a_proposer' })
    expect(etatMatch(match({ reaction_motif: 'prix', prix_propose: 1_700_000 }), MAINTENANT)).toEqual({ code: 'revenu', refuse_a: "CHF 1'700'000" })
    // Revenu pour un autre motif que le prix : rien ne le distingue d'un match à proposer.
    expect(etatMatch(match({ reaction_motif: 'quartier', prix_propose: 1_700_000 }), MAINTENANT)).toEqual({ code: 'a_proposer' })
  })

  it('proposé (avec sa date), intéressé, visite, refusé avec ou sans motif lisible', () => {
    expect(etatMatch(match({ status: 'sent', sent_at: ilYA(2), snoozed_until: dans(3) }), MAINTENANT)).toEqual({ code: 'propose', le: '22.09.2026' })
    expect(etatMatch(match({ status: 'interested' }), MAINTENANT)).toEqual({ code: 'interesse' })
    expect(etatMatch(match({ status: 'visit_planned' }), MAINTENANT)).toEqual({ code: 'visite' })
    expect(etatMatch(match({ status: 'rejected', reaction_motif: 'prix' }), MAINTENANT)).toEqual({ code: 'refuse', motif: 'prix' })
    expect(etatMatch(match({ status: 'rejected', reaction_motif: 'recherche_ajustee' }), MAINTENANT)).toEqual({ code: 'refuse', motif: null })
  })
})

describe('candidats — le copilote ne choisit jamais entre plusieurs biens', () => {
  const biens = [
    { id: '11111111-1111-4111-8111-111111111111', titre: 'Attique 4 p.', adresse: 'Route de Florissant 12', ville: 'Genève' },
    { id: '22222222-2222-4222-8222-222222222222', titre: 'Appartement 3 p.', adresse: 'Route de Florissant 40', ville: 'Genève' },
    { id: '33333333-3333-4333-8333-333333333333', titre: 'Villa contemporaine', adresse: 'Chemin des Hauts 3', ville: 'Cologny' },
  ]

  it('tous les mots du texte, accents et casse ignorés ; un début de mot à partir de quatre lettres', () => {
    expect(candidats(biens, "l'attique de Florissant").map((b) => b.titre)).toEqual(['Attique 4 p.'])
    expect(candidats(biens, 'la villa de COLOGNY').map((b) => b.titre)).toEqual(['Villa contemporaine'])
    expect(candidats(biens, 'attiq').map((b) => b.titre)).toEqual(['Attique 4 p.'])
  })

  it('plusieurs biens répondent : tous sont rendus, aucun n’est choisi', () => {
    expect(candidats(biens, 'Florissant')).toHaveLength(2)
  })

  it('un identifiant désigne son bien seul ; un texte sans mot utile ne désigne rien', () => {
    expect(candidats(biens, '33333333-3333-4333-8333-333333333333').map((b) => b.titre)).toEqual(['Villa contemporaine'])
    expect(candidats(biens, 'le bien')).toEqual([])
    expect(motsDe("L'attique de la Route")).toEqual(['attique', 'route'])
  })

  it('un chiffre ne se compare qu’à l’ADRESSE : « Florissant 4 » ne désigne plus rien (le « 4 » du titre ne compte pas), « Florissant 12 » et « Florissant 40 » désignent chacun le bon numéro', () => {
    expect(candidats(biens, 'Florissant 4')).toEqual([])
    expect(candidats(biens, 'Florissant 12').map((b) => b.titre)).toEqual(['Attique 4 p.'])
    expect(candidats(biens, 'Florissant 40').map((b) => b.titre)).toEqual(['Appartement 3 p.'])
  })

  it('« vandoeuvres » trouve « Vandœuvres », par le pliage des ligatures (comme `plier` du fil)', () => {
    const b = [{ id: 'v1', titre: 'Maison', adresse: 'Chemin de la Côte 2', ville: 'Vandœuvres' }]
    expect(candidats(b, 'vandoeuvres').map((x) => x.id)).toEqual(['v1'])
  })
})

describe('bienDAnnonce — le prix courant prime sur le prix affiché', () => {
  it('current_price, quand il existe, l’emporte sur price', () => {
    expect(bienDAnnonce(annonce({ price: 1_000_000, current_price: 950_000 })).prix).toBe(950_000)
    expect(bienDAnnonce(annonce({ price: 1_000_000, current_price: null })).prix).toBe(1_000_000)
  })
})

describe('bienDeMandat — l’étiquette « retiré » et l’éligibilité « occasion » sont deux règles distinctes', () => {
  it('reserved n’est pas retiré, sold l’est', () => {
    expect(bienDeMandat(mandat({ status: 'reserved' })).retire).toBe(false)
    expect(bienDeMandat(mandat({ status: 'sold' })).retire).toBe(true)
  })

  it('seul `active` est une occasion : draft et reserved en sont exclus SANS être « retirés » (règle du point du matin, à confirmer — décision 12, lot D1)', () => {
    expect(bienDeMandat(mandat({ status: 'active' })).occasion).toBe(true)
    expect(bienDeMandat(mandat({ status: 'draft' })).occasion).toBe(false)
    expect(bienDeMandat(mandat({ status: 'reserved' })).occasion).toBe(false)
    expect(bienDeMandat(mandat({ status: 'sold' })).occasion).toBe(false)
  })
})

describe('bienEnClair — dire qu’un bien n’est pas une occasion', () => {
  it('un mandat « reserved » sort avec occasion: false et son statut ; un mandat « active » sort sans ces champs', () => {
    expect(bienEnClair(bienDeMandat(mandat({ status: 'reserved' })))).toMatchObject({ occasion: false, statut: 'reserved' })
    const actif = bienEnClair(bienDeMandat(mandat({ status: 'active' })))
    expect('occasion' in actif).toBe(false)
    expect('statut' in actif).toBe(false)
  })
})

describe('signalMatch — pourquoi maintenant', () => {
  it('la baisse depuis la proposition, ou depuis le refus pour le prix, passe avant celle du bien', () => {
    const bien = bienDAnnonce(annonce({ price: 1_400_000, price_at_first_seen: 1_600_000, price_reduced_at: ilYA(2) }))
    expect(signalMatch(match({ status: 'sent', prix_propose: 1_500_000 }), bien, MAINTENANT)).toEqual({ genre: 'baisse_depuis_proposition', montant: 100_000 })
    expect(signalMatch(match({ reaction_motif: 'prix', prix_propose: 1_550_000 }), bien, MAINTENANT)).toEqual({ genre: 'baisse_depuis_refus', montant: 150_000 })
    expect(signalMatch(match(), bien, MAINTENANT)).toEqual({ genre: 'baisse', montant: 200_000, le: ilYA(2) })
  })

  it('nouveau sur le marché (3 jours), nouveau mandat (7 jours) ; rien au-delà, rien sur un prix nul', () => {
    expect(signalMatch(match(), bienDAnnonce(annonce({ first_seen_at: ilYA(1) })), MAINTENANT)).toEqual({ genre: 'nouveau', le: ilYA(1) })
    expect(signalMatch(match(), bienDAnnonce(annonce({ first_seen_at: ilYA(4) })), MAINTENANT)).toBeNull()
    expect(signalMatch(match(), bienDeMandat(mandat({ published_at: ilYA(2) })), MAINTENANT)).toEqual({ genre: 'nouveau_mandat', le: ilYA(2) })
    expect(signalMatch(match(), bienDeMandat(mandat()), MAINTENANT)).toBeNull()
    expect(signalMatch(match({ status: 'sent', prix_propose: 1_500_000 }), bienDAnnonce(annonce({ price: 0 })), MAINTENANT)).toBeNull()
  })
})

describe('expliquer — le score, critère par critère', () => {
  it('le verdict du moteur pour le budget, un fait pour les pièces ; aucun verdict sans raison du moteur', () => {
    const bien = bienDAnnonce(annonce())
    const lignes = expliquer(
      { budget_max: 1_400_000, rooms_min: 3, zones: ['Genève'] },
      { budget: { match: false, score: 20, detail: '7 % au-dessus du budget' } },
      bien, MAINTENANT,
    )
    expect(lignes.map((l) => [l.critere, l.tenu, l.ecart])).toEqual([
      ['budget', false, '7 % au-dessus du budget'],
      ['zone', null, null],
      ['pieces', true, null],
    ])
    expect(lignes[0].voulu).toBe("≤ CHF 1'400'000")
    expect(lignes[0].bien).toBe("CHF 1'500'000")
  })

  it('l’état se lit par la règle du moteur ; l’off-market sur l’interrupteur du mandat', () => {
    const villa = bienDeMandat(mandat())
    const lignes = expliquer({ condition_min: 'renovated', off_market_only: true }, null, villa, MAINTENANT)
    expect(lignes.map((l) => [l.critere, l.tenu, l.bien])).toEqual([['etat', true, 'renovated'], ['offMarket', true, 'off-market']])
    // Pas de critère dans la recherche : pas de ligne.
    expect(expliquer(null, null, villa, MAINTENANT)).toEqual([])
  })
})

describe('signalEnClair — un signal, en clair', () => {
  it('CHF à apostrophe, date à la suisse, « /mois » pour une location', () => {
    expect(signalEnClair({ genre: 'baisse', montant: 100_000, le: '2026-09-20T00:00:00Z' }, false))
      .toEqual({ genre: 'baisse', montant: "CHF 100'000", le: '20.09.2026' })
    expect(signalEnClair({ genre: 'baisse_depuis_proposition', montant: 200 }, true))
      .toEqual({ genre: 'baisse_depuis_proposition', montant: "CHF 200/mois" })
    expect(signalEnClair(null, false)).toBeNull()
  })
})

describe('vueGetMatches — les biens vivants d’un acheteur', () => {
  const entree = (m: Partial<LigneMatch>, b: BienWa = bienDAnnonce(annonce())) => ({ match: match(m), bien: b, criteres: null })

  it('en cours d’abord (intéressé, visite, proposé), puis à proposer ; un reporté n’y est pas', () => {
    const vue = vueGetMatches([
      entree({ id: 'm-s', score: 99 }),
      entree({ id: 'm-p', status: 'sent', sent_at: ilYA(3) }),
      entree({ id: 'm-i', status: 'interested', sent_at: ilYA(9) }),
      entree({ id: 'm-r', score: 100, snoozed_until: dans(2) }),
    ], MAINTENANT, false)
    expect(vue.biens.map((b) => b.etat.code)).toEqual(['interesse', 'propose', 'a_proposer'])
    // Reportés et à proposer viennent de la même lecture plafonnée : même notation (chaîne, « + » possible).
    expect(vue.total).toEqual({ en_cours: '2', a_proposer: '1', reportes: '1' })
  })

  it('en cours, à même état, le plus récemment PROPOSÉ passe devant — comme « Sa boucle » et « Retours de … » (sent_at décroissant), même si son id trie après', () => {
    // L'id du récent ('m-z') trie APRÈS celui de l'ancien ('m-a') : sans le départage par `sent_at`, l'id seul
    // rendrait l'ordre inverse — ce test ne passerait pas par accident.
    const ancien = bienDAnnonce(annonce({ id: 'a-tot' }))
    const recent = bienDAnnonce(annonce({ id: 'a-tard' }))
    const vue = vueGetMatches([
      entree({ id: 'm-a', status: 'sent', sent_at: ilYA(10) }, ancien),
      entree({ id: 'm-z', status: 'sent', sent_at: ilYA(1) }, recent),
    ], MAINTENANT, false)
    expect(vue.biens.map((b) => b.id)).toEqual(['a-tard', 'a-tot'])
  })

  it('un match refusé n’apparaît jamais (l’en-tête du fichier le promet)', () => {
    const vue = vueGetMatches([entree({ id: 'm-x', status: 'rejected', reaction_motif: 'prix' })], MAINTENANT, false)
    expect(vue.biens).toEqual([])
    expect(vue.total).toEqual({ en_cours: '0', a_proposer: '0', reportes: '0' })
  })

  it('à score égal, un signal passe devant ; huit au plus ; « N+ » quand la lecture a atteint sa limite', () => {
    const neuve = bienDAnnonce(annonce({ id: 'a2', first_seen_at: ilYA(1) }))
    const vue = vueGetMatches([entree({ id: 'm-a', score: 80 }), entree({ id: 'm-b', score: 80, market_listing_id: 'a2' }, neuve)], MAINTENANT, true)
    expect(vue.biens.map((b) => b.id)).toEqual(['a2', 'a1'])
    expect(vue.total.a_proposer).toBe('2+')
    const beaucoup = Array.from({ length: 12 }, (_, i) => entree({ id: `m${String(i).padStart(2, '0')}`, score: 60 + i }))
    expect(vueGetMatches(beaucoup, MAINTENANT, false).biens).toHaveLength(MAX_BIENS)
  })

  it('à score et signal égaux, la création la plus récente passe devant — comme `construireFil` (filModele.ts), même si son id trie après', () => {
    // L'id du récent ('m-z') trie APRÈS celui de l'ancien ('m-a') : sans le départage par `created_at`, l'id seul
    // rendrait l'ordre inverse — ce test ne passerait pas par accident.
    const ancien = bienDAnnonce(annonce({ id: 'a-old' }))
    const recent = bienDAnnonce(annonce({ id: 'a-new' }))
    const vue = vueGetMatches([
      entree({ id: 'm-a', score: 80, created_at: ilYA(10) }, ancien),
      entree({ id: 'm-z', score: 80, created_at: ilYA(1) }, recent),
    ], MAINTENANT, false)
    expect(vue.biens.map((b) => b.id)).toEqual(['a-new', 'a-old'])
  })

  it('un bien retiré n’est plus une occasion : hors « à proposer » et des reportés, gardé « en cours » avec son drapeau', () => {
    const retiree = bienDAnnonce(annonce({ id: 'a3', status: 'removed' }))
    const vue = vueGetMatches([
      entree({ id: 'm-prop' }, retiree),
      entree({ id: 'm-snz', snoozed_until: dans(2) }, retiree),
      entree({ id: 'm-int', status: 'interested' }, retiree),
    ], MAINTENANT, false)
    expect(vue.biens).toHaveLength(1)
    expect(vue.biens[0]).toMatchObject({ id: 'a3', retire: true, etat: { code: 'interesse' } })
    expect(vue.total).toEqual({ en_cours: '1', a_proposer: '0', reportes: '0' })
  })

  it('un mandat « reserved » est hors « à proposer » (pas une occasion) sans être étiqueté retiré — règle du point du matin, à confirmer (décision 12, lot D1)', () => {
    const reserve = bienDeMandat(mandat({ status: 'reserved' }))
    expect(reserve.retire).toBe(false)
    const vue = vueGetMatches([entree({ id: 'm-res' }, reserve)], MAINTENANT, false)
    expect(vue.biens).toEqual([])
    expect(vue.total).toEqual({ en_cours: '0', a_proposer: '0', reportes: '0' })
  })

  it('les critères et le signal d’un match, réels, traversent jusqu’à la vue', () => {
    const bien = bienDAnnonce(annonce({
      transaction_type: 'rent', price: 2_500, current_price: 2_500, price_at_first_seen: 2_500, price_reduced_at: null,
      features: ['custom:Buanderie'], first_seen_at: ilYA(1),
    }))
    const criteres = { budget_max: 3_000, features: ['custom:Buanderie'] }
    const raisons = { features: { match: true, score: 10, detail: '—' } }
    const vue = vueGetMatches(
      [{ match: match({ id: 'm-loc', score: 70, market_listing_id: bien.id, reasons: raisons }), bien, criteres }], MAINTENANT, false,
    )
    const ligne = vue.biens[0]!
    // Le budget garde son « /mois » (une location) ; l’équipement perd son préfixe `custom:` (voulu ET tenu).
    expect(ligne.criteres).toEqual([
      { critere: 'budget', tenu: null, ecart: null, voulu: "≤ CHF 3'000/mois", bien: "CHF 2'500/mois" },
      { critere: 'equipements', tenu: true, ecart: null, voulu: 'Buanderie', bien: 'Buanderie' },
    ])
    expect(ligne.signal).toEqual({ genre: 'nouveau', le: '23.09.2026' })
  })
})

describe('vueAcheteurs — qui pour ce bien', () => {
  it('par score, dix au plus avec le total ; les anciens prospects restent sur la fiche d’un mandat actif', () => {
    const lignes = Array.from({ length: 12 }, (_, i) => ({
      id: `m${i}`, contact_id: `c${i}`, status: 'suggested', score: 50 + i, snoozed_until: null, sent_at: null,
      reaction_motif: null, prix_propose: null, nom: `Acheteur ${i}`,
    }))
    const vue = vueAcheteurs(bienDeMandat(mandat()), lignes, MAINTENANT, false)
    expect(vue.acheteurs).toHaveLength(MAX_ACHETEURS)
    expect(vue.acheteurs[0]).toMatchObject({ nom: 'Acheteur 11', score: 61, etat: { code: 'a_proposer' } })
    expect(vue.total).toBe('12')
    expect(vue.anciens_prospects).toBeTruthy()
    expect(vueAcheteurs(bienDAnnonce(annonce({ status: 'removed' })), [], MAINTENANT, false)).toMatchObject({ bien: { retire: true } })
    expect('anciens_prospects' in vueAcheteurs(bienDAnnonce(annonce()), [], MAINTENANT, false)).toBe(false)
  })

  it('les anciens prospects n’apparaissent que pour un mandat ACTIF (la fiche ne les montre que là, 404 sinon)', () => {
    expect('anciens_prospects' in vueAcheteurs(bienDeMandat(mandat({ status: 'active' })), [], MAINTENANT, false)).toBe(true)
    expect('anciens_prospects' in vueAcheteurs(bienDeMandat(mandat({ status: 'reserved' })), [], MAINTENANT, false)).toBe(false)
    expect('anciens_prospects' in vueAcheteurs(bienDeMandat(mandat({ status: 'sold' })), [], MAINTENANT, false)).toBe(false)
  })
})

describe('retourDeVisite — « /annuler » ne défait que ce que la visite a posé', () => {
  it('le match seulement s’il a bougé, le deal seulement s’il a avancé', () => {
    expect(retourDeVisite({ ok: true, visite_id: 'v1', match_id: 'm1', match_avant: 'interested', deal_id: 'd1', etape_avant: 'new_lead' }))
      .toEqual({ visite_id: 'v1', evenement_id: null, match_id: 'm1', deal_id: 'd1', etape_avant: 'new_lead' })
    expect(retourDeVisite({ ok: true, evenement_id: 'e1', match_id: 'm1', statut_match: 'sent', deal_id: null }))
      .toEqual({ visite_id: null, evenement_id: 'e1', match_id: null, deal_id: null, etape_avant: null })
  })
})
