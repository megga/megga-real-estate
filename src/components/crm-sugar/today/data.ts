// MEGGA CRM — Refonte « Aujourd'hui » · DONNÉES DÉMO (port fidèle du prototype)
// ----------------------------------------------------------------------------
// Port 1:1 de `DATA` / `PHOTO` / `fmtCHF` (today-redesign-kit.jsx).
//
// ⚠️ DONNÉES DE DÉMONSTRATION — pas encore câblées sur Supabase. Le handoff
// prescrit « porter à l'identique d'abord, câbler ensuite » : ce module est la
// source unique du cockpit pour le port VISUEL. Le câblage live (agenda,
// pipeline, objectif, relances, matchs) est la phase suivante.

export const fmtCHF = (n: number): string =>
  'CHF ' + n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")

export const PHOTO = {
  carouge: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1000&q=80',
  champel: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1000&q=80',
  cologny: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000&q=80',
  eauxvives: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1000&q=80',
}

export interface AgendaItem {
  time: string
  label: string
  meta: string
  kind: string
  initials: string
  av: string
  done?: boolean
  now?: boolean
  risk?: boolean
}

export interface EnsuiteItemData {
  initials: string
  av: string
  label: string
  time: string
  tag: string
}

interface PipelineStageData {
  key: string
  count: number
  value: number
  risk?: number
}

interface MatchData {
  contact: string
  initials: string
  av: string
  score: number
  tag: string
  note: string
}

// ─── Données réelles MEGGA (démo) ───────────────────────────────────────────
export const DATA = {
  agent: { name: 'Gregory', full: 'Gregory Lenoir', initials: 'GL', av: '#6F8CFF' },
  date: 'Dimanche 14 juin',
  kpis: { pipeline: 'CHF 7.6M', restantes: 5, faites: 0, risque: 1 },

  focus: {
    contact: 'Marie Bertrand',
    initials: 'MB',
    av: '#5b6cff',
    score: 94,
    kind: 'RELANCE',
    time: '10:00',
    title: 'Recontacter Marie Bertrand',
    sub: 'Suite visite Carouge — opportunité tiède à confirmer',
    ai: "Marie a visité le 3.5p de Carouge il y a 6 jours. Signal d'achat fort, aucune offre concurrente détectée. Fenêtre idéale pour conclure une 2ᵉ visite.",
    bien: { photo: PHOTO.carouge, price: "CHF 890'000", place: 'Carouge', specs: '3.5 p · 78 m²' },
  },

  // file d'attente "ensuite"
  ensuite: [
    { initials: 'JA', av: '#E08A45', label: 'Mandat exclusif — Julien Aebischer', time: '11:30', tag: 'Mandat' },
    { initials: 'ÉS', av: '#39B7C9', label: 'KYC à compléter — Élodie Schmidt', time: 'Auj.', tag: 'KYC' },
    { initials: 'AP', av: '#34C796', label: 'Délai signature — Antoine Picard', time: '14:00', tag: 'Compromis' },
  ] as EnsuiteItemData[],

  // agenda chronologique du jour
  agenda: [
    { time: '09:30', label: 'Relance Pierre Vionnet', meta: '3 nouveaux matchs', kind: 'call', initials: 'PV', av: '#9b7cf0', done: true },
    { time: '10:00', label: 'Appel Marie Bertrand', meta: 'Relance à chaud', kind: 'call', initials: 'MB', av: '#5b6cff', now: true },
    { time: '11:00', label: 'KYC Élodie Schmidt', meta: 'Vérification', kind: 'shield', initials: 'ÉS', av: '#39B7C9' },
    { time: '11:30', label: 'Mandat — Julien Aebischer', meta: 'Signature', kind: 'doc', initials: 'JA', av: '#E08A45' },
    { time: '14:00', label: 'Visite Carouge', meta: 'Marie Bertrand · 45 min', kind: 'home', initials: 'MB', av: '#5b6cff' },
    { time: '16:00', label: 'Suivi offre Cologny', meta: 'Antoine Picard', kind: 'offer', initials: 'AP', av: '#34C796', risk: true },
  ] as AgendaItem[],

  // pipeline par phase
  pipeline: [
    { key: 'recherche', count: 12, value: 9_200_000 },
    { key: 'visite', count: 5, value: 4_100_000 },
    { key: 'offre', count: 3, value: 2_400_000, risk: 1 },
    { key: 'compromis', count: 2, value: 1_850_000 },
  ] as PipelineStageData[],
  pipelineTotal: 'CHF 7.6M',
  dealRisk: { contact: 'Antoine Picard', bien: 'Villa Cologny', value: "CHF 1'850'000", why: 'Délai de signature dépassé de 2 j', initials: 'AP', av: '#34C796' },

  // nouveaux matchs (bien Carouge)
  matchs: [
    { contact: 'Marie Bertrand', initials: 'MB', av: '#5b6cff', score: 94, tag: 'A visité', note: 'Relance à chaud' },
    { contact: 'Sophie Marchand', initials: 'SM', av: '#8B5CF6', score: 91, tag: 'Nouveau', note: 'Profil quasi-idéal' },
    { contact: 'David Rey', initials: 'DR', av: '#2370ff', score: 84, tag: 'Nouveau', note: 'Balcon sud coché' },
    { contact: 'Thomas Berger', initials: 'TB', av: '#74d184', score: 72, tag: 'Investisseur', note: 'Angle rendement' },
  ] as MatchData[],
  matchsBien: "3.5p Carouge · CHF 890'000",

  // objectif / commission
  objectif: {
    projete: 1_075_000,
    objectif: 1_200_000,
    realise: 470_000,
    pct: 90,
    retard: 80_000,
    annee: 2026,
  },

  // session relance IA
  relance: { leads: 47, mins: 35 },
}
