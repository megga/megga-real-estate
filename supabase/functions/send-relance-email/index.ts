// MEGGA — send-relance-email Edge Function
// Wires DBRelanceSession's "Envoyer & suivant" CTA to real Resend sends.
// Companion of send-property-email (which has a fixed property-card template).
// This one accepts a free-form subject + body composed by the agent (or by
// MEGGA AI in the relance editor) so the agent owns the wording.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

interface SendRequest {
  to: string
  subject: string
  body: string
  agentName?: string
  agentSignature?: string
  // Optional metadata that ends up as Resend `tags` for analytics +
  // delivery-report cross-reference.
  leadId?: string
  agencyId?: string
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function buildHtml(req: SendRequest): string {
  // Plain-text body wrapped in a clean HTML shell so the recipient gets
  // both renderings (Resend auto-derives a text part from the HTML).
  // Paragraphs preserved via white-space:pre-line.
  const bodyEscaped = escapeHtml(req.body)
  const signature = req.agentSignature
    ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#374151;white-space:pre-line;">${escapeHtml(req.agentSignature)}</div>`
    : req.agentName
      ? `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:13px;color:#374151;">${escapeHtml(req.agentName)}<br/><span style="font-size:11px;color:#9ca3af;">MEGGA Immobilier</span></div>`
      : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(req.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
    <div style="background:#ffffff;border-radius:16px;padding:32px 28px;border:1px solid #e5e7eb;">
      <div style="font-size:14px;color:#1f2937;line-height:1.6;white-space:pre-line;">
        ${bodyEscaped}
      </div>
      ${signature}
    </div>
    <p style="font-size:10px;color:#d1d5db;text-align:center;margin-top:20px;line-height:1.5;">
      Email envoyé via MEGGA Real Estate. Si vous ne souhaitez plus recevoir
      de messages, répondez avec « STOP ».
    </p>
  </div>
</body>
</html>`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const body: SendRequest = await req.json()

    if (!body.to || !body.subject || !body.body) {
      return new Response(
        JSON.stringify({ error: 'to, subject and body are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    if (!EMAIL_REGEX.test(body.to)) {
      return new Response(
        JSON.stringify({ error: 'Invalid email address' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'RESEND_API_KEY not configured' }),
        { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    const html = buildHtml(body)

    const tags = [
      { name: 'kind', value: 'relance' },
      ...(body.leadId ? [{ name: 'lead_id', value: body.leadId }] : []),
      ...(body.agencyId ? [{ name: 'agency_id', value: body.agencyId }] : []),
    ]

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'MEGGA Immobilier <noreply@megga.ch>',
        to: [body.to],
        subject: body.subject,
        html,
        tags,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      return new Response(
        JSON.stringify({
          error: resendData.message ?? 'Resend API error',
          details: resendData,
        }),
        { status: resendResponse.status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, emailId: resendData.id, to: body.to }),
      { headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } }
    )
  }
})
