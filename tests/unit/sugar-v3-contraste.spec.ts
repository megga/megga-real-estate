/**
 * Garde-fou : les encres de `SugarV3` sont lisibles sur ses propres surfaces.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * `crm-sugar-v3/tokens.ts` est entré dans le cliquet de GRAMMAIRE au lot 2 du
 * chantier KYC — mais le cliquet mesure la composition, jamais la couleur. Cet
 * objet alimente CINQ surfaces (Visites ×3, Audit ×2, Import lead, plus le
 * wizard KYC et les primitives partagées), et son `muted` valait `#7A8088` :
 * **3,98:1 sur sa propre carte blanche, employé 66 fois en `color:`**. Le défaut
 * était connu et laissé de côté pendant six lots, parce que le corriger depuis un
 * lot KYC aurait repeint quatre écrans hors périmètre.
 *
 * ⛔ ET IL N'ÉTAIT PAS SEUL. En mesurant pour le corriger, trois autres encres
 * sont sorties sous l'AA — `err` (4 sites), `ghost` (1) et `warn` (1). On ne les
 * cherchait pas : la demande ne portait que sur `muted`. C'est la vacuité n°15
 * dans sa forme la plus banale — on ne trouve que ce qu'on a nommé, et personne
 * n'avait jamais nommé les encres de cet objet.
 *
 * ── CE QUE LA GARDE FIGE ─────────────────────────────────────────────────────
 * 1. Tout jeton employé en `color:` atteint l'AA sur les surfaces de `SugarV3`.
 * 2. L'inventaire de ces jetons est CONFRONTÉ à la source : un jeton qui devient
 *    une encre fait rougir tant qu'on ne l'a pas mesuré. C'est ce qui rend sûre
 *    l'exemption des tons employés en APLAT ou en GLYPHE, qui ne portent aucun
 *    seuil de texte.
 * 3. `SugarV3` est MONO-THÈME, et la clause le dit : c'est un objet statique,
 *    sans branche sombre. Le jour où il en gagne une, cette garde ne mesure plus
 *    que la moitié de la vérité — et elle rougira pour le signaler.
 *
 * ⚠ Les teintes SÉMANTIQUES ne sont pas exemptées de LISIBILITÉ. `err` et `warn`
 * encodent une information et restent donc hors de la direction — mais une encre
 * illisible n'encode plus rien. Le dépôt possède déjà leurs variantes foncées
 * pour le clair (`#B91C1C`, `#B45309`, mesurées dans `EtatVide` et le rapport
 * PDF) : c'est la teinte VIVE qui va sur les aplats, la FONCÉE qui va sur le
 * texte.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { repoPath, rel } from './helpers/fs-scan'
import { sugarV3Palette } from '@/components/crm-sugar-v3/tokens'

const AA = 4.5

/** Lit `#rgb`, `#rrggbb`, `rgb()` et `rgba()`. Rend `null` sur ce qu'elle ignore. */
function canal(c: string): [number, number, number, number] | null {
  const rgb = c.match(/rgba?\(([^)]+)\)/i)
  if (rgb) {
    const p = rgb[1]!.split(/[,/]/).map((s) => parseFloat(s.trim()))
    return [p[0]!, p[1]!, p[2]!, p.length > 3 ? p[3]! : 1]
  }
  const h = c.replace('#', '')
  if (!/^[0-9a-f]{3}$|^[0-9a-f]{6}$/i.test(h)) return null
  const p = h.length === 3 ? [...h].map((x) => x + x).join('') : h
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(p.slice(i, i + 2), 16))
  return [r!, g!, b!, 1]
}
function luminance(c: [number, number, number, number]): number {
  const f = (v: number) => { const x = v / 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4) }
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
}
function contraste(encre: string, fond: string): number | null {
  const e = canal(encre), f = canal(fond)
  if (!e || !f) return null
  const compose: [number, number, number, number] = e[3] >= 1 ? e
    : [e[0] * e[3] + f[0] * (1 - e[3]), e[1] * e[3] + f[1] * (1 - e[3]), e[2] * e[3] + f[2] * (1 - e[3]), 1]
  const [a, b] = [luminance(compose), luminance(f)].sort((x, y) => y - x)
  return (a! + 0.05) / (b! + 0.05)
}
const arrondi = (n: number) => Math.round(n * 100) / 100

/**
 * ⛔ LES DEUX THÈMES, depuis que `SugarV3` est une FONCTION (16 août 2026).
 *
 * La clause « SugarV3 est mono-thème » de ce fichier avait été écrite pour
 * rougir ce jour-là, et elle a rougi. Ce qui la remplace ne se contente pas de
 * lever l'interdit : il DOUBLE la mesure. Une encre lisible en clair peut être
 * illisible en sombre — c'est même le cas le plus fréquent, puisque les variantes
 * FONCÉES (`errDarker`, `warnDarker`) sont faites pour écrire sur du blanc.
 */
const THEMES = [
  { nom: 'clair', p: sugarV3Palette(false) },
  { nom: 'sombre', p: sugarV3Palette(true) },
] as const

/** Les surfaces que la palette porte elle-même — une encre s'y pose. */
function surfacesDe(p: ReturnType<typeof sugarV3Palette>): Record<string, string> {
  return { card: p.card, cardSubtle: p.cardSubtle }
}

/* ─── L'inventaire des rôles, confronté à la source ──────────────────────── */

const SKIP = new Set(['node_modules', '_archived'])
function balayer(dir: string, acc: string[]): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(e.name)) continue
    const p = join(dir, e.name)
    const estDossier = e.isSymbolicLink() ? statSync(p).isDirectory() : e.isDirectory()
    if (estDossier) balayer(p, acc)
    else if (/\.tsx?$/.test(e.name)) acc.push(p)
  }
  return acc
}
const sansCommentaires = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length)).replace(/\/\/[^\n]*/g, ' ')

const SOURCES = balayer(repoPath('src'), [])
  .map((p) => ({ nom: rel(p), code: sansCommentaires(readFileSync(p, 'utf-8')) }))
  .filter((s) => /\bsugarV3Palette\b/.test(s.code))

/** Jetons employés en `color:` — donc soumis au seuil de TEXTE. */
function encresEmployees(): Set<string> {
  const vus = new Set<string>()
  for (const { code } of SOURCES) {
    for (const l of code.split('\n')) {
      for (const cle of Object.keys(THEMES[0].p)) {
        // ⚠ La palette est reçue sous le nom `S` chez tous ses lecteurs (contrat
        // du port). Ancrer sur `S.` ET sur un nom de clé CONNU évite qu'un `s.`
        // de boucle (VdShared mappe sur `.map((s) => …)`) se fasse compter.
        if (new RegExp(`(?:^|[^-\\w])color:\\s*[^,;\\n]*\\bS\\.${cle}\\b`).test(l)) vus.add(cle)
      }
    }
  }
  return vus
}

/**
 * ⛔ INVENTAIRE MESURÉ, pas supposé. Relevé le 16 août 2026 sur les neuf fichiers
 * qui lisent cet objet. Tout ce qui n'y figure pas n'est PAS une encre : `card`,
 * `cardSubtle`, `accent`, `ok`, `okDark` et les `*Soft` sont des APLATS ou des
 * GLYPHES, et leur appliquer un seuil de texte enverrait repeindre un écran sain.
 */
const ENCRES_ATTENDUES = ['ink', 'inkSoft', 'muted', 'errDarker', 'warnDarker']

/**
 * ⛔ LES ENCRES DE L'APLAT INVERSÉ — une famille À PART, et c'est une décision.
 *
 * `invInk` et `invInkSoft` sont bien employés en `color:`, donc la clause
 * d'inventaire les voit — et elle a eu raison de les refuser tant qu'ils n'étaient
 * pas qualifiés. Mais les mesurer sur `card`/`cardSubtle` serait un contresens :
 * ils ne s'y posent JAMAIS. Leur surface est `invBg`, et elle est l'inverse de la
 * carte par construction — une encre qui passe sur l'une échoue forcément sur
 * l'autre.
 *
 * Ils sont donc mesurés, mais contre leur propre fond, par la clause « l'aplat
 * inversé porte son encre ». Les inscrire ici les exempterait ; les laisser dans
 * `ENCRES_ATTENDUES` les mesurerait au mauvais endroit. La troisième voie est de
 * NOMMER la famille.
 */
const ENCRES_INVERSEES = ['invInk', 'invInkSoft']

/**
 * ⚠ TROISIÈME FAMILLE, et elle naît du même raisonnement que la deuxième :
 * `accentInk` est bien une encre, mais son fond est l'APLAT D'ACCENT — jamais la
 * carte. La mesurer sur `card` dirait qu'un blanc sur blanc est fautif, ce qui
 * est vrai mais hors sujet : ce blanc-là ne se pose pas là.
 *
 * ⛔ Elle ne bascule PAS, contrairement à `invInk`, et c'est ce qui la distingue :
 * l'aplat d'accent vaut #424bfb dans les deux thèmes (c'est un RÔLE), donc son
 * encre reste blanche. Un jeton apparié dont un seul côté bascule est le défaut
 * que ce fichier garde ; ici, aucun des deux ne bascule, et c'est correct.
 */
const ENCRES_SUR_ACCENT = ['accentInk']

describe('Contraste SugarV3 — les encres d’un objet partagé par cinq surfaces', () => {
  it('le balayage voit les lecteurs et lit toutes les valeurs', () => {
    expect(SOURCES.length, 'aucun lecteur trouvé : balayage cassé').toBeGreaterThan(5)
    const illisibles = THEMES.flatMap(({ nom, p }) =>
      Object.entries(p)
        .filter(([, v]) => typeof v === 'string' && /^#|^rgba?\(/.test(v))
        .filter(([, v]) => !canal(v as string))
        .map(([k, v]) => `${nom}.${k} = ${String(v)}`))
    expect(illisibles, `valeur non lue — la garde REFUSE au lieu de sauter :\n  ${illisibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ L'INVERSE DE LA CLAUSE QU'ELLE REMPLACE, et c'est le point.
   *
   * Ce fichier interdisait à `SugarV3` d'avoir une branche de thème — non pas
   * parce qu'une branche était mauvaise, mais pour que la garde ne continue PAS
   * à mesurer la moitié de la vérité en silence le jour où elle arriverait. Elle
   * est arrivée. La clause exige donc désormais que les deux thèmes soient
   * RÉELLEMENT distincts : si `sugarV3Palette` cessait de brancher, tout ce
   * fichier repasserait au vert en ne mesurant qu'un thème deux fois.
   */
  it('les deux thèmes sont distincts — sinon la garde mesure deux fois le même', () => {
    const [clair, sombre] = [THEMES[0].p, THEMES[1].p]
    const differents = Object.keys(clair).filter(
      (k) => clair[k as keyof typeof clair] !== sombre[k as keyof typeof sombre],
    )
    expect(
      differents.length,
      'les deux thèmes rendent les mêmes valeurs : la branche sombre a disparu, ' +
        'et les clauses ci-dessous ne mesurent plus qu’un thème',
    ).toBeGreaterThan(8)
    // ⚠ Et les SURFACES doivent bouger, pas seulement des détails : c'est sur
    // elles que se pose chaque encre.
    expect(clair.card, 'la carte ne bascule pas').not.toBe(sombre.card)
    expect(clair.cardSubtle, 'la sous-carte ne bascule pas').not.toBe(sombre.cardSubtle)
    // ⛔ La sous-carte se CREUSE en sombre — plus sombre que la carte, quand en
    // clair elle est plus grise que le blanc (CLAUDE.md §3, « MEGGA X les creuse »).
    expect(canal(sombre.cardSubtle)![0], 'la sous-carte sombre doit être CREUSÉE sous la carte')
      .toBeLessThan(canal(sombre.card)![0])
  })

  /**
   * ⛔ L'APLAT INVERSÉ EST UNE PAIRE, et une paire se garde des DEUX côtés.
   *
   * Six surfaces peignaient `background: ink` + `color: '#fff'`. Thémer `ink`
   * sans son encre les aurait rendues blanc-sur-blanc en sombre. La clause exige
   * que le couple contraste dans les deux thèmes — c'est ce qui empêche qu'on
   * rethème un seul des deux jetons plus tard.
   */
  it('l’aplat inversé porte son encre dans les deux thèmes', () => {
    const faibles: string[] = []
    // ⚠ DEUX aplats inversés, pas un : `invBgSoft` distingue l'acteur HUMAIN du
    // SYSTÈME dans les lignes d'audit. Ne mesurer que `invBg` laisserait passer
    // exactement le défaut trouvé au rendu — cinq pastilles à 1,06:1.
    for (const { nom, p } of THEMES) {
      for (const fond of ['invBg', 'invBgSoft'] as const) {
        for (const jeton of ENCRES_INVERSEES) {
          const encre = p[jeton as keyof typeof p] as string
          const r = contraste(encre, p[fond])
          expect(r, `contraste non mesurable : ${jeton} sur ${fond} (${nom})`).not.toBeNull()
          if (r! < AA) faibles.push(`${nom} : ${jeton} (${encre}) sur ${fond} (${p[fond]}) = ${arrondi(r!)}:1`)
        }
      }
      // ⛔ ET LES DEUX APLATS RESTENT DISTINCTS : leur écart de teinte ENCODE
      // l'acteur. Les fondre ferait mentir une marque de donnée.
      expect(p.invBg, `${nom} : les deux aplats inversés se confondent — l'acteur n'est plus lisible`)
        .not.toBe(p.invBgSoft)
      // L'encre de l'APLAT D'ACCENT, sur son propre fond — troisième famille.
      for (const jeton of ENCRES_SUR_ACCENT) {
        const encre = p[jeton as keyof typeof p] as string
        const r = contraste(encre, p.accent)
        expect(r, `contraste non mesurable : ${jeton} sur accent (${nom})`).not.toBeNull()
        if (r! < AA) faibles.push(`${nom} : ${jeton} (${encre}) sur accent (${p.accent}) = ${arrondi(r!)}:1`)
      }
    }
    // ⛔ ET L'APLAT INVERSÉ DOIT VRAIMENT S'INVERSER. Sans cette ligne, peindre
    // `invBg` de la même valeur dans les deux thèmes passerait — or c'est
    // exactement le défaut d'origine : un jeton apparié dont un seul côté bascule.
    expect(THEMES[0].p.invBg, 'l’aplat inversé ne bascule pas').not.toBe(THEMES[1].p.invBg)
    expect(THEMES[0].p.invBgSoft, 'le second aplat inversé ne bascule pas').not.toBe(THEMES[1].p.invBgSoft)
    expect(THEMES[0].p.invInk, 'l’encre de l’aplat inversé ne bascule pas').not.toBe(THEMES[1].p.invInk)
    expect(faibles, `l'encre de l'aplat inversé est illisible :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  it('l’inventaire des encres décrit encore la source', () => {
    const vues = [...encresEmployees()].sort()
    const nouvelles = vues.filter(
      (v) => ![...ENCRES_ATTENDUES, ...ENCRES_INVERSEES, ...ENCRES_SUR_ACCENT].includes(v),
    )
    const mortes = ENCRES_ATTENDUES.filter((a) => !vues.includes(a))
    expect(nouvelles, `jeton devenu une ENCRE sans être mesuré :\n  ${nouvelles.join('\n  ')}`).toEqual([])
    expect(mortes, `inscrit comme encre mais plus employé — retirer :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  it('chaque encre atteint l’AA sur les surfaces des DEUX thèmes', () => {
    const faibles: string[] = []
    for (const { nom: theme, p } of THEMES) {
      for (const jeton of ENCRES_ATTENDUES) {
        const encre = p[jeton as keyof typeof p] as string
        for (const [nom, fond] of Object.entries(surfacesDe(p))) {
          const r = contraste(encre, fond)
          expect(r, `contraste non mesurable : ${theme}.${jeton} sur ${nom}`).not.toBeNull()
          if (r! < AA) faibles.push(`${theme} : ${jeton} (${encre}) sur ${nom} (${fond}) = ${arrondi(r!)}:1`)
        }
      }
    }
    expect(faibles, `encre sous l'AA :\n  ${faibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ CE QUE CETTE GARDE NE MESURE PAS, ET POURQUOI C'EST ÉCRIT.
   *
   * Les tons vifs `ok`/`warn`/`err` servent aussi d'APLAT sous une encre blanche
   * (`KypPill` rend `background: tone, color: '#fff'`). Une première version de ce
   * fichier l'assertait au seuil non textuel et rougissait — blanc sur `ok` rend
   * 2,54:1, sur `warn` 2,15:1.
   *
   * ⚠ Ce n'est PAS le défaut qu'on corrige ici, et l'affirmer aurait été la faute
   * décrite par le piège (g) : appliquer un seuil à un rôle qu'on n'a pas
   * qualifié. Le couple « teinte vive + encre blanche » est une question
   * ANTÉRIEURE et déjà tranchée ailleurs — `CLAUDE.md` §3 le dit noir sur blanc :
   * « Sugar Pure était DÉJÀ sous l'AA sur ses pilules (orange+blanc 4,37:1) ; le
   * test le CONSTATE au lieu de le graver. » La rouvrir depuis un lot qui répare
   * des ENCRES repeindrait des pastilles que personne n'a signalées.
   *
   * Elle reste donc dehors, nommée. Ce fichier garde les encres ; les pilules
   * relèvent d'une décision produit à part.
   */
  it.skip('les pilules à teinte vive — hors périmètre, voir le commentaire', () => {})
})
