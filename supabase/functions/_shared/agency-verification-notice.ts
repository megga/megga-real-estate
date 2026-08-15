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

/** Libelles par statut. En francais seulement, comme tous les courriels transactionnels de ce
 *  depot (send-team-invite, send-visit-email...) : la langue du destinataire n'est pas connue
 *  cote serveur, et le CRM lui-meme est en francais par defaut.
 *
 *  ⚠ ACCENTUES depuis le 15.08.2026. Ces libelles etaient ecrits sans diacritiques
 *  (« L'identite de votre agence est validee »), artefact de la premiere ecriture du
 *  fichier : le reste du depot accentue, et c'est de la copie CLIENT sur une decision de
 *  conformite. Les commentaires de ce fichier, eux, restent en l'etat — ils ne partent
 *  chez personne. */
const HEADLINE: Record<NotifiableStatus, string> = {
  validated: 'L’identité de votre agence est validée',
  auto_validated: 'L’identité de votre agence est validée',
  rejected: 'L’identité de votre agence n’a pas été validée',
  correction_requested: 'Une correction est demandée sur votre dossier',
}

const SUBJECT: Record<NotifiableStatus, string> = {
  validated: 'Votre agence est vérifiée sur MEGGA',
  auto_validated: 'Votre agence est vérifiée sur MEGGA',
  rejected: 'Vérification d’identité : dossier refusé',
  correction_requested: 'Vérification d’identité : correction demandée',
}

const BODY: Record<NotifiableStatus, string> = {
  validated:
    'Vous pouvez désormais ouvrir des dossiers KYC clients et lancer des signatures électroniques.',
  auto_validated:
    'Vous pouvez désormais ouvrir des dossiers KYC clients et lancer des signatures électroniques.',
  rejected:
    'L’ouverture de dossiers KYC clients et les signatures électroniques restent indisponibles. '
    + 'Renvoyer le formulaire ne relance pas d’examen : contactez le support MEGGA pour connaître la suite.',
  correction_requested:
    'Reprenez votre formulaire d’identité, corrigez ce qui est indiqué ci-dessous, puis soumettez '
    + 'à nouveau. L’examen reprendra automatiquement.',
}

/**
 * Texte d'aperçu, par statut. Il ne recopie pas l'objet : il dit ce que le message
 * CONTIENT, donc pourquoi l'ouvrir maintenant — le motif pour les deux décisions qui en
 * portent un, l'effet concret pour une validation.
 */
const PREHEADER: Record<NotifiableStatus, string> = {
  validated: 'Les dossiers KYC et les signatures électroniques vous sont ouverts.',
  auto_validated: 'Les dossiers KYC et les signatures électroniques vous sont ouverts.',
  rejected: 'Le motif de la décision est dans ce message.',
  correction_requested: 'Le motif à corriger est dans ce message, avec le lien pour reprendre.',
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
}): NoticeContent {
  const showReason =
    (input.status === 'rejected' || input.status === 'correction_requested')
    && typeof input.reason === 'string'
    && input.reason.trim() !== ''

  // Le bouton ne mene au formulaire d'identite que quand il y a quelque chose a y faire :
  // `rejected` est TERMINAL, proposer de reprendre promettrait une reprise qui n'existe pas.
  const cta = input.status === 'correction_requested'
    ? `<div style="margin:0 0 8px;">${button(`${input.appUrl}/dashboard/identite`, 'Reprendre le formulaire')}</div>`
    : ''

  const html = shell({
    title: HEADLINE[input.status],
    preheader: PREHEADER[input.status],
    // Mention propre au KYB : celle des e-mails de rendez-vous parlerait d'un
    // rendez-vous, celle du gabarit d'authentification annoncerait une notification de
    // sécurité. Les deux seraient fausses ici.
    legalNote: 'Cet e-mail concerne le dossier de vérification d’identité de votre agence. '
      + 'Il ne s’agit pas d’une communication marketing : c’est pourquoi il ne contient pas de lien de désinscription.',
    headerCta: { href: `${input.appUrl}/dashboard`, label: 'Ouvrir mon espace' },
    bodyHtml: `
     ${p(`Dossier de <strong style="color:${INK};">${escapeHtml(input.agencyName)}</strong>.`)}
     ${p(escapeHtml(BODY[input.status]), 28)}
     ${showReason ? note('Motif', escapeHtml(input.reason!.trim())) : ''}
     ${cta}`,
  })

  return { subject: SUBJECT[input.status], html }
}
