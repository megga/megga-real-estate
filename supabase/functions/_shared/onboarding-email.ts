// supabase/functions/_shared/onboarding-email.ts
//
// Gabarits d'e-mail et fichier `.ics` de l'appel d'accueil. Module PUR : il rend des
// chaînes, il n'envoie rien. Le transport vit dans `_shared/resend.ts`, ce qui rend
// tout ce fichier testable sans réseau.
//
// La typographie suit la règle maison : ni tiret cadratin ni demi-cadratin. Le point
// médian reste autorisé comme séparateur.

export interface OnboardingCallEmailData {
  callId: string
  attendeeName: string
  attendeeEmail: string
  agencyName: string
  hostName: string
  startMs: number
  durationMinutes: number
  /** Fuseau dans lequel la date est écrite au destinataire. */
  timezone: string
  meetingUrl: string | null
  manageUrl: string
  locale: 'fr' | 'en'
}

const BRAND = '#424bfb'

/** Date et heure lisibles, dans le fuseau demandé. */
export function formatWhen(startMs: number, timezone: string, locale: 'fr' | 'en'): string {
  const dtf = new Intl.DateTimeFormat(locale === 'fr' ? 'fr-CH' : 'en-GB', {
    timeZone: timezone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
  return dtf.format(new Date(startMs))
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function shell(title: string, bodyHtml: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f7;font-family:'DM Sans',Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f7;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0A0B0D;padding:24px 28px;">
          <img src="https://megga.ch/email/megga-logo-white.png" alt="MEGGA" width="132" style="display:block;border:0;" />
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;font-size:20px;line-height:1.3;color:#0A0B0D;font-weight:700;">${escapeHtml(title)}</h1>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:18px 28px;border-top:1px solid #ececf0;color:#8E8E96;font-size:12px;line-height:1.6;">
          MEGGA Real Estate · Gen&egrave;ve<br />Ce message vous est envoy&eacute; parce qu&rsquo;un rendez-vous vous concerne.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:6px 0;color:#8E8E96;font-size:13px;width:110px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:6px 0;color:#0A0B0D;font-size:14px;font-weight:500;">${value}</td>
  </tr>`
}

function button(href: string, label: string): string {
  return `<a href="${escapeHtml(href)}" style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:10px;font-size:14px;font-weight:600;">${escapeHtml(label)}</a>`
}

/** E-mail de confirmation, pour l'agence qui vient de réserver. */
export function buildAttendeeEmail(d: OnboardingCallEmailData): { subject: string; html: string } {
  const fr = d.locale === 'fr'
  const when = formatWhen(d.startMs, d.timezone, d.locale)

  const subject = fr
    ? `Votre appel d'accueil MEGGA, ${when}`
    : `Your MEGGA welcome call, ${when}`

  const details = `<table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 22px;">
    ${row(fr ? 'Quand' : 'When', escapeHtml(when))}
    ${row(fr ? 'Dur&eacute;e' : 'Duration', `${d.durationMinutes} min`)}
    ${row(fr ? 'Avec' : 'With', escapeHtml(d.hostName))}
    ${d.meetingUrl ? row(fr ? 'Lien' : 'Link', `<a href="${escapeHtml(d.meetingUrl)}" style="color:${BRAND};">${escapeHtml(d.meetingUrl)}</a>`) : ''}
  </table>`

  const html = shell(
    fr ? 'Votre appel d’accueil est confirmé' : 'Your welcome call is confirmed',
    `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3a3a40;">
       ${fr
        ? `Bonjour ${escapeHtml(d.attendeeName)}, votre appel d’accueil pour ${escapeHtml(d.agencyName)} est réservé. Nous ferons le tour de votre installation et répondrons à vos questions.`
        : `Hello ${escapeHtml(d.attendeeName)}, your welcome call for ${escapeHtml(d.agencyName)} is booked. We will walk through your setup and answer your questions.`}
     </p>
     ${details}
     ${d.meetingUrl ? `<p style="margin:0 0 18px;">${button(d.meetingUrl, fr ? 'Rejoindre l’appel' : 'Join the call')}</p>` : ''}
     <p style="margin:0;font-size:13px;line-height:1.6;color:#8E8E96;">
       ${fr ? 'Un emp&ecirc;chement ? Vous pouvez ' : 'Something came up? You can '}
       <a href="${escapeHtml(d.manageUrl)}" style="color:${BRAND};">${fr ? 'replanifier ou annuler' : 'reschedule or cancel'}</a>${fr ? ', sans avoir à vous reconnecter.' : ', no sign-in needed.'}
     </p>`,
  )

  return { subject, html }
}

/** Avis interne, pour l'hôte MEGGA qui prend l'appel. */
export function buildHostEmail(
  d: OnboardingCallEmailData,
  kind: 'booked' | 'rescheduled' | 'cancelled',
): { subject: string; html: string } {
  const when = formatWhen(d.startMs, d.timezone, 'fr')
  const heading = kind === 'booked'
    ? 'Nouvel appel d’accueil'
    : kind === 'rescheduled'
      ? 'Appel d’accueil replanifié'
      : 'Appel d’accueil annulé'

  const subject = `${heading} · ${d.agencyName} · ${when}`

  const html = shell(heading, `
    <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;margin:0 0 20px;">
      ${row('Agence', escapeHtml(d.agencyName))}
      ${row('Contact', `${escapeHtml(d.attendeeName)}<br /><a href="mailto:${escapeHtml(d.attendeeEmail)}" style="color:${BRAND};">${escapeHtml(d.attendeeEmail)}</a>`)}
      ${row(kind === 'cancelled' ? 'Cr&eacute;neau lib&eacute;r&eacute;' : 'Quand', escapeHtml(when))}
      ${row('Dur&eacute;e', `${d.durationMinutes} min`)}
    </table>
    ${kind !== 'cancelled' && d.meetingUrl ? `<p style="margin:0;">${button(d.meetingUrl, 'Ouvrir la visioconf&eacute;rence')}</p>` : ''}`)

  return { subject, html }
}

/** Rappel J-1, envoyé à l'agence. */
export function buildReminderEmail(d: OnboardingCallEmailData): { subject: string; html: string } {
  const fr = d.locale === 'fr'
  const when = formatWhen(d.startMs, d.timezone, d.locale)

  return {
    subject: fr ? `Rappel : appel d'accueil ${when}` : `Reminder: welcome call ${when}`,
    html: shell(
      fr ? 'C’est demain' : 'It is tomorrow',
      `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#3a3a40;">
         ${fr
          ? `Petit rappel : votre appel d’accueil avec ${escapeHtml(d.hostName)} a lieu ${escapeHtml(when)}.`
          : `A quick reminder: your welcome call with ${escapeHtml(d.hostName)} takes place ${escapeHtml(when)}.`}
       </p>
       ${d.meetingUrl ? `<p style="margin:0 0 18px;">${button(d.meetingUrl, fr ? 'Rejoindre l’appel' : 'Join the call')}</p>` : ''}
       <p style="margin:0;font-size:13px;line-height:1.6;color:#8E8E96;">
         <a href="${escapeHtml(d.manageUrl)}" style="color:${BRAND};">${fr ? 'Replanifier ou annuler' : 'Reschedule or cancel'}</a>
       </p>`,
    ),
  }
}

// ── Fichier .ics ────────────────────────────────────────────────────────────

/** Horodatage ICS en UTC : `YYYYMMDDTHHMMSSZ`. */
function icsStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/**
 * Échappe et replie une ligne ICS. RFC 5545 impose des lignes de 75 octets au plus,
 * repliées par un saut de ligne suivi d'une espace : un client strict rejette le
 * fichier entier sinon, et l'invitation disparaît sans message d'erreur.
 */
function icsLine(name: string, value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')

  const full = `${name}:${escaped}`
  if (full.length <= 75) return full

  const chunks: string[] = [full.slice(0, 75)]
  let rest = full.slice(75)
  while (rest.length > 74) {
    chunks.push(` ${rest.slice(0, 74)}`)
    rest = rest.slice(74)
  }
  if (rest.length) chunks.push(` ${rest}`)
  return chunks.join('\r\n')
}

export interface IcsInput {
  callId: string
  summary: string
  description: string
  startMs: number
  durationMinutes: number
  organizerEmail: string
  attendeeEmail: string
  meetingUrl: string | null
  /** `CANCEL` produit une annulation que les clients d'agenda savent appliquer. */
  method: 'REQUEST' | 'CANCEL'
  /** Incrémenté à chaque modification, sinon les clients ignorent la mise a jour. */
  sequence: number
}

export function buildIcs(input: IcsInput): string {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MEGGA Real Estate//Appel d accueil//FR',
    'CALSCALE:GREGORIAN',
    `METHOD:${input.method}`,
    'BEGIN:VEVENT',
    // L'UID doit rester le même pour qu'une replanification remplace l'entrée au
    // lieu d'en créer une seconde dans l'agenda du client.
    icsLine('UID', `onboarding-call-${input.callId}@megga.ch`),
    `SEQUENCE:${Math.max(0, input.sequence)}`,
    `DTSTAMP:${icsStamp(Date.now())}`,
    `DTSTART:${icsStamp(input.startMs)}`,
    `DTEND:${icsStamp(input.startMs + input.durationMinutes * 60_000)}`,
    icsLine('SUMMARY', input.summary),
    icsLine('DESCRIPTION', input.description),
    ...(input.meetingUrl ? [icsLine('LOCATION', input.meetingUrl), icsLine('URL', input.meetingUrl)] : []),
    icsLine('ORGANIZER;CN=MEGGA', `mailto:${input.organizerEmail}`),
    icsLine('ATTENDEE;ROLE=REQ-PARTICIPANT;PARTSTAT=ACCEPTED', `mailto:${input.attendeeEmail}`),
    `STATUS:${input.method === 'CANCEL' ? 'CANCELLED' : 'CONFIRMED'}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  // CRLF exigé par la RFC ; certains clients Windows refusent un simple LF.
  return `${lines.join('\r\n')}\r\n`
}
