// supabase/functions/_shared/agency-verification-notice.ts
//
// Composition du courriel qui annonce a une agence la decision prise sur son dossier
// d'identite KYB (etape 7, tache 6).
//
// POURQUOI CE FICHIER EXISTE SEPAREMENT de l'edge function qui envoie. Module PUR : aucun
// import, aucun Deno.env.get, aucun fetch -- meme discipline que _shared/kyb-sources.ts, et
// pour la meme raison : il est importable tel quel depuis un test vitest, donc les libelles,
// les destinataires et les sujets se verifient sans pile Deno ni cle Resend. Ce qui touche au
// reseau reste dans agency-verification-notify/index.ts.
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
 *  cote serveur, et le CRM lui-meme est en francais par defaut. */
const HEADLINE: Record<NotifiableStatus, string> = {
  validated: "L'identite de votre agence est validee",
  auto_validated: "L'identite de votre agence est validee",
  rejected: "L'identite de votre agence n'a pas ete validee",
  correction_requested: 'Une correction est demandee sur votre dossier',
}

const SUBJECT: Record<NotifiableStatus, string> = {
  validated: 'Votre agence est verifiee sur MEGGA',
  auto_validated: 'Votre agence est verifiee sur MEGGA',
  rejected: "Verification d'identite : dossier refuse",
  correction_requested: "Verification d'identite : correction demandee",
}

const BODY: Record<NotifiableStatus, string> = {
  validated:
    "Vous pouvez desormais ouvrir des dossiers KYC clients et lancer des signatures electroniques.",
  auto_validated:
    "Vous pouvez desormais ouvrir des dossiers KYC clients et lancer des signatures electroniques.",
  rejected:
    "L'ouverture de dossiers KYC clients et les signatures electroniques restent indisponibles. "
    + 'Renvoyer le formulaire ne relance pas d\'examen : contactez le support MEGGA pour connaitre la suite.',
  correction_requested:
    'Reprenez votre formulaire d\'identite, corrigez ce qui est indique ci-dessous, puis soumettez '
    + 'a nouveau. L\'examen reprendra automatiquement.',
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * Compose sujet et corps HTML. Reprend le gabarit des courriels transactionnels existants
 * (en-tete MEGGA, carte blanche arrondie, styles en ligne) plutot que d'en introduire un
 * second.
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

  const reasonBlock = showReason
    ? `
      <div style="margin:0 0 24px 0;padding:16px;background:#f9fafb;border-radius:12px;border:1px solid #e5e7eb;">
        <p style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.4px;color:#9ca3af;margin:0 0 6px 0;">Motif</p>
        <p style="font-size:14px;color:#374151;line-height:1.6;margin:0;">${escapeHtml(input.reason!.trim())}</p>
      </div>`
    : ''

  // Le bouton ne mene au formulaire d'identite que quand il y a quelque chose a y faire.
  const ctaBlock = input.status === 'correction_requested'
    ? `
      <div style="margin:0 0 8px 0;">
        <a href="${escapeHtml(input.appUrl)}/dashboard/identite"
           style="display:inline-block;background:#1a1a1a;color:#ffffff;font-size:14px;font-weight:600;text-decoration:none;padding:12px 20px;border-radius:10px;">
          Reprendre le formulaire
        </a>
      </div>`
    : ''

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(SUBJECT[input.status])}</title>
</head>
<body style="margin:0;padding:0;background-color:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:24px 16px;">

    <div style="text-align:center;margin-bottom:32px;">
      <span style="font-size:22px;font-weight:700;color:#1a1a1a;letter-spacing:-0.5px;">MEGGA</span>
      <span style="font-size:11px;color:#9ca3af;display:block;margin-top:2px;">Immobilier Suisse</span>
    </div>

    <div style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e7eb;padding:32px;">
      <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 16px 0;">
        ${escapeHtml(HEADLINE[input.status])}
      </h2>

      <p style="font-size:14px;color:#6b7280;line-height:1.6;margin:0 0 24px 0;">
        Dossier de <strong style="color:#374151;">${escapeHtml(input.agencyName)}</strong>.
        ${escapeHtml(BODY[input.status])}
      </p>
${reasonBlock}
${ctaBlock}
    </div>

    <p style="font-size:11px;color:#9ca3af;text-align:center;margin:24px 0 0 0;">
      Message automatique, envoye parce qu'une decision a ete prise sur le dossier d'identite de votre agence.
    </p>
  </div>
</body>
</html>`

  return { subject: SUBJECT[input.status], html }
}
