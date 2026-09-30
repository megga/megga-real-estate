/**
 * « Sa boucle » (lot D1, conception §6) : toute la boucle, lisible — une visite planifiée a son état, un bien revenu
 * reste là, un motif n'est jamais un code brut, l'ordre ne bouge pas d'une lecture à l'autre, chaque bien mène à sa
 * place dans le fil ; un bien revenu qui n'y a pas de place — reporté, ou sur une annonce retirée — ne mène nulle part,
 * et un mandat que la RLS masque n'a pas de ligne.
 *
 * Lot E1 : un bien revenu ne compte plus parmi les « Proposés », comme dans le fil (décision 10a) ; sur un mandat qui
 * n'est plus en vente, il ne mène plus nulle part (décision 12a) ; un mandat supprimé n'a pas de ligne, même lu par un
 * super-administrateur ; le titre de la liste, neutre, compte ce qu'elle liste, biens revenus compris.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { SearchCriteria } from '@/types/contact'
import { Constants } from '@/types/database'
import { construireSaBoucle, type LigneBoucleContact } from '@/components/crm/contacts-pager/saBoucle'
import { cleMotif } from '@/components/matching-fil/filBoucle'
import { compterHistorique } from '@/components/matching-fil/filModele'

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
    // La jointure d'un mandat porte son état (lot E1) : en vente, il garde sa ligne d'« À proposer ».
    const mandat = ligne('m5', 'suggested', {
      reaction_motif: 'prix', prix_propose: 3_450_000, property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale', status: 'active' },
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
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale', status: 'active' }, snoozed_until,
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

  it('les compteurs : proposés, intéressés (visites comprises), pas intéressés — un bien revenu n’est pas « Proposé »', () => {
    const b = boucle([
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'), ligne('m4', 'rejected'),
      ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ])
    // Lot E1 (décision 10a) : 4 pour 5 lignes. Le bien revenu (m5) est à proposer de nouveau, et le fil ne le compte pas dans
    // « Déjà proposé » (`compterHistorique`) ; il reste dans la liste, et « à traiter ».
    expect(b.compteurs).toEqual({ proposes: 4, interesses: 2, refuses: 1 })
    expect(b.biens).toHaveLength(5)
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

describe('lot E1 — un bien revenu n’est plus compté parmi les « Proposés » (décision 10a)', () => {
  it('il reste « à traiter » et mène à sa ligne du fil, hors du compte des « Proposés »', () => {
    const b = boucle([ligne('m1', 'sent'), ligne('m5', 'suggested', { reaction_motif: 'prix' })])
    expect(b.compteurs).toEqual({ proposes: 1, interesses: 0, refuses: 0 })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m5'])
    expect(b.biens.find((x) => x.m.id === 'm5')).toMatchObject({ etat: 'revenu', lien: 'ligne=marche%3Ac9&contact=c9' })
  })

  it('« Proposés » et « Intéressés » se comptent comme « Déjà proposé » dans le fil (`compterHistorique`)', () => {
    const lignes = [
      ligne('m1', 'sent'), ligne('m2', 'interested'), ligne('m3', 'visit_planned'),
      ligne('m4', 'rejected', { reaction_motif: 'prix' }), ligne('m5', 'suggested', { reaction_motif: 'prix' }),
    ]
    const { proposes, interesses } = boucle(lignes).compteurs
    const fil = compterHistorique(lignes.map((l) => ({ contact_id: ACHETEUR.id, status: l.status })))
    expect({ proposes, interesses }).toEqual(fil.get(ACHETEUR.id))
  })
})

describe('lot E1 — un bien revenu sur un mandat qui n’est plus en vente ne mène plus nulle part (décision 12a)', () => {
  // Refusé pour le prix à CHF 3'450'000, revenu par une baisse ; la jointure porte l'état du mandat.
  const surMandat = (id: string, status: string, etatMandat: string, champs: Partial<LigneBoucleContact> = {}) =>
    ligne(id, status, {
      property_id: 'p2', market_listing_id: null, market_listing: null,
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale', status: etatMandat }, ...champs,
    })
  const revenu = { reaction_motif: 'prix', prix_propose: 3_450_000 }

  it('vendu, son revenu reste dans la boucle, sans lien ni geste attendu : le fil ne propose plus ce mandat', () => {
    const b = boucle([surMandat('m5', 'suggested', 'sold', revenu)])
    expect(b.biens).toHaveLength(1)
    expect(b.biens[0]).toMatchObject({ etat: 'revenu', lien: null })
    expect(b.aTraiter).toEqual([])
    expect(b.compteurs).toEqual({ proposes: 0, interesses: 0, refuses: 0 })
  })

  it('seul `active` est en vente — la règle du fil et du copilote, statut par statut', () => {
    for (const etatMandat of Constants.public.Enums.property_status) {
      const b = boucle([surMandat('m5', 'suggested', etatMandat, revenu)])
      expect(b.biens[0]!.lien, etatMandat).toBe(etatMandat === 'active' ? 'ligne=m5&contact=c9' : null)
      expect(b.aTraiter.map((x) => x.m.id), etatMandat).toEqual(etatMandat === 'active' ? ['m5'] : [])
    }
  })

  it('proposé ou intéressé, un bien garde sa place — « Retours de … » et « À conclure » gardent le mandat ; une visite n’en a pas', () => {
    const b = boucle([
      surMandat('m1', 'sent', 'sold'), surMandat('m2', 'interested', 'sold'), surMandat('m3', 'visit_planned', 'sold'),
    ])
    expect(Object.fromEntries(b.biens.map((x) => [x.m.id, x.lien]))).toEqual({
      m1: 'attente=c9', m2: 'onglet=aConclure&ligne=m2&contact=c9', m3: null,
    })
    expect(b.aTraiter.map((x) => x.m.id)).toEqual(['m2'])
  })

  it('vendu, ses refus nourrissent encore « Apprendre » : un refus dit quelque chose de l’acheteur, pas du bien', () => {
    const criteres = new Map<string, SearchCriteria | null>([['cs9', { budget_max: 1_600_000, zones: ['Genève'] } as SearchCriteria]])
    const b = boucle([
      surMandat('m1', 'rejected', 'sold', { reaction_motif: 'prix', response_at: il(2), prix_propose: 1_500_000 }),
      surMandat('m2', 'rejected', 'sold', { reaction_motif: 'prix', response_at: il(1), prix_propose: 1_560_000 }),
    ], criteres)
    expect(b.corrections).toHaveLength(1)
    expect(b.corrections[0]!.c.motif).toBe('prix')
  })

  it('supprimé, un mandat n’a pas de ligne, même lu par un super-administrateur : le fil ne le lit pas', () => {
    const supprime = surMandat('m9', 'sent', 'active', {
      property: { title: 'Villa · Cologny', price: 3_200_000, transaction_type: 'sale', status: 'active', deleted_at: il(3) },
    })
    const b = boucle([supprime, ligne('m1', 'sent')])
    expect(b.biens.map((x) => x.m.id)).toEqual(['m1'])
    expect(b.compteurs).toEqual({ proposes: 1, interesses: 0, refuses: 0 })
  })
})

describe('lot E1 — la lecture de « Sa boucle » (`useContactSentMatches`)', () => {
  it('la jointure d’un mandat porte son état et sa suppression : sans eux, « en vente » ne se lit pas', () => {
    const source = readFileSync(join(process.cwd(), 'src/hooks/useContactSentMatches.ts'), 'utf8')
    const colonnes = /property:properties\(([^)]*)\)/.exec(source)?.[1]?.split(',').map((c) => c.trim()) ?? []
    expect(colonnes).toEqual(expect.arrayContaining(['status', 'deleted_at']))
  })
})

describe('les compteurs de l’en-tête (revue UX du 29.09.2026)', () => {
  it('le vert des « Intéressés » ne se pose que sur un compte non nul : un « 0 » vert se lisait comme une bonne nouvelle', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/crm/contacts-pager/ContactDetailPager.tsx'), 'utf8')
    expect(source).toContain('c.liked && c.n > 0 ? P.ok : P.ink')
    expect(source).not.toContain('c.liked ? P.ok')
  })
})

describe('lot E1 — le titre de la liste compte ce qu’elle liste', () => {
  // La liste porte aussi les biens revenus, qui ne sont pas « Proposés » (décision 10a) : « Biens proposés (5) » sous
  // « 4 Proposés » se contredisait. Un titre neutre, sur la longueur de la liste (décision de Julien, 27.09.2026).
  const TITRES: Record<string, string> = {
    fr: 'Ses biens ({{count}})', de: 'Objekte ({{count}})', en: 'Their properties ({{count}})', it: 'I suoi immobili ({{count}})',
  }

  it('la fiche l’écrit par `fiche.loop.propertiesCount`, sur `loop.biens.length`, la liste qu’elle rend dessous', () => {
    const source = readFileSync(join(process.cwd(), 'src/components/crm/contacts-pager/ContactDetailPager.tsx'), 'utf8')
    expect(source).toContain("{t('fiche.loop.propertiesCount', { count: loop.biens.length })}")
    expect(source).toContain('{loop.biens.map((b, i) => <CdBienBoucle')
    expect(source).not.toContain('fiche.loop.transmittedCount')
  })

  it('neutre, dans les quatre langues : il ne dit plus « proposés »', () => {
    for (const [langue, titre] of Object.entries(TITRES)) {
      const brut = readFileSync(join(process.cwd(), `src/i18n/locales/${langue}/contacts.json`), 'utf8')
      const loop = (JSON.parse(brut) as { fiche: { loop: Record<string, string> } }).fiche.loop
      expect(loop.propertiesCount, langue).toBe(titre)
      expect(loop, langue).not.toHaveProperty('transmittedCount')
    }
  })
})
