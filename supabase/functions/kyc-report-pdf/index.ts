import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { signMagicLinkToken } from '../_shared/magic-link-token.ts'
import { buildCfPdfRequestBody, parseBasicAuthPair } from '../_shared/cf-browser-render.ts'
import { uploadMetaMediaDocument } from '../_shared/whatsapp-media.ts'
import { getProvider } from '../_shared/whatsapp-gateway.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Comparaison à temps constant (anti timing-attack) — identique kyc-screening.
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

/** Référence "KYC-2026-AB3F" depuis l'UUID + created_at (miroir buildReportData). */
function buildReference(id: string, createdAt: string): string {
  const year = new Date(createdAt).getFullYear()
  const tail = id.replace(/-/g, '').slice(-4).toUpperCase()
  return `KYC-${year}-${tail}`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  const json = (obj: unknown, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

  try {
    // Auth service-à-service uniquement (appelée par whatsapp-agent).
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const providedKey = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    if (!serviceKey || !safeEqual(providedKey, serviceKey)) return json({ error: 'forbidden' }, 403)

    const { kyc_case_id, agency_id, profile_id, to_phone } = (await req.json()) as {
      kyc_case_id?: string; agency_id?: string; profile_id?: string; to_phone?: string
    }
    if (!kyc_case_id || !agency_id || !to_phone) return json({ error: 'kyc_case_id, agency_id, to_phone required' }, 400)
    const toPhone = to_phone.replace(/\D/g, '')
    if (!toPhone) return json({ error: 'invalid to_phone' }, 400)

    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

    // Garde cross-agency (défense en profondeur) + created_at pour la référence.
    const { data: kc, error: kcErr } = await supabase
      .from('kyc_cases').select('id, agency_id, created_at').eq('id', kyc_case_id).single<{
        id: string; agency_id: string; created_at: string
      }>()
    if (kcErr || !kc) return json({ error: 'kyc_case not found' }, 404)
    if (kc.agency_id !== agency_id) return json({ error: 'forbidden: cross-agency' }, 403)

    const reference = buildReference(kc.id, kc.created_at)

    // 1. Mint token court (5 min), avec p = profile demandeur.
    const exp = Math.floor(Date.now() / 1000) + 300
    const token = await signMagicLinkToken({ id: kyc_case_id, exp, p: profile_id })

    // 2. Cloudflare Browser Rendering /pdf (REST API, pas de Worker).
    const cfAccount = Deno.env.get('CLOUDFLARE_ACCOUNT_ID') ?? ''
    const cfToken = Deno.env.get('CLOUDFLARE_BROWSER_RENDER_TOKEN') ?? ''
    // app.megga.ch sert le SPA React (la route /kyc-report/:token) ; megga.ch sert la
    // vitrine statique depuis le pivot #542. app.megga.ch est OUVERT (pas de Basic Auth) →
    // authenticate omis si MEGGA_PREVIEW_BASIC_AUTH absent (param gardé au cas où l'app serait gatée).
    const appUrl = Deno.env.get('MEGGA_APP_URL') ?? 'https://app.megga.ch'
    const { user, pass } = parseBasicAuthPair(Deno.env.get('MEGGA_PREVIEW_BASIC_AUTH'))
    if (!cfAccount || !cfToken) return json({ error: 'CLOUDFLARE_* secrets missing' }, 500)

    const renderUrl = `${appUrl}/kyc-report/${token}`
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/browser-rendering/pdf`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCfPdfRequestBody({ url: renderUrl, basicUser: user, basicPass: pass })),
        signal: AbortSignal.timeout(55000),
      },
    )
    if (!cfRes.ok) {
      const errTxt = await cfRes.text().catch(() => '')
      console.error('kyc-report-pdf cf-render', { kyc_case_id, cf_status: cfRes.status, detail: errTxt.slice(0, 200) })
      return json({ error: `cloudflare pdf HTTP ${cfRes.status}`, detail: errTxt.slice(0, 300) }, 502)
    }
    const pdfBytes = new Uint8Array(await cfRes.arrayBuffer())
    if (pdfBytes.byteLength < 1000) {
      console.error('kyc-report-pdf pdf-empty', { kyc_case_id, bytes: pdfBytes.byteLength })
      return json({ error: 'pdf empty/too small' }, 502) // garde anti-PDF blanc
    }

    // 3. Upload média Meta (éphémère) + 4. envoi document à l'agent.
    const metaToken = Deno.env.get('META_WHATSAPP_TOKEN') ?? ''
    const metaPhoneNumberId = Deno.env.get('META_PHONE_NUMBER_ID') ?? ''
    const apiVersion = Deno.env.get('META_API_VERSION') ?? 'v22.0'
    if (!metaToken || !metaPhoneNumberId) return json({ error: 'META_* secrets missing' }, 500)

    const filename = `Rapport-KYC-${reference}.pdf`
    const mediaId = await uploadMetaMediaDocument(pdfBytes, 'application/pdf', filename, {
      metaToken, metaPhoneNumberId, apiVersion,
    })

    const provider = getProvider('meta')
    const sreq = provider.buildSendDocumentRequest!(
      { toPhone, mediaId, filename, caption: reference },
      { metaToken, metaPhoneNumberId, metaApiVersion: apiVersion },
    )
    const sendRes = await fetch(sreq.url, { method: sreq.method, headers: sreq.headers, body: sreq.body })
    const sendParsed = provider.parseSendResult(sendRes.status, await sendRes.json().catch(() => ({})))
    if (!sendParsed.ok) {
      console.error('kyc-report-pdf meta-send', { kyc_case_id, status: sendRes.status, err: sendParsed.error ?? '' })
      return json({ error: `meta send HTTP ${sendRes.status}: ${sendParsed.error ?? ''}` }, 502)
    }

    // 5. Audit (actor IA, lecture seule du dossier — règle d'or intacte).
    await supabase.from('activity_events').insert({
      agency_id,
      actor_id: null,
      actor_kind: 'ai',
      action: 'kyc_report_sent',
      entity_type: 'kyc',
      entity_id: kyc_case_id,
      metadata: { reference, channel: 'whatsapp', profile_id: profile_id ?? null },
    })

    return json({ ok: true, reference })
  } catch (err) {
    const name = (err as Error)?.name
    console.error('kyc-report-pdf catch', { name, msg: err instanceof Error ? err.message : String(err) })
    if (name === 'TimeoutError' || name === 'AbortError') return json({ error: 'render timeout' }, 504)
    return json({ error: err instanceof Error ? err.message : 'Unknown error' }, 500)
  }
})
