// supabase/functions/_shared/visit-email.ts
//
// Les trois courriels d'une visite de bien : confirmation à l'acheteur, notification à
// l'agent, rappel de la veille.
//
// Sorti de `send-visit-email/index.ts` le 15.08.2026. Pur, donc testable et visible au
// banc de rendu — ce qui compte d'autant plus ici que la migration corrige TROIS défauts
// réels, dont deux invisibles à la relecture :
//
//   1. ⛔ LA DATE ET L'HEURE ÉTAIENT FAUSSES. L'ancien gabarit lisait `getHours()`,
//      `getDate()`, `getMonth()` et `getDay()` du runtime — donc UTC en edge function.
//      Une visite à 14:00 à Genève s'annonçait à 12:00 (13:00 l'hiver), et une visite en
//      soirée changeait carrément de JOUR : 00:30 à Genève, c'est 22:30 UTC la veille.
//      C'est le défaut exact qui avait fait naître `booking-email` ; il vivait encore ici.
//   2. ⛔ RIEN N'ÉTAIT ÉCHAPPÉ. Titre du bien, nom, téléphone, pré-qualification, et
//      surtout `buyer_message` : du TEXTE LIBRE saisi par un visiteur du site public.
//      C'est le champ le plus exposé de tous les e-mails du dépôt.
//   3. Les objets portaient un tiret cadratin, interdit par la règle maison.
//
// ⚠ FUSEAU : `Europe/Zurich`, en dur et assumé. Le produit sert les 26 cantons, qui
// partagent un seul fuseau ; `visits` ne porte aucune colonne de fuseau, et inventer un
// réglage pour une valeur constante compliquerait sans rien corriger. À revoir le jour
// d'une ouverture hors de Suisse — c'est écrit dans l'audit France.

import { INK, MUTED, FONT, escapeHtml, shell, p, h2, row, button, note } from './email-shell.ts'
import { appDashboardUrl } from './app-url.ts'
import type { AppLocale } from './recipient-language.ts'

const FUSEAU = 'Europe/Zurich'

/**
 * L'étiquette Intl par langue.
 *
 * ⚠ `en-GB` et non `en-CH` : les deux rendent la même date longue, mais `en-CH` hérite du
 * séparateur de milliers suisse en apostrophe TYPOGRAPHIQUE, qui reviendrait mordre le jour
 * où l'étiquette servirait à formater un nombre. Surtout pas `en-US`, qui rendrait
 * « August 17, 2026 » et « 02:00 PM ». Même table que `booking-email.ts`.
 */
const INTL_TAG: Record<AppLocale, string> = {
  fr: 'fr-CH', de: 'de-CH', en: 'en-GB', it: 'it-CH',
}

/**
 * « lundi, 17 août 2026 » dans le fuseau suisse, jamais dans celui du serveur.
 *
 * ⛔ LE FUSEAU EST UN ARGUMENT SÉPARÉ DE LA LANGUE, et ne doit JAMAIS en être dérivé : un
 * germanophone à Zurich n'est pas à `Europe/Berlin`. C'est ici que vivait le défaut du
 * 15.08.2026 (`getHours()` du runtime, donc UTC) : mesuré, une visite à 00:30 à Genève
 * s'annonçait « lundi 22:30 » au lieu de « mardi 00:30 » — le JOUR changeait.
 */
export function formatVisitDate(iso: string, locale: AppLocale = 'fr'): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    timeZone: FUSEAU, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(new Date(iso))
}

/** « 14:00 » dans le fuseau suisse. 24 h dans les quatre langues (`hour12: false`). */
export function formatVisitTime(iso: string, locale: AppLocale = 'fr'): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], {
    timeZone: FUSEAU, hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(iso))
}

export type VisitEmailKind = 'confirmation_buyer' | 'notification_agent' | 'reminder'

export interface VisitEmailInput {
  kind: VisitEmailKind
  /** ISO de `visits.scheduled_at`. Formaté ici, jamais par l'appelant. */
  scheduledAt: string
  propertyTitle: string
  propertyAddress: string
  isVideo: boolean
  /** « Google Meet » ou « FaceTime ». */
  videoLabel: string
  videoLink: string | null
  manageUrl: string
  /** Acheteur : confirmation et rappel. */
  buyerName: string | null
  /** Agent : notification seule. */
  agentName?: string | null
  buyerEmail?: string | null
  buyerPhone?: string | null
  buyerMessage?: string | null
  /** Pré-qualification, déjà mise en phrase par l'appelant. */
  qualification?: string | null
  /**
   * ⚠ DEUX POPULATIONS SELON `kind`, et les confondre écrit au client dans la langue de
   * son courtier : `notification_agent` s'adresse à l'AGENT (`profiles.language`), les
   * deux autres à l'ACHETEUR (`contacts.language`). Défaut : français.
   */
  locale?: AppLocale
}

/**
 * Toute la copie, par langue.
 *
 * `Record<AppLocale, …>` et non un objet libre : c'est lui qui fait échouer la compilation
 * quand une langue manque. Les libellés de tableau restent d'un ou deux mots, la colonne
 * étant étroite.
 */
const T: Record<AppLocale, {
  objetAgent: string
  titreAgentVisio: (label: string) => string
  titreAgent: string
  ctaAgent: string
  salutation: (nom: string | null | undefined) => string
  phraseAgent: string
  lBien: string
  lAdresse: string
  lMode: string
  lSouhaite: string
  lContact: string
  lQualification: string
  lMessageVisiteur: string
  phraseCalendrier: string
  titreRappel: string
  titreVisio: string
  titreConfirme: string
  objetRappel: string
  objetConfirme: string
  apercuRappel: string
  apercuConfirme: string
  legal: string
  phraseRappel: string
  phraseConfirme: (bien: string) => string
  lQuand: string
  demainA: (heure: string) => string
  dateEtHeure: (date: string, heure: string) => string
  lienAVenir: (label: string) => string
  boutonVisio: string
  empechement: string
  lienDeplacer: string
  suiteDeplacer: string
  rappelVeille: string
}> = {
  fr: {
    objetAgent: 'Nouvelle demande de visite',
    titreAgentVisio: (l) => `Nouvelle visite vidéo (${l})`,
    titreAgent: 'Nouvelle demande de visite',
    ctaAgent: 'Ouvrir mon espace',
    salutation: (n) => (n ? `Bonjour ${escapeHtml(n)},` : 'Bonjour,'),
    phraseAgent: 'Une nouvelle demande de visite a été reçue via le site.',
    lBien: 'Bien',
    lAdresse: 'Adresse',
    lMode: 'Mode',
    lSouhaite: 'Souhaité',
    lContact: 'Contact',
    lQualification: 'Qualification',
    lMessageVisiteur: 'Message du visiteur',
    phraseCalendrier: 'La visite apparaît dans votre calendrier MEGGA.',
    titreRappel: 'Votre visite a lieu demain',
    titreVisio: 'Votre visite vidéo est confirmée',
    titreConfirme: 'Votre visite est confirmée',
    objetRappel: 'Visite demain',
    objetConfirme: 'Visite confirmée',
    apercuRappel: 'L’heure et l’adresse sont dans ce message.',
    apercuConfirme: 'Le détail de votre visite, et de quoi la déplacer si besoin.',
    legal: 'Cet e-mail concerne une visite que vous avez demandée. Il ne s’agit pas d’une '
      + 'communication marketing : c’est pourquoi il ne contient pas de lien de désinscription.',
    phraseRappel: 'Petit rappel : votre visite a lieu demain.',
    phraseConfirme: (b) => `Votre demande de visite pour <strong style="color:${INK};">${b}</strong> a bien été enregistrée.`,
    lQuand: 'Quand',
    demainA: (h) => `Demain à ${h}`,
    dateEtHeure: (d, h) => `${d} à ${h}`,
    lienAVenir: (l) => `${l}, lien à venir`,
    boutonVisio: 'Rejoindre la visite vidéo',
    empechement: 'Un empêchement ?',
    lienDeplacer: 'Déplacez ou annulez cette visite',
    suiteDeplacer: ' en un clic, sans avoir à vous connecter.',
    rappelVeille: 'Vous recevrez un rappel la veille.',
  },

  // Allemand de SUISSE : « ss », jamais d'eszett. « Besichtigung » et non « Besuch », qui
  // désigne une visite de courtoisie et non la visite d'un bien.
  de: {
    objetAgent: 'Neue Besichtigungsanfrage',
    titreAgentVisio: (l) => `Neue Videobesichtigung (${l})`,
    titreAgent: 'Neue Besichtigungsanfrage',
    ctaAgent: 'Meinen Bereich öffnen',
    salutation: (n) => (n ? `Guten Tag ${escapeHtml(n)},` : 'Guten Tag,'),
    phraseAgent: 'Über die Website ist eine neue Besichtigungsanfrage eingegangen.',
    lBien: 'Immobilie',
    lAdresse: 'Adresse',
    lMode: 'Art',
    lSouhaite: 'Wunschtermin',
    lContact: 'Kontakt',
    lQualification: 'Qualifizierung',
    lMessageVisiteur: 'Nachricht des Interessenten',
    phraseCalendrier: 'Die Besichtigung erscheint in Ihrem MEGGA-Kalender.',
    titreRappel: 'Ihre Besichtigung findet morgen statt',
    titreVisio: 'Ihre Videobesichtigung ist bestätigt',
    titreConfirme: 'Ihre Besichtigung ist bestätigt',
    objetRappel: 'Besichtigung morgen',
    objetConfirme: 'Besichtigung bestätigt',
    apercuRappel: 'Uhrzeit und Adresse stehen in dieser Nachricht.',
    apercuConfirme: 'Die Details Ihrer Besichtigung und die Möglichkeit, sie bei Bedarf zu verschieben.',
    legal: 'Diese E-Mail betrifft eine von Ihnen angefragte Besichtigung. Es handelt sich nicht '
      + 'um eine Marketingmitteilung: Deshalb enthält sie keinen Abmeldelink.',
    phraseRappel: 'Kurze Erinnerung: Ihre Besichtigung findet morgen statt.',
    phraseConfirme: (b) => `Ihre Besichtigungsanfrage für <strong style="color:${INK};">${b}</strong> wurde registriert.`,
    lQuand: 'Wann',
    demainA: (h) => `Morgen um ${h}`,
    dateEtHeure: (d, h) => `${d} um ${h}`,
    lienAVenir: (l) => `${l}, Link folgt`,
    boutonVisio: 'An der Videobesichtigung teilnehmen',
    empechement: 'Verhindert?',
    lienDeplacer: 'Verschieben oder annullieren Sie diese Besichtigung',
    suiteDeplacer: ' mit einem Klick, ohne sich anmelden zu müssen.',
    rappelVeille: 'Sie erhalten am Vortag eine Erinnerung.',
  },

  en: {
    objetAgent: 'New viewing request',
    titreAgentVisio: (l) => `New video viewing (${l})`,
    titreAgent: 'New viewing request',
    ctaAgent: 'Open my workspace',
    salutation: (n) => (n ? `Hello ${escapeHtml(n)},` : 'Hello,'),
    phraseAgent: 'A new viewing request was received via the website.',
    lBien: 'Property',
    lAdresse: 'Address',
    lMode: 'Mode',
    lSouhaite: 'Preferred',
    lContact: 'Contact',
    lQualification: 'Qualification',
    lMessageVisiteur: 'Visitor message',
    phraseCalendrier: 'The viewing appears in your MEGGA calendar.',
    titreRappel: 'Your viewing is tomorrow',
    titreVisio: 'Your video viewing is confirmed',
    titreConfirme: 'Your viewing is confirmed',
    objetRappel: 'Viewing tomorrow',
    objetConfirme: 'Viewing confirmed',
    apercuRappel: 'The time and the address are in this message.',
    apercuConfirme: 'Your viewing details, and a way to reschedule it if needed.',
    legal: 'This email concerns a viewing you requested. It is not a marketing communication, '
      + 'which is why it contains no unsubscribe link.',
    phraseRappel: 'A quick reminder: your viewing is tomorrow.',
    phraseConfirme: (b) => `Your viewing request for <strong style="color:${INK};">${b}</strong> has been registered.`,
    lQuand: 'When',
    demainA: (h) => `Tomorrow at ${h}`,
    dateEtHeure: (d, h) => `${d} at ${h}`,
    lienAVenir: (l) => `${l}, link to follow`,
    boutonVisio: 'Join the video viewing',
    empechement: 'Something came up?',
    lienDeplacer: 'Reschedule or cancel this viewing',
    suiteDeplacer: ' in one click, without having to log in.',
    rappelVeille: 'You will receive a reminder the day before.',
  },

  // Italien : forme de courtoisie « Lei » (Suo/Sua/Le), jamais le tutoiement.
  it: {
    objetAgent: 'Nuova richiesta di visita',
    titreAgentVisio: (l) => `Nuova visita video (${l})`,
    titreAgent: 'Nuova richiesta di visita',
    ctaAgent: 'Apra il mio spazio',
    salutation: (n) => (n ? `Buongiorno ${escapeHtml(n)},` : 'Buongiorno,'),
    phraseAgent: 'È stata ricevuta una nuova richiesta di visita tramite il sito.',
    lBien: 'Immobile',
    lAdresse: 'Indirizzo',
    lMode: 'Modalità',
    lSouhaite: 'Desiderato',
    lContact: 'Contatto',
    lQualification: 'Qualificazione',
    lMessageVisiteur: 'Messaggio del visitatore',
    phraseCalendrier: 'La visita compare nel Suo calendario MEGGA.',
    titreRappel: 'La Sua visita si svolge domani',
    titreVisio: 'La Sua visita video è confermata',
    titreConfirme: 'La Sua visita è confermata',
    objetRappel: 'Visita domani',
    objetConfirme: 'Visita confermata',
    apercuRappel: 'L’orario e l’indirizzo sono in questo messaggio.',
    apercuConfirme: 'Il dettaglio della Sua visita e come spostarla, se necessario.',
    legal: 'Questa e-mail riguarda una visita da Lei richiesta. Non si tratta di una '
      + 'comunicazione di marketing: per questo non contiene un link di disiscrizione.',
    phraseRappel: 'Un breve promemoria: la Sua visita si svolge domani.',
    phraseConfirme: (b) => `La Sua richiesta di visita per <strong style="color:${INK};">${b}</strong> è stata registrata correttamente.`,
    lQuand: 'Quando',
    demainA: (h) => `Domani alle ${h}`,
    dateEtHeure: (d, h) => `${d} alle ${h}`,
    lienAVenir: (l) => `${l}, link in arrivo`,
    boutonVisio: 'Partecipi alla visita video',
    empechement: 'Un imprevisto?',
    lienDeplacer: 'Sposti o annulli questa visita',
    suiteDeplacer: ' con un clic, senza dover effettuare l’accesso.',
    rappelVeille: 'Riceverà un promemoria il giorno prima.',
  },
}

/** Le lieu, ou le mode quand la visite est à distance. */
function ligneLieu(i: VisitEmailInput, t: (typeof T)[AppLocale]): string {
  if (!i.isVideo) return row(t.lAdresse, escapeHtml(i.propertyAddress))
  return row(t.lMode, i.videoLink
    ? `${escapeHtml(i.videoLabel)}`
    : escapeHtml(t.lienAVenir(i.videoLabel)))
}

export function buildVisitEmail(i: VisitEmailInput): { subject: string; html: string } {
  const l = i.locale ?? 'fr'
  const t = T[l]
  const date = formatVisitDate(i.scheduledAt, l)
  const heure = formatVisitTime(i.scheduledAt, l)
  const bien = escapeHtml(i.propertyTitle)

  if (i.kind === 'notification_agent') {
    // Notification de TRAVAIL à l'agent, qui a un compte : pilule utile, aucune mention
    // légale — elle parle de son activité, pas d'une sollicitation qu'il pourrait refuser.
    return {
      subject: `${t.objetAgent} · ${i.propertyTitle}`,
      html: shell({
        lang: l,
        title: i.isVideo ? t.titreAgentVisio(i.videoLabel) : t.titreAgent,
        preheader: `${i.propertyTitle} · ${t.dateEtHeure(date, heure)}`,
        legalNote: null,
        headerCta: { href: appDashboardUrl(), label: t.ctaAgent },
        bodyHtml: `
     ${p(t.salutation(i.agentName))}
     ${p(t.phraseAgent, 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row(t.lBien, bien)}
       ${row(t.lAdresse, escapeHtml(i.propertyAddress))}
       ${i.isVideo ? row(t.lMode, escapeHtml(i.videoLabel)) : ''}
       ${row(t.lSouhaite, escapeHtml(t.dateEtHeure(date, heure)))}
       ${row(t.lContact, [
          escapeHtml(i.buyerName ?? '—'),
          i.buyerEmail ? `<a href="mailto:${escapeHtml(i.buyerEmail)}" style="color:${MUTED};">${escapeHtml(i.buyerEmail)}</a>` : '',
          escapeHtml(i.buyerPhone ?? ''),
        ].filter(Boolean).join('<br />'))}
       ${i.qualification ? row(t.lQualification, escapeHtml(i.qualification)) : ''}
     </table>
     ${i.buyerMessage ? note(t.lMessageVisiteur, escapeHtml(i.buyerMessage)) : ''}
     ${p(t.phraseCalendrier, 0)}`,
      }),
    }
  }

  const rappel = i.kind === 'reminder'
  const titre = rappel
    ? t.titreRappel
    : i.isVideo ? t.titreVisio : t.titreConfirme

  return {
    // L'ÉTAT avant le bien : un objet se lit tronqué, et ce qui compte est que la visite
    // est actée (ou imminente). Le bien suit, comme repère.
    subject: `${rappel ? t.objetRappel : t.objetConfirme} · ${i.propertyTitle}`,
    html: shell({
      lang: l,
      title: titre,
      preheader: rappel ? t.apercuRappel : t.apercuConfirme,
      legalNote: t.legal,
      headerCta: null,
      bodyHtml: `
     ${p(t.salutation(i.buyerName))}
     ${p(rappel ? t.phraseRappel : t.phraseConfirme(bien), 28)}
     <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:0 0 28px;">
       ${row(t.lBien, bien)}
       ${row(t.lQuand, escapeHtml(rappel ? t.demainA(heure) : t.dateEtHeure(date, heure)))}
       ${ligneLieu(i, t)}
     </table>
     ${i.isVideo && i.videoLink
        ? `<div style="margin:0 0 28px;">${button(i.videoLink, t.boutonVisio)}</div>`
        : ''}
     ${h2(t.empechement)}
     <p style="margin:0 0 24px;font-family:${FONT};font-size:15px;font-weight:400;line-height:1.6;color:${MUTED};">
       <a href="${escapeHtml(i.manageUrl)}" style="color:${INK};">${escapeHtml(t.lienDeplacer)}</a>${escapeHtml(t.suiteDeplacer)}
     </p>
     ${!rappel ? p(t.rappelVeille, 0) : ''}`,
    }),
  }
}
