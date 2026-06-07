// sign-document — orchestrateur e-signature (Skribble / DocuSign).
// Décision produit (cerveau : signature-qes-planned) : chaque agence connecte
// SON compte provider (clé chiffrée dans Vault), puis signe ses documents en un
// clic. Cette fonction ne parle qu'au gateway (_shared/esign-gateway.ts) ; le
// callback de complétion est géré par esign-webhook.
//
// Actions : connect_provider · disconnect_provider · list · create · status · cancel
//
// AUTH : requireAgentAuth → profile.agency_id est la SEULE source d'identité
// d'agence de confiance (jamais un agency_id du body).

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import {
  getEsignProvider,
  type CreateRequestInput,
  type EsignSigner,
  type Legislation,
  type ProviderCredentials,
  type SignatureQuality,
} from '../_shared/esign-gateway.ts'
import { reconcileSignatureRequest, type SigRequestRow } from '../_shared/esign-finalize.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// ── Vault : lecture / écriture / suppression du secret provider ──────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function storeSecret(supabase: any, secret: Record<string, unknown>, name: string): Promise<string | null> {
  const { data, error } = await supabase.rpc('esign_secret_store', {
    p_secret: JSON.stringify(secret),
    p_name: name,
  })
  if (error) return null
  return data as string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readSecret(supabase: any, vaultSecretId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('esign_secret_read', { p_id: vaultSecretId })
  if (error || !data) return null
  try {
    return JSON.parse(data as string) as Record<string, unknown>
  } catch {
    return null
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function deleteSecret(supabase: any, vaultSecretId: string): Promise<void> {
  await supabase.rpc('esign_secret_delete', { p_id: vaultSecretId })
}

// Reconstitue les credentials gateway depuis le secret Vault + la config publique.
function toCredentials(provider: string, secret: Record<string, unknown>, config: Record<string, unknown>): ProviderCredentials {
  if (provider === 'skribble') {
    const region = (config.hosting_region as string) || 'com'
    return {
      skribbleUsername: secret.username as string,
      skribbleApiKey: secret.api_key as string,
      skribbleBaseUrl: region === 'de' ? 'https://api.skribble.de' : 'https://api.skribble.com',
    }
  }
  // docusign
  return {
    docusignAccessToken: secret.access_token as string,
    docusignAccountId: (secret.account_id as string) || (config.account_id as string),
    docusignBaseUri: (secret.base_uri as string) || (config.base_uri as string),
  }
}

// Skribble exige un login (token court) ; DocuSign réutilise l'access_token.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveToken(provider: string, creds: ProviderCredentials): Promise<{ ok: boolean; token?: string; error?: string }> {
  if (provider !== 'skribble') return { ok: true, token: creds.docusignAccessToken }
  const p = getEsignProvider('skribble')
  const req = p.buildLoginRequest!(creds)
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
  const text = await res.text()
  const parsed = p.parseLoginResult!(res.status, text)
  return parsed.ok ? { ok: true, token: parsed.token } : { ok: false, error: parsed.error }
}

// ── Connexions ───────────────────────────────────────────────────────────────

interface AuthCtx {
  agencyId: string
  profileId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getActiveConnection(supabase: any, agencyId: string, provider?: string) {
  let q = supabase
    .from('esign_provider_connections')
    .select('id, provider, environment, vault_secret_id, config, default_quality, default_legislation, is_active, status')
    .eq('agency_id', agencyId)
    .eq('status', 'connected')
  q = provider ? q.eq('provider', provider) : q.eq('is_active', true)
  const { data, error } = await q.maybeSingle()
  if (error || !data) return null
  return data
}

async function handleConnect(ctx: AuthCtx, body: Record<string, unknown>) {
  const provider = String(body.provider ?? '')
  if (provider !== 'skribble' && provider !== 'docusign') return json({ error: 'provider invalide' }, 400)

  const creds = (body.credentials ?? {}) as Record<string, unknown>
  const config = (body.config ?? {}) as Record<string, unknown>
  const quality = (body.default_quality as string) || (provider === 'skribble' ? 'QES' : 'AES')
  const legislation = (body.default_legislation as string) || 'ZERTES'
  const environment = (body.environment as string) || 'production'

  // Secret minimal par provider.
  let secret: Record<string, unknown>
  let displayName: string
  if (provider === 'skribble') {
    if (!creds.username || !creds.api_key) return json({ error: 'username + api_key requis' }, 400)
    secret = { username: creds.username, api_key: creds.api_key }
    displayName = String(creds.username)
  } else {
    if (!creds.access_token || !creds.account_id || !creds.base_uri) {
      return json({ error: 'access_token + account_id + base_uri requis' }, 400)
    }
    secret = { access_token: creds.access_token, refresh_token: creds.refresh_token, account_id: creds.account_id, base_uri: creds.base_uri }
    displayName = String(creds.account_email || creds.account_id)
  }

  // Validation live (Skribble : un login doit réussir avec la clé fournie).
  if (provider === 'skribble') {
    const probe = await resolveToken('skribble', toCredentials('skribble', secret, config))
    if (!probe.ok) return json({ error: `Clé Skribble refusée : ${probe.error ?? 'login échoué'}` }, 400)
  }

  const vaultId = await storeSecret(ctx.supabase, secret, `esign:${provider}:${ctx.agencyId}`)
  if (!vaultId) return json({ error: 'Stockage sécurisé du secret impossible' }, 500)

  // Un seul provider actif par agence → désactive les autres, puis upsert celui-ci.
  await ctx.supabase.from('esign_provider_connections').update({ is_active: false }).eq('agency_id', ctx.agencyId)

  // Si une connexion existait pour ce provider, on supprime son ancien secret.
  const { data: existing } = await ctx.supabase
    .from('esign_provider_connections')
    .select('id, vault_secret_id')
    .eq('agency_id', ctx.agencyId)
    .eq('provider', provider)
    .maybeSingle()
  if (existing?.vault_secret_id) await deleteSecret(ctx.supabase, existing.vault_secret_id)

  const row = {
    agency_id: ctx.agencyId,
    provider,
    environment,
    display_name: displayName,
    vault_secret_id: vaultId,
    config,
    default_quality: quality,
    default_legislation: legislation,
    is_active: true,
    status: 'connected',
    last_error: null,
    connected_by: ctx.profileId,
    connected_at: new Date().toISOString(),
  }
  const { data: saved, error } = await ctx.supabase
    .from('esign_provider_connections')
    .upsert(row, { onConflict: 'agency_id,provider' })
    .select('id, provider, display_name, environment, default_quality, default_legislation, is_active, status, connected_at')
    .single()
  if (error) {
    await deleteSecret(ctx.supabase, vaultId)
    return json({ error: error.message }, 500)
  }

  await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: ctx.profileId, actor_kind: 'agent',
    action: 'signature.provider_connected', entity_type: 'esign_provider_connection', entity_id: saved.id,
    category: 'signature', object_label: `${provider} connecté`, metadata: { provider, environment },
    created_at: new Date().toISOString(),
  })

  return json({ ok: true, connection: saved })
}

async function handleDisconnect(ctx: AuthCtx, body: Record<string, unknown>) {
  const provider = String(body.provider ?? '')
  const { data: conn } = await ctx.supabase
    .from('esign_provider_connections')
    .select('id, vault_secret_id')
    .eq('agency_id', ctx.agencyId)
    .eq('provider', provider)
    .maybeSingle()
  if (!conn) return json({ error: 'connexion introuvable' }, 404)

  if (conn.vault_secret_id) await deleteSecret(ctx.supabase, conn.vault_secret_id)
  await ctx.supabase
    .from('esign_provider_connections')
    .update({ status: 'disconnected', is_active: false, vault_secret_id: null })
    .eq('id', conn.id)

  await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: ctx.profileId, actor_kind: 'agent',
    action: 'signature.provider_disconnected', entity_type: 'esign_provider_connection', entity_id: conn.id,
    category: 'signature', object_label: `${provider} déconnecté`, metadata: { provider }, created_at: new Date().toISOString(),
  })
  return json({ ok: true })
}

async function handleList(ctx: AuthCtx) {
  const { data: connections } = await ctx.supabase
    .from('esign_provider_connections')
    .select('id, provider, display_name, environment, default_quality, default_legislation, is_active, status, connected_at')
    .eq('agency_id', ctx.agencyId)
    .order('connected_at', { ascending: false })
  return json({ ok: true, connections: connections ?? [] })
}

// ── Signature ─────────────────────────────────────────────────────────────────

async function handleCreate(ctx: AuthCtx, body: Record<string, unknown>) {
  const pdfBase64 = String(body.pdf_base64 ?? '')
  const title = String(body.title ?? '').trim()
  const signersIn = Array.isArray(body.signers) ? (body.signers as Record<string, unknown>[]) : []
  if (!pdfBase64) return json({ error: 'pdf_base64 requis' }, 400)
  if (!title) return json({ error: 'title requis' }, 400)
  if (signersIn.length === 0) return json({ error: 'au moins un signataire requis' }, 400)

  const conn = await getActiveConnection(ctx.supabase, ctx.agencyId, body.provider as string | undefined)
  if (!conn) return json({ error: 'Aucun fournisseur de signature connecté' }, 409)

  const secret = conn.vault_secret_id ? await readSecret(ctx.supabase, conn.vault_secret_id) : null
  if (!secret) return json({ error: 'Secret du fournisseur introuvable' }, 500)

  const creds = toCredentials(conn.provider, secret, conn.config ?? {})
  const tokenRes = await resolveToken(conn.provider, creds)
  if (!tokenRes.ok) return json({ error: `Authentification ${conn.provider} échouée : ${tokenRes.error}` }, 502)

  const signers: EsignSigner[] = signersIn.map((s, i) => ({
    email: String(s.email ?? ''),
    firstName: s.first_name as string | undefined,
    lastName: s.last_name as string | undefined,
    name: s.name as string | undefined,
    mobile: s.mobile as string | undefined,
    language: (s.language as string) || 'fr',
    sequence: typeof s.sequence === 'number' ? s.sequence : i + 1,
  }))

  const quality = (body.quality as SignatureQuality) || (conn.default_quality as SignatureQuality) || 'QES'
  const legislation = (body.legislation as Legislation) || (conn.default_legislation as Legislation) || 'ZERTES'
  const webhookToken = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, '')

  // 1. Insère la demande (draft) → on a un id pour l'URL de callback.
  const { data: sr, error: insErr } = await ctx.supabase
    .from('signature_requests')
    .insert({
      agency_id: ctx.agencyId,
      document_id: (body.document_id as string) ?? null,
      provider: conn.provider,
      webhook_token: webhookToken,
      title,
      quality,
      legislation,
      status: 'draft',
      signers: signers.map((s) => ({ email: s.email, name: s.name, sequence: s.sequence, status: 'pending' })),
      context_type: (body.context_type as string) ?? null,
      context_id: (body.context_id as string) ?? null,
      created_by: ctx.profileId,
    })
    .select('id')
    .single()
  if (insErr || !sr) return json({ error: insErr?.message ?? 'insert demande échoué' }, 500)

  const callbackUrl = `${SUPABASE_URL}/functions/v1/esign-webhook?sr=${sr.id}&token=${webhookToken}&provider=${conn.provider}`
  const input: CreateRequestInput = {
    title,
    message: body.message as string | undefined,
    pdfBase64,
    signers,
    quality,
    legislation,
    callbackUrl,
    notify: body.notify !== false,
  }

  // 2. Crée la demande chez le provider.
  const provider = getEsignProvider(conn.provider)
  const req = provider.buildCreateRequest(input, creds, tokenRes.token)
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
  let payload: unknown = null
  try { payload = await res.json() } catch { payload = null }
  const result = provider.parseCreateResult(res.status, payload)

  if (!result.ok) {
    await ctx.supabase.from('signature_requests').update({ status: 'error', last_error: result.error }).eq('id', sr.id)
    return json({ error: `Création de la signature échouée : ${result.error}` }, 502)
  }

  // 3. Enregistre l'état renvoyé.
  const firstSigningUrl = result.signers.find((s) => s.signingUrl)?.signingUrl ?? null
  await ctx.supabase
    .from('signature_requests')
    .update({
      provider_request_id: result.providerRequestId,
      provider_document_id: result.providerDocumentId,
      status: result.status,
      sent_at: new Date().toISOString(),
      signing_url: firstSigningUrl,
      signers: result.signers,
      raw_status: result as unknown,
    })
    .eq('id', sr.id)

  if (body.document_id) {
    await ctx.supabase
      .from('documents')
      .update({ signature_request_id: sr.id, signature_status: 'pending' })
      .eq('id', body.document_id)
  }

  await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: ctx.profileId, actor_kind: 'agent',
    action: 'signature.created', entity_type: 'signature_request', entity_id: sr.id,
    category: 'signature', object_label: title,
    metadata: { provider: conn.provider, quality, legislation, signers: signers.length },
    created_at: new Date().toISOString(),
  })

  return json({
    ok: true,
    signature_request_id: sr.id,
    status: result.status,
    signing_url: firstSigningUrl,
    signers: result.signers,
  })
}

async function handleStatus(ctx: AuthCtx, body: Record<string, unknown>) {
  const id = String(body.signature_request_id ?? '')
  if (!id) return json({ error: 'signature_request_id requis' }, 400)

  const { data: sr } = await ctx.supabase
    .from('signature_requests')
    .select('id, agency_id, provider, provider_request_id, provider_document_id, document_id, status, signed_document_path')
    .eq('id', id)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()
  if (!sr) return json({ error: 'demande introuvable' }, 404)
  if (!sr.provider_request_id) return json({ ok: true, status: sr.status })

  const conn = await getActiveConnection(ctx.supabase, ctx.agencyId, sr.provider)
  if (!conn?.vault_secret_id) return json({ error: 'fournisseur déconnecté' }, 409)
  const secret = await readSecret(ctx.supabase, conn.vault_secret_id)
  if (!secret) return json({ error: 'secret introuvable' }, 500)

  const creds = toCredentials(sr.provider, secret, conn.config ?? {})
  const tokenRes = await resolveToken(sr.provider, creds)
  if (!tokenRes.ok) return json({ error: `auth ${sr.provider} échouée` }, 502)

  const provider = getEsignProvider(sr.provider)
  const req = provider.buildStatusRequest(sr.provider_request_id, creds, tokenRes.token)
  const res = await fetch(req.url, { method: req.method, headers: req.headers })
  let payload: unknown = null
  try { payload = await res.json() } catch { payload = null }
  const statusResult = provider.parseStatusResult(res.status, payload)
  if (!statusResult.ok) return json({ error: 'statut provider indisponible' }, 502)

  const out = await reconcileSignatureRequest({
    supabase: ctx.supabase, provider, creds, token: tokenRes.token,
    sr: sr as SigRequestRow, statusResult, actor: { id: ctx.profileId, kind: 'agent' },
  })
  return json({ ok: true, status: out.status, finalized: out.finalized })
}

async function handleCancel(ctx: AuthCtx, body: Record<string, unknown>) {
  const id = String(body.signature_request_id ?? '')
  const reason = String(body.reason ?? 'Annulé par l\'agent')
  if (!id) return json({ error: 'signature_request_id requis' }, 400)

  const { data: sr } = await ctx.supabase
    .from('signature_requests')
    .select('id, agency_id, provider, provider_request_id, document_id, status')
    .eq('id', id)
    .eq('agency_id', ctx.agencyId)
    .maybeSingle()
  if (!sr) return json({ error: 'demande introuvable' }, 404)

  const conn = await getActiveConnection(ctx.supabase, ctx.agencyId, sr.provider)
  const secret = conn?.vault_secret_id ? await readSecret(ctx.supabase, conn.vault_secret_id) : null
  if (sr.provider_request_id && secret) {
    const creds = toCredentials(sr.provider, secret, conn.config ?? {})
    const tokenRes = await resolveToken(sr.provider, creds)
    const provider = getEsignProvider(sr.provider)
    if (tokenRes.ok && provider.buildCancelRequest) {
      const req = provider.buildCancelRequest(sr.provider_request_id, reason, creds, tokenRes.token)
      await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
    }
  }

  await ctx.supabase.from('signature_requests').update({ status: 'withdrawn', completed_at: new Date().toISOString(), last_error: reason }).eq('id', sr.id)
  if (sr.document_id) await ctx.supabase.from('documents').update({ signature_status: 'withdrawn' }).eq('id', sr.document_id)
  await ctx.supabase.from('activity_events').insert({
    agency_id: ctx.agencyId, actor_id: ctx.profileId, actor_kind: 'agent',
    action: 'signature.withdrawn', entity_type: 'signature_request', entity_id: sr.id,
    category: 'signature', object_label: reason, metadata: { provider: sr.provider }, created_at: new Date().toISOString(),
  })
  return json({ ok: true, status: 'withdrawn' })
}

// ── Routing ───────────────────────────────────────────────────────────────────

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'JSON invalide' }, 400) }

  const ctx: AuthCtx = { agencyId: auth.profile.agency_id, profileId: auth.profile.id, supabase: admin() }
  const action = String(body.action ?? '')

  try {
    switch (action) {
      case 'connect_provider': return await handleConnect(ctx, body)
      case 'disconnect_provider': return await handleDisconnect(ctx, body)
      case 'list': return await handleList(ctx)
      case 'create': return await handleCreate(ctx, body)
      case 'status': return await handleStatus(ctx, body)
      case 'cancel': return await handleCancel(ctx, body)
      default: return json({ error: `action inconnue : ${action}` }, 400)
    }
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'erreur interne' }, 500)
  }
})
