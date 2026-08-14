/**
 * Garde-fou : sur le KYC, l'encre reste lisible — dans les DEUX thèmes.
 *
 * ⛔ POURQUOI CE FICHIER EXISTE. Cinq specs de contraste existaient (`admin`,
 * `biens`, `contacts`, `matching`, `pipeline`) et AUCUNE ne couvrait le KYC. Le
 * seul test qui ouvrait `kycPalette` était `graphite-scale`, qui vérifie des
 * paliers, pas des ratios. Le cliquet de grammaire, lui, mesure la composition
 * et ne dit rien de la couleur : le KYC agent affichait « 0 marqueur » avec deux
 * défauts d'encre vivants.
 *
 * ── LES DEUX DÉFAUTS SONT MONO-THÈME, ET DANS DES THÈMES OPPOSÉS ─────────────
 * C'est le cas d'école de `megga/gardes-vacuites` n° 13, en pire : ici une garde
 * d'un seul thème passe au vert quel que soit le thème choisi.
 *
 *   · `muted` (#7A8088) échouait en CLAIR seulement — 3,98:1 sur sa propre carte,
 *     **14** sites en `color:`. En sombre il vaut `sp.sub`, donc 7,89:1.
 *   · `onAccent` échouait en SOMBRE seulement — il valait `sp.pageBg` (#030303)
 *     posé sur `black`, qui est l'accent depuis le lot A2 : 3,57:1, 12 sites en
 *     `color:`. En clair il vaut #FFFFFF, donc 5,78:1.
 *
 * ⚠ **14, PAS 23** — et l'écart est instructif. Un premier comptage avait trouvé
 * 23 `color:` contenant `.muted` dans les quatre zones du KYC. Neuf d'entre eux
 * sont `SugarV3.muted` (`MlkAgentModal`), une palette DIFFÉRENTE qui porte par
 * hasard le même littéral `#7A8088`. Elle vit dans `crm-sugar-v3/tokens.ts`, hors
 * du cliquet, et alimente onze pages au-delà du KYC : la corriger ici aurait
 * repeint l'Audit, les Visites et l'Import lead depuis un lot qui ne regarde que
 * le KYC. Elle attend son propre lot. Une garde qui cherche un NOM DE CLÉ trouve
 * n'importe quel objet — voir {@link encresEmployees}.
 *
 * ⛔ ET LE SECOND EST UN COMMENTAIRE PÉRIMÉ, pas une étourderie. `onAccent` porte
 * « texte sombre posé sur la pilule claire » — c'était vrai quand la branche
 * sombre rendait une pilule CLAIRE. Le lot A2 a fait passer `black` à l'accent et
 * n'a pas suivi `onAccent`. `CLAUDE.md` §3 dit que l'accent tient en aplat
 * « c'est l'encre blanche qui porte le contraste » : la branche sombre casse
 * exactement la propriété sur laquelle la règle s'appuie. Forme n° 10 — un code
 * aligné sur une norme périmée se relit moins qu'un code négligé.
 *
 * ── CE QUE LA GARDE FIGE, ET CE QU'ELLE REFUSE DE SUPPOSER ───────────────────
 * 1. Les jetons EMPLOYÉS COMME ENCRE atteignent l'AA sur leurs propres surfaces,
 *    dans les deux thèmes.
 * 2. **La liste de ces jetons est elle-même vérifiée.** `megga/gardes-vacuites`
 *    dit « une garde ne mesure que ce qu'on lui a NOMMÉ » — la garde du Pipeline
 *    listait ink/soft/muted et laissait `err`, employé en encre à 3,77:1, dehors.
 *    Ici l'inventaire est CONFRONTÉ à la source : si un jeton devient une encre,
 *    la clause rougit tant qu'on ne l'a pas inscrit.
 * 3. ⚠ `ok`/`warn`/`err` ne sont PAS mesurés au seuil de texte, et c'est une
 *    décision : mesuré, ils ont **zéro** emploi en `color:`. Leur appliquer un
 *    seuil de TEXTE enverrait corriger un écran sain — piège (g), qui avait fait
 *    annoncer 31 défauts pour 18 réels sur le Matching. La clause 2 est ce qui
 *    rend cette exemption sûre : le jour où l'un d'eux devient une encre, elle le
 *    dit.
 * 4. **Une FORME doit se détacher de son fond**, et aucune garde d'encre ne le
 *    voit. La pastille d'avatar du KYC est peinte `MXC_COLOR.n100` en dur : en
 *    sombre elle vaut le canvas, donc le disque n'existe pas — pendant que ses
 *    initiales blanches sortent à 20,62:1 et qu'une garde de TEXTE reste verte.
 *    Cousine de la n° 7 (« le ton n'est pas une séparation »), prise par l'autre
 *    bout : là on mesurait un écart trop faible, ici il est NUL et l'élément
 *    mesuré passe quand même.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { KYC_LIGHT, buildKycPalette, type KycPalette } from '@/components/crm-sugar-v3/kyc/kycPalette'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { kypSurf } from '@/components/crm-sugar-v3/kyc-pager/kypTokens'

const AA = 4.5
/** Seuil des éléments NON textuels (WCAG 1.4.11) — une forme, un filet, une pastille. */
const AA_FORME = 3

/* ─── Lecture de couleur : les DEUX notations, et le refus de ce qu'on ne lit pas ─ */

/**
 * ⛔ Une couleur qu'on ne sait pas lire rend `NaN`, et `NaN < 4.5` est FAUX :
 * la clause passerait au vert. Forme n° 14. `canal` lit `#rgb`, `#rrggbb`,
 * `rgb()` et `rgba()`, et {@link lisible} est ce qui transforme une lecture
 * ratée en ROUGE au lieu d'un succès silencieux.
 */
function canal(couleur: string): [number, number, number, number] {
  const rgb = couleur.match(/rgba?\(([^)]+)\)/i)
  if (rgb) {
    const p = rgb[1]!.split(/[,/]/).map((s) => parseFloat(s.trim()))
    return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1]
  }
  const h = couleur.replace('#', '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(h)) return [NaN, NaN, NaN, NaN]
  const p = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16))
  return [r!, g!, b!, 1]
}
const lisible = (c: string) => canal(c).every((v) => Number.isFinite(v))

/** ⚠ Piège (b) : un voile se COMPOSE sur son fond avant d'être mesuré. */
function aplatir(couleur: string, dessous: string): string {
  const [r, g, b, a] = canal(couleur)
  if (a >= 1) return couleur
  const [br, bg, bb] = canal(dessous)
  const mix = (f: number, k: number) => Math.round(f * a + k * (1 - a))
  return '#' + [mix(r, br!), mix(g, bg!), mix(b, bb!)].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function luminance(c: string): number {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  const [r, g, b] = canal(c)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}
function contraste(encre: string, fond: string): number {
  const x = luminance(aplatir(encre, fond)), y = luminance(fond)
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05)
}
const arrondi = (n: number) => Math.round(n * 100) / 100

/* ─── Les deux palettes, et leurs surfaces par thème ─────────────────────────── */

const CLAIR = KYC_LIGHT
const SOMBRE = buildKycPalette(true, crmSugarPalette(true))

/**
 * Les surfaces sur lesquelles une encre KYC peut se poser, ÉNUMÉRÉES par thème.
 * `black` en fait partie : c'est l'accent, et `onAccent*` s'y pose.
 */
const THEMES: { nom: string; p: KycPalette; surfaces: Record<string, string> }[] = [
  // ⚠ Le canvas est `bgGradient`, pas `bg` : ce dernier a été retiré au lot 3
  // (zéro lecteur), et depuis que le clair ne porte plus de dégradé décoratif,
  // `bgGradient` EST une couleur plate dans les deux thèmes.
  { nom: 'CLAIR', p: CLAIR, surfaces: { card: CLAIR.card, cardSubtle: CLAIR.cardSubtle, canvas: CLAIR.bgGradient } },
  { nom: 'SOMBRE', p: SOMBRE, surfaces: { card: SOMBRE.card, cardSubtle: SOMBRE.cardSubtle, canvas: SOMBRE.bgGradient } },
]

/* ─── L'inventaire des ENCRES, confronté à la source ─────────────────────────── */

const ZONES = [
  'src/components/crm-sugar-v3/kyc',
  'src/components/crm-sugar-v3/kyc-pager',
  'src/components/crm-sugar-v3/kyc-wizard',
]
const FICHIERS = [
  'src/pages/agent/KycSugarV3Page.tsx',
  ...ZONES.flatMap((z) => readdirSync(z).filter((n) => /\.tsx?$/.test(n)).map((n) => `${z}/${n}`)),
]
const sansCommentaires = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length)).replace(/\/\/[^\n]*/g, ' ')
const SOURCE = FICHIERS.map((n) => ({ nom: n, code: sansCommentaires(readFileSync(n, 'utf-8')) }))

/**
 * Jetons de `KycPalette` employés comme ENCRE — c'est-à-dire dans une
 * déclaration `color:`, sur la VARIABLE QUI PORTE CETTE PALETTE.
 *
 * ⛔ UNE GARDE QUI CHERCHE UN NOM DE CLÉ TROUVE N'IMPORTE QUEL OBJET. Première
 * version : elle cherchait `.muted` n'importe où dans un `color:`. Or trois
 * palettes différentes du KYC portent des clés HOMONYMES —
 * `SugarV3` (`crm-sugar-v3/tokens.ts`), `KypSurf` (`kypTokens.ts`) et
 * `KycPalette`. Mesuré : sur 23 `color:` contenant `.muted`, **9 sont
 * `SugarV3.muted`** (dans `MlkAgentModal`) et 14 seulement sont la palette KYC.
 * Elle accusait aussi `okDark`, qui n'a ZÉRO usage côté KYC — ses deux seuls
 * emplois sont des `stroke=` sur `SugarV3`. Corriger sur cette lecture aurait
 * repeint la mauvaise palette, donc quatre écrans hors périmètre.
 *
 * La résolution passe donc par la LIAISON : `const <nom> = useKycPalette()`.
 * Un fichier qui ne monte pas cette palette n'est pas lu.
 *
 * ⚠ Et l'expression est lue en ENTIER, pas seulement `color: sp.x` : la moitié
 * des sites écrivent `color: active ? sp.onAccent : sp.muted`. Une garde qui
 * n'aurait vu que la forme simple aurait manqué `onAccent` — donc le défaut
 * sombre en entier.
 */
function encresEmployees(): Set<string> {
  const vus = new Set<string>()
  const cles = Object.keys(KYC_LIGHT)
  for (const { code } of SOURCE) {
    const noms = [...code.matchAll(/const\s+(\w+)\s*=\s*useKycPalette\(\)/g)].map((m) => m[1]!)
    if (!noms.length) continue
    for (const m of code.matchAll(/(?:^|[^-\w])color:\s*([^,;\n]+)/g)) {
      for (const n of noms) {
        for (const c of cles) if (new RegExp(`\\b${n}\\.${c}\\b`).test(m[1]!)) vus.add(c)
      }
    }
  }
  return vus
}

/**
 * ⛔ INVENTAIRE, PAS DEVINETTE. Relevé le 16 août 2026 sur les dix fichiers qui
 * montent réellement `useKycPalette()`. La clause « l'inventaire décrit encore
 * la source » le confronte au code : il ne peut ni grossir ni maigrir en silence.
 *
 * `ok` / `warn` / `err` n'y sont PAS, et c'est mesuré : zéro emploi en `color:`.
 * `okDark` non plus — il n'a aucun usage côté KYC.
 */
const ENCRES_SUR_SURFACE = ['ink', 'inkSoft', 'muted', 'errDarker']

/** Encres posées sur l'ACCENT — leur fond n'est pas une surface, c'est `black`. */
const ENCRES_SUR_ACCENT = ['onAccent', 'onAccentSoft']

/**
 * ⚠ `black` est employé en `color:`, mais sur un GLYPHE — le conteneur 56 px qui
 * porte l'icône d'une carte de porte, dont l'unique enfant est `{icon}`. WCAG
 * 1.4.11 lui applique 3:1, pas 4,5. `CLAUDE.md` §3 le dit explicitement : « le
 * seuil non-texte 3:1 est satisfait, un glyphe décoratif peut rester en accent ».
 *
 * ⛔ Le distinguer n'est PAS une commodité. L'autre site qui peignait du TEXTE en
 * `sp.black` (le pied de carte au survol) tenait en clair — 5,78:1, le contraste
 * est symétrique — et tombait à 3,44:1 sur la carte sombre. Confondre les deux
 * rôles aurait soit laissé passer le texte, soit envoyé repeindre le glyphe.
 */
const GLYPHES_SUR_SURFACE = ['black']

const ENCRES_ATTENDUES = [...ENCRES_SUR_SURFACE, ...ENCRES_SUR_ACCENT, ...GLYPHES_SUR_SURFACE]

describe('Contraste KYC — les deux thèmes, les rôles énumérés', () => {
  /** Sans lui, tout le reste passerait par vacuité sur un balayage cassé. */
  it('le balayage voit la source et lit toutes les couleurs', () => {
    expect(FICHIERS.length, 'zone vide : chemin cassé, pas surface propre').toBeGreaterThan(15)
    expect(SOURCE.length).toBeGreaterThan(15)
    const illisibles: string[] = []
    for (const { nom, p, surfaces } of THEMES) {
      for (const [cle, v] of Object.entries(p)) {
        if (typeof v !== 'string' || !/^#|^rgba?\(/.test(v)) continue
        if (!lisible(v)) illisibles.push(`${nom}.${cle} = ${v}`)
      }
      for (const [cle, v] of Object.entries(surfaces)) if (!lisible(v)) illisibles.push(`${nom} surface ${cle} = ${v}`)
    }
    expect(illisibles, `couleurs non lues — la garde REFUSE au lieu de sauter :\n  ${illisibles.join('\n  ')}`).toEqual([])
  })

  /**
   * Clause n° 2 : l'inventaire est confronté à la source. C'est ce qui rend sûre
   * l'exemption de `ok`/`warn`/`err`.
   */
  it('l’inventaire des encres décrit encore la source', () => {
    const vues = [...encresEmployees()].sort()
    const attendues = [...ENCRES_ATTENDUES].sort()
    const nouvelles = vues.filter((v) => !attendues.includes(v))
    const mortes = attendues.filter((a) => !vues.includes(a))
    expect(nouvelles, `jeton devenu une ENCRE sans être mesuré :\n  ${nouvelles.join('\n  ')}`).toEqual([])
    expect(mortes, `inscrit comme encre mais plus employé — retirer :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  /** Clause n° 1 — les encres posées sur les SURFACES, dans les deux thèmes. */
  for (const { nom, p, surfaces } of THEMES) {
    it(`les encres tiennent l’AA sur les surfaces — ${nom}`, () => {
      const faibles: string[] = []
      for (const [liste, seuil, role] of [
        [ENCRES_SUR_SURFACE, AA, 'texte'],
        [GLYPHES_SUR_SURFACE, AA_FORME, 'glyphe'],
      ] as const) {
        for (const jeton of liste) {
          const encre = p[jeton as keyof KycPalette] as string
          for (const [nomSurf, fond] of Object.entries(surfaces)) {
            const r = contraste(encre, fond)
            if (r < seuil) faibles.push(`${jeton} (${encre}) sur ${nomSurf} (${fond}) = ${arrondi(r)}:1 — seuil ${role} ${seuil}`)
          }
        }
      }
      expect(faibles, `encre sous le seuil en ${nom} :\n  ${faibles.join('\n  ')}`).toEqual([])
    })

    /**
     * Clause n° 1bis — l'encre posée SUR L'ACCENT. Séparée parce que son fond
     * n'est pas une surface : `black` EST l'accent depuis le lot A2, et c'est là
     * que vit le défaut sombre.
     */
    it(`l’encre posée sur l’accent tient l’AA — ${nom}`, () => {
      const faibles: string[] = []
      for (const jeton of ENCRES_SUR_ACCENT) {
        const r = contraste(p[jeton as keyof KycPalette] as string, p.black)
        if (r < AA) faibles.push(`${jeton} (${p[jeton as keyof KycPalette]}) sur black (${p.black}) = ${arrondi(r)}:1`)
      }
      expect(faibles, `encre sous l'AA sur l'accent en ${nom} :\n  ${faibles.join('\n  ')}`).toEqual([])
    })
  }

  /**
   * Clause n° 4 — UNE FORME DOIT SE DÉTACHER DE SON FOND.
   *
   * ⛔ Aucune clause d'encre ne peut l'attraper : la pastille d'avatar sort à
   * 1,00:1 contre le canvas sombre pendant que ses initiales blanches sortent à
   * 20,62:1. On mesure donc l'APLAT contre la surface, au seuil non-textuel.
   *
   * ⚠ Ancrée sur la VALEUR par défaut de `KypAvatar` — pas sur son nom de
   * variable : c'est la forme qui définit la famille (n° 4).
   */
  it('la pastille d’avatar se détache de son fond dans les deux thèmes', () => {
    const faibles: string[] = []
    for (const [nom, dark] of [['CLAIR', false], ['SOMBRE', true]] as const) {
      const aplat = kypSurf(dark).avatar
      expect(lisible(aplat), `aplat d'avatar non lisible en ${nom} : ${aplat}`).toBe(true)
      const surfaces = THEMES.find((t) => t.nom === nom)!.surfaces
      for (const [nomSurf, fond] of Object.entries(surfaces)) {
        const r = contraste(aplat, fond)
        if (r < AA_FORME) faibles.push(`${nom} : pastille (${aplat}) sur ${nomSurf} (${fond}) = ${arrondi(r)}:1`)
      }
      // …et ses initiales restent lisibles SUR elle, ce qui n'a rien d'acquis :
      // en sombre la pastille doit MONTER, donc l'encre bascule.
      const encre = encreSur(aplat)
      const ri = contraste(encre, aplat)
      if (ri < AA) faibles.push(`${nom} : initiales (${encre}) sur la pastille (${aplat}) = ${arrondi(ri)}:1`)
    }
    expect(faibles, `pastille indiscernable, ou initiales illisibles :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA PALETTE DESCEND DE MEGGA X — sauf ce qui ENCODE, et c'est nommé.
   *
   * `KycPalette` est une palette PARALLÈLE : 35 clés écrites à la main à côté de
   * `mxCrmPalette`. C'est le troisième exemplaire du motif que ce chantier a
   * rencontré partout (la console, la popover de notifications, les cinq modales
   * du dock), et il se cherche par la FORME — un objet littéral de couleurs dans
   * un composant qui a déjà une palette — jamais par le nom.
   *
   * ⚠ CE QUI RESTE DEHORS EST MESURÉ, PAS SUPPOSÉ. Les familles qu'on croyait
   * « sémantiques » (`ok`/`warn`/`err` et leurs déclinaisons douces) avaient
   * ZÉRO lecteur dans les onze fichiers qui montent cette palette : elles étaient
   * MORTES, pas hors direction. Les tons qui encodent réellement vivent ailleurs
   * — `kypStatusMeta` et `kypRiskMeta` (`kypTokens.ts`), que ce lot ne touche
   * pas. Ne restent ici que `errSoft` et `errDarker`, qui ont des lecteurs et
   * disent une ERREUR : leur teinte porte l'information, l'échelle ne sait pas
   * la porter.
   */
  it('chaque couleur de la palette descend de MEGGA X, sauf celles qui encodent', () => {
    const src = readFileSync('src/components/crm-sugar-v3/kyc/kycPalette.ts', 'utf-8')
    const clair = src.slice(src.indexOf('export const KYC_LIGHT'), src.indexOf('export function buildKycPalette'))
    const sombre = src.slice(src.indexOf('return {', src.indexOf('if (!dark) return KYC_LIGHT')))

    /** Une valeur est DÉRIVÉE si elle nomme une source du système. */
    const derive = (v: string) => /\b(?:MXC_COLOR|MXC_SYSTEM|sp|t)\.\w+|\bsgVoileEncre\(|\bencreSur\(/.test(v)

    /**
     * Hors direction, NOMMÉES une par une avec leur raison — jamais un motif.
     * Une exemption qui nomme une famille exempte des sites par accident.
     */
    const HORS_DIRECTION: Record<string, string> = {
      errSoft: 'fond d’encart d’ERREUR — la teinte porte l’information',
      errDarker: 'encre d’ERREUR — idem',
      logoInvert: 'booléen, pas une couleur',
      cardBorder: 'idiome documenté du KYC clair : ombres SEULES, bordure transparente',
    }

    const nus: string[] = []
    const vues = new Set<string>()
    for (const [nomBloc, bloc] of [['CLAIR', clair], ['SOMBRE', sombre]] as const) {
      for (const m of bloc.matchAll(/^\s+(\w+):\s*([^\n]+?),?\s*$/gm)) {
        const [, cle, val] = m
        if (HORS_DIRECTION[cle!]) continue
        vues.add(`${nomBloc}.${cle}`)
        // Une valeur multi-ligne (gradient) est lue sur sa première ligne : on
        // ne juge que celles qui portent une couleur reconnaissable.
        if (!/#[0-9a-f]{3,8}\b|rgba?\(/i.test(val!) || derive(val!)) continue
        nus.push(`${nomBloc}.${cle} = ${val!.slice(0, 60)}`)
      }
    }
    // ⚠ TÉMOINS NOMMÉS, pas un seuil. Un `> 40` s'était périmé le jour même où
    // dix clés mortes ont été retirées : un compte décrit un ÉTAT, il se périme
    // dès que l'état bouge légitimement. Un témoin décrit le BALAYAGE.
    for (const t of ['CLAIR.card', 'CLAIR.onAccent', 'SOMBRE.card', 'SOMBRE.ink']) {
      expect([...vues], `clé non lue : le découpage du fichier a changé (${t})`).toContain(t)
    }
    expect(nus, `couleur écrite à la main, hors inventaire :\n  ${nus.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ ET LE REPLI EN DUR NE DOIT PLUS SERVIR. La clause précédente mesure
   * `kypSurf().avatar` ; elle resterait VERTE si un appelant oubliait de le
   * passer et retombait sur le `|| MXC_COLOR.n100` de `KypAvatar` — c'est-à-dire
   * exactement le défaut d'origine. On exige donc que CHAQUE montage nomme son
   * aplat. Vacuité n° 2 : vérifier qu'une fonction rend une bonne valeur ne dit
   * rien de qui l'appelle.
   */
  it('chaque montage d’avatar nomme son aplat', () => {
    const nus: string[] = []
    let vus = 0
    for (const { nom, code } of SOURCE) {
      for (const m of code.matchAll(/<KypAvatar\b[^>]*>/g)) {
        vus++
        if (!/\bavatarBg=/.test(m[0])) nus.push(`${nom} — ${m[0].slice(0, 80)}`)
      }
    }
    expect(vus, 'aucun <KypAvatar vu : la clause ne mesure rien').toBeGreaterThan(2)
    expect(nus, `avatar monté sans aplat — il retombe sur le repli en dur :\n  ${nus.join('\n  ')}`).toEqual([])
  })
})
