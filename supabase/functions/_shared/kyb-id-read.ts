// Lecture assistée de la pièce d'identité d'un dirigeant (KYB, étape 3 du wizard).
// Pur et testable sans réseau : prompt, parseur tolérant, normalisation, comparaison
// avec la personne DÉCLARÉE, verdict. Aucun I/O, aucune clé — l'exécuteur impur est
// supabase/functions/kyb-identity-read/index.ts.
//
// CE QUE CE MODULE N'EST PAS. Il ne vérifie personne. Il compare ce qu'une pièce
// donne à lire avec ce que le dirigeant a saisi à l'étape 1, et le dit. Le verdict
// n'a AUCUN effet sur `verification_score` ni sur les vétos : le seul check en base
// pour la pièce d'identité reste `id_document` / `pending_manual_review`, posé par
// submit_agency_identity() et tranché par un humain (admin_resolve_agency_id_document).
// Règle du dépôt : l'IA est compliance-ENABLING, jamais compliance-REPLACING.
//
// CE QU'IL NE STOCKE PAS. Ni le nom lu, ni le prénom lu, ni le numéro de la pièce.
// Le prompt demande explicitement de ne pas rendre le numéro, et la sortie ne garde
// que des VERDICTS par champ — un relecteur qui veut la valeur exacte a l'image sous
// les yeux (IdDocumentPreview, console KYB). Minimisation LPD : on n'écrit pas une
// seconde copie de la PII pour dire qu'elle correspond à la première.

/** Ce que la lecture rend pour un champ comparé à la déclaration. */
export type KybIdFieldVerdict = 'exact' | 'approx' | 'differs' | 'unreadable'

/** Synthèse des trois champs comparés. */
export type KybIdVerdict = 'match' | 'partial' | 'mismatch' | 'unreadable'

/** L'identité DÉCLARÉE à l'étape 1, telle qu'elle est en base. */
export interface KybDeclaredIdentity {
  firstName: string
  lastName: string
  /** ISO court 'YYYY-MM-DD', ou null si la colonne est vide. */
  dateOfBirth: string | null
}

/** L'extraction brute renvoyée par le modèle, après parsing — jamais persistée telle quelle. */
export interface KybIdExtraction {
  lastName: string
  firstName: string
  dateOfBirth: string | null
  /** 'YYYY-MM-DD' normalisé (une échéance au mois est ramenée au dernier jour du mois). */
  expiresOn: string | null
  /** Nature LUE sur la pièce, vocabulaire du CHECK `id_document_type`, ou null. */
  documentType: 'passport' | 'id_card' | 'residence_permit' | null
}

/** Ce que l'edge function écrit dans `agency_related_persons.id_document_read`. */
export interface KybIdReadRecord {
  model: string
  verdict: KybIdVerdict
  fields: {
    firstName: KybIdFieldVerdict
    lastName: KybIdFieldVerdict
    dateOfBirth: KybIdFieldVerdict
  }
  /** Nature lue vs nature déclarée à l'étape 3 — null si l'une des deux manque. */
  documentTypeMatches: boolean | null
  expiresOn: string | null
  /** true si la pièce est périmée à la date de lecture. null si aucune échéance lisible. */
  expired: boolean | null
}

/**
 * Prompt d'extraction. Sortie JSON stricte (`json: true` côté readDocument), champs
 * vides plutôt qu'inventés — même discipline que KYC_DOC_PROMPT (kyc-extract.ts),
 * dont c'est le pendant côté dirigeant.
 *
 * Le NUMÉRO de la pièce est explicitement exclu : le dépôt le désigne comme la PII
 * sensible de cette table (commentaire de colonne, migration 20260729150200), rien
 * n'en fait usage, et ce qui n'est pas demandé ne risque pas d'être journalisé.
 *
 * Les deux faces peuvent être envoyées en deux appels : sur une carte d'identité
 * suisse, le nom est au recto et l'échéance au dos. D'où des champs vides tolérés
 * partout, et une fusion côté appelant (mergeExtractions).
 */
export const KYB_ID_PROMPT = `Tu lis une pièce d'identité officielle (passeport, carte d'identité ou titre de séjour), ou l'une de ses deux faces.
Renvoie UNIQUEMENT un objet JSON valide, sans texte autour et sans markdown :
{"nom":"","prenom":"","naissance":"AAAA-MM-JJ","expiration":"AAAA-MM-JJ","type":"passport|id_card|residence_permit|"}
- "nom" : nom de famille tel qu'imprimé. "prenom" : prénom(s) tels qu'imprimés.
- "naissance" et "expiration" : dates complètes. Si seul le mois est lisible, écris "AAAA-MM".
- "type" : la nature du document si elle est certaine, sinon "".
- Mets une chaîne vide pour TOUT champ absent de cette face ou illisible. N'invente jamais.
- Ne renvoie JAMAIS le numéro du document, ni aucun autre champ que ceux listés.
Réponds {} si l'image n'est pas une pièce d'identité.`

/** Le modèle de vision utilisé — figé ici pour être journalisé avec le verdict. */
export const KYB_ID_READ_MODEL = 'gemini-2.5-flash-lite'

function asTrimmed(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/**
 * Normalise un nom pour la COMPARAISON seulement : sans accents, en majuscules, et
 * les séparateurs (tiret, apostrophe, points) ramenés à l'espace.
 *
 * « Jean-Pierre » et « JEAN PIERRE », « Müller » et « MULLER », « D'Amico » et
 * « D AMICO » désignent la même personne sur un passeport : la zone lisible par
 * machine translittère, la zone imprimée non. Comparer les chaînes brutes aurait
 * rendu « differs » sur la moitié des dossiers suisses.
 */
export function normalizeName(value: string): string {
  return value
    .normalize('NFD')
    // Les diacritiques combinants détachés par NFD — écrits par point de code, un
    // littéral collé ici serait invisible à la relecture et fragile au copier-coller.
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

/** Les mots d'un nom normalisé, sans doublon — « JEAN PIERRE » -> ['JEAN','PIERRE']. */
function nameTokens(value: string): string[] {
  const normalized = normalizeName(value)
  return normalized ? [...new Set(normalized.split(' '))] : []
}

/**
 * Compare un nom lu à un nom déclaré.
 *
 * `approx` couvre les deux écarts légitimes et fréquents : un prénom composé dont
 * un seul élément est déclaré (« Jean » vs « Jean Pierre »), et un nom double dont
 * la pièce ne porte qu'une partie (nom de naissance vs nom d'alliance). Ce n'est
 * jamais un feu vert — c'est ce qui distingue « à regarder » de « ne correspond
 * pas », pour que le relecteur sache où porter les yeux.
 */
export function compareName(read: string, declared: string): KybIdFieldVerdict {
  const readTokens = nameTokens(read)
  const declaredTokens = nameTokens(declared)
  if (readTokens.length === 0) return 'unreadable'
  if (declaredTokens.length === 0) return 'unreadable'
  if (normalizeName(read) === normalizeName(declared)) return 'exact'
  const shared = readTokens.filter((tok) => declaredTokens.includes(tok))
  return shared.length > 0 ? 'approx' : 'differs'
}

/**
 * Compare une date lue à une date déclarée. Aucune tolérance : une date de naissance
 * est soit la même, soit une autre personne. Une lecture au mois seul ('AAAA-MM')
 * ne peut pas trancher un jour — elle rend `approx` si le mois concorde.
 */
export function compareBirthDate(read: string | null, declared: string | null): KybIdFieldVerdict {
  if (!read) return 'unreadable'
  if (!declared) return 'unreadable'
  if (read === declared) return 'exact'
  if (read.length === 7 && declared.startsWith(read)) return 'approx'
  return 'differs'
}

/**
 * Normalise une échéance vers 'YYYY-MM-DD'.
 *
 * Une lecture au mois ('AAAA-MM') est ramenée au DERNIER jour du mois : un document
 * qui expire « 04/2029 » est valable jusqu'à la fin avril. Arrondir au premier du
 * mois déclarerait périmée une pièce encore valable pendant trente jours — l'erreur
 * qui coûte, ici, est celle qui refuse à tort.
 */
export function normalizeExpiry(raw: string): string | null {
  const value = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const monthOnly = /^(\d{4})-(\d{2})$/.exec(value)
  if (!monthOnly) return null
  const year = Number(monthOnly[1])
  const month = Number(monthOnly[2])
  if (month < 1 || month > 12) return null
  // Jour 0 du mois SUIVANT = dernier jour du mois demandé, années bissextiles comprises.
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate()
  return `${monthOnly[1]}-${monthOnly[2]}-${String(lastDay).padStart(2, '0')}`
}

/** Normalise une date de naissance : complète, ou au mois, sinon null. Jamais une date reconstruite. */
function normalizeBirth(raw: string): string | null {
  const value = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(value) || /^\d{4}-\d{2}$/.test(value)) return value
  return null
}

const DOCUMENT_TYPES = ['passport', 'id_card', 'residence_permit'] as const

/**
 * Parse la réponse du modèle. Tolérant par construction : toute forme inattendue
 * devient un champ vide, jamais une exception — une extraction ratée doit dégrader
 * l'écran en « non lu », pas faire échouer le dépôt d'un document parfaitement valable.
 * null si la réponse n'est pas un objet JSON exploitable.
 */
export function parseKybIdExtraction(raw: string): KybIdExtraction | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return null
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
  const o = parsed as Record<string, unknown>
  const typeRaw = asTrimmed(o.type)
  return {
    lastName: asTrimmed(o.nom),
    firstName: asTrimmed(o.prenom),
    dateOfBirth: normalizeBirth(asTrimmed(o.naissance)),
    expiresOn: normalizeExpiry(asTrimmed(o.expiration)),
    documentType: (DOCUMENT_TYPES as readonly string[]).includes(typeRaw)
      ? (typeRaw as KybIdExtraction['documentType'])
      : null,
  }
}

/**
 * Fusionne les extractions des deux faces. Une carte d'identité suisse porte le nom
 * au recto et l'échéance au dos : aucune face ne suffit, et chacune rend des champs
 * vides pour ce qu'elle ne montre pas.
 *
 * Règle : la PREMIÈRE valeur non vide gagne, dans l'ordre des faces reçues (recto
 * d'abord). Jamais une moyenne ni un arbitrage — si les deux faces se contredisent
 * sur un champ, c'est un cas pour l'œil humain, pas pour une règle de départage.
 */
export function mergeExtractions(extractions: Array<KybIdExtraction | null>): KybIdExtraction | null {
  const usable = extractions.filter((e): e is KybIdExtraction => e != null)
  if (usable.length === 0) return null
  return {
    lastName: usable.map((e) => e.lastName).find((v) => v !== '') ?? '',
    firstName: usable.map((e) => e.firstName).find((v) => v !== '') ?? '',
    dateOfBirth: usable.map((e) => e.dateOfBirth).find((v) => v != null) ?? null,
    expiresOn: usable.map((e) => e.expiresOn).find((v) => v != null) ?? null,
    documentType: usable.map((e) => e.documentType).find((v) => v != null) ?? null,
  }
}

/**
 * Synthèse des trois champs.
 *
 * L'ordre des règles est le sujet : un seul `differs` suffit à faire `mismatch`,
 * parce qu'un nom qui ne correspond pas n'est pas rattrapé par une date qui
 * correspond. À l'inverse, `match` exige les TROIS en `exact` — un champ illisible
 * n'est pas une concordance, c'est une absence de preuve, et il doit rester visible
 * au relecteur plutôt que disparaître dans un verdict vert.
 */
export function deriveVerdict(fields: KybIdReadRecord['fields']): KybIdVerdict {
  const values = [fields.firstName, fields.lastName, fields.dateOfBirth]
  if (values.every((v) => v === 'unreadable')) return 'unreadable'
  if (values.some((v) => v === 'differs')) return 'mismatch'
  if (values.every((v) => v === 'exact')) return 'match'
  return 'partial'
}

/**
 * Construit la ligne à persister depuis l'extraction et la déclaration.
 *
 * `today` est un PARAMÈTRE et non un `new Date()` interne : la péremption est la
 * seule sortie de ce module qui dépende du temps, et un test qui la vérifierait
 * contre l'horloge réelle deviendrait faux tout seul (piège déjà rencontré sur la
 * frontière de journée civile suisse).
 */
export function buildReadRecord(
  extraction: KybIdExtraction | null,
  declared: KybDeclaredIdentity,
  declaredDocumentType: string | null,
  today: string,
): KybIdReadRecord {
  const fields: KybIdReadRecord['fields'] = {
    firstName: compareName(extraction?.firstName ?? '', declared.firstName),
    lastName: compareName(extraction?.lastName ?? '', declared.lastName),
    dateOfBirth: compareBirthDate(extraction?.dateOfBirth ?? null, declared.dateOfBirth),
  }
  const expiresOn = extraction?.expiresOn ?? null
  return {
    model: KYB_ID_READ_MODEL,
    verdict: deriveVerdict(fields),
    fields,
    documentTypeMatches: extraction?.documentType && declaredDocumentType
      ? extraction.documentType === declaredDocumentType
      : null,
    expiresOn,
    // Comparaison de chaînes ISO, jamais de Date : 'YYYY-MM-DD' s'ordonne
    // lexicographiquement, et deux dates-seules n'ont pas d'instant à comparer.
    // Le jour de l'échéance lui-même compte comme valable.
    expired: expiresOn ? expiresOn < today : null,
  }
}
