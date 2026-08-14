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
import { SugarV3 } from '@/components/crm-sugar-v3/tokens'

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

/** Les surfaces que `SugarV3` porte lui-même — une encre s'y pose. */
const SURFACES: Record<string, string> = {
  card: SugarV3.card,
  cardSubtle: SugarV3.cardSubtle,
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
  .filter((s) => s.code.includes('SugarV3.'))

/** Jetons employés en `color:` — donc soumis au seuil de TEXTE. */
function encresEmployees(): Set<string> {
  const vus = new Set<string>()
  for (const { code } of SOURCES) {
    for (const l of code.split('\n')) {
      for (const cle of Object.keys(SugarV3)) {
        if (new RegExp(`(?:^|[^-\\w])color:\\s*[^,;\\n]*\\bSugarV3\\.${cle}\\b`).test(l)) vus.add(cle)
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

describe('Contraste SugarV3 — les encres d’un objet partagé par cinq surfaces', () => {
  it('le balayage voit les lecteurs et lit toutes les valeurs', () => {
    expect(SOURCES.length, 'aucun lecteur trouvé : balayage cassé').toBeGreaterThan(5)
    const illisibles = Object.entries(SugarV3)
      .filter(([, v]) => typeof v === 'string' && /^#|^rgba?\(/.test(v))
      .filter(([, v]) => !canal(v as string))
      .map(([k, v]) => `${k} = ${String(v)}`)
    expect(illisibles, `valeur non lue — la garde REFUSE au lieu de sauter :\n  ${illisibles.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ `SugarV3` est un OBJET STATIQUE : une seule valeur par jeton, donc un seul
   * thème. Cette clause existe pour que le jour où il gagne une branche sombre,
   * la garde ne continue PAS à mesurer la moitié de la vérité en silence.
   */
  it('SugarV3 est mono-thème, et la garde ne mesure donc qu’un thème', () => {
    const src = readFileSync(repoPath('src/components/crm-sugar-v3/tokens.ts'), 'utf-8')
    const bloc = src.slice(src.indexOf('export const SugarV3'), src.indexOf('} as const'))
    expect(
      /\bdark\b/.test(sansCommentaires(bloc)),
      'SugarV3 a gagné une branche de thème : cette garde doit énumérer les surfaces des DEUX thèmes',
    ).toBe(false)
  })

  it('l’inventaire des encres décrit encore la source', () => {
    const vues = [...encresEmployees()].sort()
    const nouvelles = vues.filter((v) => !ENCRES_ATTENDUES.includes(v))
    const mortes = ENCRES_ATTENDUES.filter((a) => !vues.includes(a))
    expect(nouvelles, `jeton devenu une ENCRE sans être mesuré :\n  ${nouvelles.join('\n  ')}`).toEqual([])
    expect(mortes, `inscrit comme encre mais plus employé — retirer :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  it('chaque encre atteint l’AA sur les surfaces de SugarV3', () => {
    const faibles: string[] = []
    for (const jeton of ENCRES_ATTENDUES) {
      const encre = SugarV3[jeton as keyof typeof SugarV3] as string
      for (const [nom, fond] of Object.entries(SURFACES)) {
        const r = contraste(encre, fond)
        expect(r, `contraste non mesurable : ${jeton} sur ${nom}`).not.toBeNull()
        if (r! < AA) faibles.push(`${jeton} (${encre}) sur ${nom} (${fond}) = ${arrondi(r!)}:1`)
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
