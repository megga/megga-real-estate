// MEGGA — Tokens locaux pour le rapport PDF KYC (Sprint 4.4)
// Sugar Pure strict : surfaces blanches, ombres douces, noir comme accent unique.
// AUCUNE bordure décorative, AUCUN gradient AI, AUCUNE icône brain/sparkle.
//
// Adapté du modèle `megga-kyc-ai-analysis.jsx` (palette KAI), MAIS sans aucune
// mention IA / Sonnet (cf. décision produit : « zero AI » dans le PDF notaire).

export const PDF = {
  // Couleurs
  bg: '#EDEFF3',
  card: '#FFFFFF',
  cardSubtle: '#F7F8FA',
  cardDeep: '#F0F2F6',
  black: '#0B0C0E',
  ink: '#0B0C0E',
  inkSoft: '#3A3D44',
  muted: '#7A8088',
  hair: '#E7E9EE', // règle fine éditoriale
  hairStrong: '#D8DBE2',

  // Sémantiques (fonctionnelles uniquement)
  okBg: 'rgba(16,185,129,0.10)',
  okFg: '#0E9F6E',
  okDot: '#10B981',
  warnBg: 'rgba(245,158,11,0.10)',
  warnFg: '#B45309',
  warnDot: '#F59E0B',
  errBg: 'rgba(239,68,68,0.10)',
  errFg: '#B91C1C',
  errDot: '#EF4444',
} as const

// Dimensions A4 (format Print à 96 DPI)
export const PDF_W = 794
export const PDF_H = 1123
export const PDF_PAD_X = 56
export const PDF_PAD_TOP = 56
export const PDF_PAD_BOT = 56

// Helpers de formatage
export const pad2 = (n: number) => String(n).padStart(2, '0')

export const fmtCHF = (amount: number | null | undefined): string => {
  if (amount == null || !Number.isFinite(amount)) return 'CHF —'
  return `CHF ${amount.toLocaleString('fr-CH').replace(/,/g, "'").replace(/\s/g, "'")}`
}

export const fmtDateSwiss = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const day = pad2(d.getDate())
    const month = pad2(d.getMonth() + 1)
    const year = d.getFullYear()
    return `${day}.${month}.${year}`
  } catch {
    return '—'
  }
}

export const fmtDateTimeSwiss = (iso: string | null | undefined): string => {
  if (!iso) return '—'
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    const date = fmtDateSwiss(iso)
    const h = pad2(d.getHours())
    const m = pad2(d.getMinutes())
    return `${date} · ${h}:${m}`
  } catch {
    return '—'
  }
}

export const fmtBytes = (bytes: number | null | undefined): string => {
  if (bytes == null || !Number.isFinite(bytes) || bytes <= 0) return '—'
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`
  return `${(bytes / 1024 / 1024).toFixed(1)} Mo`
}

/** Tronque un hash SHA-256 en 4 segments de 4 caractères style "3f1a·b94c·e7d2·8051". */
export const fmtHashShort = (hash: string | null | undefined, segments = 4): string => {
  if (!hash) return '—'
  const clean = hash.replace(/[^a-f0-9]/gi, '').toLowerCase()
  if (clean.length < segments * 4) return clean || '—'
  const parts: string[] = []
  for (let i = 0; i < segments; i++) parts.push(clean.slice(i * 4, i * 4 + 4))
  return parts.join('·')
}

/** Tronque un hash en 6 segments pour le bloc "attestation finale". */
export const fmtHashLong = (hash: string | null | undefined): string => fmtHashShort(hash, 6)
