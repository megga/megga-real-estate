// Golden set d'éval de la compréhension WhatsApp — ~24 conversations SYNTHÉTIQUES.
//
// Pourquoi synthétique et pas réel : committer des conversations clients réelles (même
// redactPII) est une dette LPD (données personnelles dans le repo). On fige donc des fils
// RÉALISTES mais fabriqués (noms/tél/emails fictifs), couvrant le champ des scénarios
// immobiliers suisses (achat/location/vente/RDV/négo/dossier), 4 langues, et des cas PII
// (AVS/IBAN/mdp FICTIFS) pour prouver la redaction. redactPII tourne quand même dans le
// pipeline (buildThreadDigest) → fidèle à la prod.
//
// Chaque cas ne label QUE les champs FRANCS (voir GoldenExpect) → on ne note pas de
// l'ambigu, l'éval reste stable. cf. tests/backend/helpers/comprehension-eval.ts.

import type { ThreadMessage } from '../../../supabase/functions/_shared/whatsapp-comprehend.ts'
import type { GoldenExpect } from '../helpers/comprehension-eval.ts'

export interface GoldenCase {
  id: string
  note: string
  messages: ThreadMessage[]
  priorSummary?: string | null
  expect: GoldenExpect
}

// Fabriques terses. created_at est cosmétique (le pipeline ne l'utilise pas) mais valide.
let _min = 0
const stamp = () => `2026-07-11T09:${String(10 + (_min++ % 48)).padStart(2, '0')}:00.000Z`
/** message client (inbound). */
const c = (body: string): ThreadMessage => ({ direction: 'inbound', body, transcript: null, created_at: stamp() })
/** message agent (outbound). */
const a = (body: string): ThreadMessage => ({ direction: 'outbound', body, transcript: null, created_at: stamp() })
/** note vocale client (transcript, body null). */
const cv = (transcript: string): ThreadMessage => ({ direction: 'inbound', body: null, transcript, created_at: stamp() })

export const GOLDEN_CASES: GoldenCase[] = [
  {
    id: 'fr-achat-visite',
    note: 'Achat, veut visiter — planifier_visite',
    messages: [
      c('Bonjour, je suis Thomas Berset. Je suis intéressé par le 4.5 pièces à Carouge que vous avez publié. Serait-il possible de le visiter ?'),
      a('Bonjour Monsieur Berset ! Avec plaisir. Quelles sont vos disponibilités cette semaine ?'),
      c('Jeudi après-midi ou vendredi matin si possible. On aimerait acheter d\'ici la fin de l\'année.'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['achat', 'acheter', 'recherche'],
      nextActionOneOf: ['planifier_visite'],
      hasLead: true,          // prénom+nom donnés → prospect identifiable
      leadIsThirdParty: false, // parle de lui-même
    },
  },
  {
    id: 'fr-location-urgent',
    note: 'Location, délai serré — urgency haute',
    messages: [
      c('Bonsoir, je cherche un 3 pièces à louer à Lausanne, il me le faut rapidement, je commence un nouveau job le 1er. C\'est urgent.'),
      a('Bonsoir, je comprends. Quel est votre budget mensuel ?'),
      c('Jusqu\'à 2200 CHF charges comprises. Vraiment pressé, merci !'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['location', 'louer', 'rent'],
      urgency: 'haute',
      nextActionOneOf: ['envoyer_biens', 'qualifier_lead', 'relancer'],
    },
  },
  {
    id: 'fr-negociation-tendu',
    note: 'Négociation prix, ton tendu, objection trop cher',
    messages: [
      c('Franchement votre prix est trop élevé pour ce quartier. 1 250 000 c\'est exagéré.'),
      a('Je comprends votre ressenti. Le bien a été rénové récemment, ce qui explique le positionnement.'),
      c('Rénové ou pas, je ne monterai pas au-dessus de 1 100 000. À prendre ou à laisser.'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['negoc', 'négoc', 'offre', 'prix'],
      sentiment: 'tendu',
      objectionsNonEmpty: true,
    },
  },
  {
    id: 'fr-question-dossier',
    note: 'Question sur les documents du dossier — question_dossier',
    messages: [
      c('Bonjour, quels documents dois-je vous fournir pour constituer mon dossier de candidature ?'),
      a('Bonjour, il me faut une pièce d\'identité, vos 3 dernières fiches de salaire et une attestation de non-poursuite.'),
      c('Parfait, merci pour ces précisions.'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['dossier', 'document', 'candidature'],
      nextActionOneOf: ['repondre', 'rien', 'relancer'],
    },
  },
  {
    id: 'fr-envoyer-biens',
    note: 'Critères donnés, agent doit envoyer des biens — envoyer_biens',
    messages: [
      c('Bonjour, on cherche à acheter une maison avec jardin, 5 pièces minimum, autour de Nyon, budget 1,4M.'),
      a('Bonjour, très bien. Vous préférez proche du lac ou plutôt sur les hauteurs ?'),
      c('Proche du lac idéalement. Pouvez-vous m\'envoyer ce que vous avez ?'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['achat', 'acheter', 'recherche'],
      nextActionOneOf: ['envoyer_biens', 'qualifier_lead'],
    },
  },
  {
    id: 'fr-relance',
    note: 'Client silencieux après envoi, à relancer — relancer',
    messages: [
      a('Bonjour, je vous ai envoyé trois biens correspondant à votre recherche la semaine dernière. Qu\'en avez-vous pensé ?'),
      a('Bonjour, je me permets de revenir vers vous. Souhaitez-vous organiser une visite ?'),
    ],
    expect: {
      language: 'fr',
      nextActionOneOf: ['relancer', 'repondre', 'rien'],
    },
  },
  {
    id: 'fr-rdv-confirme',
    note: 'Prise de rendez-vous confirmée — commitments',
    messages: [
      c('Bonjour, on peut se voir pour la visite du studio ?'),
      a('Oui, je vous propose mercredi à 18h sur place, ça vous convient ?'),
      c('Parfait, c\'est noté pour mercredi 18h. À mercredi !'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['rdv', 'rendez', 'visite', 'prise'],
      nextActionOneOf: ['planifier_visite', 'repondre', 'rien'],
      commitmentsNonEmpty: true,
    },
  },
  {
    id: 'fr-positif-enthousiaste',
    note: 'Client enthousiaste — sentiment positif',
    messages: [
      c('Waouh, l\'appartement est magnifique, exactement ce qu\'on cherchait ! On est très intéressés.'),
      a('Ravi que ça vous plaise ! Souhaitez-vous faire une offre ?'),
      c('Oui carrément, on prépare le dossier ce week-end, merci beaucoup !'),
    ],
    expect: {
      language: 'fr',
      sentiment: 'positif',
    },
  },
  {
    id: 'fr-objection-quartier',
    note: 'Objection sur le quartier — objections',
    messages: [
      c('L\'appartement est bien mais le quartier est vraiment trop bruyant, à côté de la gare c\'est rédhibitoire pour nous.'),
      a('Je comprends. Le double vitrage récent atténue beaucoup, mais je note votre remarque.'),
    ],
    expect: {
      language: 'fr',
      objectionsNonEmpty: true,
    },
  },
  {
    id: 'fr-financement-objection',
    note: 'Objection financement — objections',
    messages: [
      c('On adore le bien mais la banque ne nous suit pas sur les fonds propres, on est à court de 80 000.'),
      a('C\'est un point fréquent. On peut regarder ensemble des pistes, ou ajuster la cible.'),
    ],
    expect: {
      language: 'fr',
      objectionsNonEmpty: true,
    },
  },
  {
    id: 'fr-vente-estimation',
    note: 'Propriétaire vendeur veut une estimation',
    messages: [
      c('Bonjour, je souhaite vendre mon appartement de 3.5 pièces à Genève. Pouvez-vous m\'aider à l\'estimer ?'),
      a('Bonjour, bien sûr. Quand a-t-il été rénové et à quel étage se trouve-t-il ?'),
      c('Rénové en 2019, 4e étage avec ascenseur.'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['vente', 'vendre', 'estim', 'autre'],
    },
  },
  {
    id: 'fr-exploratoire-faible',
    note: 'Recherche exploratoire, pas pressé — urgency faible',
    messages: [
      c('Bonjour, on regarde un peu le marché sans urgence, juste pour se faire une idée des prix vers Vevey. On n\'est pas pressés du tout.'),
      a('Bonjour, avec plaisir. Vous visez plutôt de l\'ancien ou du neuf ?'),
      c('Aucune idée encore, on explore tranquillement pour l\'année prochaine.'),
    ],
    expect: {
      language: 'fr',
      urgency: 'faible',
    },
  },
  {
    id: 'fr-neutre-info',
    note: 'Échange d\'info neutre',
    messages: [
      c('Bonjour, à quelle heure est la permanence à l\'agence demain ?'),
      a('Bonjour, de 9h à 12h et de 14h à 18h.'),
      c('Merci.'),
    ],
    expect: {
      language: 'fr',
      sentiment: 'neutre',
      nextActionOneOf: ['repondre', 'rien'],
    },
  },
  {
    id: 'fr-commitment-double',
    note: 'Engagements des deux côtés — commitments',
    messages: [
      c('Vous pourriez m\'envoyer les plans et le PPE ?'),
      a('Bien sûr, je vous envoie les plans et le règlement PPE ce soir. De votre côté, pouvez-vous me confirmer votre budget ?'),
      c('Oui je vous confirme 950 000 max. Je suis dispo samedi 14h pour visiter.'),
    ],
    expect: {
      language: 'fr',
      commitmentsNonEmpty: true,
    },
  },
  {
    id: 'fr-pii-avs-iban',
    note: 'PII fictives (AVS + IBAN) — DOIVENT être rédigées, nom/tel préservés',
    messages: [
      c('Bonjour, pour le dossier voici mes infos : Camille Rochat, tél 079 412 88 21. Mon numéro AVS est 756.1234.5678.97 et mon IBAN CH9300762011623852957.'),
      a('Merci Camille, je transmets au service dossier.'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['dossier', 'document', 'candidature', 'autre'],
      hasLead: true,           // « Camille Rochat » se présente → prospect identifiable
      leadIsThirdParty: false,
      mustNotLeak: ['756.1234.5678.97', 'CH9300762011623852957', '1234.5678'],
      mustPreserve: ['Camille', 'Rochat'],
    },
  },
  {
    id: 'fr-pii-mdp',
    note: 'PII fictive (mot de passe) — DOIT être rédigée',
    messages: [
      c('Bonjour, j\'ai créé mon accès au portail, mot de passe: Genève2026!secret. C\'est bon pour le suivi ?'),
      a('Bonjour, parfait, votre espace est actif. Ne partagez jamais votre mot de passe par message.'),
    ],
    expect: {
      language: 'fr',
      mustNotLeak: ['Genève2026!secret'],
    },
  },
  {
    id: 'de-achat-visite',
    note: 'Allemand — achat + visite',
    messages: [
      c('Guten Tag, ich interessiere mich für die 4.5-Zimmer-Wohnung in Zürich. Kann ich sie besichtigen?'),
      a('Guten Tag! Gerne. Wann würde es Ihnen diese Woche passen?'),
      c('Donnerstagnachmittag wäre ideal. Wir möchten bis Ende Jahr kaufen.'),
    ],
    expect: {
      language: 'de',
      nextActionOneOf: ['planifier_visite', 'qualifier_lead'],
    },
  },
  {
    id: 'de-frage-dossier',
    note: 'Allemand — question dossier',
    messages: [
      c('Guten Tag, welche Unterlagen brauchen Sie für die Bewerbung auf die Mietwohnung?'),
      a('Guten Tag, ich benötige einen Ausweis, drei Lohnabrechnungen und einen Betreibungsauszug.'),
    ],
    expect: {
      language: 'de',
      intentIncludesAny: ['dossier', 'document', 'bewerbung', 'unterlagen', 'miet'],
    },
  },
  {
    id: 'en-relocation',
    note: 'Anglais — expat en relocation',
    messages: [
      c('Hi, I\'m relocating to Geneva for work and need to rent a 2-bedroom flat by next month. Budget around 3000 CHF.'),
      a('Hello! Happy to help. Which area of Geneva do you prefer?'),
      c('Close to the international organisations if possible. Fairly urgent, thanks.'),
    ],
    expect: {
      language: 'en',
      intentIncludesAny: ['location', 'rent', 'louer'],
      urgency: 'haute',
    },
  },
  {
    id: 'en-question-docs',
    note: 'Anglais — question documents',
    messages: [
      c('Hello, what documents do I need to submit an offer on the apartment?'),
      a('Hi, you\'ll need an ID, proof of funds and your latest salary slips.'),
      c('Great, thank you.'),
    ],
    expect: {
      language: 'en',
      sentiment: 'neutre',
    },
  },
  {
    id: 'it-vendita',
    note: 'Italien — vente/estimation',
    messages: [
      c('Buongiorno, vorrei vendere il mio appartamento a Lugano. Potete aiutarmi con una stima?'),
      a('Buongiorno, certamente. In che anno è stato ristrutturato?'),
      c('Ristrutturato nel 2020, terzo piano con ascensore.'),
    ],
    expect: {
      language: 'it',
      intentIncludesAny: ['vente', 'vendere', 'vendita', 'estim', 'stima', 'autre'],
    },
  },
  {
    id: 'fr-lead-tierce',
    note: 'Client sollicite pour un tiers NOMMÉ — lead is_third_party',
    messages: [
      c('Bonjour, je vous contacte pour ma fille Léa Girard qui cherche un studio à louer près de l\'EPFL pour la rentrée. Son budget est de 1300 par mois.'),
      a('Bonjour, avec plaisir. À partir de quand cherche-t-elle exactement ?'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['location', 'louer', 'rent'],
      hasLead: true,
      leadIsThirdParty: true,
    },
  },
  {
    id: 'it-affitto',
    note: 'Italien — location',
    messages: [
      c('Salve, cerco un bilocale in affitto a Lugano, budget 1800 CHF al mese. Cosa avete disponibile?'),
      a('Salve, volentieri. Preferisce il centro o la periferia?'),
    ],
    expect: {
      language: 'it',
      intentIncludesAny: ['location', 'affitto', 'louer', 'rent'],
    },
  },
  {
    id: 'fr-vocal-visite',
    note: 'Note vocale (transcript) — planifier_visite',
    messages: [
      cv('Ouais bonjour, alors voilà j\'appelle pour le duplex à Meyrin, est-ce qu\'on pourrait le visiter la semaine prochaine, genre mardi ou mercredi ? Merci.'),
      a('Bonjour, oui bien sûr. Mardi 17h ou mercredi 12h30, lequel préférez-vous ?'),
    ],
    expect: {
      language: 'fr',
      intentIncludesAny: ['visite', 'rdv', 'rendez', 'achat', 'location'],
      nextActionOneOf: ['planifier_visite', 'repondre', 'rien'],
    },
  },
  {
    id: 'fr-salutation-simple',
    note: 'Simple salutation — cas minimal (langue seulement)',
    messages: [
      c('Bonjour !'),
    ],
    expect: {
      language: 'fr',
      nextActionOneOf: ['repondre', 'rien', 'relancer'],
    },
  },
]
