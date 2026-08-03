/**
 * Lecteur pur du diagnostic de lien KYC (`admin_kyc_link_lookup` / `_regenerate`).
 *
 * Les deux RPC rendent l'enveloppe §10.1 : `{ok:true, data}` ou
 * `{ok:false, code, message_fr, details?}`. Le vocabulaire de refus est FERMÉ
 * côté serveur — mais il compte plus de codes que le chemin heureux : un écran
 * qui ne trierait que `too_many` laisserait `precondition_failed` et `not_found`
 * tomber dans une branche que rien ne dessine. D'où l'état `refused`, qui rend
 * `message_fr` VERBATIM (`admin_error` lève si le message est vide : il est
 * garanti non nul).
 */

/** Une correspondance. La projection serveur est ÉNUMÉRÉE : ni jeton, ni URL, ni IP. */
export interface KycMatch {
  link_id: string
  /** Absent si le contact n'a pas de nom : `admin_ok` applique `jsonb_strip_nulls`. */
  contact?: string
  email?: string
  phone?: string
  agency?: string
  status: string
  /** ⚠ Chaîne d'AFFICHAGE produite par le serveur (« Autonome » / « Assisté »). */
  mode?: string
  /** ⚠ `email_sent_at`, pas `sent_at` : ce dernier est un DEFAULT de création. */
  email_sent_at?: string
}

export type KycLookupResult =
  | { kind: 'matches'; count: number; matches: KycMatch[] }
  | { kind: 'too_many'; count: number; messageFr: string }
  | { kind: 'refused'; code: string; messageFr: string }

export type KycRegenerateResult =
  | { kind: 'requested' }
  | { kind: 'already_done' }
  | { kind: 'refused'; code: string; messageFr: string }

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {}

const opt = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)

/** Message de repli si le serveur en rendait un vide — il ne devrait jamais. */
const FALLBACK_MESSAGE = 'Demande refusée.'

export function readKycLookup(raw: unknown): KycLookupResult {
  const r = obj(raw)
  if (r.ok === true) {
    const data = obj(r.data)
    const matches = (Array.isArray(data.matches) ? data.matches : []).map(m => {
      const o = obj(m)
      return {
        link_id: String(o.link_id ?? ''),
        contact: opt(o.contact),
        email: opt(o.email),
        phone: opt(o.phone),
        agency: opt(o.agency),
        status: String(o.status ?? ''),
        mode: opt(o.mode),
        email_sent_at: opt(o.email_sent_at),
      }
    })
    return { kind: 'matches', count: Number(data.count ?? matches.length), matches }
  }

  const code = String(r.code ?? 'refused')
  const messageFr = opt(r.message_fr) ?? FALLBACK_MESSAGE
  if (code === 'too_many') {
    return { kind: 'too_many', count: Number(obj(r.details).count ?? 0), messageFr }
  }
  // `precondition_failed`, `not_found`, `rate_limited`, et tout code à venir :
  // le message du serveur est le seul texte juste, on le rend tel quel.
  return { kind: 'refused', code, messageFr }
}

export function readKycRegenerate(raw: unknown): KycRegenerateResult {
  const r = obj(raw)
  if (r.ok === true) {
    return obj(r.data).already_done === true ? { kind: 'already_done' } : { kind: 'requested' }
  }
  return {
    kind: 'refused',
    code: String(r.code ?? 'refused'),
    messageFr: opt(r.message_fr) ?? FALLBACK_MESSAGE,
  }
}

/**
 * Normalisation CLIENT de la requête, pour n'appeler le serveur que si le seuil
 * des 3 caractères peut être atteint.
 *
 * ⚠ Ce n'est PAS une copie exacte du serveur, et ça ne peut pas l'être : celui-ci
 * appelle `unaccent`, une table de translittération (`ß`→`ss`, `æ`→`ae`, `œ`→`oe`,
 * `ø`→`o`), là où une décomposition NFD ne touche aucun de ces caractères — ils ne
 * portent pas de marque combinante. Les quatre cas sont donc traités à la main,
 * précisément parce que ce sont des noms germanophones que ce produit sert.
 * En cas de divergence résiduelle, c'est le serveur qui tranche : son
 * `precondition_failed` s'affiche verbatim.
 */
export function kycNormalize(query: string): string {
  return (query ?? '')
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/æ/g, 'ae')
    .replace(/œ/g, 'oe')
    .replace(/ø/g, 'o')
    .replace(/ł/g, 'l')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[\s.\-()]/g, '')
}

/** Longueur minimale exigée par le serveur, mesurée sur la requête NORMALISÉE. */
export const KYC_QUERY_MIN = 3

/** Clé i18n du libellé d'un statut de lien. */
export const STATUS_LABEL_KEY: Record<string, string> = {
  pending: 'kycDiag.status.pending',
  opened: 'kycDiag.status.opened',
  uploaded: 'kycDiag.status.uploaded',
  submitted: 'kycDiag.status.submitted',
  expired: 'kycDiag.status.expired',
  cancelled: 'kycDiag.status.cancelled',
}

/** Étape atteinte dans la frise, par statut. `-1` = hors parcours. */
export const STATUS_STEP: Record<string, number> = {
  pending: 0,
  opened: 1,
  uploaded: 2,
  submitted: 3,
  expired: -1,
  cancelled: -1,
}

/**
 * Statuts pour lesquels le serveur REFUSE la régénération.
 *
 * Les afficher sans désactiver le bouton produirait un refus par clic sur deux
 * des cas les plus fréquents — dont « expiré », qui est justement la réponse la
 * plus probable au signalement que cet outil sert à traiter.
 */
export const REGEN_BLOCKED = ['submitted', 'expired']

export function canRegenerate(status: string): boolean {
  return !REGEN_BLOCKED.includes(status)
}
