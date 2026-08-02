// Les fonctions internes refusent un jeton FORGÉ {"role":"service_role"}.
//
// Toutes les edge functions sont déployées `--no-verify-jwt` (allowlist
// `JWT_PROTECTED` volontairement vide dans deploy.yml) : la plateforme ne
// vérifie AUCUNE signature. Une garde qui décode le JWT et lit sa revendication
// `role` ne prouve donc rien — n'importe qui fabrique le payload
// `{"role":"service_role"}`, y colle une signature bidon, et passe.
//
// C'est exactement ce que faisaient `admin-monitoring` (0b0949b9) et
// `ai-billing-monitor` (49022a70, dont le message de commit dit « use JWT role
// claim instead of strict key match ») ; `flatfox-sync`, `realadvisor-sync`,
// `market-scraper` et `send-visit-email` n'avaient, eux, aucune garde du tout.
//
// La seule garde valable est la comparaison à temps constant au secret partagé
// (`_shared/require-service-secret.ts`). Ce fichier la verrouille dans les deux
// sens : le jeton forgé est refusé, ET le vrai secret passe encore — sans quoi
// on « corrigerait » la faille en cassant silencieusement les crons, qui sont en
// fire-and-forget et dont personne ne lit le code de retour.
//
// ⚠ Assertion sur le CORPS, pas seulement sur le statut : la passerelle Supabase
// répond elle aussi 401. Sans vérifier que la réponse vient bien du gestionnaire,
// le test serait creux — il prouverait qu'un code jamais exécuté refuse bien.

import { describe, it, expect } from 'vitest'

const HAS_KEYS = !!(process.env.SUPABASE_TEST_ANON_KEY && process.env.SUPABASE_TEST_SERVICE_ROLE_KEY)
const URL = process.env.SUPABASE_TEST_URL ?? 'http://127.0.0.1:54321'
const SERVICE_KEY = process.env.SUPABASE_TEST_SERVICE_ROLE_KEY ?? ''

/** JWT syntaxiquement valide, signature bidon, payload `{"role":"service_role"}`. */
function forgedServiceRoleJwt(): string {
  const b64url = (o: unknown) =>
    btoa(JSON.stringify(o)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64url({ alg: 'HS256', typ: 'JWT' })}.${b64url({ role: 'service_role' })}.not_a_real_signature`
}

function endpoint(fn: string): string {
  return `${URL}/functions/v1/${fn}`
}

async function post(fn: string, headers: Record<string, string>, body = '{}') {
  const res = await fetch(endpoint(fn), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  })
  const text = await res.text()
  return { status: res.status, text }
}

/** Fonctions dont la garde interne est le SEUL rempart (pas de repli super-admin). */
const SERVICE_ONLY = ['flatfox-sync', 'realadvisor-sync', 'market-scraper', 'send-visit-email']

/** Fonctions à double appelant : cron OU super-admin interactif. */
const DUAL_CALLER = ['admin-monitoring', 'ai-billing-monitor']

describe.skipIf(!HAS_KEYS)('gardes de secret de service — jeton forgé', () => {
  it.each(SERVICE_ONLY)('%s refuse un jeton forgé {"role":"service_role"}', async (fn) => {
    const { status, text } = await post(fn, { Authorization: `Bearer ${forgedServiceRoleJwt()}` })

    expect(status, `${fn} : attendu 401, reçu ${status} — ${text.slice(0, 200)}`).toBe(401)

    // Le message vient du gestionnaire. La passerelle, elle, parlerait de
    // « Missing authorization header » / « Invalid JWT » sous une clé message/msg.
    expect(
      text,
      `${fn} : réponse du gestionnaire attendue, reçu ${text.slice(0, 200)}`,
    ).toContain('service_role required')
  })

  it.each(SERVICE_ONLY)('%s refuse un appel sans en-tête Authorization', async (fn) => {
    const { status, text } = await post(fn, {})
    expect(status, `${fn} : attendu 401, reçu ${status}`).toBe(401)
    expect(text).toContain('service_role required')
  })

  it.each(DUAL_CALLER)('%s ne laisse pas un jeton forgé se faire passer pour le cron', async (fn) => {
    const { status, text } = await post(fn, { Authorization: `Bearer ${forgedServiceRoleJwt()}` })

    // Le jeton forgé n'a pas de `sub` : la garde de service échoue, puis
    // requireSuperAdmin le rejette faute de session. 401, pas 200.
    expect(status, `${fn} : attendu 401, reçu ${status} — ${text.slice(0, 200)}`).toBe(401)
    expect(
      text,
      `${fn} : le corps ne doit RIEN livrer de métier, reçu ${text.slice(0, 200)}`,
    ).toContain('Invalid or expired session')
  })

  it('admin-monitoring ne livre aucune métrique à un jeton forgé', async () => {
    const { text } = await post('admin-monitoring', {
      Authorization: `Bearer ${forgedServiceRoleJwt()}`,
    })
    // Le MRR et les compteurs plateforme partaient dans la réponse 200 avant le
    // correctif : c'est la donnée dont la fuite justifiait la sévérité.
    for (const fuite of ['mrr_estimate', 'db_size_mb', 'metrics']) {
      expect(text, `« ${fuite} » ne doit pas fuiter`).not.toContain(fuite)
    }
  })
})

describe.skipIf(!HAS_KEYS)('gardes de secret de service — le vrai secret passe encore', () => {
  // Sans ces trois cas, le correctif pourrait « réussir » en cassant les crons.
  // Chaque corps est choisi pour franchir la garde SANS déclencher de travail :
  // on veut prouver que la porte s'ouvre, pas lancer un crawl dans la CI.

  it('market-scraper accepte le secret puis rejette le corps invalide (400, pas 401)', async () => {
    const { status } = await post('market-scraper', { Authorization: `Bearer ${SERVICE_KEY}` })
    // 400 = la validation métier a parlé, donc la garde a laissé passer.
    expect(status, `attendu 400 (garde franchie), reçu ${status}`).toBe(400)
  })

  it('send-visit-email accepte le secret puis ne trouve pas la visite (404, pas 401)', async () => {
    const { status } = await post(
      'send-visit-email',
      { Authorization: `Bearer ${SERVICE_KEY}` },
      JSON.stringify({ type: 'reminder', visit_id: '00000000-0000-4000-8000-000000000000' }),
    )
    expect(status, `attendu 404 (garde franchie), reçu ${status}`).toBe(404)
  })

  it('flatfox-sync accepte le secret (balayage à vide, aucune écriture)', async () => {
    // `total_expected: 0` ⇒ ratio 0 < SAFETY_MIN_RATIO ⇒ runSweep s'arrête net.
    // Aucun `status='removed'` n'est posé : le test ouvre la porte sans rien casser.
    const { status } = await post(
      'flatfox-sync',
      { Authorization: `Bearer ${SERVICE_KEY}` },
      JSON.stringify({ mode: 'sweep', total_expected: 0, sync_start_at: new Date().toISOString() }),
    )
    expect(status, `attendu 202 (garde franchie), reçu ${status}`).toBe(202)
  })
})
