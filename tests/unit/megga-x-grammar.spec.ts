/**
 * Garde-fou : la GRAMMAIRE MEGGA X — casse, graisse, interlettrage, échelle de
 * texte — sur les surfaces déjà portées.
 *
 * Pourquoi ce fichier existe. Les Réglages (#1197) et le Calendrier (#1199) ont
 * porté cette grammaire écran par écran sans jamais la figer : rien n'empêchait
 * une micro-capitale de revenir par copier-coller depuis une surface non encore
 * migrée. `megga-x-crm-tokens.spec.ts` verrouille les COULEURS et l'échelle CSS,
 * `calendar-palette.spec.ts` et `wizard-palette.spec.ts` les palettes d'écran —
 * personne ne gardait la composition.
 *
 * ── CLIQUET ──────────────────────────────────────────────────────────────────
 * `ZONES` ne liste que ce qui est PORTÉ. Chaque lot y ajoute sa surface en même
 * temps qu'il la nettoie ; une zone absente n'est pas déclarée propre, elle est
 * déclarée non traitée. Reste à venir sur « Mes biens » :
 * `src/components/crm-sugar/biens` + `BienDetailSugarV4Page` (lot 3),
 * `src/components/crm-mobile/biens` (lot 4).
 *
 * ── CE QUE LA RÈGLE DIT, ET D'OÙ ELLE SORT ───────────────────────────────────
 * Mesuré sur `src/styles/megga-x.generated.css`, la feuille de la vitrine :
 *
 * - **Aucune graisse au-dessus de 600.** Répartition réelle de la vitrine :
 *   500 (×31), 600 (×11), 400 (×7), 200 (×2), 300 (×1), 700 (×1). L'unique 700
 *   est `.megga-x strong` — de l'emphase en ligne dans de la prose, pas un
 *   titre. Les classes `.display-*` (14 → 72 px) ne posent AUCUNE graisse par
 *   défaut : elles héritent, et leurs deux modificateurs plafonnent à
 *   `.medium` (500) et `.semi-bold` (600). C'est donc la couleur d'encre qui
 *   porte la hiérarchie, pas la graisse.
 * - **Aucune micro-capitale**, et l'interlettrage POSITIF qui l'accompagne part
 *   avec elle : sur un mot en casse normale, un `letterSpacing` ≥ 0,4 le
 *   disloque. Le seuil laisse passer les valeurs NÉGATIVES — resserrer un titre
 *   d'affichage est un geste de la direction, pas une survivance.
 * - **Les tailles passent par `var(--crm-text-*)`**, jamais par un littéral
 *   (`CLAUDE.md` §3 : ~4 200 valeurs en variables sur 161 fichiers).
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

/** Surfaces PORTÉES. Un lot qui nettoie une zone l'ajoute ici, pas avant. */
const ZONES = ['src/components/crm-sugar-wizard'] as const

/** La preuve que le scan voit encore l'arbre — sinon tout passe par vacuité. */
const TEMOIN = 'src/components/crm-sugar-wizard/steps/Step7Publish.tsx'

/**
 * Littéraux de taille assumés, EXPRESSION PAR EXPRESSION — pas par fichier.
 *
 * ⚠ Exempter un FICHIER est trop grossier : `primitives.tsx` porte à la fois une
 * taille calculée légitime et un `14.5 : 13` qui, lui, doit descendre sur
 * l'échelle. Une garde qui les couvre des deux d'un coup laisse passer ce
 * qu'elle prétend surveiller.
 *
 * Deux familles seulement, et rien d'autre :
 *
 * 1. **Au-dessus de l'échelle.** `--crm-text-*` s'arrête à 38 px (`9xl`). Ceux-ci
 *    sont des chiffres d'affichage — le prix, la saisie chiffrée, le titre de
 *    confirmation. La vitrine, elle, monte à 72 px sur ses `.display-*` : il y a
 *    donc une VRAIE question d'échelle derrière (faut-il prolonger `--crm-text-*`
 *    au-delà de 38 ?). Elle se décide, elle ne se règle pas au passage d'un lot
 *    de composition. `32 : 40` reste d'un bloc : 32 a bien un barreau (`7xl`),
 *    mais éclater les deux états d'un même titre entre un jeton et un littéral
 *    est pire que de les assumer ensemble.
 * 2. **Calculées.** Une taille qui suit son conteneur ne peut, par construction,
 *    pas être un barreau.
 */
const TAILLES_ASSUMEES: { motif: RegExp; raison: string }[] = [
  {
    motif: /fontSize:\s*Math\.max\(11,\s*size \* 0\.34\)/,
    raison: 'calculée : l’initiale d’un avatar suit le diamètre de sa pastille',
  },
  { motif: /fontSize:\s*104\b/, raison: '104 px — le prix en grand, au-dessus du dernier barreau' },
  { motif: /fontSize:\s*72\b/, raison: '72 px — la saisie chiffrée en grand, au-dessus du barreau' },
  { motif: /fontSize:\s*q === 6 \? 32 : 40\b/, raison: '32/40 px — un même titre à deux densités' },
  { motif: /fontSize:\s*44\b/, raison: '44 px — le titre de confirmation, au-dessus du barreau' },
]

/**
 * Retire commentaires de ligne et de bloc AVANT analyse. Sans ça, la note qui
 * explique un retrait fait rougir la garde : le garde-fou trébuche sur sa
 * propre documentation. Défaut déjà rencontré sur `t.primary`
 * (`megga-x-crm-tokens.spec.ts`).
 */
function sansCommentaires(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/[^\n]*/g, ' ')
}

const scan = scanRoots(ZONES.map((root) => ({ root, keep: (n: string) => /\.tsx?$/.test(n) })))
const sources = scan.files.map((abs) => {
  const lu = readFileSafely(abs)
  return { chemin: rel(abs), code: lu.status === 'ok' ? sansCommentaires(lu.value) : '' }
})

/** `fichier:ligne` de chaque ligne qui satisfait le prédicat. */
function sites(predicat: (ligne: string) => boolean): string[] {
  const trouves: string[] = []
  for (const { chemin, code } of sources) {
    code.split('\n').forEach((ligne, i) => {
      if (predicat(ligne)) trouves.push(`${chemin}:${i + 1}`)
    })
  }
  return trouves
}

describe('Grammaire MEGGA X — casse, graisse, interlettrage, échelle', () => {
  it('le balayage voit l’arbre', () => {
    expect(emptyRoots(scan), 'racine vide : chemin cassé, pas surface propre').toEqual([])
    expect(scan.unreadable).toEqual([])
    expect(scan.files.length).toBeGreaterThan(10)
    expect(sources.map((s) => s.chemin)).toContain(TEMOIN)
    // Une source vidée par un échec de lecture rendrait tous les tests vrais.
    expect(sources.every((s) => s.code.length > 0)).toBe(true)
  })

  /**
   * Les micro-capitales ne sont pas un détail de goût : elles étaient la marque
   * de fabrique de Sugar pour les sur-titres, et MEGGA X n'en a aucun idiome.
   * Les Réglages en ont retiré 10, le Calendrier 12.
   */
  it('aucune micro-capitale', () => {
    const fautifs = sites((l) => /textTransform:\s*'uppercase'/.test(l))
    expect(fautifs, `micro-capitales restantes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * ⚠ Le motif lit l'EXPRESSION entière, pas la valeur qui suit `fontWeight:`.
   * Une première version ancrée sur `fontWeight:\s*[789]00` laissait passer
   * quatre `fontWeight: sel ? 700 : 600` — la graisse y disait l'état
   * sélectionné, en TROISIÈME signal après le fond accentué et l'encre inversée.
   * C'est précisément la forme qu'une garde doit attraper : celle où la valeur
   * proscrite se cache derrière une condition.
   */
  it('aucune graisse au-dessus de 600', () => {
    const fautifs = sites((l) => /fontWeight:[^,}\n]*\b[789]00\b/.test(l))
    expect(fautifs, `graisses ≥ 700 restantes :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Seul l'interlettrage POSITIF est visé, et à partir de 0,4. En dessous il ne
   * se voit pas ; au-dessus de zéro il n'existe que pour aérer des capitales, et
   * appliqué à de la casse normale il disloque le mot. Le négatif est laissé :
   * c'est le resserrement des titres d'affichage, que la vitrine pratique.
   */
  it('aucun interlettrage de micro-capitale', () => {
    const fautifs = sites((l) => {
      for (const m of l.matchAll(/letterSpacing:\s*'?(-?\.?[\d.]+)(em)?'?/g)) {
        const v = Number(m[1])
        if (Number.isNaN(v)) continue
        if (m[2] === 'em' ? v >= 0.04 : v >= 0.4) return true
      }
      return false
    })
    expect(fautifs, `interlettrage positif ≥ 0,4 :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Une taille écrite en dur échappe à l'échelle : elle ne bougera pas si
   * l'échelle bouge, et rien ne signale qu'elle en est sortie. Les exceptions
   * sont NOMMÉES par fichier (`TAILLES_ASSUMEES`) — figer l'écart plutôt que
   * l'interdire, même idiome que les palettes.
   */
  /**
   * ⚠ On efface d'abord les jetons `var(--crm-…)`, PUIS on cherche un chiffre.
   * Ancrer sur « `var(` suit immédiatement `fontSize:` » ne marche que pour la
   * forme la plus simple : un ternaire de deux jetons
   * (`big ? 'var(--crm-text-3xl)' : 'var(--crm-text-lg)'`) est parfaitement
   * tokenisé et se faisait pourtant rejeter. Une garde qui refuse du code
   * correct se fait désarmer, pas corriger.
   */
  it('les tailles de texte sortent de l’échelle', () => {
    const fautifs = sites((ligne) => {
      const sansJetons = ligne.replace(/var\(--crm-[a-z0-9-]*\)/g, "''")
      if (!/fontSize:[^,}\n]*\d/.test(sansJetons)) return false
      return !TAILLES_ASSUMEES.some(({ motif }) => motif.test(ligne))
    })
    expect(fautifs, `tailles hors échelle :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })

  /**
   * Une exemption qui ne correspond plus à rien est un mensonge silencieux : elle
   * laisse croire qu'un écart est surveillé alors que la ligne a disparu.
   */
  it('chaque exemption de taille correspond encore à du code', () => {
    const tout = sources.map((s) => s.code).join('\n')
    const mortes = TAILLES_ASSUMEES.filter(({ motif }) => !motif.test(tout)).map((e) => e.raison)
    expect(mortes, `exemptions sans code :\n  ${mortes.join('\n  ')}`).toEqual([])
  })

  /**
   * Le cliquet doit RESTER un cliquet : une zone retirée de `ZONES` désarmerait
   * les tests ci-dessus en silence, et le fichier resterait vert.
   */
  it('le cliquet ne recule pas', () => {
    expect(ZONES).toContain('src/components/crm-sugar-wizard')
  })
})
