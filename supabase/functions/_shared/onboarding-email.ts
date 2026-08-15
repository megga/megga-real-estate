// supabase/functions/_shared/onboarding-email.ts
//
// Gabarits d'e-mail et fichier `.ics` de l'appel d'accueil. Module PUR : il rend des
// chaînes, il n'envoie rien. Le transport vit dans `_shared/resend.ts`, ce qui rend
// tout ce fichier testable sans réseau.
//
// La typographie suit la règle maison : ni tiret cadratin ni demi-cadratin. Le point
// médian reste autorisé comme séparateur.

// La coquille, les jetons et les atomes vivent dans `email-shell.ts` : ce fichier ne
// décide que du CONTENU des trois gabarits. Écrire un `<!DOCTYPE>` ici ferait crier la
// porte `npm run lint:email-shell`, et c'est le but.
import {
  BRAND, BODY_INK, FONT,
  escapeHtml, shell, p, h2, row, button,
} from './email-shell.ts'

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

/**
 * Mention de pied des e-mails CLIENT. Vraie pour les deux cas où elle sert
 * (confirmation, rappel) : le message concerne un rendez-vous pris par le
 * destinataire. ⛔ Ne jamais la remplacer par la mention « notification de sécurité »
 * du gabarit d'authentification : ce serait faux ici, et une fausse mention de
 * sécurité use celle qui compte quand elle arrive vraiment.
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

/**
 * Les questions de calibrage posées à la réservation, en clair.
 *
 * ⚠ DUPLIQUÉ DE `src/i18n/locales/fr/onboarding.json` À DESSEIN, et ce n'est pas une
 * négligence : une fonction Deno ne voit pas le bundle i18n du navigateur — `src/`
 * n'est pas déployé avec `supabase/functions/` — et `attendee_answers` ne stocke que
 * des CODES (`portfolio: '6-20'`), volontairement (ce sont des choix, pas des mesures).
 * Sans cette table, l'avis afficherait « portfolio : 6-20 ».
 *
 * La formulation s'écarte du produit à dessein : le wizard s'adresse à l'agence
 * (« votre portefeuille », « mes acquéreurs »), cet avis parle D'ELLE à l'équipe.
 * D'où « Portefeuille » et « Suivre ses acquéreurs ».
 */
const CALIBRAGE: Record<string, { label: string; options?: Record<string, string> }> = {
  portfolio: {
    label: 'Portefeuille',
    options: { '1-5': '1 à 5 biens', '6-20': '6 à 20 biens', '21-50': '21 à 50 biens', '50+': 'Plus de 50 biens' },
  },
  business: {
    label: 'Activité',
    options: { sale: 'Vente', rent: 'Location', both: 'Vente et location' },
  },
  team: {
    label: 'Équipe',
    options: { '1': 'Agent seul', '2-5': '2 à 5 agents', '6-15': '6 à 15 agents', '15+': 'Plus de 15 agents' },
  },
  priority: {
    label: 'Priorité',
    options: {
      mandates: 'Trouver des mandats',
      buyers: 'Suivre ses acquéreurs',
      admin: 'Gagner du temps administratif',
      compliance: 'Sécuriser le LAB/KYC',
    },
  },
  cantons: { label: 'Cantons' },
}

/** Identité du signataire : déjà rendue dans la ligne « Contact », donc jamais répétée. */
const IDENTITE = new Set(['first_name', 'last_name', 'email'])

export interface CalibrationLine { label: string; value: string }

/**
 * Traduit `attendee_answers` en lignes lisibles, dans l'ordre des questions du wizard.
 *
 * Une clé inconnue n'est PAS jetée : elle ressort avec son code brut. Ajouter une
 * question au wizard sans toucher à ce fichier dégrade l'affichage — ça ne le casse
 * pas, et surtout ça ne perd pas la réponse.
 */
export function calibrationLines(
  answers: Record<string, string> | null | undefined,
): CalibrationLine[] {
  if (!answers) return []
  const lignes: CalibrationLine[] = []
  for (const [cle, q] of Object.entries(CALIBRAGE)) {
    const brut = answers[cle]
    if (!brut) continue
    lignes.push({ label: q.label, value: q.options?.[brut] ?? brut })
  }
  for (const [cle, valeur] of Object.entries(answers)) {
    if (cle in CALIBRAGE || IDENTITE.has(cle) || !valeur) continue
    lignes.push({ label: cle, value: valeur })
  }
  return lignes
}

/**
 * Avis interne, pour la boîte MEGGA qui prend l'appel.
 *
 * `answers` porte les réponses de calibrage. Elles ne sont rendues que si l'appel a
 * lieu : sur une annulation, elles n'apprennent plus rien et allongent un message dont
 * le seul contenu utile est « le créneau est libre ».
 */
export function buildHostEmail(
  d: OnboardingCallEmailData,
  kind: 'booked' | 'rescheduled' | 'cancelled',
  answers?: Record<string, string> | null,
): { subject: string; html: string } {
  const when = formatWhen(d.startMs, d.timezone, 'fr')
  const heading = kind === 'booked'
    ? 'Nouvel appel d’accueil'
    : kind === 'rescheduled'
      ? 'Appel d’accueil replanifié'
      : 'Appel d’accueil annulé'

  const subject = `${heading} · ${d.agencyName} · ${when}`
  const calibrage = kind === 'cancelled' ? [] : calibrationLines(answers)

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
    ${calibrage.length > 0
      ? `${h2('Ce qu’ils ont répondu')}
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:8px 0 28px;">
      ${calibrage.map((l) => row(l.label, escapeHtml(l.value))).join('')}
    </table>`
      : ''}
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
