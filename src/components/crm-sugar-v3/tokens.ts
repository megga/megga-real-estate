// MEGGA CRM Sugar v3 — Design tokens (Sugar Pure direction)
// Port pixel-près de docs/handoff/sprint-1-kyc (README + MEGGA-DESIGN-SYSTEM.md).
//
// — Fond gris très clair avec radial gradient vers bleu pâle en bas
// — Cards blanches pures, ombres signature, coins 22-28px, AUCUNE bordure décorative
// — Accent unique = NOIR PUR #0B0C0E (pas de bleu, pas de violet, pas de gradient)
// — Typo Manrope avec tabular-nums sur tous les nombres
// — CHF avec apostrophes : CHF 1'250'000

import type { KycCheckCategory, KycDossierStatus } from '@/types/kyc'

export const SugarV3 = {
  // Fond — radial doux du clair vers bleu-gris pâle
  bg: '#EDEFF3',
  bgGradient:
    'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',

  // Surfaces
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',

  // Accent unique = NOIR PUR
  black: '#0B0C0E',
  blackHover: '#1F2024',

  // Texte
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  ghost: '#B5BAC2',

  // Ombres signature Sugar
  shadowSm: '0 4px 16px rgba(15, 23, 42, 0.04)',
  shadow: '0 12px 40px rgba(15, 23, 42, 0.06), 0 2px 8px rgba(15, 23, 42, 0.03)',
  shadowLg: '0 24px 60px rgba(15, 23, 42, 0.08), 0 4px 16px rgba(15, 23, 42, 0.04)',
  shadowHover: '0 32px 70px rgba(15, 23, 42, 0.10), 0 6px 20px rgba(15, 23, 42, 0.05)',

  // États (utilitaires uniquement, jamais décoratifs — micro-pastilles ≤7×7px)
  ok: '#10B981',
  warn: '#F59E0B',
  err: '#EF4444',
  okDark: '#0E9F6E', // utilisé pour le score risque faible dans CtKyc
  errDark: '#E53935',
  errDarker: '#B91C1C',

  // Backgrounds soft pour pastilles statut (jamais pour cards)
  okSoft: '#E5F4EC',
  warnSoft: '#FFF4E0',
  errSoft: 'rgba(239,68,68,0.10)',

  // Police
  font: 'Manrope, system-ui, sans-serif',
} as const

export type SugarV3Palette = typeof SugarV3

// ─── Animations keyframe (à injecter dans le DOM via <style>) ──────────
// Animation d'entrée signature Sugar : .5s cubic-bezier(.2,.8,.2,1) both
export const SUGAR_V3_KEYFRAMES = `
@keyframes sgFadeUp {
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

// ─── Formatters ─────────────────────────────────────────────────────────

/** Formate un nombre en CHF avec apostrophes suisses : `CHF 1'250'000`. */
export function fmtCHF(n: number | string | null | undefined): string {
  if (n == null || n === '') return ''
  const num = typeof n === 'number' ? n : parseInt(String(n).replace(/\D/g, ''), 10)
  if (Number.isNaN(num)) return ''
  return `CHF ${num.toLocaleString('fr-CH').replace(/[\u00A0\u202F,]/g, "'")}`
}

/** Formate une date en `12 avril 2026`. */
export function fmtDateLong(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  })
}

/** Formate une date en `12 avr. 2026`. */
export function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

/** Formate une date + heure : `12 avr · 14:30`. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('fr-CH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

// ─── Labels canoniques (handoff §Modèle de données) ─────────────────────

/** Les 5 contrôles LBA art. 3-7. */
export const KYC_CHECK_LABELS: Record<
  KycCheckCategory,
  { title: string; sub: string }
> = {
  id: {
    title: "Pièce d'identité",
    sub: "Passeport ou carte d'identité officielle, recto-verso.",
  },
  address: {
    title: 'Justificatif de domicile',
    sub: 'Facture nominative < 3 mois (loyer, électricité, banque).',
  },
  pep: {
    title: 'Screening PEP',
    sub: 'Vérification listes Personnes Exposées Politiquement.',
  },
  sanctions: {
    title: 'Listes de sanctions',
    sub: 'Croisement OFAC, SECO, ONU, Union Européenne.',
  },
  funds: {
    title: 'Source des fonds',
    sub: "Déclaration et preuve d'origine pour transactions > CHF 100'000.",
  },
}

/** Mapping canonique catégorie LBA → icône Sg. */
export const KYC_CHECK_ICONS: Record<KycCheckCategory, string> = {
  id: 'id',
  address: 'home',
  pep: 'flag',
  sanctions: 'ban',
  funds: 'coins',
}

/** Labels + pastilles colorées pour les 5 statuts dossier (handoff). */
export const KYC_STATUS_LABELS: Record<
  KycDossierStatus,
  { label: string; tone: string }
> = {
  none: { label: 'À démarrer', tone: SugarV3.muted },
  pending: { label: 'En cours', tone: SugarV3.warn },
  verified: { label: 'Vérifié', tone: SugarV3.ok },
  failed: { label: 'Échec', tone: SugarV3.err },
  stale: { label: 'À re-screener', tone: SugarV3.warn },
}

/** Labels risque 3 niveaux (handoff). */
export const KYC_RISK_LABELS: Record<
  'low' | 'medium' | 'high' | 'unassessed',
  { label: string; tone: string }
> = {
  low: { label: 'Risque faible', tone: SugarV3.ok },
  medium: { label: 'Risque modéré', tone: SugarV3.warn },
  high: { label: 'Risque élevé', tone: SugarV3.err },
  unassessed: { label: 'Non évalué', tone: SugarV3.muted },
}

/** Catégories audit nLPD — 8 valeurs (KYC_ENRICHISSEMENTS §7). */
export const AUDIT_CATEGORIES: Record<
  string,
  { label: string; tone: string }
> = {
  kyc: { label: 'KYC', tone: '#1E5BC6' },
  deal: { label: 'Pipeline', tone: '#0891B2' },
  contact: { label: 'Contact', tone: SugarV3.muted },
  bien: { label: 'Bien', tone: '#C45A00' },
  doc: { label: 'Document', tone: SugarV3.okDark },
  auth: { label: 'Connexion', tone: SugarV3.black },
  settings: { label: 'Réglages', tone: SugarV3.muted },
  ai: { label: 'MEGGA AI', tone: '#7A4FD8' },
}

/** Icônes audit par catégorie. */
export const AUDIT_CAT_ICONS: Record<string, string> = {
  kyc: 'shield',
  deal: 'pipeline',
  contact: 'contact',
  bien: 'home',
  doc: 'file',
  auth: 'lock',
  settings: 'cog',
  ai: 'sparkle',
}
