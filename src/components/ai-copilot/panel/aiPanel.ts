// MEGGA AI — Panneau latéral · helpers purs (palette dérivée, packs contextuels,
// libellés d'écran, parsing des brouillons, phases de réflexion).
// Port fidèle du handoff `crm-copilot-panel.jsx` (chantiers 1,4,5,6), adapté à la
// vraie stack : zéro `window.*`, tokens issus du vrai `SugarPalette`.

import type { SugarPalette } from '@/components/crm-sugar/tokens'

// ── Géométrie ───────────────────────────────────────────────────────────────
export const PANEL_W = 372
// Largeur réservée dans le contenu = panneau + marges (respire à 16px du bord
// droit + ~16px de gouttière). Le contenu se comprime de COPILOT_WIDTH → la
// carte n'est jamais recouverte ni collée au contenu (comportement « pousse »).
export const COPILOT_WIDTH = PANEL_W + 32

// ── Bleu identité MEGGA AI (chantier 1) ─────────────────────────────────────
export const AI_BLUE_LIGHT = '#1E5BC6'
export const AI_BLUE_DARK = '#7FB0FF'
export const aiBlue = (dark: boolean) => (dark ? AI_BLUE_DARK : AI_BLUE_LIGHT)

// ── Palette dérivée du panneau ──────────────────────────────────────────────
// Étend le SugarPalette de base avec les surfaces propres au panneau (accent
// noir plein #0B0C0E en clair / surface claire en sombre, canvas, composer…).
export interface AiPalette {
  dark: boolean
  ink: string
  soft: string
  sub: string
  accent: string
  onAccent: string
  panelBg: string
  panelShadow: string
  cardBg2: string
  cardShadow: string
  cardHovShadow: string
  composerBg: string
  composerShadow: string
  rowHov: string
  cardInk: string
}

export function deriveAiPalette(base: SugarPalette, dark: boolean): AiPalette {
  if (dark) {
    return {
      dark: true,
      ink: base.ink || '#ECEDF3',
      soft: base.soft,
      sub: base.sub,
      accent: base.ink || '#ECEDF3',
      onAccent: '#0B0C0E',
      panelBg: '#0B0C0E',
      panelShadow:
        '0 24px 70px -10px rgba(0,0,0,.7), 0 6px 22px -8px rgba(0,0,0,.55)',
      cardBg2: 'rgba(255,255,255,0.05)',
      cardShadow: 'none',
      cardHovShadow: '0 0 0 1px rgba(255,255,255,0.10) inset',
      composerBg: 'rgba(255,255,255,0.05)',
      composerShadow: 'inset 0 0 0 1px rgba(255,255,255,0.07)',
      rowHov: 'rgba(255,255,255,0.05)',
      cardInk: '#16161E',
    }
  }
  return {
    dark: false,
    ink: '#0B0C0E',
    soft: base.soft,
    sub: base.sub,
    accent: '#0B0C0E',
    onAccent: '#FFFFFF',
    panelBg: '#FFFFFF',
    panelShadow:
      '0 28px 80px -16px rgba(15,23,42,.22), 0 8px 26px -12px rgba(15,23,42,.12)',
    cardBg2: '#F7F8FA',
    cardShadow: '0 2px 10px rgba(15,23,42,0.04)',
    cardHovShadow: '0 10px 26px rgba(15,23,42,0.10)',
    composerBg: '#F4F6F9',
    composerShadow: 'inset 0 0 0 1px rgba(15,23,42,0.05)',
    rowHov: 'rgba(15,23,42,0.04)',
    cardInk: '#fff',
  }
}

// ── Suggestions contextuelles selon l'écran (chantier 5) ────────────────────
export interface ContextAction {
  icon: string
  t: string
  p: string
}
export interface ContextPack {
  label: string
  actions: ContextAction[]
}

export const CONTEXT_PACK: Record<string, ContextPack> = {
  today: {
    label: "Aujourd'hui",
    actions: [
      { icon: 'draft', t: 'Prépare mes relances du jour', p: "Quelles relances dois-je envoyer aujourd'hui et à qui ?" },
      { icon: 'calendar', t: 'Résume mon agenda', p: "Résume mon agenda d'aujourd'hui en 3 lignes." },
      { icon: 'pipeline', t: 'Quel deal faire avancer ?', p: "Quel deal devrais-je faire avancer en priorité aujourd'hui ?" },
      { icon: 'search', t: 'Cherche un contact', p: 'Aide-moi à retrouver un contact.' },
    ],
  },
  pipeline: {
    label: 'Pipeline',
    actions: [
      { icon: 'pipeline', t: 'Résume mes deals en cours', p: 'Résume l’état de mes deals en cours, étape par étape.' },
      { icon: 'draft', t: 'Rédige une relance', p: 'Rédige une relance pour un deal bloqué à l’étape Offre.' },
      { icon: 'arrowR', t: 'Prochaine meilleure action', p: 'Quelle est la prochaine meilleure action sur mon pipeline ?' },
      { icon: 'folder', t: 'Deals sans activité', p: "Quels deals n'ont eu aucune activité depuis 7 jours ?" },
    ],
  },
  contacts: {
    label: 'Contacts',
    actions: [
      { icon: 'user', t: 'Qualifie ce lead', p: 'Qualifie ce lead à partir des dernières interactions.' },
      { icon: 'draft', t: 'Email de premier contact', p: 'Rédige un email de premier contact chaleureux et bref.' },
      { icon: 'folder', t: 'Contacts à recontacter', p: "Quels contacts n'ai-je pas relancés depuis longtemps ?" },
      { icon: 'search', t: 'Trouve un acheteur', p: 'Trouve-moi des acheteurs potentiels pour un 4 pièces aux Eaux-Vives.' },
    ],
  },
  biens: {
    label: 'Mes biens',
    actions: [
      { icon: 'draft', t: 'Rédige une annonce', p: 'Rédige une annonce vendeuse pour un 4 pièces aux Eaux-Vives.' },
      { icon: 'folder', t: 'Résume ce bien', p: 'Résume les points forts de ce bien pour un acheteur.' },
      { icon: 'user', t: 'Acheteurs qui matchent', p: 'Quels acheteurs de mon CRM matchent ce bien ?' },
      { icon: 'arrowR', t: 'Idées de mise en avant', p: 'Comment mieux mettre en avant ce bien ?' },
    ],
  },
  matching: {
    label: 'Matching',
    actions: [
      { icon: 'user', t: 'Pourquoi ça matche ?', p: 'Explique-moi pourquoi ce bien matche cet acheteur.' },
      { icon: 'draft', t: 'Message d’envoi de sélection', p: 'Rédige un message pour envoyer cette sélection à l’acheteur.' },
      { icon: 'arrowR', t: 'Affiner les critères', p: 'Comment affiner les critères de recherche de cet acheteur ?' },
      { icon: 'folder', t: 'Autres biens à proposer', p: 'Quels autres biens pourrais-je proposer à cet acheteur ?' },
    ],
  },
  calendar: {
    label: 'Calendrier',
    actions: [
      { icon: 'calendar', t: 'Optimise ma semaine', p: 'Comment optimiser mon planning de la semaine ?' },
      { icon: 'draft', t: 'Confirme une visite', p: 'Rédige un message de confirmation de visite.' },
      { icon: 'arrowR', t: 'Créneaux libres', p: 'Quels créneaux libres ai-je pour des visites cette semaine ?' },
      { icon: 'folder', t: 'Visites de la semaine', p: 'Liste mes visites prévues cette semaine.' },
    ],
  },
  _default: {
    label: 'MEGGA',
    actions: [
      { icon: 'folder', t: 'Résume mes dossiers', p: 'Résume l’état de mes dossiers en cours.' },
      { icon: 'draft', t: 'Rédige un email de suivi', p: 'Rédige un email de suivi après une visite.' },
      { icon: 'pipeline', t: 'État de mon pipeline', p: 'Donne-moi un état rapide de mon pipeline.' },
      { icon: 'search', t: 'Cherche dans le CRM', p: 'Aide-moi à chercher dans mon CRM.' },
    ],
  },
}

// Écrans « détail » → réutilisent le pack de leur famille
const PACK_ALIAS: Record<string, string> = {
  'bien-detail': 'biens',
  'deal-detail': 'pipeline',
  'contact-detail': 'contacts',
  'visite-detail': 'calendar',
  dashboard: 'pipeline',
  parcours: 'pipeline',
}
export const packFor = (screen: string): ContextPack =>
  CONTEXT_PACK[PACK_ALIAS[screen] || screen] || CONTEXT_PACK._default

// Libellés d'écran (en-tête + fil de conversation)
const SCREEN_LABELS: Record<string, string> = {
  today: "Aujourd'hui", dashboard: 'Dashboard', pipeline: 'Pipeline', matching: 'Matching',
  parcours: 'Parcours', contacts: 'Contacts', biens: 'Mes biens', calendar: 'Calendrier',
  notifications: 'Notifications', settings: 'Paramètres', kyc: 'KYC', audit: "Journal d'audit",
  'contact-detail': 'Fiche contact', 'bien-detail': 'Fiche bien',
  'deal-detail': 'Fiche deal', 'visite-detail': 'Fiche visite',
}
export const screenLabel = (s: string): string => SCREEN_LABELS[s] || 'MEGGA'

// Route → identifiant d'écran (remplace le prop `screen` de la maquette).
export function screenFromPath(pathname: string): string {
  const p = pathname.replace(/\/+$/, '')
  if (p === '/dashboard' || p === '') return 'today'
  if (p.startsWith('/dashboard/pipeline')) return 'pipeline'
  if (p.startsWith('/dashboard/matching')) return 'matching'
  if (/^\/dashboard\/contacts\/[^/]+/.test(p)) return 'contact-detail'
  if (p.startsWith('/dashboard/contacts')) return 'contacts'
  if (/^\/dashboard\/listings\/[^/]+/.test(p)) return 'bien-detail'
  if (p.startsWith('/dashboard/listings')) return 'biens'
  if (/^\/dashboard\/transactions\/[^/]+/.test(p)) return 'deal-detail'
  if (/^\/dashboard\/visits\/[^/]+/.test(p)) return 'visite-detail'
  if (p.startsWith('/dashboard/calendar')) return 'calendar'
  if (p.startsWith('/dashboard/journey')) return 'parcours'
  if (p.startsWith('/dashboard/kyc')) return 'kyc'
  if (p.startsWith('/dashboard/audit')) return 'audit'
  // Route non mappée → pack neutre « MEGGA » (évite un eyebrow « Aujourd'hui » trompeur).
  return ''
}

// Entité CRM ouverte, dérivée de la route (contexte réel — Partie 2). Sert à
// cibler les actions de brouillon (ex. pré-remplir le destinataire d'un email
// quand l'agent est sur une fiche contact).
export interface RouteEntity {
  kind: 'contact' | 'listing'
  id: string
}
export function entityFromPath(pathname: string): RouteEntity | null {
  const p = pathname.replace(/\/+$/, '')
  const contact = p.match(/^\/dashboard\/contacts\/([^/]+)$/)
  if (contact) return { kind: 'contact', id: contact[1] }
  const listing = p.match(/^\/dashboard\/listings\/([^/]+)$/)
  if (listing) return { kind: 'listing', id: listing[1] }
  return null
}

// ── Découpe une réponse en segments texte / brouillon (chantier 4) ──────────
// MEGGA AI encadre les livrables (email, message, SMS…) dans un bloc ```…```.
export type DraftSegment =
  | { type: 'text'; text: string }
  | { type: 'draft'; lang: string; body: string; open: boolean }

export function parseSegments(content: string): DraftSegment[] {
  const src = content || ''
  const segs: DraftSegment[] = []
  let idx = 0
  while (idx < src.length) {
    const open = src.indexOf('```', idx)
    if (open === -1) {
      const t = src.slice(idx)
      if (t.trim()) segs.push({ type: 'text', text: t })
      break
    }
    const before = src.slice(idx, open)
    if (before.trim()) segs.push({ type: 'text', text: before })
    const nl = src.indexOf('\n', open + 3)
    if (nl === -1) {
      segs.push({ type: 'draft', lang: src.slice(open + 3).trim(), body: '', open: true })
      break
    }
    const lang = src.slice(open + 3, nl).trim()
    const close = src.indexOf('```', nl + 1)
    if (close === -1) {
      segs.push({ type: 'draft', lang, body: src.slice(nl + 1), open: true })
      break
    }
    segs.push({ type: 'draft', lang, body: src.slice(nl + 1, close).replace(/\n+$/, ''), open: false })
    idx = close + 3
  }
  return segs
}

// ── Détection heuristique d'un email dans la réponse ────────────────────────
// L'edge function `ai-copilot` ne fence PAS les livrables (contrairement au
// prototype) : l'IA écrit « Objet : … » + corps en clair. On détecte comme la
// page Julien (greeting+signature OU ligne Objet) pour transformer la réponse en
// carte d'action (chantier 4). Renvoie null si ce n'est pas un email.
export function detectEmailDraft(text: string): { subject: string; body: string } | null {
  if (!text || text.length < 60) return null
  // L'IA formate souvent en markdown (**Objet :**, titres #) → on nettoie l'emphase
  // avant de matcher, sinon « **Objet :** » casse la détection du sujet.
  const t = text.trim().replace(/\*\*/g, '').replace(/^#{1,4}\s+/gm, '')
  const greet = /(^|\n)\s*(Bonjour|Madame|Monsieur|Cher|Chère|Chers|Bonsoir)\b/i
  const sign = /(Cordialement|Bien cordialement|Bien à vous|Sincères salutations|Excellente journée|Belle journée|À très vite|À bientôt)\b/i
  const subjectMatch = t.match(/(?:^|\n)\s*(?:Objet|Sujet)\s*[:：]\s*(.+?)(?:\n|$)/i)
  const toMatch = t.match(/(?:^|\n)\s*(?:À|A|Destinataire|Pour)\s*[:：]\s*(.+?)(?:\n|$)/i)
  if (!greet.test(t) || !sign.test(t)) {
    if (!subjectMatch) return null
  }
  let body = t
  if (subjectMatch) body = body.replace(subjectMatch[0], '')
  if (toMatch) body = body.replace(toMatch[0], '')
  body = body.replace(/^\s*\n+/, '').trim()
  let subject = subjectMatch ? subjectMatch[1].trim() : ''
  if (!subject) {
    const firstLine = body.split('\n')[0]?.trim() || ''
    if (firstLine.length < 80 && !greet.test(firstLine) && /^[A-ZÉÈÀ]/.test(firstLine)) {
      subject = firstLine
      body = body.split('\n').slice(1).join('\n').replace(/^\s*\n+/, '')
    }
  }
  return { subject, body: body || t }
}

// ── Intention « annonce » (depuis la REQUÊTE, pas le contenu) ───────────────
// Une annonce immobilière n'a pas de marqueurs fiables (contrairement à l'email) :
// on se fie à ce que l'agent a demandé. Si sa question portait sur une annonce,
// la réponse est traitée comme telle → action « Utiliser sur le bien ».
export function isAnnonceRequest(query: string | undefined): boolean {
  if (!query) return false
  return /\bannonce|texte de vente|descriptif du bien|description vendeuse/i.test(query)
}

// ── Phases de réflexion selon la demande ────────────────────────────────────
export function thinkingPhases(q: string): string[] {
  const t = (q || '').toLowerCase()
  if (/relance|rédige|redige|écris|ecris|rédaction|email|e-mail|message|courrier/.test(t))
    return ['Lecture du contexte', 'Collecte des infos client', 'Rédaction du message']
  if (/trouve|acheteur|match|matching|cherche|recherche|prospect|locataire/.test(t))
    return ['Analyse des critères', 'Recherche dans la base', 'Croisement des biens', 'Classement des résultats']
  if (/résume|resume|résumé|resumé|dossier|synthèse|synthese|état|etat|point/.test(t))
    return ['Ouverture du dossier', 'Collecte des infos', 'Synthèse en cours']
  if (/prix|estim|valeur|marché|marche|comparable|évalu|evalu/.test(t))
    return ['Lecture du marché genevois', 'Analyse des comparables', 'Estimation en cours']
  if (/kyc|lba|conformité|conformite|document|pièce|piece|vérif|verif/.test(t))
    return ['Vérification du dossier', 'Contrôle de conformité', 'Préparation de la réponse']
  if (/agenda|rendez|rdv|visite|calendrier|planifie|réserve|reserve/.test(t))
    return ["Lecture de l'agenda", 'Recherche de créneaux', 'Préparation de la réponse']
  return ['Réflexion', 'Collecte des infos', 'Préparation de la réponse']
}
