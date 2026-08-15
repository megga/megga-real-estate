/**
 * Garde-fou : `megga-x` est la SOURCE de la direction — et une exemption de
 * nature se paie par une contrepartie, sinon c'est un blanc-seing.
 *
 * ── L'EXEMPTION, ET POURQUOI ELLE EST DE *NATURE* ────────────────────────────
 * `src/components/megga-x` est le port 1:1 de la vitrine MEGGA. Le cliquet de
 * grammaire mesure les surfaces CONTRE la direction MEGGA X ; mesurer contre
 * elle-même ce qui la DÉFINIT est circulaire — un écart y serait, par
 * construction, la direction qui change d'avis, pas une régression. Même chose
 * pour `MeggaXStyleGuidePage`, qui sert `/design-system/megga-x`, la seule route
 * de design system survivante et la vitrine de ce port.
 *
 * ⚠ Elle ne repose PAS sur « la zone est propre ». Elle l'est (0 marqueur sur 23
 * fichiers, mesuré), et c'est rassurant, mais ce n'est pas le motif : une zone
 * propre entre au cliquet, précisément pour qu'elle le reste. Celle-ci n'y entre
 * pas parce que l'instrument n'a rien à y mesurer.
 *
 * ── LA CONTREPARTIE, QUI EST TOUT L'OBJET DE CE FICHIER ──────────────────────
 * Une direction exemptée de son propre cliquet doit être gardée AUTREMENT, sans
 * quoi « exempté » veut dire « personne ne regarde ». `megga-x.generated.css` —
 * 10 571 lignes, 100 % de la DA — n'était gardée par RIEN.
 *
 * ⛔ ET ON NE GARDE PAS UN PRODUIT, ON GARDE SA SOURCE. La feuille est générée
 * par `scripts/build-megga-x-css.mjs` depuis `sites/megga-vitrine/css/styles.css`.
 * Y corriger quoi que ce soit à la main serait effacé à la régénération
 * suivante — et la correction aurait l'air d'avoir tenu jusque-là. Les clauses
 * ci-dessous vérifient donc que le fichier COMMIS est exactement ce que le
 * générateur produit, et que le générateur, lui, ne laisse pas de référence
 * pendante.
 *
 * ── LE DÉFAUT QUE ÇA A TROUVÉ ────────────────────────────────────────────────
 * Six `url("../images/…")` pointaient dans le vide. Le diagnostic de surface
 * (« six URL mortes ») était faux : les six images EXISTENT dans
 * `sites/megga-vitrine/images/`. Le générateur réécrit `../fonts/` →
 * `/megga-x/fonts/` et **oubliait la règle jumelle pour `../images/`**. Depuis
 * `src/styles/`, le chemin relatif tombait alors sur `src/images/`, qui n'existe
 * pas. Une omission d'UNE règle, pas six accidents.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { repoPath, readFileSafely } from './helpers/fs-scan'

const ZONE = 'src/components/megga-x'
const PAGE = 'src/pages/dev/MeggaXStyleGuidePage.tsx'
const FEUILLE = 'src/styles/megga-x.generated.css'
const ENTREE = 'src/styles/megga-x.css'

const feuille = readFileSafely(repoPath(FEUILLE))
const entree = readFileSafely(repoPath(ENTREE))

describe('MEGGA X — la source de la direction, et sa contrepartie', () => {
  it('les feuilles sont lisibles', () => {
    // Sans ce plancher, un chemin cassé rendrait toutes les clauses vraies.
    expect(feuille.status, `${FEUILLE} illisible : les clauses ne mesurent rien`).toBe('ok')
    expect(entree.status, `${ENTREE} illisible`).toBe('ok')
    expect(feuille.status === 'ok' ? feuille.value.length : 0).toBeGreaterThan(100_000)
  })

  /**
   * L'exemption, EXIGÉE plutôt que supposée — même idiome que la frontière du
   * rapport KYC. Elle rougit le jour où quelqu'un ajoute la zone au cliquet, ce
   * qui est exactement le moment où il faut avoir lu pourquoi elle n'y est pas.
   */
  it('la zone et sa page restent HORS du cliquet, et c’est une décision', () => {
    const cliquet = readFileSafely(repoPath('tests/unit/megga-x-grammar.spec.ts'))
    expect(cliquet.status, 'cliquet illisible : la clause ne mesure rien').toBe('ok')
    const src = cliquet.status === 'ok' ? cliquet.value : ''
    const racines = [...src.matchAll(/root:\s*'([^']+)'/g)].map((m) => m[1])
    expect(racines.length, 'le cliquet ne déclare plus de racines — motif cassé').toBeGreaterThan(20)
    expect(
      racines,
      'le port de la vitrine est entré dans le cliquet de composition. Il DÉFINIT la ' +
        'direction : l’y mesurer est circulaire. Lire l’en-tête de ce fichier avant de passer outre.',
    ).not.toContain(ZONE)
    // ⛔ ET LA PAGE DU STYLE GUIDE N'EST PAS GARDÉE ICI, DÉLIBÉRÉMENT.
    //
    // Ma première rédaction exigeait que le cliquet CONTIENNE la chaîne
    // `MeggaXStyleGuidePage.tsx` — croyant vérifier son exclusion du balayage de
    // `src/pages/dev`. Un contrôle négatif l'a prise en défaut : le nom apparaît
    // AUSSI dans son entrée d'`EXEMPTIONS_ECRITES`, donc retirer l'exclusion
    // laissait la clause verte. Elle mesurait la PRÉSENCE D'UN NOM, pas un état.
    //
    // Ce qui la garde vraiment est dans le cliquet lui-même : sa clause
    // d'exemption refuse qu'un chemin soit « À LA FOIS balayé et exempté ». Si
    // l'exclusion tombait, la page entrerait dans le balayage tout en restant
    // exemptée, et cette contradiction rougirait là-bas — au bon endroit, avec
    // le scan sous la main. Dupliquer le balayage ici pour le redire aurait créé
    // une seconde vérité à maintenir.
    expect(racines, 'le dossier des bancs est passé en racine nue').toContain('src/pages/dev')
  })

  /**
   * ⛔ LE FICHIER COMMIS EST-IL BIEN LE PRODUIT DU GÉNÉRATEUR ?
   *
   * C'est la clause qui donne son sens à toutes les autres : si l'on pouvait
   * éditer la feuille à la main, « corriger » un défaut dedans passerait au vert
   * ici et disparaîtrait à la régénération suivante — une correction qui a l'air
   * d'avoir tenu. Le générateur tourne en ~0,1 s sur 239 Kio ; le coût est nul
   * devant ce qu'il ferme.
   */
  it('la feuille générée est exactement ce que le générateur produit', () => {
    const source = repoPath('sites/megga-vitrine/css/styles.css')
    expect(existsSync(source), 'la source de la vitrine a disparu — la feuille ne se régénère plus').toBe(true)
    const avant = readFileSync(repoPath(FEUILLE), 'utf8')
    try {
      execFileSync('node', [repoPath('scripts/build-megga-x-css.mjs')], { cwd: repoPath('.'), stdio: 'pipe' })
      const apres = readFileSync(repoPath(FEUILLE), 'utf8')
      expect(
        apres === avant,
        'la feuille commise DIVERGE de ce que le générateur produit : elle a été éditée à la main, ' +
          'ou le générateur a changé sans qu’on régénère. Lancer `node scripts/build-megga-x-css.mjs`.',
      ).toBe(true)
    } finally {
      // ⛔ On restaure quoi qu'il arrive : un test ne laisse pas l'arbre modifié.
      readFileSync(repoPath(FEUILLE), 'utf8') !== avant && require('node:fs').writeFileSync(repoPath(FEUILLE), avant)
    }
  })

  /**
   * ⛔ AUCUNE RÉFÉRENCE PENDANTE. Une `url()` qui ne résout pas ne casse rien de
   * visible — le navigateur demande, prend un 404, et n'affiche simplement pas
   * l'image. C'est précisément pourquoi ça survit : le symptôme est une absence.
   *
   * ⚠ La clause lit la feuille GÉNÉRÉE mais accuse le GÉNÉRATEUR : c'est lui qui
   * réécrit les chemins, et lui seul peut faire que la classe entière disparaisse.
   */
  it('aucune url() de la feuille ne pointe dans le vide', () => {
    const css = feuille.status === 'ok' ? feuille.value : ''
    const pendantes: string[] = []
    for (const m of css.matchAll(/url\(["']?(\/[^"')]+)["']?\)/g)) {
      const chemin = m[1]!
      if (!existsSync(repoPath('public', chemin))) pendantes.push(chemin)
    }
    // ⛔ Et AUCUN chemin relatif ne doit subsister : depuis `src/styles/`, un
    // `../images/…` tombe sur `src/images/`, qui n'existe pas. C'est la forme
    // exacte du défaut trouvé le 15 août 2026 — six références, une seule règle
    // manquante dans le générateur.
    for (const m of css.matchAll(/url\(["']?(\.\.\/[^"')]+)["']?\)/g)) {
      pendantes.push(`${m[1]} — chemin RELATIF : le générateur ne l’a pas réécrit`)
    }
    expect(pendantes, `références pendantes (corriger le GÉNÉRATEUR, pas la feuille) :\n  ${pendantes.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ AUCUN `@import` RÉSEAU. Un `@import url(https://…)` dans une feuille est
   * bloquant au rendu ET découvert tardivement — le navigateur doit d'abord
   * télécharger la feuille pour apprendre qu'il lui en faut une autre.
   *
   * ⚠ Celui qui vivait ici chargeait Inter Tight, qu'`index.html` DÉCLARE DÉJÀ
   * par un `<link>` précédé d'un `preconnect`. Il ne rendait donc aucun service :
   * il ajoutait un aller-retour pour une police déjà en vol.
   */
  it('aucun @import réseau dans les feuilles MEGGA X', () => {
    const fautifs: string[] = []
    for (const [nom, lu] of [[ENTREE, entree], [FEUILLE, feuille]] as const) {
      const css = lu.status === 'ok' ? lu.value : ''
      css.split('\n').forEach((ligne, i) => {
        if (/@import\s+url\(\s*['"]?https?:/.test(ligne)) fautifs.push(`${nom}:${i + 1}`)
      })
    }
    expect(fautifs, `@import réseau (bloquant, et la police est déjà en <link>) :\n  ${fautifs.join('\n  ')}`).toEqual([])
  })
})
