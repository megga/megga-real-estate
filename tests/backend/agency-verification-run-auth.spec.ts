// Backend test (live CI) -- garde d'authentification de l'Edge Function
// agency-verification-run : le secret service-role est accepte sous SES DEUX FORMATS.
//
// POURQUOI CE FICHIER EXISTE A PART, et non dans agency-verification-run.spec.ts ou il
// aurait naturellement sa place, a cote des deux autres cas d'auth (« sans Authorization
// -> 401 », « le jeton anon ne suffit jamais ») : une contrainte d'outillage, pas un choix
// de conception. Le commit de ce correctif a du passer par l'API GitHub, qui reecrit un
// fichier ENTIER -- impossible pour un spec de ~4900 lignes. Si l'occasion se presente de
// reunifier les trois cas dans le spec principal, la faire : rien ici ne s'y oppose.
//
// DETTE CONNUE, laissee par la meme contrainte : l'en-tete de
// tests/backend/agency-verification-run.spec.ts (bloc « Deux variables service-role »)
// affirme encore qu'un Bearer au nouveau format est « un credential parfaitement valide
// que la fonction refuse quand meme -- 401 avant toute logique ». Ce n'est PLUS vrai
// depuis isTrustedServiceCaller : la fonction accepte les deux. Le reste de ce bloc reste
// exact (la raison d'etre de SUPABASE_TEST_SERVICE_ROLE_JWT, le repli local), et les
// `setConfig('service_role_key', SERVICE_ROLE_JWT)` de son volet 7 restent valides -- ils
// ne sont simplement plus la CONDITION du passage. A corriger au prochain passage sur ce
// fichier.
//
// CE QUE CE TEST PROUVE, et pourquoi il vaut la peine. L'appelant nominal de
// agency-verification-run n'est pas un fetch() de test : c'est net.http_post, declenche par
// submit_agency_identity() et par le filet horaire, qui rejoue en Bearer
// `app_config.service_role_key`. La garde, elle, ne comparait qu'a
// Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') -- une AUTRE source. Rien n'oblige les deux a
// porter la meme valeur : Supabase expose la meme identite service_role sous deux formats
// (JWT legacy `eyJ...` et cle `sb_secret_...`), et le runtime edge local n'injecte que le
// premier la ou la production hebergee injecte le second (constate en prod le 01.08.2026).
// Tant que la garde ne regardait qu'une source, une rotation ne touchant que l'autre
// rendait 401 TOUTE la chaine KYB -- en silence, puisque net.http_post est fire-and-forget
// et que personne ne lit net._http_response.
//
// Le sentinelle pose ci-dessous est deliberement une valeur qui n'est PAS la cle d'env :
// c'est la seule facon de prouver que le second chemin de comparaison existe reellement.
// Un 401 sur le premier test signifierait que la garde est retombee sur une source unique.
// Les deux tests suivants sont l'autre moitie du contrat : le repli ne doit ouvrir AUCUNE
// porte de plus.

import { describe, it, expect } from 'vitest'
import { serviceRoleClient } from './helpers/supabase'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const ANON_KEY = process.env.SUPABASE_TEST_ANON_KEY ?? ''
// Meme motif et meme repli que agency-verification-run.spec.ts : la CI exporte le nouveau
// format dans SUPABASE_TEST_SERVICE_ROLE_KEY, le local porte le JWT legacy.
// `||` et non `??` : une variable posee mais VIDE doit aussi retomber sur le repli.
const SERVICE_ROLE_JWT =
  process.env.SUPABASE_TEST_SERVICE_ROLE_JWT || (process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? '')
const ENDPOINT = `${URL}/functions/v1/agency-verification-run`
const NIL_UUID = '00000000-0000-0000-0000-000000000000'

const CONFIG_KEY = 'service_role_key'

/** apikey + Authorization a la MEME valeur : la passerelle laisse passer
 *  (verify_jwt=false dans config.toml), l'autorisation reelle est tranchee PAR la
 *  fonction. NIL_UUID n'existe pas en base -- une garde franchie mene donc a 404, jamais
 *  a 200 : aucun check n'est ecrit par ce fichier. */
async function callRun(bearer: string): Promise<Response> {
  return fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: bearer,
      Authorization: `Bearer ${bearer}`,
    },
    body: JSON.stringify({ agency_id: NIL_UUID }),
  })
}

describe.skipIf(!HAS_KEYS)('agency-verification-run -- les deux formats du secret service-role', () => {
  it('un Bearer portant app_config.service_role_key est accepte, meme distinct de la cle d-env', async () => {
    const svc = serviceRoleClient()
    const { data: before } = await svc
      .from('app_config')
      .select('value')
      .eq('key', CONFIG_KEY)
      .maybeSingle()
    const original = (before?.value as string | undefined) ?? null
    const sentinel = 'sb_secret_zztest_second_format_sentinel'

    try {
      const { error } = await svc
        .from('app_config')
        .upsert({ key: CONFIG_KEY, value: sentinel }, { onConflict: 'key' })
      if (error) throw new Error(`set app_config ${CONFIG_KEY}: ${error.message}`)

      const res = await callRun(sentinel)
      expect(res.status, `attendu 404 (agence absente), obtenu ${res.status}`).toBe(404)
    } finally {
      // Restauration inconditionnelle : les tests backend tournent en serie
      // (fileParallelism: false) sur une base partagee -- laisser le sentinelle en place
      // couperait le declenchement KYB de tous les specs suivants.
      if (original === null) await svc.from('app_config').delete().eq('key', CONFIG_KEY)
      else await svc.from('app_config').update({ value: original }).eq('key', CONFIG_KEY)
    }
  }, 60_000)

  it('le repli app_config n-ouvre aucune porte : le jeton anon reste refuse', async () => {
    const res = await callRun(ANON_KEY)
    expect(res.status).toBe(401)
  }, 60_000)

  it('un secret quelconque reste refuse', async () => {
    const res = await callRun('sb_secret_ceci_n_est_pas_la_cle')
    expect(res.status).toBe(401)
  }, 60_000)

  it('la cle d-env (JWT legacy en local, sb_secret_ en CI) reste acceptee', async () => {
    const res = await callRun(SERVICE_ROLE_JWT)
    expect(res.status, `attendu 404 (agence absente), obtenu ${res.status}`).toBe(404)
  }, 60_000)
})
