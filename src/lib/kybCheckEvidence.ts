/**
 * Ce qu'un contrôle KYB a COMPARÉ, lisible d'un coup d'œil.
 *
 * ── Pourquoi ce module existe ───────────────────────────────────────────────────────
 *
 * La console de revue affichait le VERDICT d'un contrôle sans jamais montrer les VALEURS
 * qui l'ont produit. Sur « Raison sociale ↔ registre : Ne correspond pas », le relecteur
 * lisait le refus sans savoir ce que le registre dit ni ce que l'agence a déclaré : pour
 * trancher, il lui fallait déplier la ligne, ouvrir « Voir la réponse brute », et lire du
 * JSON. Deux gestes et un décodage pour comparer deux chaînes de caractères.
 *
 * ⚠ CE N'EST PAS UN CAS LIMITE, c'est le cas NOMINAL suisse. Une raison individuelle est
 * inscrite au registre du commerce sous « nom commercial - nom du titulaire » : le
 * dossier réel du 01.08.2026 déclare « Juarts » quand le registre dit « Juarts - Julien
 * Ahmedi ». Tout agent indépendant produira donc ce `mismatch`, et c'est exactement la
 * décision qu'un humain sait prendre en une seconde — à condition de voir les deux noms.
 *
 * ── Ce que ce module ne fait pas ───────────────────────────────────────────────────
 *
 * Il ne juge RIEN et ne remplace aucun verdict : il extrait, et rend `null` dès qu'il ne
 * sait pas. Un contrôle dont la preuve change de forme n'affiche alors pas de résumé, ce
 * qui est le bon repli — mieux vaut renvoyer le relecteur à la réponse brute que lui
 * montrer un couple faux.
 *
 * `raw_response` est du jsonb LIBRE côté base : chaque accès est défensif, aucune forme
 * n'est supposée. Même discipline que `isKybIdReadRecord`.
 */

/** Le couple comparé par un contrôle, tel qu'on veut le lire sur sa ligne. */
export interface KybEvidenceSummary {
  /** Ce que l'agence a saisi. Absent quand le contrôle ne compare pas une déclaration. */
  declared?: string
  /** Ce que la source a répondu. Plusieurs valeurs sont jointes par « · ». */
  found?: string
  /**
   * Le motif, quand la source en donne un — `existence_confirmed_status_not_published`
   * pour un registre qui ne publie pas le statut, `error` pour une source injoignable.
   *
   * ⚠ Rendu BRUT, jamais traduit ici : ce module est pur et sans i18n. C'est l'écran qui
   * décide s'il le traduit ou l'affiche tel quel.
   */
  note?: string
}

function asText(v: unknown): string | undefined {
  if (typeof v === 'string' && v.trim() !== '') return v.trim()
  if (typeof v === 'number' && Number.isFinite(v)) return String(v)
  return undefined
}

/** Plusieurs réponses de registre pour un même numéro : on les joint, on n'en choisit pas une. */
function asList(v: unknown): string | undefined {
  if (!Array.isArray(v)) return asText(v)
  const items = v.map(asText).filter((s): s is string => s != null)
  return items.length > 0 ? items.join(' · ') : undefined
}

/**
 * Résume ce qu'un contrôle a comparé, ou `null` si sa preuve ne s'y prête pas.
 *
 * Les clés varient d'une source à l'autre — c'est la raison d'être de ce `switch` plutôt
 * que d'une convention imposée aux connecteurs : ces preuves sont des réponses d'API
 * tierces, elles ne se plient pas à notre vocabulaire, et les faire mentir à l'écriture
 * coûterait la fidélité de la pièce à conviction.
 */
export function summarizeKybEvidence(checkType: string, raw: unknown): KybEvidenceSummary | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>

  // Une source injoignable n'a rien comparé : son seul contenu utile est POURQUOI.
  const erreur = asText(r.message) ?? asText(r.error_type)
  if (erreur && asText(r.reason) === 'error') return { note: erreur }

  const resume = ((): KybEvidenceSummary | null => {
    switch (checkType) {
      case 'registry_legal_name_match':
        return { declared: asText(r.declared_legal_name), found: asList(r.registry_legal_names) }
      case 'registry_country_match':
        return { declared: asText(r.declared_country), found: asText(r.registry_country) }
      case 'address_geocode':
        // `query` est la ligne d'adresse envoyée, `place_name` celle que Mapbox a résolue.
        return { declared: asText(r.query), found: asText(r.place_name) }
      case 'registry_number_format':
        // Un format se lit sur sa forme normalisée, pas sur un nom d'entité.
        return { declared: asText(r.declared), found: asText(r.normalized) }
      case 'registry_lookup':
        // L'existence se prouve par ce que le registre porte SOUS ce numéro.
        return { declared: asText(r.declared), found: asList(r.registry_legal_names) }
      default:
        return null
    }
  })()

  if (!resume) return null
  // Le motif accompagne le couple quand il existe — « existence confirmée, statut non
  // publié » explique un `partial` que les deux valeurs seules laisseraient inexpliqué.
  const note = asText(r.reason)
  const complet: KybEvidenceSummary = { ...resume, ...(note && note !== 'error' ? { note } : {}) }
  return complet.declared || complet.found || complet.note ? complet : null
}
