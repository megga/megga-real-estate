// supabase/functions/mail-sync/index.ts
// Balayage de synchronisation. Deux appelants :
//   - pg_cron `mail-sync-2min` (Bearer = clé service, corps {}) : jusqu'à 25 comptes dus ;
//   - un agent connecté (`{ account_id }`) via mail-actions `sync_now` ou directement :
//     UN compte, visible par lui, budget court — c'est le « rafraîchir » de l'écran.
// Un bail en base (mail_cron_locks) empêche deux balayages simultanés : le budget
// (60 s) dépasse l'intervalle (120 s) rarement, mais un tick lent + un tick suivant
// = double coût fournisseur et curseurs en course. Le TTL (180 s) est le filet.
// ⚠ Le TTL ne tient que parce que le dépassement d'une passe est BORNÉ : depuis le
// 04.09.2026, `syncAccount` vérifie son budget DANS la boucle des messages et non plus
// seulement en tête de page (une page = jusqu'à 50 `messages.get` séquentiels, soit
// plusieurs secondes de débordement). 60 s de budget + le temps d'un message restent très
// en deçà des 180 s. Et chaque compte porte en plus son propre bail
// (`mail-sync:<account_id>`, sync.ts), qui sérialise le balayage contre les trois chemins
// déclenchés par un agent.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { isServiceSecret } from '../_shared/require-service-secret.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadVisibleAccount, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

const SWEEP_BUDGET_MS = 60_000
const PER_ACCOUNT_BUDGET_MS = 20_000
const TARGETED_BUDGET_MS = 20_000
const MAX_ACCOUNTS_PER_TICK = 25
const LOCK_TTL_MS = 180_000
/** `{}` ou `{"account_id":"<uuid>"}` : rien de légitime ne dépasse quelques dizaines d'octets. */
const MAX_BODY_BYTES = 4_096

type LockResult =
  | { ok: true; until: string }
  | { ok: false; reason: 'locked' }
  | { ok: false; reason: 'error'; detail: string }

/**
 * Prend le bail du balayage.
 *
 * ⛔ Zéro ligne mise à jour ne prouve PAS qu'un autre balayage tient le bail : la ligne
 * peut ne pas exister du tout (base fraîche, purge manuelle), la migration étant son
 * unique créatrice. Chaque balayage répondait alors `{ ok: true, skipped: 'locked' }`
 * en 200, POUR TOUJOURS — la synchro morte, pg_cron au vert. Le semis
 * `on conflict do nothing` (`ignoreDuplicates`) répare ce cas sans jamais écraser un
 * bail tenu ; et une erreur PostgREST n'est plus rendue comme un « quelqu'un d'autre
 * travaille », mais comme une erreur.
 */
async function acquireLock(admin: SupabaseClient): Promise<LockResult> {
  const seed = await admin.from('mail_cron_locks')
    .upsert({ job: 'mail-sync', locked_until: new Date(0).toISOString() }, { onConflict: 'job', ignoreDuplicates: true })
  if (seed.error) return { ok: false, reason: 'error', detail: `lock seed: ${seed.error.message}` }
  const until = new Date(Date.now() + LOCK_TTL_MS).toISOString()
  const { data, error } = await admin.from('mail_cron_locks').update({ locked_until: until })
    .eq('job', 'mail-sync').lt('locked_until', new Date().toISOString()).select('job')
  if (error) return { ok: false, reason: 'error', detail: `lock acquire: ${error.message}` }
  return (data ?? []).length === 1 ? { ok: true, until } : { ok: false, reason: 'locked' }
}

/**
 * Rend le bail — et SEULEMENT le sien. La libération était inconditionnelle : un
 * balayage qui dépassait le TTL de 180 s libérait, en finissant, le bail qu'un
 * successeur venait de prendre, et un troisième démarrait à côté du deuxième — deux
 * balayages en course sur le même `sync_cursor`, sans le moindre signal.
 */
async function releaseLock(admin: SupabaseClient, until: string): Promise<void> {
  const { error } = await admin.from('mail_cron_locks').update({ locked_until: new Date().toISOString() })
    .eq('job', 'mail-sync').eq('locked_until', until)
  if (error) console.error('[mail-sync] libération du bail refusée:', error.message)
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  // Le client service-role est la SEULE lecture de configuration autorisée avant la
  // garde : `isServiceSecret` en a besoin pour lire `app_config`. Les secrets des
  // fournisseurs, eux, se lisent APRÈS — règle 4 du lot (corrigé le 03.09.2026 :
  // la version d'origine lisait les quatre secrets et interrogeait app_config avant
  // de refuser un appelant anonyme).
  // ⛔ LE CORPS EST BORNÉ AVANT D'ÊTRE LU. Cette edge est déployée `--no-verify-jwt` :
  // n'importe qui peut la POSTer, et `await req.json()` sans plafond faisait tamponner au
  // runtime un corps de plusieurs centaines de Mo AVANT la moindre garde. Or les deux seuls
  // corps légitimes sont `{}` (balayage) et `{"account_id":"<uuid>"}` : quelques dizaines
  // d'octets. ⚠ `Content-Length` est absent d'un envoi en `chunked` — le plafond n'est donc
  // pas une preuve, c'est le coût d'entrée d'un abus trivial qu'il retire. La lecture
  // d'`app_config` par `isServiceSecret`, elle, est déjà précédée du contrôle d'en-tête
  // `Authorization` (require-service-secret.ts:24) : un POST anonyme SANS en-tête ne coûte
  // aucun aller-retour en base.
  const declared = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) return json({ error: 'payload_too_large' }, 413)

  const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
  let body: Record<string, unknown> = {}
  try { body = await req.json() } catch { /* corps vide = balayage */ }

  // ── Appel ciblé par un agent ───────────────────────────────────────────────
  if (typeof body.account_id === 'string') {
    const auth = await requireAgentAuth(req, corsHeaders)
    if (auth instanceof Response) return auth
    const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
    const account = await loadVisibleAccount(auth.supabase, body.account_id, { userId: auth.user.id, agencyId: auth.profile.agency_id })
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.status !== 'active') return json({ error: 'account_not_active', status: account.status }, 409)
    const r = await syncAccount(auth.supabase, account, cfg, TARGETED_BUDGET_MS)
    return json({ account_id: account.id, ...r })
  }

  // ── Balayage cron ──────────────────────────────────────────────────────────
  if (!(await isServiceSecret(admin, req))) return json({ error: 'unauthorized' }, 401)
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))
  const lock = await acquireLock(admin)
  if (!lock.ok && lock.reason === 'error') {
    console.error('[mail-sync] bail:', lock.detail)
    return json({ error: 'lock_failed', detail: lock.detail }, 500)
  }
  if (!lock.ok) return json({ ok: true, skipped: 'locked' })
  const started = Date.now()
  const results: Record<string, unknown>[] = []
  let budgetExhausted = false
  let dueCount = 0
  try {
    // ⛔ La file de travail est LUE, ou le balayage échoue. Sans le contrôle d'erreur,
    // une lecture ratée (cache de schéma périmé juste après le déploiement, timeout)
    // rendait `due = null`, la boucle ne tournait pas, et la réponse était
    // `{ ok: true, synced: 0 }` en 200 : pg_cron au vert, aucun `last_error` écrit —
    // toute la messagerie du produit arrêtée sans un seul signal rouge. C'est
    // exactement la panne muette de la synchro d'agenda.
    const { data: due, error } = await admin.from('mail_accounts').select('*')
      .eq('status', 'active').lte('next_sync_at', new Date().toISOString())
      .order('next_sync_at', { ascending: true }).limit(MAX_ACCOUNTS_PER_TICK)
    if (error) {
      console.error('[mail-sync] file des comptes dus illisible:', error.message)
      return json({ error: 'due_query_failed', detail: error.message }, 500)
    }
    // ⚠ `status = 'active'` ne dit RIEN de l'appartenance du propriétaire : le départ
    // d'un agent (`team_remove_member`) ne touche pas `mail_accounts`. C'est
    // `assertOwnerStillInAgency`, au premier geste de `syncAccount`, qui refuse la
    // passe et bascule la boîte en `disabled` — elle sort alors de cette file d'
    // elle-même, sans qu'un seul message ait été écrit dans l'ancienne agence.
    dueCount = (due ?? []).length
    for (const account of (due ?? []) as MailAccountRow[]) {
      // ⚠ Sortir par ÉPUISEMENT DU BUDGET et sortir par « plus rien à faire » sont deux
      // états opposés que la réponse confondait : `{ ok: true, synced: 3 }` dans les deux
      // cas. Le premier veut dire qu'il reste des boîtes en file à chaque tick — le
      // symptôme de l'affamement, qu'aucun `last_error` n'écrit puisque personne n'échoue.
      if (Date.now() - started > SWEEP_BUDGET_MS) { budgetExhausted = true; break }
      const r = await syncAccount(admin, account, cfg, Math.min(PER_ACCOUNT_BUDGET_MS, SWEEP_BUDGET_MS - (Date.now() - started)))
      results.push({ account_id: account.id, provider: account.provider, ...r })
    }
  } finally {
    await releaseLock(admin, lock.until)
  }
  return json({ ok: true, synced: results.length, due: dueCount, budget_exhausted: budgetExhausted, elapsed_ms: Date.now() - started, results })
})
