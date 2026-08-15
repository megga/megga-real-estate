/**
 * Garde-fou : sur la RÉCEPTION ACHETEUR (`/reception/:token`), l'encre reste
 * lisible — et cette face n'a, elle non plus, qu'un seul thème.
 *
 * ── POURQUOI UNE SECONDE SPEC, ET PAS UNE RALLONGE DE `mlk-contraste` ────────
 * Parce qu'il y a DEUX objets. Le plan du chantier affirmait que cette page
 * « n'a pas d'objet — ses 8 littéraux sont écrits dans la page » ; mesuré, elle
 * en portait un de DIX clés, simplement pas exportable. La forme n° 38 dit que
 * l'objet est le bon grain : un objet, une spec.
 *
 * ⚠ ET LES FONDRE MASQUERAIT CE QUI COMPTE. `RC` et `MLK` partagent cinq
 * valeurs sur dix — `#FFFFFF`, `#0B0C0E`, `#3A3D44`, `#7A8088` et la même
 * grammaire d'ombres — et divergent sur la sous-surface (`#F4F6F9` contre
 * `#F7F8FA`) et sur le filet, que `MLK` n'a pas. Une garde commune lisserait
 * cette divergence ; deux gardes la rendent visible, et c'est elle qui dira si
 * l'un doit disparaître dans l'autre.
 *
 * ── CE QUE LA MESURE A TROUVÉ (15 août 2026) ─────────────────────────────────
 *   · `muted` (#7A8088) — 15 emplois en `color:`, 3,98:1 sur la carte et 3,68:1
 *     sur la sous-surface. C'est la QUATRIÈME fois que cette valeur exacte est
 *     mesurée sous l'AA dans ce dépôt : `SugarV3`, les trois palettes du
 *     Pipeline, `MLK`, et maintenant ici. Elle voyage par copier-coller, et
 *     aucune des huit specs de contraste ne la cherchait sur cette page.
 *   · Les DIX clés ont un lecteur. Aucune n'est morte — contrairement au KYC
 *     (10 sur 35) et à Analytics (13 sur 30).
 *
 * ── CE QUE CETTE GARDE FIGE ──────────────────────────────────────────────────
 * Les mêmes six disciplines que `mlk-contraste.spec.ts`, sur un autre objet :
 * rôles résolus par le BLOC et confrontés à la source, refus de toute couleur
 * illisible, exemptions ÉNUMÉRÉES, couples dans les deux sens, clés sans
 * lecteur nommées, et le nombre de thèmes déclaré.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { RC, RC_FONT } from '@/components/buyer-reception/receptionTokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import { repoPath, rel } from './helpers/fs-scan'

const AA = 4.5
/** Seuil des éléments NON textuels (WCAG 1.4.11). */
const AA_FORME = 3

/* ─── Lecture de couleur : les deux notations, et le refus de ce qu'on ne lit pas ─ */

/** ⛔ Ancrée sur la chaîne ENTIÈRE (n° 41) : sinon elle trouve une couleur dans une OMBRE. */
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

/** ⚠ Un voile se COMPOSE sur son fond avant d'être mesuré. */
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

/** Le SEUL consommateur. La page est autonome : son unique import de premier niveau était un hook. */
const FICHIER = 'src/pages/public/BuyerReceptionPage.tsx'
const sansCommentaires = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length)).replace(/\/\/[^\n]*/g, ' ')
const NOM = rel(repoPath(FICHIER))
const CODE = sansCommentaires(readFileSync(repoPath(FICHIER), 'utf-8'))

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

function avant(code: string, k: number): number {
  let j = k - 1
  while (j >= 0 && /\s/.test(code[j]!)) j--
  return j
}

/**
 * La propriété colorante dont cette valeur fait partie — à DÉPENDANCE DE BLOC.
 *
 * ⚠ Ici la lecture à la ligne serait particulièrement fausse : cette page écrit
 * ses styles sur des lignes de 200 caractères où cinq propriétés colorantes se
 * suivent. C'est la plus PROCHE à gauche qui compte, et un `:` de ternaire
 * (`background: on ? RC.ink : RC.sub`) ne conclut pas — sinon `ink` deviendrait
 * la « propriété » de `sub`.
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
      if (c === '=' && (code[k + 1] === '=' || ['=', '!', '<', '>'].includes(code[k - 1] ?? ''))) continue
      const m = /([A-Za-z_$][\w$]*)\s*$/.exec(code.slice(0, k))
      if (m && PROPRIETES.has(m[1]!)) return m[1]!
    }
  }
  return null
}

/** Chemins de `RC` employés, avec leur RÔLE — la liaison est l'IMPORT NOMMÉ. */
function rolesEmployes(): Map<string, number[]> {
  const vus = new Map<string, number[]>()
  for (const m of CODE.matchAll(/\bRC\.(\w+)/g)) {
    const p = proprietePorteuse(CODE, m.index!)
    const cle = `${p ? (ROLE_PAR_PROPRIETE[p] ?? 'autre') : 'autre'}:${m[1]}`
    vus.set(cle, [...(vus.get(cle) ?? []), CODE.slice(0, m.index).split('\n').length])
  }
  return vus
}

/* ─── L'inventaire, mesuré le 15 août 2026 ───────────────────────────────────── */

/** ⚠ Les surfaces sur lesquelles une encre se pose VRAIMENT. Le dégradé n'en est pas une :
 *  tout le contenu vit dans une carte, comme sur la face KYC. */
const SURFACES: Record<string, string> = { card: RC.card, sub: RC.sub }

const ENCRES = ['ink', 'soft', 'muted']
const GLYPHES = ['ink', 'soft', 'muted']

/**
 * ⛔ LES COUPLES, DANS LE SENS OÙ ILS SONT PEINTS (n° 37). Comme `MLK`, `RC` ne
 * porte pas d'objet `{bg, fg}` : l'encre posée sur ses aplats est écrite dans la
 * page. La clause qui suit confronte chaque couple au BLOC de style qui porte
 * les deux moitiés — une transcription qui ne se vérifie pas dérive.
 */
const COUPLES: { aplat: string; encre: string; seuil: number; site: string; motif: RegExp }[] = [
  { aplat: 'sub', encre: RC.soft, seuil: AA, site: 'ghostBtn — le bouton secondaire', motif: /background: RC\.sub, color: (RC\.soft)/ },
  { aplat: 'ink', encre: '#fff', seuil: AA_FORME, site: 'le disque de confirmation et son glyphe', motif: /background: RC\.ink, margin: '0 auto'[\s\S]{0,220}?stroke="(#fff)"/ },
  // ⛔ L'ACCENT NE TIENT EN APLAT QUE PARCE QUE SON ENCRE EST BLANCHE
  // (`CLAUDE.md` §3 : 5,78:1). Le mesurer dans ce sens est ce qui empêche
  // qu'un lot inverse l'encre et casse la propriété sur laquelle la règle
  // s'appuie — c'est le défaut corrigé sur `kycPalette.onAccent`.
  { aplat: 'accent', encre: '#fff', seuil: AA, site: 'blackBtn — le bouton principal, actif', motif: /background: RC\.accent, color: '(#fff)'/ },
  { aplat: 'accent', encre: '#fff', seuil: AA, site: 'la pastille de motif SÉLECTIONNÉE', motif: /background: on \? RC\.accent : RC\.sub, color: on \? '(#fff)'/ },
]

/**
 * ⛔ Rôles qui ne portent AUCUN seuil, nommés un par un AVEC leur mesure.
 *
 * ⚠ `aplat:sub` à 1,08:1 sur la carte n'est pas un défaut : en CLAIR la
 * sous-surface à peine teintée est l'idiome du dépôt (`AX` en clair, le wizard,
 * `MLK`). Exiger 3:1 condamnerait la référence qu'on se donne — signe que le
 * seuil ne décrit pas ce rôle (n° 43).
 */
const HORS_SEUIL: Record<string, string> = {
  'aplat:bg': 'le dégradé de page — aucune encre ne s’y pose, tout vit dans une carte',
  'aplat:card': 'la surface elle-même',
  'aplat:sub': 'sous-surface (bouton fantôme, pastilles de motif, champ de note) — 1,08:1, idiome clair',
  'aplat:ink': 'aplat de DONNÉE — initiales, jauge, pastille de compte, disque de fin — mesuré comme couple',
  'aplat:accent': 'aplat d’affordance ACTIVE — mesuré comme couple avec son encre blanche',
  'filet:line': 'filet de séparation, voile assumé',
  'ombre:line': 'le même voile en anneau inset',
  'ombre:shadow': 'ombre',
  'ombre:shadowSm': 'ombre',
  'ombre:sheetShadow': 'ombre de feuille montante',
}

/**
 * ⛔ LES CLÉS SANS LECTEUR — il n'y en a AUCUNE, et c'est mesuré, pas supposé.
 * Les dix clés de `RC` sont lues. La clause `orphelines` garde la porte.
 */
const MORTES: string[] = []

/** ⛔ CE QUI N'EST PAS UNE COULEUR SIMPLE, nommé un par un (n° 40). */
const NON_COULEURS: Record<string, string> = {
  bg: 'dégradé radial à trois arrêts',
  shadow: 'chaîne de box-shadow',
  shadowSm: 'chaîne de box-shadow',
  sheetShadow: 'chaîne de box-shadow',
}

const MOTIF_THEME = /\bdark\b|prefers-color-scheme|useDarkTone|useCrmDa|matchMedia|colorScheme|crmSugarPalette|mxCrmPalette/i

describe('Contraste RC — la réception acheteur, second objet de la face publique', () => {
  it('le balayage voit la source, et lit toutes les couleurs', () => {
    expect(/import \{ RC, RC_FONT as FONT \} from/.test(CODE), `${NOM} ne lie plus RC : la liaison a changé`).toBe(true)
    expect(CODE.length, 'source vide : tous les tests deviendraient vrais').toBeGreaterThan(1000)

    // ⚠ TÉMOINS NOMMÉS, pas un compte (n° 33).
    const vus = rolesEmployes()
    for (const t of ['texte:ink', 'texte:muted', 'aplat:card', 'aplat:ink', 'glyphe:soft', 'ombre:sheetShadow']) {
      expect([...vus.keys()], `rôle non vu : le balayage ne lit plus la source (${t})`).toContain(t)
    }

    const illisibles: string[] = []
    const exemptionsMortes: string[] = []
    for (const [cle, v] of Object.entries(RC)) {
      if (NON_COULEURS[cle]) {
        if (lisible(v)) exemptionsMortes.push(`${cle} = ${v} — lisible, l'exemption ne se justifie plus`)
        continue
      }
      if (!lisible(v)) illisibles.push(`${cle} = ${v}`)
    }
    for (const cle of Object.keys(NON_COULEURS)) {
      if (!(cle in RC)) exemptionsMortes.push(`${cle} — exemptée mais absente de RC`)
    }
    expect(illisibles, `couleur non lue — la garde REFUSE au lieu de sauter :\n  ${illisibles.join('\n  ')}`).toEqual([])
    expect(exemptionsMortes, `exemption périmée :\n  ${exemptionsMortes.join('\n  ')}`).toEqual([])
  })

  /** ⚠ Elle porte l'assertion « la clause mesure quelque chose » AVANT de mesurer (n° 18). */
  it('la réception acheteur n’a qu’un seul thème, et la garde le dit', () => {
    expect(MOTIF_THEME.test('const c = dark ? a : b'), 'le motif de thème ne matche plus rien').toBe(true)
    const branches = Object.entries(RC).filter(([, v]) => typeof v !== 'string').map(([k]) => k)
    expect(branches, `RC porte une valeur non textuelle — une branche de thème ?\n  ${branches.join('\n  ')}`).toEqual([])
    const jetons = sansCommentaires(readFileSync(repoPath('src/components/buyer-reception/receptionTokens.ts'), 'utf-8'))
    const teintes = [[NOM, CODE], ['receptionTokens.ts', jetons]].filter(([, c]) => MOTIF_THEME.test(c!)).map(([n]) => n)
    expect(teintes, `un thème est apparu — cette garde n'en mesure qu'un :\n  ${teintes.join('\n  ')}`).toEqual([])
  })

  it('l’inventaire des rôles décrit encore la source', () => {
    const attendus = new Set<string>([
      ...ENCRES.map((c) => `texte:${c}`),
      ...GLYPHES.map((c) => `glyphe:${c}`),
      ...Object.keys(HORS_SEUIL),
    ])
    const vus = rolesEmployes()
    const nouveaux = [...vus.keys()].filter((v) => !attendus.has(v)).sort()
      .map((v) => `${v} — l. ${vus.get(v)!.slice(0, 4).join(' ')}`)
    const morts = [...attendus].filter((a) => !vus.has(a)).sort()
    expect(nouveaux, `rôle employé sans être mesuré :\n  ${nouveaux.join('\n  ')}`).toEqual([])
    expect(morts, `inscrit mais plus employé — retirer :\n  ${morts.join('\n  ')}`).toEqual([])
  })

  it('les clés sans lecteur sont nommées, et ne se réveillent pas en silence', () => {
    const cles = Object.keys(RC)
    const lues = new Set([...rolesEmployes().keys()].map((r) => r.split(':')[1]!))
    expect(MORTES.filter((m) => !cles.includes(m)), 'inscrite comme morte mais absente de RC').toEqual([])
    expect(MORTES.filter((m) => lues.has(m)), 'clé morte qui a gagné un lecteur — la mesurer').toEqual([])
    const orphelines = cles.filter((c) => !lues.has(c) && !MORTES.includes(c))
    expect(orphelines, `clé sans lecteur, non inscrite :\n  ${orphelines.join('\n  ')}`).toEqual([])
  })

  it('les encres tiennent l’AA sur les surfaces', () => {
    const faibles: string[] = []
    for (const [liste, seuil, role] of [[ENCRES, AA, 'texte'], [GLYPHES, AA_FORME, 'glyphe']] as const) {
      for (const cle of liste) {
        const encre = RC[cle as keyof typeof RC]
        expect(lisible(encre), `${cle} illisible : ${encre}`).toBe(true)
        for (const [nomSurf, fond] of Object.entries(SURFACES)) {
          const r = contraste(encre, fond)
          if (r < seuil) faibles.push(`${cle} (${encre}) sur ${nomSurf} (${fond}) = ${arrondi(r)}:1 — seuil ${role} ${seuil}`)
        }
      }
    }
    expect(faibles, `sous le seuil :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  it('le couple aplat × son encre tient dans les deux sens', () => {
    const faibles: string[] = []
    for (const { aplat, encre, seuil, site } of COUPLES) {
      const fond = RC[aplat as keyof typeof RC]
      expect(lisible(fond), `${aplat} illisible : ${fond}`).toBe(true)
      expect(lisible(encre), `l'encre du couple est illisible : ${encre}`).toBe(true)
      const r = contraste(encre, fond)
      if (r < seuil) faibles.push(`${encre} sur ${aplat} (${fond}) = ${arrondi(r)}:1 — seuil ${seuil} · ${site}`)
    }
    expect(faibles, `encre illisible sur son aplat :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ LA TRANSCRIPTION EST DÉRIVÉE, PAS RECOPIÉE — et c'est un contrôle négatif
   * qui l'a exigé.
   *
   * `COUPLES` déclare l'encre posée sur chaque aplat, parce que `RC` ne porte pas
   * d'objet `{bg, fg}` : elle est écrite dans la page. La clause qui MESURE le
   * couple lit donc cette déclaration, et rien d'autre — inverser l'encre dans la
   * SOURCE la laissait au VERT, puisqu'elle ne regarde pas la source.
   *
   * Le remède n'est pas de mesurer deux fois, c'est de faire CAPTURER l'encre par
   * le motif et d'exiger qu'elle soit celle qu'on a déclarée. La transcription ne
   * peut alors plus dériver en silence : ou le motif ne matche plus (le site a
   * disparu), ou il matche et rend une encre qui doit coïncider.
   */
  it('chaque couple décrit encore un site réel, et son encre vient de la SOURCE', () => {
    const perimes: string[] = []
    const derives: string[] = []
    for (const c of COUPLES) {
      const m = c.motif.exec(CODE)
      if (!m) { perimes.push(`${c.encre} sur ${c.aplat} — ${c.site}`); continue }
      // Le motif capture soit un littéral (`#fff`), soit un chemin (`RC.soft`).
      const brut = m[1]!
      const lu = brut.startsWith('RC.') ? RC[brut.slice(3) as keyof typeof RC] : brut
      if (lu !== c.encre) derives.push(`${c.site} : la source pose « ${brut} » (${lu}), l'inventaire déclare « ${c.encre} »`)
    }
    expect(perimes, `couple inscrit qui ne décrit plus la source :\n  ${perimes.join('\n  ')}`).toEqual([])
    expect(derives, `l'encre déclarée n'est plus celle de la source :\n  ${derives.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ CHAQUE COULEUR DESCEND DE MEGGA X — sauf ce qui est NOMMÉ (décision du
   * 15 août 2026, la même que pour `MLK`).
   *
   * ⚠ ELLE LIT LES DEUX NOTATIONS. Le filet et les trois ombres de `RC` ne
   * portent AUCUN hexadécimal : leur teinte est `rgba(15,23,42,…)`, le gris-bleu
   * slate-900, écrit en décimal. Une clause qui n'extrairait que les `#rrggbb`
   * n'y trouverait rien et déclarerait descendue une palette qui garde la
   * seconde teinte proscrite du dépôt.
   */
  it('chaque couleur descend de MEGGA X, sauf celles qui sont nommées', () => {
    const HORS_ECHELLE: Record<string, string> = {
      // Même mesure qu'`inkSoft` chez `MLK` et Analytics : entre l'encre et le
      // texte secondaire, `n400` sort à 1,16:1 de `n100` en clair — un doublon,
      // pas un cran. La valeur d'ici tient 10,88:1 sur la carte.
      soft: 'aucun barreau entre l’encre et le texte secondaire — n400 est à 1,16:1 de n100 en clair',
      // L'identité de la face client, gardée avec Manrope (décision du 15 août).
      bg: 'dégradé de page — identité de la face client, gardée avec Manrope',
    }
    const BARREAUX = new Set<string>(Object.values(MXC_COLOR))
    const teintesDe = (v: string): string[] => [
      ...(v.match(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g) ?? []),
      ...[...v.matchAll(/rgba?\(([^)]+)\)/g)].map((m) => {
        const p = m[1]!.split(/[,/]/).map((s) => parseFloat(s.trim()))
        return '#' + p.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, '0')).join('')
      }),
    ]
    expect(teintesDe('0 4px 16px rgba(15,23,42,0.04)'), 'le lecteur ne voit plus la notation décimale').toEqual(['#0f172a'])
    expect(teintesDe('#686868'), 'le lecteur ne voit plus la notation hexadécimale').toEqual(['#686868'])

    const nus: string[] = []
    for (const [cle, v] of Object.entries(RC)) {
      if (HORS_ECHELLE[cle]) continue
      for (const teinte of teintesDe(v)) {
        if (!BARREAUX.has(teinte.toLowerCase())) nus.push(`${cle} = ${v.slice(0, 70)} → ${teinte} n'est pas un barreau`)
      }
    }
    const exemptionsMortes = Object.keys(HORS_ECHELLE).filter((c) => !(c in RC)).map((c) => `${c} — exemptée mais absente de RC`)
    for (const t of ['card', 'sub', 'ink', 'accent', 'muted', 'line']) {
      expect(Object.keys(RC), `clé non lue : le découpage a changé (${t})`).toContain(t)
    }
    expect(nus, `couleur écrite à la main, hors de l'échelle MEGGA X :\n  ${nus.join('\n  ')}`).toEqual([])
    expect(exemptionsMortes, `exemption périmée :\n  ${exemptionsMortes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ Manrope est gardée PAR DÉCISION, comme sur la face KYC. La clause l'écrit
   * plutôt que de la laisser passer en silence : c'est une exception assumée,
   * pas un oubli, et elle rougira si quelqu'un la remplace sans le dire.
   */
  it('la police de la face publique est celle qui a été décidée', () => {
    expect(RC_FONT, 'la police de la réception acheteur a changé sans décision').toMatch(/^Manrope,/)
  })
})
