// admin-monitoring — un refus d'accès n'est pas une panne.
//
// Le catch de tête de la fonction choisissait son code de statut en comparant
// `err.message` à « Forbidden ». Aucun chemin ne lève jamais ce message exact
// (`requireSuperAdmin` RENVOIE ses Response, avec « Forbidden: super_admin
// required ») : la branche 403 était morte, et toute panne interne — une RPC de
// santé en erreur, un timeout — repartait en 401 « Unauthorized ».
//
// Le second test est le plus important, et il garde une décision de conception
// plutôt qu'une ligne de code : la fonction est déployée SANS vérification de
// JWT par la plateforme (allowlist `JWT_PROTECTED` volontairement vide dans
// deploy.yml), donc elle est joignable par n'importe qui. Journaliser les rejets
// d'authentification offrirait un moyen trivial de noyer `activity_events`, qui
// est la piste d'audit LBA. Si quelqu'un déplace un jour `reportEdgeError` en
// tête du catch, ce test doit virer au rouge.

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTwoAgencies, type TwoAgenciesSetup } from './helpers/two-agencies'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ENDPOINT = `${URL}/functions/v1/admin-monitoring`

/** Nombre d'événements de panne attribués à cette fonction. */
async function countAuditedFailures(): Promise<number> {
  const { data, error } = await serviceRoleClient()
    .from('activity_events')
    .select('id')
    .eq('action', 'edge_function_error')
    .eq('metadata->>function_name', 'admin-monitoring')
  if (error) throw new Error(`compte des pannes auditées: ${error.message}`)
  return (data ?? []).length
}

describe.skipIf(!HAS_KEYS)('admin-monitoring — refus d\'accès vs panne', () => {
  let setup: TwoAgenciesSetup

  beforeAll(async () => {
    setup = await setupTwoAgencies()
  })

  afterAll(async () => {
    await setup?.cleanup()
  })

  it('un agent authentifié mais non super-admin reçoit 403, pas 401', async () => {
    const { data } = await setup.clientB.auth.getSession()
    const token = data.session?.access_token
    expect(token, 'session agent B attendue').toBeTruthy()

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: '{}',
    })

    // 403 et non 401 : l'appelant EST authentifié, il n'a simplement pas le
    // droit. Confondre les deux envoie chercher un problème de session là où il
    // s'agit d'un problème de rôle.
    expect(res.status, `attendu 403, reçu ${res.status}`).toBe(403)
  })

  it('un appel non authentifié est refusé SANS rien écrire dans le journal d\'audit', async () => {
    const avant = await countAuditedFailures()

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
    })
    expect(res.status, `attendu 401, reçu ${res.status}`).toBe(401)

    // La fonction est publique (déployée --no-verify-jwt) : si un refus
    // d'authentification produisait une ligne d'audit, cette boucle suffirait à
    // remplir la table.
    for (let i = 0; i < 3; i++) {
      await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
    }

    expect(
      await countAuditedFailures(),
      'un rejet d\'authentification ne doit JAMAIS être audité comme une panne',
    ).toBe(avant)
  })
})
