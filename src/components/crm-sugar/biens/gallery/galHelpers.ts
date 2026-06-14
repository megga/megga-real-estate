// MEGGA CRM Sugar v2 — Mes biens · Galerie — helpers
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx).
// Surfaces Sugar Pure (blanc opaque en clair, verre subtil en sombre) +
// pilule de statut « façon KYC » (fond plein opaque + texte blanc).

import type { SugarPalette } from '../../tokens'

/** « CHF 850'000 » — apostrophe suisse, valeur pleine (cartes). */
export function galFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return (
    'CHF ' +
    Math.round(n)
      .toLocaleString('fr-CH')
      .replace(/ /g, "'")
      .replace(/[\s,]/g, "'")
  )
}

/** « 7.26M » / « 4.4k » — compaction pour les KPI. */
export function galCompact(n: number | null | undefined): string {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(n >= 1e7 ? 1 : 2).replace(/\.?0+$/, '') + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(n >= 1e4 ? 0 : 1).replace(/\.0$/, '') + 'k'
  return '' + n
}

/** Entier formaté FR-CH avec apostrophe suisse. */
export function galNum(n: number | null | undefined): string {
  return (n || 0)
    .toLocaleString('fr-CH')
    .replace(/ /g, "'")
    .replace(/[\s,]/g, "'")
}

export interface GalStatusMeta {
  label: string
  tone: string
}

/** Statut → libellé + ton (couleur fonctionnelle, adaptatif clair/sombre). */
export function galStatus(s: string, dark: boolean): GalStatusMeta {
  const map: Record<string, GalStatusMeta> = {
    active: { label: 'Actif', tone: dark ? '#0E9F6E' : '#059669' },
    reserved: { label: 'Réservé', tone: dark ? '#D97A1E' : '#C45A00' },
    draft: { label: 'Brouillon', tone: '#6B7280' },
    paused: { label: 'En pause', tone: dark ? '#7C8593' : '#7A8088' },
    sold: { label: 'Vendu', tone: dark ? '#E5E7EB' : '#0B0C0E' },
  }
  return map[s] || map.draft
}

export interface GalSurfaces {
  card: string
  cardSub: string
  hairline: string
  shadow: string
  shadowHov: string
}

/** Surfaces Sugar Pure dérivées : blanc pur (clair) / verre subtil (sombre). */
export function galSurfaces(_sp: SugarPalette, dark: boolean): GalSurfaces {
  return {
    card: dark ? 'rgba(255,255,255,0.05)' : '#FFFFFF',
    cardSub: dark ? 'rgba(255,255,255,0.04)' : '#F4F6F9',
    hairline: dark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(15,23,42,0.05)',
    shadow: dark
      ? '0 1px 2px rgba(0,0,0,.4), 0 10px 28px -12px rgba(0,0,0,.6)'
      : '0 1px 2px rgba(15,23,42,.04), 0 12px 34px -14px rgba(40,55,90,.20)',
    shadowHov: dark
      ? '0 1px 2px rgba(0,0,0,.5), 0 24px 50px -16px rgba(0,0,0,.7)'
      : '0 2px 6px rgba(15,23,42,.05), 0 26px 52px -18px rgba(40,55,90,.32)',
  }
}
