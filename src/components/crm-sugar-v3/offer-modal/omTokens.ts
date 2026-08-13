/**
 * Jetons de la MODALE OFFRE / CONTRE-OFFRE — dérivés de MEGGA X.
 *
 * ⛔ MÊME DETTE QUE LA FICHE DEAL, EN PLUS LOURD : vingt valeurs figées
 * (`OM_LIGHT` / `OM_DARK`) recopiées de l'échelle grise de SugarV3, dont le noir
 * Sugar sous ses DEUX alphabets — `#0B0C0E` en encre, `rgba(10,11,13,…)` dans le
 * récapitulatif inversé — et le gris-bleu slate-900 dans les trois ombres.
 *
 * ⚠ Cette modale n'importe RIEN de `SugarV3` : ni jeton, ni palette. Le plan la
 * rangeait sous « recibler SugarV3 » ; elle portait en fait son propre système.
 *
 * ⛔ `black` A ÉTÉ RETIRÉ, pas renommé : mesuré, ZÉRO usage. Un jeton mort dans
 * une palette est pire qu'inutile — il donne une valeur à recopier.
 */
import { encreSur } from '@/components/megga-x-crm/tokens'
import type { SugarPalette } from '@/components/crm-sugar/tokens'

export interface OmPalette {
  bg: string
  card: string
  cardSubtle: string
  cardBorder: string | null
  ink: string
  inkSoft: string
  muted: string
  /** Aplat DÉSACTIVÉ — porte du texte, donc son encre se dérive. */
  ghost: string
  /**
   * ⛔ L'ÉLÉMENT ACTIF PORTE L'ACCENT (10 août 2026). Deux surfaces ici :
   * le CTA « Enregistrer » et la condition suspensive COCHÉE. Les autres aplats
   * sombres de cette modale — le numéro de section, le récapitulatif — ne sont
   * pas des états actifs : ils structurent, ils gardent l'encre.
   */
  accent: string
  accentHover: string
  accentInk: string
  /** Encre posée sur un aplat d'ENCRE (numéro de section, récapitulatif). */
  onInk: string
  /** Récapitulatif inversé : voiles de l'encre POSÉE sur l'aplat d'encre. */
  recapMut: string
  recapMut2: string
  recapLine: string
  swapBg: string
  shadowSm: string
  shadow: string
  shadowLg: string
  ok: string
  warn: string
  err: string
}

/** Voir `dealTokens` : ce sont les `--color-*-dark` de `globals.css`. */
const OK = { clair: '#047857', sombre: '#34D399' }
const WARN = { clair: '#F59E0B', sombre: '#FBBF24' }
const ERR = { clair: '#B91C1C', sombre: '#F87171' }

export function omPalette(dark: boolean, sp: SugarPalette): OmPalette {
  // Le récapitulatif est peint sur un aplat d'ENCRE : ses voiles descendent donc
  // de l'encre qui s'y pose, pas d'un blanc ou d'un noir écrit à la main.
  const surEncre = encreSur(sp.ink)
  const voile = (alpha: number) =>
    surEncre === '#ffffff' ? `rgba(255,255,255,${alpha})` : `rgba(3,3,3,${alpha})`

  return {
    bg: sp.pageBg,
    card: sp.cardBg,
    cardSubtle: sp.cardSubBg,
    cardBorder: sp.cardBorder,
    ink: sp.ink,
    inkSoft: sp.soft,
    muted: sp.sub,
    ghost: dark ? sp.focusSurface : sp.cardBorder,
    accent: sp.accent,
    accentHover: dark ? '#5961fb' : '#3a42dd',
    accentInk: sp.accentInk,
    onInk: surEncre,
    recapMut: voile(0.6),
    recapMut2: voile(0.72),
    recapLine: voile(0.14),
    swapBg: sp.solidBgSub,
    shadowSm: sp.shadowSm,
    shadow: sp.shadow,
    shadowLg: sp.shadow,
    ok: dark ? OK.sombre : OK.clair,
    warn: dark ? WARN.sombre : WARN.clair,
    err: dark ? ERR.sombre : ERR.clair,
  }
}
