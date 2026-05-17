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
  first: string
  last: string
  avatarBg: string
  score: number
  bien: string
  bienPrice: string
  budget: string
  kyc: KycStatus
  dormSince: number
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
const DRAFT_TEMPLATES: Record<string, DraftTemplate> = {
  'lead-01': {
    subject: 'Toujours intéressée par la Villa Pully, Sophie ?',
    body: 'Bonjour Sophie,\n\nJe pense à vous : cela fait quelques semaines depuis votre seconde visite de la Villa Pully avec votre mari, et je voulais simplement m\'assurer que vous aviez toutes les informations dont vous aviez besoin.\n\nVous m\'aviez parlé d\'hésitation avec un appartement à Lutry — est-ce que ce point s\'est éclairci de votre côté ?\n\nJe reste à disposition pour une 3e visite ou pour vous présenter une offre formelle si vous le souhaitez. Le bien suscite de l\'intérêt et je préfère vous en informer.\n\nÀ très bientôt,\nJulien Berset',
  },
  'lead-02': {
    subject: 'Un rendez-vous banque ensemble, Marc ?',
    body: 'Bonjour Marc,\n\nVous m\'avez dit la dernière fois que vous deviez voir avec votre banque avant de programmer une visite. Je voulais vous proposer quelque chose : si cela peut vous aider, je peux vous accompagner à ce rendez-vous bancaire.\n\nJ\'ai l\'habitude de ce type de réunion, et avec votre profil le dossier devrait être simple. Cela vous éviterait d\'y aller seul et accélérerait les choses.\n\nDeux créneaux possibles cette semaine, dites-moi ce qui vous arrange.\n\nBien à vous,\nJulien Berset',
  },
  'lead-03': {
    subject: 'Le Loft Ouchy vous attend, Léa',
    body: 'Bonjour Léa,\n\nJ\'espère que votre décorateur a pu vous accompagner sur le Loft Ouchy. Je voulais juste vous confirmer que le bien est toujours disponible et que je n\'ai pas d\'autre offre active actuellement — vous avez donc tout le temps de prendre votre décision sereinement.\n\nSi vous avez besoin d\'une 3e visite, de plans plus détaillés ou de tout autre élément, n\'hésitez pas.\n\nAu plaisir,\nJulien Berset',
  },
  'lead-04': {
    subject: 'Trois alternatives dans votre budget, Pierre',
    body: 'Bonjour Pierre,\n\nJe comprends parfaitement votre retour sur le prix de la Maison Lutry. Plutôt que de chercher à négocier (peu probable à ce niveau), j\'ai préparé 3 biens qui correspondent à votre budget réel et à vos critères :\n\n— Maison St-Sulpice, 1.45M, jardin similaire\n— Villa Bourg-en-Lavaux, 1.39M, vue dégagée\n— Maison Cully, 1.42M, plus récente\n\nDites-moi lequel vous interpelle, je vous organise une visite cette semaine.\n\nÀ bientôt,\nJulien Berset',
  },
  'lead-05': {
    subject: 'Un café pour faire le point, Camille ?',
    body: 'Bonjour Camille,\n\nC\'est tout à fait normal d\'hésiter pour un premier achat — beaucoup de mes clients passent par là. Avant de continuer à vous montrer des biens, je vous propose qu\'on prenne un café 30 minutes pour reprendre vos critères au calme.\n\nParfois, faire un point neutre permet de se rendre compte qu\'on était plus proche du choix qu\'on ne le pensait.\n\nDispo mardi ou jeudi prochain ?\n\nBien à vous,\nJulien Berset',
  },
  'lead-06': {
    subject: 'Trois créneaux pour visiter le Duplex à deux',
    body: 'Bonjour Thomas,\n\nPour faciliter la 2e visite du Duplex Cité avec votre compagne, j\'ai bloqué 3 créneaux à des horaires qui devraient convenir à un agenda Genève → Lausanne :\n\n— Jeudi 18h30\n— Samedi 10h00\n— Samedi 14h30\n\nDites-moi celui qui marche, je confirme.\n\nÀ bientôt,\nJulien Berset',
  },
  'lead-07': {
    subject: 'Septembre approche, Aïcha — un point sur St-Sulpice ?',
    body: 'Bonjour Aïcha,\n\nJe pense à vous avec la rentrée scolaire de votre fille en tête. La Villa St-Sulpice reste disponible, mais la fenêtre pour un emménagement avant septembre se resserre (il faut compter 60 jours entre compromis et acte authentique en Suisse).\n\nSi vous êtes toujours sur ce bien, est-ce qu\'on programme une visite de confirmation cette semaine et on parle d\'une offre ?\n\nÀ très vite,\nJulien Berset',
  },
  'lead-08': {
    subject: 'Quelques infos avant de programmer, Olivier',
    body: 'Bonjour Olivier,\n\nMerci pour votre intérêt pour le Penthouse Beau-Rivage. Vu le segment (3.2M), nous demandons systématiquement quelques éléments avant d\'organiser une visite : un KYC simplifié et une preuve de capacité de financement.\n\nC\'est rapide (15 min en ligne) et cela permet de vous garantir un accès prioritaire au bien.\n\nLe lien : megga.ch/kyc\n\nÀ disposition,\nJulien Berset',
  },
}

function genericDraft(lead: RelanceLead): DraftTemplate {
  return {
    subject: `À propos de ${lead.bien.split(' · ')[0]}, ${lead.first}`,
    body: `Bonjour ${lead.first},\n\nCela fait ${lead.dormSince} jours environ que nous n'avons plus échangé concernant ${lead.bien.split(' · ')[0]}, et je voulais simplement reprendre contact avec vous.\n\n${lead.reason} Je voulais m'assurer que tout va bien de votre côté et savoir si vous souhaitez qu'on planifie une prochaine étape — visite, appel, ou simplement un échange par email.\n\nN'hésitez pas à me dire ce qui vous arrange.\n\nÀ bientôt,\nJulien Berset`,
  }
}

export function getInitialDraft(lead: RelanceLead): DraftTemplate {
  return DRAFT_TEMPLATES[lead.id] || genericDraft(lead)
}

// ─── Variantes de ton MEGGA AI ─────────────────────────────────────────
export type ToneId = 'formaliser' | 'chaleureux' | 'court' | 'detaille' | 'recreer'

type ToneVariant = (
  draft: DraftTemplate,
  lead: RelanceLead,
) => DraftTemplate

export const TONE_VARIANTS: Record<ToneId, ToneVariant> = {
  formaliser: (draft, lead) => ({
    subject: draft.subject,
    body: `Madame, Monsieur,\n\nJe me permets de revenir vers vous concernant ${lead.bien.split(' · ')[0]}.\n\nAprès ${lead.dormSince} jours sans échange, je souhaitais m'enquérir de l'évolution de votre réflexion. Je reste naturellement à votre entière disposition pour toute information complémentaire ou pour organiser une nouvelle visite.\n\nJe vous prie d'agréer, Madame, Monsieur, mes salutations distinguées.\n\nJulien Berset\nMEGGA Real Estate`,
  }),
  chaleureux: (_draft, lead) => ({
    subject: `${lead.first}, j'ai pensé à vous`,
    body: `Bonjour ${lead.first},\n\nJ'espère que vous allez bien. Je repensais à notre dernier échange${lead.quote ? ` — vous m'aviez dit ${lead.quote.toLowerCase().replace(/[«»]/g, '').trim()}` : ''} — et je me disais que ça faisait un moment.\n\nPas de pression, vraiment. Juste un petit signe pour vous dire que je suis toujours là si vous voulez en discuter, qu'on remette une visite, ou même qu'on prenne un café pour faire le point sans engagement.\n\nÀ très vite j'espère,\nJulien`,
  }),
  court: (_draft, lead) => ({
    subject: `Toujours intéressé, ${lead.first} ?`,
    body: `Bonjour ${lead.first},\n\n${lead.dormSince} jours sans nouvelles. ${lead.bien.split(' · ')[0]} est toujours disponible — toujours dans la course ?\n\nUne ligne en retour suffit.\n\nJulien`,
  }),
  detaille: (_draft, lead) => ({
    subject: `${lead.bien.split(' · ')[0]} — points clés et prochaine étape`,
    body: `Bonjour ${lead.first},\n\nCela fait maintenant ${lead.dormSince} jours depuis nos derniers échanges autour de ${lead.bien.split(' · ')[0]}, et je voulais reprendre contact en vous apportant quelques éléments concrets.\n\nPour rappel sur le bien :\n— Prix : CHF ${lead.bienPrice}\n— ${lead.reason}\n${lead.quote ? `— Vous m'aviez confié : ${lead.quote}\n` : ''}\nDe mon côté, voici ce que je peux vous proposer comme prochaine étape : **${lead.nextStep}**. ${lead.nextStepHint}\n\nSi vous préférez qu'on en parle de vive voix avant tout autre chose, je peux vous appeler à un moment qui vous arrange — dites-moi simplement quand.\n\nBien à vous,\nJulien Berset\nMEGGA Real Estate · +41 21 555 12 34`,
  }),
  recreer: (_draft, lead) => ({
    subject: `Une question rapide, ${lead.first}`,
    body: `Bonjour ${lead.first},\n\nJe vais être direct : ${lead.bien.split(' · ')[0]} vous correspond-il toujours, ou est-ce que je continue à chercher pour vous ?\n\nQuelle que soit votre réponse, elle m'aide. Si oui, on accélère. Si non, je vous propose 2-3 biens qui collent vraiment à ce que vous cherchez aujourd'hui.\n\nUn simple oui / non en retour, et je m'occupe du reste.\n\nMerci d'avance,\nJulien`,
  }),
}

export interface ToneAction {
  id: ToneId
  label: string
  hint: string
}

export const TONE_ACTIONS: ToneAction[] = [
  { id: 'formaliser', label: 'Formaliser', hint: 'Plus protocolaire' },
  { id: 'chaleureux', label: 'Plus chaleureux', hint: 'Plus personnel' },
  { id: 'court', label: 'Plus court', hint: '3-4 lignes' },
  { id: 'detaille', label: 'Plus détaillé', hint: 'Arguments + contexte' },
  { id: 'recreer', label: 'Recréer', hint: 'Nouvelle approche' },
]

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

export function saveSession(state: RelanceSessionState): void {
  try {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(state))
  } catch {
    // localStorage can throw in incognito or quota exceeded
  }
}

export function clearSession(): void {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // localStorage can throw in incognito
  }
}

export function hasActiveRelanceSession(): boolean {
  const s = loadSession()
  return Boolean(
    s &&
      s.currentIdx < RELANCE_LEADS.length &&
      Object.keys(s.treated || {}).length > 0,
  )
}
