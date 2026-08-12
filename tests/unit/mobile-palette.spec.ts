/**
 * Garde-fou : la palette du CRM MOBILE descend de MEGGA X, dans les deux thèmes.
 *
 * ⛔ POURQUOI ELLE ÉTAIT LA DERNIÈRE. `crm-mobile/tokens.ts` peint SEIZE
 * dossiers d'écrans — Today, Pipeline, Contacts, Agenda, Matching, KYC,
 * Réglages, « Mes biens »… — et il était resté dans l'état exact du wizard
 * avant le 11 août 2026 :
 *
 * · en CLAIR, du Sugar de bout en bout — canvas `#EEF1F5` en dégradé radial,
 *   encre `#0B0C0E`, et surtout `accent: '#0B0C0E'` : l'accent ÉTAIT l'encre,
 *   la règle que la décision du 10 août a remplacée ;
 * · en SOMBRE, un hybride — les sept surfaces venaient déjà de `MXC_COLOR`,
 *   mais les encres restaient bleutées (`#ECEDF3`, `#B5B7C4`, `#878B99`) et
 *   l'accent s'inversait en near-white `#F2F2F6`.
 *
 * Ça se VOYAIT : la pastille de filtre active et le bouton flottant de « Mes
 * biens » étaient noirs en clair et near-white en sombre, jamais `#424bfb`.
 *
 * ⚠ CE QUI RESTE VOLONTAIREMENT HORS ÉCHELLE est nommé dans `SEMANTIQUES` —
 * même idiome que les palettes du wizard, de la fiche et du calendrier : figer
 * l'écart plutôt que l'interdire. En ajouter un demande de l'écrire ici.
 */
import { describe, it, expect } from 'vitest'
import { MXC_COLOR, MXC_SYSTEM, mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { MT_LIGHT, MT_DARK, type MobileTokens } from '@/components/crm-mobile/tokens'

const ECHELLE = new Set(
  [...Object.values(MXC_COLOR), ...Object.values(MXC_SYSTEM)].map((v) => v.toLowerCase()),
)

/**
 * Jetons qui portent un SENS que la vitrine ne sait pas dire :
 *
 * - `danger` / `dangerInk` / `dangerBg` / `dangerFg` : le retard et la
 *   confirmation destructive. `MXC_SYSTEM.red400` est réglé pour le canvas
 *   `#030303` et ne tient pas en encre sur fond clair.
 * - `riskBg` / `riskFg` : le risque, même raison.
 * - `goal` : l'objectif atteint — c'est un état, pas une décoration.
 * - `kycSeal` : le sceau de vérification. Il doit se distinguer de l'accent
 *   PRÉCISÉMENT parce qu'un bien accentué n'est pas un bien vérifié ; les
 *   confondre ferait lire une vérification là où il n'y en a pas.
 * - `hair` / `overlay` / `cardBorder` / `headerBg` / `tabBg` : des VOILES
 *   (rgba), pas des couleurs — ils se posent sur la surface au lieu de la
 *   remplacer.
 * - `shadow*` / `tabBarShadow` : des ombres.
 * - `relanceBorder` : `transparent`.
 */
const SEMANTIQUES = new Set([
  'danger', 'dangerInk', 'dangerBg', 'dangerFg',
  'riskBg', 'riskFg', 'goal', 'kycSeal',
  'hair', 'overlay', 'cardBorder', 'headerBg', 'tabBg', 'relanceBorder',
  'shadowSm', 'shadow', 'shadowLg', 'tabBarShadow',
  'mode',
])

/** Les couleurs sous LEURS DEUX notations — `rgba()` est du hex en décimal. */
function couleursDe(v: string): string[] {
  const hex = (v.match(/#[0-9A-Fa-f]{6}\b/g) ?? []).map((h) => h.toLowerCase())
  const rgb = [...v.matchAll(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/g)].map(
    (m) => '#' + [1, 2, 3].map((i) => Number(m[i]).toString(16).padStart(2, '0')).join(''),
  )
  return [...hex, ...rgb]
}

function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const ch = [0, 2, 4].map((i) => {
    const v = parseInt(h.slice(i, i + 2), 16) / 255
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2]
}
function contraste(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const PALETTES: [string, MobileTokens][] = [['clair', MT_LIGHT], ['sombre', MT_DARK]]

describe('CRM mobile — la palette descend de MEGGA X', () => {
  // Sans ça, une palette vidée rendrait tout le reste vrai par vacuité.
  it('les deux thèmes rendent une palette fournie', () => {
    for (const [, p] of PALETTES) expect(Object.keys(p).length).toBeGreaterThan(25)
    expect(MT_LIGHT.mode).toBe('light')
    expect(MT_DARK.mode).toBe('dark')
  })

  it.each(PALETTES)('aucune couleur hors échelle (%s)', (_nom, p) => {
    const fautifs: string[] = []
    for (const [jeton, valeur] of Object.entries(p)) {
      if (typeof valeur !== 'string' || SEMANTIQUES.has(jeton)) continue
      for (const c of couleursDe(valeur)) if (!ECHELLE.has(c)) fautifs.push(`${jeton} = ${c}`)
    }
    expect(fautifs, `hors de l'échelle : ${fautifs.join(', ')}`).toEqual([])
  })

  /**
   * Les surfaces et les encres viennent de `mxCrmPalette`, pas d'une copie qui
   * coïncide. `card: '#FFFFFF'` passait déjà le test précédent sans en descendre.
   */
  it.each([false, true])('surfaces et encres sortent de mxCrmPalette (sombre=%s)', (dark) => {
    const mx = mxCrmPalette(dark)
    const p = dark ? MT_DARK : MT_LIGHT
    expect(p.pageBg).toBe(mx.pageBg)
    expect(p.card).toBe(mx.cardBg)
    expect(p.cardSubtle).toBe(mx.cardSubBg)
    expect(p.ink).toBe(mx.ink)
    expect(p.inkSoft).toBe(mx.soft)
    expect(p.muted).toBe(mx.sub)
  })

  /**
   * ⛔ L'ACCENT NE S'INVERSE PLUS. Il valait `#0B0C0E` en clair et `#F2F2F6` en
   * sombre — Sugar Pure faisait de l'accent l'encre. Même correction qu'au
   * calendrier, aux Réglages, au wizard et à la fiche.
   */
  it.each(PALETTES)('l’accent est celui de la marque (%s)', (_nom, p) => {
    expect(p.accent).toBe(MXC_COLOR.accent)
    expect(p.accentInk).toBe(MXC_COLOR.n1000)
    expect(contraste(p.accentInk, p.accent)).toBeGreaterThanOrEqual(4.5)
  })

  /** La pastille suit l'accent : c'est le même rôle sous un autre nom. */
  it.each(PALETTES)('la pastille ne diverge pas de l’accent (%s)', (_nom, p) => {
    expect(p.pillBg).toBe(p.accent)
    expect(p.pillInk).toBe(p.accentInk)
  })

  /**
   * Le bloc de relance reste un bento IMMERSIF sombre dans les DEUX thèmes —
   * idiome accepté (cf. Facturation aux Réglages). Ce qu'on verrouille, c'est
   * qu'il descende de l'échelle et que son CTA reste lisible dessus.
   */
  it.each(PALETTES)('le bloc de relance est lisible (%s)', (_nom, p) => {
    expect(contraste(p.relanceInk, p.relanceBg)).toBeGreaterThanOrEqual(4.5)
    expect(contraste(p.ctaInk, p.ctaBg)).toBeGreaterThanOrEqual(4.5)
  })

  /**
   * ⛔ Le sceau KYC ne doit PAS se confondre avec l'accent : un bien accentué
   * n'est pas un bien vérifié. Il est exempté de l'échelle pour cette raison ;
   * encore faut-il qu'il reste distinct.
   */
  it.each(PALETTES)('le sceau KYC se distingue de l’accent (%s)', (_nom, p) => {
    expect(p.kycSeal.toLowerCase()).not.toBe(p.accent.toLowerCase())
  })

  /**
   * Plus de dégradé de canvas. Il en portait un en clair
   * (`radial-gradient(… #CFDAE4 …)`) : une seconde source de lumière que la
   * direction ne connaît pas, et que le wizard a perdue le même jour.
   */
  it('aucun dégradé de canvas', () => {
    for (const [nom, p] of PALETTES) {
      expect(p.canvas, `${nom} garde un dégradé`).not.toMatch(/gradient/)
    }
  })

  /**
   * ⛔ `ghost` ÉCHOUE L'AA DANS LES DEUX THÈMES — c'est un TRAIT, pas une encre.
   *
   * Mesuré sur les surfaces de carte : `#a3a3a3` sur `#ffffff` rend 2,52:1 en
   * clair, `#686868` sur `#090909` rend 3,57:1 en sombre. Le seuil du texte
   * courant est 4,5. `muted` — l'autre bout de la même échelle, `#686868` en
   * clair et `#a3a3a3` en sombre — rend 5,57 et 7,89 : c'est LUI le jeton du
   * texte secondaire.
   *
   * Huit composants mobiles l'employaient en encre, dont la gouttière d'heures
   * de l'agenda : exactement le défaut que la refonte du calendrier avait
   * corrigé côté BUREAU (#1199) en laissant le mobile derrière. Deuxième fois
   * que ce correctif ne traverse qu'un des deux dossiers de la même surface.
   *
   * ⚠ Ce test ne peut pas distinguer un contrôle DÉSACTIVÉ, que la WCAG exempte
   * du seuil (1.4.3) et où `ghost` reste le bon jeton — le grisé EST le signal.
   * Il n'interdit donc `ghost` en encre que là où aucun `disabled` ne
   * l'accompagne.
   */
  it('ghost ne sert jamais d’encre à du contenu lisible', async () => {
    const { readdirSync, readFileSync } = await import('node:fs')
    const racine = 'src/components/crm-mobile'
    const fichiers = readdirSync(racine, { recursive: true, encoding: 'utf-8' })
      .filter((f) => f.endsWith('.tsx'))
    const fautifs: string[] = []
    for (const f of fichiers) {
      readFileSync(`${racine}/${f}`, 'utf-8').split('\n').forEach((ligne, i) => {
        if (!/\b(?:color|stroke|fill):[^,}\n]*\btk\.ghost\b/.test(ligne)) return
        if (/disabled/.test(ligne)) return
        fautifs.push(`${f}:${i + 1}`)
      })
    }
    expect(fautifs.length, `contenu lisible en ghost :\n  ${fautifs.join('\n  ')}`).toBe(0)
  })

  /**
   * Les jetons SÉMANTIQUES qui servent d'ENCRE passent l'AA sur les trois
   * surfaces où le CRM mobile les pose.
   *
   * `SEMANTIQUES` (plus haut) exempte ces jetons de l'échelle MEGGA X parce
   * qu'ils disent un état que la vitrine ne sait pas dire. Cette exemption
   * portait sur la PROVENANCE de la couleur, et rien ne vérifiait qu'elle
   * restait LISIBLE — deux questions distinctes qu'un seul test couvrait à
   * moitié.
   *
   * ⛔ Ce qu'il a trouvé le 12 août 2026 : `goal` valait `#059669`, soit
   * **3,58:1** sur la page claire, quand le seuil du texte courant est 4,5. Il
   * ne peint pas qu'une jauge — il peint le libellé « Vérifié » du KYC, la
   * probabilité d'achat de la fiche deal et le témoin de brouillon du wizard.
   * Porté à `#047857`, le vert que le témoin du wizard BUREAU emploie déjà, il
   * rend 5,21:1.
   *
   * ⚠ Le seuil est celui du TEXTE (4,5), pas celui des grands caractères (3,0)
   * ni des objets graphiques : ces jetons peignent des libellés de 11 à 13 px.
   * Un jeton qui ne servirait QUE de remplissage n'a rien à faire dans cette
   * liste — l'y mettre lui imposerait une contrainte que la WCAG ne lui pose
   * pas, et la première correction ferait perdre la teinte pour rien.
   */
  it('les jetons sémantiques employés en encre passent l’AA', () => {
    /** Jetons posés en `color` / `stroke` / `fill` sur du contenu lisible. */
    const ENCRES = ['goal', 'riskFg', 'dangerFg', 'danger', 'kycSeal'] as const
    /** Les trois surfaces sur lesquelles le mobile pose du texte. */
    const SURFACES = ['pageBg', 'card', 'cardSubtle'] as const
    const AA = 4.5

    const faibles: string[] = []
    for (const [nom, p] of PALETTES) {
      for (const encre of ENCRES) {
        for (const surface of SURFACES) {
          const r = contraste(p[encre], p[surface])
          if (r < AA) faibles.push(`${nom} · ${encre} (${p[encre]}) sur ${surface} (${p[surface]}) = ${r.toFixed(2)}:1`)
        }
      }
      // Le bento de relance est sombre dans les DEUX thèmes : ses encres se
      // mesurent sur LUI, jamais sur la page.
      for (const encre of ['relanceInk', 'relanceMuted'] as const) {
        const r = contraste(p[encre], p.relanceBg)
        if (r < AA) faibles.push(`${nom} · ${encre} (${p[encre]}) sur relanceBg = ${r.toFixed(2)}:1`)
      }
    }
    expect(faibles.length, `encres sous ${AA}:1 :\n  ${faibles.join('\n  ')}`).toBe(0)
  })
})
