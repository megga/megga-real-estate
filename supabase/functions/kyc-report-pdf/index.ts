import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { signMagicLinkToken } from '../_shared/magic-link-token.ts'
import { buildCfPdfRequestBody, parseBasicAuthPair, redactCfRenderError } from '../_shared/cf-browser-render.ts'
import { kycReportRenderUrl } from '../_shared/app-url.ts'
import { uploadMetaMediaDocument } from '../_shared/whatsapp-media.ts'
import { getProvider } from '../_shared/whatsapp-gateway.ts'
import { sendOutboundGuarded } from '../_shared/whatsapp-outbound-guard.ts'
import { isServiceSecret } from '../_shared/require-service-secret.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
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
    // Le client précède la garde : lire le secret partagé dans `app_config` exige
    // un client service-role. Rien de ce que fournit l'appelant ne l'atteint avant
    // la décision — la seule requête émise porte une clé constante.
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceKey)

    // `isServiceSecret` accepte les DEUX secrets de service du projet — celui de
    // `app_config` (que rejoue pg_cron) et celui de l'env (qu'envoient les autres
    // edge functions). N'en comparer qu'un faisait dépendre l'appel de leur
    // coïncidence : docs/audits/2026-08-04-blast-radius-service-role.md §4.3.
    if (!(await isServiceSecret(supabase, req))) return json({ error: 'forbidden' }, 403)

    const { kyc_case_id, agency_id, profile_id, to_phone } = (await req.json()) as {
      kyc_case_id?: string; agency_id?: string; profile_id?: string; to_phone?: string
    }
    if (!kyc_case_id || !agency_id || !to_phone) return json({ error: 'kyc_case_id, agency_id, to_phone required' }, 400)
    const toPhone = to_phone.replace(/\D/g, '')
    if (!toPhone) return json({ error: 'invalid to_phone' }, 400)

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
    // L'app est OUVERTE (pas de Basic Auth) → `authenticate` omis quand
    // MEGGA_PREVIEW_BASIC_AUTH est absent ; le paramètre reste au cas où elle serait gatée.
    const { user, pass } = parseBasicAuthPair(Deno.env.get('MEGGA_PREVIEW_BASIC_AUTH'))
    if (!cfAccount || !cfToken) return json({ error: 'CLOUDFLARE_* secrets missing' }, 500)

    const renderUrl = kycReportRenderUrl(token)
    const cfRes = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cfAccount}/browser-rendering/pdf`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${cfToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(buildCfPdfRequestBody({ url: renderUrl, basicUser: user, basicPass: pass })),
        // 45s < 60s de l'appelant execSendKycReport : laisse une marge pour l'upload Meta +
        // l'envoi du document, évite que l'appelant annonce un échec alors que le PDF est parti.
        signal: AbortSignal.timeout(45_000),
      },
    )
    if (!cfRes.ok) {
      const errTxt = await cfRes.text().catch(() => '')
      // Le corps d'erreur de Cloudflare recopie l'URL rendue, qui porte le jeton : il ne sort
      // ni en journal ni en réponse sans passer par là. Seul le jeton tombe — l'hôte, le chemin
      // et le motif de l'échec restent, ce sont eux qui désignent une mauvaise configuration.
      const detail = redactCfRenderError(errTxt, renderUrl)
      console.error('kyc-report-pdf cf-render', { kyc_case_id, cf_status: cfRes.status, detail: detail.slice(0, 200) })
      return json({ error: `cloudflare pdf HTTP ${cfRes.status}`, detail: detail.slice(0, 300) }, 502)
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

    // SITE 12 — le point d'entrée le plus faible du dépôt, et la garde le ferme deux fois.
    //
    // ⛔ `to_phone` est un PARAMÈTRE LIBRE du corps, gardé par le seul secret de service :
    // rien ne vérifiait qu'il désignait un agent de `agency_id`. En passant `profileId`, la
    // garde exige un `whatsapp_agent_links` VÉRIFIÉ sur ce numéro — sinon
    // `agent_link_unverified`. Un numéro de CLIENT, même dans sa fenêtre 24 h, ne peut plus
    // recevoir le rapport KYC d'un agent.
    //
    // ⚠ Cette fonction est la seconde des deux qui ne vérifiaient PAS le kill-switch.
    //
    // Retry court sur erreur transitoire (réseau/5xx/429) : sans lui, l'envoi partait en
    // tentative unique. Jamais sur 131047. Le média (mediaId) reste valide entre les essais.
    const provider = getProvider('meta')
    const sendParsed = await sendOutboundGuarded({
      admin: supabase, provider, to: toPhone,
      purpose: 'service',
      payload: { type: 'document', mediaId, filename, caption: reference },
      profileId: profile_id ?? null, agencyId: agency_id,
      isAutomated: true, retry: true,
    })
    if (!sendParsed.ok) {
      const why = 'error' in sendParsed ? sendParsed.error : sendParsed.reason
      console.error('kyc-report-pdf meta-send', { kyc_case_id, err: why ?? '' })
      return json({ error: `meta send failed: ${why ?? ''}` }, 502)
    }

    // 5. Audit (actor IA, lecture seule du dossier — règle d'or intacte).
    await supabase.from('activity_events').insert({
      agency_id,
      actor_id: null,
      actor_kind: 'ai',
      action: 'kyc_report_sent',
      // `category` manquait — même omission que kyc_screening.
      category: 'kyc',
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
