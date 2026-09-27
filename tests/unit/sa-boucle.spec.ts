/**
 * « Sa boucle » (lot D1, conception §6) : toute la boucle, lisible — une visite planifiée a son état, un bien revenu
 * reste là, un motif n'est jamais un code brut, l'ordre ne bouge pas d'une lecture à l'autre, chaque bien mène à sa
 * place dans le fil ; un bien revenu qui n'y a pas de place — reporté, ou sur une annonce retirée — ne mène nulle part,
 * et un mandat que la RLS masque n'a pas de ligne.
 */
import { describe, expect, it } from 'vitest'
import type { SearchCriteria } from '@/types/contact'
import { construireSaBoucle, type LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { cleMotif } from '@/components/matching-fil/filBoucle'

const ACHETEUR = { id: 'c9', prenom: 'Julie', nom: 'Morand', telephone: null, email: null, kyc: 'none' as const }
const JOUR = 86_400_000
/** L'heure de lecture de la fiche, FIXE : la base des dates des lignes (`il`), et le `maintenant` des reports. */
const MAINTENANT = Date.parse('2026-09-23T10:00:00Z')
const il = (j: number) => new Date(MAINTENANT - j * JOUR).toISOString()
const SANS = new Map<string, SearchCriteria | null>()
const ligne = (id: string, status: string, champs: Partial<LigneBoucleContact> = {}): LigneBoucleContact => ({
  id, status, score: 90, sent_at: il(5), response_at: null, reaction_motif: null, reaction_note: null,
  prix_propose: 1_500_000, apprentissage_at: null, client_search_id: 'cs9', snoozed_until: null,
  property_id: null, market_listing_id: `ml-${id}`,
  market_listing: { title: `Annonce ${id}`, city: 'Genève', price: 1_500_000, current_price: 1_500_000, transaction_type: 'buy', features: ['Balcon'] },
  ...champs,
})
const boucle = (lignes: LigneBoucleContact[], criteres = SANS) => construireSaBoucle(lignes, criteres, ACHETEUR, MAINTENANT)

describe('construireSaBoucle', () => {
  it('chaque statut a son état — une visite planifiée n’est plus « Proposé »', () => {
    const b = boucle([
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'),
      ligne('m4', 'rejected', { reaction_motif: 'prix' }), ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ])
    expect(Object.fromEntries(b.biens.map((x) => [x.m.id, x.etat]))).toEqual({
      m1: 'propose', m2: 'interesse', m3: 'visite', m4: 'refuse', m5: 'revenu',
    })
  })

  it('un bien revenu reste dans la boucle, et mène à sa ligne dans le fil', () => {
    const mandat = ligne('m5', 'suggested', {
      reaction_motif: 'prix', prix_propose: 3_450_000, property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale' },
    })
    const b = boucle([mandat])
    expect(b.biens).toHaveLength(1)
    expect(b.biens[0]).toMatchObject({ etat: 'revenu', lien: 'ligne=m5&contact=c9' })
    expect(b.biens[0]!.m.bien).toMatchObject({ id: 'p2', titre: 'Villa · Cologny', prix: 3_200_000 })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m5'])
    // Sur le marché, le fil le range dans la ligne « Marché » de l'acheteur.
    expect(boucle([ligne('m6', 'suggested', { reaction_motif: 'prix' })]).biens[0]!.lien).toBe('ligne=marche%3Ac9&contact=c9')
  })

  it('un bien revenu reporté reste dans la boucle, sans lien ni geste attendu ; son report échu, il retrouve sa place', () => {
    // Le fil le range dans ses reportés, hors de son ordre : un lien mènerait à un AUTRE bien de l'acheteur.
    const reporte = boucle([ligne('m5', 'suggested', { reaction_motif: 'prix', snoozed_until: il(-2) })])
    expect(reporte.biens).toHaveLength(1)
    expect(reporte.biens[0]).toMatchObject({ etat: 'revenu', lien: null })
    expect(reporte.aTraiter).toEqual([])
    const echu = boucle([ligne('m5', 'suggested', { reaction_motif: 'prix', snoozed_until: il(1) })])
    expect(echu.biens[0]).toMatchObject({ etat: 'revenu', lien: 'ligne=marche%3Ac9&contact=c9' })
    expect(echu.aTraiter.map((x) => x.m.id)).toEqual(['m5'])
  })

  it('un mandat revenu reporté n’a pas de lien non plus ; son report échu, il retrouve sa ligne', () => {
    const mandat = (snoozed_until: string) => ligne('m5', 'suggested', {
      reaction_motif: 'prix', property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale' }, snoozed_until,
    })
    const reporte = boucle([mandat(il(-2))])
    expect(reporte.biens[0]).toMatchObject({ etat: 'revenu', lien: null })
    expect(reporte.aTraiter).toEqual([])
    expect(boucle([mandat(il(1))]).biens[0]!.lien).toBe('ligne=m5&contact=c9')
  })

  it('le report ne compte que pour un bien revenu : proposé ou intéressé, un bien reporté garde sa place', () => {
    // « Retours de … » et « À conclure » ne lisent pas le report.
    const b = boucle([ligne('m1', 'sent', { snoozed_until: il(-2) }), ligne('m2', 'interested', { snoozed_until: il(-2) })])
    expect(Object.fromEntries(b.biens.map((x) => [x.m.id, x.lien]))).toEqual({
      m1: 'attente=c9', m2: 'onglet=aConclure&ligne=m2&contact=c9',
    })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m2'])
  })

  it('un bien revenu sur une annonce retirée reste dans la boucle, sans lien ni geste attendu ; active, elle garde sa place', () => {
    // La ligne « Marché » du fil exclut une annonce retirée : un lien mènerait à un AUTRE bien de l'acheteur.
    const annonce = (status: string) => ({ title: 'Annonce m6', city: 'Genève', price: 1_450_000, current_price: 1_450_000, transaction_type: 'buy', status })
    const retiree = boucle([ligne('m6', 'suggested', { reaction_motif: 'prix', market_listing: annonce('removed') })])
    expect(retiree.biens).toHaveLength(1)
    expect(retiree.biens[0]).toMatchObject({ etat: 'revenu', lien: null })
    expect(retiree.aTraiter).toEqual([])
    const active = boucle([ligne('m6', 'suggested', { reaction_motif: 'prix', market_listing: annonce('active') })])
    expect(active.biens[0]).toMatchObject({ etat: 'revenu', lien: 'ligne=marche%3Ac9&contact=c9' })
    expect(active.aTraiter.map((x) => x.m.id)).toEqual(['m6'])
    // Un bien PROPOSÉ dessus garde « Retours de … » : le fil ne filtre pas l'annonce d'un bien qui attend sa réponse.
    expect(boucle([ligne('m7', 'sent', { market_listing: annonce('removed') })]).biens[0]!.lien).toBe('attente=c9')
  })

  it('un mandat masqué par la RLS n’a pas de ligne ; une annonce du marché, jamais masquée, garde la sienne', () => {
    // Un mandat supprimé revient sans jointure : le fil jette ces matchs, on n'invente pas la ligne.
    const masque = (id: string, status: string, champs: Partial<LigneBoucleContact> = {}) =>
      ligne(id, status, { property_id: 'p9', market_listing_id: null, market_listing: null, property: null, ...champs })
    const b = boucle([masque('m9', 'sent'), masque('m10', 'suggested', { reaction_motif: 'prix' }), ligne('m1', 'sent')])
    expect(b.biens.map((x) => x.m.id)).toEqual(['m1'])
    expect(b.aTraiter).toEqual([])
    expect(b.compteurs).toEqual({ proposes: 1, interesses: 0, refuses: 0 })
    expect(boucle([ligne('m2', 'sent', { market_listing: null })]).biens.map((x) => x.m.id)).toEqual(['m2'])
  })

  it('un match jamais proposé n’est pas dans la boucle', () => {
    expect(boucle([ligne('m7', 'suggested', { prix_propose: null, reaction_motif: null })]).biens).toEqual([])
    expect(boucle([ligne('m8', 'ignored')]).biens).toEqual([])
  })

  it('chaque bien mène à sa place dans le fil ; un refus et une visite nulle part', () => {
    const b = boucle([ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'), ligne('m4', 'rejected')])
    expect(Object.fromEntries(b.biens.map((x) => [x.m.id, x.lien]))).toEqual({
      m1: 'attente=c9', m2: 'onglet=aConclure&ligne=m2&contact=c9', m3: null, m4: null,
    })
  })

  it('l’ordre est stable : la proposition la plus récente d’abord, sans date en dernier, l’id départage', () => {
    const lignes = [
      ligne('mb', 'sent', { sent_at: il(3) }), ligne('ma', 'sent', { sent_at: il(3) }),
      ligne('mc', 'rejected', { sent_at: null }), ligne('md', 'interested', { sent_at: il(1) }),
    ]
    const ordre = (ls: LigneBoucleContact[]) => boucle(ls).biens.map((x) => x.m.id)
    expect(ordre(lignes)).toEqual(['md', 'ma', 'mb', 'mc'])
    expect(ordre([...lignes].reverse())).toEqual(['md', 'ma', 'mb', 'mc'])
  })

  it('un match lu par les deux lectures ne compte qu’une fois', () => {
    const b = boucle([ligne('m1', 'sent'), ligne('m1', 'sent')])
    expect(b.biens).toHaveLength(1)
    expect(b.compteurs).toEqual({ proposes: 1, interesses: 0, refuses: 0 })
  })

  it('un match rendu par les deux lectures avec deux statuts : la première ligne gagne', () => {
    // `useContactSentMatches` passe la lecture de la boucle d'abord : son statut l'emporte.
    const propose = ligne('m1', 'sent')
    const revenu = ligne('m1', 'suggested', { reaction_motif: 'prix' })
    expect(boucle([propose, revenu]).biens.map((x) => [x.m.id, x.etat])).toEqual([['m1', 'propose']])
    expect(boucle([revenu, propose]).biens.map((x) => [x.m.id, x.etat])).toEqual([['m1', 'revenu']])
  })

  it('les compteurs : proposés, intéressés (visites comprises), pas intéressés', () => {
    const b = boucle([
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'), ligne('m4', 'rejected'),
      ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ])
    expect(b.compteurs).toEqual({ proposes: 5, interesses: 2, refuses: 1 })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m2', 'm5'])
  })

  it('la correction en attente se calcule sur ses refus, avec un lien vers le fil', () => {
    const criteres = new Map<string, SearchCriteria | null>([['cs9', { budget_max: 1_600_000, zones: ['Genève'] } as SearchCriteria]])
    const b = boucle([
      ligne('m1', 'rejected', { reaction_motif: 'prix', response_at: il(2) }),
      ligne('m2', 'rejected', { reaction_motif: 'prix', response_at: il(1), prix_propose: 1_560_000 }),
    ], criteres)
    expect(b.corrections).toHaveLength(1)
    expect(b.corrections[0]!.c.motif).toBe('prix')
    expect(b.corrections[0]!.lien).toBe(`ligne=${encodeURIComponent('correction:cs9:prix')}&contact=c9`)
  })
})

describe('un motif n’est jamais un code brut', () => {
  it('les codes du geste ont leur clé ; tout autre code n’en a pas', () => {
    expect(cleMotif('prix')).toBe('fil.motifs.prix')
    expect(cleMotif('etat')).toBe('fil.motifs.etat')
    expect(cleMotif('recherche_ajustee')).toBeNull()
    expect(cleMotif(null)).toBeNull()
  })
})
