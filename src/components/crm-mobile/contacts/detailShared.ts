// Helpers partagés de la fiche contact détail mobile (P8/2) — purs, sans JSX.
// Mappings honnêtes : la donnée vient des hooks réels (useContact snake_case,
// useKycDossierByContact, useContactTimeline, useMatching), rien n'est fabriqué.

import type { Contact, SearchCriteria } from '@/types/contact'
import type { KycDossierStatus } from '@/types/kyc'
import type { MobileTokens } from '../tokens'
import { formatCHF } from '@/lib/utils'

// ─── Avatar (même hachage déterministe que la liste P8/1) ─────────────────
const AV = ['#0041D9', '#C45A00', '#0891B2', '#6366F1', '#0E9F6E', '#9333EA']
export function avatarColor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AV[Math.abs(h) % AV.length]
}

export function initialsOf(c: Pick<Contact, 'first_name' | 'last_name'>): string {
  return `${(c.first_name || ' ')[0]}${(c.last_name || ' ')[0]}`.toUpperCase()
}

// ─── Source → clé i18n (fallback = valeur brute) ──────────────────────────
const KNOWN_SOURCES = new Set([
  'manual', 'website', 'referral', 'onboarding', 'csv', 'call', 'walk-in', 'vcard', 'ai',
])
/** Renvoie { key, raw } : le composant fait t(key, { defaultValue: raw }). */
export function sourceLabel(source: string | null): { key: string; raw: string } {
  const raw = source ?? ''
  const norm = raw.toLowerCase()
  if (KNOWN_SOURCES.has(norm)) return { key: `mobile.detail.source.${norm}`, raw }
  return { key: `mobile.detail.source._raw`, raw }
}

// ─── KYC (rappel doux, JAMAIS bloquant — CLAUDE.md) ───────────────────────
export interface KycMeta {
  /** Clé i18n du libellé d'état. */
  labelKey: string
  /** true => bandeau vert + sceau ; false => bandeau immersif neutre, jamais rouge. */
  verified: boolean
  /** Fond du bandeau : vert si vérifié, surface immersive sinon (sombre clair+sombre). */
  band: (tk: MobileTokens) => string
  /** Encre du libellé sur le bandeau (contraste garanti clair ET sombre). */
  ink: (tk: MobileTokens) => string
  /** Encre atténuée du sous-titre sur le bandeau. */
  subInk: (tk: MobileTokens) => string
}

/**
 * État KYC → présentation douce. `failed`/`stale` restent NEUTRES (surface
 * immersive), jamais alarmants : le KYC MEGGA est un assist facultatif qui ne
 * bloque aucune action. Le bandeau non-vérifié réutilise `relanceBg/Ink`
 * (signature Sugar, foncé dans les deux thèmes) pour un contraste correct.
 */
export function kycMeta(status: KycDossierStatus): KycMeta {
  const verified = status === 'verified'
  return {
    labelKey: `mobile.detail.kyc.status.${status}`,
    verified,
    band: (tk) => (verified ? '#059669' : tk.relanceBg),
    ink: (tk) => (verified ? '#FFFFFF' : tk.relanceInk),
    subInk: (tk) => (verified ? 'rgba(255,255,255,0.85)' : tk.relanceMuted),
  }
}

// ─── Critères de recherche (snake_case réel → chips lisibles) ─────────────
const SALE_TYPES = new Set(['vente', 'sale', 'buy', 'achat'])
const RENT_TYPES = new Set(['location', 'rent', 'louer', 'rental'])

export interface CriteriaChip {
  /** Clé i18n si dérivée d'une valeur connue, sinon null (utiliser `text`). */
  key: string | null
  text: string
}

/** Construit les chips résumant `search_criteria` (omet les champs vides). */
const PROP_TYPE_FR: Record<string, string> = {
  apartment: 'Appartement', appartement: 'Appartement', house: 'Maison', maison: 'Maison',
  villa: 'Villa', land: 'Terrain', terrain: 'Terrain', commercial: 'Commercial',
}

export function criteriaChips(sc: SearchCriteria): CriteriaChip[] {
  const chips: CriteriaChip[] = []
  // Transaction = `transaction_type` (rent/buy, forme canonique) ; repli legacy
  // sur un `type` transactionnel (anciennes données). Le `type` sert au type de
  // BIEN (apartment/house…), pas à la transaction — ne pas confondre.
  const txSource = (sc.transaction_type ?? '').toLowerCase()
  const legacyTx = sc.type ? sc.type.toLowerCase() : ''
  if (SALE_TYPES.has(txSource) || SALE_TYPES.has(legacyTx)) chips.push({ key: 'mobile.detail.criteria.buy', text: '' })
  else if (RENT_TYPES.has(txSource) || RENT_TYPES.has(legacyTx)) chips.push({ key: 'mobile.detail.criteria.rent', text: '' })
  // Type de bien (uniquement si `type` n'est pas une valeur transactionnelle legacy).
  if (sc.type) {
    const norm = sc.type.toLowerCase()
    if (!SALE_TYPES.has(norm) && !RENT_TYPES.has(norm)) {
      chips.push({ key: null, text: PROP_TYPE_FR[norm] ?? sc.type })
    }
  }
  const zones = (sc.zones ?? []).filter(Boolean)
  if (zones.length) chips.push({ key: null, text: zones.join(', ') })
  if (sc.budget_min != null || sc.budget_max != null) {
    chips.push({ key: null, text: `${formatCHF(sc.budget_min ?? 0)} - ${formatCHF(sc.budget_max ?? 0)}` })
  }
  if (sc.rooms_min != null) chips.push({ key: null, text: `${sc.rooms_min}+ p.` })
  if (sc.surface_min != null) chips.push({ key: null, text: `${sc.surface_min}+ m²` })
  return chips
}

/** True si les critères contiennent au moins un champ exploitable. */
export function hasCriteria(sc: SearchCriteria | null | undefined): sc is SearchCriteria {
  if (!sc) return false
  return Boolean(
    sc.type ||
      (sc.zones && sc.zones.length) ||
      sc.budget_min != null ||
      sc.budget_max != null ||
      sc.rooms_min != null ||
      sc.surface_min != null ||
      (sc.features && sc.features.length),
  )
}

// ─── Timeline (action réelle → catégorie + ton) ───────────────────────────
export interface TimelineCat {
  labelKey: string
  /** null => utiliser tk.muted (le composant a accès aux tokens). */
  tone: string | null
}

/** Mappe une `action` d'activity_events vers une catégorie i18n + ton pastille. */
export function timelineCat(action: string): TimelineCat {
  const a = (action || '').toLowerCase()
  if (a.includes('call')) return { labelKey: 'mobile.detail.timeline.cat.call', tone: '#0891B2' }
  if (a.includes('whatsapp') || a.includes('message') || a.includes('msg'))
    return { labelKey: 'mobile.detail.timeline.cat.message', tone: '#1E5BC6' }
  if (a.includes('email') || a.includes('mail'))
    return { labelKey: 'mobile.detail.timeline.cat.email', tone: null }
  if (a.includes('visit')) return { labelKey: 'mobile.detail.timeline.cat.visit', tone: '#C45A00' }
  if (a.includes('document') || a.includes('doc') || a.includes('file'))
    return { labelKey: 'mobile.detail.timeline.cat.document', tone: '#059669' }
  if (a.includes('kyc')) return { labelKey: 'mobile.detail.timeline.cat.kyc', tone: '#1E5BC6' }
  if (a.includes('match')) return { labelKey: 'mobile.detail.timeline.cat.match', tone: '#1E5BC6' }
  if (a.includes('offer')) return { labelKey: 'mobile.detail.timeline.cat.offer', tone: '#C45A00' }
  if (a.includes('stage') || a.includes('pipeline') || a.includes('deal') || a.includes('transaction'))
    return { labelKey: 'mobile.detail.timeline.cat.stage', tone: '#1E5BC6' }
  if (a.includes('create') || a.includes('created'))
    return { labelKey: 'mobile.detail.timeline.cat.created', tone: null }
  if (a.includes('note')) return { labelKey: 'mobile.detail.timeline.cat.note', tone: null }
  return { labelKey: 'mobile.detail.timeline.cat.activity', tone: null }
}

/** Action brute → titre lisible (cohérent avec le desktop qui affiche l'action). */
export function prettifyAction(action: string): string {
  const s = (action || '').replace(/[_.]+/g, ' ').trim()
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''
}

// ─── Matching (statut réel → libellé + ton) ───────────────────────────────
const MATCH_STATUS_TONE: Record<string, string | null> = {
  suggested: null,
  sent: '#7A8088',
  visit_planned: '#1E5BC6',
  interested: '#059669',
  rejected: '#8E1F3D',
  ignored: null,
}
export function matchStatus(status: string): { labelKey: string; tone: string | null } {
  return {
    labelKey: `mobile.detail.matching.status.${status}`,
    tone: status in MATCH_STATUS_TONE ? MATCH_STATUS_TONE[status] : null,
  }
}

// ─── Date courte localisée (jour + mois) ──────────────────────────────────
function localeOf(lang: string): string {
  return lang === 'fr' ? 'fr-CH' : lang === 'de' ? 'de-CH' : lang === 'it' ? 'it-CH' : 'en-GB'
}

export function fmtDay(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(localeOf(lang), { day: '2-digit', month: 'short' })
  } catch {
    return ''
  }
}

/** Date complète DD.MM.YYYY (style suisse) localisée. */
export function fmtDateFull(iso: string, lang: string): string {
  try {
    return new Date(iso).toLocaleDateString(localeOf(lang), {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  } catch {
    return ''
  }
}
