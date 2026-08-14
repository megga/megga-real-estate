/**
 * Garde-fou : aucune INTERPOLATION MORTE dans `src/`.
 *
 * Une interpolation morte, c'est `${…}` écrit dans une chaîne à guillemets
 * SIMPLES ou DOUBLES. JavaScript n'y voit que du texte — seuls les gabarits
 * (backticks) interpolent. La valeur produite est donc la chaîne littérale
 * `'0 12px 40px ${sgVoileEncre(false, 0.06)}'`.
 *
 * ── POURQUOI ÇA MÉRITE UNE GARDE À PART ──────────────────────────────────────
 * ⛔ AUCUNE PORTE DU DÉPÔT NE PEUT LA VOIR. `tsc` est vert : c'est un `string`
 * parfaitement typé. `eslint` est vert. Le cliquet de grammaire ne lit ni les
 * ombres ni les filets. Et à l'exécution rien ne lève : le NAVIGATEUR rejette
 * simplement la déclaration CSS invalide et la propriété retombe à sa valeur
 * initiale — `box-shadow: none`, `border-color` héritée. Mesuré au rendu :
 * les trois chaînes de `KYC_LIGHT` rendent `none`, quand `shadowSm` — la seule
 * écrite en backtick, deux lignes plus haut — rend bien
 * `rgba(3, 3, 3, 0.04) 0px 4px 16px 0px`.
 *
 * ── CE QUE ÇA CASSAIT, ET POURQUOI PERSONNE NE L'AVAIT VU ────────────────────
 * Les NEUF occurrences vivaient toutes dans le KYC, et toutes en thème CLAIR
 * (les branches sombres, elles, sont écrites en dur). Conjuguées à
 * `cardBorder: 'transparent'`, elles retiraient à la fois l'ombre ET la bordure :
 * mesuré sur les cartes de porte du wizard, `boxShadow: none` et
 * `border: 1px solid rgba(0, 0, 0, 0)` — une carte blanche sans aucun relief sur
 * un fond clair. `kypTokens.hairline` faisait disparaître les filets de la fiche
 * stricte. Ça ne ressemble pas à un bug : ça ressemble à un parti pris plat.
 *
 * ── LE DÉTECTEUR EST LUI-MÊME ÉPROUVÉ ────────────────────────────────────────
 * ⚠ Un balayage ligne-à-ligne rapporte un FAUX POSITIF sur tout gabarit
 * MULTI-LIGNES : la requête SPARQL de `useZefixCompany` contient
 * `"${escapeSparqlLiteral(…)}"`, parfaitement vivant, et une première version de
 * cette garde l'accusait. Une garde qui envoie casser du code qui marche se fait
 * désactiver. D'où l'état porté d'une ligne à l'autre — et les cas de la clause
 * « le détecteur sait lire » qui figent les deux sens.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, rel, scanRoots } from './helpers/fs-scan'

/**
 * Repère les `${` vivant dans une chaîne non-gabarit.
 *
 * Marche par balayage de CARACTÈRES : un regex ne peut pas faire la différence
 * entre `'…' + \`…${x}…\` + '…'` (sain, trois chaînes) et `'…${x}…'` (mort) —
 * il saute de la fermeture d'une chaîne à l'ouverture de la suivante.
 */
export function interpolationsMortes(code: string): { ligne: number; extrait: string }[] {
  const out: { ligne: number; extrait: string }[] = []
  const lignes = code.split('\n')
  let dansGabarit = false

  lignes.forEach((ligne, no) => {
    let i = 0
    if (dansGabarit) {
      let p = 0
      while (i < ligne.length) {
        if (ligne[i] === '\\') { i += 2; continue }
        if (ligne[i] === '$' && ligne[i + 1] === '{') { p++; i += 2; continue }
        if (p > 0) { if (ligne[i] === '}') p--; i++; continue }
        if (ligne[i] === '`') { dansGabarit = false; i++; break }
        i++
      }
      if (dansGabarit) return
    }
    while (i < ligne.length) {
      if (ligne[i] === '/' && ligne[i + 1] === '/') return
      const q = ligne[i]
      if (q === '`' || q === "'" || q === '"') {
        let j = i + 1
        let contenu = ''
        let p = 0
        while (j < ligne.length) {
          if (ligne[j] === '\\') { contenu += ligne[j + 1] ?? ''; j += 2; continue }
          if (q === '`' && ligne[j] === '$' && ligne[j + 1] === '{') { p++; j += 2; continue }
          if (q === '`' && p > 0) { if (ligne[j] === '}') p--; j++; continue }
          if (ligne[j] === q) break
          contenu += ligne[j]; j++
        }
        // Chaîne non close en fin de ligne : seul un gabarit peut l'être.
        if (j >= ligne.length && q === '`') { dansGabarit = true; return }
        if (q !== '`' && contenu.includes('${')) {
          out.push({ ligne: no + 1, extrait: (q + contenu + q).slice(0, 120) })
        }
        i = j + 1
        continue
      }
      i++
    }
  })
  return out
}

const scan = scanRoots([{ root: 'src', keep: (n) => /\.tsx?$/.test(n) }])

describe('Interpolations mortes — `${…}` hors gabarit', () => {
  /**
   * ⛔ LE DÉTECTEUR EST TESTÉ AVANT D'ÊTRE CRU. Sans ces cas, un balayage cassé
   * rendrait zéro et la clause suivante passerait au VERT sur un dépôt fautif —
   * la vacuité n° 28, « vraie parce qu'il n'y a rien à vérifier ».
   */
  it('le détecteur sait lire, dans les deux sens', () => {
    // MORTES — doivent être vues
    expect(interpolationsMortes(`const a = '0 2px 8px \${voile(0.04)}'`)).toHaveLength(1)
    expect(interpolationsMortes(`const a = "x \${y} z"`)).toHaveLength(1)
    // VIVANTES — ne doivent PAS être vues
    expect(interpolationsMortes('const a = `0 2px 8px ${voile(0.04)}`')).toEqual([])
    expect(interpolationsMortes("const a = 'plain string, no dollar'")).toEqual([])
    // ⛔ Le faux positif qui a failli partir : trois chaînes sur une ligne, dont
    // un gabarit vivant au milieu. Le regex naïf matche du 1er au 2e guillemet.
    expect(interpolationsMortes("style={{ border: `1px solid ${tk.b}`, cursor: 'pointer' }}")).toEqual([])
    // ⛔ Et le gabarit MULTI-LIGNES, celui de la requête SPARQL de Zefix.
    expect(interpolationsMortes([
      'return `SELECT WHERE {',
      '  FILTER(STRSTARTS(LCASE(?name), "${escapeSparqlLiteral(p)}"))',
      '} LIMIT ${MAX}`',
    ].join('\n'))).toEqual([])
    // Un commentaire n'est pas du code.
    expect(interpolationsMortes(`// exemple : '\${x}' ne s'interpole pas`)).toEqual([])
  })

  /** Contrôle positif : sans arbre, tout le reste passerait par vacuité. */
  it('le balayage voit l’arbre', () => {
    expect(scan.files.length, 'racine vide : chemin cassé, pas dépôt propre').toBeGreaterThan(400)
    expect(scan.unreadable).toEqual([])
  })

  /**
   * ⚠ CLIQUET À ZÉRO, sans inventaire. Les neuf occurrences historiques étaient
   * toutes des BOGUES — aucune n'avait de raison d'être. Une exemption n'aurait
   * donc rien à figer, et en ouvrir une inviterait la prochaine.
   */
  it('aucune interpolation morte ne subsiste', () => {
    const fautifs: string[] = []
    for (const abs of scan.files) {
      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue
      for (const h of interpolationsMortes(lu.value)) fautifs.push(`${rel(abs)}:${h.ligne}  ${h.extrait}`)
    }
    expect(fautifs, `\${…} dans une chaîne non-gabarit — du TEXTE, pas une valeur :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })
})
