/**
 * L'ÉCHÉANCE du repli `data.html` de `send-email`.
 *
 * ⛔ CE FICHIER N'EST PAS UNE GARDE DE CODE, C'EST UN RAPPEL QUI SE DÉCLENCHE SEUL.
 *
 * `send-email` accepte encore, quand `data.body` est absent, un document HTML
 * COMPLET fourni par l'appelant : il part tel quel chez Resend, sans passer par la
 * coquille ni par l'échappement, signé DKIM par megga.ch. Le verrou est mince —
 * `verify_jwt = false` sur cette fonction, et `requireAgentAuth` admet tout jeton
 * utilisateur dont le profil porte un `agency_id`, sans contrôle de rôle.
 *
 * Ce repli a une raison d'être RÉELLE mais BRÈVE : un onglet ouvert avant le
 * déploiement de la migration vers la coquille enverrait encore l'ancienne forme.
 * Passé quelques semaines, plus personne n'a cet onglet, et il ne reste qu'une
 * porte dérobée que la porte `lint:email-shell` ne peut pas voir — le chemin est
 * une donnée d'exécution, pas une source à scanner.
 *
 * ── POURQUOI UNE DATE, ET PAS UN COMMENTAIRE ─────────────────────────────────
 * Il PORTAIT un commentaire : « À retirer une fois le front partout à jour ». Un
 * commentaire ne se relit qu'en ouvrant le fichier, et on n'ouvre plus un fichier
 * qui marche. Ce dépôt en a l'expérience : la liste de globs synchronisée « par
 * commentaire » entre `eslint.config.js` et `lint-i18n-hardcoded.mjs` a échoué à
 * sa première épreuve, et la porte i18n est restée muette sur 158 fichiers sans
 * que rien ne le signale.
 *
 * ⚠ CE TEST S'EFFACE DE LUI-MÊME. Retirer le repli le rend vert POUR TOUJOURS, et
 * le fichier peut alors être supprimé. C'est la seule issue qui ne demande pas de
 * revenir décider : repousser la date est un geste qu'il faut écrire, donc assumer.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'

/** Le repli, tel qu'il s'écrit dans la source. */
const REPLI = /emailHtml\s*=\s*\(data\.html as string\)/

/**
 * Échéance — 15 septembre 2026, un mois après la migration vers la coquille
 * (16 août 2026). De quoi couvrir largement la durée de vie d'un onglet oublié.
 */
const ECHEANCE = Date.parse('2026-09-15T00:00:00Z')

describe('repli `data.html` de send-email', () => {
  const lu = readFileSafely(repoPath('supabase/functions/send-email/index.ts'))
  const source = lu.status === 'ok' ? lu.value : ''

  // Contrôle positif : un fichier illisible rendrait la clause verte pour la pire
  // des raisons — elle conclurait « le repli a disparu » sans avoir rien lu.
  it('lit bien la source de send-email', () => {
    expect(source.length, 'send-email/index.ts illisible').toBeGreaterThan(1000)
  })

  it('a disparu, ou n’a pas encore atteint son échéance', () => {
    const present = REPLI.test(source)
    if (!present) return // Retiré : plus rien à surveiller, ce fichier peut partir.

    expect(
      Date.now(),
      'ÉCHÉANCE DÉPASSÉE — le repli `data.html` de `supabase/functions/send-email/index.ts` '
        + 'devait être retiré le 15.09.2026. Tant qu\'il vit, tout appelant muni d\'un jeton '
        + 'd\'agent peut faire partir du HTML complet non échappé, hors coquille, signé DKIM '
        + 'par megga.ch — et `lint:email-shell` ne peut pas le voir.\n'
        + '   Geste attendu : supprimer la branche de repli (le front envoie `data.body` '
        + 'depuis le 16.08.2026), puis supprimer ce fichier de test.\n'
        + '   Repousser la date est un choix légitime, mais il doit s\'ÉCRIRE ici.',
    ).toBeLessThan(ECHEANCE)
  })
})
