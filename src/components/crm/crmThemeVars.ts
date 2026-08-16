/**
 * Repointe les variables de thème CRM sur une palette Sugar, en INLINE.
 *
 * À quoi ça sert : les pages portées depuis la coquille legacy (`AgentLayout`)
 * sont écrites en classes Tailwind SÉMANTIQUES — `text-theme-primary`,
 * `bg-theme-card`, `border-theme-border`. Ces classes se résolvent sur les
 * variables du document, restées au thème CRM. Posées sur un fond Sugar, leur
 * texte devient illisible : encre quasi noire sur page noire.
 *
 * Pourquoi en JS et non dans une feuille CSS : `admin-console.css` fait la même
 * chose pour la console, et son en-tête prévient que ses valeurs sont DUPLIQUÉES
 * à la main depuis `tokens.ts` — donc à resynchroniser à chaque évolution. Ici on
 * lit la palette directement : elle ne peut pas se désynchroniser.
 *
 * Appliqué sur le conteneur de la page, jamais sur `:root` : le reste du CRM
 * garde son thème.
 */
import type { CSSProperties } from 'react'
import type { CrmPalette } from './tokens'

/** `#0E1410` ou `rgb(14,20,16)` → `14 20 16`, forme attendue par les tokens. */
function toTriplet(color: string): string | null {
  const hex = color.trim().match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (hex) {
    const h = hex[1].length === 3 ? hex[1].split('').map((c) => c + c).join('') : hex[1]
    return `${parseInt(h.slice(0, 2), 16)} ${parseInt(h.slice(2, 4), 16)} ${parseInt(h.slice(4, 6), 16)}`
  }
  const rgb = color.match(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/i)
  return rgb ? `${rgb[1]} ${rgb[2]} ${rgb[3]}` : null
}

/**
 * Style à poser sur le conteneur d'une page portée.
 *
 * Les couleurs non convertibles (dégradés, `color-mix`, rgba composites) sont
 * SILENCIEUSEMENT ignorées : mieux vaut laisser la variable d'origine que
 * d'écrire une valeur que Tailwind ne saura pas composer avec son alpha.
 */
export function crmThemeVars(sp: CrmPalette, dark: boolean): CSSProperties {
  const map: Record<string, string> = {
    '--color-bg-page': sp.pageBg,
    '--color-bg-card': sp.cardBg,
    '--color-bg-section': sp.cardSubBg,
    '--color-bg-sidebar': sp.frameBg,
    '--color-bg-elevated': sp.cardBg,
    '--color-bg-input': sp.cardSubBg,
    '--color-border': sp.cardBorder,
    '--color-border-subtle': sp.frameBorder,
    '--color-text-primary': sp.ink,
    '--color-text-secondary': sp.soft,
    '--color-text-tertiary': sp.sub,
    '--color-text-muted': sp.sub,
    // Survol et actif n'ont pas d'équivalent dans la palette : un voile neutre
    // suffit, et il doit s'inverser avec le thème.
    '--color-bg-hover': dark ? '255 255 255' : '15 23 42',
    '--color-bg-active': dark ? '255 255 255' : '15 23 42',
  }

  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(map)) {
    if (!v) continue
    const triplet = k === '--color-bg-hover' || k === '--color-bg-active' ? v : toTriplet(v)
    if (triplet) out[k] = triplet
  }
  return out as CSSProperties
}
