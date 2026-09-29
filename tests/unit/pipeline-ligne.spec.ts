/**
 * Garde-fou : la grammaire LIGNÉE du Pipeline tient (décision Julien, 20.09.2026 ; board à
 * cinq phases depuis le 27.09.2026).
 *
 * ⛔ POURQUOI ELLE EXISTE. Le sombre du CRM est passé d'une PILE de six paliers à une SEULE
 * surface (`MXC_DARK_SURFACE.s0`), et le Pipeline a retiré le fond de ses colonnes : « on doit
 * juste voir les filets ». Rien d'autre ne garde ce geste : quelqu'un qui repeint une colonne à
 * la teinte de sa phase remet des panneaux pleins, et **toutes les portes restent vertes** —
 * aucune n'inspecte le fond d'une colonne.
 *
 * ⚠ La grammaire tient à un TRIPLET, et casser n'importe lequel des trois la défait sans que les
 * deux autres bougent :
 *   1. la colonne n'a pas de fond, et se sépare par un voile ;
 *   2. la phase se BALAIE en filet, en haut de chaque colonne ;
 *   3. la carte porte un filet — parce que son fond ÉGALE le canvas, elle n'a plus que ça.
 *
 * ⚠ Le board d'avant (huit colonnes d'étape) gardait en CLAIR ses colonnes pleines, et cette
 * garde le vérifiait. Le board à cinq phases a le fond NEUTRE dans les deux thèmes (validé par
 * Julien le 27.09.2026) : la clause du clair s'est inversée avec lui.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'
import { crmVoileEncre } from '@/components/crm/tokens'
import { mxCrmPalette } from '@/components/megga-x-crm/tokens'
import { PHASES } from '@/components/crm/pipeline/phases'

const COLONNE = 'src/components/crm/pipeline/PhaseColumn.tsx'
const CARTE = 'src/components/crm/pipeline/AffaireCard.tsx'

function source(chemin: string): string {
  const lu = readFileSafely(repoPath(chemin))
  // Sans cette assertion, un fichier déplacé rendrait TOUTES les clauses
  // suivantes vraies par vacuité — le mode d'échec que ce dépôt connaît déjà.
  expect(lu.status, `${chemin} illisible : la clause ne mesure rien`).toBe('ok')
  if (lu.status !== 'ok') return ''
  // Les commentaires blanchis : la note qui explique un retrait ne doit pas satisfaire la garde.
  return lu.value.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

/** Luminance relative WCAG d'un `#rrggbb`. */
function luminance(hex: string): number {
  return [0, 2, 4]
    .map((i) => parseInt(hex.replace('#', '').slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
    .reduce((acc, c, i) => acc + [0.2126, 0.7152, 0.0722][i] * c, 0)
}
/** Clarté CIELAB — l'unité qui dit si l'œil voit une marche. */
const clarte = (hex: string): number => {
  const y = luminance(hex)
  return y > 0.008856 ? 116 * Math.cbrt(y) - 16 : 903.3 * y
}
/** Compose un voile `rgba(r,g,b,a)` sur un aplat opaque, et rend le `#rrggbb` vu. */
function composite(voile: string, fond: string): string {
  const v = (voile.match(/[\d.]+/g) ?? []).map(Number)
  const a = v[3] ?? 1
  const f = [0, 2, 4].map((i) => parseInt(fond.replace('#', '').slice(i, i + 2), 16))
  return (
    '#' +
    [0, 1, 2]
      .map((i) => Math.round(v[i] * a + f[i] * (1 - a)).toString(16).padStart(2, '0'))
      .join('')
  )
}

describe('Pipeline — la grammaire LIGNÉE tient', () => {
  it('le balayage voit l’arbre — cinq phases, chacune sa teinte', () => {
    expect(PHASES.length, 'plus cinq phases : la suite ne mesure plus ce qu’elle croit').toBe(5)
    for (const p of PHASES) expect(p.teinte, `${p.id} sans teinte`).toMatch(/^#[0-9a-fA-F]{6}$/)
    expect(new Set(PHASES.map((p) => p.teinte)).size, 'deux phases partagent une teinte').toBe(5)
  })

  it('aucune colonne n’a de fond, dans les deux thèmes — seule la zone de dépôt se voile', () => {
    const src = source(COLONNE)
    expect(src, 'le fond de la colonne n’est plus « transparent hors dépôt »')
      .toMatch(/background:\s*cibleDeDepot \? crmVoileEncre\([^)]*\) : 'transparent'/)
    // ⛔ Et aucun aplat ne doit revenir : ni un hex opaque, ni la teinte de la phase.
    expect(src.match(/background:\s*'#[0-9a-fA-F]{6}'/g) ?? [], 'un aplat opaque est revenu').toEqual([])
    expect(src, 'une colonne a repris la teinte de sa phase en fond').not.toMatch(/background:[^\n,]*teinte/)
  })

  it('le séparateur porte SEUL, et son opacité est LUE dans le composant', () => {
    /**
     * ⛔ Une version antérieure composait la constante écrite DANS LE TEST, puis la mesurait :
     * affaiblir le séparateur du composant ne la faisait pas broncher. L'opacité se lit dans la
     * colonne — c'est la différence entre garder le composant et se garder soi-même.
     */
    const src = source(COLONNE)
    const m = /borderLeft:[^\n]*crmVoileEncre\(dark, dark \? (0?\.\d+) : (0?\.\d+)\)/.exec(src)
    expect(m, 'opacité du séparateur illisible : la clause ne mesure rien').not.toBeNull()

    const p = mxCrmPalette(true)
    const alpha = Number(m![1])
    const vu = composite(crmVoileEncre(true, alpha), p.pageBg)
    // ⚠ Le plancher est MESURÉ (20.09.2026) : 0,06 rend ΔL* 6,85, 0,07 rend 7,95 — la ligne y
    // devient limite. 8 est le bord du confort.
    expect(
      clarte(vu) - clarte(p.pageBg),
      `séparateur à ${alpha} → ${vu} : trop faible sur ${p.pageBg}`,
    ).toBeGreaterThanOrEqual(8)
  })

  it('le balayage des phases survit — en FILET, puisque le fond a disparu', () => {
    /**
     * ⛔ CE QUE CETTE CLAUSE PROTÈGE. Sans fond, la phase ne se BALAIE plus que par le filet du
     * haut : mis bout à bout, les cinq gardent l'entonnoir indigo → orange. Le retirer ne
     * casserait AUCUNE autre porte — les colonnes resteraient transparentes, le board perdrait
     * juste son entonnoir, en silence.
     */
    const src = source(COLONNE)
    expect(src, 'le filet de phase a disparu du haut des colonnes')
      .toMatch(/borderTop:\s*`3px solid \$\{phase\.teinte\}`/)

    // Et il doit se VOIR : seuil non-texte 3:1 sur le canvas sombre, les cinq phases.
    const p = mxCrmPalette(true)
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const faibles = PHASES.filter((ph) => ratio(ph.teinte, p.pageBg) < 3)
    expect(
      faibles.map((ph) => `${ph.id} : ${ph.teinte} → ${ratio(ph.teinte, p.pageBg).toFixed(2)}:1`),
      'une teinte de phase ne se détache plus du canvas',
    ).toEqual([])
  })

  it('la carte d’affaire porte un filet — son fond ÉGALE le canvas', () => {
    const p = mxCrmPalette(true)
    // C'est CE fait qui rend le filet obligatoire, et c'est lui qu'on assère d'abord : le jour où
    // les surfaces se rediviseraient, la clause suivante deviendrait une préférence.
    expect(p.cardBg, 'la carte a repris un palier : relire cette garde').toBe(p.pageBg)
    expect(p.shadowSm, 'une ombre est revenue en sombre').toBe('none')

    const src = source(CARTE)
    expect(src, 'la carte d’affaire n’a plus de filet : elle est invisible sur le canvas')
      .toMatch(/sp\.isDark \?\s*`inset 0 0 0 1px \$\{sp\.cardBorder\}`/)
  })
})
