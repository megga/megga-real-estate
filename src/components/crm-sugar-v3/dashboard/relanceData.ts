// MEGGA CRM Sugar v3 — Dashboard Analytics (Sprint 4) — Mock leads relance
// Port pixel-près de sprint-4/crm-dashboard-relance-data.jsx
//
// 47 leads dormants + brouillons IA pré-rédigés + variantes de ton.
// Cette base sert à crédibiliser le sentiment "MEGGA AI a vraiment réfléchi
// pour chaque lead".

export type IconName =
  | 'eye'
  | 'check'
  | 'mail'
  | 'phone'
  | 'doc'
  | 'msg'
  | 'clock'

export type KycStatus = 'verified' | 'pending' | 'none'

export interface RelanceLead {
  id: string
  /** Real Supabase contact id when sourced from `contacts`; null for seed
   * demo leads. Used by the Resend wiring to decide whether to send the
   * email for real or just log the audit attempt against a synthetic
   * destination. */
  contactId: string | null
  /** Real contact email when present. Mock seed leads carry null — the
   * relance session synthesizes `${first}.${last}@relance-demo.megga.local`
   * so the audit row reflects a real Resend attempt + the deliverability
   * failure. When `email` is non-null, the send goes to a real recipient. */
  email: string | null
  first: string
  last: string
  avatarBg: string
  score: number
  bien: string
  bienPrice: string
  budget: string
  kyc: KycStatus
  dormSince: number
  /** True if last_interaction_at was set (real recency). Distinct du sentinel
   * dormSince=999 (NULL) : permet un libellé honnête « jamais recontacté » vs
   * « se refroidit depuis N j » sans collision avec un contact dormant ~999 j. */
  engaged?: boolean
  reason: string
  quote: string | null
  history: Array<{ d: string; t: string; icon: IconName }>
  nextStep: string
  nextStepHint: string
}

export interface DraftTemplate {
  subject: string
  body: string
}

// ─── 8 leads détaillés (les 39 autres sont fillers) ────────────────────
const TOP_LEADS: RelanceLead[] = [
  {
    id: 'lead-01',
    contactId: null,
    email: null,
    first: 'Sophie',
    last: 'Aebischer',
    avatarBg: '#3B82F6',
    score: 84,
    bien: 'Villa Pully · Ch. des Crêts 12',
    bienPrice: "1'450'000",
    budget: '1.4M',
    kyc: 'verified',
    dormSince: 18,
    reason:
      "A visité 2x, KYC validé. N'a plus donné signe après ta dernière relance du 22 avril.",
    quote:
      "« J'hésite entre la Villa Pully et un appartement à Lutry — laissez-moi le week-end. »",
    history: [
      { d: '12 avr.', t: 'Visite 1 · Villa Pully', icon: 'eye' },
      { d: '18 avr.', t: 'KYC validé', icon: 'check' },
      { d: '20 avr.', t: 'Visite 2 · Villa Pully (avec mari)', icon: 'eye' },
      { d: '22 avr.', t: 'Email de suivi (sans réponse)', icon: 'mail' },
    ],
    nextStep: 'Visite #3 ou offre',
    nextStepHint:
      'Couple décisionnaire, signaux d\'achat clairs lors de la 2e visite.',
  },
  {
    id: 'lead-02',
    contactId: null,
    email: null,
    first: 'Marc',
    last: 'Devaud',
    avatarBg: '#10B981',
    score: 76,
    bien: 'Appartement Av. de la Gare 14',
    bienPrice: "780'000",
    budget: '800K',
    kyc: 'pending',
    dormSince: 16,
    reason:
      "A demandé la fiche en ligne mais n'a jamais confirmé de visite. KYC en attente.",
    quote: "« Je dois voir avec ma banque avant de m'engager sur une visite. »",
    history: [
      { d: '30 avr.', t: 'Demande fiche en ligne', icon: 'mail' },
      { d: '1 mai', t: 'Appel téléphonique (5 min)', icon: 'phone' },
      { d: '3 mai', t: 'Document KYC envoyé (non rempli)', icon: 'doc' },
    ],
    nextStep: 'Visite à programmer',
    nextStepHint:
      'Probable freezing par incertitude bancaire. Proposer un RDV banque commun.',
  },
  {
    id: 'lead-03',
    contactId: null,
    email: null,
    first: 'Léa',
    last: 'Rochat',
    avatarBg: '#F59E0B',
    score: 91,
    bien: 'Loft Ouchy Marquisat',
    bienPrice: "1'120'000",
    budget: '1.2M cash',
    kyc: 'verified',
    dormSince: 14,
    reason:
      'Lead extrêmement chaud. KYC parfait, cash disponible. Inactive depuis sa visite seule.',
    quote: '« Je dois revenir avec mon décorateur la semaine prochaine. »',
    history: [
      { d: '26 avr.', t: 'Visite 1 · Loft Ouchy', icon: 'eye' },
      { d: '28 avr.', t: 'KYC + preuve de fonds reçus', icon: 'check' },
      { d: '30 avr.', t: 'Message « je reviens avec déco »', icon: 'msg' },
    ],
    nextStep: 'Offre à attendre cette semaine',
    nextStepHint:
      "Tu es probablement à 48-72h d'une offre. Ne pas presser, juste ré-ouvrir la conversation.",
  },
  {
    id: 'lead-04',
    contactId: null,
    email: null,
    first: 'Pierre',
    last: 'Müller',
    avatarBg: '#8B5CF6',
    score: 62,
    bien: 'Maison Lutry · Rte du Lac',
    bienPrice: "1'890'000",
    budget: '1.5M (au-dessus du budget)',
    kyc: 'none',
    dormSince: 22,
    reason:
      'Visite enthousiaste mais budget de 400K en dessous du prix demandé.',
    quote: '« On adore mais c\'est 400K trop cher pour nous. »',
    history: [
      { d: '20 avr.', t: 'Visite 1 · Maison Lutry', icon: 'eye' },
      { d: '21 avr.', t: 'Message d\'enthousiasme', icon: 'msg' },
      { d: '23 avr.', t: 'Refus budgétaire', icon: 'msg' },
    ],
    nextStep: 'Proposer biens alternatifs',
    nextStepHint:
      'Ne pas insister sur Lutry. Lui matcher 3 biens dans son budget réel.',
  },
  {
    id: 'lead-05',
    contactId: null,
    email: null,
    first: 'Camille',
    last: 'Schneider',
    avatarBg: '#EF4444',
    score: 79,
    bien: 'Studio Flon · Rue Centrale',
    bienPrice: "395'000",
    budget: '400K',
    kyc: 'verified',
    dormSince: 19,
    reason:
      'Premier achat, KYC validé. A visité 3 studios différents sans se décider.',
    quote: '« J\'ai peur de me tromper, c\'est mon premier achat. »',
    history: [
      { d: '15 avr.', t: 'Visite 1 · Studio Flon', icon: 'eye' },
      { d: '17 avr.', t: 'Visite Studio Cité (refus)', icon: 'eye' },
      { d: '19 avr.', t: 'Visite Studio Bel-Air (refus)', icon: 'eye' },
      { d: '20 avr.', t: 'Email rassurance', icon: 'mail' },
    ],
    nextStep: 'Accompagner vers la décision',
    nextStepHint:
      "A besoin de réassurance, pas de plus d'options. Proposer un rdv conseil 30 min.",
  },
  {
    id: 'lead-06',
    contactId: null,
    email: null,
    first: 'Thomas',
    last: 'Favre',
    avatarBg: '#06B6D4',
    score: 71,
    bien: 'Duplex Cité · Rue Centrale 8',
    bienPrice: "920'000",
    budget: '1M',
    kyc: 'verified',
    dormSince: 17,
    reason:
      'A visité et aimé. Voulait revenir avec sa compagne, jamais reprogrammé.',
    quote: '« Elle travaille à Genève, on doit caler son agenda. »',
    history: [
      { d: '25 avr.', t: 'Visite 1 · Duplex Cité', icon: 'eye' },
      { d: '26 avr.', t: 'Demande visite à 2', icon: 'msg' },
    ],
    nextStep: 'Programmer visite #2',
    nextStepHint:
      'Proposer 3 créneaux concrets (soir / week-end) pour faciliter la coordination.',
  },
  {
    id: 'lead-07',
    contactId: null,
    email: null,
    first: 'Aïcha',
    last: 'Dupont',
    avatarBg: '#EC4899',
    score: 88,
    bien: 'Villa St-Sulpice · Rte du Lac',
    bienPrice: "2'350'000",
    budget: '2.5M',
    kyc: 'verified',
    dormSince: 21,
    reason:
      'Couple de médecins, 2.5M budget, visite excellente. Silence depuis 3 semaines.',
    quote:
      '« Notre fille rentre en école Pully en septembre, on doit décider vite. »',
    history: [
      { d: '23 avr.', t: 'Visite 1 · Villa St-Sulpice', icon: 'eye' },
      { d: '25 avr.', t: 'KYC + 2.5M validés', icon: 'check' },
    ],
    nextStep: 'Relancer avant que l\'urgence école s\'installe',
    nextStepHint:
      'L\'urgence scolaire est ton meilleur allié. Subtilement la rappeler.',
  },
  {
    id: 'lead-08',
    contactId: null,
    email: null,
    first: 'Olivier',
    last: 'Maillard',
    avatarBg: '#84CC16',
    score: 65,
    bien: 'Penthouse Beau-Rivage',
    bienPrice: "3'200'000",
    budget: 'non confirmé',
    kyc: 'none',
    dormSince: 25,
    reason: 'Lead tiède, demande de visite mais budget jamais validé.',
    quote: '« On regarde, on n\'est pas pressés. »',
    history: [
      { d: '20 avr.', t: 'Demande visite (refusée par toi : KYC)', icon: 'msg' },
    ],
    nextStep: 'Qualifier avant tout',
    nextStepHint:
      'Ne pas accorder de visite sans KYC + preuve de fonds. Polite mais ferme.',
  },
]

// ─── Fillers pour atteindre 47 leads ───────────────────────────────────
const FILLER_FIRSTS = ['Nadia', 'Lucas', 'Marie', 'Antoine', 'Élodie', 'Julien', 'Sarah', 'Hugo', 'Inès', 'Vincent', 'Clara', 'François', 'Émilie', 'Romain', 'Laure', 'Bastien', 'Alice', 'Damien', 'Chloé', 'Florian', 'Manon', 'Quentin', 'Pauline', 'Adrien', 'Lise', 'Mathieu', 'Anouk', 'Cyril', 'Hélène', 'Nicolas', 'Justine', 'Sébastien', 'Karine', 'Théo', 'Solène', 'Yann', 'Audrey', 'Maxime', 'Anaïs']
const FILLER_LASTS = ['Henchoz', 'Bochud', 'Pasche', 'Romanens', 'Curty', 'Cottet', 'Vauthey', 'Charrière', 'Genoud', 'Risse', 'Mooser', 'Yerly', 'Buchs', 'Schornoz', 'Pillonel', 'Pochon', 'Demierre', 'Volery', 'Brodard', 'Lambert', 'Magnin', 'Ottoz', 'Bersier', 'Crausaz', 'Dafflon', 'Riedo', 'Schaller', 'Tinguely', 'Werro', 'Zosso', 'Andrey', 'Bapst', 'Chassot', 'Délitroz', 'Egger', 'Fasel', 'Galley', 'Hayoz', 'Imhof']
const FILLER_BIENS = [
  { n: 'Villa Pully · Ch. des Crêts 12', p: "1'450'000" },
  { n: 'Appartement Av. de la Gare 14', p: "780'000" },
  { n: 'Maison Lutry · Rte du Lac', p: "1'890'000" },
  { n: 'Studio Flon · Rue Centrale', p: "395'000" },
  { n: 'Chalet Verbier · Les Combins', p: "2'140'000" },
]
const AVATAR_BGS = ['#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EF4444', '#06B6D4', '#EC4899', '#84CC16']
const DORM_REASONS = [
  { r: 'A visité une fois mais n\'a pas reprogrammé.', q: '« On y réfléchit. »' },
  { r: 'Demande d\'info envoyée, sans suite.', q: '« Je vous tiens au courant. »' },
  { r: 'Visite annulée à la dernière minute, jamais reprogrammée.', q: '« Désolé pour aujourd\'hui, on se rappelle. »' },
  { r: 'KYC initié mais jamais complété.', q: '« Je vous envoie les docs ce week-end. »' },
  { r: 'A vu la fiche en ligne plusieurs fois sans demander visite.', q: null },
]

function buildFillers(): RelanceLead[] {
  const fillers: RelanceLead[] = []
  for (let i = 0; i < 39; i++) {
    const f = FILLER_FIRSTS[i % FILLER_FIRSTS.length]
    const l = FILLER_LASTS[i % FILLER_LASTS.length]
    const b = FILLER_BIENS[i % FILLER_BIENS.length]
    const r = DORM_REASONS[i % DORM_REASONS.length]
    fillers.push({
      id: `lead-${String(9 + i).padStart(2, '0')}`,
      contactId: null,
      email: null,
      first: f,
      last: l,
      avatarBg: AVATAR_BGS[i % AVATAR_BGS.length],
      score: 50 + ((i * 7) % 40),
      bien: b.n,
      bienPrice: b.p,
      budget: ['650K', '850K', '1M', '1.2M', '1.5M', '2M'][i % 6],
      kyc: (['verified', 'pending', 'none'] as const)[i % 3],
      dormSince: 14 + (i % 30),
      reason: r.r,
      quote: r.q,
      history: [
        { d: '20 avr.', t: 'Première interaction MEGGA', icon: 'mail' },
        { d: `${22 + (i % 6)} avr.`, t: 'Visite ou demande', icon: 'eye' },
        { d: `${28 + (i % 4)} avr.`, t: 'Dernière réponse de ta part', icon: 'msg' },
      ],
      nextStep: ['Relance simple', 'Programmer un appel', 'Proposer visite #2', 'Relance plus chaleureuse'][i % 4],
      nextStepHint:
        'Lead avec signaux modérés. Une relance personnalisée peut le réveiller.',
    })
  }
  return fillers
}

export const RELANCE_LEADS: RelanceLead[] = [...TOP_LEADS, ...buildFillers()]

// ─── Brouillons MEGGA AI par lead ──────────────────────────────────────


// ─── Variantes de ton MEGGA AI ─────────────────────────────────────────
export type ToneId = 'formaliser' | 'chaleureux' | 'court' | 'detaille' | 'recreer'


export interface ToneAction {
  id: ToneId
  label: string
  hint: string
}

// ─── Session storage (pause/reprise) ───────────────────────────────────
const SESSION_STORAGE_KEY = 'megga.session.relance.v1'

export interface RelanceSessionState {
  version: 1
  currentIdx: number
  treated: Record<string, { action: 'sent' | 'called' | 'postponed'; ts: number }>
  drafts: Record<string, DraftTemplate>
  startedAt: number
}

export function loadSession(): RelanceSessionState | null {
  try {
    const raw = localStorage.getItem(SESSION_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}
