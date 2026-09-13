/**
 * La date d'un fait de la timeline d'un contact — et la fusion qui garde les plus RÉCENTS.
 *
 * ⛔ `created_at` DIT QUAND LE JOURNAL A SU, PAS QUAND LE FAIT A EU LIEU. Pour un courrier,
 * les deux divergent : la passe initiale d'une boîte journalise 90 jours de courrier en
 * quelques heures, et chaque ligne portait le jour de la connexion — dans l'ordre INVERSE,
 * Gmail listant du plus récent au plus ancien. Trier par `created_at` puis garder 50 lignes
 * rendait les 50 courriers les plus VIEUX. La date du fait vit en `metadata.sent_at`
 * (`mailAuditEvent`, `_shared/mail/ingest.ts`), bornée à l'enregistrement dès l'écriture.
 */

/**
 * Les actions datées par le COURRIER. Miroir de `MailAuditAction` (`_shared/mail/ingest.ts`),
 * un autre runtime : `tests/unit/messagerie-timeline.spec.ts` compare les deux listes.
 * `document_filed_from_email` n'en est pas : c'est un geste humain, daté par son enregistrement.
 */
export const ACTIONS_DATEES_PAR_LE_COURRIER = ['email_received', 'email_sent'] as const

/** La même liste, au format du filtre PostgREST `not.in`. */
export const LISTE_COURRIER = `(${ACTIONS_DATEES_PAR_LE_COURRIER.join(',')})`

/**
 * Quand le fait a EU LIEU. Comparé en INSTANTS — PostgREST rend `created_at` en `+00:00`,
 * `sent_at` est en `Z` — et borné par l'enregistrement : un fait ne peut pas avoir eu lieu
 * après que le journal l'a su (défense en lecture ; l'écriture borne déjà).
 */
export function occurredAt(ev: { action: string; metadata: Record<string, unknown> | null; created_at: string }): string {
  const enregistre = Date.parse(ev.created_at)
  if (!(ACTIONS_DATEES_PAR_LE_COURRIER as readonly string[]).includes(ev.action) || !Number.isFinite(enregistre)) return ev.created_at
  const s = ev.metadata?.sent_at
  const t = typeof s === 'string' ? Date.parse(s) : Number.NaN
  return Number.isFinite(t) ? new Date(Math.min(t, enregistre)).toISOString() : ev.created_at
}

/**
 * Les `limite` faits les plus récents, par date du fait. Exact à partir de DEUX lectures
 * bornées : les `limite` non-courriers les plus récents par `created_at`, et les `limite`
 * courriers les plus récents par `sent_at` — leur réunion contient forcément le top.
 */
export function fusionnerTimeline<T extends { occurred_at: string; created_at: string }>(autres: T[], courriers: T[], limite: number): T[] {
  return [...autres, ...courriers]
    .sort((a, b) => (Date.parse(b.occurred_at) - Date.parse(a.occurred_at)) || (Date.parse(b.created_at) - Date.parse(a.created_at)))
    .slice(0, limite)
}
