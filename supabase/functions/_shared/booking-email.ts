// supabase/functions/_shared/booking-email.ts
// Courriels du rendez-vous de vérification KYC : confirmation, report, annulation.
//
// Dates formatées dans le fuseau de l'AGENT, explicitement.
// `send-visit-email` s'appuie sur `getHours()` du runtime — donc sur UTC en edge
// function, ce qui annonce au client une heure décalée d'une à deux heures selon
// la saison. Une convocation à une vérification d'identité ne peut pas se
// permettre ça, d'où le formatage par Intl avec `timeZone` ici.
//
// Meilleur effort : un échec d'envoi ne remet jamais en cause la réservation
// elle-même (la page de confirmation affiche le rendez-vous de toute façon).

const RESEND_URL = 'https://api.resend.com/emails'
const FROM = 'MEGGA <noreply@megga.ch>'

export type BookingEmailKind = 'confirmed' | 'rescheduled' | 'cancelled'

export interface BookingEmailParams {
  kind: BookingEmailKind
  to: string
  contactName: string | null
  startIso: string
  timeZone: string
  mode: 'sur_place' | 'video'
  location?: string | null
  videoLink?: string | null
  agencyName?: string | null
  agentName?: string | null
  /** Lien de gestion (report / annulation) — omis sur une annulation. */
  manageUrl?: string | null
}

/** « lundi 1 septembre 2026 à 10:00 » dans le fuseau donné. */
function formatFr(iso: string, timeZone: string): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('fr-CH', {
    timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
  const time = new Intl.DateTimeFormat('fr-CH', {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return `${date} à ${time}`
}

function buildHtml(subject: string, paragraphs: string[]): string {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<div style="max-width:560px;margin:32px auto;background:white;border-radius:12px;overflow:hidden;border:1px solid #e5e7eb">
  <div style="background:#1a1a1a;padding:24px 32px;text-align:center">
    <span style="color:white;font-size:20px;font-weight:700;letter-spacing:2px">MEGGA</span>
    <span style="display:block;color:#9ca3af;font-size:11px;margin-top:2px">Immobilier Suisse</span>
  </div>
  <div style="padding:32px">
    <h2 style="margin:0 0 16px;font-size:18px;color:#111827">${subject}</h2>
    ${paragraphs.map(p => `<p style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#374151">${p}</p>`).join('\n    ')}
  </div>
  <div style="padding:16px 32px;border-top:1px solid #f3f4f6;text-align:center">
    <p style="margin:0;font-size:11px;color:#9ca3af">MEGGA Real Estate — megga.ch</p>
  </div>
</div>
</body>
</html>`
}

/** Neutralise le HTML : ces valeurs viennent de la base et finissent dans un e-mail. */
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}

/**
 * Envoie le courriel correspondant. Renvoie `false` sur échec — l'appelant
 * n'en fait rien d'autre que le journaliser : la réservation prime.
 */
export async function sendBookingEmail(p: BookingEmailParams): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey || !p.to) return false

  const when = formatFr(p.startIso, p.timeZone)
  const hello = p.contactName ? `Bonjour ${esc(p.contactName)},` : 'Bonjour,'
  const who = p.agentName ? esc(p.agentName) : 'votre conseiller'
  const agency = p.agencyName ? esc(p.agencyName) : 'MEGGA'

  let subject: string
  const body: string[] = [hello]

  if (p.kind === 'cancelled') {
    subject = 'Votre rendez-vous de vérification a été annulé'
    body.push(`Votre rendez-vous de vérification d'identité du <strong>${when}</strong> a bien été annulé.`)
    body.push(`Pour en fixer un nouveau, contactez ${who} chez ${agency}.`)
  } else {
    subject = p.kind === 'rescheduled'
      ? 'Votre rendez-vous de vérification a été déplacé'
      : 'Votre rendez-vous de vérification est confirmé'
    body.push(
      p.kind === 'rescheduled'
        ? `Votre rendez-vous de vérification d'identité est désormais fixé au <strong>${when}</strong>.`
        : `Votre rendez-vous de vérification d'identité est confirmé pour le <strong>${when}</strong>.`,
    )
    if (p.mode === 'video') {
      body.push(p.videoLink
        ? `Il se tiendra en visioconférence : <a href="${esc(p.videoLink)}">rejoindre la réunion</a>.`
        : 'Il se tiendra en visioconférence ; le lien vous parviendra avant la séance.')
    } else if (p.location) {
      body.push(`Adresse : <strong>${esc(p.location)}</strong>.`)
    }
    body.push('Merci de vous munir de la pièce d\'identité que vous avez transmise.')
    if (p.manageUrl) {
      body.push(`Un empêchement ? <a href="${esc(p.manageUrl)}">Déplacer ou annuler ce rendez-vous</a>.`)
    }
  }

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: p.to, subject, html: buildHtml(subject, body) }),
    })
    return res.ok
  } catch {
    return false
  }
}
