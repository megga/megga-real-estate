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

// ─── Import d'un RAPPORT KYC externe (Persona / partenaire) ──────────────
// Voie « Importer un dossier externe » du wizard. Le rapport est lu par Gemini,
// les contrôles couverts (identité / PEP / sanctions) sont PROPOSÉS et laissés
// À VALIDER par l'agent (garde-fou MLRO) — jamais traités comme vérité.

export const KYC_REPORT_PROMPT = `Tu es un OCR de conformité. On te donne un RAPPORT de vérification KYC/AML externe (par ex. Persona, ComplyAdvantage, Onfido, ou un rapport partenaire). Renvoie UNIQUEMENT un objet JSON valide (aucun texte autour, pas de markdown) :
{"fournisseur":"...","date":"AAAA-MM-JJ","identite":"verifie|non_verifie|absent","pep":"aucun|correspondance|absent","sanctions":"aucun|correspondance|absent"}
- "fournisseur" : nom de l'émetteur du rapport si visible, sinon "".
- "identite" : "verifie" si le rapport atteste une pièce d'identité vérifiée, "non_verifie" si échec, "absent" si non couvert.
- "pep" : résultat du screening Personne Exposée Politiquement ("aucun" = 0 correspondance).
- "sanctions" : résultat du screening listes de sanctions (OFAC/SECO/ONU/UE).
Mets "absent" si le rapport ne couvre pas le point. Ne devine JAMAIS. Réponds {} si inexploitable.`

export interface KycReportCheck {
  key: string
  result: string
}
export interface KycReportExtract {
  provider: string | null
  reportDate: string | null
  checks: KycReportCheck[]
  missing: string[]
}

function asStr(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null
}
function idResult(v: unknown): string | null {
  const s = asStr(v)
  if (s === 'verifie') return 'Vérifiée'
  if (s === 'non_verifie') return 'À revoir'
  return null // absent / inconnu → non couvert
}
function screenResult(v: unknown): string | null {
  const s = asStr(v)
  if (s === 'aucun') return '0 correspondance'
  if (s === 'correspondance') return 'Correspondance à examiner'
  return null
}

/** Normalise la sortie OCR d'un rapport externe vers la forme consommée par le
 *  wizard (KwStepImport) : contrôles couverts + pièces restant à compléter. */
export function normalizeKycReport(raw: Record<string, unknown>): KycReportExtract {
  const checks: KycReportCheck[] = []
  const id = idResult(raw.identite)
  if (id) checks.push({ key: "Pièce d'identité", result: id })
  const pep = screenResult(raw.pep)
  if (pep) checks.push({ key: 'Screening PEP', result: pep })
  const sanctions = screenResult(raw.sanctions)
  if (sanctions) checks.push({ key: 'Sanctions', result: sanctions })
  return {
    provider: asStr(raw.fournisseur),
    reportDate: asStr(raw.date),
    checks,
    // Le rapport externe ne couvre pas ces deux pièces déclaratives.
    missing: ['Justificatif de domicile', 'Source des fonds'],
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
