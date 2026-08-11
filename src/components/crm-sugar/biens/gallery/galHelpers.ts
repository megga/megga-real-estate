// MEGGA CRM Sugar v2 — Mes biens · Galerie — helpers
// Port fidèle du handoff Claude Design (crm-screen-biens-galerie.jsx).
// Surfaces Sugar Pure (blanc opaque en clair, verre subtil en sombre) +
// pilule de statut « façon KYC » (fond plein opaque + texte blanc).
//
// i18n : galStatus produit un libellé d'affichage consommé par GalStatusPill.
// On lit la langue via l'instance i18n singleton (cf helpers.ts / bnStatus) —
// pas de changement de signature, donc pas de modif des sites d'appel.

import i18n from '@/i18n'
import type { SugarPalette } from '../../tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'

/** « CHF 850'000 » — apostrophe suisse, valeur pleine (cartes). */
export function galFmtCHF(n: number | null | undefined): string {
  if (n == null) return '—'
  return (
    'CHF ' +
    Math.round(n)
      .toLocaleString('fr-CH')
      // fr-CH sépare les milliers par U+202F, déjà couvert par \s.
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


export interface GalStatusMeta {
  label: string
  tone: string
}

/** Statut → libellé + ton (couleur fonctionnelle, adaptatif clair/sombre). */
export function galStatus(s: string, dark: boolean): GalStatusMeta {
  // Tons fonctionnels stables ; le libellé est traduit via listings:status.*.
  const tones: Record<string, string> = {
    active: dark ? '#0E9F6E' : '#059669',
    reserved: dark ? '#D97A1E' : '#C45A00',
    draft: '#6B7280',
    paused: dark ? '#7C8593' : '#7A8088',
    sold: dark ? MXC_COLOR.n800 : MXC_COLOR.n100,
  }
  const tone = tones[s] ?? tones.draft
  return { label: i18n.t('listings:status.' + s, { defaultValue: s }), tone }
}

export interface GalSurfaces {
  card: string
  cardSub: string
  hairline: string
  shadow: string
  shadowHov: string
}

/**
 * Surfaces MEGGA X — dérivées de la palette, séparation par BORDURE.
 *
 * En sombre elle abandonne l'écart de luminance de Graphite (1,078:1
 * canvas↔carte) pour celui de MEGGA X (1,036:1) et compense au filet : ce n'est
 * pas un échange de couleurs, c'est un changement de mode de séparation.
 *
 * Elle a remplacé `galSurfaces`, qui IGNORAIT le `sp` reçu et posait ses propres
 * surfaces Sugar Pure. Celle-ci n'a plus de consommateur et a été retirée.
 */
export function mxSurfaces(sp: SugarPalette): GalSurfaces {
  return {
    card: sp.cardBg,
    cardSub: sp.cardSubBg,
    hairline: `1px solid ${sp.cardBorder}`,
    shadow: sp.shadow,
    shadowHov: sp.shadow,
  }
}

