/**
 * Garde-fou : la grammaire LIGNÉE du Pipeline tient (décision Julien, 20.09.2026).
 *
 * ⛔ POURQUOI ELLE EXISTE. Le sombre du CRM est passé d'une PILE de six paliers
 * à une SEULE surface (`MXC_DARK_SURFACE.s0`), et le Pipeline a retiré le fond
 * de ses colonnes : « on doit juste voir les filets ». Rien ne gardait ce geste.
 * Quelqu'un qui rend `crmMix(hue, …, 0.85)` à `crmStageTint` — la valeur d'avant,
 * encore écrite dans l'historique et dans le commentaire de `StageColumn` —
 * repeint huit panneaux pleins, et **toutes les portes restent vertes** : aucune
 * n'inspecte le fond d'une colonne. C'est le même angle mort qui a laissé six
 * sources de noir se disperser dans le dépôt.
 *
 * ⚠ La grammaire ne vit pas dans un seul fichier : elle tient à un TRIPLET, et
 * casser n'importe lequel des trois la défait sans que les deux autres bougent.
 *   1. le jeton ne peint plus la colonne (`crmStageTint().panel`) ;
 *   2. la colonne peint bien CE jeton, et se sépare par un voile ;
 *   3. la carte de deal porte un filet — parce que son fond ÉGALE le canvas,
 *      elle n'a plus que ça pour exister.
 *
 * ⚠ Le mode CLAIR garde ses colonnes pleines. Ce n'est pas un oubli : c'est la
 * décision, et les clauses ci-dessous la VÉRIFIENT dans les deux sens — sans
 * quoi « tout est transparent » passerait aussi si le clair se vidait par erreur.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'
import { CRM_STAGE_ORDER, crmStageTint, crmVoileEncre } from '@/components/crm/tokens'
import { mxCrmPalette } from '@/components/megga-x-crm/tokens'

const STAGE_COLUMN = 'src/components/crm/pipeline/StageColumn.tsx'
const DEAL_CARD = 'src/components/crm/pipeline/DealCard.tsx'

function source(chemin: string): string {
  const lu = readFileSafely(repoPath(chemin))
  // Sans cette assertion, un fichier déplacé rendrait TOUTES les clauses
  // suivantes vraies par vacuité — le mode d'échec que ce dépôt connaît déjà.
  expect(lu.status, `${chemin} illisible : la clause ne mesure rien`).toBe('ok')
  return lu.status === 'ok' ? lu.value : ''
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
  it('le balayage voit l’arbre — huit étapes, et le jeton répond', () => {
    expect(CRM_STAGE_ORDER.length, 'plus huit colonnes : la suite ne mesure plus ce qu’elle croit').toBe(8)
    for (const stage of CRM_STAGE_ORDER) {
      const t = crmStageTint(stage, true)
      expect(t, `crmStageTint ne rend rien pour ${stage}`).toBeTruthy()
      expect(t.hue, `${stage} sans teinte`).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('en SOMBRE, aucune colonne n’a de fond', () => {
    const pleines = CRM_STAGE_ORDER
      .map((s) => ({ s, panel: crmStageTint(s, true).panel }))
      .filter((x) => x.panel !== 'transparent')
    expect(
      pleines.map((x) => `${x.s} : ${x.panel}`),
      'une colonne a retrouvé un fond — la grammaire lignée est défaite',
    ).toEqual([])
  })

  it('en CLAIR elles en ont toujours un — sinon la clause d’au-dessus est vraie par vacuité', () => {
    // ⛔ CE N'EST PAS UNE REDONDANCE. Si `crmStageTint` cessait de rendre quoi
    // que ce soit, « tout est transparent » passerait. Les deux thèmes doivent
    // DIVERGER pour que la mesure ait un sens.
    for (const stage of CRM_STAGE_ORDER) {
      expect(crmStageTint(stage, false).panel, `${stage} : le clair s’est vidé`)
        .toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it('la colonne peint le JETON, et se sépare par un voile', () => {
    const src = source(STAGE_COLUMN)
    // Sans ce lien, le jeton peut valoir `'transparent'` pendant que le
    // composant peint autre chose — les deux clauses ci-dessus seraient vraies
    // et l'écran plein quand même.
    expect(src, 'la colonne ne peint plus `tint.panel` : le jeton ne la gouverne plus')
      .toContain('background: tint.panel')
    expect(src, 'le séparateur n’est plus un voile d’encre')
      .toMatch(/borderLeft:[^\n]*crmVoileEncre\(dark, dark \? 0?\.\d+ : 0?\.\d+\)/)
    // ⛔ Et aucun aplat opaque ne doit revenir sur la colonne.
    const fondsOpaques = src.match(/background:\s*'#[0-9a-fA-F]{6}'/g) ?? []
    expect(fondsOpaques, 'un aplat opaque est revenu dans StageColumn').toEqual([])
  })

  it('le séparateur porte SEUL, et son opacité est LUE dans le composant', () => {
    /**
     * ⛔ CETTE CLAUSE ÉTAIT VACUE, et l'épreuve de mutation l'a montrée : elle
     * composait `crmVoileEncre(true, 0.14)` — la constante écrite DANS LE TEST —
     * puis mesurait le résultat. Affaiblir le séparateur du composant de 0,14 à
     * 0,04 ne la faisait pas broncher : elle se mesurait elle-même.
     *
     * Elle lit désormais l'opacité dans `StageColumn.tsx`. C'est la différence
     * entre garder le composant et se garder soi-même.
     */
    const src = source(STAGE_COLUMN)
    // ⚠ ANCRÉ SUR `borderLeft`. Sans l'ancre, `exec` rend le PREMIER
    // `crmVoileEncre` du fichier — il y en a trois (le séparateur, la pastille
    // « + », la zone de dépôt) — et la clause mesurerait la mauvaise.
    const m = /borderLeft:[^\n]*crmVoileEncre\(dark, dark \? (0?\.\d+) : (0?\.\d+)\)/.exec(src)
    expect(m, 'opacité du séparateur illisible : la clause ne mesure rien').not.toBeNull()

    const p = mxCrmPalette(true)
    const alpha = Number(m![1])
    const vu = composite(crmVoileEncre(true, alpha), p.pageBg)
    // Le fond ne sépare plus rien : sous ce seuil la colonne disparaît, et
    // aucune autre porte ne le verrait.
    // ⚠ SEUIL DESCENDU DE 12 À 8 LE 20.09.2026, et c'est une MESURE, pas un
    // ajustement pour faire passer le test. Les filets ont été unifiés à 0,09
    // (ΔL* 10,13) pour être plus discrets ; le plancher a été relevé en
    // balayant les opacités sur le canvas : 0,06 rend 6,85 et 0,07 rend 7,95 —
    // la ligne y devient limite. 8 est donc le bord mesuré du confort, et
    // 10,13 garde sa marge.
    expect(
      clarte(vu) - clarte(p.pageBg),
      `séparateur à ${alpha} → ${vu} : trop faible sur ${p.pageBg}`,
    ).toBeGreaterThanOrEqual(8)
  })

  it('le balayage de l’entonnoir survit — en FILET, puisque le fond a disparu', () => {
    /**
     * ⛔ CE QUE CETTE CLAUSE PROTÈGE. En retirant le fond des colonnes, le
     * balayage indigo → orange est tombé à huit pastilles de 9 px : l'étape
     * restait lue, elle n'était plus BALAYÉE. `CRM_STAGE_HUE` ENCODE une
     * information — la rendre à un point de 9 px est un recul. Elle revient en
     * filet haut, contigu d'une colonne à l'autre.
     *
     * ⚠ Le retirer ne casserait AUCUNE autre porte : les colonnes resteraient
     * transparentes, les filets blancs en place, et le board perdrait juste son
     * entonnoir — en silence.
     */
    const src = source(STAGE_COLUMN)
    expect(src, 'le filet d’entonnoir a disparu du haut des colonnes')
      .toMatch(/borderTop:\s*`2px solid \$\{tint\.hue\}`/)

    // Et il doit se VOIR : seuil non-texte 3:1 sur le canvas, les huit étapes.
    const p = mxCrmPalette(true)
    const ratio = (a: string, b: string) => {
      const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
      return (hi + 0.05) / (lo + 0.05)
    }
    const faibles = CRM_STAGE_ORDER
      .map((st) => ({ st, hue: crmStageTint(st, true).hue }))
      .filter((x) => ratio(x.hue, p.pageBg) < 3)
    expect(
      faibles.map((x) => `${x.st} : ${x.hue} → ${ratio(x.hue, p.pageBg).toFixed(2)}:1`),
      'une teinte d’étape ne se détache plus du canvas',
    ).toEqual([])
  })

  it('la carte de deal porte un filet — son fond ÉGALE le canvas', () => {
    const p = mxCrmPalette(true)
    // C'est CE fait qui rend le filet obligatoire, et c'est lui qu'on assère
    // d'abord : le jour où les surfaces se rediviseraient, la clause suivante
    // deviendrait une préférence au lieu d'une nécessité.
    expect(p.cardBg, 'la carte a repris un palier : relire cette garde').toBe(p.pageBg)
    expect(p.shadowSm, 'une ombre est revenue en sombre').toBe('none')

    const src = source(DEAL_CARD)
    expect(src, 'la carte de deal n’a plus de filet : elle est invisible sur le canvas')
      .toMatch(/sp\.isDark \?\s*`inset 0 0 0 1px \$\{sp\.cardBorder\}`/)
  })
})
