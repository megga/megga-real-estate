// esign-webhook — callback provider (Skribble / DocuSign) à la complétion d'une
// signature. PUBLIC (verify_jwt=false) : l'authenticité est portée par le couple
// (sr, token) dans l'URL de callback, généré par sign-document et vérifié ici en
// timing-safe. On NE fait PAS confiance au corps du callback → on re-récupère le
// statut officiel chez le provider, puis on réconcilie (download + archive +
// audit) via _shared/esign-finalize.
//
// URL : /functions/v1/esign-webhook?sr=<id>&token=<webhook_token>&provider=<p>

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getEsignProvider,
  timingSafeEqual,
  type ProviderCredentials,
} from '../_shared/esign-gateway.ts'
import { reconcileSignatureRequest, type SigRequestRow } from '../_shared/esign-finalize.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

function admin() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function readSecret(supabase: any, vaultSecretId: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase.rpc('esign_secret_read', { p_id: vaultSecretId })
  if (error || !data) return null
  try { return JSON.parse(data as string) as Record<string, unknown> } catch { return null }
}

function toCredentials(provider: string, secret: Record<string, unknown>, config: Record<string, unknown>): ProviderCredentials {
  if (provider === 'skribble') {
    const region = (config.hosting_region as string) || 'com'
    return {
      skribbleUsername: secret.username as string,
      skribbleApiKey: secret.api_key as string,
      skribbleBaseUrl: region === 'de' ? 'https://api.skribble.de' : 'https://api.skribble.com',
    }
  }
  return {
    docusignAccessToken: secret.access_token as string,
    docusignAccountId: (secret.account_id as string) || (config.account_id as string),
    docusignBaseUri: (secret.base_uri as string) || (config.base_uri as string),
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function resolveToken(provider: string, creds: ProviderCredentials): Promise<string | undefined> {
  if (provider !== 'skribble') return creds.docusignAccessToken
  const p = getEsignProvider('skribble')
  const req = p.buildLoginRequest!(creds)
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body })
  const text = await res.text()
  const parsed = p.parseLoginResult!(res.status, text)
  return parsed.ok ? parsed.token : undefined
}

// Le provider attend un 2xx pour ne pas re-tenter en boucle → on répond 200 même
// en cas d'erreur interne (loggée), sauf token invalide (401, anti-abus).
serve(async (req) => {
  const url = new URL(req.url)
  const srId = url.searchParams.get('sr')
  const token = url.searchParams.get('token')
  const providerName = url.searchParams.get('provider') ?? ''

  if (!srId || !token) return new Response('missing sr/token', { status: 400 })

  const supabase = admin()
  const { data: sr } = await supabase
    .from('signature_requests')
    .select('id, agency_id, provider, provider_request_id, provider_document_id, document_id, status, signed_document_path, webhook_token')
    .eq('id', srId)
    .maybeSingle()

  // Token invalide / inconnu → 401 (ne révèle rien de plus).
  if (!sr || !sr.webhook_token || !timingSafeEqual(token, sr.webhook_token)) {
    return new Response('unauthorized', { status: 401 })
  }
  if (providerName && providerName !== sr.provider) {
    return new Response('provider mismatch', { status: 400 })
  }

  // Déjà finalisé → ack idempotent.
  // 'signed' SANS signed_document_path = download precedent echoue → on laisse
  // re-traiter (le claim atomique dans reconcile re-tente). On ne court-circuite
  // que si reellement archive, ou terminal non-signe.
  if (sr.signed_document_path || ['withdrawn', 'declined'].includes(sr.status)) {
    return new Response('ok (already final)', { status: 200 })
  }
  if (!sr.provider_request_id) return new Response('ok (no provider id)', { status: 200 })

  try {
    const { data: conn } = await supabase
      .from('esign_provider_connections')
      .select('vault_secret_id, config')
      .eq('agency_id', sr.agency_id)
      .eq('provider', sr.provider)
      .maybeSingle()
    if (!conn?.vault_secret_id) return new Response('ok (no connection)', { status: 200 })

    const secret = await readSecret(supabase, conn.vault_secret_id)
    if (!secret) return new Response('ok (no secret)', { status: 200 })

    const creds = toCredentials(sr.provider, secret, conn.config ?? {})
    const tok = await resolveToken(sr.provider, creds)

    const provider = getEsignProvider(sr.provider)
    const statusReq = provider.buildStatusRequest(sr.provider_request_id, creds, tok)
    const res = await fetch(statusReq.url, { method: statusReq.method, headers: statusReq.headers })
    let payload: unknown = null
    try { payload = await res.json() } catch { payload = null }
    const statusResult = provider.parseStatusResult(res.status, payload)
    if (!statusResult.ok) return new Response('ok (status unavailable)', { status: 200 })

    const out = await reconcileSignatureRequest({
      supabase, provider, creds, token: tok,
      sr: sr as SigRequestRow, statusResult, actor: { kind: 'system' },
    })
    return new Response(`ok (${out.status})`, { status: 200 })
  } catch (e) {
    // On logge mais on ack : un 5xx déclencherait des retries provider infinis.
    await supabase.from('signature_requests').update({ last_error: e instanceof Error ? e.message : 'webhook error' }).eq('id', sr.id)
    return new Response('ok (logged error)', { status: 200 })
  }
})
