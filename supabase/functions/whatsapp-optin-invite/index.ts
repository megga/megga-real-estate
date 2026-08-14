// supabase/functions/whatsapp-optin-invite/index.ts
// Envoie à un contact, PAR E-MAIL, l'invitation à consentir aux messages WhatsApp.
//
// C'est le SEUL chemin d'opt-in du dispositif, et sa forme est contrainte par ce qu'elle
// doit prouver :
//   · l'invitation part sur un canal DÉJÀ consenti (e-mail) — on ne démarche pas sur
//     WhatsApp pour obtenir l'autorisation d'écrire sur WhatsApp ;
//   · elle porte l'information préalable (art. 6 al. 6 nLPD), archivée mot pour mot ;
//   · c'est la personne qui agit : elle clique, WhatsApp s'ouvre, ELLE envoie. Le lien ne
//     consent à rien tout seul.
//
// Auth : agent authentifié, borné à son agence. Le jeton est signé côté serveur et n'est
// jamais rendu à l'appelant — un agent ne doit pas pouvoir fabriquer le consentement d'un
// contact en se le faisant remettre.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { signMagicLinkToken, expiryFromDays } from '../_shared/magic-link-token.ts'
import { optinCopy, optinLang } from '../_shared/whatsapp-optin-copy.ts'
import { OPTIN_PREFIX } from '../_shared/whatsapp-optin.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

const INVITE_DAYS = 14

const json = (o: unknown, status: number) =>
  new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#039;')

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const auth = await requireAgentAuth(req, CORS)
  if (auth instanceof Response) return auth
  const { profile } = auth
  if (!profile.agency_id) return json({ error: 'no_agency' }, 403)

  const { contact_id } = (await req.json().catch(() => ({}))) as { contact_id?: string }
  if (!contact_id) return json({ error: 'contact_id required' }, 400)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Garde cross-agence AU SQL : pas de match ⇒ introuvable, jamais « autorisé quand même ».
  const { data: contact } = await admin
    .from('contacts')
    .select('id, email, language, agency_id')
    .eq('id', contact_id)
    .eq('agency_id', profile.agency_id)
    .maybeSingle()
  const c = contact as { email: string | null; language: string | null } | null
  if (!c) return json({ error: 'contact_not_found' }, 404)
  if (!c.email) return json({ error: 'contact_without_email' }, 400)

  // Le numéro Business à composer. Le registre `agency_wa_numbers` fait autorité : c'est
  // lui qui route déjà l'attribution des entrants, et s'en écarter enverrait la personne
  // vers un numéro dont les réponses ne reviendraient pas à son agence.
  const { data: waNum } = await admin
    .from('agency_wa_numbers')
    .select('wa_number')
    .eq('agency_id', profile.agency_id)
    .limit(1)
    .maybeSingle()
  const business = String((waNum as { wa_number?: string } | null)?.wa_number ?? '').replace(/\D/g, '')
  if (!business) {
    // ⚠ Échec EXPLICITE plutôt qu'un repli sur META_PHONE_NUMBER_ID, qui est un identifiant
    // de compte Meta et non un numéro : le lien `wa.me` mènerait nulle part, et l'agent
    // croirait l'invitation partie.
    return json({ error: 'agency_wa_number_missing' }, 409)
  }

  const { data: agency } = await admin
    .from('agencies').select('name').eq('id', profile.agency_id).maybeSingle()
  const agencyName = String((agency as { name?: string } | null)?.name ?? '').trim() || 'notre agence'

  const lang = optinLang(c.language)
  const copy = optinCopy(lang, agencyName)

  // L'invitation d'abord : elle porte le texte montré, donc la preuve. Si l'e-mail échoue
  // ensuite, il reste une invitation non consommée — inerte, et qui expire seule.
  const { data: invRows, error: invErr } = await admin.rpc('create_wa_optin_invite', {
    p_contact_id: contact_id,
    p_shown_text: copy.body,
    p_lang: lang,
    p_purpose: 'marketing',
    p_days: INVITE_DAYS,
  })
  if (invErr) {
    // `phone_suppressed` est un refus MÉTIER, pas une panne : on n'invite pas quelqu'un qui
    // vient de demander qu'on le laisse tranquille.
    const suppressed = invErr.message.includes('phone_suppressed')
    return json({ error: suppressed ? 'phone_suppressed' : invErr.message }, suppressed ? 409 : 400)
  }
  const invite = (invRows as Array<{ id: string; wa_phone: string }> | null)?.[0]
  if (!invite) return json({ error: 'invite_not_created' }, 500)

  const { unix } = expiryFromDays(INVITE_DAYS)
  const token = await signMagicLinkToken({ id: invite.id, exp: unix, k: 'wa_optin' })
  const prefill = `${OPTIN_PREFIX} ${token}`
  const lien = `https://wa.me/${business}?text=${encodeURIComponent(prefill)}`

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return json({ error: 'RESEND_API_KEY not configured' }, 500)

  const html = `<!DOCTYPE html><html lang="${lang}"><head><meta charset="utf-8"/></head>
<body style="margin:0;padding:24px;font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1f2937;">
  <div style="max-width:560px;margin:0 auto;">
    <div style="font-size:14px;line-height:1.6;white-space:pre-line;">${escapeHtml(copy.body)}</div>
    <p style="margin:28px 0;">
      <a href="${lien}" style="display:inline-block;padding:12px 20px;border-radius:8px;background:#25D366;color:#fff;text-decoration:none;font-weight:600;font-size:14px;">${escapeHtml(copy.cta)}</a>
    </p>
    <div style="font-size:11px;color:#9ca3af;">${escapeHtml(agencyName)}</div>
  </div>
</body></html>`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${resendKey}` },
    body: JSON.stringify({
      from: 'MEGGA Immobilier <noreply@megga.ch>',
      to: [c.email],
      subject: copy.subject,
      html,
      tags: [
        { name: 'kind', value: 'wa_optin_invite' },
        { name: 'agency_id', value: profile.agency_id },
      ],
    }),
  })
  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.error('whatsapp-optin-invite resend:', res.status, detail.slice(0, 200))
    return json({ error: 'email_send_failed' }, 502)
  }

  // Audit : l'invitation est un geste vers une personne, pas un réglage.
  await admin.from('activity_events').insert({
    agency_id: profile.agency_id,
    actor_id: null,
    actor_kind: 'ai',
    action: 'whatsapp_optin_invited',
    entity_type: 'contact',
    entity_id: contact_id,
    category: 'messaging',
    severity: 'info',
    metadata: { via: 'email', profile_id: profile.id, lang, invite_id: invite.id },
  }).then(() => {}, () => {})

  // ⛔ Le jeton n'est PAS rendu : un agent qui pourrait se le faire remettre pourrait
  // fabriquer le consentement du contact depuis son propre téléphone.
  return json({ ok: true, invite_id: invite.id, lang, expires_in_days: INVITE_DAYS }, 200)
})
