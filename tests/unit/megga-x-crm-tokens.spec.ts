/**
 * Garde-fou : les tokens « MEGGA X CRM » restent des barreaux RÉELS de la vitrine.
 *
 * `src/components/megga-x-crm/tokens.ts` recopie des valeurs au lieu de lire
 * `var(--main-spacers--…)`, parce que ces variables n'existent que sous le scope
 * `.megga-x` — inutilisable pour le CRM (canvas sombre imposé, reset Webflow,
 * ~260 Ko). La copie est le bon compromis, à une condition : qu'elle ne dérive
 * pas en silence. C'est ce que ce test vérifie.
 *
 * Il verrouille aussi les seuils de contraste, parce que le choix des barreaux
 * d'encre n'est PAS libre : `--neutral-colors--600` (#a3a3a3) tombe à 2,5:1 sur
 * blanc. Reprendre la DA sans descendre d'un cran en clair produit un CRM
 * illisible — le genre de régression qu'une relecture visuelle laisse passer.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import {
  MXC_COLOR, MXC_TYPE, MXC_RADIUS, MXC_SPACE, MXC_SYSTEM, MXC_CARD_SHADOW,
  mxCrmPalette, crmDa, DEFAULT_DA,
} from '@/components/megga-x-crm/tokens'
import { crmSugarPalette, sugarThemeTokens } from '@/components/crm-sugar/tokens'

const SHEET = 'src/styles/megga-x.generated.css'
const css = readFileSync(SHEET, 'utf-8')

/** `#ccc` et `white` sont des écritures valides : on compare des couleurs, pas des chaînes. */
function normalize(raw: string): string {
  const v = raw.trim().toLowerCase()
  if (v === 'white') return '#ffffff'
  if (v === 'black') return '#000000'
  const m = /^#([0-9a-f]{3})$/.exec(v)
  if (m) return `#${[...m[1]].map((c) => c + c).join('')}`
  return v
}

/** Toutes les valeurs déclarées pour un préfixe de variable, en pixels. */
function pxValues(prefix: string): number[] {
  const re = new RegExp(`--${prefix}--[a-z0-9-]+: *([0-9.]+)px`, 'g')
  return [...css.matchAll(re)].map((m) => Number(m[1]))
}

function cssVar(name: string): string | null {
  const m = new RegExp(`--${name}: *([^;]+)`).exec(css)
  return m ? normalize(m[1]) : null
}

/** Luminance relative WCAG. */
function luminance(hex: string): number {
  const h = normalize(hex).replace('#', '')
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

describe('MEGGA X CRM — les tokens sortent bien de la vitrine', () => {
  // Sans ça, une feuille vidée ou déplacée rendrait tous les tests suivants
  // vrais par vacuité.
  it('la feuille transcrite est lisible et fournie', () => {
    expect(css.length).toBeGreaterThan(100_000)
    expect(pxValues('main-spacers').length).toBeGreaterThan(10)
    expect(pxValues('main-border-radius').length).toBeGreaterThan(5)
  })

  it('chaque couleur est la variable de la vitrine', () => {
    const expected: Record<keyof typeof MXC_COLOR, string> = {
      n100: 'neutral-colors--100', n200: 'neutral-colors--200',
      n300: 'neutral-colors--300', n400: 'neutral-colors--400',
      n500: 'neutral-colors--500', n600: 'neutral-colors--600',
      n700: 'neutral-colors--700', n800: 'neutral-colors--800',
      n900: 'neutral-colors--900', n1000: 'neutral-colors--1000',
      accent: 'primary-colors--100',
    }
    for (const [token, variable] of Object.entries(expected)) {
      expect(cssVar(variable), `${variable} absente de la feuille`).not.toBeNull()
      expect(normalize(MXC_COLOR[token as keyof typeof MXC_COLOR]))
        .toBe(cssVar(variable))
    }
  })

  it('chaque couleur système est la variable de la vitrine', () => {
    const expected = {
      danger: 'system-colors--red-400',
      success: 'system-colors--green-400',
      warning: 'system-colors--yellow-400',
      info: 'system-colors--blue-400',
      systemInk: 'neutral-colors--100',
    } as const
    for (const [token, variable] of Object.entries(expected)) {
      expect(cssVar(variable), `${variable} absente`).not.toBeNull()
      expect(normalize(MXC_SYSTEM[token as keyof typeof MXC_SYSTEM])).toBe(cssVar(variable))
    }
  })

  it('chaque rayon est un barreau de --main-border-radius', () => {
    const rungs = new Set(pxValues('main-border-radius'))
    for (const v of Object.values(MXC_RADIUS)) expect(rungs).toContain(v)
  })

  it('chaque espacement est un barreau de --main-spacers', () => {
    const rungs = new Set(pxValues('main-spacers'))
    for (const v of Object.values(MXC_SPACE)) expect(rungs).toContain(v)
  })

  it('chaque taille de texte existe dans la feuille', () => {
    const sizes = new Set(
      [...css.matchAll(/font-size: *([0-9.]+)px/g)].map((m) => Number(m[1])),
    )
    for (const v of Object.values(MXC_TYPE)) expect(sizes).toContain(v)
  })

  it('l’ombre de carte est celle de .card-light-mode', () => {
    const m = /\.megga-x \.card-light-mode \{[^}]*box-shadow: *([^;]+);/.exec(css)
    expect(m, '.card-light-mode introuvable ou sans ombre').not.toBeNull()
    expect(MXC_CARD_SHADOW).toBe(m![1].trim())
  })
})

describe('MEGGA X CRM — la bascule de direction', () => {
  // C'est le point de bascule de TOUT le CRM : les 33 endroits qui construisent
  // la palette passent par cette fonction, et la transmettent ensuite en prop.
  // Si la délégation casse, rien ne bascule et rien ne le signale.
  it('crmSugarPalette délègue à MEGGA X quand la direction est basculée', () => {
    const t = sugarThemeTokens(true)
    const sugar = crmSugarPalette(t, true, undefined, 'sugar')
    const meggax = crmSugarPalette(t, true, undefined, 'meggax')

    expect(meggax).toEqual(mxCrmPalette(true))
    expect(meggax.accent).toBe(MXC_COLOR.accent)
    expect(sugar.accent).not.toBe(MXC_COLOR.accent)
  })

  // ⚠ On passe par `window.__meggaDa`, jamais par localStorage : sous ce Node
  // il n'est pas exposé dans jsdom (`graphite-scale.spec.ts` fait le même
  // constat). C'est de toute façon la source que `crmDa()` lit EN PREMIER.
  type WinDa = Window & { __meggaDa?: string }

  // Le comparateur doit pouvoir exiger Sugar même préférence basculée, sinon sa
  // colonne de référence suit le reste et les trois colonnes deviennent égales.
  it('la direction demandée explicitement l’emporte sur la préférence active', () => {
    const t = sugarThemeTokens(false)
    ;(window as WinDa).__meggaDa = 'meggax'
    try {
      expect(crmSugarPalette(t, false, undefined, 'sugar').accent).not.toBe(MXC_COLOR.accent)
      expect(crmSugarPalette(t, false).accent).toBe(MXC_COLOR.accent)
    } finally {
      delete (window as WinDa).__meggaDa
    }
  })

  // Le défaut est passé à MEGGA X le 9 août 2026. Ce test le VERROUILLE : un
  // retour à Sugar par inadvertance changerait l'apparence de tout le CRM sans
  // qu'aucune autre garde ne le signale.
  it('MEGGA X est la direction par défaut', () => {
    delete (window as WinDa).__meggaDa
    expect(crmDa()).toBe(DEFAULT_DA)
    expect(DEFAULT_DA).toBe('meggax')
  })

  // Sugar doit rester ENTIÈREMENT résolvable : un réglage déjà stocké dessus,
  // et la colonne de référence du comparateur, en dépendent.
  it('Sugar reste résolvable après la bascule du défaut', () => {
    const t = sugarThemeTokens(true)
    ;(window as WinDa).__meggaDa = 'sugar'
    try {
      expect(crmSugarPalette(t, true).accent).not.toBe(MXC_COLOR.accent)
      expect(crmSugarPalette(t, true).ramp).toBeDefined()
    } finally {
      delete (window as WinDa).__meggaDa
    }
  })
})

describe('MEGGA X CRM — les encres restent lisibles', () => {
  it('le texte passe l’AA sur son fond, dans les deux modes', () => {
    for (const dark of [false, true]) {
      const p = mxCrmPalette(dark)
      for (const key of ['ink', 'sub', 'soft'] as const) {
        expect(
          contrast(p[key], p.cardBg),
          `${key} sur cardBg en ${dark ? 'sombre' : 'clair'}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('le texte posé sur l’accent passe l’AA', () => {
    for (const dark of [false, true]) {
      const p = mxCrmPalette(dark)
      expect(contrast(p.accentInk, p.accent)).toBeGreaterThanOrEqual(4.5)
    }
  })

  // Le piège qui a motivé le seuil : c'est la valeur que la vitrine emploie
  // pour son texte secondaire, et elle est inutilisable en clair.
  it('n600 est bien disqualifié en clair — ce n’est pas un réglage arbitraire', () => {
    expect(contrast(MXC_COLOR.n600, MXC_COLOR.n1000)).toBeLessThan(4.5)
    expect(contrast(MXC_COLOR.n600, MXC_COLOR.n300)).toBeGreaterThanOrEqual(4.5)
  })

  // Le piège inverse du précédent : une couleur système posée en TEXTE plutôt
  // qu'en aplat. `danger` tombe alors à 3,1:1 sur blanc.
  it('les couleurs système passent l’AA en aplat, et danger échoue en texte sur blanc', () => {
    for (const key of ['danger', 'success', 'warning', 'info'] as const) {
      expect(contrast(MXC_SYSTEM.systemInk, MXC_SYSTEM[key]), `${key} en aplat`)
        .toBeGreaterThanOrEqual(4.5)
    }
    expect(contrast(MXC_SYSTEM.danger, MXC_COLOR.n1000)).toBeLessThan(4.5)
  })

  it('en sombre la séparation vient de la bordure, pas d’une ombre', () => {
    const p = mxCrmPalette(true)
    expect(p.shadow).toBe('none')
    expect(p.cardBorder).toBe(MXC_COLOR.n400)
  })
})
