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

import {
  BRAND, BODY_INK, INK, FONT,
  escapeHtml, shell, p as p_, h2, row, button,
} from './email-shell.ts'

import type { AppLocale } from './recipient-language.ts'

const RESEND_URL = 'https://api.resend.com/emails'
const FROM = 'MEGGA <noreply@megga.ch>'

export type BookingEmailKind = 'confirmed' | 'rescheduled' | 'cancelled'

/**
 * Tout le texte, dans les quatre langues du produit (16.08.2026).
 *
 * ⚠ LE DESTINATAIRE EST UN CONTACT DE L'AGENCE, pas un agent : sa langue vient de
 * `contacts.language`, jamais de `profiles.language`. Deux colonnes, deux populations ;
 * les confondre écrirait au client dans la langue de son courtier.
 *
 * ⛔ LA MENTION LÉGALE N'ATTRIBUE LA PRISE DE RENDEZ-VOUS À PERSONNE. Le français dit
 * « un rendez-vous PRIS avec votre agence » — participe sans agent. Une première
 * traduction allemande disait « den SIE vereinbart HABEN », affirmant que le destinataire
 * l'avait fixé lui-même : c'est faux pour quelqu'un convoqué par son agence, et une
 * mention légale qui se trompe sur la raison de l'envoi ne vaut rien. La forme passive
 * (« der vereinbart wurde ») est la traduction fidèle.
 */
const INTL_TAG: Record<AppLocale, string> = {
  fr: 'fr-CH', de: 'de-CH', en: 'en-GB', it: 'it-CH',
}

const T: Record<AppLocale, {
  suffixeObjet: Record<BookingEmailKind, string>
  titre: Record<BookingEmailKind, string>
  apercu: Record<BookingEmailKind, string>
  introConfirme: string
  introDeplace: string
  ligneQuand: string
  ligneComment: string
  ligneOu: string
  ligneAvec: string
  modeVisio: string
  modeVisioSansLien: string
  modeSurPlace: string
  ctaRejoindreVisio: string
  titreEmpechement: string
  lienEmpechement: string
  suiteEmpechement: string
  fallbackConseiller: string
  legal: string
}> = {
  fr: {
    suffixeObjet: {
      confirmed: 'rendez-vous de vérification confirmé',
      rescheduled: 'rendez-vous de vérification déplacé',
      cancelled: 'rendez-vous de vérification annulé',
    },
    titre: {
      confirmed: 'Votre rendez-vous de vérification est confirmé',
      rescheduled: 'Votre rendez-vous a été déplacé',
      cancelled: 'Votre rendez-vous a été annulé',
    },
    apercu: {
      confirmed: 'Le détail de votre rendez-vous : quand, comment et avec qui.',
      rescheduled: 'La nouvelle date est dans ce message.',
      cancelled: 'Aucune démarche de votre part n’est nécessaire.',
    },
    introConfirme: 'Votre rendez-vous de vérification d’identité est confirmé. Voici les informations à retenir.',
    introDeplace: 'Votre rendez-vous de vérification d’identité a été déplacé. Voici les nouvelles informations.',
    ligneQuand: 'Quand',
    ligneComment: 'Comment',
    ligneOu: 'Où',
    ligneAvec: 'Avec',
    modeVisio: 'En visioconférence',
    modeVisioSansLien: 'En visioconférence, lien à venir',
    modeSurPlace: 'Sur place',
    ctaRejoindreVisio: 'Rejoindre la visioconférence',
    titreEmpechement: 'Un empêchement ?',
    lienEmpechement: 'Déplacez ou annulez ce rendez-vous',
    suiteEmpechement: ' en un clic, sans avoir à vous connecter.',
    fallbackConseiller: 'votre conseiller',
    legal: 'Cet e-mail concerne un rendez-vous de vérification d’identité pris avec votre agence. Il ne s’agit pas d’une communication marketing : c’est pourquoi il ne contient pas de lien de désinscription.',
  },
  de: {
    suffixeObjet: {
      confirmed: 'Termin zur Identitätsprüfung bestätigt',
      rescheduled: 'Termin zur Identitätsprüfung verschoben',
      cancelled: 'Termin zur Identitätsprüfung abgesagt',
    },
    titre: {
      confirmed: 'Ihr Termin zur Identitätsprüfung ist bestätigt',
      rescheduled: 'Ihr Termin wurde verschoben',
      cancelled: 'Ihr Termin wurde abgesagt',
    },
    apercu: {
      confirmed: 'Die Details Ihres Termins: wann, wie und mit wem.',
      rescheduled: 'Der neue Termin steht in dieser Nachricht.',
      cancelled: 'Sie müssen nichts weiter unternehmen.',
    },
    introConfirme: 'Ihr Termin zur Identitätsprüfung ist bestätigt. Hier die wichtigsten Angaben.',
    introDeplace: 'Ihr Termin zur Identitätsprüfung wurde verschoben. Hier die neuen Angaben.',
    ligneQuand: 'Wann',
    ligneComment: 'Wie',
    ligneOu: 'Wo',
    ligneAvec: 'Mit',
    modeVisio: 'Per Videokonferenz',
    modeVisioSansLien: 'Per Videokonferenz, Link folgt',
    modeSurPlace: 'Vor Ort',
    ctaRejoindreVisio: 'An der Videokonferenz teilnehmen',
    titreEmpechement: 'Ist etwas dazwischengekommen?',
    lienEmpechement: 'Diesen Termin verschieben oder absagen',
    suiteEmpechement: ' mit einem Klick, ohne Anmeldung.',
    fallbackConseiller: 'Ihre Beraterin oder Ihr Berater',
    legal: 'Diese E-Mail betrifft einen Termin zur Identitätsprüfung, der mit Ihrer Agentur vereinbart wurde. Es handelt sich nicht um eine Werbenachricht, deshalb enthält sie keinen Abmeldelink.',
  },
  en: {
    suffixeObjet: {
      confirmed: 'identity check appointment confirmed',
      rescheduled: 'identity check appointment moved',
      cancelled: 'identity check appointment cancelled',
    },
    titre: {
      confirmed: 'Your identity check appointment is confirmed',
      rescheduled: 'Your appointment has been moved',
      cancelled: 'Your appointment has been cancelled',
    },
    apercu: {
      confirmed: 'The details of your appointment: when, how and with whom.',
      rescheduled: 'The new date is in this message.',
      cancelled: 'No action is needed on your part.',
    },
    introConfirme: 'Your identity check appointment is confirmed. Here are the details to keep in mind.',
    introDeplace: 'Your identity check appointment has been moved. Here are the new details.',
    ligneQuand: 'When',
    ligneComment: 'How',
    ligneOu: 'Where',
    ligneAvec: 'With',
    modeVisio: 'By video call',
    modeVisioSansLien: 'By video call, link to follow',
    modeSurPlace: 'In person',
    ctaRejoindreVisio: 'Join the video call',
    titreEmpechement: 'Something came up?',
    lienEmpechement: 'Move or cancel this appointment',
    suiteEmpechement: ' in one click, no sign-in needed.',
    fallbackConseiller: 'your adviser',
    legal: 'This email is about an identity check appointment booked with your agency. It is not a marketing message, which is why it carries no unsubscribe link.',
  },
  it: {
    suffixeObjet: {
      confirmed: 'appuntamento di verifica d\'identità confermato',
      rescheduled: 'appuntamento di verifica d\'identità spostato',
      cancelled: 'appuntamento di verifica d\'identità annullato',
    },
    titre: {
      confirmed: 'Il suo appuntamento di verifica d\'identità è confermato',
      rescheduled: 'Il suo appuntamento è stato spostato',
      cancelled: 'Il suo appuntamento è stato annullato',
    },
    apercu: {
      confirmed: 'I dettagli del suo appuntamento: quando, come e con chi.',
      rescheduled: 'La nuova data è in questo messaggio.',
      cancelled: 'Non è necessaria alcuna azione da parte sua.',
    },
    introConfirme: 'Il suo appuntamento di verifica d\'identità è confermato. Ecco le informazioni da tenere presenti.',
    introDeplace: 'Il suo appuntamento di verifica d\'identità è stato spostato. Ecco le nuove informazioni.',
    ligneQuand: 'Quando',
    ligneComment: 'Come',
    ligneOu: 'Dove',
    ligneAvec: 'Con',
    modeVisio: 'In videoconferenza',
    modeVisioSansLien: 'In videoconferenza, link in arrivo',
    modeSurPlace: 'Di persona',
    ctaRejoindreVisio: 'Partecipare alla videoconferenza',
    titreEmpechement: 'Un imprevisto?',
    lienEmpechement: 'Sposti o annulli questo appuntamento',
    suiteEmpechement: ' con un clic, senza doversi connettere.',
    fallbackConseiller: 'il suo consulente',
    legal: 'Questa e-mail riguarda un appuntamento di verifica d\'identità fissato con la sua agenzia. Non è una comunicazione commerciale: per questo non contiene alcun link di disiscrizione.',
  },
}

/** Phrases portant du HTML ou une salutation : gardées à part de la table plate. */
const T2: Record<AppLocale, {
  annuleDate: (quand: string) => string
  annuleSuite: (qui: string, agence: string) => string
  salutation: (nom: string) => string
  signature: string
}> = {
  fr: {
    annuleDate: (q) => `Votre rendez-vous de vérification d’identité du <strong style="color:${INK};">${q}</strong> a bien été annulé.`,
    annuleSuite: (qui, ag) => `Pour en fixer un nouveau, contactez ${qui} chez ${ag}.`,
    salutation: (n) => (n ? `Bonjour ${n},` : 'Bonjour,'),
    signature: 'À bientôt,<br />L’équipe MEGGA',
  },
  de: {
    annuleDate: (q) => `Ihr Termin zur Identitätsprüfung vom <strong style="color:${INK};">${q}</strong> wurde abgesagt.`,
    annuleSuite: (qui, ag) => `Um einen neuen zu vereinbaren, wenden Sie sich an ${qui} bei ${ag}.`,
    salutation: (n) => (n ? `Guten Tag ${n},` : 'Guten Tag,'),
    signature: 'Bis bald,<br />Ihr MEGGA Team',
  },
  en: {
    annuleDate: (q) => `Your identity verification appointment on <strong style="color:${INK};">${q}</strong> has been cancelled.`,
    annuleSuite: (qui, ag) => `To arrange a new one, contact ${qui} at ${ag}.`,
    salutation: (n) => (n ? `Hello ${n},` : 'Hello,'),
    signature: 'See you soon,<br />The MEGGA team',
  },
  it: {
    annuleDate: (q) => `Il Suo appuntamento di verifica d’identità del <strong style="color:${INK};">${q}</strong> è stato annullato.`,
    annuleSuite: (qui, ag) => `Per fissarne uno nuovo, contatti ${qui} presso ${ag}.`,
    salutation: (n) => (n ? `Buongiorno ${n},` : 'Buongiorno,'),
    signature: 'A presto,<br />Il team MEGGA',
  },
}

export interface BookingEmailParams {
  /** Langue du CONTACT (contacts.language), jamais celle de l'agent. Défaut : français. */
  locale?: AppLocale
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
/** ⚠ Renommée de `formatFr` le 16.08.2026 : elle ne rend plus du français seul. */
function formatWhen(iso: string, timeZone: string, locale: AppLocale): string {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat(INTL_TAG[locale], {
    timeZone, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(d)
  const time = new Intl.DateTimeFormat(INTL_TAG[locale], {
    timeZone, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(d)
  return `${date} à ${time}`
}

/** Neutralise le HTML : ces valeurs viennent de la base et finissent dans un e-mail. */
const esc = escapeHtml

/**
 * Compose sujet et corps. PUR — d'où sa séparation d'avec `sendBookingEmail` : le banc
 * de rendu (`npm run email:preview`) l'importe pour montrer les trois cas sans réseau, ce
 * que l'ancienne version, dont la coquille était privée, rendait impossible.
 *
 * ARCHITECTURE, ET NON SEULEMENT COULEURS (refonte du 15.08.2026). L'ancienne version
 * empilait cinq paragraphes de prose : la date, le lieu, la consigne de pièce d'identité
 * et le lien de report s'y lisaient au même niveau, donc aucun ne se voyait. Ici :
 *   · les FAITS passent en tableau (quand, comment, avec) — c'est ce qu'on relit la veille ;
 *   · l'action devient un BOUTON, plus un lien noyé dans une phrase.
 *
 * ⛔ AUCUNE MENTION DE LA PIÈCE D'IDENTITÉ — décision de Julien, 15.08.2026. Le client la
 * DÉPOSE par le lien magique (`kyc_magic_link_uploads`, extraction avant réservation) et
 * **la vérification est faite en amont** : quand ce message part, il n'y a plus rien à
 * apporter. La demander reviendrait à redemander ce qui est déjà fourni, ce qui inquiète
 * sans rien obtenir.
 *
 * L'ancienne version portait « Merci de vous munir de la pièce d'identité que vous avez
 * transmise » ; une refonte de ce même jour avait aggravé la chose en « la séance ne peut
 * pas se tenir sans elle », conséquence qu'aucun processus ne garantissait. Les deux sont
 * parties. Un test interdit toute réapparition : ne pas la réintroduire sans que le
 * processus de vérification ait changé, et par écrit.
 *
 * ⚠ AUCUNE PILULE D'EN-TÊTE (`headerCta: null`), contrairement aux e-mails d'agence : le
 * destinataire est le CLIENT d'une agence, il n'a pas de compte MEGGA. Lui proposer
 * « Ouvrir mon espace » l'enverrait sur une porte qui ne s'ouvre pas pour lui.
 */
export function buildBookingEmail(p: BookingEmailParams): { subject: string; html: string } {
  const l = p.locale ?? 'fr'
  const t = T[l]
  const t2 = T2[l]
  const when = formatWhen(p.startIso, p.timeZone, l)
  const who = p.agentName ? esc(p.agentName) : t.fallbackConseiller
  const agency = p.agencyName ? esc(p.agencyName) : 'MEGGA'
  const salutation = t2.salutation(p.contactName ? esc(p.contactName) : '')

  // Le nom de L'AGENCE ouvre l'objet, jamais MEGGA : le destinataire connaît son agence,
  // pas l'outil qu'elle utilise. Un objet qui s'annonce au nom d'un tiers inconnu se lit
  // comme un message non sollicité.
  const objet = `${p.agencyName ?? 'MEGGA'} · ${t.suffixeObjet[p.kind]}`

  // Une annulation n'a ni faits à relire, ni consigne, ni action : ce qui reste est de
  // savoir quoi faire ensuite, et cela tient en une phrase.
  if (p.kind === 'cancelled') {
    return {
      subject: objet,
      html: shell({
        lang: l,
        title: t.titre.cancelled,
        preheader: t.apercu.cancelled,
        legalNote: t.legal,
        headerCta: null,
        bodyHtml: `
     ${p_(salutation)}
     ${p_(t2.annuleDate(when), 28)}
     ${p_(t2.annuleSuite(who, agency), 0)}
     ${signature(l)}`,
      }),
    }
  }

  const modeLigne = p.mode === 'video'
    ? (p.videoLink ? t.modeVisio : t.modeVisioSansLien)
    : (p.location ? esc(p.location) : t.modeSurPlace)

  return {
    subject: objet,
    html: shell({
      lang: l,
      title: t.titre[p.kind],
      preheader: t.apercu[p.kind],
      legalNote: t.legal,
      headerCta: null,
      bodyHtml: `
     ${p_(salutation)}
     ${p_(p.kind === 'rescheduled' ? t.introDeplace : t.introConfirme, 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row(t.ligneQuand, esc(when))}
       ${row(p.mode === 'video' ? t.ligneComment : t.ligneOu, modeLigne)}
       ${row(t.ligneAvec, `${who} · ${agency}`)}
     </table>
     ${p.mode === 'video' && p.videoLink
        ? `<div style="margin:0 0 32px;">${button(p.videoLink, t.ctaRejoindreVisio)}</div>`
        : ''}
     ${p.manageUrl
        ? `${h2(t.titreEmpechement)}
     <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;font-weight:400;line-height:1.6;color:${BODY_INK};">
       <a href="${esc(p.manageUrl)}" style="color:${BRAND};">${t.lienEmpechement}</a>${t.suiteEmpechement}
     </p>`
        : ''}
     ${signature(l)}`,
    }),
  }
}

/**
 * Signature : MEGGA est l'outil, la relation appartient à l'agence.
 *
 * ⚠ La mention de pied a rejoint la table `T` (champ `legal`) : elle doit suivre la
 * langue du destinataire comme le reste, et une constante ne le pouvait pas.
 */
function signature(l: AppLocale): string {
  return `<div style="padding:32px 0 0;">${p_(T2[l].signature, 0)}</div>`
}

/**
 * Envoie le courriel correspondant. Renvoie `false` sur échec — l'appelant
 * n'en fait rien d'autre que le journaliser : la réservation prime.
 */
export async function sendBookingEmail(p: BookingEmailParams): Promise<boolean> {
  const apiKey = Deno.env.get('RESEND_API_KEY')
  if (!apiKey || !p.to) return false

  const { subject, html } = buildBookingEmail(p)

  try {
    const res = await fetch(RESEND_URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: p.to, subject, html }),
    })
    return res.ok
  } catch {
    return false
  }
}
