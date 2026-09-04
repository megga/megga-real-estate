// supabase/functions/mail-oauth/index.ts
// Connexion d'une boîte par OAuth en pop-up (plan §3 D1, §4 « Ajouter une boîte »).
//   start      → { url, state }            (state + code_verifier gardés en base)
//   exchange   → { account }               (échange PKCE, identité, Vault, 1re synchro en fond)
//   disconnect → { ok }                    (révocation, Vault effacé, cascade)
//   update     → { account }               (display_name, visibility, status active⇄disabled
//                                           — propriétaire seul)
// Garde : requireAgentAuth AVANT toute lecture de configuration (règle 4 du lot).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { buildAuthorizeUrl, exchangeCode, fetchIdentity, pkceChallenge, randomToken, revokeToken, type OAuthProvider } from '../_shared/mail/oauth.ts'
import { deleteAccountSecret, readAccountSecret, storeAccountSecret } from '../_shared/mail/secrets.ts'
import { loadAgencyAccount, loadVisibleAccount, providerConfigFromEnv, redirectUriFor } from '../_shared/mail/guard.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow, OAuthSecret } from '../_shared/mail/types.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

/** Six libellés semés à la première boîte de l'agence (D12), dans la langue de l'agent. */
const SEED_LABELS: Record<'fr' | 'de' | 'en' | 'it', string[]> = {
  fr: ['À traiter', 'Banques', 'Notaires', 'Clients', 'Visites', 'Fournisseurs'],
  de: ['Zu erledigen', 'Banken', 'Notare', 'Kunden', 'Besichtigungen', 'Lieferanten'],
  en: ['To handle', 'Banks', 'Notaries', 'Clients', 'Viewings', 'Suppliers'],
  it: ['Da trattare', 'Banche', 'Notai', 'Clienti', 'Visite', 'Fornitori'],
}
const SEED_COLORS = ['#fe566b', '#8dc1ff', '#efc42c', '#adecbb', '#424bfb', '#686868'] // MXC_SYSTEM + accent + n500

const PUBLIC_COLS = 'id, agency_id, owner_id, provider, email, display_name, visibility, status, last_sync_at, last_error, created_at'

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth
  const ctx = { userId: user.id, agencyId: profile.agency_id }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const action = String(body.action ?? '')
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))

  if (action === 'start') {
    const provider = body.provider as OAuthProvider
    if (provider !== 'gmail' && provider !== 'outlook') return json({ error: 'invalid_provider' }, 400)
    const redirectUri = redirectUriFor(String(body.origin ?? ''))
    if (!redirectUri) return json({ error: 'invalid_origin' }, 400)
    if (!cfg[provider].clientId) return json({ error: 'provider_not_configured', provider }, 503)
    const visibility = body.visibility === 'agency' ? 'agency' : 'owner'
    const loginHint = typeof body.login_hint === 'string' && body.login_hint.includes('@') ? body.login_hint.trim().toLowerCase() : null
    const state = randomToken(32)
    const codeVerifier = randomToken(48)
    const { error } = await admin.from('mail_oauth_states').insert({
      state, user_id: user.id, agency_id: profile.agency_id, provider, code_verifier: codeVerifier,
      login_hint: loginHint, visibility, redirect_uri: redirectUri,
    })
    if (error) return json({ error: 'state_store_failed' }, 500)
    const url = buildAuthorizeUrl(provider, { clientId: cfg[provider].clientId, redirectUri, state, codeChallenge: await pkceChallenge(codeVerifier), loginHint })
    return json({ url, state })
  }

  if (action === 'exchange') {
    const code = String(body.code ?? '')
    const state = String(body.state ?? '')
    if (!code || !/^[0-9a-f]{64}$/.test(state)) return json({ error: 'invalid_state' }, 403)
    /**
     * ⛔ LA CONSOMMATION EST LA GARDE, en UNE instruction. La version d'origine lisait la
     * ligne, refusait un `consumed_at` non nul, PUIS marquait — un contrôle-puis-agit que
     * deux `exchange` concurrents sur le même `{code, state}` passaient tous les deux. La
     * propriété annoncée (« un state ne sert qu'une fois ») n'était donc pas tenue ici mais
     * chez Google/Microsoft, qui rendent `invalid_grant` au second échange — un 502 après
     * coup. Et sur un fournisseur lent, les deux appels atteignaient `storeAccountSecret` :
     * un secret Vault orphelin de plus à chaque course.
     *
     * L'UPDATE conditionnel tranche : `consumed_at is null and expires_at > now()` sont
     * évalués et écrits dans la même instruction, donc une seule des deux requêtes voit une
     * ligne rendue. Zéro ligne = état inconnu, déjà consommé, ou périmé — indistinctement
     * `invalid_state`, comme avant (aucun oracle offert à l'appelant).
     */
    const { data: consumed, error: eState } = await admin.from('mail_oauth_states')
      .update({ consumed_at: new Date().toISOString() })
      .eq('state', state).eq('user_id', user.id)
      .is('consumed_at', null).gt('expires_at', new Date().toISOString())
      .select('*')
    // Une lecture en échec n'est pas un état invalide : le dire 403 enverrait l'agent
    // recommencer une autorisation qui n'a rien de fautif.
    if (eState) return json({ error: 'state_consume_failed', detail: eState.message }, 500)
    const st = (consumed ?? [])[0]
    if (!st) return json({ error: 'invalid_state' }, 403)
    const provider = st.provider as OAuthProvider

    let tokens: { access_token: string; refresh_token: string; expires_in: number }
    let identity: { email: string; name: string | null }
    try {
      tokens = await exchangeCode(provider, { code, codeVerifier: st.code_verifier, clientId: cfg[provider].clientId, clientSecret: cfg[provider].clientSecret, redirectUri: st.redirect_uri })
      identity = await fetchIdentity(provider, tokens.access_token)
    } catch (e) {
      return json({ error: 'exchange_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
    }

    const secret: OAuthSecret = {
      refresh_token: tokens.refresh_token, access_token: tokens.access_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    }
    // Une boîte déjà connectée (même agence, même adresse) est RÉAUTORISÉE, pas dupliquée.
    const { data: existing } = await admin.from('mail_accounts').select('id, vault_secret_id, owner_id, visibility')
      // ⚠ `.eq` et non `.ilike` : dans un motif LIKE, `_` et `%` sont des JOKERS —
      // `john_doe@x.ch` apparierait `johnXdoe@x.ch`, et `.maybeSingle()` lèverait sur
      // deux résultats. `identity.email` est déjà en minuscules (fetchIdentity) et
      // l'index unique est sur lower(email) : l'égalité est correcte ET indexée.
      .eq('agency_id', profile.agency_id).eq('provider', provider).eq('email', identity.email).maybeSingle()
    let accountId: string
    if (existing) {
      // ⚠ Une RÉAUTORISATION n'a pas à échouer parce que l'ANCIEN secret ne s'efface
      // pas : le nouveau va le remplacer dans la ligne, la boîte doit repartir. Mais
      // l'ancien devient alors un secret orphelin dans Vault — c'est écrit, ça ne
      // disparaît plus en silence à chaque reconnexion.
      if (existing.vault_secret_id) {
        await deleteAccountSecret(admin, existing.vault_secret_id)
          .catch((e) => console.error(`[mail-oauth] ancien secret ${existing.vault_secret_id} ORPHELIN (compte ${existing.id}):`, e instanceof Error ? e.message : String(e)))
      }
      const vaultId = await storeAccountSecret(admin, `mail:${provider}:${identity.email}`, secret)
      /**
       * ⛔ UNE RÉAUTORISATION NE CHANGE PAS DE MAIN. Le patch écrivait `owner_id: user.id`
       * ET `visibility: st.visibility` : n'importe quel membre de l'agence connaissant le
       * mot de passe de la boîte PARTAGÉE — c'est précisément ce que « partagée » veut dire
       * — la reconnectait en `{visibility:'owner'}` et en devenait propriétaire. La boîte et
       * TOUT son historique ingéré sortaient alors de la vue du directeur et de chaque
       * admin (`loadVisibleAccount` rend null pour eux) : plus de lecture, plus de `update`,
       * plus de `disconnect` par aucun edge. Rattrapable seulement par écriture directe en
       * base. Le geste demandé était « redonner un jeton », le geste obtenu était « prendre
       * la boîte ».
       *
       * ⚠ On REFUSE la prise, pas la réautorisation : la boîte partagée dont le jeton a
       * expiré doit pouvoir être réparée par le collègue qui a les identifiants, sans quoi
       * l'agence attend le retour de congés du propriétaire. Seuls le secret, le statut et
       * le nom d'affichage bougent. Le propriétaire et la visibilité ne se changent que par
       * l'action `update`, réservée au propriétaire.
       */
      if (existing.owner_id !== user.id) {
        console.error(`[mail-oauth] compte ${existing.id} réautorisé par ${user.id}, propriétaire ${existing.owner_id} — jeton remplacé, propriété INCHANGÉE`)
      }
      const { error } = await admin.from('mail_accounts').update({
        vault_secret_id: vaultId, status: 'active', last_error: null, sync_failures: 0,
        display_name: identity.name, next_sync_at: new Date().toISOString(),
      }).eq('id', existing.id)
      if (error) return json({ error: 'account_update_failed' }, 500)
      accountId = existing.id
    } else {
      const vaultId = await storeAccountSecret(admin, `mail:${provider}:${identity.email}`, secret)
      const { data: ins, error } = await admin.from('mail_accounts').insert({
        agency_id: profile.agency_id, owner_id: user.id, provider, email: identity.email, display_name: identity.name,
        visibility: st.visibility, status: 'active', vault_secret_id: vaultId,
      }).select('id').single()
      if (error) {
        // Retour arrière : sans ligne pour le porter, le secret n'aurait plus de nom.
        await deleteAccountSecret(admin, vaultId)
          .catch((e) => console.error(`[mail-oauth] secret ${vaultId} ORPHELIN après échec d'insertion:`, e instanceof Error ? e.message : String(e)))
        return json({ error: 'account_insert_failed', detail: error.message }, 500)
      }
      accountId = ins.id
    }

    // Libellés par défaut si l'agence n'en a aucun (langue de correspondance de l'agent).
    const { count } = await admin.from('mail_labels').select('id', { count: 'exact', head: true }).eq('agency_id', profile.agency_id)
    if ((count ?? 0) === 0) {
      const { data: p } = await admin.from('profiles').select('language').eq('id', user.id).maybeSingle()
      const lang = (['fr', 'de', 'en', 'it'] as const).find((l) => l === p?.language) ?? 'fr'
      await admin.from('mail_labels').insert(SEED_LABELS[lang].map((name, i) => ({ agency_id: profile.agency_id, name, color: SEED_COLORS[i], position: i, is_default: true })))
    }

    // Première synchro en arrière-plan : l'assistant affiche « Boîte connectée » sans attendre.
    const { data: account } = await admin.from('mail_accounts').select('*').eq('id', accountId).single()
    // ⚠ Gardé comme le fait flatfox-sync/index.ts:768-771, et pour une raison
    // précise : à ce point la ligne mail_accounts EST écrite et le secret EST dans
    // Vault. Un `EdgeRuntime` absent lèverait un ReferenceError APRÈS le succès —
    // l'assistant verrait un 500 pour une boîte pourtant connectée.
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
      EdgeRuntime.waitUntil(syncAccount(admin, account as MailAccountRow, cfg, 45_000))
    }
    const { data: pub } = await admin.from('mail_accounts').select(PUBLIC_COLS).eq('id', accountId).single()
    return json({ account: pub })
  }

  if (action === 'disconnect') {
    // ⛔ CHARGÉ PAR L'AGENCE, PAS PAR LA VISIBILITÉ (loadAgencyAccount, guard.ts). Avec
    // `loadVisibleAccount`, la branche « admin ou manager » juste en dessous était
    // INATTEIGNABLE pour les boîtes qui la justifient : une boîte `visibility: 'owner'`
    // d'un autre membre rendait 404 avant même le contrôle de rôle. Le rôle vient d'une
    // source de confiance (select serveur dans require-agent-auth), et l'agence reste la
    // barrière — un compte d'une autre agence rend toujours 404.
    const account = await loadAgencyAccount(admin, String(body.account_id ?? ''), ctx)
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.owner_id !== user.id && !['admin', 'manager'].includes(profile.role ?? '')) return json({ error: 'forbidden' }, 403)
    /**
     * ⛔ ON RÉVOQUE ET ON EFFACE AVANT DE SUPPRIMER LA LIGNE, et aucun des trois gestes
     * n'est avalé. La version d'origine faisait `.catch(() => null)` sur la lecture Vault
     * (la révocation sautait alors en silence), `.catch(() => undefined)` sur
     * l'effacement, puis supprimait `mail_accounts` — c'est-à-dire LE SEUL POINTEUR vers
     * `vault_secret_id` — et répondait `{ ok: true }`. Au pire des cas MEGGA conservait
     * un jeton de rafraîchissement Google chiffré, NON révoqué et plus référencé par
     * rien, pour une boîte que l'utilisateur croyait déconnectée ; au cas courant,
     * l'autorisation restait simplement active chez Google.
     *
     * En cas d'échec, la LIGNE RESTE (en `disabled`) : le pointeur survit, la
     * déconnexion est réessayable, et la réponse le dit au lieu de mentir.
     */
    if (account.vault_secret_id) {
      // ⚠ Deux issues à ne PAS confondre. Une LEVÉE = Vault n'a pas répondu, on ne sait
      // pas si le jeton existe : refuser, garder la ligne, réessayable. Un `null` = la
      // ligne de secret n'est plus là (déconnexion déjà à demi faite, purge) : il n'y a
      // rien à révoquer ni à effacer, et bloquer là condamnerait le compte à ne jamais
      // pouvoir être supprimé.
      let secret: OAuthSecret | null = null
      try { secret = await readAccountSecret<OAuthSecret>(admin, account.vault_secret_id) }
      catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        console.error(`[mail-oauth] secret ${account.vault_secret_id} illisible (compte ${account.id}):`, detail)
        await admin.from('mail_accounts').update({ status: 'disabled', last_error: 'disconnect: secret illisible, révocation impossible' }).eq('id', account.id)
        return json({ error: 'revocation_failed', detail: 'secret_unreadable', account_id: account.id }, 502)
      }
      if (!secret) console.error(`[mail-oauth] compte ${account.id} : aucun secret sous ${account.vault_secret_id} — rien à révoquer`)
      if (secret && 'refresh_token' in secret && (account.provider === 'gmail' || account.provider === 'outlook')) {
        if (!await revokeToken(account.provider, secret.refresh_token)) {
          await admin.from('mail_accounts').update({ status: 'disabled', last_error: 'disconnect: révocation refusée par le fournisseur' }).eq('id', account.id)
          return json({ error: 'revocation_failed', detail: 'provider_refused', account_id: account.id }, 502)
        }
      }
      try { if (secret) await deleteAccountSecret(admin, account.vault_secret_id) }
      catch (e) {
        const detail = e instanceof Error ? e.message : String(e)
        console.error(`[mail-oauth] secret ${account.vault_secret_id} non effacé (compte ${account.id}):`, detail)
        // Le jeton est révoqué, donc inoffensif — mais il reste dans Vault : garder la
        // ligne est ce qui laisse une chance de le retrouver et de réessayer.
        await admin.from('mail_accounts').update({ status: 'disabled', last_error: `disconnect: secret non effacé (${detail.slice(0, 200)})` }).eq('id', account.id)
        return json({ ok: false, error: 'vault_delete_failed', detail, account_id: account.id }, 500)
      }
    }
    const { error } = await admin.from('mail_accounts').delete().eq('id', account.id)
    if (error) return json({ error: 'delete_failed', detail: error.message }, 500)
    return json({ ok: true })
  }

  if (action === 'update') {
    const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), ctx)
    if (!account) return json({ error: 'not_found' }, 404)
    if (account.owner_id !== user.id) return json({ error: 'forbidden' }, 403)
    const patch: Record<string, unknown> = {}
    if (typeof body.display_name === 'string') patch.display_name = body.display_name.slice(0, 80)
    if (body.visibility === 'owner' || body.visibility === 'agency') patch.visibility = body.visibility
    /**
     * METTRE EN PAUSE — le troisième champ que le plan maître §5 promet au propriétaire
     * (« UPDATE limité à `display_name`, `visibility`, `status='disabled'` »), et qui
     * n'existait nulle part. Sans lui, arrêter une boîte passait par `disconnect`, qui
     * révoque le jeton et emporte en cascade fils, messages et pièces : une réponse
     * DESTRUCTIVE à une demande réversible (« je pars trois semaines »).
     *
     * ⚠ La bascule ne vaut qu'entre `active` et `disabled`. Les trois autres états sont
     * des VERDICTS du système — `reauth_required` (le fournisseur a coupé),
     * `error` (cinq échecs d'affilée), et le `disabled` posé par le départ du
     * propriétaire — qu'un clic ne doit pas pouvoir effacer : les remettre `active`
     * relancerait un balayage condamné, ou, dans le dernier cas, l'ingestion du courrier
     * d'un agent parti. Ces états-là se réparent par une RÉAUTORISATION, pas par un
     * interrupteur. D'où un 409 explicite plutôt qu'un champ ignoré en silence.
     */
    if (body.status === 'disabled' || body.status === 'active') {
      if (account.status !== 'active' && account.status !== 'disabled') {
        return json({ error: 'status_not_togglable', status: account.status }, 409)
      }
      patch.status = body.status
      // Redémarrer, c'est repartir propre ET tout de suite : sinon la boîte traînerait
      // le dernier `last_error` et le backoff écrit avant la pause.
      if (body.status === 'active') { patch.last_error = null; patch.sync_failures = 0; patch.next_sync_at = new Date().toISOString() }
    }
    const { data: pub, error } = await admin.from('mail_accounts').update(patch).eq('id', account.id).select(PUBLIC_COLS).single()
    if (error) return json({ error: 'update_failed' }, 500)
    return json({ account: pub })
  }

  return json({ error: 'unknown_action' }, 400)
})
