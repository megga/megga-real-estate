// MEGGA Premier jour — Données calibrage
// Les 4 questions + 60+ zones suisses + mapping priorité → cartes Today
// + checklist d'activation + niveaux d'autonomie + helpers.
//
// Source : handoff-premier-jour/premier-jour/crm-day0-tokens.jsx
import type { ObIconName } from '@/components/onboarding-sugar/primitives'
import type { PxIconName } from '@/components/propertyx/PxIcon'
import type {
  Autonomy,
  D0Answers,
  D0ChecklistItem,
  Dispo,
  Priorite,
  Specialite,
} from './types'

// ─── Les 4 questions du calibrage IA ─────────────────────────────────

export type D0Option<TId extends string> = {
  id: TId
  icon: PxIconName
  label: string
  hint: string
}

export type D0Question =
  | {
      id: 'specialite'
      eyebrow: string
      title: string
      sub: string
      kind: 'cards'
      options: D0Option<Specialite>[]
    }
  | {
      id: 'zone'
      eyebrow: string
      title: string
      sub: string
      kind: 'zone'
    }
  | {
      id: 'dispo'
      eyebrow: string
      title: string
      sub: string
      kind: 'segmented'
      options: { id: Dispo; label: string; hint: string }[]
    }
  | {
      id: 'priorite'
      eyebrow: string
      title: string
      sub: string
      kind: 'cards'
      options: D0Option<Priorite>[]
    }

export const D0_QUESTIONS: D0Question[] = [
  {
    id: 'specialite',
    eyebrow: '01 / 04',
    title: 'Sur quoi vous concentrez-vous principalement ?',
    sub: 'Pour adapter votre pipeline, vos templates de documents et les suggestions IA.',
    kind: 'cards',
    options: [
      { id: 'vente', icon: 'home', label: 'Vente résidentielle', hint: 'Maisons, appartements en propriété' },
      { id: 'location', icon: 'building', label: 'Location', hint: 'Baux à loyer, gérance' },
      { id: 'commercial', icon: 'pipeline', label: 'Commercial / Investissement', hint: 'Bureaux, immeubles de rendement' },
      { id: 'mix', icon: 'target', label: 'Un peu de tout', hint: 'Plusieurs spécialités en parallèle' },
    ],
  },
  {
    id: 'zone',
    eyebrow: '02 / 04',
    title: 'Où travaillez-vous ?',
    sub: 'Cherchez un canton, une ville ou une région. Plusieurs zones possibles.',
    kind: 'zone',
  },
  {
    id: 'dispo',
    eyebrow: '03 / 04',
    title: 'Quand puis-je vous solliciter ?',
    sub: 'Je vous rappelle les actions, génère vos relances et calcule vos SLA sur cette base.',
    kind: 'segmented',
    options: [
      { id: 'office', label: 'Bureau', hint: 'Lundi à vendredi · 9h à 18h' },
      { id: 'wide', label: 'Élargi', hint: 'Lundi à samedi · 8h à 20h' },
      { id: '247', label: 'Toujours', hint: 'Pas de limite horaire — vous gérez' },
    ],
  },
  {
    id: 'priorite',
    eyebrow: '04 / 04',
    title: 'Votre priorité des 30 prochains jours ?',
    sub: "Cette réponse pilote les actions que MEGGA AI vous propose en premier sur Aujourd'hui.",
    kind: 'cards',
    options: [
      { id: 'acquisition', icon: 'target', label: 'Trouver de nouveaux mandats', hint: 'Vous voulez remplir votre pipeline' },
      { id: 'closing', icon: 'flag', label: 'Vendre mes mandats actuels', hint: 'Votre stock est là, il faut closer' },
      { id: 'fidelisation', icon: 'sparkle', label: 'Améliorer mon suivi client', hint: 'Vos clients doivent revenir' },
    ],
  },
]

// ─── Routes CRM ciblées par les cartes priorité ──────────────────────
// Au clic sur une carte priorité du Today Premier jour, on quitte le sas
// (first_day_done=true + AuditEvent) et on atterrit directement sur la
// page CRM correspondante. Si l'id n'est pas listé ici, fallback /dashboard.
//
// Source : handoff-premier-jour/HANDOFF_PREMIER_JOUR_CLAUDE_CODE.md §"Phase today".

export const D0_PRIORITY_ROUTES: Record<string, string> = {
  mandat: '/dashboard/listings/new',
  matching: '/dashboard/matching',
  import: '/dashboard/contacts/import',
  agenda: '/dashboard/calendar',
  // Les intégrations email sont dans Settings (section Integrations). Deep-link
  // direct à ajouter quand SettingsSugarV2Page supportera ?section=integrations.
  mail: '/dashboard/settings',
  templates: '/dashboard/documents/templates/new',
}

// Quels id de cartes priorité correspondent aussi à un item de la checklist
// d'activation (cocher l'item au clic, idempotent).
export const D0_PRIORITY_TO_CHECKLIST: Record<string, string> = {
  mandat: 'mandat',
  import: 'import',
  agenda: 'agenda',
  mail: 'mail',
  templates: 'templates',
  // 'matching' n'a pas d'équivalent checklist — c'est une activation auto
  // côté serveur, pas une étape manuelle.
}

// ─── Mapping priorité Q4 → 3 cartes priorité sur Aujourd'hui ─────────

export type D0PriorityCard = {
  id: string
  icon: ObIconName
  title: string
  sub: string
}

export type D0PriorityBlock = {
  intro: string
  cards: D0PriorityCard[]
}

export const D0_PRIORITY_MAP: Record<Priorite, D0PriorityBlock> = {
  acquisition: {
    intro: 'Vous voulez remplir votre pipeline. Voici par où je commencerais.',
    cards: [
      { id: 'mandat', icon: 'home', title: 'Créer votre 1ᵉʳ mandat', sub: "5 min · le bien d'abord, le reste suit" },
      { id: 'matching', icon: 'target', title: 'Activer le matching IA', sub: 'Je scanne les acheteurs qui correspondent' },
      { id: 'import', icon: 'upload', title: 'Importer vos contacts', sub: 'CSV, Gmail ou saisie rapide' },
    ],
  },
  closing: {
    intro: 'Votre stock est là. Voici par où je commencerais pour le faire bouger.',
    cards: [
      { id: 'mandat', icon: 'home', title: 'Créer votre 1ᵉʳ mandat', sub: '5 min · pour activer le pipeline' },
      { id: 'import', icon: 'user', title: 'Importer vos acheteurs', sub: 'Je vais les matcher avec vos mandats' },
      { id: 'agenda', icon: 'clock', title: 'Connecter votre agenda', sub: 'Pour caler les visites en 1 clic' },
    ],
  },
  fidelisation: {
    intro: 'Vos clients doivent revenir. Voici par où je commencerais.',
    cards: [
      { id: 'import', icon: 'user', title: 'Importer vos contacts', sub: "Tout l'historique au même endroit" },
      { id: 'mail', icon: 'mail', title: 'Connecter votre boîte mail', sub: 'Je suis vos échanges automatiquement' },
      { id: 'templates', icon: 'info', title: 'Configurer vos templates', sub: 'Vos relances en un clic, à votre voix' },
    ],
  },
}

// ─── Zones géographiques (Suisse complète) ────────────────────────────
// 26 cantons + régions FR + principales villes — 60+ entrées.
// `popular: true` → affiché dans les suggestions par défaut (recherche vide).

export type D0Zone = {
  id: string
  type: 'region' | 'canton' | 'city' | 'country'
  label: string
  code?: string
  cantons: string[]
  popular?: boolean
  alt?: string[]
}

export const D0_ZONES: D0Zone[] = [
  // Régions populaires
  { id: 'arc-leman', type: 'region', label: 'Arc lémanique', cantons: ['VD', 'GE'], popular: true, alt: ['léman', 'leman'] },
  { id: 'suisse-romande', type: 'region', label: 'Suisse romande', cantons: ['VD', 'GE', 'VS', 'FR', 'NE', 'JU', 'BE'], popular: true, alt: ['romandie', 'romand'] },
  { id: 'suisse', type: 'country', label: 'Toute la Suisse', cantons: [], popular: true, alt: ['ch', 'switzerland'] },
  { id: 'riviera', type: 'region', label: 'Riviera vaudoise', cantons: ['VD'], alt: ['montreux', 'vevey'] },
  { id: 'la-cote', type: 'region', label: 'La Côte', cantons: ['VD'], alt: ['morges', 'rolle', 'nyon'] },
  { id: 'chablais', type: 'region', label: 'Chablais', cantons: ['VD', 'VS'], alt: ['aigle', 'monthey'] },
  { id: 'gros-de-vaud', type: 'region', label: 'Gros-de-Vaud', cantons: ['VD'], alt: ['echallens'] },
  { id: 'valais-central', type: 'region', label: 'Valais central', cantons: ['VS'], alt: ['sion', 'sierre'] },

  // Cantons romands (top)
  { id: 'c-vd', type: 'canton', label: 'Vaud', code: 'VD', cantons: ['VD'], popular: true },
  { id: 'c-ge', type: 'canton', label: 'Genève', code: 'GE', cantons: ['GE'], popular: true },
  { id: 'c-vs', type: 'canton', label: 'Valais', code: 'VS', cantons: ['VS'], popular: true },
  { id: 'c-fr', type: 'canton', label: 'Fribourg', code: 'FR', cantons: ['FR'], popular: true },
  { id: 'c-ne', type: 'canton', label: 'Neuchâtel', code: 'NE', cantons: ['NE'] },
  { id: 'c-ju', type: 'canton', label: 'Jura', code: 'JU', cantons: ['JU'] },
  { id: 'c-be', type: 'canton', label: 'Berne', code: 'BE', cantons: ['BE'], alt: ['bern'] },

  // Cantons alémaniques / italophones
  { id: 'c-ti', type: 'canton', label: 'Tessin', code: 'TI', cantons: ['TI'], alt: ['ticino'] },
  { id: 'c-zh', type: 'canton', label: 'Zurich', code: 'ZH', cantons: ['ZH'], alt: ['zürich'] },
  { id: 'c-bs', type: 'canton', label: 'Bâle-Ville', code: 'BS', cantons: ['BS'], alt: ['basel', 'bale'] },
  { id: 'c-bl', type: 'canton', label: 'Bâle-Campagne', code: 'BL', cantons: ['BL'], alt: ['baselland'] },
  { id: 'c-lu', type: 'canton', label: 'Lucerne', code: 'LU', cantons: ['LU'], alt: ['luzern'] },
  { id: 'c-sg', type: 'canton', label: 'Saint-Gall', code: 'SG', cantons: ['SG'], alt: ['st gallen', 'sankt gallen'] },
  { id: 'c-ag', type: 'canton', label: 'Argovie', code: 'AG', cantons: ['AG'], alt: ['aargau'] },
  { id: 'c-zg', type: 'canton', label: 'Zoug', code: 'ZG', cantons: ['ZG'], alt: ['zug'] },
  { id: 'c-so', type: 'canton', label: 'Soleure', code: 'SO', cantons: ['SO'], alt: ['solothurn'] },
  { id: 'c-tg', type: 'canton', label: 'Thurgovie', code: 'TG', cantons: ['TG'], alt: ['thurgau'] },
  { id: 'c-sz', type: 'canton', label: 'Schwyz', code: 'SZ', cantons: ['SZ'] },
  { id: 'c-gr', type: 'canton', label: 'Grisons', code: 'GR', cantons: ['GR'], alt: ['graubünden', 'graubunden'] },
  { id: 'c-sh', type: 'canton', label: 'Schaffhouse', code: 'SH', cantons: ['SH'], alt: ['schaffhausen'] },
  { id: 'c-ur', type: 'canton', label: 'Uri', code: 'UR', cantons: ['UR'] },
  { id: 'c-ow', type: 'canton', label: 'Obwald', code: 'OW', cantons: ['OW'], alt: ['obwalden'] },
  { id: 'c-nw', type: 'canton', label: 'Nidwald', code: 'NW', cantons: ['NW'], alt: ['nidwalden'] },
  { id: 'c-gl', type: 'canton', label: 'Glaris', code: 'GL', cantons: ['GL'], alt: ['glarus'] },
  { id: 'c-ar', type: 'canton', label: 'Appenzell Rh.-Ext.', code: 'AR', cantons: ['AR'] },
  { id: 'c-ai', type: 'canton', label: 'Appenzell Rh.-Int.', code: 'AI', cantons: ['AI'] },

  // Villes principales
  { id: 'v-lausanne', type: 'city', label: 'Lausanne', cantons: ['VD'], popular: true },
  { id: 'v-geneve', type: 'city', label: 'Genève', cantons: ['GE'], popular: true },
  { id: 'v-montreux', type: 'city', label: 'Montreux', cantons: ['VD'] },
  { id: 'v-vevey', type: 'city', label: 'Vevey', cantons: ['VD'] },
  { id: 'v-nyon', type: 'city', label: 'Nyon', cantons: ['VD'] },
  { id: 'v-morges', type: 'city', label: 'Morges', cantons: ['VD'] },
  { id: 'v-yverdon', type: 'city', label: 'Yverdon-les-Bains', cantons: ['VD'], alt: ['yverdon'] },
  { id: 'v-sion', type: 'city', label: 'Sion', cantons: ['VS'] },
  { id: 'v-martigny', type: 'city', label: 'Martigny', cantons: ['VS'] },
  { id: 'v-verbier', type: 'city', label: 'Verbier', cantons: ['VS'] },
  { id: 'v-crans', type: 'city', label: 'Crans-Montana', cantons: ['VS'], alt: ['crans', 'montana'] },
  { id: 'v-fribourg', type: 'city', label: 'Fribourg', cantons: ['FR'] },
  { id: 'v-bulle', type: 'city', label: 'Bulle', cantons: ['FR'] },
  { id: 'v-neuchatel', type: 'city', label: 'Neuchâtel', cantons: ['NE'] },
  { id: 'v-cdf', type: 'city', label: 'La Chaux-de-Fonds', cantons: ['NE'], alt: ['chaux de fonds'] },
  { id: 'v-delemont', type: 'city', label: 'Delémont', cantons: ['JU'] },
  { id: 'v-bienne', type: 'city', label: 'Bienne', cantons: ['BE'], alt: ['biel'] },
  { id: 'v-berne', type: 'city', label: 'Berne', cantons: ['BE'], alt: ['bern'] },
  { id: 'v-lugano', type: 'city', label: 'Lugano', cantons: ['TI'] },
  { id: 'v-locarno', type: 'city', label: 'Locarno', cantons: ['TI'] },
  { id: 'v-zurich', type: 'city', label: 'Zurich', cantons: ['ZH'], alt: ['zürich'] },
  { id: 'v-bale', type: 'city', label: 'Bâle', cantons: ['BS'], alt: ['basel'] },
  { id: 'v-lucerne', type: 'city', label: 'Lucerne', cantons: ['LU'], alt: ['luzern'] },
]

// ─── Helpers ──────────────────────────────────────────────────────────

export const findZone = (id: string): D0Zone | undefined =>
  D0_ZONES.find((z) => z.id === id)

export const d0ZoneSubtitle = (z: D0Zone): string => {
  if (z.type === 'country') return 'Pays entier'
  if (z.type === 'canton') return `Canton${z.code ? ' · ' + z.code : ''}`
  if (z.type === 'city')
    return `Ville${z.cantons[0] ? ' · ' + z.cantons[0] : ''}`
  if (z.cantons.length === 0) return 'Région'
  return z.cantons.length > 3
    ? `Région · ${z.cantons.length} cantons`
    : `Région · ${z.cantons.join(' + ')}`
}

export const d0ZoneListLabel = (
  ids: string[],
  opts: { fallback?: string } = {},
): string => {
  const list = ids.map(findZone).filter((z): z is D0Zone => !!z)
  if (list.length === 0) return opts.fallback || '—'
  if (list.length === 1) return list[0].label
  if (list.length === 2) return `${list[0].label} et ${list[1].label}`
  if (list.length <= 3) return list.map((z) => z.label).join(', ')
  return `${list[0].label}, ${list[1].label} +${list.length - 2}`
}

// ─── Checklist d'activation (5 étapes) ───────────────────────────────

export const D0_CHECKLIST: D0ChecklistItem[] = [
  { id: 'mandat', icon: 'home', label: 'Créer votre 1ᵉʳ mandat', est: '5 min', done: false },
  { id: 'import', icon: 'user', label: 'Importer vos contacts', est: '2 min', done: false },
  { id: 'agenda', icon: 'clock', label: 'Connecter votre agenda', est: '1 min', done: false },
  { id: 'mail', icon: 'mail', label: 'Connecter votre boîte mail', est: '1 min', done: false },
  { id: 'templates', icon: 'info', label: 'Configurer vos templates', est: '3 min', done: false },
]

// ─── Engagements IA (synthèse) selon les réponses ────────────────────

export type D0Commitment = { id: string; text: string }

export const d0BuildCommitments = (answers: D0Answers): D0Commitment[] => {
  const dispo =
    answers.dispo === 'office'
      ? 'entre 9h et 18h, jamais en dehors'
      : answers.dispo === 'wide'
        ? 'de 8h à 20h, du lundi au samedi'
        : answers.dispo === '247'
          ? 'à tout moment, vous fixez vos limites'
          : 'sur vos plages habituelles'

  const zoneLabel = d0ZoneListLabel(answers.zone, { fallback: 'votre zone' })

  const specLabel: Record<Specialite, string> = {
    vente: 'vendeurs',
    location: 'locataires et propriétaires',
    commercial: 'investisseurs',
    mix: 'clients',
  }
  const spec = answers.specialite ? specLabel[answers.specialite] : 'clients'

  const prioCommit: Record<Priorite, string> = {
    acquisition: 'Chaque matin, je vous propose 3 pistes de nouveaux mandats à activer.',
    closing: 'Je vous prépare votre lundi matin avec vos mandats à faire bouger en priorité.',
    fidelisation: 'Je détecte les clients silencieux depuis +60 jours et vous propose des relances.',
  }
  const prio = answers.priorite
    ? prioCommit[answers.priorite]
    : "Je vous propose 3 actions chaque matin sur Aujourd'hui."

  return [
    { id: 'dispo', text: `Je relance vos ${spec} ${dispo}.` },
    { id: 'zone', text: `Je flag les leads hors ${zoneLabel} pour que vous gardiez le focus.` },
    { id: 'prio', text: prio },
    {
      id: 'ai',
      text:
        "Tous mes brouillons restent en attente de votre validation tant que vous n'élevez pas mon niveau d'autonomie.",
    },
  ]
}

// ─── Niveaux d'autonomie IA ──────────────────────────────────────────

export type D0AutonomyLevel = {
  id: Autonomy
  label: string
  short: string
  desc: string
}

export const D0_AUTONOMY: D0AutonomyLevel[] = [
  {
    id: 'suggest',
    label: 'Suggère',
    short: 'Suggère',
    desc: 'Je vous propose, vous décidez. Aucune action sans votre validation explicite.',
  },
  {
    id: 'notify',
    label: 'Agis & préviens',
    short: 'Agis & préviens',
    desc: "J'envoie les relances simples (SMS de courtoisie, accusés) et je vous préviens. Le reste passe par vous.",
  },
  {
    id: 'resume',
    label: 'Fais & résume',
    short: 'Fais & résume',
    desc: "Je gère votre pipeline en autonomie. Vous recevez un résumé chaque matin de ce que j'ai fait.",
  },
]
