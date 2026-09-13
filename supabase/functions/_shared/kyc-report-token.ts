/**
 * Jeton du rapport KYC — ce qui distingue un jeton de rendu d'un autre jeton signé par le
 * même secret.
 *
 * POURQUOI (audit du 13.09.2026, point S10). `kyc-report-data` est le seul endpoint porteur
 * qui serve des données d'IDENTITÉ : nom, nationalité, pièces, journal, décisions de
 * conformité d'un dossier. Il acceptait N'IMPORTE QUEL jeton valide et prenait son `id` pour
 * un `kyc_cases.id`, sans jeton stocké à comparer. Or le même secret HMAC signe des jetons
 * qui vivent longtemps et voyagent loin : les liens KYC (7 à 30 jours), les liens de
 * réception acheteur (jusqu'à 90 jours), les liens de désinscription (365 jours, dans
 * l'en-tête `List-Unsubscribe` de chaque courriel). Seule la non-collision des UUID d'une
 * table à l'autre empêchait d'en détourner un — une propriété statistique, pas un contrôle.
 *
 * Le jeton de rendu, lui, a deux traits qu'aucun autre ne partage : il ne porte AUCUN
 * discriminant `k` (tous les autres types en posent un, sauf les deux familles de liens —
 * KYC et réception — qui vivent des jours), et il vit cinq minutes (`kyc-report-pdf`). Un
 * plafond de dix minutes sur son échéance ferme donc toute la classe sans rien changer au
 * format des jetons déjà émis.
 *
 * Module PUR : ni I/O ni global Deno, importable depuis Node (vitest).
 */
import type { MagicLinkTokenPayload } from './magic-link-token.ts'

/** Durée de vie d'un jeton de rendu, fixée par l'unique émetteur (`kyc-report-pdf`). */
export const REPORT_TOKEN_TTL_S = 300

/**
 * Échéance maximale acceptée par `kyc-report-data`, comptée depuis maintenant. Le double de
 * la durée émise : la marge absorbe un écart d'horloge entre les deux fonctions, et reste
 * des jours en deçà du plus court des autres jetons.
 */
export const REPORT_TOKEN_MAX_TTL_S = 600

/**
 * Vrai si un payload DÉJÀ VÉRIFIÉ (signature et expiration) peut désigner un dossier de
 * rapport : aucun `k`, et une échéance à moins de `REPORT_TOKEN_MAX_TTL_S` secondes.
 * `nowSeconds` est injecté pour que le test fige l'horloge.
 */
export function isReportTokenPayload(payload: MagicLinkTokenPayload, nowSeconds: number): boolean {
  if (payload.k !== undefined) return false
  return payload.exp - nowSeconds <= REPORT_TOKEN_MAX_TTL_S
}
