/**
 * Garde-fou : sur la face PUBLIQUE, l'encre reste lisible — et cette face n'a
 * qu'un seul thème.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * ⛔ `MLK` n'était gardée par RIEN, et c'est STRUCTUREL (voir
 * `megga/gardes-vacuites` n° 38). Les huit specs de contraste du dépôt gardent
 * chacune une ZONE — admin, biens, contacts, matching, pipeline, kyc, SugarV3,
 * analytics. Un objet de jetons n'EST pas une zone : il est lu PAR les zones, et
 * tombe entre les mailles. C'est le TROISIÈME exemplaire du motif après
 * `SugarV3` et `AX`.
 *
 * ⚠ ET ICI LE CLIQUET DE GRAMMAIRE NE RATTRAPE MÊME PAS À MOITIÉ. Sur les deux
 * chantiers précédents il balayait déjà le dossier et ne mesurait que la
 * composition ; `src/components/kyc-magic-link/` n'est sous AUCUNE de ses trente
 * racines. La face publique n'était donc lue par personne, ni pour sa
 * composition ni pour sa couleur.
 *
 * ⚠ `MLK` alimente DEUX surfaces publiques — `/kyc/:token` (via `KycPublicPage`,
 * qui ne rend elle-même aucun style) et `/rendez-vous/:token`
 * (`AppointmentManagePage`). Grouper par DOSSIER fait donc rater le périmètre :
 * la page qui porte le parcours KYC client rend ZÉRO marqueur, et la zone
 * partagée qu'elle monte en porte sept clauses.
 *
 * ── CE QUE LA MESURE A TROUVÉ (15 août 2026) ─────────────────────────────────
 * Trois familles, toutes en thème clair — le seul qu'ait cette face.
 *
 *   · `muted` (#7A8088) — 17 emplois en `color:`, 3,98:1 sur la carte et 3,75:1
 *     sur la sous-surface. C'est la TROISIÈME fois que cette valeur exacte est
 *     mesurée sous l'AA : le Pipeline l'avait trouvée copiée dans trois palettes
 *     (lot 1, 13 août), le KYC dans `SugarV3.muted`. Elle n'avait jamais été
 *     cherchée ici.
 *   · `ghost` (#B5BAC2) EN ENCRE — 1,95:1 sur la carte. Un seul site, et c'est
 *     le LIBELLÉ d'un bouton désactivé : le mot qui dit pourquoi on ne peut pas
 *     cliquer.
 *   · ⛔ `ghost` EST AUSSI UN APLAT, et l'encre blanche posée dessus rend le même
 *     1,95:1. `MlkBlackPill` peint son état désactivé avec `background: ghost` et
 *     `color: '#fff'` ; `MlkAppointmentCard` peint de même la pastille d'un
 *     rendez-vous ANNULÉ, glyphe blanc compris. C'est la forme n° 37 dans ses
 *     deux sens sur le MÊME jeton : il sert d'encre et de fond, et il échoue des
 *     deux côtés. Une garde qui n'aurait nommé qu'un rôle serait passée au vert
 *     sur l'autre.
 *
 * ── CE QUE CETTE GARDE FIGE, ET CE QU'ELLE REFUSE DE SUPPOSER ────────────────
 * 1. L'inventaire des rôles est CONFRONTÉ à la source. Un jeton qui change de
 *    rôle fait rougir tant qu'on ne l'a pas mesuré dans le nouveau (n° 15).
 * 2. Le rôle se lit sur le BLOC, pas sur la ligne (n° 16/25) — voir
 *    {@link proprietePorteuse}. Les styles d'ici sont écrits en colonne : une
 *    lecture à la ligne classait `${MLK.black}` d'un `boxShadow` en « autre »,
 *    et `stroke={MLK.ink}` d'un attribut JSX en « autre » aussi.
 * 3. Elle résout la LIAISON, jamais le nom de clé (n° 31). `muted` seul trouve
 *    des centaines de sites sous `tk.`, `SugarV3.`, `sp.` — corriger sur cette
 *    lecture repeindrait le CRM depuis un lot qui regarde la face publique.
 * 4. Elle REFUSE une couleur qu'elle ne sait pas lire au lieu de la sauter
 *    (n° 14/17/40), et ses exemptions sont ÉNUMÉRÉES, jamais devinées par une
 *    forme.
 * 5. Elle mesure les COUPLES dans les deux sens (n° 37), et l'encre du couple
 *    est confrontée à la source — pas recopiée ici.
 * 6. Elle dit COMBIEN de thèmes elle mesure, et rougit le jour où cette face en
 *    gagne un second (même clause que `sugar-v3-contraste`).
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { MLK } from '@/components/kyc-magic-link/mlkTokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { repoPath, rel } from './helpers/fs-scan'

const AA = 4.5
/** Seuil des éléments NON textuels (WCAG 1.4.11) — une forme, un filet, un tracé. */
const AA_FORME = 3

/* ─── Lecture de couleur : les deux notations, et le refus de ce qu'on ne lit pas ─ */

/**
 * ⛔ Une couleur qu'on ne sait pas lire rend `NaN`, et `NaN < 4.5` est FAUX : la
 * clause passerait au vert, silencieusement et du bon côté du seuil (n° 14).
 * {@link lisible} est ce qui transforme une lecture ratée en ROUGE.
 *
 * ⛔ ANCRÉE SUR LA CHAÎNE ENTIÈRE (n° 41). Non ancrée, elle trouverait le
 * `rgba(15,23,42,0.04)` au MILIEU de `'0 4px 16px rgba(15,23,42,0.04)'` et
 * déclarerait une chaîne d'ombre « lisible » — donc mesurable comme une encre,
 * avec un ratio qui ne veut rien dire. Une lecture partielle est pire qu'un
 * refus : elle rend un nombre.
 */
function canal(couleur: string): [number, number, number, number] {
  const rgb = couleur.match(/^\s*rgba?\(([^)]+)\)\s*$/i)
  if (rgb) {
    const p = rgb[1]!.split(/[,/]/).map((s) => parseFloat(s.trim()))
    return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1]
  }
  const h = couleur.trim().replace('#', '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(h)) return [NaN, NaN, NaN, NaN]
  const p = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16))
  return [r!, g!, b!, 1]
}
const lisible = (c: string) => canal(c).every((v) => Number.isFinite(v))

/** ⚠ Un voile se COMPOSE sur son fond avant d'être mesuré (piège de sonde b). */
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

/* ─── La source, et la résolution des rôles PAR LE BLOC ───────────────────────── */

/**
 * Les CINQ fichiers qui lisent `MLK`. `KycPublicPage` n'y est pas : elle monte
 * les écrans et ne peint rien elle-même — mesuré, elle ne porte ni `style={{`
 * ni `className`.
 */
const FICHIERS = [
  'src/components/kyc-magic-link/MlkScreens.tsx',
  'src/components/kyc-magic-link/MlkBooking.tsx',
  'src/components/kyc-magic-link/MlkPrimitives.tsx',
  'src/components/kyc-magic-link/MlkSlotPicker.tsx',
  'src/pages/public/AppointmentManagePage.tsx',
]
const sansCommentaires = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length)).replace(/\/\/[^\n]*/g, ' ')
const SOURCE = FICHIERS.map((n) => ({ nom: rel(repoPath(n)), code: sansCommentaires(readFileSync(repoPath(n), 'utf-8')) }))

/** Propriétés qui portent une COULEUR. `borderRadius`/`borderWidth` en sont exclus. */
const PROPRIETES = new Set([
  'color', 'caretColor',
  'fill', 'stroke', 'stopColor', 'accentColor',
  'background', 'backgroundColor', 'backgroundImage',
  'border', 'borderTop', 'borderBottom', 'borderLeft', 'borderRight',
  'borderColor', 'borderTopColor', 'borderBottomColor', 'outline', 'outlineColor',
  'boxShadow', 'textShadow', 'filter',
  'fontFamily',
])
const ROLE_PAR_PROPRIETE: Record<string, string> = {
  color: 'texte', caretColor: 'texte',
  fill: 'glyphe', stroke: 'glyphe', stopColor: 'glyphe', accentColor: 'glyphe',
  background: 'aplat', backgroundColor: 'aplat', backgroundImage: 'aplat',
  border: 'filet', borderTop: 'filet', borderBottom: 'filet', borderLeft: 'filet', borderRight: 'filet',
  borderColor: 'filet', borderTopColor: 'filet', borderBottomColor: 'filet', outline: 'filet', outlineColor: 'filet',
  boxShadow: 'ombre', textShadow: 'ombre', filter: 'ombre',
  fontFamily: 'police',
}

/** Index du premier caractère non blanc AVANT `k`. */
function avant(code: string, k: number): number {
  let j = k - 1
  while (j >= 0 && /\s/.test(code[j]!)) j--
  return j
}

/**
 * La propriété colorante dont cette valeur fait partie — remontée à DÉPENDANCE
 * DE BLOC, jamais à la ligne.
 *
 * ⛔ POURQUOI PAS LA LIGNE. Les styles d'ici sont écrits en colonne, et une
 * lecture à la ligne se trompait deux fois sur les 120 sites : `${MLK.black}` au
 * milieu d'un gabarit dont le `boxShadow:` vit deux lignes plus haut (classé
 * « autre »), et `stroke={MLK.ink}` d'un attribut JSX (classé « autre » aussi,
 * sept fois). Un bloc est une unité du LANGAGE — il ne bouge ni sous un
 * commentaire, ni sous un reformatage. Même remède que les n° 16 et 25.
 *
 * On remonte en comptant les parenthésages, et l'on s'arrête :
 *  - sur une virgule au niveau 0 → la valeur précédente, ce n'est pas la nôtre ;
 *  - en sortant de l'objet → il n'y a pas de propriété ;
 *  - sur un `:` ou un `=` dont l'identifiant qui précède est COLORANT.
 *
 * ⚠ Un `:` dont l'identifiant n'est pas colorant ne conclut PAS : c'est le `:`
 * d'un ternaire (`background: on ? MLK.ink : MLK.muted`), et s'y arrêter ferait
 * de `ink` la « propriété » de `muted`. On continue de remonter — c'est la même
 * précaution que la liste blanche d'`analytics-contraste`, appliquée à une
 * remontée au lieu d'un balayage.
 *
 * ⚠ Deux accolades sont TRANSPARENTES : `${` d'un gabarit et `={` d'un attribut
 * JSX. Sans elles, la remontée sort de l'objet au premier caractère.
 */
function proprietePorteuse(code: string, i: number): string | null {
  let profondeur = 0
  for (let k = i - 1; k >= 0; k--) {
    const c = code[k]!
    if (c === '}' || c === ')' || c === ']') { profondeur++; continue }
    if (c === '{' || c === '(' || c === '[') {
      if (c === '{' && code[k - 1] === '$') continue
      if (c === '{' && profondeur === 0 && code[avant(code, k)] === '=') continue
      if (profondeur === 0) return null
      profondeur--
      continue
    }
    if (profondeur !== 0) continue
    if (c === ',' || c === ';') return null
    if (c === ':' || c === '=') {
      // `==`, `===`, `!=`, `<=`, `>=` ne sont pas des affectations de propriété.
      if (c === '=' && (code[k + 1] === '=' || ['=', '!', '<', '>'].includes(code[k - 1] ?? ''))) continue
      const m = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, k))
      if (m && PROPRIETES.has(m[1]!)) return m[1]!
    }
  }
  return null
}

/**
 * Chemins de `MLK` employés, avec leur RÔLE — résolus sur la LIAISON.
 *
 * ⚠ LA LIAISON EST ICI L'IMPORT, pas un hook : les cinq fichiers écrivent
 * `import { MLK } from …`, sans alias ni déstructuration (mesuré). La clause
 * « le balayage voit la source » exige cet import fichier par fichier — le jour
 * où l'un renomme à l'import, elle rougit au lieu de rendre zéro en silence.
 */
function rolesEmployes(): Map<string, string[]> {
  const vus = new Map<string, string[]>()
  for (const { nom, code } of SOURCE) {
    for (const m of code.matchAll(/\bMLK\.(\w+)/g)) {
      const p = proprietePorteuse(code, m.index!)
      const cle = `${p ? (ROLE_PAR_PROPRIETE[p] ?? 'autre') : 'autre'}:${m[1]}`
      const ligne = code.slice(0, m.index).split('\n').length
      vus.set(cle, [...(vus.get(cle) ?? []), `${nom}:${ligne}`])
    }
  }
  return vus
}

/* ─── L'inventaire, mesuré le 15 août 2026 sur les cinq fichiers ─────────────── */

/**
 * ⚠ LES SURFACES SUR LESQUELLES UNE ENCRE SE POSE VRAIMENT — deux, pas trois.
 *
 * ⛔ LE DÉGRADÉ DE PAGE N'EN EST PAS UNE, et le mesurer serait le piège (g).
 * `MlkBackground` peint `bgGradient` puis pose `color: MLK.ink` dessus ; mais
 * tout le contenu des six écrans vit dans un `MlkShell`, qui est une carte
 * BLANCHE — pied de page et logotype compris, vérifié un par un. Aucune encre de
 * `MLK` n'est jamais rendue sur le dégradé. Y appliquer un seuil enverrait
 * repeindre un écran sain : sur le plus sombre de ses trois arrêts (#C8D5E0),
 * `muted` sort à 2,67:1 et `inkSoft` à 7,28:1.
 */
const SURFACES: Record<string, string> = { card: MLK.card, cardSubtle: MLK.cardSubtle }

/** Clés employées en `color:` — le seuil de TEXTE s'y applique. */
const ENCRES = ['ink', 'inkSoft', 'muted', 'ghost']
/** Clés employées en `stroke=` — le seuil des objets graphiques s'y applique. */
const GLYPHES = ['ink', 'muted']

/**
 * ⛔ LES COUPLES APLAT × ENCRE, DANS LE SENS OÙ ILS SONT PEINTS (n° 37).
 *
 * `MLK` ne porte pas d'objet de pilule (`{bg, fg}`) comme `AX` : l'encre posée
 * sur ses aplats est un `'#fff'` ÉCRIT DANS LE COMPOSANT. Elle est donc recopiée
 * ici — et la clause « l'encre des couples est celle de la source » la confronte
 * au fichier, sinon cet inventaire dériverait sans que rien ne bouge.
 */
const COUPLES: { aplat: string; encre: string; seuil: number; site: string; motif: RegExp }[] = [
  {
    aplat: 'black', encre: '#fff', seuil: AA,
    site: 'MlkPrimitives.tsx — le libellé de MlkBlackPill',
    motif: /background:\s*disabled\s*\?\s*MLK\.ghost\s*:\s*MLK\.black,\s*\n\s*color:\s*'#fff'/,
  },
  {
    // ⛔ LE SITE QUI ROUGIT, et il est le MÊME que les deux précédents : c'est
    // l'état DÉSACTIVÉ du bouton. Le fond descend à #B5BAC2, l'encre reste
    // blanche, et le libellé tombe à 1,95:1. Sixième occurrence de la famille
    // « états désactivés » — le Pipeline avait mesuré exactement 1,95 sur la
    // sienne, et c'était le pire site de son périmètre.
    aplat: 'ghost', encre: '#fff', seuil: AA,
    site: 'MlkPrimitives.tsx — MlkBlackPill DÉSACTIVÉ',
    motif: /background:\s*disabled\s*\?\s*MLK\.ghost\s*:\s*MLK\.black,\s*\n\s*color:\s*'#fff'/,
  },
  {
    aplat: 'black', encre: '#fff', seuil: AA_FORME,
    site: 'MlkBooking.tsx — le glyphe de la pastille de rendez-vous',
    motif: /background:\s*isCancelled\s*\?\s*MLK\.ghost\s*:\s*MLK\.black,/,
  },
  {
    // Même pastille, rendez-vous ANNULÉ : le glyphe blanc sur ghost, 1,95:1.
    aplat: 'ghost', encre: '#fff', seuil: AA_FORME,
    site: 'MlkBooking.tsx — la pastille d’un rendez-vous ANNULÉ',
    motif: /background:\s*isCancelled\s*\?\s*MLK\.ghost\s*:\s*MLK\.black,/,
  },
  {
    aplat: 'black', encre: '#fff', seuil: AA_FORME,
    site: 'MlkScreens.tsx — le disque de confirmation',
    motif: /background:\s*MLK\.black,\s*\n\s*color:\s*'#fff',/,
  },
]

/**
 * ⛔ RÔLES QUI NE PORTENT AUCUN SEUIL, nommés un par un AVEC leur mesure. Une
 * exemption qui nomme une famille en exempte d'autres par accident (n° 21).
 *
 * ⚠ `aplat:cardSubtle` À 1,06:1 SUR LA CARTE N'EST PAS UN DÉFAUT ICI, et il faut
 * le dire pour que le prochain lot ne le rouvre pas. `CLAUDE.md` §3 cite bien ce
 * voisinage comme « l'écart qui ne sépare PAS » — mais il le cite pour le thème
 * SOMBRE, où la séparation vient de la bordure. En clair, l'idiome est la même
 * sous-surface à peine teintée qu'`AX` (n900 sur n1000) et le wizard : exiger
 * 3:1 condamnerait la référence qu'on se donne, ce qui est le signe que le seuil
 * ne décrit pas ce rôle (n° 43).
 *
 * ⚠ `aplat:card` À 1,49:1 SUR LE DÉGRADÉ, même raison inversée : en clair la
 * carte est détachée par l'OMBRE (`shadowLg`), pas par sa luminance. C'est
 * l'idiome écrit dans `CLAUDE.md` §3 pour le clair — « ombres douces SANS
 * bordure ».
 */
const HORS_SEUIL: Record<string, string> = {
  'aplat:card': 'la surface elle-même — détachée du dégradé par shadowLg (1,49:1), idiome clair',
  'aplat:cardSubtle': 'sous-surface (encart, ligne de dépôt, tuile de créneau) — 1,06:1 sur la carte, idiome clair',
  'aplat:bgGradient': 'le dégradé de page — aucune encre de MLK ne s’y pose, voir SURFACES',
  'aplat:black': 'aplat d’affordance — mesuré comme couple avec son encre blanche',
  'aplat:ghost': 'aplat d’état désactivé — mesuré comme couple, et c’est lui qui rougit',
  'filet:black': 'filet d’encre (bordure de la tuile sélectionnée) — 19,57:1, pas une encre',
  'ombre:black': 'anneau inset de la zone de dépôt survolée (2 px), pas une encre',
  'ombre:shadow': 'ombre',
  'ombre:shadowSm': 'ombre',
  'ombre:shadowLg': 'ombre',
  'police:font': 'une pile de polices, pas une couleur',
}

/**
 * ⛔ LES CLÉS SANS LECTEUR. Une clé qui n'est lue nulle part n'est PAS « hors
 * direction » : elle est MORTE, et la nommer supprime le débat (n° 38, ⚠ final).
 *
 * ⚠ ELLES SONT DEUX SUR QUINZE, ET C'EST LA MESURE QUI SURPREND. Le chantier KYC
 * en avait trouvé dix sur trente-cinq, Analytics treize sur trente : on venait
 * ici en attendre autant. `MLK` est au contraire un objet SERRÉ — treize de ses
 * quinze clés ont un lecteur, et douze en ont plus de trois. Le compte est écrit
 * parce qu'il contredit l'attente, pas parce qu'il la confirme.
 *
 * ⚠ ELLE EST VIDE DEPUIS LA DESCENTE (15 août 2026), et c'est l'état visé : les
 * trois clés ont été RETIRÉES plutôt qu'inscrites ici, et `tsc` interdit
 * désormais leur retour. Ce qu'elles étaient reste écrit dans l'en-tête de
 * `mlkTokens.ts` :
 *
 *   · `bg` (#EDEFF3) — le fond plat, sans lecteur. `bgGradient` l'avait
 *     remplacé, et son troisième arrêt porte la même valeur : le jeton avait
 *     survécu à son emploi.
 *   · `shadowHover` — sans lecteur : aucun survol de cette face ne change
 *     d'ombre.
 *   · `blackHover` — il en AVAIT un, et c'est pour ça qu'il est parti autrement :
 *     `MlkBlackPill` porte déjà un `translateY(-1px)` et une ombre renforcée, si
 *     bien que la teinte était un TROISIÈME signal pour le même état. La
 *     direction ne donne pas de variante de ton à l'affordance — même retrait
 *     qu'au chantier KYC sur `kycPalette.blackHover`.
 *
 * La liste vide ne rouvre rien : c'est la clause `orphelines` qui garde la
 * porte, et elle rougit sur TOUTE clé sans lecteur. `MORTES` n'existe que pour
 * le cas où l'on voudrait en tolérer une, et il faudrait alors écrire pourquoi.
 */
const MORTES: string[] = []

/**
 * ⛔ CE QUI N'EST PAS UNE COULEUR SIMPLE, nommé un par un. Tout le RESTE doit se
 * lire, sinon la clause rougit (n° 40 : énumérer les exceptions au lieu de les
 * deviner par une forme, sans quoi une valeur passée en `var(--x)` sortirait du
 * balayage sans un mot).
 */
const NON_COULEURS: Record<string, string> = {
  bgGradient: 'dégradé radial à trois arrêts',
  shadow: 'chaîne de box-shadow',
  shadowSm: 'chaîne de box-shadow',
  shadowLg: 'chaîne de box-shadow',
  font: 'une pile de polices',
}

/**
 * ⚠ LE MOTIF QUI DIT « CETTE FACE A GAGNÉ UN THÈME ». Il rend zéro aujourd'hui
 * sur les six fichiers, `mlkTokens.ts` compris.
 */
const MOTIF_THEME = /\bdark\b|prefers-color-scheme|useDarkTone|useCrmDa|matchMedia|colorScheme|crmSugarPalette|mxCrmPalette/i

describe('Contraste MLK — l’objet de jetons des deux faces publiques', () => {
  /** Sans lui, tout le reste passerait par vacuité sur un balayage cassé. */
  it('le balayage voit la source, et lit toutes les couleurs', () => {
    expect(SOURCE.length, 'zone vide : chemin cassé, pas surface propre').toBe(5)
    for (const { nom, code } of SOURCE) {
      expect(/import\s*\{[^}]*\bMLK\b[^}]*\}\s*from/.test(code), `${nom} ne lie plus MLK : la liaison a changé`).toBe(true)
      expect(code.length, `${nom} vide : une source vidée rendrait tous les tests vrais`).toBeGreaterThan(0)
    }

    // ⚠ TÉMOINS NOMMÉS, jamais un compte (n° 33) : un seuil décrit un ÉTAT et se
    // périme au premier retrait légitime ; un témoin décrit le BALAYAGE.
    const vus = rolesEmployes()
    for (const t of ['texte:ink', 'texte:muted', 'texte:ghost', 'aplat:card', 'aplat:ghost', 'glyphe:ink', 'ombre:black']) {
      expect([...vus.keys()], `rôle non vu : le balayage ne lit plus la source (${t})`).toContain(t)
    }

    const illisibles: string[] = []
    const exemptionsMortes: string[] = []
    for (const [cle, v] of Object.entries(MLK)) {
      if (typeof v !== 'string') { illisibles.push(`${cle} — valeur d'un type inattendu (${typeof v})`); continue }
      if (NON_COULEURS[cle]) {
        // Une exemption qui couvre une VRAIE couleur a dérivé : elle doit
        // rougir, pas protéger.
        if (lisible(v)) exemptionsMortes.push(`${cle} = ${v} — lisible, l'exemption ne se justifie plus`)
        continue
      }
      if (!lisible(v)) illisibles.push(`${cle} = ${v}`)
    }
    for (const cle of Object.keys(NON_COULEURS)) {
      if (!(cle in MLK)) exemptionsMortes.push(`${cle} — exemptée mais absente de MLK`)
    }
    for (const [nom, v] of Object.entries(SURFACES)) if (!lisible(v)) illisibles.push(`surface ${nom} = ${v}`)
    expect(illisibles, `couleur non lue — la garde REFUSE au lieu de sauter :\n  ${illisibles.join('\n  ')}`).toEqual([])
    expect(exemptionsMortes, `exemption périmée :\n  ${exemptionsMortes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ COMBIEN DE THÈMES ON MESURE. Cette face est MONO-THÈME : `MLK` est un objet
   * statique sans branche, et aucun de ses cinq consommateurs ne lit un thème.
   * Le jour où l'un en gagne un, cette garde ne mesurerait plus que la moitié de
   * la vérité — en silence, comme `sugar-v3-contraste` avant sa clause.
   *
   * ⚠ Elle porte AUSSI l'assertion « la clause mesure quelque chose » : sans le
   * témoin sur `MOTIF_THEME`, une expression cassée rendrait zéro partout et la
   * clause passerait au vert pour la mauvaise raison (n° 18).
   */
  it('la face publique n’a qu’un seul thème, et la garde le dit', () => {
    expect(MOTIF_THEME.test('const c = dark ? a : b'), 'le motif de thème ne matche plus rien : la clause ne mesure rien').toBe(true)

    const branches = Object.entries(MLK).filter(([, v]) => typeof v !== 'string').map(([k]) => k)
    expect(branches, `MLK porte une valeur non textuelle — une branche de thème ?\n  ${branches.join('\n  ')}`).toEqual([])

    const jetons = readFileSync(repoPath('src/components/kyc-magic-link/mlkTokens.ts'), 'utf-8')
    const teintes: string[] = []
    for (const { nom, code } of [...SOURCE, { nom: 'src/components/kyc-magic-link/mlkTokens.ts', code: sansCommentaires(jetons) }]) {
      if (MOTIF_THEME.test(code)) teintes.push(nom)
    }
    expect(teintes, `un thème est apparu sur la face publique — cette garde n'en mesure qu'un :\n  ${teintes.join('\n  ')}`).toEqual([])
  })

  /**
   * Clause n° 1 : l'inventaire est confronté à la source. C'est ce qui rend sûres
   * les exemptions de {@link HORS_SEUIL} — le jour où un aplat devient une encre,
   * elle le dit en le nommant (n° 15).
   */
  it('l’inventaire des rôles décrit encore la source', () => {
    const attendus = new Set<string>([
      ...ENCRES.map((c) => `texte:${c}`),
      ...GLYPHES.map((c) => `glyphe:${c}`),
      ...Object.keys(HORS_SEUIL),
    ])
    const vus = rolesEmployes()
    const nouveaux = [...vus.keys()].filter((v) => !attendus.has(v)).sort()
      .map((v) => `${v} — ${vus.get(v)!.slice(0, 3).join(' ')}`)
    const morts = [...attendus].filter((a) => !vus.has(a)).sort()
    expect(nouveaux, `rôle employé sans être mesuré :\n  ${nouveaux.join('\n  ')}`).toEqual([])
    expect(morts, `inscrit mais plus employé — retirer :\n  ${morts.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LES CLÉS SANS LECTEUR SONT NOMMÉES, et la liste ne peut pas dériver : une
   * clé morte qui gagne un lecteur rougit ici, une clé vivante qui le perd aussi.
   *
   * ⚠ Le contrôle est écrit À PART de l'ensemble surveillé (n° 15) : il lit les
   * clés de `MLK` à la source et les confronte à {@link MORTES}. Itérer `MORTES`
   * seule ferait disparaître la clé ET son assertion du même geste.
   */
  it('les clés sans lecteur sont nommées, et ne se réveillent pas en silence', () => {
    const cles = Object.keys(MLK)
    const lues = new Set([...rolesEmployes().keys()].map((r) => r.split(':')[1]!))
    const inconnues = MORTES.filter((m) => !cles.includes(m))
    expect(inconnues, `inscrite comme morte mais absente de MLK :\n  ${inconnues.join('\n  ')}`).toEqual([])
    const reveillees = MORTES.filter((m) => lues.has(m))
    expect(reveillees, `clé morte qui a gagné un lecteur — la mesurer :\n  ${reveillees.join('\n  ')}`).toEqual([])
    const orphelines = cles.filter((c) => !lues.has(c) && !MORTES.includes(c))
    expect(orphelines, `clé sans lecteur, non inscrite — morte ou lue autrement ?\n  ${orphelines.join('\n  ')}`).toEqual([])
  })

  /* ─── Les seuils ─────────────────────────────────────────────────────────── */

  it('les encres tiennent l’AA sur les surfaces', () => {
    const faibles: string[] = []
    for (const [liste, seuil, role] of [[ENCRES, AA, 'texte'], [GLYPHES, AA_FORME, 'glyphe']] as const) {
      for (const cle of liste) {
        const encre = MLK[cle as keyof typeof MLK]
        expect(lisible(encre), `${cle} illisible : ${encre}`).toBe(true)
        for (const [nomSurf, fond] of Object.entries(SURFACES)) {
          const r = contraste(encre, fond)
          if (r < seuil) faibles.push(`${cle} (${encre}) sur ${nomSurf} (${fond}) = ${arrondi(r)}:1 — seuil ${role} ${seuil}`)
        }
      }
    }
    expect(faibles, `sous le seuil :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LE COUPLE, DANS LE SENS OÙ IL EST PEINT (n° 37). `ghost` est déclaré comme
   * une encre — c'est son nom, c'est sa place dans l'échelle — et il sert de FOND
   * à l'état désactivé. Une clause qui ne l'aurait mesuré que comme encre serait
   * passée au vert sur les deux sites où il est un aplat, et réciproquement.
   */
  it('le couple aplat × son encre tient dans les deux sens', () => {
    const faibles: string[] = []
    for (const { aplat, encre, seuil, site } of COUPLES) {
      const fond = MLK[aplat as keyof typeof MLK]
      expect(lisible(fond), `${aplat} illisible : ${fond}`).toBe(true)
      expect(lisible(encre), `l'encre du couple est illisible : ${encre}`).toBe(true)
      const r = contraste(encre, fond)
      if (r < seuil) faibles.push(`${encre} sur ${aplat} (${fond}) = ${arrondi(r)}:1 — seuil ${seuil} · ${site}`)
    }
    expect(faibles, `encre illisible sur son aplat :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ L'ENCRE DES COUPLES EST CONFRONTÉE À LA SOURCE, pas recopiée puis oubliée.
   * `MLK` ne porte pas d'objet `{bg, fg}` : le `'#fff'` est écrit dans le
   * composant, donc {@link COUPLES} est une TRANSCRIPTION — et une transcription
   * qui ne se vérifie pas dérive au premier correctif. Chaque motif est ancré sur
   * le BLOC de style qui porte les deux moitiés, pas sur une ligne.
   */
  it('chaque couple décrit encore un site réel de la source', () => {
    const tout = SOURCE.map((s) => s.code).join('\n')
    const perimes = COUPLES.filter(({ motif }) => !motif.test(tout)).map((c) => `${c.encre} sur ${c.aplat} — ${c.site}`)
    expect(perimes, `couple inscrit qui ne décrit plus la source :\n  ${perimes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ CHAQUE COULEUR DESCEND DE MEGGA X — sauf ce qui est NOMMÉ, avec sa raison
   * et sa mesure (décision de Julien, 15 août 2026).
   *
   * ⚠ ELLE LIT LES DEUX NOTATIONS, ET C'EST TOUT LE POINT. Les quatre ombres de
   * `MLK` ne portaient AUCUN hexadécimal : leur teinte était `rgba(15,23,42,…)`,
   * le gris-bleu slate-900, écrit en décimal. Une clause qui n'extrairait que les
   * `#rrggbb` trouverait zéro teinte dans ces chaînes, passerait son chemin, et
   * déclarerait descendue une palette qui garde la seconde teinte proscrite du
   * dépôt. C'est la forme n° 14 posée dans la clause qui prétend la prévenir —
   * exactement ce qui est arrivé à `analytics-contraste` sur `var(--x)` (n° 40).
   *
   * ⚠ ET C'EST LA PORTE PAR LAQUELLE CETTE TEINTE ENTRE TOUJOURS : une FRACTION
   * D'OPACITÉ. Personne ne relit `rgba(15,23,42,0.04)` en cherchant une couleur.
   */
  it('chaque couleur descend de MEGGA X, sauf celles qui sont nommées', () => {
    /**
     * ⛔ CE QUI RESTE DEHORS EST MESURÉ, PAS SUPPOSÉ.
     */
    const HORS_ECHELLE: Record<string, string> = {
      // ⚠ Reprise TELLE QUELLE de la mesure d'Analytics, et la valeur d'ici est
      // déjà la sienne : entre l'encre et le texte secondaire, `n400` sort à
      // 1,16:1 de `n100` en clair — un DOUBLON, pas un cran. `#3A3D44` tient
      // 10,88:1 sur la carte. Chercher la valeur avant d'en inventer une : le
      // dépôt la portait déjà, au même rôle.
      inkSoft: 'aucun barreau entre l’encre et le texte secondaire — n400 est à 1,16:1 de n100 en clair',
      // ⚠ L'IDENTITÉ DE LA FACE CLIENT, et c'est une décision, pas un oubli.
      // Ce dégradé bleuté et Manrope sont les deux seules choses qui distinguent
      // cet écran du CRM ; il est vu par des clients, pas par des agents. Julien
      // les garde tous les deux (15 août 2026). Le reste descend.
      bgGradient: 'dégradé de page — identité de la face client, gardée avec Manrope',
      font: 'Manrope — la police de cette face, gardée par décision du 15 août 2026',
    }
    const BARREAUX = new Set<string>(Object.values(MXC_COLOR))

    /** Toute couleur d'une chaîne, HEX ET DÉCIMALE, ramenée à son triplet. */
    const teintesDe = (v: string): string[] => [
      ...(v.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []),
      ...[...v.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
        const p = m[1]!.split(/[,/]/).map((s) => parseFloat(s.trim()))
        return '#' + p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')
      }),
    ]
    // Le lecteur des deux notations est éprouvé ICI, pas supposé : sans ça, une
    // expression cassée rendrait « zéro teinte » partout et la clause passerait
    // au vert sur une palette entièrement hors échelle.
    expect(teintesDe('0 4px 16px rgba(15,23,42,0.04)'), 'le lecteur ne voit plus la notation décimale').toEqual(['#0f172a'])
    expect(teintesDe('#686868'), 'le lecteur ne voit plus la notation hexadécimale').toEqual(['#686868'])

    const nus: string[] = []
    const exemptionsMortes: string[] = []
    for (const [cle, v] of Object.entries(MLK)) {
      if (HORS_ECHELLE[cle]) continue
      for (const teinte of teintesDe(v)) {
        if (!BARREAUX.has(teinte.toLowerCase())) nus.push(`${cle} = ${v.slice(0, 70)} → ${teinte} n'est pas un barreau`)
      }
    }
    for (const cle of Object.keys(HORS_ECHELLE)) {
      if (!(cle in MLK)) exemptionsMortes.push(`${cle} — exemptée mais absente de MLK`)
    }
    // ⚠ TÉMOINS NOMMÉS, pas un compte (n° 33) : `> N clés lues` s'était périmé le
    // jour même où dix clés mortes ont été retirées, au chantier KYC.
    for (const t of ['card', 'cardSubtle', 'ink', 'muted', 'ghost', 'black']) {
      expect(Object.keys(MLK), `clé non lue : le découpage a changé (${t})`).toContain(t)
    }
    expect(nus, `couleur écrite à la main, hors de l'échelle MEGGA X :\n  ${nus.join('\n  ')}`).toEqual([])
    expect(exemptionsMortes, `exemption périmée :\n  ${exemptionsMortes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ CE QUE CETTE GARDE NE MESURE PAS, ET POURQUOI C'EST ÉCRIT.
   *
   * Les DEUX couleurs écrites à la main d'`AppointmentManagePage` — la bannière
   * d'erreur `#B42318` sur `#FEF2F2`. Elles n'appartiennent pas à `MLK`, elles
   * ENCODENT une erreur, et elles sont lisibles : 6,01:1 mesuré. Les faire entrer
   * ici ferait de cette spec la garde d'une PAGE au lieu d'un OBJET, ce qui est
   * exactement la confusion que la forme n° 38 décrit.
   *
   * De même l'objet `RC` de `BuyerReceptionPage` : dix clés, mêmes valeurs pour
   * la moitié, et AUCUN lien avec `MLK`. C'est un second objet, donc une seconde
   * garde — pas une rallonge de celle-ci.
   */
  it.skip('les couleurs hors MLK des pages publiques — hors périmètre, voir le commentaire', () => {})
})
