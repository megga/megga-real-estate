// Envoi de l'invitation d'opt-in `click_to_wa` — une seule implémentation, deux appelants.
//
// L'edge function `whatsapp-optin-invite` (bouton du CRM) et l'exécuteur du copilote
// WhatsApp font exactement le même geste. Le dupliquer, c'est le laisser diverger : le jour
// où l'un des deux oublie de vérifier la suppression ou d'archiver le texte montré, rien ne
// le dira — et c'est la preuve juridique qui se perd, silencieusement.
//
// ⛔ Ne signe rien pour l'appelant : le jeton ne sort jamais de cette fonction. Un agent qui
// pourrait se le faire remettre pourrait fabriquer le consentement depuis son téléphone.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { signMagicLinkToken, expiryFromDays } from './magic-link-token.ts'
import { optinCopy, optinLang } from './whatsapp-optin-copy.ts'
import { OPTIN_PREFIX } from './whatsapp-optin.ts'

export const INVITE_DAYS = 14

/** Motifs de refus. Chacun a son message côté CRM comme côté copilote. */
export type OptinSendError =
  | 'contact_not_found' | 'contact_without_email' | 'contact_without_phone'
  | 'agency_wa_number_missing' | 'phone_suppressed' | 'invite_not_created'
  | 'email_not_configured' | 'email_send_failed'

export type OptinSendResult =
  | { ok: true; inviteId: string; lang: string; email: string }
  | { ok: false; error: OptinSendError }

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
   .replace(/"/g, '&quot;').replace(/'/g, '&#039;')

/**
 * Crée l'invitation, signe son jeton, envoie l'e-mail.
 *
 * @param agencyId agence de l'APPELANT — la garde cross-agence se fait au SQL (`.eq`), pas
 *   sur une comparaison en mémoire : un contact d'une autre agence est simplement introuvable.
 */
export async function sendOptinInvite(
  admin: SupabaseClient,
  a: { contactId: string; agencyId: string; sentBy?: string | null },
): Promise<OptinSendResult> {
  const { data: cRow } = await admin
    .from('contacts')
    .select('id, email, phone, language')
    .eq('id', a.contactId)
    .eq('agency_id', a.agencyId)
    .maybeSingle()
  const c = cRow as { email: string | null; phone: string | null; language: string | null } | null
  if (!c) return { ok: false, error: 'contact_not_found' }
  if (!c.email) return { ok: false, error: 'contact_without_email' }
  if (!c.phone) return { ok: false, error: 'contact_without_phone' }

  // Le numéro Business à composer. `agency_wa_numbers` fait autorité : c'est lui qui route
  // déjà l'attribution des entrants, et s'en écarter enverrait la personne vers un numéro
  // dont les réponses ne reviendraient pas à son agence.
  const { data: waRow } = await admin
    .from('agency_wa_numbers').select('wa_number').eq('agency_id', a.agencyId).limit(1).maybeSingle()
  const business = String((waRow as { wa_number?: string } | null)?.wa_number ?? '').replace(/\D/g, '')
  // ⚠ Échec EXPLICITE plutôt qu'un repli sur META_PHONE_NUMBER_ID, qui est un identifiant de
  // compte Meta et non un numéro : le lien `wa.me` mènerait nulle part, et l'agent croirait
  // l'invitation partie.
  if (!business) return { ok: false, error: 'agency_wa_number_missing' }

  const { data: agRow } = await admin
    .from('agencies').select('name').eq('id', a.agencyId).maybeSingle()
  const agencyName = String((agRow as { name?: string } | null)?.name ?? '').trim() || 'notre agence'

  const lang = optinLang(c.language)
  const copy = optinCopy(lang, agencyName)

  // L'invitation d'abord : elle porte le texte montré, donc la preuve. Si l'e-mail échoue
  // ensuite, il reste une invitation non consommée — inerte, et qui expire seule.
  const { data: invRows, error: invErr } = await admin.rpc('create_wa_optin_invite', {
    p_contact_id: a.contactId,
    p_shown_text: copy.body,
    p_lang: lang,
    p_purpose: 'marketing',
    p_days: INVITE_DAYS,
  })
  if (invErr) {
    return { ok: false, error: invErr.message.includes('phone_suppressed') ? 'phone_suppressed' : 'invite_not_created' }
  }
  const invite = (invRows as Array<{ id: string }> | null)?.[0]
  if (!invite) return { ok: false, error: 'invite_not_created' }

  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (!resendKey) return { ok: false, error: 'email_not_configured' }

  const { unix } = expiryFromDays(INVITE_DAYS)
  const token = await signMagicLinkToken({ id: invite.id, exp: unix, k: 'wa_optin' })
  const lien = `https://wa.me/${business}?text=${encodeURIComponent(`${OPTIN_PREFIX} ${token}`)}`

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
      tags: [{ name: 'kind', value: 'wa_optin_invite' }, { name: 'agency_id', value: a.agencyId }],
    }),
  })
  if (!res.ok) {
    console.error('optin invite resend:', res.status, (await res.text().catch(() => '')).slice(0, 200))
    return { ok: false, error: 'email_send_failed' }
  }

  await admin.from('activity_events').insert({
    agency_id: a.agencyId,
    actor_id: null,
    actor_kind: 'ai',
    action: 'whatsapp_optin_invited',
    entity_type: 'contact',
    entity_id: a.contactId,
    category: 'messaging',
    severity: 'info',
    metadata: { via: 'email', profile_id: a.sentBy ?? null, lang, invite_id: invite.id },
  }).then(() => {}, () => {})

  return { ok: true, inviteId: invite.id, lang, email: c.email }
}
