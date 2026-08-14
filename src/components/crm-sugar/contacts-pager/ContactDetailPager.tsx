// MEGGA CRM — Fiche détail Contact « Pager » (refonte Claude Design, port fidèle).
// Port 1:1 de `crm-screen-contact-detail-pager.jsx` (window.CRMScreenContactDetailPager).
// Un grand bento arrondi (viewport) qui glisse verticalement entre deux pages :
//   Page 0 → Ses informations (héro identité + critères + coordonnées + note)  [en haut]
//   Page 1 → Boucle de match  (à traiter + biens transmis)                     [en bas]
// Molette (accumulateur) / flèches + PageUp-Down / swipe / points latéraux.
// Gel du pager (freezeRef) pendant une édition inline ou une modale ouverte.
//
// Beta v1 : le bloc Coordonnées porte l'identité LBA (9 lignes, « — » si vide)
// et la modale d'identité édite les 6 champs correspondants — toute
// modification d'un d'eux invalide un KYC vérifié (cf. lib/contactIdentity).
//
// Conventions : inline styles (PAS de Tailwind), 'Inter Tight', composants au
// NIVEAU MODULE (hors render) pour ne pas perdre le focus des inputs.
// Le chrome (SugarTopNav + SugarIconRail) est monté par la page conteneur ; ce
// composant remplit le <main> avec le viewport. AUCUN appel Supabase : le parent
// fournit les données normalisées + les callbacks de persistance.

import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type ReactNode, type ReactElement, type CSSProperties, type MutableRefObject,
} from 'react'
import { createPortal } from 'react-dom'
import { Trans, useTranslation } from 'react-i18next'
import type { CriteriaInput } from '@/lib/contactCriteria'
import { COUNTRIES, countryName } from '@/lib/countries'
import { hasIdentityChanged, isInvalidSwissDate, type ContactIdentity } from '@/lib/contactIdentity'
import { type SugarPalette } from '@/components/crm-sugar/tokens'
import { crmFmtCHF } from '@/components/crm-sugar/tokens'

// ═══════════════════════════════════════════════════════════════════════
//   API PUBLIQUE
// ═══════════════════════════════════════════════════════════════════════
export interface FicheContact {
  id: string
  firstName: string
  lastName: string
  verified: boolean              // KYC vérifié → bluecheck visible
  email: string
  phone: string
  lang: string                   // 'fr' | 'de' | 'en' | 'it'
  civ: string                    // '' | 'mrs' | 'mr'
  canal: string                  // '' | 'whatsapp' | 'sms' | 'call' | 'email'
  audience: 'Acheteur' | 'Vendeur' | 'Locataire' | 'Bailleur'
  isTenant: boolean
  avatarBg: string
  /** Identité LBA art. 3 — date au format suisse JJ.MM.AAAA, pays en ISO alpha-2. */
  birth: string
  nationality: string
  residence: string
  homeAddress: string
  /** Photo du contact (form_data.photo) — remplace les initiales du héro. */
  photo: string | null
  crit: CriteriaInput            // critères parsés (voir @/lib/contactCriteria)
  notes: string
}

export interface FicheLoopItem {
  matchId: string
  title: string
  addr: string
  photo: string | null
  state: 'liked' | 'seen' | 'sent' | 'dismissed'
  motif: string | null
}

/** Lien de réception émis pour ce contact (jamais son jeton : c'est la capability). */
export interface FicheReceptionLink {
  id: string
  /** `null` = statut non reconnu ; l'UI le dit et n'offre pas de retrait dessus. */
  status: 'pending' | 'viewed' | 'reacted' | 'expired' | 'revoked' | null
  channel: 'whatsapp' | 'link' | null
  createdAt: string
  expiresAt: string
  /** Nombre de biens que le lien ouvre. */
  count: number
  /** Renseigné une fois le lien retiré : « depuis quand est-il coupé ». */
  revokedAt: string | null
  /** Le lien donne encore accès à la sélection (ni retiré, ni échu). */
  active: boolean
}

/**
 * Issue d'un retrait. Trois cas et non deux : un REFUS (le lien n'était déjà plus
 * actif) et une PANNE ne se disent pas pareil à l'agent, sinon il croit avoir coupé
 * un accès resté ouvert. Le conteneur traduit l'erreur du hook en ce verdict ; le
 * pager reste sans appel Supabase.
 */
export type FicheRevokeResult = 'ok' | 'refused' | 'failed'

/** Prochaine action estimée (NBA déterministe, cerveau partagé WhatsApp ⇄ copilote) —
 *  chaînes DÉJÀ traduites par le parent (le pager reste présentation pure, sans i18n
 *  de données). Absent/null → aucun rendu (ajout additif, façon BnScoreBadge). */
export interface FicheNba {
  label: string
  estimateTag: string
  kycNote: string | null
}

export interface ContactDetailPagerProps {
  fiche: FicheContact
  nba?: FicheNba | null
  loop: { items: FicheLoopItem[]; pendingLikes: FicheLoopItem[]; transmitted: number; opened: number }
  /** Liens de réception émis + états de chargement (le conteneur porte la requête). */
  links: { items: FicheReceptionLink[]; isLoading: boolean; failed: boolean }
  sp: SugarPalette
  dark: boolean
  onBack: () => void
  /** Persiste les 6 champs d'identité LBA (nom + naissance/nationalité/résidence/adresse). */
  onSaveIdentity: (v: ContactIdentity) => Promise<void>
  onInvalidateKyc: () => Promise<void>
  onSaveCoord: (v: { civ: string; email: string; phone: string; lang: string; canal: string }) => Promise<void>
  onSaveCriteria: (c: CriteriaInput) => Promise<void>
  /** État de consentement WhatsApp. `null` tant que la lecture n'a pas abouti. */
  consent?: FicheConsent | null
  /** Geste « ne plus contacter ». Doit résoudre APRÈS l'écriture (la carte relit ensuite). */
  onDoNotContact?: () => Promise<void>
  /** Envoie l'invitation d'opt-in par e-mail. Rejette avec un motif exploitable. */
  onInviteOptin?: () => Promise<void>
  onSaveNote: (note: string) => void
  /** Doit résoudre APRÈS la suppression réelle : la carte « Contact supprimé » n'est
   *  montrée qu'ensuite, et c'est `onBack` (pas ce callback) qui ramène à la liste. */
  onDelete: () => Promise<void>
  onOpenKyc: () => void
  onOpenMatching: () => void
  /** CTA principal d'un Vendeur/Bailleur (côté offre) — vers ses biens, jamais le Matching acheteur. */
  onOpenListings: () => void
  onProposeVisit: (matchId: string) => void
  /** Retire un lien de réception. Ne rejette pas : renvoie le verdict à afficher. */
  onRevokeLink: (linkId: string) => Promise<FicheRevokeResult>
}

// ═══════════════════════════════════════════════════════════════════════
//   PALETTE dérivée (cdpPal du design)
// ═══════════════════════════════════════════════════════════════════════
/**
 * Ce que la fiche sait du consentement WhatsApp d'un contact.
 *
 * ⚠ Le `reason` distingue ce que la PERSONNE a demandé (`stop_keyword`, `meta_block`) de ce
 * que l'AGENT a décidé (`agent_manual`). La fiche ne doit pas les présenter pareil : le
 * premier ne se lève pas d'un clic, le second est une note interne.
 */
export interface FicheConsent {
  suppressed: boolean
  reason: 'stop_keyword' | 'meta_block' | 'agent_manual' | 'bounce_hard' | null
  suppressedAt: string | null
  ackSentAt: string | null
  /** La dernière déclaration est un consentement. */
  optedIn: boolean
  /** Invitation partie, ni acceptée ni expirée. */
  pendingInviteAt: string | null
  /** Sans e-mail, l'invitation ne peut PAS partir — elle voyage par ce canal-là. */
  canInvite: boolean
  journal: Array<{
    id: string; createdAt: string; event: 'opt_in' | 'opt_out'; source: string; scope: string
  }>
}

interface FichePal {
  sp: SugarPalette
  pageBg: string
  card: string
  sub: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  hairline: string
  accent: string
  accentInk: string
  buyer: string
  ok: string
  cyan: string
  wait: string
  danger: string
  shadow: string
  shadowSm: string
}

function buildPal(sp: SugarPalette, dark: boolean): FichePal {
  return {
    sp,
    pageBg: sp.pageBg,
    card: dark ? sp.cardBg : '#FFFFFF',
    sub: sp.cardSubBg,
    ink: sp.ink,
    inkSoft: sp.soft,
    muted: sp.sub,
    ghost: dark ? '#4C505A' : '#B5BAC2',
    hairline: dark ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)',
    accent: sp.accent,
    accentInk: sp.accentInk,
    buyer: dark ? '#6F8CFF' : '#1E5BC6',
    ok: dark ? '#34D399' : '#059669',
    cyan: dark ? '#38BDD8' : '#0891B2',
    wait: dark ? '#8A909B' : '#7A8088',
    danger: dark ? '#E0738C' : '#8E1F3D',
    shadow: dark ? `inset 0 0 0 1px ${sp.cardBorder}, ${sp.shadow}` : sp.shadow,
    shadowSm: dark ? `inset 0 0 0 1px ${sp.cardBorder}, ${sp.shadowSm}` : sp.shadowSm,
  }
}

// ═══════════════════════════════════════════════════════════════════════
//   ICÔNES — set porté 1:1 de fcp-haut.jsx (window.FcpIcon)
// ═══════════════════════════════════════════════════════════════════════
const FCP_PATHS: Record<string, ReactNode> = {
  phone: <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />,
  msg: <path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.4-.7L3 21l1.7-6.1a8.5 8.5 0 0 1-.7-3.4 8.38 8.38 0 0 1 8.5-8.5 8.38 8.38 0 0 1 8.5 8.5Z" />,
  heart: <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  send: <><path d="M22 2L11 13" /><path d="M22 2l-7 20-4-9-9-4 20-7z" /></>,
  check: <path d="M20 6L9 17l-5-5" />,
  arrowL: <path d="M19 12H5M12 19l-7-7 7-7" />,
  doc: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" /></>,
  home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v9h14v-9" /></>,
  cal: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  pencil: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 1 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" /></>,
  ext: <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><path d="M15 3h6v6" /><path d="M10 14L21 3" /></>,
  sparkle: <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />,
  more: <><circle cx="5" cy="12" r="1.4" /><circle cx="12" cy="12" r="1.4" /><circle cx="19" cy="12" r="1.4" /></>,
  merge: <><path d="M18 8L6 8" /><path d="M8 5L5 8l3 3" /><path d="M6 16h12" /><path d="M16 13l3 3-3 3" /></>,
  trash: <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M10 11v6M14 11v6" /></>,
  shield: <path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3Z" />,
  download: <><path d="M12 3v12" /><path d="M7 10l5 5 5-5" /><path d="M5 21h14" /></>,
}

function FcpIcon({ name, size = 16, stroke = 'currentColor', sw = 1.8, fill = 'none' }: {
  name: string; size?: number; stroke?: string; sw?: number; fill?: string
}) {
  const p = FCP_PATHS[name]
  if (!p) return null
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round">{p}</svg>
  )
}

// Chevron des <select> (data-uri) — porté de cdpChevron.
const chevronUri = (hex: string) =>
  `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='${encodeURIComponent(hex)}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9.5l6 6 6-6'/%3E%3C/svg%3E")`

// Bluecheck officiel MEGGA — sceau festonné bleu #0041D9, coche en négatif (1:1).
const CD_SEAL_D = 'M18.0251 7.80663C18.0849 7.86693 18.1447 7.92724 18.2046 7.98756C19.059 8.84386 19.059 10.0393 18.2032 10.8984C18.0802 11.0215 17.9574 11.1449 17.8346 11.2682C17.5398 11.5643 17.2452 11.8603 16.9484 12.1527C16.8508 12.2416 16.7739 12.3508 16.7231 12.4726C16.6722 12.5944 16.6487 12.7258 16.6541 12.8577C16.6664 13.4044 16.6624 13.9516 16.6585 14.4988C16.6581 14.5509 16.6577 14.6031 16.6573 14.6553C16.6485 15.8522 15.8071 16.6912 14.6084 16.6991C14.5622 16.6994 14.516 16.6997 14.4699 16.7C13.9167 16.7036 13.3635 16.7071 12.8108 16.6963C12.5407 16.6926 12.3343 16.786 12.1474 16.9729C11.9929 17.1261 11.8412 17.2821 11.6894 17.4381C11.3474 17.7897 11.0055 18.1413 10.6324 18.4603C10.3688 18.6825 10.0453 18.8218 9.70276 18.8607C9.16599 18.962 8.68108 18.8158 8.26064 18.4949C7.8483 18.1788 7.49077 17.8016 7.13363 17.4248C7.01413 17.2987 6.89467 17.1727 6.77321 17.049C6.53356 16.8038 6.28316 16.6809 5.93232 16.6959C5.48556 16.7146 5.03762 16.7096 4.58968 16.7046C4.46947 16.7032 4.34926 16.7019 4.22907 16.701C3.03875 16.693 2.19039 15.8424 2.18618 14.653C2.18198 14.0387 2.17824 13.4239 2.18618 12.8096C2.18994 12.693 2.16885 12.577 2.1243 12.4692C2.07976 12.3615 2.01279 12.2644 1.92785 12.1845C1.49277 11.7513 1.05846 11.3167 0.624942 10.8807C-0.207067 10.0445 -0.208468 8.84806 0.621672 8.01185C0.656025 7.97727 0.690372 7.94269 0.724717 7.90812C1.11818 7.51201 1.5113 7.11625 1.90916 6.72483C2.00059 6.64067 2.07273 6.53773 2.12063 6.42306C2.16853 6.30839 2.19105 6.18472 2.18665 6.06053C2.179 5.45984 2.18262 4.86001 2.18624 4.26063L2.18665 4.1919C2.19319 3.06325 3.04622 2.20321 4.17861 2.18826C4.78592 2.17751 5.39322 2.17284 6.00053 2.18826C6.29671 2.19573 6.5158 2.09623 6.72276 1.88788C6.85821 1.75166 6.99116 1.61272 7.12412 1.47378C7.47539 1.10671 7.82669 0.739602 8.2242 0.422402C8.65212 0.0804424 9.14917 -0.0657781 9.70276 0.0276535C10.1531 0.0832453 10.5287 0.291598 10.8468 0.606462C11.2738 1.0269 11.7003 1.44735 12.1175 1.87853C12.211 1.98171 12.3259 2.06323 12.4542 2.11737C12.5825 2.17151 12.7211 2.19698 12.8603 2.192C13.0546 2.19161 13.2491 2.18718 13.4437 2.18275C13.9494 2.17124 14.4554 2.15972 14.9588 2.21909C15.4192 2.27434 15.8443 2.49366 16.1562 2.83685C16.468 3.18004 16.6458 3.62412 16.6569 4.08772C16.6714 4.73334 16.6695 5.37988 16.6569 6.0255C16.6512 6.15765 16.6746 6.28944 16.7252 6.41162C16.7759 6.5338 16.8527 6.64341 16.9502 6.73277C17.312 7.0873 17.6682 7.44662 18.0251 7.80663ZM13.7641 7.95458C13.9525 7.73869 14.0659 7.48946 14.0488 7.2273C14.0504 6.56838 13.5703 6.09201 12.9447 6.07909C12.4634 6.0695 12.1733 6.36249 11.889 6.68966C10.9696 7.748 10.0476 8.80383 9.1229 9.85716C8.91993 10.0906 8.82157 10.0922 8.58109 9.89884C8.46389 9.80446 8.34681 9.70993 8.22972 9.61541C7.90422 9.35263 7.57872 9.08985 7.25074 8.83022C7.21668 8.80323 7.18298 8.77572 7.14927 8.7482C7.00604 8.63128 6.86266 8.51422 6.6906 8.43595C6.44505 8.32122 6.16605 8.30011 5.90604 8.37661C5.64603 8.4531 5.42291 8.62192 5.27861 8.85134C5.13431 9.08077 5.07878 9.35499 5.12244 9.62249C5.1661 9.88997 5.30595 10.1323 5.51571 10.3039L5.5854 10.3602C6.47949 11.0825 7.37377 11.8049 8.27518 12.5179C8.83158 12.9584 9.43382 12.9034 9.90061 12.3724C11.1901 10.9015 12.4779 9.42885 13.7641 7.95458Z'

function CdSeal({ title, ariaLabel, size = 18 }: { title: string; ariaLabel: string; size?: number }) {
  return (
    <span title={title} style={{ display: 'inline-flex', flexShrink: 0, lineHeight: 0 }}>
      <svg width={size} height={size} viewBox="0 0 19 19" style={{ display: 'block' }} aria-label={ariaLabel}>
        <circle cx="9.5" cy="9.5" r="5.6" fill="#FFFFFF" />
        <path d={CD_SEAL_D} fill="#0041D9" fillRule="evenodd" clipRule="evenodd" />
      </svg>
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   CONSTANTES + HELPERS
// ═══════════════════════════════════════════════════════════════════════
const CD_ALL_TYPES = ['appartement', 'maison', 'terrain', 'commercial']
const CD_CANTONS = ['GE', 'VD', 'VS', 'FR', 'NE', 'JU', 'BE', 'ZH']
const CD_MUSTHAVE: { id: string; k: string }[] = [
  { id: 'balcon', k: 'fiche.feature.balcon' },
  { id: 'ascenseur', k: 'fiche.feature.ascenseur' },
  { id: 'parking', k: 'fiche.feature.parking' },
  { id: 'jardin', k: 'fiche.feature.jardin' },
  { id: 'terrasse', k: 'fiche.feature.terrasse' },
  { id: 'cave', k: 'fiche.feature.cave' },
  { id: 'garage', k: 'fiche.feature.garage' },
  { id: 'vue lac', k: 'fiche.feature.vueLac' },
]
const CD_CIV = ['mrs', 'mr']
const CD_LANGS = ['fr', 'de', 'en', 'it']
const CD_CANALS = ['whatsapp', 'sms', 'call', 'email']
const cap = (s: string) => (s || '').charAt(0).toUpperCase() + (s || '').slice(1)
const fmtCHF = (n: number | null | undefined) => crmFmtCHF(n)

// État de la boucle → clé couleur de la palette + clé i18n du pill.
// `liked` est VERT (clé `ok`) et non rouge : le like est un signal positif, et c'est
// la couleur du handoff. Passer par une clé de palette garde le mode sombre correct.
const LOOP_STATE: Record<FicheLoopItem['state'], { key: 'ok' | 'cyan' | 'wait' | 'ghost'; labelK: string }> = {
  liked: { key: 'ok', labelK: 'loop.pillLiked' },
  seen: { key: 'cyan', labelK: 'loop.pillSeen' },
  sent: { key: 'wait', labelK: 'loop.pillSent' },
  dismissed: { key: 'ghost', labelK: 'loop.pillDismissed' },
}

// Statut d'un lien de réception → couleur de palette + clé i18n. `revoked` et
// `expired` prennent la teinte éteinte : un lien fermé n'est pas une alerte, c'est
// un état de repos. `null` (statut non reconnu) est traité plus bas, pas ici.
const LINK_STATE: Record<Exclude<FicheReceptionLink['status'], null>, { key: 'ok' | 'cyan' | 'wait' | 'ghost'; labelK: string }> = {
  pending: { key: 'wait', labelK: 'fiche.links.status.pending' },
  viewed: { key: 'cyan', labelK: 'fiche.links.status.viewed' },
  reacted: { key: 'ok', labelK: 'fiche.links.status.reacted' },
  expired: { key: 'ghost', labelK: 'fiche.links.status.expired' },
  revoked: { key: 'ghost', labelK: 'fiche.links.status.revoked' },
}

/** Date suisse JJ.MM.AAAA depuis un horodatage ISO ; vide si la valeur est inexploitable. */
const cdDay = (iso: string | null | undefined): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p2 = (n: number) => String(n).padStart(2, '0')
  return `${p2(d.getDate())}.${p2(d.getMonth() + 1)}.${d.getFullYear()}`
}

// Gel du pager pendant une édition inline / une modale : increment/decrement.
function useFreeze(freezeRef: MutableRefObject<number>, active: boolean) {
  useEffect(() => {
    if (!active) return
    freezeRef.current += 1
    return () => { freezeRef.current -= 1 }
  }, [active, freezeRef])
}

// ═══════════════════════════════════════════════════════════════════════
//   ATOMES
// ═══════════════════════════════════════════════════════════════════════
function CdCta({ children, tone = 'ink', small, P, onClick, disabled }: {
  children: ReactNode; tone?: 'ink' | 'ghost'; small?: boolean; P: FichePal; onClick?: () => void; disabled?: boolean
}) {
  const ghost = tone === 'ghost'
  return (
    <button onClick={onClick} disabled={disabled} style={{
      display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: small ? 32 : 40,
      padding: small ? '0 14px' : '0 17px', borderRadius: 'var(--crm-radius-pill)', cursor: disabled ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap',
      border: 0, fontFamily: 'inherit',
      background: ghost ? P.sub : P.accent, color: ghost ? P.inkSoft : P.accentInk,
      fontSize: small ? 12 : 13, fontWeight: ghost ? 600 : 700,
      boxShadow: ghost ? 'none' : P.shadowSm, opacity: disabled ? 0.45 : 1,
    }}>{children}</button>
  )
}

function CdRoundBtn({ icon, P, onClick }: { icon: string; P: FichePal; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', background: P.card, boxShadow: P.shadowSm, border: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
      <FcpIcon name={icon} size={16} stroke={P.inkSoft} />
    </button>
  )
}

function CdGrp({ children, P }: { children: ReactNode; P: FichePal }) {
  return <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: P.muted }}>{children}</div>
}

function CdChip({ children, on, P }: { children: ReactNode; on?: boolean; P: FichePal }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 31, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', fontSize: 'var(--crm-text-md)', fontWeight: on ? 700 : 600, background: on ? P.accent : P.sub, color: on ? P.accentInk : P.muted }}>{children}</span>
}

function CdPickChip({ on, onClick, children, P }: { on?: boolean; onClick: () => void; children: ReactNode; P: FichePal }) {
  return <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', height: 31, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: on ? 700 : 600, background: on ? P.accent : P.sub, color: on ? P.accentInk : P.muted, transition: 'background 140ms ease' }}>{children}</button>
}

function CdField({ label, value, mono, P }: { label: string; value: ReactNode; mono?: boolean; P: FichePal }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: P.muted }}>{label}</div>
      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: P.ink, marginTop: 5, fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>{value}</div>
    </div>
  )
}

/**
 * Une ligne en lecture du bloc Coordonnées.
 *
 * Le vide se dit par un TIRET CADRATIN, plus par la phrase « À renseigner ».
 * Neuf lignes sur la même grille : sur une fiche neuve, la phrase se répétait
 * neuf fois et pesait plus lourd que les valeurs des fiches remplies, qu'elle
 * côtoie dans la même colonne.
 *
 * Un tiret plutôt que RIEN, et ce n'est pas cosmétique : la valeur est le seul
 * contenu de la seconde ligne du bloc. Vide, le `<div>` retombe à zéro, la
 * cellule perd sa hauteur, et la grille à deux colonnes se désaligne dès qu'un
 * champ sur deux est renseigné. C'est aussi l'idiome du dépôt pour l'absence de
 * donnée — `formatCHF()` rend `CHF —`.
 *
 * L'information de conformité ne se perd pas : le tiret reste peint en `ghost`
 * quand la valeur, elle, est en `ink`. C'est le CONTRASTE qui signale le trou,
 * comme avant ; seul le libellé disparaît.
 */
function CdReadRow({ label, value, empty, mono, P }: { label: string; value: ReactNode; empty?: boolean; mono?: boolean; P: FichePal }) {
  return (
    <div>
      <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: P.muted }}>{label}</div>
      <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: empty ? 500 : 600, color: empty ? P.ghost : P.ink, marginTop: 5, fontVariantNumeric: mono ? 'tabular-nums' : 'normal' }}>{empty ? '—' : value}</div>
    </div>
  )
}

function CdStatePill({ state, label, P }: { state: FicheLoopItem['state']; label: string; P: FichePal }) {
  return <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: P[LOOP_STATE[state].key], color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>{label}</span>
}

const cdLbl = (P: FichePal): CSSProperties => ({ fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: P.muted, marginBottom: 7 })

function CdTextInput({ value, onChange, placeholder, type = 'text', mono, invalid, P }: {
  value: string; onChange: (v: string) => void; placeholder?: string; type?: string; mono?: boolean; invalid?: boolean; P: FichePal
}) {
  const [f, setF] = useState(false)
  // L'anneau d'erreur prime sur l'anneau de focus : une date impossible doit rester
  // visible même curseur dedans (c'est là que l'utilisateur la corrige).
  const ring = invalid ? P.danger : f ? P.accent : null
  return (
    <input type={type} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
      onFocus={() => setF(true)} onBlur={() => setF(false)} aria-invalid={invalid || undefined}
      style={{ width: '100%', height: 38, padding: '0 var(--crm-space-xl)', boxSizing: 'border-box', background: P.sub, border: 0, borderRadius: 'var(--crm-radius-lg)', color: P.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 600, fontFamily: 'inherit', outline: 'none', fontVariantNumeric: mono ? 'tabular-nums' : 'normal', boxShadow: ring ? `inset 0 0 0 2px ${ring}` : 'none', transition: 'box-shadow 140ms ease' }} />
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   TOAST « enregistré » — pilule noire auto-effacée
// ═══════════════════════════════════════════════════════════════════════
/** Pilule de confirmation. Montée en PORTAL : le viewport du pager est en
 *  `overflow: hidden`, un `position: fixed` enfant y serait clippé. */
function CdSavedToast({ label }: { label: string }) {
  return createPortal(
    <div style={{ position: 'fixed', bottom: 30, left: '50%', zIndex: 100, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', height: 42, padding: '0 var(--crm-space-4xl) 0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', background: '#0B0C0E', color: '#FFFFFF', fontSize: 'var(--crm-text-md)', fontWeight: 700, fontFamily: "'Inter Tight', system-ui, sans-serif", boxShadow: '0 16px 44px rgba(0,0,0,0.35)', animation: 'cdpToast .28s cubic-bezier(.2,.8,.2,1) both', pointerEvents: 'none' }}>
      <span style={{ width: 20, height: 20, borderRadius: 'var(--crm-radius-pill)', background: '#059669', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
        <FcpIcon name="check" size={11} stroke="#FFFFFF" sw={2.6} />
      </span>
      {label}
    </div>,
    document.body,
  )
}

/** Flash de 1700 ms après un enregistrement réussi (timer nettoyé au démontage). */
function useSavedFlash(): [boolean, () => void] {
  const [saved, setSaved] = useState(false)
  const tRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const flash = useCallback(() => {
    setSaved(true)
    if (tRef.current) clearTimeout(tRef.current)
    tRef.current = setTimeout(() => setSaved(false), 1700)
  }, [])
  useEffect(() => () => { if (tRef.current) clearTimeout(tRef.current) }, [])
  return [saved, flash]
}

function CdSelect({ value, onChange, options, P }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; P: FichePal
}) {
  const [f, setF] = useState(false)
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} onFocus={() => setF(true)} onBlur={() => setF(false)}
      style={{ width: '100%', height: 38, padding: '0 30px 0 12px', boxSizing: 'border-box', background: P.sub, border: 0, borderRadius: 'var(--crm-radius-lg)', color: P.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 600, fontFamily: 'inherit', outline: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', boxShadow: f ? `inset 0 0 0 2px ${P.accent}` : 'none', backgroundImage: chevronUri(P.muted), backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center', transition: 'box-shadow 140ms ease' }}>
      {options.map((o) => <option key={o.v} value={o.v} style={{ color: '#0B0C0E' }}>{o.l}</option>)}
    </select>
  )
}

function CdSeg({ value, onChange, options, P }: {
  value: string; onChange: (v: string) => void; options: { v: string; l: string }[]; P: FichePal
}) {
  return (
    <div style={{ display: 'flex', gap: 'var(--crm-space-xs)', background: P.sub, padding: 'var(--crm-space-xs)', borderRadius: 'var(--crm-radius-lg)' }}>
      {options.map((o) => {
        const on = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{ flex: 1, height: 32, borderRadius: 'var(--crm-radius-sm)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: on ? 700 : 600, background: on ? P.accent : 'transparent', color: on ? P.accentInk : P.muted, boxShadow: on ? P.shadowSm : 'none', transition: 'background 140ms ease, color 140ms ease' }}>{o.l}</button>
        )
      })}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   MENU ⋯ (dropdown Sugar)
// ═══════════════════════════════════════════════════════════════════════
function CdMenu({ P, dark, onEditId, onEditCoord, onEditCrit, onDelete }: {
  P: FichePal; dark: boolean; onEditId: () => void; onEditCoord: () => void; onEditCrit: () => void; onDelete: () => void
}) {
  const { t } = useTranslation('contacts')
  const [hi, setHi] = useState(-1)
  const menuShadow = dark ? `inset 0 0 0 1px ${P.hairline}, ${P.sp.shadow}` : P.sp.shadow
  // Fond neutre dédié en sombre (même famille que la modale destructive), pas la carte.
  const menuBg = P.sp.solidBg
  const menuHov = P.sp.solidBgSub
  const items = [
    { icon: 'pencil', label: t('fiche.menu.editIdentity'), act: onEditId },
    { icon: 'msg', label: t('fiche.menu.editCoord'), act: onEditCoord },
    { icon: 'home', label: t('fiche.menu.editCriteria'), act: onEditCrit },
  ]
  const rowBase: CSSProperties = { width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 120ms ease' }
  return (
    <div role="menu" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 264, background: menuBg, borderRadius: 'var(--crm-radius-2xl)', boxShadow: menuShadow, padding: 'var(--crm-space-sm)', zIndex: 41, transformOrigin: 'top right', animation: 'cdpMenuIn .16s cubic-bezier(.2,.8,.2,1)' }}>
      {items.map((it, i) => (
        <button key={it.label} role="menuitem" onMouseEnter={() => setHi(i)} onMouseLeave={() => setHi(-1)} onClick={it.act}
          style={{ ...rowBase, background: hi === i ? menuHov : 'transparent' }}>
          <FcpIcon name={it.icon} size={19} stroke={P.inkSoft} />
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: P.ink }}>{it.label}</span>
        </button>
      ))}
      <div style={{ height: 1, background: P.hairline, margin: '6px 8px' }} />
      <button role="menuitem" onMouseEnter={() => setHi(99)} onMouseLeave={() => setHi(-1)} onClick={onDelete}
        style={{ ...rowBase, background: hi === 99 ? P.danger + (dark ? '22' : '14') : 'transparent' }}>
        <FcpIcon name="trash" size={19} stroke={P.danger} />
        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: P.danger }}>{t('fiche.menu.delete')}</span>
      </button>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   MODALES
// ═══════════════════════════════════════════════════════════════════════
/** Modale destructive. `done` bascule sur la carte « Contact supprimé » (le retour à
 *  la liste est temporisé par l'appelant, sinon l'état ne serait jamais visible).
 *  Palette neutre Beta v1 (#17181A / voile noir) — les deux autres modales gardent
 *  la teinte bleutée d'origine, le changement est isolé au geste destructif. */
function CdDeleteModal({ P, dark, name, done, error, onCancel, onConfirm }: {
  P: FichePal; dark: boolean; name: string; done?: boolean; error: string | null; onCancel: () => void; onConfirm: () => void
}) {
  const { t } = useTranslation('contacts')
  const modalBg = P.sp.solidBg
  const veil: CSSProperties = { position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(2px)', animation: 'cdpFade .18s ease', fontFamily: "'Inter Tight', system-ui, sans-serif" }

  if (done) {
    return createPortal(
      <div style={veil}>
        <div style={{ width: 360, background: modalBg, borderRadius: 'var(--crm-radius-5xl)', boxShadow: '0 40px 100px rgba(0,0,0,0.42), 0 8px 24px rgba(0,0,0,0.2)', padding: '32px 30px', textAlign: 'center', animation: 'cdpRise .3s cubic-bezier(.2,.8,.2,1)' }}>
          <span style={{ width: 48, height: 48, borderRadius: 'var(--crm-radius-pill)', background: '#059669', display: 'inline-grid', placeItems: 'center' }}>
            <FcpIcon name="check" size={22} stroke="#FFFFFF" sw={2.4} />
          </span>
          <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.4, color: P.ink, marginTop: 14 }}>{t('fiche.delete.done')}</div>
        </div>
      </div>,
      document.body,
    )
  }

  return createPortal(
    <div style={veil}>
      <div style={{ width: 440, background: modalBg, borderRadius: 'var(--crm-radius-5xl)', boxShadow: '0 40px 100px rgba(0,0,0,0.42), 0 8px 24px rgba(0,0,0,0.2)', padding: '28px 30px 24px', animation: 'cdpRise .3s cubic-bezier(.2,.8,.2,1)' }}>
        <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)', background: P.danger + (dark ? '22' : '14'), display: 'grid', placeItems: 'center' }}>
          <FcpIcon name="trash" size={20} stroke={P.danger} sw={2} />
        </span>
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.4, color: P.ink, marginTop: 16 }}>{t('fiche.delete.title', { name: name || t('fiche.delete.thisContact') })}</div>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: P.muted, lineHeight: 1.55, marginTop: 10 }}>
          <Trans t={t} i18nKey="fiche.delete.body" components={{ 1: <b style={{ color: P.inkSoft, fontWeight: 700 }} /> }} />
        </div>
        {error && (
          <div role="alert" style={{ marginTop: 16, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: P.danger, lineHeight: 1.45 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 22 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700, background: P.sub, color: P.inkSoft }}>{t('cd.cancel')}</button>
          <button onClick={onConfirm} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700, background: P.danger, color: '#FFFFFF' }}>{t('fiche.delete.confirm')}</button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function CdKycWarn({ P, name, onCancel, onConfirm }: { P: FichePal; name: string; onCancel: () => void; onConfirm: () => void }) {
  const { t } = useTranslation('contacts')
  const modalBg = P.sp.solidBg
  const [consent, setConsent] = useState(false)
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 90, display: 'grid', placeItems: 'center', background: 'rgba(15,20,30,0.42)', backdropFilter: 'blur(2px)', animation: 'cdpFade .18s ease' }}>
      <div style={{ width: 440, background: modalBg, borderRadius: 'var(--crm-radius-5xl)', boxShadow: '0 40px 100px rgba(0,0,0,0.42), 0 8px 24px rgba(0,0,0,0.2)', padding: '30px 30px 24px', animation: 'cdpRise .3s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ width: 46, height: 46, borderRadius: 'var(--crm-radius-xl)', background: P.danger + '24', display: 'grid', placeItems: 'center', marginBottom: 16 }}>
          <FcpIcon name="shield" size={22} stroke={P.danger} sw={2} />
        </div>
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.4, color: P.ink }}>{t('fiche.kycWarn.title')}</div>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: P.muted, lineHeight: 1.55, marginTop: 10 }}>
          <Trans t={t} i18nKey="fiche.kycWarn.body" values={{ name: name || t('fiche.delete.thisContact') }} components={{ 1: <b style={{ color: P.inkSoft, fontWeight: 700 }} /> }} />
        </div>
        <label role="checkbox" aria-checked={consent} tabIndex={0}
          onClick={() => setConsent((v) => !v)}
          onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); setConsent((v) => !v) } }}
          style={{ display: 'flex', gap: 'var(--crm-space-xl)', alignItems: 'flex-start', marginTop: 18, padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-xl)', background: P.sub, cursor: 'pointer' }}>
          <span style={{ width: 20, height: 20, borderRadius: 'var(--crm-radius-xs)', flexShrink: 0, marginTop: 1, display: 'grid', placeItems: 'center', background: consent ? P.accent : 'transparent', boxShadow: consent ? 'none' : `inset 0 0 0 2px ${P.ghost}`, transition: 'background 140ms ease' }}>
            {consent && <FcpIcon name="check" size={13} stroke={P.accentInk} sw={3} />}
          </span>
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: P.inkSoft, lineHeight: 1.5 }}>
            <Trans t={t} i18nKey="fiche.kycWarn.consent" components={{ 1: <b style={{ fontWeight: 700, color: P.ink }} /> }} />
          </span>
        </label>
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 20 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700, background: P.sub, color: P.inkSoft }}>{t('cd.cancel')}</button>
          <button onClick={consent ? onConfirm : undefined} disabled={!consent} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: consent ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700, background: P.danger, color: '#FFFFFF', opacity: consent ? 1 : 0.45, transition: 'opacity 140ms ease' }}>{t('fiche.kycWarn.confirm')}</button>
        </div>
      </div>
    </div>
  )
}

/** Brouillon d'identité = les 6 champs LBA comparés par `hasIdentityChanged`. */
type NmDraft = ContactIdentity

/** Modale « Modifier l'identité » — 6 champs LBA. Les pays sont des SELECTS sur
 *  COUNTRIES (la base attend un code ISO alpha-2, pas un libellé libre). */
function CdIdentityModal({ P, dark, draft, setDraft, verified, error, onCancel, onSave }: {
  P: FichePal; dark: boolean; draft: NmDraft; setDraft: (fn: (s: NmDraft) => NmDraft) => void; verified: boolean; error: string | null; onCancel: () => void; onSave: () => void
}) {
  const { t } = useTranslation('contacts')
  const modalBg = P.sp.solidBg
  const birthKo = isInvalidSwissDate(draft.birth)
  const canSave = !!draft.firstName.trim() && !!draft.lastName.trim() && !birthKo
  const countryOpts = [{ v: '', l: t('fiche.identity.countryNone') }, ...COUNTRIES.map((c) => ({ v: c.code, l: c.name }))]
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', background: 'rgba(15,20,30,0.42)', backdropFilter: 'blur(2px)', animation: 'cdpFade .18s ease' }}>
      <div style={{ width: 452, background: modalBg, borderRadius: 'var(--crm-radius-5xl)', boxShadow: '0 40px 100px rgba(0,0,0,0.42), 0 8px 24px rgba(0,0,0,0.2)', padding: '28px 30px 24px', animation: 'cdpRise .3s cubic-bezier(.2,.8,.2,1)' }}>
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.4, color: P.ink }}>{t('fiche.identity.title')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)', marginTop: 20 }}>
          <div>
            <div style={cdLbl(P)}>{t('fiche.identity.firstName')}</div>
            <CdTextInput value={draft.firstName} onChange={(val) => setDraft((s) => ({ ...s, firstName: val }))} placeholder={t('fiche.identity.firstName')} P={P} />
          </div>
          <div>
            <div style={cdLbl(P)}>{t('fiche.identity.lastName')}</div>
            <CdTextInput value={draft.lastName} onChange={(val) => setDraft((s) => ({ ...s, lastName: val }))} placeholder={t('fiche.identity.lastName')} P={P} />
          </div>
          <div>
            <div style={cdLbl(P)}>{t('fiche.identity.birth')}</div>
            <CdTextInput value={draft.birth} onChange={(val) => setDraft((s) => ({ ...s, birth: val }))} placeholder={t('fiche.identity.birthPlaceholder')} mono invalid={birthKo} P={P} />
          </div>
          <div>
            <div style={cdLbl(P)}>{t('fiche.identity.nationality')}</div>
            <CdSelect value={draft.nationality} onChange={(val) => setDraft((s) => ({ ...s, nationality: val }))} options={countryOpts} P={P} />
          </div>
          <div>
            <div style={cdLbl(P)}>{t('fiche.identity.residence')}</div>
            <CdSelect value={draft.residence} onChange={(val) => setDraft((s) => ({ ...s, residence: val }))} options={countryOpts} P={P} />
          </div>
          <div>
            <div style={cdLbl(P)}>{t('fiche.identity.address')}</div>
            <CdTextInput value={draft.homeAddress} onChange={(val) => setDraft((s) => ({ ...s, homeAddress: val }))} placeholder={t('fiche.identity.addressPlaceholder')} P={P} />
          </div>
        </div>
        {verified && (
          <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'flex-start', marginTop: 16, background: P.danger + (dark ? '22' : '14'), borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)' }}>
            <FcpIcon name="shield" size={16} stroke={P.danger} sw={2} />
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: P.inkSoft, lineHeight: 1.45 }}>
              <Trans t={t} i18nKey="fiche.identity.kycWarn" components={{ 1: <b style={{ fontWeight: 700 }} /> }} />
            </div>
          </div>
        )}
        {error && (
          <div role="alert" style={{ marginTop: 16, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: P.danger, lineHeight: 1.45 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 22 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700, background: P.sub, color: P.inkSoft }}>{t('cd.cancel')}</button>
          <button onClick={onSave} disabled={!canSave} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: canSave ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700, background: P.accent, color: P.accentInk, opacity: canSave ? 1 : 0.45, transition: 'opacity 140ms ease' }}>{t('cd.save')}</button>
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   COORDONNÉES (éditables)
// ═══════════════════════════════════════════════════════════════════════
/**
 * Joignabilité WhatsApp — l'état, son MOTIF, et le geste.
 *
 * Pourquoi le motif est affiché et pas seulement l'état : un agent à qui l'on grise une
 * action sans raison réessaie, puis contourne. Et les deux origines ne se valent pas —
 * « la personne a demandé » ne se lève pas depuis le CRM, « l'agent a coché » est une note
 * interne. Les présenter pareil ferait croire l'un révocable comme l'autre.
 *
 * ⛔ AUCUN appel réseau ici : le parent lit et écrit, la carte affiche. C'est la convention
 * de tout ce pager.
 */
function CdConsent({ P, phone, consent, onDoNotContact, onInviteOptin }: {
  P: FichePal; phone: string
  consent: FicheConsent | null | undefined
  onDoNotContact?: () => Promise<void>
  onInviteOptin?: () => Promise<void>
}) {
  const { t } = useTranslation('contacts')
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [inviteErr, setInviteErr] = useState<string | null>(null)

  // Tant que la lecture n'a pas abouti, on n'affirme RIEN. Afficher « joignable » sur une
  // lecture en cours ferait exactement l'inverse de ce que cette carte existe pour éviter.
  if (!consent) return null

  const parLaPersonne = consent.reason === 'stop_keyword' || consent.reason === 'meta_block'
  const teinte = consent.suppressed ? (parLaPersonne ? P.danger : P.wait) : P.ok
  const etat = !consent.suppressed
    ? t('fiche.consent.reachable')
    : parLaPersonne ? t('fiche.consent.optedOut') : t('fiche.consent.blockedByAgent')

  const agir = () => {
    if (!onDoNotContact || busy) return
    setBusy(true)
    void onDoNotContact().finally(() => { setBusy(false); setConfirming(false) })
  }

  return (
    <div style={{ marginTop: 'var(--crm-space-xl)', paddingTop: 'var(--crm-space-lg)', borderTop: `1px solid ${P.hairline}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
        <div style={cdLbl(P)}>{t('fiche.consent.label')}</div>
        <div style={{ flex: 1 }} />
        {consent.journal.length > 0 && (
          <button
            onClick={() => setShowLog((v) => !v)}
            style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', fontFamily: 'inherit',
              fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: P.muted }}
          >{showLog ? t('fiche.consent.hideLog') : t('fiche.consent.showLog')}</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
        {/* Pastille : texte coloré sans fond (grammaire maison des badges). */}
        <span style={{ fontSize: 'var(--crm-text-base)', fontWeight: 700, color: teinte }}>{etat}</span>
        {consent.suppressed && consent.suppressedAt && (
          <span style={{ fontSize: 'var(--crm-text-sm)', color: P.muted, fontVariantNumeric: 'tabular-nums' }}>
            {new Date(consent.suppressedAt).toLocaleDateString('fr-CH')}
          </span>
        )}
      </div>

      {consent.suppressed && (
        <div style={{ fontSize: 'var(--crm-text-sm)', color: P.inkSoft, marginTop: 5 }}>
          {parLaPersonne ? t('fiche.consent.optedOutHelp') : t('fiche.consent.blockedByAgentHelp')}
        </div>
      )}

      {/* ── Invitation d'opt-in (click_to_wa) ──────────────────────────────────
          Trois états, jamais deux boutons : déjà consenti → rien à demander ;
          invitation en route → on le DIT plutôt que d'en renvoyer une (chaque envoi
          crée une invitation valable quatorze jours, et deux liens vivants pour la
          même personne c'est un consentement qu'on ne saura pas attribuer) ;
          sinon → le bouton. Un contact bloqué n'est jamais invité : lui demander
          « puis-je vous écrire ? » est le message qu'il vient de refuser. */}
      {!consent.suppressed && !consent.optedIn && !!onInviteOptin && (
        <div style={{ marginTop: 'var(--crm-space-lg)' }}>
          {consent.pendingInviteAt ? (
            <div style={{ fontSize: 'var(--crm-text-sm)', color: P.muted }}>
              {t('fiche.consent.inviteSent', {
                date: new Date(consent.pendingInviteAt).toLocaleDateString('fr-CH'),
              })}
            </div>
          ) : (
            <>
              <CdCta
                tone="ghost" small P={P}
                disabled={inviting || !consent.canInvite}
                onClick={() => {
                  if (inviting || !consent.canInvite) return
                  setInviting(true); setInviteErr(null)
                  void onInviteOptin()
                    .catch((e: unknown) => setInviteErr(String((e as Error)?.message ?? 'error')))
                    .finally(() => setInviting(false))
                }}
              >{inviting ? t('fiche.consent.inviting') : t('fiche.consent.invite')}</CdCta>
              {/* Le motif, pas seulement le grisage : sans e-mail, l'agent doit savoir QUOI
                  corriger — l'invitation voyage par ce canal-là, pas par WhatsApp. */}
              <div style={{ fontSize: 'var(--crm-text-sm)', color: P.muted, marginTop: 5 }}>
                {!consent.canInvite
                  ? t('fiche.consent.inviteNoEmail')
                  : inviteErr
                    ? t('fiche.consent.inviteError.' + inviteErr, { defaultValue: t('fiche.consent.inviteError.generic') })
                    : t('fiche.consent.inviteHelp')}
              </div>
            </>
          )}
        </div>
      )}

      {/* Le geste n'existe QUE s'il change quelque chose : sur un contact déjà bloqué, un
          bouton actif inviterait à un clic sans effet, donc à douter de l'état affiché. */}
      {!consent.suppressed && !!phone && !!onDoNotContact && (
        <div style={{ marginTop: 'var(--crm-space-lg)' }}>
          {!confirming ? (
            <CdCta tone="ghost" small P={P} onClick={() => setConfirming(true)}>
              {t('fiche.consent.doNotContact')}
            </CdCta>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--crm-text-sm)', color: P.inkSoft }}>{t('fiche.consent.confirm')}</span>
              <CdCta tone="ghost" small P={P} onClick={() => setConfirming(false)}>{t('cd.cancel')}</CdCta>
              <CdCta small P={P} onClick={agir} disabled={busy}>
                {busy ? t('fiche.consent.saving') : t('fiche.consent.confirmYes')}
              </CdCta>
            </div>
          )}
        </div>
      )}

      {showLog && (
        <div style={{ marginTop: 'var(--crm-space-lg)', display: 'grid', gap: 6 }}>
          {consent.journal.map((e) => (
            <div key={e.id} style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-sm)' }}>
              <span style={{ color: P.muted, fontVariantNumeric: 'tabular-nums', minWidth: 78 }}>
                {new Date(e.createdAt).toLocaleDateString('fr-CH')}
              </span>
              <span style={{ fontWeight: 600, color: e.event === 'opt_in' ? P.ok : P.inkSoft }}>
                {t('fiche.consent.event.' + e.event)}
              </span>
              <span style={{ color: P.muted }}>{t('fiche.consent.source.' + e.source, { defaultValue: e.source })}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface CoordForm { civ: string; email: string; phone: string; lang: string; canal: string }

function CdCoord({ P, fiche, editSignal, freezeRef, onSave, consent, onDoNotContact, onInviteOptin }: {
  P: FichePal; fiche: FicheContact; editSignal: number; freezeRef: MutableRefObject<number>
  onSave: ContactDetailPagerProps['onSaveCoord']
  consent?: FicheConsent | null
  onDoNotContact?: () => Promise<void>; onInviteOptin?: () => Promise<void>
}) {
  const { t } = useTranslation('contacts')
  const seed: CoordForm = { civ: fiche.civ || '', email: fiche.email || '', phone: fiche.phone || '', lang: fiche.lang || 'fr', canal: fiche.canal || '' }
  const [form, setForm] = useState<CoordForm>(seed)
  const [draft, setDraft] = useState<CoordForm>(seed)
  const [editing, setEditing] = useState(false)
  const set = (k: keyof CoordForm) => (v: string) => setDraft((s) => ({ ...s, [k]: v }))
  const start = () => { setDraft(form); setEditing(true) }
  const cancel = () => setEditing(false)
  useEffect(() => { if (editSignal > 0) { setDraft(form); setEditing(true) } }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps
  useFreeze(freezeRef, editing)
  const [saved, flashSaved] = useSavedFlash()
  // Le toast confirme une écriture RÉELLE : on attend la résolution de onSave
  // (le repo persiste en async là où le proto était synchrone).
  const save = () => {
    setForm(draft); setEditing(false)
    void onSave({ civ: draft.civ, email: draft.email, phone: draft.phone, lang: draft.lang, canal: draft.canal }).then(flashSaved)
  }

  const civOpts = [{ v: '', l: t('fiche.civ.none') }, ...CD_CIV.map((v) => ({ v, l: t('fiche.civ.' + v) }))]
  const langOpts = CD_LANGS.map((v) => ({ v, l: t('fiche.lang.' + v) }))
  const canalOpts = CD_CANALS.map((v) => ({ v, l: t('fiche.canal.' + v) }))

  return (
    // Défilement permanent (pas seulement en édition) : les 9 lignes d'identité
    // débordent la colonne dès qu'elles sont renseignées.
    <div style={{ background: P.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: P.shadowSm, padding: 'var(--crm-space-6xl) var(--crm-space-7xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)', flex: 1, minHeight: 0, overflowY: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-lg)' }}>
        <CdGrp P={P}>{t('detail.contactInfo')}</CdGrp>
        <div style={{ flex: 1 }} />
        {!editing && <span onClick={start} style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: P.muted, cursor: 'pointer' }}>{t('cd.edit')}</span>}
      </div>
      {saved && <CdSavedToast label={t('fiche.saved.coord')} />}

      {editing ? (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
            <div>
              <div style={cdLbl(P)}>{t('fiche.coord.civility')}</div>
              <CdSelect value={draft.civ} onChange={set('civ')} P={P} options={civOpts} />
            </div>
            <div>
              <div style={cdLbl(P)}>{t('detail.language')}</div>
              <CdSelect value={draft.lang} onChange={set('lang')} P={P} options={langOpts} />
            </div>
          </div>
          <div>
            <div style={cdLbl(P)}>{t('detail.email')}</div>
            <CdTextInput type="email" value={draft.email} onChange={set('email')} placeholder={t('fiche.coord.emailPlaceholder')} P={P} />
          </div>
          <div>
            <div style={cdLbl(P)}>{t('detail.phone')}</div>
            <CdTextInput type="tel" value={draft.phone} onChange={set('phone')} placeholder={t('fiche.coord.phonePlaceholder')} mono P={P} />
          </div>
          <div>
            <div style={cdLbl(P)}>{t('fiche.coord.channel')}</div>
            <CdSeg value={draft.canal} onChange={set('canal')} P={P} options={canalOpts} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 'auto', paddingTop: 'var(--crm-space-xs)' }}>
            <CdCta tone="ghost" small P={P} onClick={cancel}>{t('cd.cancel')}</CdCta>
            <div style={{ flex: 1 }} />
            <CdCta small P={P} onClick={save}>{t('cd.save')}</CdCta>
          </div>
        </>
      ) : (
        // Une seule grille 2 colonnes, ordre du handoff : état civil → identité LBA → contact.
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)' }}>
          <CdReadRow label={t('fiche.coord.civility')} value={form.civ ? t('fiche.civ.' + form.civ) : ''} empty={!form.civ} P={P} />
          <CdReadRow label={t('detail.language')} value={form.lang ? t('fiche.lang.' + form.lang) : ''} empty={!form.lang} P={P} />
          <CdReadRow label={t('fiche.coord.birth')} value={fiche.birth} empty={!fiche.birth} mono P={P} />
          <CdReadRow label={t('fiche.coord.nationality')} value={countryName(fiche.nationality)} empty={!fiche.nationality} P={P} />
          <CdReadRow label={t('fiche.coord.residence')} value={countryName(fiche.residence)} empty={!fiche.residence} P={P} />
          <CdReadRow label={t('fiche.coord.address')} value={fiche.homeAddress} empty={!fiche.homeAddress} P={P} />
          <CdReadRow label={t('detail.email')} value={form.email} empty={!form.email} P={P} />
          <CdReadRow label={t('detail.phone')} value={form.phone} empty={!form.phone} mono P={P} />
          <CdReadRow label={t('fiche.coord.channel')} value={form.canal ? t('fiche.canal.' + form.canal) : ''} empty={!form.canal} P={P} />
          {/* Pleine largeur : la joignabilité conditionne TOUTES les lignes au-dessus. */}
          <div style={{ gridColumn: '1 / -1' }}>
            <CdConsent P={P} phone={form.phone} consent={consent} onDoNotContact={onDoNotContact} onInviteOptin={onInviteOptin} />
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   CRITÈRES (éditables — donnée reine du matching)
// ═══════════════════════════════════════════════════════════════════════
interface CritForm {
  budgetMin: string; budgetMax: string; types: string[]; cantons: string[]
  cities: string; roomsMin: string; areaMin: string; mustHave: string[]
}

function CdCrit({ P, fiche, editSignal, freezeRef, onSave }: {
  P: FichePal; fiche: FicheContact; editSignal: number; freezeRef: MutableRefObject<number>; onSave: ContactDetailPagerProps['onSaveCriteria']
}) {
  const { t } = useTranslation('contacts')
  const isTenant = fiche.isTenant
  const isSeller = fiche.audience === 'Vendeur' || fiche.audience === 'Bailleur'
  const cr = fiche.crit
  const seed: CritForm = {
    budgetMin: cr.budgetMin != null ? String(cr.budgetMin) : '',
    budgetMax: cr.budgetMax != null ? String(cr.budgetMax) : '',
    types: [...(cr.types || [])], cantons: [...(cr.cantons || [])],
    cities: (cr.cities || []).join(', '),
    roomsMin: cr.roomsMin != null ? String(cr.roomsMin) : '',
    areaMin: cr.areaMin != null ? String(cr.areaMin) : '',
    mustHave: [...(cr.mustHave || [])],
  }
  const [v, setV] = useState<CritForm>(seed)
  const [d, setD] = useState<CritForm>(seed)
  const [editing, setEditing] = useState(false)
  const start = () => { setD(v); setEditing(true) }
  const cancel = () => setEditing(false)
  useEffect(() => { if (editSignal > 0) { setD(v); setEditing(true) } }, [editSignal]) // eslint-disable-line react-hooks/exhaustive-deps
  useFreeze(freezeRef, editing)
  const [saved, flashSaved] = useSavedFlash()
  const setF = (key: keyof CritForm) => (val: string) => setD((s) => ({ ...s, [key]: val }))
  const toggle = (key: 'types' | 'cantons' | 'mustHave', item: string) =>
    setD((s) => ({ ...s, [key]: s[key].includes(item) ? s[key].filter((x) => x !== item) : [...s[key], item] }))
  const save = () => {
    setV(d); setEditing(false)
    const out: CriteriaInput = {
      transaction: isTenant ? 'location' : 'vente',
      types: d.types, cantons: d.cantons,
      cities: d.cities.split(',').map((s) => s.trim()).filter(Boolean),
      budgetMin: d.budgetMin === '' ? null : Number(d.budgetMin),
      budgetMax: d.budgetMax === '' ? null : Number(d.budgetMax),
      roomsMin: d.roomsMin === '' ? null : Number(d.roomsMin),
      areaMin: d.areaMin === '' ? null : Number(d.areaMin),
      mustHave: d.mustHave,
    }
    void onSave(out).then(flashSaved)
  }

  const budgetLabel = isTenant ? t('fiche.crit.rentMax') : t('fiche.crit.buyBudget')
  const budgetRead = isTenant
    ? (v.budgetMax ? `${fmtCHF(Number(v.budgetMax))} / mois` : '—')
    : (v.budgetMin && v.budgetMax ? `${fmtCHF(Number(v.budgetMin))} – ${fmtCHF(Number(v.budgetMax))}` : (v.budgetMax ? `≤ ${fmtCHF(Number(v.budgetMax))}` : '—'))
  const featLabel = (id: string) => { const o = CD_MUSTHAVE.find((x) => x.id === id); return o ? t(o.k) : cap(id) }
  const typeLabel = (id: string) => (CD_ALL_TYPES.includes(id) ? t('fiche.propType.' + id) : cap(id))
  const mustRead = v.mustHave.length ? v.mustHave.map(featLabel).join(' · ') : '—'

  return (
    <div style={{ background: P.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: P.shadow, padding: 'var(--crm-space-6xl) var(--crm-space-7xl)', display: 'flex', flexDirection: 'column', gap: editing ? 15 : 20, minHeight: 0, overflowY: editing ? 'auto' : 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-lg)' }}>
        <CdGrp P={P}>{isSeller ? t('fiche.crit.offers') : t('fiche.crit.wants')}</CdGrp>
        <div style={{ flex: 1 }} />
        {!editing && <span onClick={start} style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: P.muted, cursor: 'pointer' }}>{t('cd.edit')}</span>}
      </div>
      {saved && <CdSavedToast label={t('fiche.saved.crit')} />}

      {editing ? (
        <>
          <div>
            <div style={cdLbl(P)}>{budgetLabel}{!isTenant && ' ' + t('fiche.crit.chfUnit')}</div>
            {isTenant ? (
              <CdTextInput type="number" value={d.budgetMax} onChange={setF('budgetMax')} placeholder="2500" mono P={P} />
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
                <CdTextInput type="number" value={d.budgetMin} onChange={setF('budgetMin')} placeholder={t('fiche.crit.minPlaceholder')} mono P={P} />
                <CdTextInput type="number" value={d.budgetMax} onChange={setF('budgetMax')} placeholder={t('fiche.crit.maxPlaceholder')} mono P={P} />
              </div>
            )}
          </div>
          <div>
            <div style={cdLbl(P)}>{t('detail.propertyType')}</div>
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
              {CD_ALL_TYPES.map((tk) => <CdPickChip key={tk} on={d.types.includes(tk)} onClick={() => toggle('types', tk)} P={P}>{typeLabel(tk)}</CdPickChip>)}
            </div>
          </div>
          <div>
            <div style={cdLbl(P)}>{t('fiche.crit.sectors')}</div>
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap', marginBottom: 10 }}>
              {CD_CANTONS.map((cn) => <CdPickChip key={cn} on={d.cantons.includes(cn)} onClick={() => toggle('cantons', cn)} P={P}>{cn}</CdPickChip>)}
            </div>
            <CdTextInput value={d.cities} onChange={setF('cities')} placeholder={t('fiche.crit.citiesPlaceholder')} P={P} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
            <div><div style={cdLbl(P)}>{t('fiche.crit.roomsMin')}</div><CdTextInput type="number" value={d.roomsMin} onChange={setF('roomsMin')} placeholder="4" mono P={P} /></div>
            <div><div style={cdLbl(P)}>{t('fiche.crit.areaMinEdit')}</div><CdTextInput type="number" value={d.areaMin} onChange={setF('areaMin')} placeholder="90" mono P={P} /></div>
          </div>
          <div>
            <div style={cdLbl(P)}>{t('fiche.crit.mustHave')}</div>
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
              {CD_MUSTHAVE.map((mh) => <CdPickChip key={mh.id} on={d.mustHave.includes(mh.id)} onClick={() => toggle('mustHave', mh.id)} P={P}>{t(mh.k)}</CdPickChip>)}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 2 }}>
            <CdCta tone="ghost" small P={P} onClick={cancel}>{t('cd.cancel')}</CdCta>
            <div style={{ flex: 1 }} />
            <CdCta small P={P} onClick={save}>{t('cd.save')}</CdCta>
          </div>
        </>
      ) : (
        <>
          <div>
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: P.muted }}>{budgetLabel}</div>
            <div style={{ fontSize: 'var(--crm-text-6xl)', fontWeight: 800, letterSpacing: -1, color: P.ink, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{budgetRead}</div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: P.muted, marginBottom: 9 }}>{t('detail.propertyType')}</div>
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap' }}>
              {CD_ALL_TYPES.map((tk) => <CdChip key={tk} on={v.types.includes(tk)} P={P}>{typeLabel(tk)}</CdChip>)}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', color: P.muted, marginBottom: 9 }}>{t('fiche.crit.sectors')}</div>
            <div style={{ display: 'flex', gap: 'var(--crm-space-md)', flexWrap: 'wrap', alignItems: 'center' }}>
              {v.cantons.map((cn) => <CdChip key={cn} on P={P}>{cn}</CdChip>)}
              {v.cities && <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: P.muted }}>{v.cities}</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1.4fr', gap: 'var(--crm-space-4xl)', alignItems: 'start' }}>
            <CdField label={t('fiche.crit.roomsMin')} value={v.roomsMin || '—'} mono P={P} />
            <CdField label={t('fiche.crit.areaMin')} value={v.areaMin ? v.areaMin + ' m²' : '—'} mono P={P} />
            <CdField label={t('fiche.crit.mustHave')} value={mustRead} P={P} />
          </div>
        </>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   NOTE (sauvegarde auto façon Apple Notes — parent débounce)
// ═══════════════════════════════════════════════════════════════════════
function CdNote({ P, notes, onSaveNote }: { P: FichePal; notes: string; onSaveNote: (v: string) => void }) {
  const { t } = useTranslation('contacts')
  const [note, setNote] = useState(notes || '')
  const [foc, setFoc] = useState(false)
  const onChange = (val: string) => { setNote(val); onSaveNote(val) }
  return (
    <div style={{ background: P.card, borderRadius: 'var(--crm-radius-2xl)', boxShadow: P.shadowSm, padding: 'var(--crm-space-xl) var(--crm-space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', flex: 1, minHeight: 0 }}>
      <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: P.muted }}>{t('fiche.note.label')}</span>
      <textarea value={note} onChange={(e) => onChange(e.target.value)} placeholder={t('fiche.note.placeholder')}
        onFocus={() => setFoc(true)} onBlur={() => setFoc(false)}
        style={{ flex: 1, minHeight: 54, width: '100%', boxSizing: 'border-box', resize: 'none', border: 0, outline: 'none', background: P.sub, borderRadius: 'var(--crm-radius-lg)', padding: 'var(--crm-space-lg) var(--crm-space-xl)', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 500, lineHeight: 1.5, color: P.ink, boxShadow: foc ? `inset 0 0 0 2px ${P.accent}` : 'none', transition: 'box-shadow 140ms ease' }} />
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   POINTS LATÉRAUX
// ═══════════════════════════════════════════════════════════════════════
function CdDots({ page, onGo, P, labels }: { page: number; onGo: (i: number) => void; P: FichePal; labels: string[] }) {
  return (
    <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 30, display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', alignItems: 'center' }}>
      {labels.map((label, i) => (
        <button key={label} onClick={() => onGo(i)} title={label} style={{
          width: 8, height: i === page ? 26 : 8, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', padding: 0,
          background: i === page ? P.accent : P.hairline, transition: 'height .35s, background .35s',
        }} />
      ))}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGE 0 — SES INFORMATIONS
// ═══════════════════════════════════════════════════════════════════════
function CdInfos({ P, dark, fiche, nba, freezeRef, onBack, onOpenKyc, onOpenMatching, onOpenListings, onSaveIdentity, onInvalidateKyc, onSaveCoord, onSaveCriteria, onSaveNote, onDelete, consent, onDoNotContact, onInviteOptin }: {
  P: FichePal; dark: boolean; fiche: FicheContact; nba?: FicheNba | null; freezeRef: MutableRefObject<number>
  onBack: () => void; onOpenKyc: () => void; onOpenMatching: () => void; onOpenListings: () => void
  onSaveIdentity: ContactDetailPagerProps['onSaveIdentity']; onInvalidateKyc: ContactDetailPagerProps['onInvalidateKyc']
  onSaveCoord: ContactDetailPagerProps['onSaveCoord']; onSaveCriteria: ContactDetailPagerProps['onSaveCriteria']
  onSaveNote: ContactDetailPagerProps['onSaveNote']; onDelete: ContactDetailPagerProps['onDelete']
  consent?: FicheConsent | null
  onDoNotContact?: () => Promise<void>; onInviteOptin?: () => Promise<void>
}) {
  const { t } = useTranslation('contacts')
  const ficheIdentity = useCallback((): ContactIdentity => ({
    firstName: fiche.firstName, lastName: fiche.lastName, birth: fiche.birth,
    nationality: fiche.nationality, residence: fiche.residence, homeAddress: fiche.homeAddress,
  }), [fiche.firstName, fiche.lastName, fiche.birth, fiche.nationality, fiche.residence, fiche.homeAddress])
  const [nm, setNm] = useState<NmDraft>(ficheIdentity)
  const [nmDraft, setNmDraft] = useState<NmDraft>(ficheIdentity)
  const [verified, setVerified] = useState(fiche.verified)
  const [idEdit, setIdEdit] = useState(false)
  const [idErr, setIdErr] = useState<string | null>(null)
  const [kycWarn, setKycWarn] = useState(false)
  const [delOpen, setDelOpen] = useState(false)
  const [delDone, setDelDone] = useState(false)
  const [delErr, setDelErr] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [coordSig, setCoordSig] = useState(0)
  const [critSig, setCritSig] = useState(0)
  const moreRef = useRef<HTMLDivElement>(null)
  const delTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Re-sync quand le contact change (nouveau contact ou re-fetch parent).
  useEffect(() => {
    setNm(ficheIdentity()); setNmDraft(ficheIdentity())
    setVerified(fiche.verified)
    setIdEdit(false); setKycWarn(false); setMenuOpen(false); setDelOpen(false); setCoordSig(0); setCritSig(0)
  }, [fiche.id, fiche.verified, ficheIdentity])

  useEffect(() => () => { if (delTimer.current) clearTimeout(delTimer.current) }, [])

  // Fermeture du menu ⋯ au clic extérieur / Escape.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => { if (moreRef.current && !moreRef.current.contains(e.target as Node)) setMenuOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey) }
  }, [menuOpen])

  // Gel du pager tant qu'une modale ou le menu est ouvert.
  useFreeze(freezeRef, idEdit || kycWarn || delOpen || delDone || menuOpen)

  const initials = ((nm.firstName[0] || '') + (nm.lastName[0] || '')).toUpperCase()
  const startId = () => { setNmDraft(nm); setIdErr(null); setIdEdit(true) }

  /**
   * Échec d'enregistrement de l'identité : on garde la modale ouverte avec le message.
   * Laisser la promesse rejeter en silence ferait croire à un enregistrement réussi
   * alors que l'identité LBA n'a pas bougé.
   */
  const runApplyId = (invalidate: boolean) => {
    void applyId(invalidate).catch((e: unknown) => {
      setIdErr(e instanceof Error ? e.message : t('fiche.identity.saveError'))
      setKycWarn(false)
      setIdEdit(true)
    })
  }

  const applyId = async (invalidate: boolean) => {
    setIdErr(null)
    const next: ContactIdentity = {
      firstName: nmDraft.firstName.trim(), lastName: nmDraft.lastName.trim(),
      birth: nmDraft.birth.trim(), nationality: nmDraft.nationality.trim(),
      residence: nmDraft.residence.trim(), homeAddress: nmDraft.homeAddress.trim(),
    }
    // Invalider AVANT d'écrire. Les deux appels sont deux requêtes réseau distinctes,
    // sans transaction : si l'écriture passait d'abord et que l'invalidation échouait,
    // il resterait un dossier « vérifié » portant une identité qui n'a jamais été
    // contrôlée — l'état le plus dangereux. Dans l'ordre inverse, le pire cas est un
    // dossier repassé en `pending` sans que l'identité change : récupérable.
    if (invalidate) { await onInvalidateKyc(); setVerified(false) }
    await onSaveIdentity(next)
    setNm(next)
    setIdEdit(false); setKycWarn(false)
  }
  // Les 6 champs LBA déclenchent l'avertissement, pas seulement prénom/nom : changer
  // la nationalité ou la date de naissance change l'identité vérifiée (cf. contactIdentity).
  const requestSaveId = () => {
    if (!hasIdentityChanged(nm, nmDraft)) { setIdEdit(false); return }
    if (verified) setKycWarn(true)
    else runApplyId(false)
  }

  // La carte « Contact supprimé » doit être VUE : on affiche d'abord, on quitte après.
  // L'échec est affiché plutôt qu'avalé : sans ça, la modale reste ouverte sans rien
  // dire et l'agent croit à un blocage de l'interface alors que le contact est intact.
  const confirmDelete = async () => {
    setDelErr(null)
    try {
      await onDelete()
      setDelOpen(false); setDelDone(true)
      delTimer.current = setTimeout(onBack, 1100)
    } catch (e) {
      setDelErr(e instanceof Error ? e.message : t('fiche.delete.error'))
    }
  }

  // CTA principal orienté par le côté marché du contact (pas d'invention de route).
  const isSeller = fiche.audience === 'Vendeur' || fiche.audience === 'Bailleur'
  // Beta v1 : les deux CTA du héro sont sans icône, label seul.
  const primaryLabel = isSeller ? t('fiche.cta.viewMandate') : t('fiche.cta.transmit')

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '22px 30px 24px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)', overflow: 'hidden' }}>
      {kycWarn && <CdKycWarn P={P} name={nm.firstName} onCancel={() => setKycWarn(false)} onConfirm={() => runApplyId(true)} />}
      {(delOpen || delDone) && <CdDeleteModal P={P} dark={dark} done={delDone} error={delErr} name={(nm.firstName + ' ' + nm.lastName).trim()} onCancel={() => { setDelOpen(false); setDelErr(null) }} onConfirm={() => void confirmDelete()} />}
      {idEdit && <CdIdentityModal P={P} dark={dark} draft={nmDraft} setDraft={setNmDraft} verified={verified} error={idErr} onCancel={() => { setIdEdit(false); setNmDraft(nm) }} onSave={requestSaveId} />}

      {/* Retour */}
      <div style={{ display: 'flex' }}>
        <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 32, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: P.card, boxShadow: P.shadowSm, border: 0, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: P.inkSoft, cursor: 'pointer' }}>
          <FcpIcon name="arrowL" size={13} stroke={P.inkSoft} /> {t('fiche.back')}
        </button>
      </div>

      {/* Héro */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)' }}>
        <div style={{ width: 60, height: 60, borderRadius: 'var(--crm-radius-pill)', background: fiche.photo ? 'transparent' : (fiche.avatarBg || P.buyer), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-3xl)', fontWeight: 700, flexShrink: 0, overflow: 'hidden' }}>
          {fiche.photo ? <img src={fiche.photo} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
        </div>
        <div style={{ minWidth: 0, flex: '0 1 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
            <h1 style={{ margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 800, letterSpacing: -0.8, color: P.ink, lineHeight: 1 }}>{nm.firstName} {nm.lastName}</h1>
            {verified && <CdSeal title={t('fiche.seal.title')} ariaLabel={t('fiche.seal.aria')} />}
            <button onClick={startId} title={t('fiche.menu.editIdentity')} style={{ width: 28, height: 28, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <FcpIcon name="pencil" size={14} stroke={P.muted} />
            </button>
          </div>
          {/* NBA — prochaine action estimée (cerveau partagé). Estimation, jamais une obligation. */}
          {nba && (
            <div title={nba.kycNote ?? undefined} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', marginTop: 8, minWidth: 0 }}>
              <FcpIcon name="sparkle" size={13} stroke={P.accent} />
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: P.inkSoft, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nba.label}</span>
              <span style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', color: P.muted, flexShrink: 0 }}>{nba.estimateTag}</span>
            </div>
          )}
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)' }}>
          <CdCta tone="ghost" P={P} onClick={onOpenKyc}>{t('fiche.kycDossier')}</CdCta>
          <CdCta P={P} onClick={isSeller ? onOpenListings : onOpenMatching}>{primaryLabel}</CdCta>
          <div ref={moreRef} style={{ position: 'relative' }}>
            <CdRoundBtn icon="more" P={P} onClick={() => setMenuOpen((o) => !o)} />
            {menuOpen && (
              <CdMenu P={P} dark={dark}
                onEditId={() => { setMenuOpen(false); startId() }}
                onEditCoord={() => { setMenuOpen(false); setCoordSig((n) => n + 1) }}
                onEditCrit={() => { setMenuOpen(false); setCritSig((n) => n + 1) }}
                onDelete={() => { setMenuOpen(false); setDelOpen(true) }} />
            )}
          </div>
        </div>
      </div>

      {/* Corps — 2 colonnes */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 'var(--crm-space-3xl)' }}>
        <CdCrit key={'crit-' + fiche.id} P={P} fiche={fiche} editSignal={critSig} freezeRef={freezeRef} onSave={onSaveCriteria} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)', minHeight: 0 }}>
          <CdCoord key={'coord-' + fiche.id} P={P} fiche={fiche} editSignal={coordSig} freezeRef={freezeRef} onSave={onSaveCoord} consent={consent} onDoNotContact={onDoNotContact} onInviteOptin={onInviteOptin} />
          <CdNote key={'note-' + fiche.id} P={P} notes={fiche.notes} onSaveNote={onSaveNote} />
        </div>
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   LIENS DE RÉCEPTION — voir ce qui a été envoyé, et le retirer
// ═══════════════════════════════════════════════════════════════════════
/**
 * Confirmation avant retrait. Elle est obligatoire parce que le geste est
 * irréversible DU CÔTÉ DE L'ACHETEUR : il perd l'accès à la sélection qu'on lui a
 * transmise, et seul un nouveau lien peut le lui rendre.
 */
function CdRevokeLinkModal({ P, dark, link, busy, error, onCancel, onConfirm }: {
  P: FichePal; dark: boolean; link: FicheReceptionLink; busy: boolean; error: string | null; onCancel: () => void; onConfirm: () => void
}) {
  const { t } = useTranslation('contacts')
  const modalBg = P.sp.solidBg
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'grid', placeItems: 'center', background: 'rgba(0,0,0,0.48)', backdropFilter: 'blur(2px)', animation: 'cdpFade .18s ease', fontFamily: "'Inter Tight', system-ui, sans-serif" }}>
      <div role="dialog" aria-modal="true" aria-label={t('fiche.links.confirm.title')}
        style={{ width: 440, background: modalBg, borderRadius: 'var(--crm-radius-5xl)', boxShadow: '0 40px 100px rgba(0,0,0,0.42), 0 8px 24px rgba(0,0,0,0.2)', padding: '28px 30px 24px', animation: 'cdpRise .3s cubic-bezier(.2,.8,.2,1)' }}>
        <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)', background: P.danger + (dark ? '22' : '14'), display: 'grid', placeItems: 'center' }}>
          <FcpIcon name="shield" size={20} stroke={P.danger} sw={2} />
        </span>
        <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.4, color: P.ink, marginTop: 16 }}>{t('fiche.links.confirm.title')}</div>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: P.muted, lineHeight: 1.55, marginTop: 10 }}>
          {t('fiche.links.confirm.body', { count: link.count })}
        </div>
        {error && (
          <div role="alert" style={{ marginTop: 16, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: P.danger, lineHeight: 1.45 }}>{error}</div>
        )}
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', marginTop: 22 }}>
          <button onClick={onCancel} style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700, background: P.sub, color: P.inkSoft }}>{t('cd.cancel')}</button>
          <button onClick={busy ? undefined : onConfirm} disabled={busy}
            style={{ flex: 1, height: 44, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: busy ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700, background: P.danger, color: '#FFFFFF', opacity: busy ? 0.55 : 1 }}>
            {busy ? t('fiche.links.confirm.busy') : t('fiche.links.confirm.cta')}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

/**
 * Liste des liens émis pour ce contact, avec retrait des liens encore ouverts.
 * Vit à côté des « Biens transmis » : c'est le même geste vu de l'autre bout,
 * ce que l'acheteur peut encore ouvrir.
 */
function CdLinks({ P, dark, links, freezeRef, onRevokeLink }: {
  P: FichePal
  dark: boolean
  links: ContactDetailPagerProps['links']
  freezeRef: MutableRefObject<number>
  onRevokeLink: (linkId: string) => Promise<FicheRevokeResult>
}) {
  const { t } = useTranslation('contacts')
  const [target, setTarget] = useState<FicheReceptionLink | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // La modale ouverte doit geler le pager, sinon la molette change de page dessous.
  useFreeze(freezeRef, !!target)

  const close = () => { setTarget(null); setBusy(false); setError(null) }
  const confirm = async () => {
    if (!target || busy) return
    setBusy(true)
    setError(null)
    const verdict = await onRevokeLink(target.id)
    if (verdict === 'ok') { close(); return }
    setBusy(false)
    // Un refus veut dire que notre liste était périmée (le lien a déjà été retiré
    // ailleurs) ; une panne veut dire qu'il faut réessayer. Deux phrases, pas une.
    setError(verdict === 'refused' ? t('fiche.links.confirm.refused') : t('fiche.links.confirm.failed'))
  }

  return (
    <div style={{ background: P.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: P.shadowSm, padding: 'var(--crm-space-3xl) var(--crm-space-5xl)', display: 'flex', flexDirection: 'column', minHeight: 0, flexShrink: 0, maxHeight: '42%', overflowY: 'auto' }}>
      <CdGrp P={P}>{t('fiche.links.title', { count: links.items.length })}</CdGrp>
      {links.isLoading ? (
        <div style={{ padding: 'var(--crm-space-3xl) var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: P.muted }}>{t('fiche.links.loading')}</div>
      ) : links.failed ? (
        <div role="alert" style={{ padding: 'var(--crm-space-3xl) var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', fontWeight: 600, color: P.danger }}>{t('fiche.links.failed')}</div>
      ) : links.items.length === 0 ? (
        <div style={{ padding: 'var(--crm-space-3xl) var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: P.muted }}>{t('fiche.links.empty')}</div>
      ) : links.items.map((l, i) => {
        const state = l.status ? LINK_STATE[l.status] : null
        const channel = l.channel === 'whatsapp' ? t('fiche.links.channel.whatsapp')
          : l.channel === 'link' ? t('fiche.links.channel.link')
            : null
        return (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xs)', opacity: l.active ? 1 : 0.6, borderTop: i > 0 ? `1px solid ${P.hairline}` : '0' }}>
            <span style={{ width: 32, height: 32, borderRadius: 'var(--crm-radius-md)', background: P.sub, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <FcpIcon name={l.channel === 'whatsapp' ? 'msg' : 'ext'} size={14} stroke={P.inkSoft} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, letterSpacing: -0.2, color: P.ink }}>
                {t('fiche.links.selection', { count: l.count })}{channel ? ` · ${channel}` : ''}
              </div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: P.muted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
                {t('fiche.links.sentOn', { date: cdDay(l.createdAt) })}
                {' · '}
                {/* Sur un lien coupé, la date qui compte est celle de la coupure,
                    pas une échéance que le lien n'atteindra jamais. */}
                {l.revokedAt
                  ? t('fiche.links.revokedOn', { date: cdDay(l.revokedAt) })
                  : t('fiche.links.expiresOn', { date: cdDay(l.expiresAt) })}
              </div>
            </div>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 22, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: state ? P[state.key] : P.ghost, color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.2, whiteSpace: 'nowrap' }}>
              {state ? t(state.labelK) : t('fiche.links.status.unknown')}
            </span>
            {l.active && (
              <CdCta small tone="ghost" P={P} onClick={() => setTarget(l)}>{t('fiche.links.revoke')}</CdCta>
            )}
          </div>
        )
      })}
      {target && (
        <CdRevokeLinkModal P={P} dark={dark} link={target} busy={busy} error={error} onCancel={close} onConfirm={() => { void confirm() }} />
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGE 1 — BOUCLE DE MATCH
// ═══════════════════════════════════════════════════════════════════════
function CdBoucle({ P, dark, loop, links, firstName, freezeRef, onOpenMatching, onProposeVisit, onRevokeLink }: {
  P: FichePal
  dark: boolean
  loop: ContactDetailPagerProps['loop']
  links: ContactDetailPagerProps['links']
  firstName: string
  freezeRef: MutableRefObject<number>
  onOpenMatching: () => void
  onProposeVisit: (matchId: string) => void
  onRevokeLink: (linkId: string) => Promise<FicheRevokeResult>
}) {
  const { t } = useTranslation('contacts')
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const hide = (id: string) => setHidden((s) => { const n = new Set(s); n.add(id); return n })
  const pending = loop.pendingLikes.filter((p) => !hidden.has(p.matchId))
  // Un lien émis suffit à sortir de l'écran d'invitation : sinon un lien encore
  // ouvert (dont les matches ont disparu) n'aurait plus AUCUN endroit d'où le retirer.
  // Une lecture des liens en ÉCHEC compte pareil : sans ce test, un contact sans
  // dossier verrait l'invitation à transmettre, et l'erreur de chargement (portée par
  // la section « Liens de réception ») serait remplacée par elle. Un défaut de lecture
  // se lirait alors comme « aucun lien », sur la seule surface qui permet d'en couper un.
  const totallyEmpty = loop.pendingLikes.length === 0 && loop.items.length === 0
    && links.items.length === 0 && !links.failed

  const counters: { v: number; l: string; liked?: boolean }[] = [
    { v: loop.transmitted, l: t('loop.pillSent') },
    { v: loop.opened, l: t('fiche.loop.opened') },
    { v: loop.pendingLikes.length, l: t('loop.pillLiked'), liked: true },
  ]

  return (
    <div style={{ position: 'absolute', inset: 0, padding: '26px 30px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-3xl)', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 'var(--crm-space-3xl)' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--crm-text-6xl)', fontWeight: 800, letterSpacing: -1, color: P.ink, lineHeight: 1 }}>{t('fiche.page.loop')}</h1>
        </div>
        <div style={{ flex: 1 }} />
        {counters.map((c) => (
          <div key={c.l} style={{ textAlign: 'center', minWidth: 62 }}>
            <div style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 800, letterSpacing: -0.5, lineHeight: 1, color: c.liked ? P.ok : P.ink, fontVariantNumeric: 'tabular-nums' }}>{c.v}</div>
            <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: P.muted, marginTop: 4 }}>{c.l}</div>
          </div>
        ))}
      </div>

      {totallyEmpty ? (
        // Boucle jamais démarrée → invitation à transmettre, pas un cul-de-sac gris.
        <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center' }}>
          <div style={{ maxWidth: 430, textAlign: 'center', background: P.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: P.shadowSm, padding: '34px 32px' }}>
            <span style={{ display: 'inline-grid', placeItems: 'center' }}>
              <FcpIcon name="send" size={30} stroke={P.inkSoft} />
            </span>
            <div style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 800, letterSpacing: -0.3, color: P.ink, marginTop: 16 }}>{t('fiche.loop.emptyTitle')}</div>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: P.muted, lineHeight: 1.55, marginTop: 8 }}>
              <Trans t={t} i18nKey="fiche.loop.emptyBody" values={{ name: firstName }} components={{ 1: <br /> }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
              <CdCta P={P} onClick={onOpenMatching}>{t('fiche.cta.transmit')}</CdCta>
            </div>
          </div>
        </div>
      ) : (
        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)' }}>
          {/* À traiter */}
          <div style={{ background: P.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: P.shadow, padding: 'var(--crm-space-4xl) var(--crm-space-5xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)', minHeight: 0, overflowY: 'auto' }}>
            <CdGrp P={P}>{t('fiche.loop.toHandleCount', { count: pending.length })}</CdGrp>
            {pending.length === 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', background: P.sub, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-3xl) var(--crm-space-2xl)' }}>
                <FcpIcon name="check" size={16} stroke={P.ok} />
                <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: P.inkSoft }}>{t('fiche.loop.nothingToHandle')}</div>
              </div>
            ) : pending.map((p) => (
              <div key={p.matchId} style={{ background: P.sub, borderRadius: 'var(--crm-radius-xl)', padding: 'var(--crm-space-2xl) var(--crm-space-2xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xl)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
                  <span style={{ width: 34, height: 34, borderRadius: 'var(--crm-radius-pill)', background: 'rgba(5,150,105,0.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><FcpIcon name="heart" size={15} stroke={P.ok} fill={P.ok} sw={1.5} /></span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, letterSpacing: -0.2, color: P.ink }}>{t('loop.likedTitle', { title: p.title })}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
                  <CdCta small P={P} onClick={() => onProposeVisit(p.matchId)}>{t('loop.proposeVisit')}</CdCta>
                  <CdCta small tone="ghost" P={P} onClick={() => hide(p.matchId)}>{t('loop.later')}</CdCta>
                  <CdCta small tone="ghost" P={P} onClick={() => hide(p.matchId)}>{t('fiche.loop.ignore')}</CdCta>
                </div>
              </div>
            ))}
          </div>

          {/* Ce qui est parti chez l'acheteur : les biens, puis les liens qui les ouvrent */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xl)', minHeight: 0 }}>
            {/* Biens transmis — état par bien */}
            <div style={{ background: P.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: P.shadowSm, padding: 'var(--crm-space-4xl) var(--crm-space-5xl)', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                <CdGrp P={P}>{t('fiche.loop.transmittedCount', { count: loop.items.length })}</CdGrp>
                <div style={{ flex: 1 }} />
                <span onClick={onOpenMatching} style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: P.muted, cursor: 'pointer' }}>{t('fiche.loop.openInMatching')}</span>
              </div>
              {loop.items.length === 0 ? (
                <div style={{ padding: 'var(--crm-space-5xl) var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', fontWeight: 500, color: P.muted }}>{t('loop.empty')}</div>
              ) : loop.items.map((m, i) => {
                const out = m.state === 'dismissed'
                return (
                  <div key={m.matchId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-2xs)', opacity: out ? 0.55 : 1, borderTop: i > 0 ? `1px solid ${P.hairline}` : '0' }}>
                    {m.photo
                      ? <img src={m.photo} alt="" style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-md)', objectFit: 'cover', flexShrink: 0, filter: out ? 'grayscale(.6)' : 'none' }} />
                      : <div style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-md)', flexShrink: 0, background: P.sub, display: 'grid', placeItems: 'center' }}><FcpIcon name="home" size={16} stroke={P.ghost} /></div>}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, letterSpacing: -0.2, color: P.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.title}</div>
                    </div>
                    <CdStatePill state={m.state} label={t(LOOP_STATE[m.state].labelK)} P={P} />
                  </div>
                )
              })}
            </div>

            <CdLinks P={P} dark={dark} links={links} freezeRef={freezeRef} onRevokeLink={onRevokeLink} />
          </div>
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════
//   PAGER
// ═══════════════════════════════════════════════════════════════════════
export default function ContactDetailPager(props: ContactDetailPagerProps): ReactElement {
  const { fiche, nba, loop, links, sp, dark, onBack, onSaveIdentity, onInvalidateKyc, onSaveCoord, onSaveCriteria, onSaveNote, onDelete, onOpenKyc, onOpenMatching, onOpenListings, onProposeVisit, onRevokeLink, consent, onDoNotContact, onInviteOptin } = props
  const { t } = useTranslation('contacts')
  const P = buildPal(sp, dark)
  const pageLabels = [t('fiche.page.infos'), t('fiche.page.loop')]

  const [page, setPage] = useState(0)
  const pageRef = useRef(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const posRef = useRef(0)
  const rafRef = useRef<number | null>(null)
  const lock = useRef(false)
  const acc = useRef(0)
  const accTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const freezeRef = useRef(0)

  const animateTo = useCallback((target: number, instant?: boolean) => {
    const vp = viewportRef.current, track = trackRef.current
    if (!vp || !track) return
    const h = vp.clientHeight, end = -target * h
    if (instant) { posRef.current = end; track.style.transform = `translateY(${end}px)`; return }
    const start = posRef.current, dur = 620, t0 = performance.now()
    const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const y = start + (end - start) * ease(p)
      posRef.current = y; track.style.transform = `translateY(${y}px)`
      if (p < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const go = useCallback((dir: number) => setPage((p) => Math.min(1, Math.max(0, p + dir))), [])
  const goTo = useCallback((i: number) => { if (lock.current) return; lock.current = true; setPage(i); setTimeout(() => { lock.current = false }, 820) }, [])

  useLayoutEffect(() => {
    animateTo(pageRef.current, true)
    const onResize = () => animateTo(pageRef.current, true)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [animateTo])

  useEffect(() => { pageRef.current = page; animateTo(page) }, [page, animateTo])

  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const canScroll = (node: EventTarget | null, dir: number) => {
      let n = node as HTMLElement | null
      while (n && n !== el && n.nodeType === 1) {
        const oy = getComputedStyle(n).overflowY
        if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) {
          if (dir > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1) return true
          if (dir < 0 && n.scrollTop > 1) return true
        }
        n = n.parentElement
      }
      return false
    }
    const onWheel = (e: WheelEvent) => {
      if (freezeRef.current > 0) { acc.current = 0; return }
      if (canScroll(e.target, e.deltaY > 0 ? 1 : -1)) { acc.current = 0; return }
      e.preventDefault()
      if (lock.current) return
      acc.current += e.deltaY
      if (accTimer.current) clearTimeout(accTimer.current)
      accTimer.current = setTimeout(() => { acc.current = 0 }, 300)
      if (Math.abs(acc.current) > 18) { const dir = acc.current > 0 ? 1 : -1; acc.current = 0; lock.current = true; go(dir); setTimeout(() => { lock.current = false }, 680) }
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target && (e.target as HTMLElement).tagName) || ''
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && (e.target as HTMLElement).isContentEditable)) return
      if (freezeRef.current > 0) return
      if (['ArrowDown', 'PageDown'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(1); setTimeout(() => { lock.current = false }, 820) } }
      if (['ArrowUp', 'PageUp'].includes(e.key)) { e.preventDefault(); if (!lock.current) { lock.current = true; go(-1); setTimeout(() => { lock.current = false }, 820) } }
    }
    window.addEventListener('keydown', onKey)
    let touchY: number | null = null
    const onTS = (e: TouchEvent) => { touchY = e.touches[0].clientY }
    const onTM = (e: TouchEvent) => {
      if (touchY == null || lock.current || freezeRef.current > 0) return
      const dy = touchY - e.touches[0].clientY
      if (Math.abs(dy) > 42) { lock.current = true; go(dy > 0 ? 1 : -1); touchY = null; setTimeout(() => { lock.current = false }, 680) }
    }
    el.addEventListener('touchstart', onTS, { passive: true })
    el.addEventListener('touchmove', onTM, { passive: true })
    return () => {
      el.removeEventListener('wheel', onWheel)
      window.removeEventListener('keydown', onKey)
      el.removeEventListener('touchstart', onTS)
      el.removeEventListener('touchmove', onTM)
    }
  }, [go])

  return (
    <main style={{ position: 'relative', flex: 1, minWidth: 0, minHeight: 0, height: '100%', paddingRight: 'var(--crm-space-7xl)', paddingBottom: 'var(--crm-space-6xl)', background: P.pageBg, fontFamily: "'Inter Tight', system-ui, sans-serif", color: P.ink }}>
      <style>{`
        @keyframes cdpMenuIn { from { opacity: 0; transform: translateY(-6px) scale(.97) } to { opacity: 1; transform: none } }
        @keyframes cdpFade { from { opacity: 0 } to { opacity: 1 } }
        @keyframes cdpRise { from { opacity: 0; transform: translateY(12px) } to { opacity: 1; transform: none } }
        @keyframes cdpToast { from { opacity: 0; transform: translate(-50%, 10px) } to { opacity: 1; transform: translate(-50%, 0) } }
      `}</style>
      <div ref={viewportRef} style={{ position: 'relative', height: '100%', borderRadius: 'var(--crm-radius-6xl)', overflow: 'hidden', border: `1px solid ${sp.frameBorder}`, boxShadow: sp.shadow }}>
        <div ref={trackRef} style={{ height: '100%', willChange: 'transform' }}>
          <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            <CdInfos P={P} dark={dark} fiche={fiche} nba={nba} freezeRef={freezeRef} onBack={onBack} onOpenKyc={onOpenKyc} onOpenMatching={onOpenMatching} onOpenListings={onOpenListings}
              onSaveIdentity={onSaveIdentity} onInvalidateKyc={onInvalidateKyc} onSaveCoord={onSaveCoord} onSaveCriteria={onSaveCriteria} onSaveNote={onSaveNote} onDelete={onDelete}
              consent={consent} onDoNotContact={onDoNotContact} onInviteOptin={onInviteOptin} />
          </div>
          <div style={{ height: '100%', width: '100%', position: 'relative', overflow: 'hidden' }}>
            <CdBoucle P={P} dark={dark} loop={loop} links={links} firstName={fiche.firstName} freezeRef={freezeRef}
              onOpenMatching={onOpenMatching} onProposeVisit={onProposeVisit} onRevokeLink={onRevokeLink} />
          </div>
        </div>
        <CdDots page={page} onGo={goTo} P={P} labels={pageLabels} />
      </div>
    </main>
  )
}
