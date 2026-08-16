/**
 * Jetons de la modale « Nouveau deal » — dérivés de MEGGA X.
 *
 * ⛔ Troisième palette parallèle du périmètre, et la seule qui était DÉJÀ une
 * fonction de `CrmPalette` — mais qui n'en tirait que l'accent : ses seize
 * autres valeurs étaient écrites à la main, dont le noir Sugar `#0A0A0F` en
 * fond sombre et `rgba(11,12,14,0.07)` en filet.
 *
 * ⚠ Elle sort du fichier de composant pour la même raison mécanique que les
 * deux autres : une modale qui exporte sa palette fait rougir `react-refresh`,
 * et une palette qu'on ne peut pas importer ne peut pas être gardée.
 */
import { encreSur } from '@/components/megga-x-crm/tokens'
import type { CrmPalette } from '../tokens'

export interface NdPalette {
  bg: string
  card: string
  cardSubtle: string
  cardBorder?: string
  /** L'élément ACTIF porte l'accent — CTA de création, pilule d'étape choisie. */
  accent: string
  accentHover: string
  accentInk: string
  ink: string
  inkSoft: string
  muted: string
  /** Aplat DÉSACTIVÉ — porte du texte, son encre se dérive. */
  ghost: string
  line: string
  /** Confirmation de création : un ÉTAT, donc une teinte sémantique nommée. */
  green: string
  onGreen: string
  shadow: string
  shadowLg: string
}

/** `--color-success-dark` de `globals.css` — la valeur que le dépôt possède. */
const OK = { clair: '#047857', sombre: '#34D399' }

export function ndPalette(dark: boolean, sp: CrmPalette): NdPalette {
  const vert = dark ? OK.sombre : OK.clair
  return {
    bg: sp.pageBg,
    card: sp.cardBg,
    cardSubtle: sp.cardSubBg,
    cardBorder: sp.cardBorder,
    accent: sp.accent,
    accentHover: dark ? '#5961fb' : '#3a42dd',
    accentInk: sp.accentInk,
    ink: sp.ink,
    inkSoft: sp.soft,
    muted: sp.sub,
    ghost: dark ? sp.focusSurface : sp.cardBorder,
    line: sp.cardBorder,
    green: vert,
    onGreen: encreSur(vert),
    shadow: sp.shadow,
    shadowLg: sp.shadow,
  }
}
