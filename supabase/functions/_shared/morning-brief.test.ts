import { describe, it, expect } from 'vitest'
import {
  composeMorningBrief, composeBriefDetail, briefItemCount, briefVisitsForAgent,
  zurichHour, zurichDayBoundsUtc, SQL_LIMITS, type MorningBriefData, type BriefMatching,
} from './morning-brief'

const FULL: MorningBriefData = {
  agentFullName: 'Gregory Lyonnet',
  visits: [
    { scheduledAt: '2026-07-05T08:00:00Z', who: 'Anne Dubois', propertyTitle: 'Les Vergers', city: 'Meyrin' },
    { scheduledAt: '2026-07-05T12:30:00Z', who: null, propertyTitle: null, city: 'Genève' },
  ],
  reminders: [
    { type: 'post_visit_feedback', who: 'Jean Martin' },
    { type: 'missing_document', who: null },
    { type: 'type_inconnu_futur', who: 'X' },
  ],
  offers: [{ amount: 1450000, byLabel: 'M. Keller', expiresAt: '2026-07-07T10:00:00Z' }],
  sellerLeads: [{ contactName: 'Marie Curie', city: 'Carouge', estimationMedian: 1250000 }],
}

describe('composeMorningBrief', () => {
  it('compose le brief complet FR (prénom, sections, CHF apostrophe, heure Zurich)', () => {
    const text = composeMorningBrief(FULL, 'fr')!
    expect(text).toContain('Bonjour Gregory, ta journée :')
    expect(text).toContain('**Visites (2)**')
    // 08:00 UTC en juillet = 10:00 à Zurich (CEST)
    expect(text).toContain('- 10:00 · Anne Dubois · Les Vergers, Meyrin')
    // visite sans nom ni titre : l'heure et la ville seulement
    expect(text).toContain('- 14:30 · Genève')
    expect(text).toContain('**À relancer (3)**')
    expect(text).toContain('- Retour de visite : Jean Martin')
    expect(text).toContain('- Document manquant')
    // type inconnu → repli sur le label générique
    expect(text).toContain('- Rappel : X')
    expect(text).toContain("- CHF 1'450'000 (M. Keller) · expire le 07.07")
    expect(text).toContain("- Marie Curie · Carouge · est. CHF 1'250'000")
    expect(text).toContain('Réponds « brief »')
  })

  it('compose en EN quand lang=en', () => {
    const text = composeMorningBrief(FULL, 'en')!
    expect(text).toContain('Good morning Gregory, your day:')
    expect(text).toContain('**Visits (2)**')
    expect(text).toContain('- Visit feedback: Jean Martin')
    expect(text).toContain('expires 07.07')
    expect(text).toContain('Reply "brief"')
  })

  // ⛔ Un rendez-vous saisi au Calendrier vit dans `calendar_events` depuis le 15.09.2026 : le
  // brief ne lisait que `reminders`, et la signature chez le notaire sortait de la matinée.
  it('les rendez-vous du Calendrier : heure, type et contact — jamais le titre', () => {
    const text = composeMorningBrief({ ...FULL, events: [
      { startsAt: '2026-07-05T12:00:00Z', allDay: false, type: 'notary', who: 'Paul Dumont' },
      { startsAt: '2026-07-05T00:00:00Z', allDay: true, type: 'publish', who: null },
      { startsAt: '2026-07-05T15:00:00Z', allDay: false, type: 'type_futur', who: null },
    ] }, 'fr')!
    expect(text).toContain('**Rendez-vous (3)**')
    expect(text).toContain('- 14:00 · Signature notaire · Paul Dumont')
    expect(text).toContain('- Journée · Publication')
    expect(text).toContain('- 17:00 · Rendez-vous')
    expect(text.indexOf('**Visites')).toBeLessThan(text.indexOf('**Rendez-vous'))
    const en = composeMorningBrief({ ...FULL, events: [{ startsAt: '2026-07-05T12:00:00Z', allDay: false, type: 'notary', who: null }] }, 'en')!
    expect(en).toContain('**Appointments (1)**')
    expect(en).toContain('- 14:00 · Notary signing')
  })

  it('une journée faite de seuls rendez-vous a son brief ; au plafond de la requête, « 20+ »', () => {
    const vide = { agentFullName: 'Gregory Lyonnet', visits: [], reminders: [], offers: [], sellerLeads: [] }
    expect(composeMorningBrief({ ...vide, events: [{ startsAt: '2026-07-05T12:00:00Z', allDay: false, type: 'autre', who: null }] })).toContain('**Rendez-vous (1)**')
    const plein = composeMorningBrief({ ...vide, eventsAtLimit: true, events: [{ startsAt: '2026-07-05T12:00:00Z', allDay: false, type: 'autre', who: null }] })!
    expect(plein).toContain('**Rendez-vous (1+)**')
    expect(plein).toContain("…et d'autres")
  })

  it('retourne null quand la journée est vide (pas de brief creux)', () => {
    expect(composeMorningBrief({
      agentFullName: 'Gregory Lyonnet', visits: [], reminders: [], offers: [], sellerLeads: [],
    })).toBeNull()
  })

  it('omet les sections vides', () => {
    const text = composeMorningBrief({ ...FULL, reminders: [], offers: [], sellerLeads: [] })!
    expect(text).toContain('**Visites (2)**')
    expect(text).not.toContain('À relancer')
    expect(text).not.toContain('Offres')
    expect(text).not.toContain('leads vendeurs')
  })

  it('plafonne l\'affichage et résume le reste en « …et N autres »', () => {
    const reminders = Array.from({ length: 7 }, (_, i) => ({ type: 'custom', who: `Contact ${i}` }))
    const text = composeMorningBrief({ ...FULL, reminders })!
    expect(text).toContain('**À relancer (7)**')
    expect(text).toContain('- Rappel : Contact 4')
    expect(text).not.toContain('Contact 5')
    expect(text).toContain('…et 2 autres')
    // singulier quand il ne reste qu'un élément
    const six = composeMorningBrief({ ...FULL, reminders: reminders.slice(0, 6) })!
    expect(six).toContain('…et 1 autre')
    expect(six).not.toContain('1 autres')
  })

  it('affiche « N+ » et « …et d\'autres » quand le fetch a atteint sa limite SQL (total réel inconnu)', () => {
    // 20 = SQL_LIMITS.reminders : le total réel peut dépasser, le compte exact serait un mensonge.
    const reminders = Array.from({ length: 20 }, (_, i) => ({ type: 'custom', who: `Contact ${i}` }))
    const text = composeMorningBrief({ ...FULL, reminders })!
    expect(text).toContain('**À relancer (20+)**')
    expect(text).toContain('…et d\'autres')
    expect(text).not.toContain('…et 15 autres')
    const en = composeMorningBrief({ ...FULL, reminders }, 'en')!
    expect(en).toContain('**To follow up (20+)**')
    expect(en).toContain('…and more')
  })

  it('salue sans prénom quand full_name est absent', () => {
    const text = composeMorningBrief({ ...FULL, agentFullName: null })!
    expect(text).toContain('Bonjour, ta journée :')
  })
})

describe('zurichHour', () => {
  it('convertit UTC → heure locale Zurich, DST inclus', () => {
    expect(zurichHour(new Date('2026-07-05T05:30:00Z'))).toBe(7)  // été : UTC+2
    expect(zurichHour(new Date('2026-07-05T06:30:00Z'))).toBe(8)  // tick jumeau été
    expect(zurichHour(new Date('2026-01-10T06:30:00Z'))).toBe(7)  // hiver : UTC+1
    expect(zurichHour(new Date('2026-01-10T05:30:00Z'))).toBe(6)  // tick jumeau hiver
  })
})

describe('zurichDayBoundsUtc', () => {
  it('borne la journée locale Zurich en UTC (été)', () => {
    const b = zurichDayBoundsUtc(new Date('2026-07-05T05:30:00Z'))
    expect(b.startIso).toBe('2026-07-04T22:00:00.000Z')
    expect(b.endIso).toBe('2026-07-05T22:00:00.000Z')
    expect(b.dateKey).toBe('2026-07-05')
  })

  it('borne la journée locale Zurich en UTC (hiver)', () => {
    const b = zurichDayBoundsUtc(new Date('2026-01-10T06:30:00Z'))
    expect(b.startIso).toBe('2026-01-09T23:00:00.000Z')
    expect(b.endIso).toBe('2026-01-10T23:00:00.000Z')
    expect(b.dateKey).toBe('2026-01-10')
  })

  it('rattache un début de soirée UTC au lendemain local (23:30 Zurich = même jour, 23:30 UTC = lendemain)', () => {
    const b = zurichDayBoundsUtc(new Date('2026-07-04T23:30:00Z')) // 01:30 le 5 juillet à Zurich
    expect(b.dateKey).toBe('2026-07-05')
  })
})

describe('briefVisitsForAgent — « ta journée », partagé par le push et get_daily_brief', () => {
  it('garde les visites de l’agent et les non attribuées, jamais celles d’un collègue', () => {
    const rows = [
      { scheduledAt: '2026-07-05T08:00:00Z', agentId: 'moi' },
      { scheduledAt: '2026-07-05T09:00:00Z', agentId: null },
      { scheduledAt: '2026-07-05T10:00:00Z', agentId: 'collegue' },
    ]
    expect(briefVisitsForAgent(rows, 'moi').map((v) => v.scheduledAt))
      .toEqual(['2026-07-05T08:00:00Z', '2026-07-05T09:00:00Z'])
  })
})

describe('briefItemCount — le {{2}} du template agent_daily_brief', () => {
  it('additionne les quatre sections', () => {
    // FULL : 2 visites + 3 relances + 1 offre + 1 lead vendeur
    expect(briefItemCount(FULL)).toEqual({ count: 7, atLimit: false })
  })

  it('⛔ signale le plafond SQL : 20 relances lues ne veulent pas dire 20 relances dues', () => {
    const reminders = Array.from({ length: SQL_LIMITS.reminders }, () => ({ type: 'custom', who: null }))
    expect(briefItemCount({ ...FULL, reminders })).toEqual({ count: 2 + SQL_LIMITS.reminders + 1 + 1, atLimit: true })
  })

  // Le push les montre sous « Rendez-vous » : un décompte qui les tairait promettrait moins
  // que ce que le brief a annoncé.
  it('compte les rendez-vous du Calendrier, et le plafond de LEUR requête', () => {
    const events = [{ startsAt: '2026-07-05T12:00:00Z', allDay: false, type: 'notary', who: null }]
    expect(briefItemCount({ ...FULL, events })).toEqual({ count: 8, atLimit: false })
    // Une série développée peut rendre moins de lignes que la limite atteinte par la requête.
    expect(briefItemCount({ ...FULL, events, eventsAtLimit: true })).toEqual({ count: 8, atLimit: true })
  })
})

describe('composeBriefDetail — le détail promis par le template du matin', () => {
  it('rend le MÊME total que le décompte du template, et les quatre sections formatées', () => {
    const d = composeBriefDetail(FULL, 'fr')
    expect(d.total).toBe(String(briefItemCount(FULL).count))
    // 08:00 UTC en juillet = 10:00 à Zurich (CEST)
    expect(d.visites_du_jour[0]).toEqual({ heure: '10:00', qui: 'Anne Dubois', bien: 'Les Vergers', ville: 'Meyrin' })
    expect(d.relances_dues[0]).toEqual({ relance: 'Retour de visite', qui: 'Jean Martin' })
    // Type inconnu : le libellé générique, jamais la clé technique.
    expect(d.relances_dues[2].relance).toBe('Rappel')
    expect(d.offres_qui_expirent[0]).toEqual({ montant: "CHF 1'450'000", par: 'M. Keller', expire_le: '07.07' })
    expect(d.nouveaux_leads_vendeurs[0]).toEqual({ nom: 'Marie Curie', ville: 'Carouge', estimation: "CHF 1'250'000" })
  })

  it('ne plafonne PAS l’affichage : le push renvoie ici justement pour la liste entière', () => {
    const visits = Array.from({ length: 8 }, (_, i) => ({
      scheduledAt: `2026-07-05T0${i}:00:00Z`, who: `V${i}`, propertyTitle: null, city: null,
    }))
    expect(composeBriefDetail({ ...FULL, visits }, 'fr').visites_du_jour).toHaveLength(8)
  })

  it('« N+ » quand une section a atteint sa limite SQL', () => {
    const offers = Array.from({ length: SQL_LIMITS.offers }, () => FULL.offers[0])
    expect(composeBriefDetail({ ...FULL, offers }, 'fr').total).toBe(`${2 + 3 + SQL_LIMITS.offers + 1}+`)
  })

  it('libellés de relance en anglais quand lang=en', () => {
    expect(composeBriefDetail(FULL, 'en').relances_dues[0].relance).toBe('Visit feedback')
  })

  it('rend les rendez-vous du jour : heure, type, contact — jamais le titre, et comptés au total', () => {
    const events = [
      { startsAt: '2026-07-05T12:00:00Z', allDay: false, type: 'notary', who: 'Anne Dubois' },
      { startsAt: '2026-07-04T22:00:00Z', allDay: true, type: 'type_inconnu_futur', who: null },
    ]
    const d = composeBriefDetail({ ...FULL, events }, 'fr')
    expect(d.rendez_vous_du_jour).toEqual([
      { heure: '14:00', rendez_vous: 'Signature notaire', qui: 'Anne Dubois' },
      { heure: 'journée', rendez_vous: 'Rendez-vous', qui: null },
    ])
    expect(d.total).toBe(String(briefItemCount({ ...FULL, events }).count))
    expect(composeBriefDetail({ ...FULL, events }, 'en').rendez_vous_du_jour[0].rendez_vous).toBe('Notary signing')
    expect(composeBriefDetail(FULL, 'fr').rendez_vous_du_jour).toEqual([])
  })
})

describe('le matching du matin (lot D2)', () => {
  const MATCHING: BriefMatching = {
    total: 7,
    actions: [
      { genre: 'retour', who: 'Julie', contactId: 'c1', statut: null, titre: null, ville: null, nombre: 2, nouveaux: 0, baisses: 0, montant: null, location: false },
      { genre: 'prix', who: 'Antoine', contactId: 'c2', statut: 'sent', titre: 'Attique Florissant', ville: 'Genève', nombre: 0, nouveaux: 0, baisses: 0, montant: 900000, location: false },
      { genre: 'prix', who: 'Emma', contactId: 'c3', statut: 'suggested', titre: null, ville: null, nombre: 0, nouveaux: 0, baisses: 0, montant: 50000, location: false },
      { genre: 'mandat', who: null, contactId: null, statut: null, titre: 'Villa Cologny', ville: 'Cologny', nombre: 4, nouveaux: 0, baisses: 0, montant: null, location: false },
      { genre: 'marche', who: 'Anastasia', contactId: 'c4', statut: null, titre: 'Appartement lumineux', ville: 'Carouge', nombre: 1, nouveaux: 1, baisses: 0, montant: null, location: false },
      { genre: 'marche', who: 'Bob', contactId: 'c5', statut: null, titre: null, ville: null, nombre: 3, nouveaux: 2, baisses: 1, montant: null, location: false },
    ],
    interesses: ['Léa Blanc', 'Marc Roux'],
    interessesAtLimit: false,
  }
  const VIDE: MorningBriefData = { agentFullName: 'Gregory Lyonnet', visits: [], reminders: [], offers: [], sellerLeads: [] }

  it('une section « Matching » : cinq lignes, « …et N autres actions » sur le total exact, puis les intéressés — dans cet ordre', () => {
    const text = composeMorningBrief({ ...VIDE, matching: MATCHING }, 'fr')!
    expect(text).toContain('**Matching (9)**')
    expect(text).toContain('- Retour à consigner pour Julie · 2 biens')
    expect(text).toContain("- Prix baissé de CHF 900'000 sur le bien proposé à Antoine · Attique Florissant")
    expect(text).toContain("- Prix baissé de CHF 50'000 sur le bien refusé par Emma")
    expect(text).toContain('- Nouveau mandat · 4 acquéreurs compatibles · Villa Cologny')
    expect(text).toContain('- Nouveau bien à Carouge pour Anastasia · Appartement lumineux')
    expect(text).not.toContain('Bob')
    expect(text).toContain('…et 2 autres actions')
    expect(text).toContain('- 2 acheteurs intéressés attendent une visite : Léa Blanc, Marc Roux')
    // « …et N autres actions » compte des ACTIONS, pas les acheteurs de la ligne suivante : dans l'autre
    // ordre, un lecteur lirait « 2 autres » comme si c'était Léa et Marc.
    expect(text.indexOf('…et 2 autres actions')).toBeLessThan(text.indexOf('acheteurs intéressés attendent'))
  })

  it('en anglais', () => {
    const text = composeMorningBrief({ ...VIDE, matching: MATCHING }, 'en')!
    expect(text).toContain('- Feedback to record for Julie · 2 properties')
    expect(text).toContain('- New mandate · 4 matching buyers · Villa Cologny')
    expect(text).toContain('…and 2 more actions')
    expect(text).toContain('- 2 interested buyers are waiting for a viewing: Léa Blanc, Marc Roux')
  })

  it('un jour de matching seul a son brief, et le compte du modèle inclut le matching', () => {
    expect(composeMorningBrief({ ...VIDE, matching: MATCHING }, 'fr')).not.toBeNull()
    expect(briefItemCount({ ...VIDE, matching: MATCHING })).toEqual({ count: 9, atLimit: false })
    expect(briefItemCount({ ...VIDE, matching: { ...MATCHING, interessesAtLimit: true } }).atLimit).toBe(true)
    expect(composeMorningBrief({ ...VIDE, matching: { total: 0, actions: [], interesses: [], interessesAtLimit: false } }, 'fr')).toBeNull()
  })

  // ⛔ `sansMatching` doit lire les DEUX compteurs : un jour sans aucune ACTION mais avec des intéressés
  // n'est pas un jour vide — l'en-tête l'annonce (« Matching (1) »), le détail doit s'accorder.
  it('des intéressés SEULS, sans aucune action : un brief, un en-tête « Matching (1) », un détail qui s’accorde', () => {
    const seulsInteresses: BriefMatching = { total: 0, actions: [], interesses: ['Léa Blanc'], interessesAtLimit: false }
    const text = composeMorningBrief({ ...VIDE, matching: seulsInteresses }, 'fr')
    expect(text).not.toBeNull()
    expect(text).toContain('**Matching (1)**')
    expect(text).not.toContain('…et')
    const detail = composeBriefDetail({ ...VIDE, matching: seulsInteresses }, 'fr')
    expect(detail.matching?.total).toBe('1')
    expect(detail.matching?.actions_total).toBe('0')
  })

  it('une seule action, aucun reste : jamais un « …et 0 autre »', () => {
    const uneSeule: BriefMatching = {
      total: 1,
      actions: [{ genre: 'retour', who: 'Julie', contactId: 'c1', statut: null, titre: null, ville: null, nombre: 1, nouveaux: 0, baisses: 0, montant: null, location: false }],
      interesses: [], interessesAtLimit: false,
    }
    const text = composeMorningBrief({ ...VIDE, matching: uneSeule }, 'fr')!
    expect(text).toContain('**Matching (1)**')
    expect(text).not.toContain('…et 0')
  })

  it('le reste à 1 seul : singulier en fr et en en (« autre action » / « more action »)', () => {
    const six: BriefMatching = {
      total: 6,
      actions: Array.from({ length: 6 }, (_, i) => ({
        genre: 'retour' as const, who: `P${i}`, contactId: `c${i}`, statut: null, titre: null, ville: null,
        nombre: 1, nouveaux: 0, baisses: 0, montant: null, location: false,
      })),
      interesses: [], interessesAtLimit: false,
    }
    // CAPS.matching = 5 : 6 actions lues, 5 montrées, 1 en reste.
    const fr = composeMorningBrief({ ...VIDE, matching: six }, 'fr')!
    expect(fr).toContain('…et 1 autre action')
    expect(fr).not.toContain('1 autres actions')
    const en = composeMorningBrief({ ...VIDE, matching: six }, 'en')!
    expect(en).toContain('…and 1 more action')
    expect(en).not.toContain('1 more actions')
  })

  it('les intéressés au plafond : le « + » de l’en-tête ET celui de leur propre ligne, toujours au pluriel', () => {
    const auPlafond: BriefMatching = {
      total: 0, actions: [], interesses: Array.from({ length: 20 }, (_, i) => `Acheteur ${i}`), interessesAtLimit: true,
    }
    const text = composeMorningBrief({ ...VIDE, matching: auPlafond }, 'fr')!
    expect(text).toContain('**Matching (20+)**')
    expect(text).toContain('20+ acheteurs intéressés attendent une visite')
  })

  // ⚠ Un plafond peut être atteint avec UN SEUL nom effectivement lu (agence qui n'en a qu'un, ou limite
  // SQL basse) : « 1+ » dit « un ou plus, on ne sait pas », donc jamais le singulier.
  it('un seul intéressé lu, mais au plafond : le pluriel quand même', () => {
    const unSeulAuPlafond: BriefMatching = { total: 0, actions: [], interesses: ['Léa Blanc'], interessesAtLimit: true }
    const text = composeMorningBrief({ ...VIDE, matching: unSeulAuPlafond }, 'fr')!
    expect(text).toContain('1+ acheteurs intéressés attendent une visite : Léa Blanc')
  })

  it('plus de trois intéressés : trois noms, puis « … », jamais un quatrième', () => {
    const quatre: BriefMatching = { total: 0, actions: [], interesses: ['Ana', 'Bob', 'Chloé', 'David'], interessesAtLimit: false }
    const text = composeMorningBrief({ ...VIDE, matching: quatre }, 'fr')!
    expect(text).toContain('Ana, Bob, Chloé…')
    expect(text).not.toContain('David')
  })

  it('un seul intéressé (sous le plafond) : singulier en fr et en en', () => {
    const un: BriefMatching = { total: 0, actions: [], interesses: ['Léa Blanc'], interessesAtLimit: false }
    expect(composeMorningBrief({ ...VIDE, matching: un }, 'fr')).toContain('1 acheteur intéressé attend une visite : Léa Blanc')
    expect(composeMorningBrief({ ...VIDE, matching: un }, 'en')).toContain('1 interested buyer is waiting for a viewing: Léa Blanc')
  })

  it('`who` nul : le remplissage générique s’affiche (jamais une ligne amputée) ; en tête de ligne, il prend la majuscule', () => {
    const sansNom: BriefMatching = {
      total: 1,
      actions: [{ genre: 'retour', who: null, contactId: null, statut: null, titre: null, ville: null, nombre: 2, nouveaux: 0, baisses: 0, montant: null, location: false }],
      interesses: [], interessesAtLimit: false,
    }
    expect(composeMorningBrief({ ...VIDE, matching: sansNom }, 'fr')).toContain('- Retour à consigner pour un acheteur · 2 biens')
    expect(composeMorningBrief({ ...VIDE, matching: sansNom }, 'en')).toContain('- Feedback to record for a buyer · 2 properties')
    // Seule ligne où le remplissage OUVRE la phrase (marché à plusieurs, jamais « pour »/« à »/« par ») :
    // la casse s'y voit.
    const plusieurs: BriefMatching = {
      total: 1,
      actions: [{ genre: 'marche', who: null, contactId: null, statut: null, titre: null, ville: null, nombre: 3, nouveaux: 2, baisses: 1, montant: null, location: false }],
      interesses: [], interessesAtLimit: false,
    }
    expect(composeMorningBrief({ ...VIDE, matching: plusieurs }, 'fr')).toContain('- Un acheteur · 2 nouveaux biens, 1 en baisse')
  })

  it('une baisse sur une LOCATION porte « / mois » (fr) ou « / month » (en) ; une vente reste nue', () => {
    const loyer: BriefMatching = {
      total: 1,
      actions: [{ genre: 'prix', who: 'Karim', contactId: 'c9', statut: 'sent', titre: null, ville: null, nombre: 0, nouveaux: 0, baisses: 0, montant: 150, location: true }],
      interesses: [], interessesAtLimit: false,
    }
    expect(composeMorningBrief({ ...VIDE, matching: loyer }, 'fr')).toContain('Prix baissé de CHF 150 / mois sur le bien proposé à Karim')
    expect(composeMorningBrief({ ...VIDE, matching: loyer }, 'en')).toContain('Price down CHF 150 / month on the property proposed to Karim')
    const vente: BriefMatching = { ...loyer, actions: [{ ...loyer.actions[0]!, location: false }] }
    const texteVente = composeMorningBrief({ ...VIDE, matching: vente }, 'fr')!
    expect(texteVente).toContain('Prix baissé de CHF 150 sur le bien proposé à Karim')
    expect(texteVente).not.toContain('/ mois')
  })

  // ⛔ Inatteignable derrière `lireMatching` (il écarte tout `prix` sans montant positif) — construit ICI en
  // contournant la lecture, comme le reste de ce fichier construit `BriefMatching` à la main. Sans ces deux
  // tests, un défaut `?? 0` ou une garde limitée à `null` passeraient sans qu'aucun ne rougisse : un montant
  // à zéro s'écrirait « CHF 0 », un montant négatif « CHF -50 / mois » sur une location.
  it('un montant absent n’écrit jamais « CHF 0 » : la phrase reste sans montant, en fr et en en', () => {
    const sansMontant: BriefMatching = {
      total: 1,
      actions: [{ genre: 'prix', who: 'Karim', contactId: 'c9', statut: 'sent', titre: null, ville: null, nombre: 0, nouveaux: 0, baisses: 0, montant: null, location: false }],
      interesses: [], interessesAtLimit: false,
    }
    const text = composeMorningBrief({ ...VIDE, matching: sansMontant }, 'fr')!
    expect(text).not.toContain('CHF 0')
    expect(text).toContain('Prix baissé sur le bien proposé à Karim')
    expect(composeMorningBrief({ ...VIDE, matching: sansMontant }, 'en')).toContain('- Price down on the property proposed to Karim')
  })

  it.each([0, -50])('un montant de %i n’écrit aucun montant, même sur une location', (montant) => {
    const faux: BriefMatching = {
      total: 1,
      actions: [{ genre: 'prix', who: 'Karim', contactId: 'c9', statut: 'sent', titre: null, ville: null, nombre: 0, nouveaux: 0, baisses: 0, montant, location: true }],
      interesses: [], interessesAtLimit: false,
    }
    const text = composeMorningBrief({ ...VIDE, matching: faux }, 'fr')!
    expect(text).not.toContain('CHF')
    expect(text).toContain('- Prix baissé sur le bien proposé à Karim')
  })

  it('l’ORDRE des sections : Visites, Rendez-vous, À relancer, Matching, Offres, Nouveaux leads vendeurs', () => {
    const text = composeMorningBrief({
      agentFullName: 'Gregory Lyonnet',
      visits: [{ scheduledAt: '2026-07-05T08:00:00Z', who: 'Anne', propertyTitle: null, city: null }],
      events: [{ startsAt: '2026-07-05T09:00:00Z', allDay: false, type: 'notary', who: null }],
      reminders: [{ type: 'custom', who: null }],
      offers: [{ amount: 100, byLabel: 'X', expiresAt: '2026-07-06T10:00:00Z' }],
      sellerLeads: [{ contactName: 'Y', city: null, estimationMedian: null }],
      matching: MATCHING,
    }, 'fr')!
    const i = (s: string) => text.indexOf(s)
    expect(i('**Visites')).toBeLessThan(i('**Rendez-vous'))
    expect(i('**Rendez-vous')).toBeLessThan(i('**À relancer'))
    expect(i('**À relancer')).toBeLessThan(i('**Matching'))
    expect(i('**Matching')).toBeLessThan(i('**Offres'))
    expect(i('**Offres')).toBeLessThan(i('**Nouveaux leads vendeurs'))
  })

  it('le détail rend toutes les lignes lues, et le total (actions + intéressés) de l’en-tête — jamais celui des actions seules', () => {
    const detail = composeBriefDetail({ ...VIDE, matching: MATCHING }, 'fr')
    expect(detail.total).toBe('9')
    expect(detail.matching).toEqual({
      total: '9',
      actions_total: '7',
      actions: [
        'Retour à consigner pour Julie · 2 biens',
        "Prix baissé de CHF 900'000 sur le bien proposé à Antoine · Attique Florissant",
        "Prix baissé de CHF 50'000 sur le bien refusé par Emma",
        'Nouveau mandat · 4 acquéreurs compatibles · Villa Cologny',
        'Nouveau bien à Carouge pour Anastasia · Appartement lumineux',
        'Bob · 2 nouveaux biens, 1 en baisse',
      ],
      autres: 1,
      acheteurs_interesses_sans_visite: ['Léa Blanc', 'Marc Roux'],
      acheteurs_interesses_total: '2',
    })
  })

  it('le détail porte le « + » des intéressés quand leur lecture a atteint sa limite, séparément du total des actions', () => {
    const detail = composeBriefDetail({ ...VIDE, matching: { ...MATCHING, interessesAtLimit: true } }, 'fr')
    expect(detail.matching?.total).toBe('9+')
    expect(detail.matching?.acheteurs_interesses_total).toBe('2+')
    expect(detail.matching?.actions_total).toBe('7')
  })

  it('un compte de relances sous la limite SQL (19 < 20) garde « N+ » quand `remindersAtLimit` le dit — la déduplication d’un retour se fait dans la REQUÊTE (`loadAgencyData`), jamais dans ce composeur', () => {
    const reminders = Array.from({ length: 19 }, () => ({ type: 'custom', who: null }))
    expect(briefItemCount({ ...VIDE, reminders, remindersAtLimit: true }).atLimit).toBe(true)
    expect(composeMorningBrief({ ...VIDE, reminders, remindersAtLimit: true }, 'fr')).toContain('**À relancer (19+)**')
  })
})
