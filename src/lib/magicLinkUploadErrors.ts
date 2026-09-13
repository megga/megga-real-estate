/**
 * Refus d'un dépôt de pièce sur la page publique KYC (`/kyc/:token`) — du statut HTTP de
 * `magic-link-upload` au motif que la page traduit.
 *
 * POURQUOI (audit du 13.09.2026, point S10). La page affichait le corps BRUT de la réponse
 * d'erreur, JSON compris : un refus au plafond serait apparu à la cliente comme
 * `{"error":"upload_limit","reason":"upload_limit"}`. Et l'edge recopiait alors le texte des
 * erreurs de base et de stockage. Désormais l'edge ne répond que par un ensemble FERMÉ de
 * motifs, et ce module les range en catégories dont chacune a sa phrase dans les quatre
 * langues (`kyc.json`, `client.upload.*`). Ce qui n'est pas reconnu tombe sur le message
 * générique — jamais sur le texte reçu.
 */

/** Catégorie d'un refus, telle que la page la présente. */
export type MagicLinkUploadFailure =
  | 'length_required' // 411 : la longueur du corps manque — le serveur refuse de le lire
  | 'too_large' //       413 : la pièce (ou la requête) dépasse le plafond unitaire
  | 'upload_limit' //    409 : le lien porte déjà 20 pièces ou 100 Mo
  | 'not_uploadable' //  409 : le dossier a été envoyé, ou le lien a expiré entre-temps
  | 'format' //          400 : format refusé
  | 'expired' //         410, ou 401 motivé « expiré »
  | 'invalid' //         401 : lien non reconnu
  | 'other' //           tout le reste, dont les pannes réseau et les 5xx

/**
 * Range un refus de `magic-link-upload` : `status` est le statut HTTP, `reason` le champ
 * `reason` du corps JSON (ou `null` s'il manque ou s'il est illisible).
 */
export function magicLinkUploadFailure(status: number, reason: string | null): MagicLinkUploadFailure {
  if (status === 411) return 'length_required'
  if (status === 413) return 'too_large'
  if (status === 409) return reason === 'upload_limit' ? 'upload_limit' : 'not_uploadable'
  if (status === 410) return 'expired'
  if (status === 401) return reason === 'expired' ? 'expired' : 'invalid'
  if (status === 400 && reason === 'format') return 'format'
  return 'other'
}

/**
 * Erreur levée par la mutation de dépôt : elle porte la catégorie du refus, jamais le corps
 * reçu — la page n'a donc aucun texte serveur à afficher, même par mégarde.
 */
export class MagicLinkUploadError extends Error {
  readonly failure: MagicLinkUploadFailure

  constructor(status: number, reason: string | null) {
    super(`Upload failed: HTTP ${status}`)
    this.name = 'MagicLinkUploadError'
    this.failure = magicLinkUploadFailure(status, reason)
  }
}
