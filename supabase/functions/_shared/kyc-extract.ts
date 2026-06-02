// Pur (testable Node) : prompt OCR KYC, parser tolérant, et dérivations de typage.
// Aucun I/O, aucune clé. L'exécuteur impur (whatsapp-actions.ts) importe d'ici.

export type KycPersonType = 'buyer_pp' | 'buyer_pm' | 'seller_pp' | 'seller_pm'
export type KycDocCategory = 'identity' | 'address' | 'funds'

/** Prompt passé à read_document (Gemini) pour une extraction STRUCTURÉE en JSON.
 *  Champs PROPOSÉS, jamais traités comme vérité (validation humaine MLRO). */
export const KYC_DOC_PROMPT = `Tu es un OCR de conformité. Lis ce document et renvoie UNIQUEMENT un objet JSON valide (aucun texte autour, pas de markdown).
Si le document est une pièce d'identité : {"doc":"identite","type":"...","nom":"...","prenom":"...","numero":"...","naissance":"AAAA-MM-JJ","nationalite":"...","expiration":"AAAA-MM"}.
Si c'est un justificatif de fonds : {"doc":"fonds","montant":"...","devise":"CHF","date":"AAAA-MM-JJ","institution":"...","nature":"..."}.
Si c'est un justificatif de domicile : {"doc":"domicile","nom":"...","adresse":"...","date":"AAAA-MM-JJ"}.
Mets une chaîne vide pour tout champ illisible. Ne devine jamais. Réponds par {} si le document est inexploitable.`

/** Dérive le kyc_person_type depuis le contact (contacts.type + contacts.entity_type). */
export function deriveKycType(
  contactType: string | null | undefined,
  entityType: string | null | undefined,
): KycPersonType {
  const side = contactType === 'seller' || contactType === 'landlord' ? 'seller' : 'buyer'
  const company = entityType === 'pm'
  if (side === 'seller') return company ? 'seller_pm' : 'seller_pp'
  return company ? 'buyer_pm' : 'buyer_pp'
}

/** Body kyc-screening : entité morale (_pm) → 'entity', sinon 'individual'. */
export function kycTypeToEntityType(type: KycPersonType): 'individual' | 'entity' {
  return type.endsWith('_pm') ? 'entity' : 'individual'
}

/** Mappe une catégorie de pièce vers les 3 enums : checklist_items.category,
 *  kyc_magic_link_uploads.type, documents.document_category.
 *  Retourne null pour les catégories non-documentaires (pep/sanctions) ou inconnues. */
export function kycCategoryMaps(
  category: string,
): { checklist: string; upload: string; document: string } | null {
  switch (category) {
    case 'identity': return { checklist: 'id', upload: 'identity', document: 'identity' }
    case 'address': return { checklist: 'address', upload: 'address', document: 'domicile' }
    case 'funds': return { checklist: 'funds', upload: 'funds', document: 'financial' }
    default: return null
  }
}

/** Extrait un objet JSON d'une sortie OCR (tolérant : markdown, texte autour).
 *  Ne throw JAMAIS — renvoie {} si rien d'exploitable. */
export function parseKycOcr(text: string | null | undefined): Record<string, unknown> {
  if (!text) return {}
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end < start) return {}
  try {
    const parsed = JSON.parse(text.slice(start, end + 1))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {}
  } catch {
    return {}
  }
}
