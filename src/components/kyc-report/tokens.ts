// MEGGA — Jetons du rapport KYC imprimé, « concept épuré » (handoff du 13.09.2026,
// `handoff-kyc-rapport-pdf/Rapport KYC A4 - Concept épuré.html`).
//
// Une seule encre, du blanc, quatre gris — et le filigrane de la marque. Aucune
// couleur sémantique : l'état d'un contrôle se lit dans le TEXTE (« 0 correspondance »,
// « À examiner »), jamais dans une pastille verte ou rouge. C'est ce qui rend le
// document lisible en photocopie noir et blanc, ce qu'un rapport LBA finit toujours
// par être.
//
// ── CE DOCUMENT EST DU PAPIER, ET ÇA SE LIT DANS SES CHIFFRES ────────────────
// `PDF_W`/`PDF_H` valent A4 à 96 DPI exactement : la mise en page est en pixels
// ABSOLUS qui valent des millimètres. C'est pourquoi ce dossier n'utilise aucun
// `var(--crm-…)` et reste hors du cliquet de COMPOSITION — ses tailles à 9 px et
// ses capitales espacées sont de la typographie d'imprimé, pas une survivance.
// La frontière est écrite et gardée : `tests/unit/kyc-report-frontiere.spec.ts`.

import type { CSSProperties } from 'react'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

export const PDF = {
  paper: MXC_COLOR.n1000,
  // ⛔ Le noir de Sugar (`#0B0C0E`) de la maquette part d'ici comme d'ailleurs :
  // sur papier blanc les deux sont un quasi-noir (20,6:1 contre 19,9:1) —
  // changement d'ALPHABET, pas de rendu.
  ink: MXC_COLOR.n100,
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  hair: '#E3E5EA', // règle de section
  hairRow: '#EEF0F3', // filet entre deux lignes de table
  /** Le bureau derrière les feuilles, à l'écran seulement (aperçu de l'agent). */
  desk: MXC_COLOR.n800,
} as const

// Dimensions A4 (format Print à 96 DPI) et marges internes de la maquette
export const PDF_W = 794
export const PDF_H = 1123
export const PDF_PAD_TOP = 64
export const PDF_PAD_X = 72
export const PDF_PAD_BOT = 56

export const PDF_FONT = 'Manrope, system-ui, sans-serif'
export const PDF_MONO = 'ui-monospace, SFMono-Regular, monospace'

/** Sur-titre en capitales espacées : libellés de définition, têtes de table, pied. */
export const PDF_LABEL: CSSProperties = {
  fontSize: 9,
  fontWeight: 700,
  letterSpacing: 1.3,
  textTransform: 'uppercase',
  color: PDF.muted,
}

// Helpers de formatage
const pad2 = (n: number) => String(n).padStart(2, '0')

export const fmtCHF = (amount: number | null | undefined): string => {
  if (amount == null || !Number.isFinite(amount)) return 'CHF —'
  return `CHF ${amount.toLocaleString('fr-CH').replace(/,/g, "'").replace(/\s/g, "'")}`
}

export const fmtDateSwiss = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()}`
}

export const fmtDateTimeSwiss = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${fmtDateSwiss(iso)} · ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
}

export const fmtBytes = (bytes: number | null | undefined): string => {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

/**
 * Tronque un hash hex en segments de 4 caractères : « 3f1a·b94c·e7d2·8051 ».
 * Un hash trop court pour le nombre de segments demandé est rendu tel quel.
 */
export const fmtHashShort = (hash: string | null | undefined, segments = 4, sep = '·'): string => {
  if (!hash) return '—'
  const clean = hash.replace(/[^a-f0-9]/gi, '').toLowerCase()
  if (clean.length < segments * 4) return clean || '—'
  const parts: string[] = []
  for (let i = 0; i < segments; i++) parts.push(clean.slice(i * 4, i * 4 + 4))
  return parts.join(sep)
}
