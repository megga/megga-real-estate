/**
 * Garde-fou — le produit vit sur `getmegga.com`, plus sur `megga.ch`.
 *
 * ⛔ POURQUOI UNE PORTE, ET PAS UNE LIGNE DANS CLAUDE.md. La migration du
 * 09.09.2026 a réécrit 809 occurrences dans 221 fichiers. Rien, dans la CI, ne
 * remarquerait qu'un fichier neuf en réintroduise une : `megga.ch` reste une
 * chaîne parfaitement valide, le type-check l'ignore, et les 2908 tests unitaires
 * sont passés au VERT le jour de la bascule — parce que leurs assertions avaient
 * bougé avec le code qu'elles gardent. Une suite verte ne dit rien du domaine.
 *
 * Le prix d'un oubli ne se paie pas au commit mais le jour où la zone `megga.ch`
 * est libérée pour la holding : le lien meurt alors sans qu'aucun rouge
 * n'apparaisse nulle part — un bouton d'e-mail qui ne mène plus à rien, une photo
 * absente, une détection de langue qui retombe en silence sur le français.
 *
 * ── ⚠ LES DEUX FORMES, ET C'EST LE POINT DÉLICAT ────────────────────────────
 * La réécriture initiale a MANQUÉ deux sites, et tous deux pour la même raison :
 * ils écrivent le domaine avec des points ÉCHAPPÉS, à l'intérieur d'une regex.
 *
 *   sites/megga-vitrine/_worker.js   ORIGINES_CRM  → `app\.megga\.ch`
 *   src/lib/sentry.ts                tracePropagationTargets → `megga\.ch`
 *
 * Un `grep megga.ch` ne les voit pas — le point de la requête est un joker, mais
 * la chaîne cherchée est littérale, et le fichier porte un antislash. Or ces deux
 * sites-là sont précisément ceux qui échouent EN SILENCE : une origine absente de
 * `ORIGINES_CRM` fait échouer `/api/geo` fermé (repli français, aucune erreur), et
 * une cible absente de Sentry ne fait que cesser de tracer. Cette garde cherche
 * donc les deux formes.
 *
 * ── CE QUI RESTE AUTORISÉ, ET POURQUOI ──────────────────────────────────────
 *  · `admin.megga.ch` — hôte RETIRÉ le 28.07.2026, jamais remplacé. Le réécrire
 *    en `admin.getmegga.com` inventerait un domaine qui n'a jamais existé, et
 *    ferait mentir `redirects-guard.spec.ts`, qui vérifie qu'aucune règle de bord
 *    ne pointe vers lui. Un nom d'hôte mort est une donnée historique.
 *  · les deux exemptions de TRANSITION nommées ci-dessous. Elles portent la date
 *    de leur retrait, et cette garde les fera rougir le jour où on les enlèvera —
 *    c'est voulu : le rouge est le rappel.
 */
import { describe, expect, it } from 'vitest'
import { emptyRoots, readFileSafely, rel, repoPath, scanRoots } from './helpers/fs-scan'

/** Extensions balayées : tout ce qui peut porter une URL de production. */
const EXTENSIONS = /\.(ts|tsx|js|mjs|cjs|json|html|yml|yaml|css|txt|md)$/

/** Fichiers sans extension qui portent quand même de la config de bord. */
const SANS_EXTENSION = new Set(['_redirects', '_headers'])

const retenir = (nom: string): boolean => EXTENSIONS.test(nom) || SANS_EXTENSION.has(nom)

/**
 * Racines balayées — le CODE VIVANT seulement.
 *
 * ⛔ Trois arbres sont volontairement absents, et leur absence est un choix, pas
 * un oubli : `supabase/migrations/` (déjà appliquées — réécrire une migration
 * partie en production fait diverger le dépôt de la base), `docs/superpowers/plans/`
 * et `docs/CHANGELOG.md` (comptes rendus DATÉS — y remplacer le domaine
 * falsifierait le récit de ce qui s'est passé). Ces fichiers parlent d'une époque
 * où `megga.ch` était l'adresse ; c'était vrai, et ça doit le rester.
 */
const RACINES = [
  { root: 'src', keep: retenir },
  { root: 'supabase/functions', keep: retenir },
  { root: 'sites/megga-vitrine', keep: retenir },
  { root: 'public', keep: retenir },
  { root: 'scripts', keep: retenir },
  { root: 'tests', keep: retenir },
  { root: '.github/workflows', keep: retenir },
] as const

/**
 * Exemptions — DEUX familles, et la distinction n'est pas cosmétique.
 *
 * `TRANSITOIRES` porte ce qui DOIT disparaître : chaque entrée nomme la condition
 * de son retrait. `HISTORIQUES` porte ce qui doit RESTER : un hôte cité dans une
 * mesure datée n'est pas une dette, c'est la mesure elle-même. Les fondre ferait
 * porter à la seconde famille une date de péremption qu'elle n'a pas, et le
 * prochain lecteur retirerait un chiffre daté en croyant solder une transition.
 *
 * ⚠ Le cliquet du bas s'applique aux DEUX : une exemption dont le fichier ne cite
 * plus l'ancien domaine n'exempte plus rien et masquerait une réintroduction.
 *
 * ── Retirées le 09.09.2026, phase E, chacune sur sa condition écrite ────────────
 * Les quatre entrées ci-dessous ont été supprimées le jour où les domaines custom
 * ont été détachés des projets Pages `megga-app` et `megga-real-estate` — soit
 * exactement la condition que chacune s'était donnée :
 *   · `sites/megga-vitrine/_worker.js`            ORIGINES_CRM
 *   · `src/lib/sentry.ts`                          tracePropagationTargets
 *   · `supabase/functions/extract-lead/index.ts`  ALLOWED_ORIGINS
 *   · `tests/unit/edge-no-html-response.spec.ts`  assertion à deux domaines
 * Les deux premières échouaient FERMÉ ET EN SILENCE : c'est pourquoi leur retrait
 * attendait une condition mesurable, et pas une impression que « ça devrait aller ».
 */
const TRANSITOIRES: Record<string, string> = {
  'scripts/migrate-domaine-getmegga.mjs':
    "L'outil de bascule lui-même : il DOIT nommer les deux domaines, puisque son travail "
    + 'est de remplacer l\'un par l\'autre en base. ⚠ Sa moitié `photos_cf` est JOUÉE '
    + '(0 ligne restante, mesuré le 09.09.2026) ; sa moitié `app_config` ne peut pas '
    + "l'être : les trois clés RealAdvisor portent `tech@megga.ch`, et basculer vers "
    + '`tech@getmegga.com` avant que la boîte existe enverrait les alertes vers une '
    + 'adresse qui rebondit dans le vide. Il se supprime le jour où cette boîte est '
    + 'créée (A7 de docs/migration-getmegga.md) et où le script est rejoué.',
}

/**
 * Exemptions PERMANENTES — un hôte qui date une mesure reste l'hôte de son jour.
 */
const HISTORIQUES: Record<string, string> = {
  'supabase/functions/_shared/app-url.ts':
    "L'en-tête cite les anciens hôtes pour RAPPORTER une mesure datée du 03.08.2026 — "
    + 'la réécrire sur `getmegga.com` daterait la mesure d\'un jour où ce domaine ne '
    + "servait rien. ⛔ Ne PAS retirer cette entrée « pour solder la phase E » : elle "
    + "n'a pas de date de retrait, c'est le sens même de la famille HISTORIQUES.",
}

/** Tous les fichiers exemptés, quelle que soit la raison. */
const EXEMPTES: Record<string, string> = { ...TRANSITOIRES, ...HISTORIQUES }

/**
 * Toute mention du domaine sortant, dans ses DEUX écritures.
 *
 * `megga\.ch` (échappé) est cherché explicitement : c'est la forme qui a échappé
 * à la réécriture initiale, et c'est celle des deux sites qui échouent en silence.
 */
const MENTIONS = /(?<!admin\.)megga\\?\.ch/g

/**
 * ⚠ La MÊME règle, sans `/g`.
 *
 * Une regex globale porte un `lastIndex` que `.test()` fait AVANCER : appelée deux
 * fois sur la même chaîne, elle rend `true` puis `false`. Le cliquet du bas fait
 * exactement ça — un `.test()` par exemption — et aurait donc déclaré périmée une
 * exemption sur deux, sans rien changer au code. On dérive une forme locale plutôt
 * que de réinitialiser `lastIndex` à la main, qui s'oublie au prochain lecteur.
 */
const MENTION = new RegExp(MENTIONS.source)

describe('domaine de production — getmegga.com', () => {
  const scan = scanRoots(RACINES)

  // ── Contrôles positifs : un scan cassé doit ROUGIR, pas passer ────────────
  // Sans eux, un chemin de racine faux rendrait 0 fichier et cette garde serait
  // verte en n'ayant rien lu — le mode d'échec exact de `project_silent_seed_vacuous_tests`.
  it('a bien lu chaque racine (sinon la garde est creuse)', () => {
    expect(emptyRoots(scan)).toEqual([])
    expect(scan.files.length).toBeGreaterThan(500)
  })

  it('trouve réellement getmegga.com dans le code balayé', () => {
    const porteurs = scan.files.filter((f) => {
      const lu = readFileSafely(f)
      return lu.status === 'ok' && lu.value.includes('getmegga.com')
    })
    // Mesuré au moment de la migration : 195 fichiers. Le plancher est bas
    // exprès — il détecte un scan cassé, il ne fige pas un décompte qui bougera.
    expect(porteurs.length).toBeGreaterThan(100)
  })

  // ── La règle elle-même ────────────────────────────────────────────────────
  it('ne laisse aucune mention de megga.ch dans le code vivant', () => {
    const fautifs: string[] = []

    for (const abs of scan.files) {
      const chemin = rel(abs)
      if (chemin in EXEMPTES) continue
      // La garde ne peut pas s'auto-incriminer : ce fichier CITE le domaine
      // sortant pour expliquer ce qu'il interdit.
      if (chemin === 'tests/unit/domaine-getmegga.spec.ts') continue

      const lu = readFileSafely(abs)
      if (lu.status !== 'ok') continue

      const trouvees = lu.value.match(MENTIONS)
      if (trouvees?.length) fautifs.push(`${chemin} — ${trouvees.length}× (${trouvees[0]})`)
    }

    expect(fautifs, `Le produit vit sur getmegga.com. Ces fichiers mentionnent encore
l'ancien domaine — remplacer par l'hôte getmegga.com correspondant :

  megga.ch → getmegga.com          app.megga.ch → app.getmegga.com
  api.megga.ch → api.getmegga.com  img.megga.ch → img.getmegga.com

⚠ Chercher AUSSI la forme échappée \`megga\\.ch\` : dans une regex, elle est
invisible à un grep littéral, et c'est elle qui a été manquée deux fois.

Si la mention est HISTORIQUE (une mesure datée, un incident raconté), garder
l'ancien hôte et inscrire le fichier dans HISTORIQUES avec sa raison.`).toEqual([])
  })

  // ── Le cliquet : les exemptions ne doivent pas survivre à leur motif ──────
  it("chaque exemption de transition mentionne encore l'ancien domaine", () => {
    // Une exemption dont le fichier ne cite plus `megga.ch` est une exemption
    // périmée : elle n'exempte plus rien et masquerait une future réintroduction.
    const mortes = Object.keys(EXEMPTES).filter((chemin) => {
      const lu = readFileSafely(repoPath(chemin))
      return lu.status === 'ok' && !MENTION.test(lu.value)
    })
    expect(mortes, `Ces exemptions ne servent plus (le fichier ne cite plus megga.ch).
Les retirer de TRANSITOIRES (ou de HISTORIQUES) — c'est la phase E de
docs/migration-getmegga.md.`).toEqual([])
  })
})
