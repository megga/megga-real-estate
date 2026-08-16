// L'information préalable de l'invitation `click_to_wa`, en quatre langues.
//
// ⚠ CE TEXTE EST LA PIÈCE JURIDIQUE DU DISPOSITIF, pas une formule de politesse.
// L'art. 6 al. 6 nLPD ne reconnaît un consentement que s'il suit une information PRÉALABLE
// et ADÉQUATE. C'est ce texte, archivé mot pour mot dans `whatsapp_optin_invites.shown_text`
// puis recopié dans la preuve du registre, qui décide si l'opt-in obtenu vaut quelque chose.
// Le raccourcir, c'est affaiblir tout ce qui repose dessus.
//
// Cinq informations, dans cet ordre : qui écrira · quoi · à quelle fréquence · comment se
// retirer · que rien ne change si l'on ignore ce message.
//
// ⛔ La dernière compte autant que les autres : un consentement n'est libre que si le
// refuser ne coûte rien. Une invitation qui laisse croire qu'un silence pénalise n'obtient
// pas un consentement, elle obtient une signature sous contrainte.
//
// PUR : aucun I/O, testable sous Node comme sous Deno.

export type OptinLang = 'fr' | 'de' | 'en' | 'it'

export interface OptinCopy {
  subject: string
  /** Corps affiché ET archivé comme preuve. Le lien est présenté à part. */
  body: string
  /** Libellé du lien `wa.me`. */
  cta: string
  /**
   * Ligne d'aperçu de la boîte de réception — lue AVANT l'ouverture, à côté de
   * l'objet. Elle dit le coût et la sortie : la question du destinataire devant
   * une demande de consentement est « à quoi je m'engage ».
   */
  preheader: string
  /**
   * Pied de l'e-mail, dans la coquille.
   *
   * ⛔ IL VIT ICI, PAS DANS LE CONSTRUCTEUR, parce qu'il est la PIÈCE JURIDIQUE de
   * ce parcours et que la nLPD (art. 6 al. 6) exige une information préalable et
   * ADÉQUATE. Écrit en dur côté constructeur, il partait en français dans un
   * e-mail déclaré `lang="de"` : un destinataire germanophone recevait un objet
   * et un corps allemands, puis la seule phrase qui explique ce qu'il consent en
   * français. Une mention de consentement illisible par son destinataire manque
   * son objet.
   */
  legalNote: string
}

const PRIVACY_EMAIL = 'privacy@megga.ch'
const PRIVACY_URL = 'https://megga.ch/privacy'

/**
 * @param agencyName raison sociale de l'agence qui écrira. JAMAIS « MEGGA » ici : c'est
 *   l'agence qui traitera, et nommer l'outil à sa place rendrait l'information fausse.
 */
export function optinCopy(lang: OptinLang, agencyName: string): OptinCopy {
  const who = agencyName.trim()
  const T: Record<OptinLang, OptinCopy> = {
    fr: {
      subject: `Recevoir nos annonces sur WhatsApp ?`,
      body:
        `Bonjour,\n\n` +
        `${who} peut vous envoyer sur WhatsApp les biens qui correspondent à votre recherche, ` +
        `ainsi que le suivi de vos visites et de vos dossiers.\n\n` +
        `Ce que cela implique : nous utiliserons votre numéro de téléphone pour vous écrire sur ` +
        `WhatsApp, quelques messages par mois au plus. Vos données sont traitées par ${who} dans ` +
        `le cadre de son activité immobilière.\n\n` +
        `Vous pouvez arrêter à tout moment en répondant STOP à l'un de nos messages WhatsApp. ` +
        `Pour accéder à vos données, les corriger ou les supprimer : ${PRIVACY_EMAIL} ` +
        `(détail : ${PRIVACY_URL}).\n\n` +
        `Si vous ne souhaitez pas de messages WhatsApp, ignorez simplement cet e-mail : ` +
        `rien ne change, et nous continuons de vous répondre comme aujourd'hui.`,
      cta: `Oui, écrivez-moi sur WhatsApp`,
      preheader: `Un message, et vous pourrez répondre STOP à tout moment.`,
      legalNote:
        `Cet e-mail vous invite à consentir aux messages WhatsApp de votre agence. ` +
        `Tant que vous n'avez pas répondu, aucun message ne vous sera envoyé sur ce canal.`,
    },
    de: {
      subject: `Unsere Angebote per WhatsApp erhalten?`,
      body:
        `Guten Tag,\n\n` +
        `${who} kann Ihnen die zu Ihrer Suche passenden Objekte per WhatsApp senden, ebenso die ` +
        `Nachverfolgung Ihrer Besichtigungen und Dossiers.\n\n` +
        `Was das bedeutet: Wir verwenden Ihre Telefonnummer, um Ihnen auf WhatsApp zu schreiben, ` +
        `höchstens einige Nachrichten pro Monat. Ihre Daten werden von ${who} im Rahmen der ` +
        `Immobilientätigkeit bearbeitet.\n\n` +
        `Sie können jederzeit aufhören, indem Sie auf eine unserer WhatsApp-Nachrichten mit STOP ` +
        `antworten. Für Auskunft, Berichtigung oder Löschung Ihrer Daten: ${PRIVACY_EMAIL} ` +
        `(Einzelheiten: ${PRIVACY_URL}).\n\n` +
        `Wenn Sie keine WhatsApp-Nachrichten wünschen, ignorieren Sie diese E-Mail einfach: ` +
        `es ändert sich nichts, und wir antworten Ihnen weiterhin wie bisher.`,
      cta: `Ja, schreiben Sie mir auf WhatsApp`,
      preheader: `Eine Nachricht, und Sie können jederzeit mit STOP antworten.`,
      legalNote:
        `Diese E-Mail lädt Sie ein, den WhatsApp-Nachrichten Ihrer Agentur zuzustimmen. ` +
        `Solange Sie nicht geantwortet haben, wird Ihnen über diesen Kanal keine Nachricht gesendet.`,
    },
    en: {
      subject: `Receive our listings on WhatsApp?`,
      body:
        `Hello,\n\n` +
        `${who} can send you the properties matching your search on WhatsApp, along with ` +
        `follow-ups on your viewings and files.\n\n` +
        `What this means: we will use your phone number to write to you on WhatsApp, at most a ` +
        `few messages a month. Your data is processed by ${who} as part of its real estate ` +
        `activity.\n\n` +
        `You can stop at any time by replying STOP to any of our WhatsApp messages. To access, ` +
        `correct or delete your data: ${PRIVACY_EMAIL} (details: ${PRIVACY_URL}).\n\n` +
        `If you would rather not receive WhatsApp messages, simply ignore this email: nothing ` +
        `changes, and we keep replying to you as we do today.`,
      cta: `Yes, write to me on WhatsApp`,
      preheader: `One message, and you can reply STOP at any time.`,
      legalNote:
        `This email invites you to consent to WhatsApp messages from your agency. ` +
        `Until you reply, no message will be sent to you on this channel.`,
    },
    it: {
      subject: `Ricevere i nostri annunci su WhatsApp?`,
      body:
        `Buongiorno,\n\n` +
        `${who} può inviarle su WhatsApp gli immobili corrispondenti alla sua ricerca, oltre al ` +
        `seguito delle sue visite e delle sue pratiche.\n\n` +
        `Cosa comporta: useremo il suo numero di telefono per scriverle su WhatsApp, al massimo ` +
        `qualche messaggio al mese. I suoi dati sono trattati da ${who} nell'ambito della sua ` +
        `attività immobiliare.\n\n` +
        `Può interrompere in qualsiasi momento rispondendo STOP a uno dei nostri messaggi ` +
        `WhatsApp. Per accedere ai suoi dati, correggerli o cancellarli: ${PRIVACY_EMAIL} ` +
        `(dettagli: ${PRIVACY_URL}).\n\n` +
        `Se non desidera messaggi WhatsApp, ignori semplicemente questa e-mail: non cambia nulla, ` +
        `e continuiamo a risponderle come oggi.`,
      cta: `Sì, scrivetemi su WhatsApp`,
      preheader: `Un messaggio, e potrà rispondere STOP in qualsiasi momento.`,
      legalNote:
        `Questa e-mail la invita ad acconsentire ai messaggi WhatsApp della sua agenzia. ` +
        `Finché non avrà risposto, nessun messaggio le sarà inviato su questo canale.`,
    },
  }
  return T[lang] ?? T.fr
}

/** Normalise une langue déclarée (`contacts.language`) en langue d'invitation. */
export function optinLang(declared: string | null | undefined): OptinLang {
  const l = (declared ?? '').trim().toLowerCase()
  return l === 'de' || l === 'en' || l === 'it' ? l : 'fr'
}
