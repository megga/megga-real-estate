// supabase/functions/_shared/agency-verification-notice.ts
//
// Composition du courriel qui annonce a une agence la decision prise sur son dossier
// d'identite KYB (etape 7, tache 6).
//
// POURQUOI CE FICHIER EXISTE SEPAREMENT de l'edge function qui envoie. Module PUR : aucun
// Deno.env.get, aucun fetch -- meme discipline que _shared/kyb-sources.ts, et pour la meme
// raison : il est importable tel quel depuis un test vitest, donc les libelles, les
// destinataires et les sujets se verifient sans pile Deno ni cle Resend. Ce qui touche au
// reseau reste dans agency-verification-notify/index.ts.
//
// L'HABILLAGE vient de `_shared/email-shell.ts` (migration du 15.08.2026) : ce fichier ne
// decide que du CONTENU. Un `<!DOCTYPE>` ecrit ici ferait crier `npm run lint:email-shell`.

import { INK, escapeHtml, shell, p, button, note } from './email-shell.ts'
import type { AppLocale } from './recipient-language.ts'
//
// POURQUOI UNE NOTIFICATION, ET PAS UN SIMPLE BANDEAU. Avant cette tache, ni une validation
// ni un rejet n'emettait quoi que ce soit : l'agence decouvrait la decision en se
// reconnectant et en lisant le bandeau. Deux consequences, et la seconde est la vraie :
//   - une agence validee ne savait pas qu'elle pouvait desormais travailler ;
//   - une agence a qui l'on demandait une CORRECTION ne savait pas QUOI corriger. Le motif
//     est obligatoire cote RPC precisement pour etre actionnable, et il ne l'est que s'il
//     atteint son destinataire. Sans ce courriel, le dirigeant resoumettait a l'identique.
//
// LES QUATRE DECISIONS NOTIFIEES, et pourquoi celles-la. `validated` et `auto_validated`
// ouvrent les gardes LAB : c'est la bonne nouvelle, et elle est inutile si personne ne la
// lit. `rejected` ferme le dossier definitivement. `correction_requested` attend un geste.
// `pending` et `manual_review` ne sont PAS notifies : ce sont des etats d'attente, et
// prevenir a chaque passage du moteur ferait du bruit sans information.

/** Les statuts de verification qui meritent un courriel. Ordre sans importance ; c'est
 *  l'appartenance qui compte, et elle est verifiee par isNotifiableStatus(). */
export const NOTIFIABLE_STATUSES = [
  'validated',
  'auto_validated',
  'rejected',
  'correction_requested',
] as const

export type NotifiableStatus = (typeof NOTIFIABLE_STATUSES)[number]

/** Liste BLANCHE, jamais liste noire : un statut futur ne declenche aucun courriel tant que
 *  quelqu'un n'a pas ecrit ce qu'il faut en dire. Un envoi de trop sur un etat qu'on ne sait
 *  pas nommer serait pire qu'un envoi manquant. */
export function isNotifiableStatus(status: string | null | undefined): status is NotifiableStatus {
  return typeof status === 'string' && (NOTIFIABLE_STATUSES as readonly string[]).includes(status)
}

export interface NoticeRecipientCandidate {
  email: string | null
  role: string | null
}

/**
 * Les destinataires du courriel : les DIRIGEANTS de l'agence (admin ou manager), jamais tous
 * les membres.
 *
 * Trois raisons, et la troisieme suffirait : seuls admin et manager peuvent soumettre le
 * wizard (garde is_agency_admin de submit_agency_identity), donc seuls eux peuvent agir sur
 * une correction demandee ; le motif d'un rejet ou d'une correction porte des donnees
 * d'identite de conformite, qui ne concernent pas un agent simple ; et un dossier
 * d'identite est une affaire de direction, pas de l'equipe.
 *
 * Repli sur l'adresse de l'agence quand aucun dirigeant n'a d'adresse lisible -- une agence
 * sans dirigeant joignable existe (invitation en attente, compte supprime) et ne doit pas
 * faire disparaitre la decision en silence.
 *
 * Dedoublonne et normalise en minuscules : deux dirigeants inscrits avec la meme adresse a
 * la casse pres ne doivent pas recevoir deux courriels identiques.
 */
export function noticeRecipients(
  candidates: NoticeRecipientCandidate[],
  agencyEmail: string | null,
): string[] {
  const fromDirectors = candidates
    .filter((c) => c.role === 'admin' || c.role === 'manager')
    .map((c) => (c.email ?? '').trim().toLowerCase())
    .filter((e) => e.includes('@'))

  const chosen = fromDirectors.length > 0
    ? fromDirectors
    : [(agencyEmail ?? '').trim().toLowerCase()].filter((e) => e.includes('@'))

  return [...new Set(chosen)]
}

export interface NoticeContent {
  subject: string
  html: string
}

/**
 * Tout le texte de l'avis, par statut ET par langue.
 *
 * ⚠ LE COMMENTAIRE QUI TENAIT ICI EST PÉRIMÉ : il disait « en francais seulement […] la
 * langue du destinataire n'est pas connue cote serveur ». Elle l'est depuis le
 * 16.08.2026 — `profiles.language`, migration 20260815250000.
 *
 * ⚠ ACCENTUES depuis le 15.08.2026. Ces libelles etaient ecrits sans diacritiques
 * (« L'identite de votre agence est validee »), artefact de la premiere ecriture du
 * fichier : le reste du depot accentue, et c'est de la copie CLIENT sur une decision de
 * conformite. Les commentaires de ce fichier, eux, restent en l'etat — ils ne partent
 * chez personne.
 *
 * ⛔ TON FACTUEL, dans les quatre langues. Une décision de conformité n'est ni une
 * félicitation ni un reproche : le destinataire lit ce qui est décidé et ce qu'il peut
 * faire ensuite, rien d'autre. Un refus qui s'excuserait laisserait croire qu'il se
 * négocie ; une validation qui congratulerait ferait de la conformité une récompense.
 */
const TXT: Record<AppLocale, {
  headline: Record<NotifiableStatus, string>
  subject: Record<NotifiableStatus, string>
  body: Record<NotifiableStatus, string>
  preheader: Record<NotifiableStatus, string>
  dossierDe: (agence: string) => string
  labelMotif: string
  ctaReprendre: string
  ctaEspace: string
  legal: string
}> = {
  fr: {
    headline: {
      validated: 'L’identité de votre agence est validée',
      auto_validated: 'L’identité de votre agence est validée',
      rejected: 'L’identité de votre agence n’a pas été validée',
      correction_requested: 'Une correction est demandée sur votre dossier',
    },
    subject: {
      validated: 'Votre agence est vérifiée sur MEGGA',
      auto_validated: 'Votre agence est vérifiée sur MEGGA',
      rejected: 'Vérification d’identité : dossier refusé',
      correction_requested: 'Vérification d’identité : correction demandée',
    },
    body: {
      validated: 'Vous pouvez désormais ouvrir des dossiers KYC clients et lancer des signatures électroniques.',
      auto_validated: 'Vous pouvez désormais ouvrir des dossiers KYC clients et lancer des signatures électroniques.',
      rejected: 'L’ouverture de dossiers KYC clients et les signatures électroniques restent indisponibles. '
        + 'Renvoyer le formulaire ne relance pas d’examen : contactez le support MEGGA pour connaître la suite.',
      correction_requested: 'Reprenez votre formulaire d’identité, corrigez ce qui est indiqué ci-dessous, puis soumettez '
        + 'à nouveau. L’examen reprendra automatiquement.',
    },
    preheader: {
      validated: 'Les dossiers KYC et les signatures électroniques vous sont ouverts.',
      auto_validated: 'Les dossiers KYC et les signatures électroniques vous sont ouverts.',
      rejected: 'Le motif de la décision est dans ce message.',
      correction_requested: 'Le motif à corriger est dans ce message, avec le lien pour reprendre.',
    },
    dossierDe: (a) => `Dossier de <strong style="color:${INK};">${a}</strong>.`,
    labelMotif: 'Motif', ctaReprendre: 'Reprendre le formulaire', ctaEspace: 'Ouvrir mon espace',
    legal: 'Cet e-mail concerne le dossier de vérification d’identité de votre agence. '
      + 'Il ne s’agit pas d’une communication marketing : c’est pourquoi il ne contient pas de lien de désinscription.',
  },
  de: {
    headline: {
      validated: 'Die Identität Ihrer Agentur ist bestätigt',
      auto_validated: 'Die Identität Ihrer Agentur ist bestätigt',
      rejected: 'Die Identität Ihrer Agentur wurde nicht bestätigt',
      correction_requested: 'Eine Korrektur an Ihrem Dossier ist erforderlich',
    },
    subject: {
      validated: 'Ihre Agentur ist auf MEGGA bestätigt',
      auto_validated: 'Ihre Agentur ist auf MEGGA bestätigt',
      rejected: 'Identitätsprüfung: Dossier abgelehnt',
      correction_requested: 'Identitätsprüfung: Korrektur angefordert',
    },
    body: {
      validated: 'Sie können ab sofort KYC-Dossiers für Ihre Kunden eröffnen und elektronische Signaturen starten.',
      auto_validated: 'Sie können ab sofort KYC-Dossiers für Ihre Kunden eröffnen und elektronische Signaturen starten.',
      rejected: 'Das Eröffnen von KYC-Dossiers für Ihre Kunden und die elektronischen Signaturen bleiben nicht '
        + 'verfügbar. Das erneute Absenden des Formulars löst keine neue Prüfung aus: Wenden Sie sich an den '
        + 'MEGGA Support, um die weiteren Schritte zu erfahren.',
      correction_requested: 'Öffnen Sie Ihr Identitätsformular erneut, korrigieren Sie, was unten angegeben ist, '
        + 'und senden Sie es nochmals ab. Die Prüfung wird automatisch fortgesetzt.',
    },
    preheader: {
      validated: 'KYC-Dossiers und elektronische Signaturen stehen Ihnen offen.',
      auto_validated: 'KYC-Dossiers und elektronische Signaturen stehen Ihnen offen.',
      rejected: 'Der Grund für die Entscheidung steht in dieser Nachricht.',
      correction_requested: 'Der zu korrigierende Grund steht in dieser Nachricht, mit dem Link zum Formular.',
    },
    dossierDe: (a) => `Dossier von <strong style="color:${INK};">${a}</strong>.`,
    labelMotif: 'Grund', ctaReprendre: 'Formular erneut öffnen', ctaEspace: 'Zu meinem Bereich',
    legal: 'Diese E-Mail betrifft das Dossier zur Identitätsprüfung Ihrer Agentur. Es handelt sich nicht '
      + 'um eine Werbenachricht, deshalb enthält sie keinen Abmeldelink.',
  },
  en: {
    headline: {
      validated: 'Your agency’s identity is validated',
      auto_validated: 'Your agency’s identity is validated',
      rejected: 'Your agency’s identity was not validated',
      correction_requested: 'A correction is requested on your file',
    },
    subject: {
      validated: 'Your agency is verified on MEGGA',
      auto_validated: 'Your agency is verified on MEGGA',
      rejected: 'Identity verification: file rejected',
      correction_requested: 'Identity verification: correction requested',
    },
    body: {
      validated: 'You can now open client KYC cases and start electronic signatures.',
      auto_validated: 'You can now open client KYC cases and start electronic signatures.',
      rejected: 'Opening client KYC cases and electronic signatures remain unavailable. Resubmitting the '
        + 'form does not trigger a new review: contact MEGGA support to learn the next steps.',
      correction_requested: 'Reopen your identity form, correct what is indicated below, then submit again. '
        + 'The review will resume automatically.',
    },
    preheader: {
      validated: 'KYC cases and electronic signatures are open to you.',
      auto_validated: 'KYC cases and electronic signatures are open to you.',
      rejected: 'The reason for the decision is in this message.',
      correction_requested: 'What to correct is in this message, with the link to reopen the form.',
    },
    dossierDe: (a) => `File for <strong style="color:${INK};">${a}</strong>.`,
    labelMotif: 'Reason', ctaReprendre: 'Reopen the form', ctaEspace: 'Go to my workspace',
    legal: 'This email is about your agency’s identity verification file. It is not a marketing message, '
      + 'which is why it carries no unsubscribe link.',
  },
  it: {
    headline: {
      validated: 'L’identità della Sua agenzia è convalidata',
      auto_validated: 'L’identità della Sua agenzia è convalidata',
      rejected: 'L’identità della Sua agenzia non è stata convalidata',
      correction_requested: 'È richiesta una correzione sul Suo fascicolo',
    },
    subject: {
      validated: 'La Sua agenzia è verificata su MEGGA',
      auto_validated: 'La Sua agenzia è verificata su MEGGA',
      rejected: 'Verifica d’identità: fascicolo respinto',
      correction_requested: 'Verifica d’identità: correzione richiesta',
    },
    body: {
      validated: 'Ora può aprire fascicoli KYC per i Suoi clienti e avviare firme elettroniche.',
      auto_validated: 'Ora può aprire fascicoli KYC per i Suoi clienti e avviare firme elettroniche.',
      rejected: 'L’apertura di fascicoli KYC per i Suoi clienti e le firme elettroniche restano non '
        + 'disponibili. Reinviare il modulo non avvia un nuovo esame: contatti il supporto MEGGA per '
        + 'conoscere i prossimi passi.',
      correction_requested: 'Riapra il Suo modulo d’identità, corregga quanto indicato qui sotto, poi invii '
        + 'di nuovo. L’esame riprenderà automaticamente.',
    },
    preheader: {
      validated: 'I fascicoli KYC e le firme elettroniche Le sono aperti.',
      auto_validated: 'I fascicoli KYC e le firme elettroniche Le sono aperti.',
      rejected: 'Il motivo della decisione è in questo messaggio.',
      correction_requested: 'Il motivo da correggere è in questo messaggio, con il link per riaprire il modulo.',
    },
    dossierDe: (a) => `Fascicolo di <strong style="color:${INK};">${a}</strong>.`,
    labelMotif: 'Motivo', ctaReprendre: 'Riaprire il modulo', ctaEspace: 'Aprire il mio spazio',
    legal: 'Questa e-mail riguarda il fascicolo di verifica d’identità della Sua agenzia. Non è una '
      + 'comunicazione commerciale: per questo non contiene alcun link di disiscrizione.',
  },
}

/**
 * Compose sujet et corps HTML, sur la coquille commune `_shared/email-shell.ts`.
 *
 * ⚠ MIGRÉ LE 15.08.2026. Ce fichier fabriquait sa propre coquille — fond `#f9fafb`,
 * police système, wordmark « MEGGA / Immobilier Suisse » en texte — soit l'un des treize
 * designs d'e-mail que le dépôt comptait. La porte `npm run lint:email-shell` interdit
 * désormais d'en réintroduire une ici.
 *
 * LE MOTIF EST ECHAPPE, et ce n'est pas de la precaution generique : c'est un texte libre
 * saisi par un relecteur, rendu dans du HTML envoye par courriel. Un chevron non echappe
 * casserait la mise en page ; une balise le rendrait injectable.
 *
 * Le motif n'est affiche QUE pour les deux statuts qui en portent un. Une validation qui
 * afficherait un bloc « motif » vide, ou pire le motif d'une decision anterieure lue par
 * erreur, dirait quelque chose de faux.
 */
export function buildVerificationNotice(input: {
  status: NotifiableStatus
  agencyName: string
  reason: string | null
  appUrl: string
  /** Langue de correspondance du destinataire (profiles.language). Défaut : français. */
  locale?: AppLocale
}): NoticeContent {
  const l = input.locale ?? 'fr'
  const t = TXT[l]
  const showReason =
    (input.status === 'rejected' || input.status === 'correction_requested')
    && typeof input.reason === 'string'
    && input.reason.trim() !== ''

  // Le bouton ne mene au formulaire d'identite que quand il y a quelque chose a y faire :
  // `rejected` est TERMINAL, proposer de reprendre promettrait une reprise qui n'existe pas.
  const cta = input.status === 'correction_requested'
    ? `<div style="margin:0 0 8px;">${button(`${input.appUrl}/dashboard/identite`, t.ctaReprendre)}</div>`
    : ''

  const html = shell({
    lang: l,
    title: t.headline[input.status],
    preheader: t.preheader[input.status],
    // Mention propre au KYB : celle des e-mails de rendez-vous parlerait d'un
    // rendez-vous, celle du gabarit d'authentification annoncerait une notification de
    // sécurité. Les deux seraient fausses ici.
    legalNote: t.legal,
    headerCta: { href: `${input.appUrl}/dashboard`, label: t.ctaEspace },
    bodyHtml: `
     ${p(t.dossierDe(escapeHtml(input.agencyName)))}
     ${p(escapeHtml(t.body[input.status]), 28)}
     ${showReason ? note(t.labelMotif, escapeHtml(input.reason!.trim())) : ''}
     ${cta}`,
  })

  return { subject: t.subject[input.status], html }
}
