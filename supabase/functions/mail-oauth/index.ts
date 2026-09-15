// supabase/functions/mail-oauth/index.ts
// Connexion d'une boîte par OAuth en pop-up (plan §3 D1, §4 « Ajouter une boîte »).
//   start      → { url, state }            (state + code_verifier gardés en base)
//   exchange   → { account }               (échange PKCE, identité, Vault, 1re synchro en fond)
//   disconnect → { ok }                    (révocation, Vault effacé, cascade)
//   update     → { account }               (display_name, visibility, status active⇄disabled
//                                           — propriétaire seul)
//   imap_detect  → { oauth, preset }       (les serveurs reconnus d'une adresse : domaine,
//                                           puis MX — pré-remplit l'assistant)
//   connect_imap → { account }             (IMAP/SMTP par mot de passe : test des deux
//                                           serveurs, Vault, 1re synchro en fond — lot 3)
// Garde : requireAgentAuth AVANT toute lecture de configuration (règle 4 du lot).
//
// ⛔ Les échecs rendent un CODE (`error`), et `detail` n'est plus qu'un code lui aussi
// (audit du 13.09.2026, S14) : il portait le message Postgres ou la description libre du
// fournisseur, que la modale et la page de retour affichaient à l'agent. Le texte est au
// journal de la fonction ; l'écran traduit les codes (`OAUTH_ERRORS`, `mail.callback.failed`).
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { buildAuthorizeUrl, exchangeCode, fetchIdentity, oauthFailureCode, pkceChallenge, randomToken, type OAuthProvider } from '../_shared/mail/oauth.ts'
import { deleteAccountSecret, storeAccountSecret } from '../_shared/mail/secrets.ts'
import { disconnectMailAccount } from '../_shared/mail/disconnect.ts'
import { loadAgencyAccount, loadVisibleAccount, providerConfigFromEnv, redirectUriFor } from '../_shared/mail/guard.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import { imapTestConnexion } from '../_shared/mail/imap.ts'
import { detecterServeurs } from '../_shared/mail/imap-presets.ts'
import type { ImapConfig, ImapSecret, MailAccountRow, OAuthSecret } from '../_shared/mail/types.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { assertPublicHost } from '../_shared/safe-fetch.ts'

declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void }
type SupabaseAdmin = Parameters<typeof syncAccount>[0]

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

/** Le motif d'adresse de `mail-send` : ce qu'on connecte doit pouvoir envoyer. */
const ADRESSE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/**
 * Les seuls ports qu'une boîte IMAP peut désigner : IMAP chiffré (993) ou à monter (143),
 * SMTP chiffré (465) ou à monter (587). ⛔ Un port libre ferait de l'assistant un balayeur
 * de ports tenu par nos serveurs. (25 est de toute façon filtré par l'edge, mesuré en T3.1.)
 */
const PORTS_IMAP = new Set([993, 143])
const PORTS_SMTP = new Set([465, 587])

/** Six libellés à la première boîte de l'agence, dans la langue de l'agent (D12). */
async function semerLibelles(admin: SupabaseAdmin, agencyId: string, userId: string): Promise<void> {
  const { count } = await admin.from('mail_labels').select('id', { count: 'exact', head: true }).eq('agency_id', agencyId)
  if ((count ?? 0) > 0) return
  const { data: p } = await admin.from('profiles').select('language').eq('id', userId).maybeSingle()
  const lang = (['fr', 'de', 'en', 'it'] as const).find((l) => l === p?.language) ?? 'fr'
  await admin.from('mail_labels').insert(SEED_LABELS[lang].map((name, i) => ({ agency_id: agencyId, name, color: SEED_COLORS[i], position: i, is_default: true })))
}

/**
 * Première synchro en arrière-plan, puis la ligne publique du compte : l'assistant affiche
 * « Boîte connectée » sans attendre l'import.
 *
 * ⚠ Gardé comme le fait flatfox-sync/index.ts:768-771, et pour une raison précise : à ce
 * point la ligne mail_accounts EST écrite et le secret EST dans Vault. Un `EdgeRuntime`
 * absent lèverait un ReferenceError APRÈS le succès — l'assistant verrait un 500 pour une
 * boîte pourtant connectée.
 */
async function lancerEtRendre(admin: SupabaseAdmin, accountId: string, cfg: ReturnType<typeof providerConfigFromEnv>): Promise<Response> {
  const { data: account } = await admin.from('mail_accounts').select('*').eq('id', accountId).single()
  if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) {
    EdgeRuntime.waitUntil(syncAccount(admin, account as MailAccountRow, cfg, 45_000))
  }
  const { data: pub } = await admin.from('mail_accounts').select(PUBLIC_COLS).eq('id', accountId).single()
  return json({ account: pub })
}

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
    if (eState) {
      console.error('[mail-oauth] consommation du state en échec :', redactedErrorMessage(eState))
      return json({ error: 'state_consume_failed' }, 500)
    }
    const st = (consumed ?? [])[0]
    if (!st) return json({ error: 'invalid_state' }, 403)
    const provider = st.provider as OAuthProvider

    let tokens: { access_token: string; refresh_token: string; expires_in: number }
    let identity: { email: string; name: string | null }
    try {
      tokens = await exchangeCode(provider, { code, codeVerifier: st.code_verifier, clientId: cfg[provider].clientId, clientSecret: cfg[provider].clientSecret, redirectUri: st.redirect_uri })
      identity = await fetchIdentity(provider, tokens.access_token)
    } catch (e) {
      // `detail` = le code OAuth normalisé (`invalid_grant`, `invalid_client`…) : la modale
      // l'affiche après « La connexion a échoué : ». La description du fournisseur — traces,
      // corrélation, horodatage chez Microsoft — reste ici.
      console.error(`[mail-oauth] échange ${provider} en échec :`, redactedErrorMessage(e))
      return json({ error: 'exchange_failed', detail: oauthFailureCode(e) }, 502)
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
        console.error('[mail-oauth] insertion du compte en échec :', redactedErrorMessage(error))
        // Retour arrière : sans ligne pour le porter, le secret n'aurait plus de nom.
        await deleteAccountSecret(admin, vaultId)
          .catch((e) => console.error(`[mail-oauth] secret ${vaultId} ORPHELIN après échec d'insertion:`, e instanceof Error ? e.message : String(e)))
        return json({ error: 'account_insert_failed' }, 500)
      }
      accountId = ins.id
    }

    await semerLibelles(admin, profile.agency_id, user.id)
    return lancerEtRendre(admin, accountId, cfg)
  }

  if (action === 'imap_detect') {
    // Les serveurs d'une adresse, pour pré-remplir l'assistant (`imap-presets.ts`). Une
    // requête MX au plus : rien ne s'ouvre vers l'hôte, et un échec vaut « non reconnu ».
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!ADRESSE.test(email)) return json({ error: 'invalid_input' }, 400)
    const detection = await detecterServeurs(email, (domaine) => Promise.race([
      // ⛔ Nom COMPLET, point final compris (cf. `resolveAll` de safe-fetch) : sans lui, un
      // domaine sans MX repart vers le domaine de recherche du résolveur, 5 s perdues.
      Deno.resolveDns(`${domaine}.`, 'MX').then((r) => r.sort((a, b) => a.preference - b.preference).map((x) => x.exchange)),
      new Promise<string[]>((_, rej) => setTimeout(() => rej(new Error('mx_timeout')), 3_000)),
    ]))
    return json(detection)
  }

  if (action === 'connect_imap') {
    const email = String(body.email ?? '').trim().toLowerCase()
    const smtpPort = Number(body.smtp_port ?? 465)
    const imap: ImapConfig = {
      imapHost: String(body.imap_host ?? '').trim().toLowerCase(),
      imapPort: Number(body.imap_port ?? 993),
      smtpHost: String(body.smtp_host ?? '').trim().toLowerCase(),
      smtpPort,
      user: String(body.user ?? '').trim() || email,
      // Le PORT décide du chiffrement (`smtpSecurite`) ; le champ ne fait que le consigner.
      encryption: smtpPort === 587 ? 'starttls' : 'ssl',
    }
    const password = typeof body.password === 'string' ? body.password : ''
    if (!ADRESSE.test(email) || !imap.imapHost || !imap.smtpHost || !password || password.length > 1024) return json({ error: 'invalid_input' }, 400)
    if (!PORTS_IMAP.has(imap.imapPort) || !PORTS_SMTP.has(imap.smtpPort)) return json({ error: 'port_not_allowed' }, 400)
    /**
     * ⛔ UNE BOÎTE IMAP DÉJÀ CONNECTÉE NE SE RECONNECTE QUE PAR SON PROPRIÉTAIRE. L'adresse
     * est un champ LIBRE : rien, en IMAP, ne prouve qu'elle appartient à qui la saisit — OAuth,
     * lui, l'atteste par `fetchIdentity`. La réautorisation recopiée de l'échange OAuth
     * remplaçait donc le mot de passe ET les serveurs de la boîte d'un collègue : l'agent B
     * donnait l'adresse d'Alice avec SES propres serveurs, et les envois d'Alice partaient par
     * le SMTP de B, qui pouvait aussi injecter du courrier dans ses fiches clients. Et B
     * pouvait enregistrer l'adresse d'Alice le PREMIER : quand Alice connectait ensuite sa
     * vraie boîte, son mot de passe se rangeait sous la ligne de B, qui lisait tout son
     * courrier. Vérifié AVANT le test des serveurs : on n'éprouve pas d'identifiants pour une
     * boîte qu'on refusera.
     */
    const { data: existing, error: eExisting } = await admin.from('mail_accounts').select('id, vault_secret_id, owner_id')
      .eq('agency_id', profile.agency_id).eq('provider', 'imap').eq('email', email).maybeSingle()
    if (eExisting) return json({ error: 'account_lookup_failed' }, 500)
    if (existing && existing.owner_id !== user.id) {
      console.warn(`[mail-oauth] connect_imap refusé : ${user.id} sur la boîte ${existing.id}, propriétaire ${existing.owner_id}`)
      return json({ error: 'owned_by_colleague' }, 409)
    }
    // ⛔ Deux noms d'hôte SAISIS par l'agent, vers lesquels nos serveurs vont ouvrir une
    // socket : ils ne doivent désigner que le réseau public (cf. `assertPublicHost`).
    try {
      await assertPublicHost(imap.imapHost)
      await assertPublicHost(imap.smtpHost)
    } catch (e) {
      // Le motif (nom invalide, introuvable, adresse privée) va au journal ; l'écran n'a qu'une
      // chose à dire — « serveur introuvable, vérifiez son nom » (cf. l'en-tête : un CODE).
      console.warn(`[mail-oauth] connect_imap hôte refusé ${imap.imapHost} / ${imap.smtpHost} :`, redactedErrorMessage(e))
      return json({ error: 'host_not_allowed' }, 400)
    }
    // Une adresse déjà connectée par Google ou Microsoft n'a pas de jumelle IMAP : son
    // courrier entrerait deux fois, dans deux boîtes que l'agent croirait différentes.
    const { data: autre, error: eAutre } = await admin.from('mail_accounts').select('provider')
      .eq('agency_id', profile.agency_id).eq('email', email).neq('provider', 'imap').limit(1)
    if (eAutre) return json({ error: 'account_lookup_failed' }, 500)
    if ((autre ?? []).length) return json({ error: 'already_connected', detail: (autre as { provider: string }[])[0].provider }, 409)

    // Les DEUX serveurs sont éprouvés avant toute écriture : une boîte qui lit mais ne peut
    // pas envoyer ne se découvrirait qu'au premier envoi, devant un client.
    const test = await imapTestConnexion(imap, password)
    if (!test.ok) {
      console.error(`[mail-oauth] connect_imap ${imap.imapHost}:${imap.imapPort} / ${imap.smtpHost}:${imap.smtpPort} en échec (${test.code}) :`, redactedErrorMessage(test.detail))
      return json({ error: 'connection_failed', detail: test.code }, 502)
    }

    const secret: ImapSecret = { password }
    const visibility = body.visibility === 'agency' ? 'agency' : 'owner'
    let accountId: string
    if (existing) {
      // La reconnexion par son PROPRIÉTAIRE (le seul admis, cf. plus haut) : le mot de passe
      // et les serveurs changent, la visibilité non — elle se change par `update`.
      if (existing.vault_secret_id) {
        await deleteAccountSecret(admin, existing.vault_secret_id)
          .catch((e) => console.error(`[mail-oauth] ancien secret ${existing.vault_secret_id} ORPHELIN (compte ${existing.id}):`, e instanceof Error ? e.message : String(e)))
      }
      const vaultId = await storeAccountSecret(admin, `mail:imap:${email}`, secret)
      const { error } = await admin.from('mail_accounts').update({
        vault_secret_id: vaultId, imap_config: imap, status: 'active', last_error: null, sync_failures: 0, next_sync_at: new Date().toISOString(),
      }).eq('id', existing.id)
      if (error) return json({ error: 'account_update_failed' }, 500)
      accountId = existing.id
    } else {
      const vaultId = await storeAccountSecret(admin, `mail:imap:${email}`, secret)
      const { data: ins, error } = await admin.from('mail_accounts').insert({
        agency_id: profile.agency_id, owner_id: user.id, provider: 'imap', email, display_name: null,
        visibility, status: 'active', vault_secret_id: vaultId, imap_config: imap,
      }).select('id').single()
      if (error) {
        console.error('[mail-oauth] insertion du compte IMAP en échec :', redactedErrorMessage(error))
        await deleteAccountSecret(admin, vaultId)
          .catch((e) => console.error(`[mail-oauth] secret ${vaultId} ORPHELIN après échec d'insertion:`, e instanceof Error ? e.message : String(e)))
        return json({ error: 'account_insert_failed' }, 500)
      }
      accountId = ins.id
    }
    await semerLibelles(admin, profile.agency_id, user.id)
    return lancerEtRendre(admin, accountId, cfg)
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
     * Le chemin vit dans `_shared/mail/disconnect.ts` depuis le 13.09.2026, partagé avec
     * `delete-account`. En cas d'échec, la LIGNE RESTE (en `disabled`) : le pointeur
     * survit, la déconnexion est réessayable, et la réponse le dit au lieu de mentir.
     */
    const r = await disconnectMailAccount(admin, account)
    if (r.ok) return json({ ok: true })
    if (r.reason === 'secret_unreadable' || r.reason === 'provider_refused') {
      return json({ error: 'revocation_failed', detail: r.reason, account_id: account.id }, 502)
    }
    // `r.detail` est un message Vault ou Postgres : `disconnectMailAccount` journalise déjà
    // le premier, on journalise ici le second — aucun des deux ne part au navigateur.
    if (r.reason === 'vault_delete_failed') return json({ ok: false, error: 'vault_delete_failed', account_id: account.id }, 500)
    console.error(`[mail-oauth] suppression du compte ${account.id} en échec :`, redactedErrorMessage(r.detail))
    return json({ error: 'delete_failed' }, 500)
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
