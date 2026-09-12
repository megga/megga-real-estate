/**
 * Garde-fou : un écouteur clavier GLOBAL posé depuis un écran se tait quand cet
 * écran est caché.
 *
 * ── CE QUI A MOTIVÉ CE FICHIER ───────────────────────────────────────────────
 * La coquille garde jusqu'à six écrans d'onglet VIVANTS (`EcransVivants`) :
 * montés, invisibles, mais leurs effets tournent. Un
 * `window.addEventListener('keydown', …)` posé dans l'un d'eux écoute le clavier
 * de TOUS les autres. Relevé le 12 septembre 2026, frappe réelle ou lecture du
 * code, sur des écrans cachés :
 *
 *  · les raccourcis à une lettre de l'atelier Matching partaient depuis
 *    n'importe quel onglet — `x` écartait un acheteur, `p` le reportait, ⌘R
 *    déclenchait `r` (relance) : des ÉCRITURES en base ;
 *  · l'Échap des routes plein écran (`visits/new`, `import-lead`, offre)
 *    naviguait l'onglet VISIBLE ;
 *  · une galerie restée ouverte volait Échap et ←/→ en capture, et un piège à
 *    focus ramenait chaque Tab vers une modale invisible.
 *
 * La revue avait trouvé les six pagers ; le balayage suivant en a trouvé
 * vingt-neuf de plus. Une classe de défaut qui revient deux fois ne se corrige pas au cas par
 * cas : elle se garde.
 *
 * ── LA RÈGLE ─────────────────────────────────────────────────────────────────
 * Tout fichier de `src/` qui pose un écouteur `keydown`/`keyup` sur `window` ou
 * `document` lit `useEcranActif` (le hook ou sa variante `useEcranActifRef`) —
 * sauf les zones qui ne rendent JAMAIS d'écran d'onglet caché, et les deux
 * composants montés UNE fois, hors des écrans, nommés ci-dessous.
 *
 * ⚠ Ce que la garde NE prouve PAS : que la lecture est au bon endroit du bon
 * effet. Elle empêche d'oublier la question — ce qui est exactement ce qui s'est
 * produit trente-cinq fois.
 */
import { describe, it, expect } from 'vitest'
import { emptyRoots, readFileSafely, rel, scanRoots } from './helpers/fs-scan'

const ECOUTEUR = /(?:window|document)\.addEventListener\(\s*['"](?:keydown|keyup)['"]/

/**
 * Les zones qui ne rendent aucun écran d'onglet caché — chacune avec SA raison.
 */
const ZONES_SANS_ECRANS_CACHES: [RegExp, string][] = [
  [/^src\/(pages|components)\/admin\//, 'console super-admin : hors onglets (`HORS_ONGLETS`), un seul écran'],
  [/^src\/pages\/public\//, 'face publique : hors `AgentLayout`'],
  [/^src\/pages\/dev\//, 'bancs : routes de premier niveau, hors `AgentLayout`'],
  [/(^src\/components\/crm-mobile\/|\/mobile\/)/, 'mobile : `EcransVivants` n’y garde qu’UN écran (plafond 1)'],
]

/**
 * Montés une seule fois, AU-DESSUS des écrans : ils écoutent pour toute
 * l'application, et c'est leur rôle.
 *
 * ⚠ Écrits en dur, jamais dérivés : une entrée qui cesse de correspondre doit
 * faire rougir le second test, pas disparaître en silence.
 */
const HORS_ECRANS: Record<string, string> = {
  'src/components/crm/search/CrmSearchHost.tsx': '⌘K — monté une fois dans `AgentLayout`, hors des écrans',
  'src/components/ai-copilot/panel/CopilotPanel.tsx': 'le dock MEGGA AI — monté une fois dans `App.tsx`',
}

function listerEcouteurs() {
  const scan = scanRoots([{ root: 'src', keep: (n) => /\.(ts|tsx)$/.test(n) }])
  const avec: { chemin: string; texte: string }[] = []
  for (const abs of scan.files) {
    const lu = readFileSafely(abs)
    if (lu.status !== 'ok' || !ECOUTEUR.test(lu.value)) continue
    avec.push({ chemin: rel(abs), texte: lu.value })
  }
  return { scan, avec }
}

describe('clavier — les écrans cachés se taisent', () => {
  it('tout écouteur clavier global posé depuis un écran lit `useEcranActif`', () => {
    const { scan, avec } = listerEcouteurs()
    expect(emptyRoots(scan), 'racine vide : chemin cassé').toEqual([])
    expect(scan.unreadable).toEqual([])
    // Contrôle positif : le motif trouve bien ce qu'il cherche (46 fichiers au
    // 12.09.2026) — un motif cassé rendrait la garde verte sur un arbre vide.
    expect(avec.length).toBeGreaterThan(30)

    const fautifs = avec
      .filter(({ chemin }) => !ZONES_SANS_ECRANS_CACHES.some(([re]) => re.test(chemin)))
      .filter(({ chemin }) => !(chemin in HORS_ECRANS))
      .filter(({ texte }) => !/useEcranActif(Ref)?\(/.test(texte))
      .map(({ chemin }) => chemin)
    expect(fautifs, 'écouteur clavier global sans garde d’écran caché').toEqual([])
  })

  it('chaque exemption nommée existe encore et écoute toujours le clavier', () => {
    const { avec } = listerEcouteurs()
    const chemins = new Set(avec.map((a) => a.chemin))
    for (const chemin of Object.keys(HORS_ECRANS)) {
      expect(chemins.has(chemin), `${chemin} : exemption périmée`).toBe(true)
    }
  })
})
