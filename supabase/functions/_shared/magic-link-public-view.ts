/**
 * Vue publique d'un lien magique KYC — ce que LIT quiconque tient le lien, et rien d'autre.
 *
 * POURQUOI UNE LISTE BLANCHE ET NON UNE LISTE DE COLONNES (audit du 13.09.2026, point S10).
 * `magic-link-get` renvoyait ses lignes telles quelles : la surface publique était
 * exactement ce que ses `select` énuméraient — `ocr_fields` (nom, numéro de pièce, date de
 * naissance), `last_name`, `custom_message`, le `slug` de l'agence, `confirmed_by_client`.
 * Un `select` élargi demain pour un besoin interne aurait élargi du même geste ce qu'un lien
 * transféré (un courriel réacheminé, une capture partagée) livre pendant toute sa vie. Ici,
 * chaque champ servi est RECOPIÉ un par un : une colonne ajoutée à une requête n'atteint pas
 * le porteur tant que quelqu'un ne l'a pas écrite dans ce fichier, test compris.
 *
 * Ce que la page cliente lit réellement (KycPublicPage, MlkScreens) : le prénom, le nom de
 * l'agent et de l'agence, l'échéance, le statut, et pour chaque pièce son id, son type, son
 * nom de fichier, sa taille et sa date. Rien d'autre ne sort. `custom_message` est déjà dans
 * le courriel qui porte le lien ; le nom de famille n'apparaît sur aucun écran.
 *
 * ⛔ LES CHAMPS OCR NE SORTENT JAMAIS PAR ICI. Le mode par défaut d'un lien est `verifiee`
 * (MlkAgentModal), et le statut `verifying` annonce un écran de confirmation OCR. Le jour où
 * il existera, un champ OCR ne pourra être servi que MASQUÉ, seulement tant que le statut
 * vaut `verifying`, et seulement par un ajout explicite à cette liste, accompagné de son
 * test. Jamais après la soumission.
 *
 * ⚠ Le nom de fichier reste public, par conception : la cliente veut voir ce qu'elle a
 * envoyé. Un fichier nommé « passeport_dupont_1985.pdf » expose donc ce nom à qui tient le
 * lien — résiduel assumé, écrit dans l'audit.
 *
 * Module PUR : ni I/O ni global Deno, importable depuis Node (vitest).
 */

/** Ligne lue en base, dont on ne connaît pas le typage (le client edge n'a pas de schéma). */
type Ligne = Readonly<Record<string, unknown>>

/** Une pièce telle que le porteur du lien la voit. */
export interface MagicLinkPublicUpload {
  id: string
  type: string
  filename: string
  size_bytes: number
  uploaded_at: string
}

/** Vue d'un lien OUVERT (`pending` est rendu `opened` : le premier appel l'ouvre). */
export interface MagicLinkPublicViewOut {
  magic_link_id: string
  status: string
  mode: string
  expires_at: string
  contact: { first_name: string } | null
  agency: { name: string } | null
  agent: { full_name: string } | null
  uploads: MagicLinkPublicUpload[]
}

/** Entrées du constructeur : les lignes brutes, jamais filtrées en amont. */
export interface MagicLinkPublicViewInput {
  link: Ligne
  contact: Ligne | null | undefined
  agency: Ligne | null | undefined
  agent: Ligne | null | undefined
  uploads: ReadonlyArray<Ligne> | null | undefined
}

// Coercition champ par champ : une valeur d'un autre type que prévu devient vide plutôt que
// de voyager telle quelle — un objet glissé dans `filename` ne ressortirait pas en JSON.
const texte = (v: unknown): string => (typeof v === 'string' ? v : '')
const nombre = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0)

/**
 * Construit la vue publique d'un lien OUVERT à partir des lignes brutes.
 * Les liens `submitted` et `expired` ne passent pas par ici : `magic-link-get` leur répond
 * sans aucune donnée de personne.
 */
export function buildMagicLinkPublicView(input: MagicLinkPublicViewInput): MagicLinkPublicViewOut {
  const statut = texte(input.link.status)
  return {
    magic_link_id: texte(input.link.id),
    status: statut === 'pending' ? 'opened' : statut,
    mode: texte(input.link.mode),
    expires_at: texte(input.link.expires_at),
    contact: input.contact ? { first_name: texte(input.contact.first_name) } : null,
    agency: input.agency ? { name: texte(input.agency.name) } : null,
    agent: input.agent ? { full_name: texte(input.agent.full_name) } : null,
    uploads: (input.uploads ?? []).map((u) => ({
      id: texte(u.id),
      type: texte(u.type),
      filename: texte(u.filename),
      size_bytes: nombre(u.size_bytes),
      uploaded_at: texte(u.uploaded_at),
    })),
  }
}
