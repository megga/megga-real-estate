// Rédaction PII de la REQUÊTE copilote (message + contexte + historique) avant
// tout envoi au LLM. Module PUR (zéro I/O, zéro Deno) — testable vitest.
//
// Périmètre : les identifiants sensibles catalogués par pii-redaction.ts (AVS,
// IBAN, carte, passeport, mot de passe, clé API, date de naissance). On ne
// touche PAS aux noms/emails de contact : un brouillon de relance a besoin du
// nom pour la salutation (flux déclenché par l'agent), et cette question de
// résidence est tranchée ailleurs. Ici on ferme le trou « l'agent colle un
// message client contenant un IBAN / N° AVS » (cf. en-tête de pii-redaction.ts).

import { redactPII, formatRedactionSummary, type RedactionKind } from './pii-redaction.ts'

export interface ChatTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface RedactedRequest {
  message: string
  context: Record<string, unknown> | undefined
  history: ChatTurn[]
  /** Total de substitutions opérées (0 = requête propre). */
  total: number
  /** Résumé compact pour l'audit (ex. « AVS×1, IBAN×2 »), '' si rien. */
  summary: string
}

/** Rédacte récursivement les chaînes d'un objet contexte (1 niveau de
 *  profondeur suffit : serializeContext fait un JSON.stringify des objets,
 *  donc on rédige aussi les valeurs imbriquées via leur sérialisation). */
function redactValue(v: unknown, counts: Record<RedactionKind, number>): unknown {
  if (typeof v === 'string') {
    const r = redactPII(v)
    for (const [k, n] of Object.entries(r.counts)) counts[k as RedactionKind] += n
    return r.redactedText
  }
  if (Array.isArray(v)) return v.map((x) => redactValue(x, counts))
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = redactValue(val, counts)
    return out
  }
  return v
}

/** Rédacte message + contexte + historique en une passe. Idempotent. */
export function redactCopilotRequest(params: {
  message: string
  context?: Record<string, unknown>
  history?: ChatTurn[]
}): RedactedRequest {
  const counts: Record<RedactionKind, number> = {
    AVS: 0, IBAN: 0, CARD: 0, PASSPORT: 0, PASSWORD: 0, API_KEY: 0, DOB: 0, ACCESS_CODE: 0,
  }

  const msg = redactPII(params.message || '')
  for (const [k, n] of Object.entries(msg.counts)) counts[k as RedactionKind] += n

  const context = params.context
    ? (redactValue(params.context, counts) as Record<string, unknown>)
    : undefined

  const history = (params.history ?? []).map((h) => {
    const r = redactPII(h.content || '')
    for (const [k, n] of Object.entries(r.counts)) counts[k as RedactionKind] += n
    return { role: h.role, content: r.redactedText }
  })

  const total = Object.values(counts).reduce((a, b) => a + b, 0)
  return { message: msg.redactedText, context, history, total, summary: formatRedactionSummary(counts) }
}
