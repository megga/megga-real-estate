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
  bienDAnnonce, bienDeMandat, bienEnClair, candidats, etatMatch, expliquer, libelleBien, motsDe, retourDeVisite,
  signalEnClair, signalMatch, titreAffiche, vueAcheteurs, vueGetMatches, MAX_BIENS, MAX_ACHETEURS, STATUTS_DE_DEPART,
  STATUT_D_ARRIVEE, type BienWa, type LigneAnnonce, type LigneMandat, type LigneMatch,
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

describe('STATUTS_DE_DEPART / STATUT_D_ARRIVEE — où chaque réponse cherche son bien, ce qu’elle écrit', () => {
  it('épinglés réponse par réponse ; `matching-whatsapp-sql.spec.ts` les confronte au SQL de wa_matching_consigner', () => {
    expect(STATUTS_DE_DEPART).toEqual({ propose: ['suggested'], interesse: ['sent'], pas_interesse: ['sent', 'interested'], pas_encore: ['sent'] })
    expect(STATUT_D_ARRIVEE).toEqual({ propose: 'sent', interesse: 'interested', pas_interesse: 'rejected', pas_encore: null })
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
    // Trois lettres ne suffisent pas : « flo » serait le début de trop de mots pour désigner quoi que ce soit.
    expect(candidats(biens, 'flo')).toEqual([])
    expect(candidats(biens, 'flor')).toHaveLength(2)
  })

  it('les accents se plient à l’affinage, des deux côtés : « appartement geneve » trouve « Genève », et l’inverse', () => {
    const g = { id: 'g', titre: 'Appartement 4.5 pièces', adresse: 'Rue de Chêne-Bougeries 3', ville: 'Genève' }
    expect(candidats([g], 'appartement geneve').map((b) => b.id)).toEqual(['g'])
    expect(candidats([g], 'chene bougeries 3').map((b) => b.id)).toEqual(['g'])
    expect(candidats([{ ...g, ville: 'Geneve' }], 'Appartement Genève').map((b) => b.id)).toEqual(['g'])
  })

  it('plusieurs biens répondent : tous sont rendus, aucun n’est choisi', () => {
    expect(candidats(biens, 'Florissant')).toHaveLength(2)
  })

  it('un identifiant désigne son bien seul ; un texte sans mot utile ne désigne rien', () => {
    expect(candidats(biens, '33333333-3333-4333-8333-333333333333').map((b) => b.titre)).toEqual(['Villa contemporaine'])
    expect(candidats(biens, 'le bien')).toEqual([])
    expect(motsDe("L'attique de la Route")).toEqual(['attique', 'route'])
  })

  it('un nombre est un mot ENTIER, jamais un début : « Florissant 12 » et « Florissant 40 » désignent chacun leur numéro, « Florissant 1 » aucun', () => {
    expect(candidats(biens, 'Florissant 12').map((b) => b.titre)).toEqual(['Attique 4 p.'])
    expect(candidats(biens, 'Florissant 40').map((b) => b.titre)).toEqual(['Appartement 3 p.'])
    // « 1 » n'est ni « 12 » ni « 40 » : un nombre ne se prend jamais pour le début d'un autre — même de quatre
    // chiffres, où un mot de lettres, lui, vaudrait déjà début de mot.
    expect(candidats(biens, 'Florissant 1')).toEqual([])
    expect(candidats([{ id: 'n1', titre: 'Dépôt', adresse: 'Chemin du Stand 12065', ville: 'Genève' }], 'Stand 1206')).toEqual([])
  })

  it('« Florissant 4 », avec un bien au n° 4 ET l’attique « 4 p. » au n° 12 : les deux, le copilote demande ; sans le n° 4, l’attique seule', () => {
    const numero4 = { id: '44444444-4444-4444-8444-444444444444', titre: 'Duplex', adresse: 'Route de Florissant 4', ville: 'Genève' }
    expect(candidats([...biens, numero4], 'Florissant 4').map((b) => b.titre)).toEqual(['Attique 4 p.', 'Duplex'])
    // Le « 40 » de l'appartement n'est pas « 4 » : il n'entre dans aucune des deux listes.
    expect(candidats(biens, 'Florissant 4').map((b) => b.titre)).toEqual(['Attique 4 p.'])
  })

  it('un DÉCIMAL est UN mot : « le 4.5 pièces de Carouge » désigne le 4.5, ni le 3.5, ni un 5.5 au n° 4 ; la base, elle, n’en reçoit que la partie entière', () => {
    expect(motsDe('le 4.5 pièces de Carouge')).toEqual(['4', 'pieces', 'carouge'])
    // Collé à ses lettres, le décimal reste un nombre : « 4.5p » n'envoie plus « 5p », qu'aucun « 4.5 pièces » ne contient.
    expect(motsDe('attique 4.5p')).toEqual(['attique', '4'])
    expect(motsDe('3,5pces')).toEqual(['3', 'pces'])
    const carouge = [
      { id: 'c45', titre: 'Appartement 4.5 pièces', adresse: 'Rue Jacques-Dalphin 8', ville: 'Carouge' },
      { id: 'c35', titre: 'Appartement 3.5 pièces', adresse: 'Rue Ancienne 15', ville: 'Carouge' },
      { id: 'c55', titre: 'Appartement 5.5 pièces', adresse: 'Rue du Four 4', ville: 'Carouge' },
    ]
    expect(candidats(carouge, 'le 4.5 pièces de Carouge').map((b) => b.id)).toEqual(['c45'])
    // La virgule suisse vaut le point, des deux côtés.
    expect(candidats(carouge, '4,5 pièces Carouge').map((b) => b.id)).toEqual(['c45'])
    expect(candidats([{ id: 'v', titre: 'Appartement 4,5 pièces', adresse: 'Rue Vautier 1', ville: 'Carouge' }], '4.5 pièces').map((b) => b.id)).toEqual(['v'])
    // Ni l'inverse : un « 4 » ou un « 5 » isolés ne se retrouvent pas dans « 4.5 ».
    expect(candidats(carouge.slice(0, 2), '4 pièces Carouge')).toEqual([])
    expect(candidats(carouge.slice(0, 2), '5 pièces Carouge')).toEqual([])
    // Un décimal est un nombre : jamais pris pour le début d'un autre, même de quatre signes.
    expect(candidats([{ id: 'l', titre: 'Loft 12.55 m²', adresse: 'Rue Vautier 3', ville: 'Carouge' }], 'Loft 12.5')).toEqual([])
    // Un nombre à plusieurs séparateurs (un prix, une date) reste UN nombre : sa première tranche ne le désigne pas.
    expect(candidats([{ id: 'd', titre: 'Loft libre dès le 01.10.2026', adresse: 'Rue Vautier 5', ville: 'Carouge' }], 'Loft 01.10')).toEqual([])
  })

  it('« 4½ pièces » et « 4.5 pièces » sont la même taille, des deux côtés — et la base, qui ne reçoit que « 4 », garde bien le « 4½ »', () => {
    const demi = { id: 'demi', titre: 'Appartement 4½ pièces', adresse: 'Rue Ancienne 1', ville: 'Carouge' }
    const quatre = { id: 'quatre', titre: 'Appartement 4 pièces', adresse: 'Rue Ancienne 3', ville: 'Carouge' }
    expect(candidats([demi, quatre], '4.5 pièces').map((b) => b.id)).toEqual(['demi'])
    expect(candidats([demi, quatre], '4,5 pièces').map((b) => b.id)).toEqual(['demi'])
    expect(candidats([{ ...demi, titre: 'Appartement 4.5 pièces' }], '4½ pièces').map((b) => b.id)).toEqual(['demi'])
    expect(candidats([{ ...demi, titre: 'Appartement 4 ½ pièces' }], '4.5 pièces').map((b) => b.id)).toEqual(['demi'])
    // La base (`lower(unaccent(concat_ws(' ', titre, adresse, ville)))`, `like '%mot%'`) garde le « 4½ » : chaque mot
    // qu'elle reçoit y est CONTENU. Elle est un sur-ensemble ; le « 4 pièces » voisin, que `candidats` écarte, y passe.
    const enBase = (b: { titre: string; adresse: string; ville: string }): string =>
      [b.titre, b.adresse, b.ville].join(' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    expect(motsDe('4.5 pièces')).toEqual(['4', 'pieces'])
    expect(motsDe('4.5 pièces').every((w) => enBase(demi).includes(w))).toBe(true)
    expect(motsDe('4.5 pièces').every((w) => enBase(quatre).includes(w))).toBe(true)
    // Le quart et les trois quarts, de même ; une fraction isolée n'a pas de partie entière, elle ne compte pas.
    expect(candidats([{ ...demi, titre: 'Studio 1¼ pièce' }], '1.25 pièce').map((b) => b.id)).toEqual(['demi'])
    expect(candidats([{ ...demi, titre: 'Duplex 5¾ pièces' }], '5.75 pièces').map((b) => b.id)).toEqual(['demi'])
    expect(motsDe('½ pièce')).toEqual(['piece'])
  })

  it('« studio » ne départage pas « Studio » et « Studio lumineux » : les deux — le titre nu n’est pas un libellé ; le libellé de l’un le désigne seul', () => {
    const studios = [
      { id: 's1', titre: 'Studio', adresse: 'Rue du Lac 2', ville: 'Genève' },
      { id: 's2', titre: 'Studio lumineux', adresse: 'Rue du Lac 2', ville: 'Genève' },
    ]
    expect(candidats(studios, 'studio').map((b) => b.id)).toEqual(['s1', 's2'])
    expect(candidats(studios, 'Studio').map((b) => b.id)).toEqual(['s1', 's2'])
    // À la même adresse, les mots rendraient les deux : seul le libellé exact tranche.
    expect(candidats(studios, 'Studio · Rue du Lac 2').map((b) => b.id)).toEqual(['s1'])
    expect(candidats(studios, 'Studio lumineux · Rue du Lac 2').map((b) => b.id)).toEqual(['s2'])
  })

  it('sans « · », pas d’écho : « studio rue du Lac 2 » se plie comme le libellé du studio, mais ses mots désignent les deux', () => {
    const studios = [
      { id: 's1', titre: 'Studio', adresse: 'Rue du Lac 2', ville: 'Genève' },
      { id: 's2', titre: 'Studio lumineux', adresse: 'Rue du Lac 2', ville: 'Genève' },
    ]
    expect(candidats(studios, 'studio rue du Lac 2').map((b) => b.id)).toEqual(['s1', 's2'])
    expect(candidats(studios, 'studio, rue du lac, 2').map((b) => b.id)).toEqual(['s1', 's2'])
    expect(candidats(studios, 'le studio rue du Lac 2').map((b) => b.id)).toEqual(['s1', 's2'])
  })

  it('un article DE TÊTE ne fait pas perdre l’écho, d’un côté comme de l’autre', () => {
    const deux = [
      { id: 'a', titre: 'Attique 4 p.', adresse: 'Route de Florissant 12', ville: 'Genève' },
      { id: 'j', titre: 'Attique 4 p. duplex', adresse: 'Route de Florissant 12', ville: 'Genève' },
    ]
    expect(candidats(deux, "l'Attique 4 p. · Route de Florissant 12").map((b) => b.id)).toEqual(['a'])
    expect(candidats(deux, 'le Attique 4 p. · Route de Florissant 12').map((b) => b.id)).toEqual(['a'])
    // Un titre qui commence lui-même par un article reste égal à son écho, avec ou sans l'article.
    const clos = [
      { id: 'c', titre: 'Le Clos des Vignes', adresse: 'Chemin du Clos 3', ville: 'Satigny' },
      { id: 'k', titre: 'Le Clos des Vignes, lot B', adresse: 'Chemin du Clos 3', ville: 'Satigny' },
    ]
    expect(candidats(clos, 'Le Clos des Vignes · Chemin du Clos 3').map((b) => b.id)).toEqual(['c'])
    expect(candidats(clos, 'Clos des Vignes · Chemin du Clos 3').map((b) => b.id)).toEqual(['c'])
    // Une LETTRE isolée, pas un chiffre : « 4 pièces » et « 5 pièces » ne se confondent pas une fois la tête ôtée.
    const pieces = [
      { id: 'p4', titre: '4 pièces', adresse: 'Rue du Four 2', ville: 'Carouge' },
      { id: 'p5', titre: '5 pièces', adresse: 'Rue du Four 2', ville: 'Carouge' },
    ]
    expect(candidats(pieces, '4 pièces · Rue du Four 2').map((b) => b.id)).toEqual(['p4'])
  })

  it('« Attique 4 p. » nu, tel que get_matches l’a montré : retrouvé par les mots — le « 4 » de son titre, entier ; le « 40 » voisin ne l’est pas', () => {
    expect(candidats(biens, 'Attique 4 p.').map((b) => b.titre)).toEqual(['Attique 4 p.'])
    expect(candidats(biens, '  attique 4 P.  ').map((b) => b.titre)).toEqual(['Attique 4 p.'])
  })

  it('deux « Attique 4 p. » à deux adresses : le titre nu les rend tous deux, le libellé de l’un le désigne seul', () => {
    const deux = [
      { id: 'a12', titre: 'Attique 4 p.', adresse: 'Route de Florissant 12', ville: 'Genève' },
      { id: 'a8', titre: 'Attique 4 p.', adresse: 'Chemin des Crêts 8', ville: 'Genève' },
    ]
    expect(candidats(deux, 'Attique 4 p.').map((b) => b.id)).toEqual(['a12', 'a8'])
    expect(candidats(deux, 'Attique 4 p. · Chemin des Crêts 8').map((b) => b.id)).toEqual(['a8'])
    expect(candidats(deux, 'Attique 4 p. · Route de Florissant 12').map((b) => b.id)).toEqual(['a12'])
  })

  it('l’ÉCHO d’un libellé (« titre · adresse », ou « titre · ville » sans adresse) désigne ce bien seul', () => {
    // Même adresse, titres voisins : les mots désigneraient les deux ; seul le libellé exact tranche.
    const jumeau = { id: 'j1', titre: 'Attique 4 p. duplex', adresse: 'Route de Florissant 12', ville: 'Genève' }
    expect(candidats([jumeau, ...biens], 'Attique 4 p. · Route de Florissant 12').map((b) => b.id)).toEqual([biens[0].id])
    // La ponctuation ne compte pas dans l'écho, qui se compare plié ; mais sans « · » il n'y a pas d'écho : la virgule
    // laisse les mots seuls, qui rendent les deux.
    expect(candidats([jumeau, ...biens], 'Attique 4 p.  ·  Route de Florissant, 12').map((b) => b.id)).toEqual([biens[0].id])
    expect(candidats([jumeau, ...biens], 'Attique 4 p., Route de Florissant 12').map((b) => b.id)).toEqual([jumeau.id, biens[0].id])
    const sansAdresse = [{ id: 's1', titre: 'Loft 2 p.', adresse: null, ville: 'Carouge' }, { id: 's2', titre: 'Loft 2 p. terrasse', adresse: null, ville: 'Carouge' }]
    expect(candidats(sansAdresse, 'Loft 2 p. · Carouge').map((b) => b.id)).toEqual(['s1'])
  })

  it('un bien sans adresse ni ville a son titre pour libellé, sans « · » : son titre nu n’est pas un écho — les mots, les deux studios', () => {
    const nus = [{ id: 'n1', titre: 'Studio', adresse: null, ville: null }, { id: 'n2', titre: 'Studio lumineux', adresse: null, ville: null }]
    expect(candidats(nus, 'Studio').map((b) => b.id)).toEqual(['n1', 'n2'])
  })

  it('deux biens au même libellé (la même annonce vue deux fois) : les deux, jamais un choix', () => {
    const doubles = [
      { id: 'a', titre: 'Studio', adresse: 'Rue du Lac 2', ville: 'Genève' },
      { id: 'b', titre: 'Studio', adresse: 'Rue du Lac 2', ville: 'Genève' },
    ]
    expect(candidats(doubles, 'Studio · Rue du Lac 2').map((b) => b.id)).toEqual(['a', 'b'])
    expect(candidats(doubles, 'Studio').map((b) => b.id)).toEqual(['a', 'b'])
  })

  it('l’écho nu « Attique 4 p. » avec un leurre (« Attique 3 p. · Rue du Stand 4 ») : les DEUX, le copilote demande ; le libellé de l’une la désigne seule', () => {
    // Le « 4 » est dans le titre de l'une, dans l'adresse de l'autre : un nombre compte où qu'il soit, et aucun des
    // deux n'est préféré — une désignation qui en rend plusieurs demande, elle ne choisit jamais.
    const leurre = { id: 'l1', titre: 'Attique 3 p.', adresse: 'Rue du Stand 4', ville: 'Genève' }
    expect(candidats([leurre, ...biens], 'Attique 4 p.').map((b) => b.id)).toEqual(['l1', biens[0].id])
    expect(candidats([leurre, ...biens], 'Attique 4 p. · Route de Florissant 12').map((b) => b.id)).toEqual([biens[0].id])
    expect(candidats([leurre, ...biens], 'Attique 3 p. · Rue du Stand 4').map((b) => b.id)).toEqual(['l1'])
  })

  it('un titre NULL : le bien s’affiche par son adresse, et se désigne par elle ; aucun titre générique ne le nomme', () => {
    const sansTitre = [{ id: 'n1', titre: null, adresse: 'Route de Chêne 20', ville: 'Chêne-Bougeries' }]
    expect(candidats(sansTitre, 'Route de Chêne 20').map((b) => b.id)).toEqual(['n1'])
    expect(candidats(sansTitre, 'Route de Chêne 20 · Chêne-Bougeries').map((b) => b.id)).toEqual(['n1'])
    const sansRien = [{ id: 'x1', titre: null, adresse: null, ville: null }, { id: 'x2', titre: '  ', adresse: ' ', ville: '' }]
    expect(candidats(sansRien, 'Annonce')).toEqual([])
    expect(candidats(sansRien, 'Bien')).toEqual([])
    // Ni en forme d'écho : le générique n'entre pas non plus dans l'égalité au libellé.
    expect(candidats(sansRien, 'Annonce ·')).toEqual([])
  })

  it('une adresse blanche n’entre pas dans le libellé comparé : « Studio · Genève » désigne le studio', () => {
    const blanche = [{ id: 'w1', titre: 'Studio', adresse: '   ', ville: 'Genève' }, { id: 'w2', titre: 'Studio', adresse: 'Rue du Lac 2', ville: 'Genève' }]
    expect(candidats(blanche, 'Studio · Genève').map((b) => b.id)).toEqual(['w1'])
  })

  it('un TITRE qui porte lui-même un « · », recopié, ne désigne pas seul le bien voisin dont c’est le libellé : les mots, les deux ; le libellé entier de l’un le désigne seul', () => {
    const deux = [
      { id: 't1', titre: 'Attique · Route de Florissant 12', adresse: 'Route de Florissant 12', ville: 'Genève' },
      { id: 't2', titre: 'Attique', adresse: 'Route de Florissant 12', ville: 'Genève' },
    ]
    expect(deux.map((b) => libelleBien(b))).toEqual(['Attique · Route de Florissant 12 · Genève', 'Attique · Route de Florissant 12'])
    // Le titre de t1, tel que get_matches le montre, est mot pour mot le libellé de t2 : ni l'un ni l'autre seul.
    expect(candidats(deux, 'Attique · Route de Florissant 12').map((b) => b.id)).toEqual(['t1', 't2'])
    expect(candidats(deux, "l'Attique · Route de Florissant 12").map((b) => b.id)).toEqual(['t1', 't2'])
    expect(candidats(deux, 'Attique · Route de Florissant 12 · Genève').map((b) => b.id)).toEqual(['t1'])
    // Ce sont bien les MOTS qui répondent alors, pas les deux seuls biens égaux : le duplex à la même adresse aussi.
    const duplex = { id: 't3', titre: 'Attique duplex', adresse: 'Route de Florissant 12', ville: 'Genève' }
    expect(candidats([...deux, duplex], 'Attique · Route de Florissant 12').map((b) => b.id)).toEqual(['t1', 't2', 't3'])
    // Un titre qui commence par un article se compare, lui aussi, sans sa tête.
    const article = { ...deux[0], id: 't1b', titre: "L'Attique · Route de Florissant 12" }
    expect(candidats([article, deux[1]], 'Attique · Route de Florissant 12').map((b) => b.id)).toEqual(['t1b', 't2'])
    // Sans voisin dont ce texte soit le titre, l'égalité tient : t2 seul, par son libellé.
    expect(candidats([deux[1], duplex], 'Attique · Route de Florissant 12').map((b) => b.id)).toEqual(['t2'])
    // Le bien dont ce texte est À LA FOIS le titre et le libellé n'écarte que lui-même : il reste désigné seul.
    const seul = { id: 't4', titre: 'Attique · Carouge', adresse: null, ville: null }
    const voisin = { id: 't5', titre: 'Attique', adresse: 'Rue Vautier 3', ville: 'Carouge' }
    expect(candidats([seul, voisin], 'Attique · Carouge').map((b) => b.id)).toEqual(['t4'])
  })

  it('« Villa de Cologny » sans adresse garde sa ville dans son libellé : son écho la désigne seule face à « Villa de Cologny avec piscine »', () => {
    const villas = [
      { id: 'v1', titre: 'Villa de Cologny', adresse: null, ville: 'Cologny' },
      { id: 'v2', titre: 'Villa de Cologny avec piscine', adresse: null, ville: 'Cologny' },
    ]
    expect(candidats(villas, 'Villa de Cologny · Cologny').map((b) => b.id)).toEqual(['v1'])
    expect(candidats(villas, 'Villa de Cologny avec piscine · Cologny').map((b) => b.id)).toEqual(['v2'])
    // Sans son « · », le titre nu désigne les deux.
    expect(candidats(villas, 'Villa de Cologny').map((b) => b.id)).toEqual(['v1', 'v2'])
  })

  it('« vandoeuvres » trouve « Vandœuvres », par le pliage des ligatures (comme `plier` du fil) — des deux côtés, écho compris', () => {
    const b = [{ id: 'v1', titre: 'Maison', adresse: 'Chemin de la Côte 2', ville: 'Vandœuvres' }]
    expect(candidats(b, 'vandoeuvres').map((x) => x.id)).toEqual(['v1'])
    // La base reçoit le mot plié, comme `unaccent` plie le bien : jamais « vand » et « uvres ».
    expect(motsDe('Maison à Vandœuvres')).toEqual(['maison', 'vandoeuvres'])
    // L'écho d'un libellé à ligature, retapé sans elle, reste égal à ce libellé : les mots rendraient les deux villas.
    const villas = [
      { id: 'v2', titre: 'Villa', adresse: null, ville: 'Vandœuvres' },
      { id: 'v3', titre: 'Villa avec piscine', adresse: null, ville: 'Vandœuvres' },
    ]
    expect(candidats(villas, 'Villa · Vandoeuvres').map((x) => x.id)).toEqual(['v2'])
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

describe('libelleBien — nommer un bien à l’agent sans ambiguïté', () => {
  it('titre · adresse quand elle existe et n’est pas déjà dans le titre', () => {
    expect(libelleBien({ titre: 'Attique 4 p.', adresse: 'Route de Florissant 12', ville: 'Genève' })).toBe('Attique 4 p. · Route de Florissant 12')
  })

  it('titre · ville quand il n’y a pas d’adresse, ou que l’adresse est déjà dans le titre', () => {
    expect(libelleBien({ titre: 'Attique 4 p.', adresse: null, ville: 'Genève' })).toBe('Attique 4 p. · Genève')
    expect(libelleBien({ titre: 'Route de Florissant 12', adresse: 'Route de Florissant 12', ville: 'Genève' })).toBe('Route de Florissant 12 · Genève')
  })

  it('le titre seul : ni adresse ni ville connues', () => {
    expect(libelleBien({ titre: 'Attique 4 p.', adresse: null, ville: null })).toBe('Attique 4 p.')
    expect(libelleBien({ titre: 'Route de Florissant 12', adresse: 'Route de Florissant 12', ville: null })).toBe('Route de Florissant 12')
  })

  it('une adresse ou une ville vide ou faite d’espaces n’existe pas, et ce qui reste est rogné', () => {
    expect(libelleBien({ titre: 'Studio', adresse: '   ', ville: 'Genève' })).toBe('Studio · Genève')
    expect(libelleBien({ titre: 'Studio', adresse: '', ville: '  ' })).toBe('Studio')
    expect(libelleBien({ titre: ' Studio ', adresse: ' Rue du Lac 2 ', ville: null })).toBe('Studio · Rue du Lac 2')
    expect(libelleBien({ titre: 'Studio', adresse: null, ville: ' Genève ' })).toBe('Studio · Genève')
    // Faite de ponctuation seule, elle n'existe pas davantage.
    expect(libelleBien({ titre: 'Studio', adresse: '—', ville: 'Genève' })).toBe('Studio · Genève')
    expect(libelleBien({ titre: 'Studio', adresse: null, ville: '-' })).toBe('Studio')
  })

  it('la ville ne se tait que si le titre EST la ville : une annonce sans titre ni adresse s’affiche « Genève », jamais « Genève · Genève » ; un titre qui la contient la garde', () => {
    expect(libelleBien(bienDAnnonce(annonce({ title: null, address: null, city: 'Genève' })))).toBe('Genève')
    expect(libelleBien({ titre: 'GENEVE', adresse: null, ville: 'Genève' })).toBe('GENEVE')
    expect(libelleBien({ titre: 'Villa de Cologny', adresse: null, ville: 'Cologny' })).toBe('Villa de Cologny · Cologny')
  })

  it('l’adresse et la ville se comparent au titre par jetons, jamais par sous-chaîne', () => {
    // L'adresse, jeton pour jeton et à la suite : « 3 » n'est pas « 32 ».
    expect(libelleBien({ titre: 'Attique Rue de la Paix 32', adresse: 'Rue de la Paix 3', ville: 'Genève' })).toBe('Attique Rue de la Paix 32 · Rue de la Paix 3')
    expect(libelleBien({ titre: 'Attique, rue de la Paix 3', adresse: 'Rue de la Paix 3', ville: 'Genève' })).toBe('Attique, rue de la Paix 3 · Genève')
    // Tous ses jetons dans le titre, mais pas à la suite : le « 3 » y compte les pièces, l'adresse reste.
    expect(libelleBien({ titre: 'Appartement 3 pièces rue de la Paix', adresse: 'Rue de la Paix 3', ville: 'Genève' }))
      .toBe('Appartement 3 pièces rue de la Paix · Rue de la Paix 3')
    // Une ville ne disparaît pas dans un mot du titre qui la contient.
    expect(libelleBien({ titre: 'Appartement avec vision panoramique', adresse: null, ville: 'Sion' })).toBe('Appartement avec vision panoramique · Sion')
    expect(libelleBien({ titre: 'Studio solaire', adresse: null, ville: 'Aire' })).toBe('Studio solaire · Aire')
  })
})

describe('titreAffiche — ce qu’un bien affiche pour se nommer, sans générique', () => {
  it('le titre rogné, sinon l’adresse, sinon la ville ; rien des trois : null — l’affichage, lui, garde son générique', () => {
    expect(titreAffiche({ titre: '  Attique  ', adresse: 'Rue 1', ville: 'Genève' })).toBe('Attique')
    expect(titreAffiche({ titre: ' ', adresse: ' Rue 1 ', ville: 'Genève' })).toBe('Rue 1')
    expect(titreAffiche({ titre: null, adresse: null, ville: ' Genève ' })).toBe('Genève')
    expect(titreAffiche({ titre: null, adresse: '  ', ville: null })).toBeNull()
    expect(bienDeMandat(mandat({ title: null, address: null, city: null })).titre).toBe('Bien')
    expect(bienDAnnonce(annonce({ title: '', address: ' ', city: null })).titre).toBe('Annonce')
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
