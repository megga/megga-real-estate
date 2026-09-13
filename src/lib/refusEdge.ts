/**
 * Le motif d'un refus d'edge function, lu dans le CORPS de la réponse.
 *
 * ⛔ `functions.invoke` range toute réponse non-2xx dans `error`, dont le message est
 * « Edge Function returned a non-2xx status code » : le motif du serveur (`KYC_PENDING`,
 * `SOLE_ADMIN`…) est dans le corps, et un écran qui ne le lit pas ne peut rien dire de
 * juste. Même dépaquetage que `src/lib/mail/invoke.ts`, rendu générique pour les edges qui
 * répondent `{ error, message?, count? }`.
 */
import { FunctionsHttpError } from '@supabase/supabase-js'

/** Ce qu'un refus dit, une fois le corps lu. */
export interface RefusEdge {
  /** Statut HTTP ; 0 = le serveur n'a pas répondu (réseau, relais). */
  status: number
  /** Code stable en MAJUSCULES (`KYC_PENDING`…), quand l'edge en rend un. */
  code: string | null
  /** Texte du serveur : `message`, sinon `error` quand ce n'est pas un code. */
  texte: string | null
  /** Nombre porté par certains refus (dossiers KYC en cours). */
  count: number | null
}

/** Erreur levée par un appel d'edge : le refus lu y voyage jusqu'au `onError` de l'écran. */
export class ErreurEdge extends Error {
  readonly refus: RefusEdge
  constructor(refus: RefusEdge) {
    super(refus.texte ?? refus.code ?? `http_${refus.status}`)
    this.name = 'ErreurEdge'
    this.refus = refus
  }
}

/** Lit le refus porté par l'erreur de `functions.invoke`. Ne lève jamais. */
export async function lireRefusEdge(error: unknown): Promise<RefusEdge> {
  if (!(error instanceof FunctionsHttpError)) {
    return { status: 0, code: null, texte: error instanceof Error ? error.message : null, count: null }
  }
  const reponse = error.context as Response | undefined
  const status = reponse?.status ?? 500
  let corps: Record<string, unknown> = {}
  try { corps = (await reponse!.json()) as Record<string, unknown> } catch { /* corps absent ou non JSON */ }
  const brut = typeof corps.error === 'string' ? corps.error : null
  const code = brut && /^[A-Z][A-Z0-9_]*$/.test(brut) ? brut : null
  return {
    status,
    code,
    texte: typeof corps.message === 'string' ? corps.message : code ? null : brut,
    count: typeof corps.count === 'number' ? corps.count : null,
  }
}
