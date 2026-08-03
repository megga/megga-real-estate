// Helpers des specs qui exercent le CONTRAT HTTP d'une edge function contre le
// runtime edge LOCAL (`supabase start`, port 54321 — jamais la production, cf.
// .github/workflows/backend.yml qui exporte SUPABASE_TEST_URL=http://127.0.0.1:54321).
//
// ⛔ CE FICHIER EXISTE À CAUSE D'UN 503, ET LE 503 NE VIENT PAS DE LA FONCTION.
// Le runtime local répond 503 tant que le worker d'une fonction n'est pas debout :
// démarrage en cours, ou démarrage tombé sur un import distant que le CDN a servi
// en 5xx (`deno.land/std`, `esm.sh` — même mode de panne que la passe de rattrapage
// de deploy.yml, esm.sh en 522 le 21.07.2026). Ce 503 ne dit RIEN du contrat de la
// fonction, mais une assertion de statut qui le reçoit échoue en
// « expected 503 to be 401 » : le message ressemble à une régression
// d'authentification et n'en est pas.
//
// Mesuré le 02.08.2026 (PR #1088, run 30768283828, tests/backend/agency-verification-run.spec.ts
// « sans Authorization -> 401 ») : le test SUIVANT, même endpoint, a répondu 401 —
// le worker avait fini de démarrer entre les deux. Le réchauffement d'alors ne
// pouvait pas l'éviter : il lançait UNE requête et courait contre une échéance,
// donc un 503 rendu en 200 ms le terminait « avec succès » sans que rien ne soit
// prêt. D'où waitForEdgeWorker, qui SONDE jusqu'à obtenir autre chose qu'un 503.
//
// ⚠ Ce qui n'est délibérément PAS fait ici : rejouer une assertion sur 503. Le code
// de statut est ce qui discrimine une panne d'un défaut (un 401 attendu qui rend 403
// doit rester rouge) ; une reprise posée sur l'assertion elle-même masquerait le
// second cas avec le premier. On attend AVANT, on n'atténue jamais APRÈS.

/** Résultat d'un réchauffement. `ready: false` = le worker n'a jamais répondu autre chose qu'un 503. */
export type EdgeWorkerWarmup = {
  ready: boolean
  /** Dernier statut observé (0 = la requête elle-même a échoué : réseau, abandon). */
  status: number
  /** Corps de la dernière réponse 503, tronqué — la pièce qui dit POURQUOI le boot a échoué. */
  body: string
}

/**
 * Attend qu'une edge function locale serve autre chose qu'un 503, en sondant.
 *
 * Ne rejette JAMAIS et n'échoue jamais un `beforeAll` : un réchauffement n'affirme
 * rien, il ne doit pas être le motif d'un échec — ce sont les tests eux-mêmes qui
 * disent si la fonction respecte son contrat, avec leur propre budget. S'il
 * abandonne, il l'écrit sur la sortie du run (avec le corps de la dernière réponse),
 * pour que l'échec qui suit soit lisible du premier coup d'œil.
 *
 * @param endpoint URL complète de la fonction (`${URL}/functions/v1/<nom>`).
 * @param opts.budgetMs Budget total du réchauffement. Défaut 60 s — le démarrage
 *   ordinaire vaut ~15 s, davantage sur un runner chargé. Toujours tenir le
 *   `hookTimeout` du `beforeAll` appelant largement au-dessus.
 * @param opts.method Méthode de sonde. OPTIONS par défaut : elle atteint le runtime
 *   pour les fonctions déclarées `verify_jwt = false` dans supabase/config.toml
 *   (toutes celles de ce dépôt), donc elle paie réellement le démarrage. Sous
 *   `verify_jwt = true`, la passerelle répondrait seule sans réveiller le worker.
 */
export async function waitForEdgeWorker(
  endpoint: string,
  opts: { budgetMs?: number; method?: string } = {}
): Promise<EdgeWorkerWarmup> {
  const { budgetMs = 60_000, method = 'OPTIONS' } = opts
  const deadline = Date.now() + budgetMs
  let last: EdgeWorkerWarmup = { ready: false, status: 0, body: 'aucune réponse' }

  while (Date.now() < deadline) {
    try {
      // Chaque sonde porte son propre abandon : une requête qui pend ne doit pas
      // manger le budget entier et faire passer un runtime lent pour un runtime mort.
      const res = await fetch(endpoint, { method, signal: AbortSignal.timeout(10_000) })
      if (res.status !== 503) return { ready: true, status: res.status, body: '' }
      last = { ready: false, status: 503, body: (await res.text().catch(() => '')).slice(0, 500) }
    } catch (err) {
      last = { ready: false, status: 0, body: String(err) }
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000))
  }

  console.warn(
    `[helpers/edge] ${endpoint} répond encore ${last.status || 'rien'} après ${Math.round(budgetMs / 1000)} s — ` +
      "le worker n'a pas démarré. Un échec de statut juste après vient de LÀ, pas du contrat de la fonction.\n" +
      `  dernière réponse : ${last.body || '(corps vide)'}`
  )
  return last
}

/**
 * Message d'assertion pour un statut d'edge function : nomme le 503 du runtime pour
 * ce qu'il est, afin qu'un « expected 503 to be 401 » ne se lise pas comme une
 * régression d'authentification.
 *
 * Consomme le corps de la réponse — à n'utiliser que là où il n'est pas relu ensuite.
 */
export async function edgeStatusMessage(res: Response, fn: string): Promise<string> {
  if (res.status !== 503) return `${fn} a répondu ${res.status}`
  const body = (await res.text().catch(() => '')).slice(0, 300)
  return (
    `${fn} : 503 du runtime edge LOCAL — worker pas debout (démarrage, ou import distant ` +
    `tombé côté CDN), PAS un verdict de la fonction. Corps : ${body || '(vide)'}`
  )
}
