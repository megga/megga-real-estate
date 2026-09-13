/**
 * Plafonds d'un lien magique KYC public — ce qu'un porteur du lien peut déposer, au plus.
 *
 * POURQUOI CE MODULE EXISTE (audit du 13.09.2026, point S10). `magic-link-upload` ne bornait
 * que la taille d'UN fichier : un lien transféré, ou un porteur malveillant, pouvait déposer
 * autant de pièces de 10 Mo qu'il voulait dans le bucket KYC et dans le quota de stockage de
 * l'agence, pendant toute la vie du lien (7 jours pour les deux émetteurs réels, 30 au
 * plafond de l'API). Le lien est la ressource rare — c'est un agent qui l'émet —, donc c'est
 * lui qu'on borne, et non l'IP : une IP ne protège pas un lien transféré.
 *
 * ⛔ CES VALEURS ONT UN MIROIR EN BASE, et c'est le miroir qui fait foi : le trigger
 * `enforce_kyc_magic_link_upload_caps` (migration 20260913160400) refuse la 21ᵉ pièce et
 * l'octet de trop même sous des dépôts parallèles, là où l'edge ne voit que ce qu'elle a lu
 * avant d'écrire. La page publique (`KycPublicPage`) les recopie pour prévenir avant
 * l'envoi. Les trois copies sont confrontées par `tests/unit/magic-link-upload-caps.spec.ts`
 * — en changer une sans les autres fait rougir la porte.
 *
 * Pourquoi 20 pièces : un dossier de personne physique en demande 3 à 6, et le recto/verso
 * double la pièce d'identité ; 20 laisse plus de trois fois la marge. 100 Mo : 10 pièces au
 * plafond unitaire. Le bucket `kyc-magic-link` porte déjà, côté stockage, les mêmes 10 Mo et
 * la même liste MIME (relevé en production le 13.09.2026).
 *
 * Module PUR : ni I/O ni global Deno, importable depuis Node (vitest).
 */

/** Taille maximale d'une pièce — la même que le CHECK `kyc_magic_link_uploads_size_bytes_check`. */
export const MAX_FILE_BYTES = 10 * 1024 * 1024

/** Nombre maximal de pièces qu'un même lien peut porter. */
export const MAX_FILES_PER_LINK = 20

/** Volume maximal cumulé des pièces d'un même lien. */
export const MAX_BYTES_PER_LINK = 100 * 1024 * 1024

/**
 * Corps multipart maximal accepté AVANT de le lire : une pièce au plafond plus 1 Mio de marge
 * pour les bornes multipart, les en-têtes de partie et le champ `type`.
 */
export const MAX_REQUEST_BYTES = MAX_FILE_BYTES + 1024 * 1024

/** Formats acceptés — la même liste que le bucket `kyc-magic-link` et que la page publique. */
export const ALLOWED_UPLOAD_MIME: readonly string[] = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
]

/**
 * Statuts dans lesquels un lien accepte encore une écriture du porteur (dépôt, ouverture,
 * soumission). `submitted` et `expired` sont TERMINAUX : aucune écriture publique ne doit
 * ramener un lien en arrière — un dossier soumis rouvert redonnerait la vue complète et la
 * capacité de dépôt à quiconque tient le lien. Chaque transition de statut des trois
 * endpoints publics filtre sur cette liste, pour qu'une course ne la franchisse jamais.
 */
export const MAGIC_LINK_OPEN_STATUSES = ['pending', 'opened', 'uploading', 'verifying'] as const

/** Verdict du tri d'une requête de dépôt sur son seul `Content-Length`. */
export type UploadRequestScreen =
  | { ok: true; declaredBytes: number }
  | { ok: false; status: 411; reason: 'length_required' }
  | { ok: false; status: 413; reason: 'too_large' }

/**
 * Tri d'une requête de dépôt AVANT d'en lire le corps.
 *
 * `req.formData()` tamponne tout le corps. Sans `Content-Length`, un envoi `chunked` n'aurait
 * aucune borne : c'est exactement ce que le plafond devait empêcher. Un navigateur envoie
 * toujours la longueur d'un `FormData` — l'exiger (411) ne coûte donc rien au parcours réel.
 * Une valeur illisible (négative, décimale, non numérique) vaut une absence : on ne borne pas
 * une lecture sur un nombre qu'on ne comprend pas.
 */
export function screenUploadRequest(contentLength: string | null): UploadRequestScreen {
  const brut = (contentLength ?? '').trim()
  if (!/^\d+$/.test(brut)) return { ok: false, status: 411, reason: 'length_required' }
  const declared = Number(brut)
  if (!Number.isSafeInteger(declared)) return { ok: false, status: 413, reason: 'too_large' }
  if (declared > MAX_REQUEST_BYTES) return { ok: false, status: 413, reason: 'too_large' }
  return { ok: true, declaredBytes: declared }
}

/**
 * Vrai si déposer `incomingBytes` de plus dépasserait l'un des deux plafonds du lien.
 * `used` décrit les pièces DÉJÀ enregistrées sur le lien (nombre et octets cumulés).
 */
export function exceedsLinkCaps(used: { files: number; bytes: number }, incomingBytes: number): boolean {
  return used.files >= MAX_FILES_PER_LINK || used.bytes + incomingBytes > MAX_BYTES_PER_LINK
}
