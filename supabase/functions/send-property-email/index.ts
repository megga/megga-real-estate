import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

interface PropertyPayload {
  title: string
  price: number
  address: string
  city: string
  rooms: number | null
  surface_m2: number | null
  type: string
  photo_url: string | null
  source_url: string
  source_agency: string | null
  source_portal: string
}

interface SendRequest {
  to: string
  contactFirstName: string
  agentName: string
  agentPhone: string
  property: PropertyPayload
  message?: string
}

function formatCHF(amount: number): string {
  return `CHF ${amount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, "'")}`
}

function buildEmailHtml(req: SendRequest): string {
  const p = req.property
  const photoSection = p.photo_url
    ? `<img src="${p.photo_url}" alt="${p.title || 'Bien immobilier'}" style="width:100%;height:auto;border-radius:12px;display:block;" />`
    : `<div style="background:#f3f4f6;border-radius:12px;height:200px;display:flex;align-items:center;justify-content:center;color:#9ca3af;font-size:14px;">Pas de photo disponible</div>`

  const stats = [
    p.rooms ? `${p.rooms} pièces` : null,
    p.surface_m2 ? `${p.surface_m2} m²` : null,
    p.type || null,
  ].filter(Boolean).join(' · ')

  const priceDisplay = p.price > 0 ? formatCHF(p.price) : 'Prix sur demande'
  const personalMessage = req.message
    ? `<p style="font-size:14px;color:#374151;line-height:1.6;margin:0 0 24px 0;white-space:pre-line;">${req.message}</p>`
    : ''

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Bien immobilier — ${priceDisplay}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <!-- Header -->
    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">MEGGA</span>
      <span style="font-size:11px;color:#9ca3af;display:block;margin-top:2px;">Immobilier Suisse</span>
    </div>

    <!-- Greeting -->
    <p style="font-size:15px;color:#374151;margin:0 0 8px 0;">
      Bonjour ${req.contactFirstName},
    </p>
    <p style="font-size:14px;color:#6b7280;margin:0 0 24px 0;">
      Voici un bien qui pourrait vous intéresser :
    </p>

    ${personalMessage}

    <!-- Property Card -->
    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;">

      <!-- Photo -->
      <div style="padding:0;">
        ${photoSection}
      </div>

      <!-- Info -->
      <div style="padding:20px 24px;">
        <!-- Price -->
        <p style="font-size:24px;font-weight:700;color:#1a1a1a;margin:0 0 4px 0;">
          ${priceDisplay}
        </p>

        <!-- Title -->
        ${p.title ? `<p style="font-size:14px;color:#6b7280;margin:0 0 8px 0;">${p.title}</p>` : ''}

        <!-- Address -->
        <p style="font-size:13px;color:#9ca3af;margin:0 0 16px 0;">
          📍 ${p.address || p.city || 'Suisse'}
        </p>

        <!-- Stats -->
        ${stats ? `<p style="font-size:13px;color:#6b7280;margin:0 0 20px 0;padding:12px 0;border-top:1px solid #f3f4f6;border-bottom:1px solid #f3f4f6;">${stats}</p>` : ''}

        <!-- Source -->
        ${p.source_agency ? `<p style="font-size:11px;color:#9ca3af;margin:0 0 16px 0;">via ${p.source_agency}${p.source_portal ? ` · ${p.source_portal}` : ''}</p>` : ''}

        <!-- CTA Button -->
        <a href="${p.source_url}" target="_blank" rel="noopener noreferrer" style="display:block;text-align:center;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
          Voir l'annonce →
        </a>
      </div>
    </div>

    <!-- Agent signature -->
    <div style="margin-top:32px;padding-top:20px;border-top:1px solid #e5e7eb;">
      <p style="font-size:13px;color:#374151;margin:0;font-weight:600;">${req.agentName}</p>
      <p style="font-size:12px;color:#9ca3af;margin:4px 0 0 0;">
        MEGGA Immobilier${req.agentPhone ? ` · ${req.agentPhone}` : ''}
      </p>
    </div>

    <!-- Disclaimer -->
    <p style="font-size:10px;color:#d1d5db;text-align:center;margin-top:24px;line-height:1.5;">
      Les informations sont fournies à titre indicatif et peuvent évoluer sans préavis.
      Cet email a été envoyé via MEGGA Real Estate.
    </p>

  </div>
</body>
</html>`
}

serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  try {
    // ── Auth check (agent-only — sending property emails requires authentication) ──
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { status: 401, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
      )
    }

    const body: SendRequest = await req.json()

    // Validate required fields
    if (!body.to || !body.property) {
      return new Response(JSON.stringify({ error: 'to and property are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.to)) {
      return new Response(JSON.stringify({ error: 'Invalid email address' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ error: 'RESEND_API_KEY not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    const html = buildEmailHtml(body)

    const priceDisplay = body.property.price > 0
      ? formatCHF(body.property.price)
      : 'Bien immobilier'

    const locationDisplay = body.property.city || body.property.address || ''

    // Send via Resend
    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `MEGGA Immobilier <noreply@megga.ch>`,
        to: [body.to],
        subject: `${priceDisplay} — ${body.property.title || locationDisplay}`,
        html,
      }),
    })

    const resendData = await resendResponse.json()

    if (!resendResponse.ok) {
      return new Response(JSON.stringify({
        error: resendData.message || 'Resend API error',
        details: resendData,
      }), {
        status: resendResponse.status,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      })
    }

    return new Response(JSON.stringify({
      success: true,
      emailId: resendData.id,
      to: body.to,
    }), {
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    })
  }
})
