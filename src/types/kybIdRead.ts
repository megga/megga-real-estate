// MEGGA — Verdict de la lecture assistée d'une pièce d'identité KYB (étape 3 du wizard).
//
// Miroir CLIENT du contrat produit par l'edge function : la source de vérité est
// supabase/functions/_shared/kyb-id-read.ts, et la colonne qui le porte est
// agency_related_persons.id_document_read (migration 20260803150000).
//
// Pourquoi une copie plutôt qu'un import : `src/` est le bundle navigateur et
// `supabase/functions/` tourne sous Deno — deux runtimes séparés qu'on ne fait pas
// s'importer (règle §4 du CLAUDE.md). Même précédent que src/types/magicLink.ts.
//
// ⚠ Ce type ne porte AUCUNE donnée lue sur la pièce : ni nom, ni prénom, ni date de
// naissance, ni numéro. Uniquement des verdicts de comparaison avec l'identité
// déclarée. Si un champ « valeur lue » apparaissait ici un jour, ce serait une
// seconde copie de la PII à faire vivre, purger et protéger — la question est
// tranchée du côté du prompt, qui ne la demande pas.

/** Ce que la lecture rend pour un champ, face à ce que le dirigeant a déclaré. */
export type KybIdFieldVerdict = 'exact' | 'approx' | 'differs' | 'unreadable'

/** Synthèse des trois champs comparés. */
export type KybIdVerdict = 'match' | 'partial' | 'mismatch' | 'unreadable'

export interface KybIdReadRecord {
  /**
   * Qui a produit ce verdict. Absent sur les lectures par modèle (`kyb-id-read`), qui
   * portent `model` à la place ; `'stripe_identity'` quand c'est le prestataire.
   *
   * ⚠ La distinction n'est PAS cosmétique côté relecteur : une lecture par modèle dit
   * ce qui est imprimé sur une image, une vérification par le prestataire dit en plus
   * que le document est authentique et que le visage présenté correspond. Afficher le
   * même mot pour les deux ferait sous-estimer la seconde au moment de trancher.
   */
  provider?: string
  /** Modèle de vision utilisé, journalisé avec le verdict — absent sur un verdict prestataire. */
  model?: string
  verdict: KybIdVerdict
  fields: {
    firstName: KybIdFieldVerdict
    lastName: KybIdFieldVerdict
    dateOfBirth: KybIdFieldVerdict
  }
  /** Nature lue vs nature déclarée à l'étape 3 — null si l'une des deux manque. */
  documentTypeMatches: boolean | null
  /** 'YYYY-MM-DD', ou null si aucune échéance n'a pu être lue. */
  expiresOn: string | null
  /** true si la pièce était périmée le jour de la lecture. null = échéance inconnue, jamais « valable ». */
  expired: boolean | null
}

/**
 * Vrai si cette valeur de colonne a la forme attendue. `id_document_read` est du jsonb
 * libre côté base : une ligne écrite par une version antérieure du contrat, ou par une
 * main humaine, ne doit pas faire planter l'écran qui l'affiche.
 */
export function isKybIdReadRecord(value: unknown): value is KybIdReadRecord {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.verdict === 'string'
    && ['match', 'partial', 'mismatch', 'unreadable'].includes(v.verdict)
}
