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
  locale: CallLocale
}

/**
 * Les QUATRE langues du produit, pas deux.
 *
 * Ce gabarit n'en connaissait que `fr` et `en`, et les appelants écrivaient
 * `body.locale === 'en' ? 'en' : 'fr'` : un utilisateur germanophone ou italophone
 * tombait donc dans le `else` et recevait du français, silencieusement. Le type est ce
 * qui rend cette régression impossible à réintroduire — un `else` sur quatre cas ne
 * compile pas.
 */
export type CallLocale = 'fr' | 'de' | 'en' | 'it'

/** Étiquette de format par langue. Suisse partout : c'est le marché. */
const INTL_TAG: Record<CallLocale, string> = {
  fr: 'fr-CH',
  de: 'de-CH',
  en: 'en-GB',
  it: 'it-CH',
}

export function formatWhen(startMs: number, timezone: string, locale: CallLocale): string {
  const dtf = new Intl.DateTimeFormat(INTL_TAG[locale], {
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
 * TOUT le texte des gabarits client, dans les quatre langues du produit.
 *
 * Une table plutôt qu'un `fr ? … : …` répété vingt fois : le ternaire tenait à deux
 * langues et devenait illisible à quatre, mais surtout il ne SIGNALAIT RIEN quand une
 * langue manquait — elle retombait sur l'autre branche. Ici, `Record<CallLocale, …>`
 * fait échouer la compilation tant que les quatre ne sont pas écrites.
 *
 * Formes de politesse : vouvoiement en français, Sie-Form en allemand, forme de
 * courtoisie (Lei) en italien. Le vocabulaire reprend celui de l'interface
 * (`src/i18n/locales/<langue>/onboarding.json`) : « Willkommensgespräch », « chiamata di
 * benvenuto ». Un agent doit lire dans son courriel le mot qu'il a vu à l'écran.
 *
 * ⛔ La mention légale est VRAIE dans les deux cas qui la portent (confirmation,
 * rappel) : le message concerne un rendez-vous pris par le destinataire. Ne jamais la
 * remplacer par la mention « notification de sécurité » du gabarit d'authentification :
 * ce serait faux ici, et une fausse mention de sécurité use celle qui compte quand elle
 * arrive vraiment.
 */
const T: Record<CallLocale, {
  legal: string
  ctaEspace: string
  quand: string
  duree: string
  avec: string
  lien: string
  lienASuivre: string
  empechementTitre: string
  empechementLien: string
  empechementSuite: string
  signature: string
  rejoindre: string
  confObjet: (quand: string) => string
  confTitre: string
  confApercu: string
  confBonjour: (nom: string) => string
  confIntro: string
  rappelObjet: (quand: string) => string
  rappelTitre: string
  rappelApercu: string
  rappelCorps: (hote: string, quand: string) => string
  annulObjet: string
  annulTitre: string
  annulApercu: string
  annulCorps: string
  annulCta: string
}> = {
  fr: {
    legal: 'Cet e-mail concerne un rendez-vous que vous avez pris avec MEGGA. Il ne s’agit pas d’une communication marketing : c’est pourquoi il ne contient pas de lien de désinscription.',
    ctaEspace: 'Ouvrir mon espace',
    quand: 'Quand', duree: 'Durée', avec: 'Avec', lien: 'Lien',
    lienASuivre: 'Le lien de visioconférence vous parvient dès qu’il est prêt, dans un second message.',
    empechementTitre: 'Un empêchement ?',
    empechementLien: 'Replanifiez ou annulez',
    empechementSuite: ' en un clic, sans avoir à vous reconnecter.',
    signature: 'À bientôt,<br />L’équipe MEGGA',
    rejoindre: 'Rejoindre l’appel',
    confObjet: (q) => `Appel d’accueil confirmé · ${q}`,
    confTitre: 'Votre appel d’accueil est confirmé',
    confApercu: 'Le lien de visioconférence et de quoi replanifier sont dans ce message.',
    confBonjour: (n) => `Bonjour ${n},`,
    confIntro: 'Nous nous retrouvons pour faire le tour de votre installation, répondre à vos questions et calibrer MEGGA sur votre façon de travailler.',
    rappelObjet: (q) => `Rappel : appel d’accueil ${q}`,
    rappelTitre: 'C’est demain',
    rappelApercu: 'Le lien de visioconférence est dans ce message.',
    rappelCorps: (h, q) => `Petit rappel : votre appel d’accueil avec ${h} a lieu ${q}.`,
    annulObjet: 'Votre appel d’accueil est annulé',
    annulTitre: 'Votre appel d’accueil est annulé',
    annulApercu: 'Vous pouvez en réserver un autre quand vous voulez.',
    annulCorps: 'Votre appel d’accueil a bien été annulé. Vous pouvez en réserver un autre quand cela vous convient, depuis votre espace MEGGA.',
    annulCta: 'Réserver un autre créneau',
  },
  de: {
    legal: 'Diese E-Mail betrifft einen Termin, den Sie mit MEGGA vereinbart haben. Es handelt sich nicht um eine Werbenachricht, deshalb enthält sie keinen Abmeldelink.',
    ctaEspace: 'Zu meinem Bereich',
    quand: 'Wann', duree: 'Dauer', avec: 'Mit', lien: 'Link',
    lienASuivre: 'Den Link zur Videokonferenz erhalten Sie in einer zweiten Nachricht, sobald er bereit ist.',
    empechementTitre: 'Ist etwas dazwischengekommen?',
    empechementLien: 'Umbuchen oder absagen',
    empechementSuite: ' mit einem Klick, ohne erneute Anmeldung.',
    signature: 'Bis bald,<br />Ihr MEGGA Team',
    rejoindre: 'Videokonferenz beitreten',
    confObjet: (q) => `Willkommensgespräch bestätigt · ${q}`,
    confTitre: 'Ihr Willkommensgespräch ist bestätigt',
    confApercu: 'Der Link zur Videokonferenz und die Umbuchung finden Sie in dieser Nachricht.',
    confBonjour: (n) => `Guten Tag ${n},`,
    confIntro: 'Wir gehen gemeinsam Ihre Einrichtung durch, beantworten Ihre Fragen und stimmen MEGGA auf Ihre Arbeitsweise ab.',
    rappelObjet: (q) => `Erinnerung: Willkommensgespräch ${q}`,
    rappelTitre: 'Morgen ist es so weit',
    rappelApercu: 'Der Link zur Videokonferenz ist in dieser Nachricht.',
    rappelCorps: (h, q) => `Kurze Erinnerung: Ihr Willkommensgespräch mit ${h} findet am ${q} statt.`,
    annulObjet: 'Ihr Willkommensgespräch wurde abgesagt',
    annulTitre: 'Ihr Willkommensgespräch wurde abgesagt',
    annulApercu: 'Sie können jederzeit einen neuen Termin buchen.',
    annulCorps: 'Ihr Willkommensgespräch wurde abgesagt. Sie können jederzeit einen neuen Termin in Ihrem MEGGA Bereich buchen.',
    annulCta: 'Neuen Termin buchen',
  },
  en: {
    legal: 'This email is about an appointment you booked with MEGGA. It is not a marketing message, which is why it carries no unsubscribe link.',
    ctaEspace: 'Go to my workspace',
    quand: 'When', duree: 'Duration', avec: 'With', lien: 'Link',
    lienASuivre: 'Your video link will follow in a second message as soon as it is ready.',
    empechementTitre: 'Something came up?',
    empechementLien: 'Reschedule or cancel',
    empechementSuite: ' in one click, no sign-in needed.',
    signature: 'See you soon,<br />The MEGGA team',
    rejoindre: 'Join the video call',
    confObjet: (q) => `Welcome call confirmed · ${q}`,
    confTitre: 'Your welcome call is confirmed',
    confApercu: 'Your video link and reschedule options are in this message.',
    confBonjour: (n) => `Hello ${n},`,
    confIntro: 'We will walk through your setup, answer your questions, and tune MEGGA to the way you work.',
    rappelObjet: (q) => `Reminder: welcome call ${q}`,
    rappelTitre: 'It is tomorrow',
    rappelApercu: 'Your video link is in this message.',
    rappelCorps: (h, q) => `A quick reminder: your welcome call with ${h} takes place ${q}.`,
    annulObjet: 'Your welcome call is cancelled',
    annulTitre: 'Your welcome call is cancelled',
    annulApercu: 'You can book another one whenever it suits you.',
    annulCorps: 'Your welcome call has been cancelled. You can book another one whenever it suits you, from your MEGGA workspace.',
    annulCta: 'Book another slot',
  },
  it: {
    legal: 'Questa e-mail riguarda un appuntamento che ha fissato con MEGGA. Non è una comunicazione commerciale: per questo non contiene alcun link di disiscrizione.',
    ctaEspace: 'Vai al mio spazio',
    quand: 'Quando', duree: 'Durata', avec: 'Con', lien: 'Link',
    lienASuivre: 'Il link per la videoconferenza le arriverà in un secondo messaggio, appena sarà pronto.',
    empechementTitre: 'Un imprevisto?',
    empechementLien: 'Riprogrammi o annulli',
    empechementSuite: ' con un clic, senza doversi riconnettere.',
    signature: 'A presto,<br />Il team MEGGA',
    rejoindre: 'Partecipare alla videoconferenza',
    confObjet: (q) => `Chiamata di benvenuto confermata · ${q}`,
    confTitre: 'La sua chiamata di benvenuto è confermata',
    confApercu: 'Il link per la videoconferenza e la riprogrammazione sono in questo messaggio.',
    confBonjour: (n) => `Buongiorno ${n},`,
    confIntro: 'Faremo il punto sulla sua configurazione, risponderemo alle sue domande e calibreremo MEGGA sul suo modo di lavorare.',
    rappelObjet: (q) => `Promemoria: chiamata di benvenuto ${q}`,
    rappelTitre: 'È domani',
    rappelApercu: 'Il link per la videoconferenza è in questo messaggio.',
    rappelCorps: (h, q) => `Un breve promemoria: la sua chiamata di benvenuto con ${h} si terrà ${q}.`,
    annulObjet: 'La sua chiamata di benvenuto è annullata',
    annulTitre: 'La sua chiamata di benvenuto è annullata',
    annulApercu: 'Può prenotarne un’altra quando preferisce.',
    annulCorps: 'La sua chiamata di benvenuto è stata annullata. Può prenotarne un’altra quando preferisce, dal suo spazio MEGGA.',
    annulCta: 'Prenotare un altro orario',
  },
}

/** Pilule d'en-tête des e-mails client : la même cible, l'étiquette de la langue. */
function headerCta(l: CallLocale) {
  return { href: 'https://app.megga.ch/dashboard', label: T[l].ctaEspace }
}

/** Bloc de faits partagé par la confirmation et le rappel. */
function detailsTable(d: OnboardingCallEmailData): string {
  const t = T[d.locale]
  const when = formatWhen(d.startMs, d.timezone, d.locale)
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
    ${row(t.quand, escapeHtml(when))}
    ${row(t.duree, `${d.durationMinutes} min`)}
    ${row(t.avec, escapeHtml(d.hostName))}
    ${d.meetingUrl ? row(t.lien, `<a href="${escapeHtml(d.meetingUrl)}" style="color:${BRAND};word-break:break-all;">${escapeHtml(d.meetingUrl)}</a>`) : ''}
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
function lienASuivre(l: CallLocale): string {
  return p(T[l].lienASuivre, 0)
}

/** Le bloc « Un empêchement ? » : c'est la ligne la plus utile de l'e-mail. */
function blocReplanifier(d: OnboardingCallEmailData): string {
  const t = T[d.locale]
  return `${h2(t.empechementTitre)}
     <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;font-weight:400;line-height:1.6;color:${BODY_INK};">
       <a href="${escapeHtml(d.manageUrl)}" style="color:${BRAND};">${t.empechementLien}</a>${t.empechementSuite}
     </p>`
}

/** Signature client. « À bientôt » et non « Merci » : on se donne rendez-vous. */
function signature(l: CallLocale): string {
  return `<div style="padding:32px 0 0;">${p(T[l].signature, 0)}</div>`
}

/** E-mail de confirmation, pour l'agence qui vient de réserver. */
export function buildAttendeeEmail(d: OnboardingCallEmailData): { subject: string; html: string } {
  const t = T[d.locale]
  const when = formatWhen(d.startMs, d.timezone, d.locale)

  return {
    // L'ÉTAT avant la marque : un objet se lit tronqué sur mobile, et ce qui compte
    // est que le rendez-vous est acté. Le logo dit qui écrit, dès l'ouverture.
    subject: t.confObjet(when),
    html: shell({
      lang: d.locale,
      title: t.confTitre,
      // N'ajoute rien à l'objet : il dit ce que le message CONTIENT, donc pourquoi le garder.
      preheader: t.confApercu,
      legalNote: t.legal,
      headerCta: headerCta(d.locale),
      bodyHtml: `
     ${p(t.confBonjour(escapeHtml(d.attendeeName)))}
     ${p(t.confIntro, 28)}
     ${detailsTable(d)}
     ${d.meetingUrl
      ? `<div style="margin:0 0 32px;">${button(d.meetingUrl, t.rejoindre)}</div>`
      : `<div style="margin:0 0 32px;">${lienASuivre(d.locale)}</div>`}
     ${blocReplanifier(d)}
     ${signature(d.locale)}`,
    }),
  }
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
    // ⛔ `options[brut]` REMONTE LA CHAÎNE DE PROTOTYPES. `brut` vient du client, et
    // `sanitizeAnswers` ne borne que la forme (chaîne courte), pas le contenu : pour
    // `portfolio: 'constructor'` — ou 'toString', 'valueOf', 'hasOwnProperty' — la
    // recherche rend une FONCTION héritée d'Object.prototype. Le `??` ne la rattrape
    // pas (elle n'est ni null ni undefined) et `escapeHtml` levait sur `.replace`.
    // D'où le test de type plutôt qu'un simple `??`.
    const traduit = q.options?.[brut]
    lignes.push({ label: q.label, value: typeof traduit === 'string' ? traduit : brut })
  }
  for (const [cle, valeur] of Object.entries(answers)) {
    // Même piège, silencieux celui-là : `'toString' in CALIBRAGE` vaut true alors que
    // CALIBRAGE ne déclare pas cette question, et la réponse disparaissait — l'inverse
    // exact de ce que cette boucle promet. `Object.hasOwn` ne regarde que le propre.
    if (Object.hasOwn(CALIBRAGE, cle) || IDENTITE.has(cle) || !valeur) continue
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
  const t = T[d.locale]
  const when = formatWhen(d.startMs, d.timezone, d.locale)

  return {
    subject: t.rappelObjet(when),
    html: shell({
      lang: d.locale,
      title: t.rappelTitre,
      preheader: t.rappelApercu,
      legalNote: t.legal,
      headerCta: headerCta(d.locale),
      bodyHtml: `
       ${p(t.rappelCorps(escapeHtml(d.hostName), escapeHtml(when)), 28)}
       ${d.meetingUrl
        ? `<div style="margin:0 0 32px;">${button(d.meetingUrl, t.rejoindre)}</div>`
        : `<div style="margin:0 0 32px;">${lienASuivre(d.locale)}</div>`}
       ${blocReplanifier(d)}
       ${signature(d.locale)}`,
    }),
  }
}

/**
 * Confirmation d'ANNULATION, pour l'agence.
 *
 * ⛔ Ce message était composé À LA MAIN dans `onboarding-call-manage` : un `<p>` nu en
 * Helvetica, hors coquille, donc le seul e-mail client de MEGGA qui n'avait ni logo, ni
 * pied, ni mention légale. Il portait en plus son texte SANS ACCENTS (« annule »,
 * « ete », « reserver ») et ne connaissait que le français et l'anglais.
 *
 * La porte `lint:email-shell` ne l'avait pas vu : elle cherche des documents complets
 * (`<!DOCTYPE`), et un fragment de HTML passe dessous. C'est la limite connue de cette
 * porte, et la raison pour laquelle un e-mail se compose ICI et jamais chez l'appelant.
 */
export function buildCancellationEmail(d: OnboardingCallEmailData): { subject: string; html: string } {
  const t = T[d.locale]
  return {
    subject: t.annulObjet,
    html: shell({
      lang: d.locale,
      title: t.annulTitre,
      preheader: t.annulApercu,
      legalNote: t.legal,
      headerCta: headerCta(d.locale),
      bodyHtml: `
     ${p(t.confBonjour(escapeHtml(d.attendeeName)))}
     ${p(t.annulCorps, 32)}
     <div style="margin:0 0 8px;">${button('https://app.megga.ch/dashboard', t.annulCta)}</div>
     ${signature(d.locale)}`,
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
