/**
 * Garde-fou : QUELLE POLICE A DROIT DE CITÉ, ET OÙ — la frontière tranchée par
 * Julien le 15 août 2026, écrite au lieu d'être constatée.
 *
 * ── CE QUI A RENDU CETTE CLAUSE NÉCESSAIRE ───────────────────────────────────
 * CLAUDE.md §3 affirmait que Manrope était, avec le dégradé bleuté, « la seule
 * chose qui distingue ces écrans du CRM ». Mesuré : FAUX. `MOBILE_FONT` vaut
 * Manrope et alimente 34 emplois dans 23 fichiers du CRM mobile, et NEUF
 * fichiers du CRM de BUREAU l'écrivaient aussi — Analytics, « Aujourd'hui »,
 * la recherche, deux pages agent.
 *
 * ⛔ ET LA FRONTIÈRE N'ÉTAIT PAS UNE RÈGLE, C'ÉTAIT UN CONSTAT. On ne pouvait
 * l'énoncer qu'en énumérant : « mobile, face publique, plus Today, Analytics,
 * Search et Dashboard ». Mesuré à l'écran sur « Aujourd'hui » : 29 éléments
 * rendaient en Inter Tight et 26 en Manrope — deux polices se partageaient le
 * MÊME écran, presque à parts égales, et rien ne le disait.
 *
 * ── LA RÈGLE, EN UNE PHRASE ──────────────────────────────────────────────────
 * **Inter Tight (`var(--crm-font)`) est la police de l'agent au BUREAU ;
 * Manrope est celle du MOBILE et de tout ce que voit un CLIENT.**
 *
 * C'est la seule formulation qui tienne en une phrase, et c'est ce qui la rend
 * applicable : un lot futur n'a pas à consulter une liste pour savoir quoi
 * écrire, il regarde qui lit l'écran.
 *
 * ── CE QUI RESTE HORS DE LA RÈGLE PARCE QU'IL ENCODE ─────────────────────────
 * Une police n'est pas toujours de la décoration. Trois familles portent une
 * information et ne suivent donc aucune direction :
 *
 *  · `ui-monospace` — une suite de caractères qu'on lit et recopie UN PAR UN
 *    (code, empreinte, secret). Le cliquet de grammaire l'admet déjà comme
 *    marqueur d'exemption d'interlettrage, pour la même raison.
 *  · `Caveat, cursive` — la SIGNATURE manuscrite du rapport KYC. Une signature
 *    en Inter Tight n'est plus une signature.
 *  · `'Cormorant Garamond'` — la police que l'AGENT CHOISIT pour sa galerie
 *    d'annonce (`ListingDisplayPickers`). C'est une DONNÉE saisie par
 *    l'utilisateur, pas un choix de direction : la figer reviendrait à retirer
 *    le réglage.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, rel, scanRoots } from './helpers/fs-scan'

/** Zones où Manrope est la police JUSTE — mobile, et tout ce que voit un client. */
const DOMAINE_MANROPE = [
  'src/components/crm-mobile',
  'src/components/kyc-magic-link',
  'src/components/buyer-reception',
  'src/components/kyc-report',
  'src/pages/public',
]

/**
 * Sites où une police est nommée sans que ce soit un choix de direction.
 *
 * ⚠ Ancrés sur la FORME, jamais sur un nom de fichier : c'est ce qui définit une
 * famille (vacuité n°4). Une exemption qui dépend d'un chemin exempte un
 * fichier par accident, pas un rôle.
 */
const POLICES_QUI_ENCODENT = [
  { motif: /ui-monospace|SFMono|monospace/, raison: 'chasse fixe : une suite lue caractère par caractère' },
  { motif: /Caveat/, raison: 'la signature manuscrite du rapport KYC' },
  { motif: /Cormorant Garamond/, raison: 'la police que l’agent CHOISIT pour sa galerie — une donnée, pas la direction' },
  { motif: /'inherit'|"inherit"|: *inherit/, raison: 'hérite : ne nomme aucune police' },
]

const scan = scanRoots([
  { root: 'src/components', keep: (n) => /\.tsx?$/.test(n) },
  { root: 'src/pages', keep: (n) => /\.tsx?$/.test(n) },
])
const sources = scan.files.map((abs) => {
  const lu = readFileSafely(abs)
  const brut = lu.status === 'ok' ? lu.value : ''
  return {
    chemin: rel(abs),
    code: brut
      .replace(/\/\*[\s\S]*?\*\//g, (b) => '\n'.repeat((b.match(/\n/g) ?? []).length))
      .replace(/\/\/[^\n]*/g, ' '),
  }
})

const dansDomaineManrope = (chemin: string) => DOMAINE_MANROPE.some((d) => chemin.startsWith(d + '/'))

describe('Polices — quelle police, et où', () => {
  it('le balayage voit l’arbre', () => {
    // Sans ce plancher, un chemin cassé rendrait toutes les clauses vraies.
    expect(scan.files.length, 'balayage vide : chemin cassé').toBeGreaterThan(300)
    expect(sources.every((s) => s.code.length > 0)).toBe(true)
    expect(sources.map((s) => s.chemin)).toContain('src/components/crm-mobile/tokens.ts')
  })

  /**
   * ⛔ LA CLAUSE PRINCIPALE. Manrope hors de son domaine, c'est le CRM de bureau
   * qui prend la police du client — ce qui était l'état mesuré le 15 août 2026,
   * sur neuf fichiers.
   */
  it('Manrope ne sort pas de son domaine', () => {
    const fautifs: string[] = []
    for (const { chemin, code } of sources) {
      if (dansDomaineManrope(chemin)) continue
      code.split('\n').forEach((ligne, i) => {
        if (!/Manrope/.test(ligne)) return
        if (POLICES_QUI_ENCODENT.some(({ motif }) => motif.test(ligne))) return
        fautifs.push(`${chemin}:${i + 1}`)
      })
    }
    expect(
      fautifs,
      'Manrope hors du mobile et de la face publique — le bureau agent lit `var(--crm-font)` :\n  ' +
        fautifs.join('\n  '),
    ).toEqual([])
  })

  /**
   * ⛔ ET LA RÉCIPROQUE, sans quoi la règle ne serait gardée qu'à moitié. Une
   * garde qui n'interdit que le débordement dans UN sens laisse l'autre moitié
   * de la frontière sans surveillance : `var(--crm-font)` posé dans le CRM
   * mobile ferait basculer 34 sites sans que rien ne rougisse.
   *
   * ⚠ MESURÉE AVANT D'ÊTRE ÉCRITE : ZÉRO site aujourd'hui. Cette clause ne peut
   * donc pas allumer une zone que personne n'a regardée — elle ne fait que
   * refuser un geste futur.
   */
  it('le domaine de Manrope ne lit pas la police du bureau', () => {
    const fautifs: string[] = []
    for (const { chemin, code } of sources) {
      if (!dansDomaineManrope(chemin)) continue
      code.split('\n').forEach((ligne, i) => {
        if (/var\(--crm-font/.test(ligne)) fautifs.push(`${chemin}:${i + 1}`)
      })
    }
    expect(
      fautifs,
      'la police du BUREAU dans le domaine de Manrope — mobile et face publique gardent Manrope :\n  ' +
        fautifs.join('\n  '),
    ).toEqual([])
  })

  /**
   * Une exemption qui ne correspond plus à rien laisse croire qu'un rôle est
   * surveillé alors que le code a disparu. Même idiome que `TAILLES_ASSUMEES`.
   */
  it('chaque police qui encode correspond encore à du code', () => {
    const tout = sources.map((s) => s.code).join('\n')
    const mortes = POLICES_QUI_ENCODENT.filter(({ motif }) => !motif.test(tout)).map((e) => e.raison)
    expect(mortes, `exemption sans code :\n  ${mortes.join('\n  ')}`).toEqual([])
  })
})
