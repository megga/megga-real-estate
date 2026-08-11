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
import { readdirSync, readFileSync } from 'node:fs'
import {
  MXC_COLOR, MXC_CARD_SHADOW, MXC_SYSTEM, mxCrmPalette,
} from '@/components/megga-x-crm/tokens'
import { pfAccents, pfColors } from '@/components/crm-sugar/settings/focus/pfKitCore'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { applySetTheme, isSetDark, SET_PALETTE } from '@/components/crm-sugar/settings/data'

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
      accentGreen: 'primary-colors--200', accentCyan: 'primary-colors--300',
    }
    for (const [token, variable] of Object.entries(expected)) {
      expect(cssVar(variable), `${variable} absente de la feuille`).not.toBeNull()
      expect(normalize(MXC_COLOR[token as keyof typeof MXC_COLOR]))
        .toBe(cssVar(variable))
    }
  })

  it('chaque couleur de système est la variable de la vitrine', () => {
    const expected: Record<keyof typeof MXC_SYSTEM, string> = {
      blue300: 'system-colors--blue-300',
      yellow400: 'system-colors--yellow-400',
      green300: 'system-colors--green-300', green400: 'system-colors--green-400',
      red400: 'system-colors--red-400',
    }
    for (const [token, variable] of Object.entries(expected)) {
      expect(cssVar(variable), `${variable} absente de la feuille`).not.toBeNull()
      expect(normalize(MXC_SYSTEM[token as keyof typeof MXC_SYSTEM]))
        .toBe(cssVar(variable))
    }
  })

  it('l’ombre de carte est celle de .card-light-mode', () => {
    const m = /\.megga-x \.card-light-mode \{[^}]*box-shadow: *([^;]+);/.exec(css)
    expect(m, '.card-light-mode introuvable ou sans ombre').not.toBeNull()
    expect(MXC_CARD_SHADOW).toBe(m![1].trim())
  })
})

/**
 * La grammaire qui REND vit dans `globals.css`, pas dans un objet JS. Elle a
 * transité par le module de tokens tant que les pages de comparaison la
 * consommaient ; elles retirées, ce bloc est la seule déclaration — donc le
 * seul endroit qui vaille d'être gardé.
 */
describe('MEGGA X CRM — la grammaire déclarée en CSS', () => {
  // Elle vivait dans un bloc `[data-crm-da="meggax"]` qui surchargeait une
  // échelle Sugar. La direction retirée, elle est déclarée directement dans
  // `:root` — il n'y a donc plus qu'UN site de déclaration par barreau.
  const globals = readFileSync('src/styles/globals.css', 'utf-8')

  /** Valeurs en px déclarées, par famille de barreau. */
  function rungs(family: 'text' | 'radius' | 'space'): number[] {
    const re = new RegExp(`--crm-${family}-[a-z0-9]+: *([0-9.]+)px`, 'g')
    return [...globals.matchAll(re)].map((m) => Number(m[1]))
  }

  it('les trois familles sont déclarées, et une seule fois chacune', () => {
    expect(rungs('text').length).toBe(13)
    expect(rungs('radius').length).toBe(12)
    expect(rungs('space').length).toBe(12)
    // Pas de SÉLECTEUR de direction (la note historique en commentaire reste),
    // et plus d'alias : ils n'existaient que pour redonner Sugar à un sous-arbre.
    expect(globals).not.toMatch(/\[data-crm-da="[a-z]+"\]\s*\{/)
    expect(globals).not.toMatch(/--crm-sugar-[a-z0-9-]+:/)
  })

  /**
   * Les trois tests qui suivent figent les ÉCARTS plutôt que de les interdire :
   * en ajouter un demande de l'écrire ici, donc d'en décider. Ils couvrent
   * désormais l'échelle ENTIÈRE — tant que la grammaire vivait dans un bloc de
   * surcharge, ils n'en voyaient que les 16 barreaux surchargés.
   */
  it('les espacements sortent TOUS de la vitrine', () => {
    const source = new Set(pxValues('main-spacers'))
    for (const v of rungs('space')) expect(source, `espacement ${v}px`).toContain(v)
  })

  // Écarts assumés : 2 et 4 px sont des micro-rayons (pastilles, cases à
  // cocher) que la vitrine n'a pas besoin de nommer, et 999 est la convention
  // « pilule », pas une mesure.
  it('les rayons ne s’écartent que sur les micro-rayons et la pilule', () => {
    const source = new Set(pxValues('main-border-radius'))
    const hors = rungs('radius').filter((v) => !source.has(v)).sort((a, b) => a - b)
    expect(hors).toEqual([2, 4, 999])
  })

  // ⚠ Le TEXTE s'écarte sur 11 et 13 px : la vitrine n'en a ni l'un ni l'autre
  // (ses tailles sautent 10 → 12 → 14), et le CRM a besoin de ces demi-pas pour
  // monter d'un cran sans doubler la hauteur de ses lignes. 34 px est un
  // barreau d'AFFICHAGE ajouté pour 5 emplois répétés — une valeur répétée à
  // cette fréquence est de la grammaire, pas un cas particulier.
  it('le texte ne s’écarte que sur 11, 13 et 34 px', () => {
    const source = new Set(
      [...css.matchAll(/font-size: *([0-9.]+)px/g)].map((m) => Number(m[1])),
    )
    const hors = rungs('text').filter((v) => !source.has(v)).sort((a, b) => a - b)
    expect(hors).toEqual([11, 13, 34])
  })
})

describe('MEGGA X CRM — la palette du CRM', () => {
  // 33 endroits construisent la palette et la transmettent en prop. C'est le
  // point unique : si la dérivation casse, tout le CRM se dépeint d'un coup.
  it('crmSugarPalette rend exactement MEGGA X', () => {
    for (const dark of [false, true]) {
      expect(crmSugarPalette(dark)).toEqual(mxCrmPalette(dark))
    }
    expect(crmSugarPalette(false).accent).toBe(MXC_COLOR.accent)
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

  it('en sombre la séparation vient de la bordure, pas d’une ombre', () => {
    const p = mxCrmPalette(true)
    expect(p.shadow).toBe('none')
    expect(p.cardBorder).toBe(MXC_COLOR.n400)
  })
})

/**
 * La palette des Réglages — deuxième point de délégation.
 *
 * `SET_PALETTE` est le seul jeu de couleurs du CRM que `crmSugarPalette()` ne
 * couvrait pas : Intégrations, Sécurité, les atomes et les modales le lisent
 * directement (~280 lectures). Il délègue désormais lui aussi, ce qui déplace
 * la question du « est-ce que ça bascule » vers « est-ce que ça bascule JUSTE ».
 */
describe('MEGGA X CRM — palette des Réglages', () => {
  it('rend l’accent de la vitrine, jamais le noir de Sugar Pure', () => {
    for (const dark of [false, true]) {
      applySetTheme(dark)
      expect(SET_PALETTE.black).toBe(MXC_COLOR.accent)
      expect(SET_PALETTE.blackInk).toBe(mxCrmPalette(dark).accentInk)
      // Le survol doit se distinguer de l'accent sans virer à une autre couleur.
      expect(SET_PALETTE.blackHover).not.toBe(SET_PALETTE.black)
    }
  })

  it('fait voyager la bordure de carte dans l’ombre', () => {
    // Les cartes montent `boxShadow: SET.shadow` avec `border: 0` : c'est le
    // seul canal par lequel le filet `#cccccc` de la vitrine peut arriver.
    applySetTheme(false)
    expect(SET_PALETTE.shadow).toContain(`inset 0 0 0 1px ${MXC_COLOR.n700}`)
    expect(SET_PALETTE.shadow).toContain(MXC_CARD_SHADOW)

    applySetTheme(true)
    expect(SET_PALETTE.shadow).toContain(`inset 0 0 0 1px ${MXC_COLOR.n400}`)
    // En sombre la vitrine sépare par la bordure SEULE — pas d'ombre à ajouter.
    expect(SET_PALETTE.shadow).not.toContain(MXC_CARD_SHADOW)
  })

  it('ne laisse aucune surface Graphite en sombre', () => {
    applySetTheme(true)
    const surfaces = [SET_PALETTE.bg, SET_PALETTE.card, SET_PALETTE.cardSubtle, SET_PALETTE.heroBg]
    const mx = Object.values(MXC_COLOR) as string[]
    for (const s of surfaces) expect(mx).toContain(s)
  })


  /**
   * Le piège qui a coûté le héros de Sécurité : `isDark()` y valait
   * `SET.card === SET_DARK.card`. Ce test d'identité ne tenait que tant que les
   * palettes possibles étaient deux ; MEGGA X en construit une troisième, dont
   * aucune valeur ne coïncide avec `SET_DARK` — le témoin rendait donc `false`
   * en sombre, et le héros repassait au noir de plein jour.
   */
  it('expose le thème appliqué sans passer par l’identité des valeurs', () => {
    applySetTheme(true)
    expect(isSetDark()).toBe(true)
    applySetTheme(false)
    expect(isSetDark()).toBe(false)
  })

})

/**
 * Les remplissages pleins du kit « Focus » (badge vérifié, chip à renseigner,
 * pilule enregistré, pastille d'action sur l'avatar).
 *
 * Le point dur n'est pas la teinte, c'est l'ENCRE : les couleurs de la vitrine
 * sont réglées pour un canvas `#030303`, donc pâles. Sous une encre blanche
 * elles tombent à 1,7:1. Les tests ci-dessous existent pour qu'un ajout de
 * remplissage ne puisse pas réintroduire ce couple.
 */
describe('MEGGA X CRM — remplissages du kit Focus', () => {
  const SP = mxCrmPalette(false)
  const SURF = { card: '#fff', cardSub: '#f9f9f9', hairline: '1px solid #ccc', shadow: 'none' }
  const colors = (dark: boolean) =>
    pfColors(dark ? mxCrmPalette(true) : SP, SURF as never, dark)
  // `tag` — la pilule jaune « À renseigner » — a été retiré le 11 août 2026 :
  // il doublait le verbe du bouton d'à côté (« Ajouter » ne s'affiche que sur un
  // champ vide). Ce qu'il gardait ici reste vrai des trois autres.
  const FILLS = ['seal', 'saved', 'affordance'] as const

  it('l’encre tient sur son remplissage, dans les deux modes', () => {
    for (const dark of [false, true]) {
      const c = colors(dark)
      for (const role of FILLS) {
        expect(
          contrast(c[role].ink, c[role].bg),
          `${role} en ${dark ? 'sombre' : 'clair'} (${c[role].ink} sur ${c[role].bg})`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('le badge affirmatif et l’affordance portent l’accent', () => {
    for (const dark of [false, true]) {
      const c = colors(dark)
      expect(c.seal.bg).toBe(MXC_COLOR.accent)
      expect(c.affordance.bg).toBe(MXC_COLOR.accent)
    }
  })

  /**
   * Le pendant de l'assertion précédente : `saved` dit un ÉTAT, pas une mise en
   * avant. Peint en accent, il deviendrait indiscernable du bouton primaire.
   *
   * Cette garde tenait auparavant sur `tag` (« À renseigner »), retiré ; elle se
   * reporte sur `saved`, qui est désormais le seul remplissage sémantique du kit
   * — sans quoi le retrait de la pilule emporterait la règle avec elle.
   */
  it('la confirmation reste sémantique, jamais l’accent', () => {
    for (const dark of [false, true]) {
      const c = colors(dark)
      expect(c.saved.bg).not.toBe(MXC_COLOR.accent)
      expect(Object.values(MXC_SYSTEM) as string[]).toContain(c.saved.bg)
    }
  })


})

describe('MEGGA X CRM — nuancier d’accent', () => {
  it('met l’accent de la direction en tête, donc en défaut', () => {
    const mx = pfAccents()
    expect(mx[0].id).toBe('direction')
    expect(mx[0].hex).toBe(MXC_COLOR.accent)
    // Un réglage hérité de Sugar n'existe pas dans la liste MEGGA X : le repli
    // de la section (`find(…) ?? [0]`) rend donc l'accent de la marque.
    for (const legacy of ['black', 'periwinkle', 'blue', 'orange']) {
      expect(mx.find((a) => a.id === legacy)).toBeUndefined()
    }
  })

  it('chaque pastille porte une encre lisible, dans les deux modes', () => {
    for (const a of pfAccents()) {
      expect(contrast(a.ink, a.hex), `${a.id} en clair`).toBeGreaterThanOrEqual(4.5)
      expect(contrast(a.darkInk, a.darkHex), `${a.id} en sombre`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('ne propose que des couleurs de la vitrine', () => {
    const known = [...Object.values(MXC_COLOR), ...Object.values(MXC_SYSTEM)] as string[]
    for (const a of pfAccents()) {
      expect(known, `${a.id} hors palette`).toContain(a.hex)
      expect(known, `${a.id} hors palette (sombre)`).toContain(a.darkHex)
    }
  })


  // Le piège : une clé i18n absente s'affiche EN CLAIR (`focus.preferences…`).
  it('chaque pastille a un libellé dans les quatre langues', () => {
    for (const lang of ['fr', 'en', 'de', 'it']) {
      const dict = JSON.parse(readFileSync(`src/i18n/locales/${lang}/settings.json`, 'utf-8'))
      const labels = dict.focus.preferences.accents
      for (const a of pfAccents()) {
        expect(labels[a.id], `${lang} · ${a.id}`).toBeTruthy()
      }
    }
  })
})

/**
 * Deux valeurs que la délégation ne PEUT pas rattraper, parce qu'elles sont
 * écrites au-dessus d'elle. Sans garde, chacune se réintroduit à la première
 * page qu'on ajoute en copiant une voisine.
 */
describe('MEGGA X CRM — ce qui court-circuite la direction', () => {
  /**
   * ⚠ Les COMMENTAIRES sont retirés avant l'analyse. Sans ça, la note qui
   * explique pourquoi un motif a été retiré le fait rougir : le garde-fou
   * trébuche sur sa propre documentation. Constaté sur `t.primary`.
   */
  const sansCommentaires = (code: string) =>
    code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

  const sources = readdirSync('src', { recursive: true, encoding: 'utf-8' })
    .filter((f) => /\.tsx?$/.test(f))
    .map((f) => ({ path: `src/${f}`, code: sansCommentaires(readFileSync(`src/${f}`, 'utf-8')) }))

  it('la liste des sources est bien peuplée', () => {
    // Sans ça, un chemin cassé rendrait les deux tests suivants vrais par vacuité.
    expect(sources.length).toBeGreaterThan(400)
  })

  /**
   * ⛔ Une police écrite en dur ÉCRASE `--crm-font`, donc la direction ne peut
   * plus changer la typographie de cette région. Le défaut est invisible sous
   * MEGGA X — dont la police EST Inter Tight — et ne se voit qu'en revenant à
   * Sugar, qui restait en Inter Tight au lieu de DM Sans.
   */
  it('aucune police n’est écrite en dur dans un style', () => {
    const coupables = sources
      .filter((s) => /fontFamily: *['"`][^'"`]*(Inter Tight|DM Sans)/.test(s.code))
      .map((s) => s.path)
    expect(coupables, 'passer par var(--crm-font, …)').toEqual([])
  })

  /**
   * ⛔ `CrmTheme.primary` (#0041D9) est l'accent d'AVANT Sugar Pure. Il ne suit
   * aucune palette. Son dernier lecteur — la pastille d'avatar — est passé à
   * `sp.accent` avec la suppression de Sugar : il ne doit plus en avoir aucun
   * hors du module qui construit le thème.
   */
  it('l’accent hérité de CrmTheme n’a plus aucun lecteur', () => {
    const lecteurs = sources
      .filter((s) => s.path !== 'src/components/crm-sugar/tokens.ts')
      .filter((s) => /\bt\.primary\b/.test(s.code))
      .map((s) => s.path)
    expect(lecteurs).toEqual([])
  })
})
