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

// ── Jetons de l'habillage MEGGA X ───────────────────────────────────────────
// L'ancienne coquille était claire (fond #f5f5f7, carte blanche, DM Sans) : elle
// datait d'avant la bascule du CRM et de la vitrine vers MEGGA X. Les valeurs
// ci-dessous sont celles de la direction en vigueur, posées ici en clair parce
// qu'un e-mail ne peut lire aucune variable CSS : le client de messagerie ne voit
// que ce qui est inliné.
const BRAND = '#424bfb'
const CARD = '#090909'
const CARD_BORDER = '#181818'
const INK = '#ffffff'
const BODY_INK = '#cccccc'
const MUTED = '#8a8a8f'

/**
 * ⚠ `app.megga.ch`, JAMAIS `megga.ch`. La vitrine est derrière un mot de passe :
 * mesuré le 15.08.2026, `megga.ch/email/megga-logo-white.png` rend **401** en
 * `text/plain` (23 octets), ce que tout client de messagerie affiche en image
 * cassée. C'est l'adresse que portait cette coquille depuis l'origine, donc le
 * logo était mort dans chaque e-mail d'appel d'accueil déjà parti. Les deux
 * fichiers sont versionnés dans `public/email/` et servis en `image/png` par
 * l'app.
 */
const ASSETS = 'https://app.megga.ch/email'

const FONT = "'Inter Tight','Helvetica Neue',Helvetica,Arial,sans-serif"

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

interface ShellOptions {
  /** Sert le `<title>` ET le `<h1>` : les deux disent la même chose, par construction. */
  title: string
  /**
   * Texte d'aperçu de la liste des messages, masqué à l'ouverture. Il ne REPÈTE
   * jamais l'objet : c'est la seule ligne qui peut dire pourquoi garder le message
   * (le lien y est), là où l'objet dit de quoi il s'agit.
   */
  preheader: string
  bodyHtml: string
  /**
   * Mention de pied. `null` pour un avis INTERNE : promettre à un collègue qu'« il
   * ne s'agit pas d'une communication marketing » n'a pas de destinataire.
   */
  legalNote: string | null
  /** Pilule d'en-tête. `null` sur les avis internes, où elle n'ouvre rien d'utile. */
  headerCta: { href: string; label: string } | null
}

/**
 * Coquille MEGGA X sombre, commune aux trois gabarits.
 *
 * ⚠ Tout est inliné et posé en tableaux : un client de messagerie ne lit ni
 * variable CSS, ni flexbox, ni grille. Le `<style>` de l'en-tête ne porte donc que
 * ce qui ne peut PAS être inliné (media queries), et rien d'essentiel n'en dépend :
 * un client qui le jette rend quand même la carte correctement.
 */
function shell(o: ShellOptions): string {
  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="fr">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${escapeHtml(o.title)}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@400;500;700;800&amp;display=swap" rel="stylesheet" />
  <style>
    a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
    :root { color-scheme: dark; supported-color-schemes: dark; }
    @media (prefers-color-scheme: light) {
      body { background: #ffffff !important; }
      .mg-card { background: ${CARD} !important; }
      .mg-title, .mg-h2 { color: ${INK} !important; }
    }
    @media screen and (max-width: 600px) {
      .mg-pad { padding-left: 24px !important; padding-right: 24px !important; }
      .mg-title { font-size: 26px !important; }
      .mg-cta { display: block !important; width: 100% !important; box-sizing: border-box !important; padding-left: 16px !important; padding-right: 16px !important; }
      .mg-login { display: none !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#ffffff;-webkit-font-smoothing:antialiased;">

  <div style="display:none;max-height:0;overflow:hidden;color:transparent;opacity:0;">
    ${escapeHtml(o.preheader)}
  </div>

  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="mg-card" style="max-width:600px;width:100%;background:${CARD};border:1px solid ${CARD_BORDER};border-radius:24px;">

          <tr>
            <td class="mg-pad" style="padding:36px 36px 8px;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="left" valign="middle">
                    <img src="${ASSETS}/megga-logo-white.png" width="140" height="31" alt="MEGGA"
                      style="display:block;width:140px;height:31px;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;font-family:${FONT};font-size:21px;font-weight:800;letter-spacing:-1.1px;color:${INK};" />
                  </td>
                  ${o.headerCta ? `<td align="right" valign="middle" class="mg-login">
                    <a href="${escapeHtml(o.headerCta.href)}"
                      style="display:inline-block;border:1px solid ${INK};color:${INK};text-decoration:none;padding:11px 22px;border-radius:999px;font-family:${FONT};font-size:13px;font-weight:600;line-height:1;letter-spacing:0.4px;">
                      ${escapeHtml(o.headerCta.label)}
                    </a>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td class="mg-pad" style="padding:52px 36px 0;">
              <h1 class="mg-title" style="margin:0 0 20px;font-family:${FONT};font-size:30px;font-weight:700;line-height:1.2;letter-spacing:-0.8px;color:${INK};">
                ${escapeHtml(o.title)}
              </h1>
              ${o.bodyHtml}
            </td>
          </tr>

          <tr>
            <td align="center" class="mg-pad" style="padding:44px 36px 8px;">
              <img src="${ASSETS}/megga-gg-indigo.png" width="36" height="22" alt=""
                style="display:block;width:36px;height:22px;border:0;outline:none;-ms-interpolation-mode:bicubic;font-family:${FONT};font-size:14px;font-weight:800;letter-spacing:-0.6px;color:${BRAND};" />
            </td>
          </tr>
          <tr>
            <td align="center" class="mg-pad" style="padding:14px 36px 0;">
              <p style="margin:0 0 4px;font-family:${FONT};font-size:12.5px;font-weight:400;line-height:1.6;color:${MUTED};">
                MEGGA, Rue du Rhône 14, 1204 Genève, Suisse
              </p>
              <p style="margin:0;font-family:${FONT};font-size:12.5px;font-weight:400;line-height:1.6;color:${MUTED};">
                © 2026 MEGGA Inc. Tous droits réservés
              </p>
            </td>
          </tr>
          ${o.legalNote ? `<tr>
            <td align="center" class="mg-pad" style="padding:26px 48px 20px;">
              <p style="margin:0;font-family:${FONT};font-size:11.5px;font-weight:400;line-height:1.75;color:${MUTED};">
                ${escapeHtml(o.legalNote)}
              </p>
            </td>
          </tr>` : ''}

          <tr>
            <td height="112" style="height:112px;font-size:0;line-height:0;">
              <div style="height:112px;font-size:0;line-height:0;border-radius:0 0 24px 24px;background-image:linear-gradient(to bottom, ${CARD} 0%, rgba(9,9,9,0.93) 32%, rgba(9,9,9,0.5) 66%, rgba(9,9,9,0) 100%),linear-gradient(to right, #030303 0%, #12036e 9%, #2409c4 25%, #a02afb 50%, #7a0a76 76%, #2b0430 92%, #030303 100%);">&nbsp;</div>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body></html>`
}

/** Paragraphe de corps, à l'encre douce de la direction. */
function p(html: string, marginBottom = 16): string {
  return `<p style="margin:0 0 ${marginBottom}px;font-family:${FONT};font-size:16px;font-weight:400;line-height:1.6;color:${BODY_INK};">${html}</p>`
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:7px 0;font-family:${FONT};color:${MUTED};font-size:13px;width:120px;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:7px 0;font-family:${FONT};color:${INK};font-size:15px;font-weight:500;">${value}</td>
  </tr>`
}

/**
 * Bouton d'action, en pilule.
 *
 * ⚠ La branche VML n'est pas décorative : Outlook (moteur Word) ignore
 * `border-radius` et le remplissage d'un `<a>`, et rendrait un lien bleu souligné
 * au milieu d'une carte noire. `v:roundrect` EXIGE une largeur en pixels, sans
 * équivalent automatique : on l'estime sur la longueur du libellé, une pilule un
 * peu large étant sans conséquence là où une pilule trop étroite couperait le mot.
 */
function button(href: string, label: string): string {
  const largeurVml = Math.round(64 + label.length * 8.8)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td align="left">
    <!--[if mso]>
    <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word"
      href="${escapeHtml(href)}" arcsize="50%" stroke="f" fillcolor="${BRAND}"
      style="height:56px;v-text-anchor:middle;width:${largeurVml}px;">
      <w:anchorlock/>
      <center style="color:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;">${escapeHtml(label)}</center>
    </v:roundrect>
    <![endif]-->
    <!--[if !mso]><!-->
    <a class="mg-cta" href="${escapeHtml(href)}"
      style="display:inline-block;background:${BRAND};color:#ffffff;text-decoration:none;padding:18px 32px;border-radius:999px;text-align:center;font-family:${FONT};font-size:16px;font-weight:600;line-height:1;letter-spacing:-0.2px;">
      ${escapeHtml(label)}
    </a>
    <!--<![endif]-->
  </td></tr></table>`
}

/** Sous-titre du bloc secondaire (« Un empêchement ? »). */
function h2(text: string): string {
  return `<h2 class="mg-h2" style="margin:0 0 8px;font-family:${FONT};font-size:16px;font-weight:700;line-height:1.4;color:${INK};">${escapeHtml(text)}</h2>`
}

/**
 * Mention de pied des e-mails CLIENT. Vraie pour les trois cas où elle sert
 * (confirmation, rappel) : le message concerne un rendez-vous pris par le
 * destinataire. ⛔ Ne jamais la remplacer par la mention « notification de
 * sécurité » du gabarit d'authentification : ce serait faux ici, et une fausse
 * mention de sécurité use celle qui compte quand elle arrive vraiment.
 */
const LEGAL_NOTE = {
  fr: 'Cet e-mail concerne un rendez-vous que vous avez pris avec MEGGA. Il ne s’agit pas d’une communication marketing : c’est pourquoi il ne contient pas de lien de désinscription.',
  en: 'This email is about an appointment you booked with MEGGA. It is not a marketing message, which is why it carries no unsubscribe link.',
} as const

/** Pilule d'en-tête des e-mails client. */
const HEADER_CTA = {
  fr: { href: 'https://app.megga.ch/dashboard', label: 'Ouvrir mon espace' },
  en: { href: 'https://app.megga.ch/dashboard', label: 'Open my space' },
} as const

/** Bloc de faits partagé par la confirmation et le rappel. */
function detailsTable(d: OnboardingCallEmailData, fr: boolean): string {
  const when = formatWhen(d.startMs, d.timezone, d.locale)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
    ${row(fr ? 'Quand' : 'When', escapeHtml(when))}
    ${row(fr ? 'Durée' : 'Duration', `${d.durationMinutes} min`)}
    ${row(fr ? 'Avec' : 'With', escapeHtml(d.hostName))}
    ${d.meetingUrl ? row(fr ? 'Lien' : 'Link', `<a href="${escapeHtml(d.meetingUrl)}" style="color:${BRAND};word-break:break-all;">${escapeHtml(d.meetingUrl)}</a>`) : ''}
  </table>`
}

/**
 * Ligne de repli quand aucun lien de visioconférence n'existe encore.
 *
 * Le cas est réel : `createHostEvent` rend `null` si l'agenda de l'hôte n'est pas
 * joignable, et la réservation aboutit quand même. Promettre un lien absent, ou
 * n'en rien dire, laisserait le destinataire chercher dans un e-mail qui ne
 * l'aura jamais porté.
 */
function lienASuivre(fr: boolean): string {
  return p(fr
    ? 'Le lien de visioconférence vous parvient dès qu’il est prêt, dans un second message.'
    : 'Your video link will follow in a second message as soon as it is ready.', 0)
}

/** Le bloc « Un empêchement ? » : c'est la ligne la plus utile de l'e-mail. */
function blocReplanifier(d: OnboardingCallEmailData, fr: boolean): string {
  return `${h2(fr ? 'Un empêchement ?' : 'Something came up?')}
     <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;font-weight:400;line-height:1.6;color:${BODY_INK};">
       <a href="${escapeHtml(d.manageUrl)}" style="color:${BRAND};">${fr ? 'Replanifiez ou annulez' : 'Reschedule or cancel'}</a>${fr ? ' en un clic, sans avoir à vous reconnecter.' : ' in one click, no sign-in needed.'}
     </p>`
}

/** Signature client. « À bientôt » et non « Merci » : on se donne rendez-vous. */
function signature(fr: boolean): string {
  return `<div style="padding:32px 0 0;">${p(fr ? 'À bientôt,<br />L’équipe MEGGA' : 'See you soon,<br />The MEGGA team', 0)}</div>`
}

/** E-mail de confirmation, pour l'agence qui vient de réserver. */
export function buildAttendeeEmail(d: OnboardingCallEmailData): { subject: string; html: string } {
  const fr = d.locale === 'fr'
  const when = formatWhen(d.startMs, d.timezone, d.locale)

  // L'ÉTAT avant la marque : un objet se lit tronqué sur mobile, et ce qui compte
  // est que le rendez-vous est acté. Le logo dit qui écrit, dès l'ouverture.
  const subject = fr
    ? `Appel d’accueil confirmé · ${when}`
    : `Welcome call confirmed · ${when}`

  const html = shell({
    title: fr ? 'Votre appel d’accueil est confirmé' : 'Your welcome call is confirmed',
    // N'ajoute rien à l'objet : il dit ce que le message CONTIENT, donc pourquoi le garder.
    preheader: fr
      ? 'Le lien de visioconférence et de quoi replanifier sont dans ce message.'
      : 'Your video link and reschedule options are in this message.',
    legalNote: LEGAL_NOTE[d.locale],
    headerCta: HEADER_CTA[d.locale],
    bodyHtml: `
     ${p(fr ? `Bonjour ${escapeHtml(d.attendeeName)},` : `Hello ${escapeHtml(d.attendeeName)},`)}
     ${p(fr
      ? `Nous nous retrouvons pour faire le tour de votre installation, répondre à vos questions et calibrer MEGGA sur votre façon de travailler.`
      : `We will walk through your setup, answer your questions, and tune MEGGA to the way you work.`, 28)}
     ${detailsTable(d, fr)}
     ${d.meetingUrl
      ? `<div style="margin:0 0 32px;">${button(d.meetingUrl, fr ? 'Rejoindre l’appel' : 'Join the call')}</div>`
      : `<div style="margin:0 0 32px;">${lienASuivre(fr)}</div>`}
     ${blocReplanifier(d, fr)}
     ${signature(fr)}`,
  })

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

  // Avis INTERNE : ni mention légale ni pilule de connexion (cf. ShellOptions).
  // L'hôte est déjà dans l'outil, on lui donne des faits et un bouton, rien d'autre.
  const html = shell({
    title: heading,
    preheader: `${d.agencyName} · ${when}`,
    legalNote: null,
    headerCta: null,
    bodyHtml: `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
      ${row('Agence', escapeHtml(d.agencyName))}
      ${row('Contact', `${escapeHtml(d.attendeeName)}<br /><a href="mailto:${escapeHtml(d.attendeeEmail)}" style="color:${BRAND};">${escapeHtml(d.attendeeEmail)}</a>`)}
      ${row(kind === 'cancelled' ? 'Créneau libéré' : 'Quand', escapeHtml(when))}
      ${row('Durée', `${d.durationMinutes} min`)}
    </table>
    ${kind !== 'cancelled' && d.meetingUrl ? button(d.meetingUrl, 'Ouvrir la visioconférence') : ''}`,
  })

  return { subject, html }
}

/** Rappel J-1, envoyé à l'agence. */
export function buildReminderEmail(d: OnboardingCallEmailData): { subject: string; html: string } {
  const fr = d.locale === 'fr'
  const when = formatWhen(d.startMs, d.timezone, d.locale)

  return {
    subject: fr ? `Rappel : appel d’accueil ${when}` : `Reminder: welcome call ${when}`,
    html: shell({
      title: fr ? 'C’est demain' : 'It is tomorrow',
      preheader: fr
        ? 'Le lien de visioconférence est dans ce message.'
        : 'Your video link is in this message.',
      legalNote: LEGAL_NOTE[d.locale],
      headerCta: HEADER_CTA[d.locale],
      bodyHtml: `
       ${p(fr
        ? `Petit rappel : votre appel d’accueil avec ${escapeHtml(d.hostName)} a lieu ${escapeHtml(when)}.`
        : `A quick reminder: your welcome call with ${escapeHtml(d.hostName)} takes place ${escapeHtml(when)}.`, 28)}
       ${d.meetingUrl
        ? `<div style="margin:0 0 32px;">${button(d.meetingUrl, fr ? 'Rejoindre l’appel' : 'Join the call')}</div>`
        : `<div style="margin:0 0 32px;">${lienASuivre(fr)}</div>`}
       ${blocReplanifier(d, fr)}
       ${signature(fr)}`,
    }),
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
