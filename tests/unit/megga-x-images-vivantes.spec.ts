/**
 * Garde-fou — chaque image de `public/megga-x/images/` sert, et chaque `url()` pointe
 * sur un fichier qui existe.
 *
 * ⛔ CE FICHIER EXISTE PARCE QUE 833 Ko ONT VOYAGÉ DANS CHAQUE DÉPLOIEMENT SANS QUE
 * PERSONNE LES DEMANDE. `build-megga-x-css.mjs` transcrit la feuille de la vitrine et
 * copie tout ce qu'elle référence — y compris les blocs de PAGE MARKETING
 * (`.colors-gradient-top` / `-bottom`, le fond de `blockquote`) qu'aucun composant du
 * CRM ne produit. Mesuré le 16 août 2026 : quatre PNG pour 833 Ko, recopiés dans `dist/`
 * à chaque build, et jamais demandés par un navigateur.
 *
 * ⚠ RIEN NE LE SIGNALAIT, ET RIEN NE POUVAIT : une image de fond dont le sélecteur ne
 * rencontre aucun élément ne produit AUCUNE requête. Elle ne casse pas, elle ne
 * ralentit rien de visible — elle pèse, en silence, dans un dossier que personne
 * ne relit.
 *
 * ── LES DEUX CLAUSES, ET POURQUOI IL EN FAUT DEUX ────────────────────────────
 * Elles se gardent l'une l'autre, et l'oubli de la seconde était le vrai piège.
 *
 *  1. AUCUN LIEN PENDANT — tout `url(/megga-x/images/X)` d'une feuille désigne un
 *     fichier présent. Sans elle, « nettoyer » un fichier laisserait un 404 qui ne se
 *     verrait que le jour où quelqu'un écrit la classe.
 *
 *  2. AUCUN POIDS MORT — tout fichier du dossier est référencé quelque part.
 *     ⛔ « QUELQUE PART » N'EST PAS « DANS LA CSS », et c'est ce qui a failli me faire
 *     supprimer quatre fichiers VIVANTS. Mesuré : `404-illustration*.png` (trois
 *     tailles) et `avatar-demo.jpg` ne sont référencés par AUCUNE feuille — ils le sont
 *     depuis des composants (`NotFoundPage`, `MeggaXStyleGuidePage`), en `src`/`srcSet`.
 *     Une garde qui n'aurait lu que la CSS aurait conclu qu'ils sont morts. On balaie
 *     donc AUSSI `src/`.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, readSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'
import { readdirSync } from 'node:fs'

const DOSSIER = 'public/megga-x/images'
/** Le chemin tel qu'il s'écrit dans une feuille ou un composant. */
const PREFIXE = '/megga-x/images/'

/** Les feuilles qui peuvent porter un `url()` vers ce dossier. */
const FEUILLES = ['src/styles/megga-x.generated.css', 'src/styles/megga-x-additions.css']

function fichiersDuDossier(): string[] {
  const lu = readSafely(() => readdirSync(repoPath(DOSSIER)))
  return lu.status === 'ok' ? [...lu.value].sort() : []
}

/** Tout ce qui est cité, feuilles ET composants confondus. */
function citations(): { css: Set<string>, tout: Set<string> } {
  const css = new Set<string>()
  for (const f of FEUILLES) {
    const lu = readFileSafely(repoPath(f))
    if (lu.status !== 'ok') continue
    for (const m of lu.value.matchAll(/\/megga-x\/images\/([^"')\s]+)/g)) css.add(m[1])
  }
  const tout = new Set(css)
  const scan = scanRoots([{ root: 'src', keep: (n) => /\.(tsx?|css)$/.test(n) }])
  for (const abs of scan.files) {
    const lu = readFileSafely(abs)
    if (lu.status !== 'ok') continue
    for (const m of lu.value.matchAll(/\/megga-x\/images\/([^"')\s]+)/g)) tout.add(m[1])
  }
  return { css, tout }
}

describe('images MEGGA X', () => {
  const fichiers = fichiersDuDossier()
  const { css, tout } = citations()

  // Contrôle positif : un dossier vide ou un scan cassé rendrait les deux clauses
  // vertes pour la pire des raisons.
  it('voit bien le dossier et les feuilles', () => {
    expect(fichiers.length, `${DOSSIER} vide ou illisible`).toBeGreaterThan(3)
    expect(css.size, 'aucun url() trouvé dans les feuilles — le scan est cassé').toBeGreaterThan(0)
  })

  it('aucun lien pendant : tout url() désigne un fichier présent', () => {
    const pendants = [...css].filter((n) => !fichiers.includes(n))
    expect(
      pendants,
      `Une feuille référence ${PREFIXE}… sans que le fichier existe. Invisible tant que `
        + 'le sélecteur ne rencontre aucun élément, 404 le jour où quelqu\'un écrit la classe.',
    ).toEqual([])
  })

  /**
   * ⚠ LA CITATION EST UN PRÉFIXE, PAS UN NOM ENTIER — et c'est une seconde marche du
   * même piège, trouvée en éprouvant cette clause. `NotFoundPage` écrit
   * `const IMG = '/megga-x/images/404-illustration'` puis suffixe les tailles
   * (`${IMG}-500.png`, `${IMG}-800.png`) pour son `srcSet`. Chercher le nom COMPLET
   * déclarait donc morts trois fichiers parfaitement vivants. Un chemin construit ne
   * se retrouve que par son début.
   */
  it('aucun poids mort : tout fichier est référencé quelque part', () => {
    const cite = (nom: string) =>
      tout.has(nom) || [...tout].some((c) => c.length > 6 && nom.startsWith(c))
    const morts = fichiers.filter((n) => !cite(n))
    const poids = morts.length
      ? ` (${morts.map((n) => n.slice(0, 42)).join(', ')})`
      : ''
    expect(
      morts,
      `Ces fichiers ne sont cités ni par une feuille ni par un composant : ils partent `
        + `dans chaque déploiement sans que personne les demande${poids}.\n`
        + '   ⚠ Vérifier AVANT de supprimer : une image citée depuis un `src`/`srcSet` de '
        + 'composant est vivante même si aucune CSS ne la nomme — c\'est le cas de '
        + '`404-illustration*` et `avatar-demo`.\n'
        + '   Si la copie vient du générateur, retirer la RÈGLE dans '
        + '`scripts/build-megga-x-css.mjs` plutôt que le fichier seul : sans règle, la '
        + 'classe n\'existe pas et l\'image cesse d\'être copiée.',
    ).toEqual([])
  })

  /**
   * ⚠ Le générateur est la SOURCE de ce dossier : ce qu'il copie doit s'y trouver.
   * Sans cette clause, un `git rm` sur un fichier encore référencé par la feuille
   * repasserait au vert au prochain build — en recopiant le fichier — et la
   * suppression ressemblerait à un aller-retour inexplicable.
   */
  it('les images citées par la feuille GÉNÉRÉE sont bien celles que le générateur copie', () => {
    const generee = new Set<string>()
    const lu = readFileSafely(repoPath('src/styles/megga-x.generated.css'))
    if (lu.status === 'ok') {
      for (const m of lu.value.matchAll(/\/megga-x\/images\/([^"')\s]+)/g)) generee.add(m[1])
    }
    expect([...generee].sort().filter((n) => !fichiers.includes(n))).toEqual([])
  })
})
