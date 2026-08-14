// MEGGA AI — Panneau latéral · helpers purs (palette dérivée, packs contextuels,
// libellés d'écran, parsing des brouillons, phases de réflexion).
// Port fidèle du handoff `crm-copilot-panel.jsx` (chantiers 1,4,5,6), adapté à la
// vraie stack : zéro `window.*`, tokens issus du vrai `SugarPalette`.

import type { CSSProperties } from 'react'
import { sgVoileEncre, type SugarPalette } from '@/components/crm-sugar/tokens'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'

// ── Géométrie ───────────────────────────────────────────────────────────────
export const PANEL_W = 372
// Largeur réservée dans le contenu = panneau + marges (respire à 16px du bord
// droit + ~16px de gouttière). Le contenu se comprime de COPILOT_WIDTH → la
// carte n'est jamais recouverte ni collée au contenu (comportement « pousse »).
export const COPILOT_WIDTH = PANEL_W + 32

// ── Bleu identité MEGGA AI (chantier 1) ─────────────────────────────────────
// ── Palette dérivée du panneau ──────────────────────────────────────────────
// Étend le SugarPalette de base avec les surfaces propres au panneau (canvas,
// composer, remplissages). Tout en DÉRIVE désormais : le dock portait son
// propre accent — l'encre, règle Sugar Pure — et ses surfaces sombres passaient
// par la forme à 3 arguments de `crmStep`, qui retombait sur ses littéraux
// historiques (des blancs translucides) faute de rampe sur la palette MEGGA X.
export interface AiPalette {
  dark: boolean
  ink: string
  soft: string
  sub: string
  accent: string
  onAccent: string
  /**
   * L'accent en TEXTE ou en icône teintée.
   *
   * ⛔ Ce n'est pas `accent` : `#424bfb` tombe à 3,44:1 sur la surface sombre du
   * dock, illisible. En aplat il tient — c'est l'encre blanche qui porte alors
   * le contraste. Dès qu'il devient de l'encre, il faut monter d'un barreau.
   */
  aiInk: string
  panelBg: string
  panelShadow: string
  /** Remplissages posés SUR le panneau — pastilles d'icône, tuiles de pièce
   *  jointe, toggles. `fillStrong` est le cran au-dessus (état actif, bouton
   *  d'envoi inactif). Deux tokens plutôt qu'une dizaine d'alphas dispersés. */
  fill: string
  fillStrong: string
  cardBg2: string
  cardShadow: string
  cardHovShadow: string
  composerBg: string
  composerShadow: string
  rowHov: string
}

export function deriveAiPalette(base: SugarPalette, dark: boolean): AiPalette {
  if (dark) {
    return {
      dark: true,
      ink: base.ink,
      soft: base.soft,
      sub: base.sub,
      accent: base.accent,
      onAccent: base.accentInk,
      aiInk: MXC_SYSTEM.blue300,
      // Surface FLOTTANTE : le dock prend le palier des surfaces posées
      // au-dessus de l'app, et se sépare par son filet — pas par un blanc
      // translucide, que la direction interdit en remplissage.
      panelBg: base.solidBg,
      panelShadow:
        `0 0 0 1px ${base.solidBorder}, 0 24px 70px -10px rgba(0,0,0,.7), 0 6px 22px -8px rgba(0,0,0,.55)`,
      fill: base.solidBgSub,
      fillStrong: base.focusSurface,
      cardBg2: base.solidBgSub,
      cardShadow: 'none',
      cardHovShadow: `0 0 0 1px ${base.solidBorder} inset`,
      // Le composer affleure la surface du panneau et ne se lit que par son
      // liseré : même palier, pas de dalle contrastée au bas du panneau.
      composerBg: base.solidBg,
      composerShadow: `inset 0 0 0 1px ${base.solidBorder}`,
      rowHov: base.solidBgSub,
    }
  }
  return {
    dark: false,
    ink: base.ink,
    soft: base.soft,
    sub: base.sub,
    accent: base.accent,
    onAccent: base.accentInk,
    aiInk: base.accent,
    panelBg: base.solidBg,
    panelShadow:
      `0 28px 80px -16px ${sgVoileEncre(false, 0.22)}, 0 8px 26px -12px ${sgVoileEncre(false, 0.12)}`,
    fill: base.cardSubBg,
    fillStrong: base.focusSurface,
    cardBg2: base.cardSubBg,
    cardShadow: base.shadowSm,
    cardHovShadow: base.shadow,
    composerBg: base.cardSubBg,
    composerShadow: `inset 0 0 0 1px ${base.cardBorder}`,
    rowHov: base.cardSubBg,
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

// Intention « lettre / courrier » (physique) → action « Générer le PDF ».
// Prioritaire sur la détection email (un courrier formel a aussi greeting +
// formule de politesse, mais l'agent a explicitement demandé une lettre).
export function isLettreRequest(query: string | undefined): boolean {
  if (!query) return false
  return /\blettre|courrier(?!\s*électronique)/i.test(query)
}

// ── Phases d'outils RÉELLES (chantier tool-loop) ────────────────────────────
// Libellé humain d'une consultation d'outil en cours, affiché en direct pendant
// le streaming SSE (remplace les phases cosmétiques quand les outils sont ON).
// Inconnu → libellé générique (jamais le nom technique brut à l'agent).
const TOOL_PHASE_LABELS: Record<string, string> = {
  get_my_agenda: "Consultation de l'agenda",
  search_contacts: 'Recherche dans les contacts',
  get_contact_brief: 'Lecture de la fiche contact',
  list_followups: 'Analyse des relances',
  get_matches: 'Recherche des correspondances',
  get_daily_brief: 'Préparation du briefing',
  search_listings: 'Recherche de biens sur le marché',
  get_kyc_status: 'Vérification du dossier KYC',
  get_publication_status: 'Vérification de la publication',
  prepare_meeting: 'Préparation du rendez-vous',
  suggest_priorities_today: 'Analyse de tes priorités',
  get_analytics_snapshot: 'Lecture de tes chiffres',
  get_market_stats: 'Analyse du marché',
}
export function toolPhaseLabel(name: string): string {
  return TOOL_PHASE_LABELS[name] || 'Consultation du CRM'
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

/* ─── Grammaire des modales de revue ──────────────────────────────────────── */

/**
 * Le kit des CINQ modales de revue du dock (annonce, e-mail, lettre, publication,
 * suppression de contact).
 *
 * ⛔ POURQUOI IL EXISTE. Mesurées le 15 août 2026, les cinq modales portaient la
 * MÊME grammaire recopiée cinq fois — même voile de fond, même ombre, même
 * `labelStyle` en micro-capitales 11/700/0.3, même surface `#17181C`, mêmes
 * rayons 22/12/999 en littéraux, même police écrite en dur. Corriger cinq copies
 * les aurait laissées diverger au premier ajout : c'est le geste du lot 2 du
 * Pipeline (les trois palettes locales devenues des fonctions), appliqué à une
 * grammaire au lieu d'une palette. Il n'y a plus de valeur à recopier, seulement
 * un barreau à désigner.
 *
 * ⚠ La SURFACE ne se peignait pas non plus : `#17181C` est un palier Graphite
 * bleuté, quand la palette du dock porte déjà `panelBg` — qui EST le `solidBg`
 * de MEGGA X (n300, #090909), le palier de tout ce qui flotte. Troisième source de surfaces, comme `adminSurfaces()` sur la console
 * et la doublure de la popover de notifications.
 *
 * ⚠ Tailles ramenées au barreau le plus proche, ÉGALITÉ VERS LE BAS : 17 → 2xl
 * (16), 13.5 → md (13), 14 → lg (14), 11 → xs (11). Rayons : 22 → 4xl (20),
 * 12 → lg, 999 → pill.
 */
export interface RevueKit {
  /** Voile plein écran — c'est une ENCRE voilée, pas une surface. */
  scrim: CSSProperties
  /** La carte flottante. */
  carte: CSSProperties
  /** Le titre de la modale. */
  titre: CSSProperties
  /** Le sur-titre d'un champ — casse NORMALE : MEGGA X n'a aucun idiome de micro-capitale. */
  libelle: CSSProperties
  /** Fond et filet d'un champ de saisie. */
  champ: CSSProperties
  /** Texte d'aide, en bas de modale. */
  aide: CSSProperties
  /** Bouton secondaire (Annuler). */
  boutonFantome: CSSProperties
  /** Bouton primaire — il porte l'ACCENT, jamais l'encre. */
  boutonPrincipal: (actif: boolean) => CSSProperties
}

export function revueKit(sp: AiPalette): RevueKit {
  const dark = sp.dark
  const bouton: CSSProperties = {
    height: 40, padding: '0 18px', borderRadius: 'var(--crm-radius-pill)', border: 0,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
  }
  return {
    scrim: {
      position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center',
      background: sgVoileEncre(dark, dark ? 0.55 : 0.28),
      backdropFilter: 'blur(2px)', WebkitBackdropFilter: 'blur(2px)',
      padding: 20,
    },
    carte: {
      width: 'min(540px, 100%)', maxHeight: '86vh', overflowY: 'auto',
      background: sp.panelBg, borderRadius: 'var(--crm-radius-4xl)',
      padding: '20px 22px 18px',
      boxShadow: `0 30px 80px -14px ${sgVoileEncre(dark, dark ? 0.7 : 0.28)}`,
      display: 'flex', flexDirection: 'column', gap: 14,
    },
    titre: {
      fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: sp.ink,
      letterSpacing: -0.3, flex: 1,
    },
    libelle: { fontSize: 'var(--crm-text-xs)', fontWeight: 500, color: sp.sub },
    champ: {
      background: sp.fill, border: `1px solid ${sgVoileEncre(dark, 0.08)}`,
      borderRadius: 'var(--crm-radius-lg)', color: sp.ink,
    },
    aide: { fontSize: 'var(--crm-text-sm)', color: sp.sub, flex: 1 },
    boutonFantome: { ...bouton, cursor: 'pointer', color: sp.soft, background: sp.fill },
    boutonPrincipal: (actif) => ({
      ...bouton, padding: '0 20px',
      cursor: actif ? 'pointer' : 'default',
      background: actif ? sp.accent : sp.fillStrong,
      color: actif ? sp.onAccent : sp.sub,
    }),
  }
}
