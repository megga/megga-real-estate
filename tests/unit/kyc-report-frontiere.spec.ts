/**
 * Garde-fou : le rapport KYC est du PAPIER, et la frontière est écrite.
 *
 * ── LA QUESTION, ET CE QUE LA MESURE Y RÉPOND ────────────────────────────────
 * `src/components/kyc-report/` porte 104 marqueurs du cliquet de grammaire — 16
 * micro-capitales, 22 graisses ≥ 700, 18 interlettrages positifs, 48 tailles
 * littérales. Le réflexe est de le faire entrer dans le cliquet et de les
 * corriger. **Ce serait une faute**, et elle se démontre :
 *
 *  · `PDF_W = 794`, `PDF_H = 1123` : A4 à 96 DPI EXACTEMENT. Toute la mise en
 *    page est en pixels absolus qui valent des millimètres de papier — un titre
 *    à 14 px fait 14/96 de pouce à l'impression, de façon déterministe.
 *  · Le dossier ne contient **aucun** `var(--crm-…)`. Il ne participe pas à
 *    l'échelle du CRM ; il a la sienne, et elle est métrique.
 *  · Ses sur-titres sont à **9,5 px avec un interlettrage de 0,8 à 1,6**. Aucun
 *    barreau de `--crm-text-*` ne vaut 9,5, et à cette taille sur papier
 *    (≈ 2,5 mm) la capitale espacée est ce qui distingue un marqueur de section
 *    d'une ligne de prose. C'est de la typographie d'imprimé, pas une survivance
 *    de Sugar.
 *
 * Le cliquet de grammaire décrit un ÉCRAN : sa règle de casse vient de ce que la
 * vitrine ne pratique pas la micro-capitale, son plafond de graisse de la façon
 * dont sa police rend à l'écran, son échelle de `globals.css`. Aucune des trois
 * ne parle du papier.
 *
 * ── OÙ PASSE LA FRONTIÈRE, ALORS ─────────────────────────────────────────────
 * Elle ne sépare pas « client » de « agent » — le même dossier est monté par DEUX
 * routes, `/kyc-report/:token` (papier, rendu headless) et
 * `/dashboard/kyc/:id/export` (écran, l'agent). Elle sépare la COMPOSITION du
 * COLORIS :
 *
 *  · la composition (casse, graisse, interlettrage, échelle) suit le SUPPORT, et
 *    le support est le papier → hors du cliquet, et ce fichier dit pourquoi ;
 *  · le coloris ne dépend pas du support → le noir de Sugar et le gris-bleu
 *    slate-900 sont proscrits ICI COMME AILLEURS.
 *
 * ⚠ CETTE EXEMPTION EST ÉCRITE, PAS OMISE. Une zone absente d'un cliquet ne se
 * distingue pas d'un oubli ; c'est pourquoi la première clause EXIGE l'absence
 * et rougit si quelqu'un l'ajoute — il devra alors lire ce qui précède avant de
 * repeindre 104 marqueurs corrects. Même idiome que l'exclusion de `MrhMapView`,
 * « une exemption écrite, pas un oubli qu'on relèverait à la relecture ».
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { repoPath } from './helpers/fs-scan'

const ZONE = 'src/components/kyc-report'
const FICHIERS = readdirSync(repoPath(ZONE))
  .filter((n) => /\.tsx?$/.test(n))
  .map((n) => ({ nom: `${ZONE}/${n}`, code: readFileSync(repoPath(ZONE, n), 'utf-8') }))

const sansCommentaires = (c: string) =>
  c.replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length)).replace(/\/\/[^\n]*/g, ' ')

describe('Rapport KYC — la frontière écran/papier', () => {
  it('le balayage voit la zone', () => {
    expect(FICHIERS.length, 'zone vide : chemin cassé').toBeGreaterThan(4)
    expect(FICHIERS.every((f) => f.code.length > 0)).toBe(true)
  })

  /**
   * ⛔ LA MESURE QUI JUSTIFIE LA FRONTIÈRE, figée pour qu'elle ne se raconte pas.
   * Si le rapport cessait d'être en pixels absolus — s'il se mettait à lire
   * l'échelle du CRM — l'argument tomberait, et cette clause le dirait.
   */
  it('le rapport est composé en dimensions de PAPIER, pas sur l’échelle de l’écran', () => {
    const tokens = readFileSync(repoPath(ZONE, 'tokens.ts'), 'utf-8')
    expect(tokens, 'A4 à 96 DPI — la largeur n’est plus celle du papier').toMatch(/PDF_W\s*=\s*794\b/)
    expect(tokens, 'A4 à 96 DPI — la hauteur n’est plus celle du papier').toMatch(/PDF_H\s*=\s*1123\b/)
    const jetonsEcran = FICHIERS.filter((f) => /var\(--crm-/.test(sansCommentaires(f.code))).map((f) => f.nom)
    expect(
      jetonsEcran,
      `le rapport lit l'échelle de l'ÉCRAN — la frontière ne tient plus, relire l'en-tête :\n  ${jetonsEcran.join('\n  ')}`,
    ).toEqual([])
  })

  /**
   * L'exemption, exigée plutôt que supposée. Elle rougit le jour où quelqu'un
   * ajoute la zone au cliquet de composition — ce qui est exactement le moment
   * où il faut avoir lu pourquoi elle n'y est pas.
   */
  it('la zone reste HORS du cliquet de composition, et c’est une décision', () => {
    const cliquet = readFileSync(repoPath('tests/unit/megga-x-grammar.spec.ts'), 'utf-8')
    const racines = [...cliquet.matchAll(/root:\s*'([^']+)'/g)].map((m) => m[1])
    expect(racines.length, 'le cliquet ne déclare plus de racines — motif cassé').toBeGreaterThan(20)
    expect(
      racines,
      'le rapport PDF est entré dans le cliquet de COMPOSITION. Ses 104 marqueurs sont ' +
        'de la typographie d’imprimé (9,5 px, capitales espacées, A4 à 96 DPI) : les ' +
        'corriger changerait la mise en page du papier. Lire l’en-tête de ce fichier avant de passer outre.',
    ).not.toContain(ZONE)
  })

  /**
   * ⛔ CE QUI, LUI, NE DÉPEND PAS DU SUPPORT. Un noir n'est pas plus « de
   * l'imprimé » qu'un autre : `#0B0C0E` est le noir de Sugar, `rgba(15,23,42,…)`
   * le gris-bleu slate-900, et tous deux sont proscrits partout. Le second
   * entrait ici par une fraction d'opacité — l'ombre de la FEUILLE, qui n'existe
   * qu'à l'écran (l'aperçu de l'agent) et que le rendu headless ne voit même pas.
   */
  it('aucun noir Sugar ni gris-bleu, papier ou pas', () => {
    const NOIRS = /#0B0C0E\b|#0A0A0F\b|#0A0B0D\b|rgba?\(\s*11\s*,\s*12\s*,\s*14\b/i
    const GRIS_BLEU = /#0F172A\b|rgba?\(\s*15\s*,\s*23\s*,\s*42\b/i
    const fautifs: string[] = []
    for (const { nom, code } of FICHIERS) {
      sansCommentaires(code).split('\n').forEach((l, i) => {
        if (NOIRS.test(l)) fautifs.push(`${nom}:${i + 1} — noir de Sugar`)
        if (GRIS_BLEU.test(l)) fautifs.push(`${nom}:${i + 1} — gris-bleu slate-900`)
      })
    }
    expect(fautifs, `teinte proscrite dans le rapport :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })
})
