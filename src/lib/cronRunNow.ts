/**
 * Lecture de l'enveloppe du geste ops « Relancer un cron » (RPC `admin_cron_run_now`,
 * étape 28) et mise en forme de l'heure annoncée. Pur et déterministe — le fuseau est
 * injectable, comme `now` l'est dans `cronHealth.ts`.
 *
 * Pourquoi une lecture DÉDIÉE plutôt que le `deballer` générique de `useChangelog` :
 * ce geste a trois issues, pas deux. Le serveur peut REFUSER en demandant une
 * confirmation (`details.needs_confirm`), et ce refus-là n'est pas une erreur à
 * afficher mais une modale à ouvrir. Un déballage générique le transformerait en
 * message d'échec, et le geste serait inatteignable sur les 20 crons qui écrivent
 * vraiment à quelqu'un.
 *
 * ⚠ Le tri se fait sur le DRAPEAU, jamais sur le code : `precondition_failed` couvre
 * aussi « pg_cron absent » et « cron désactivé », qui sont des refus définitifs.
 *
 * ⚠ La liste des crons « inertes » n'est PAS recopiée ici. C'est la base qui tranche
 * (`admin_cron_job_is_inert`), et son commentaire le dit : une confirmation qui ne
 * vivrait que dans l'écran se contournerait par un appel direct à la RPC. Un double
 * de la liste côté client se périmerait en silence à la première divergence.
 */

/**
 * Les trois issues du geste, une fois l'enveloppe §10.1 lue.
 *
 * `needs_confirm` transporte le message du SERVEUR : c'est lui qui sait pourquoi ce
 * cron-là mérite une confirmation, et la modale l'affiche verbatim plutôt que d'en
 * réécrire une version qui divergerait au premier ajout à la liste des inertes.
 */
export type CronRunNowOutcome =
  | { kind: 'requested'; scheduledForIso: string }
  | { kind: 'already_done' }
  | { kind: 'needs_confirm'; messageFr: string }

/** Forme minimale attendue ; tout est `unknown` parce que rien ne garantit la forme d'un jsonb. */
interface Enveloppe {
  ok?: unknown
  code?: unknown
  message_fr?: unknown
  details?: unknown
  data?: unknown
}

/**
 * Message de repli quand la réponse ne respecte pas le contrat. En français comme le
 * reste de l'enveloppe : `message_fr` est le SEUL texte que le serveur transporte, et
 * l'écran affiche celui-là verbatim — un repli traduit donnerait deux voix au même geste.
 */
const HORS_CONTRAT = 'Réponse inattendue du serveur : la relance n\'a pas pu être confirmée.'

function estObjet(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object'
}

/**
 * Traduit la réponse de `admin_cron_run_now` en issue exploitable, ou lève le message
 * serveur. Lève aussi sur un succès sans horodatage : mieux vaut un échec visible qu'un
 * « prochain passage » vide, puisque c'est l'heure qui fait tout l'intérêt du libellé.
 */
export function readCronRunNow(reponse: unknown): CronRunNowOutcome {
  if (!estObjet(reponse)) throw new Error(HORS_CONTRAT)
  const e = reponse as Enveloppe

  if (e.ok === false) {
    if (estObjet(e.details) && e.details.needs_confirm === true) {
      return { kind: 'needs_confirm', messageFr: typeof e.message_fr === 'string' ? e.message_fr : '' }
    }
    if (typeof e.message_fr === 'string' && e.message_fr.trim()) throw new Error(e.message_fr)
    if (typeof e.code === 'string' && e.code.trim()) throw new Error(e.code)
    throw new Error(HORS_CONTRAT)
  }
  if (e.ok !== true) throw new Error(HORS_CONTRAT)

  if (estObjet(e.data)) {
    if (e.data.already_done === true) return { kind: 'already_done' }
    const quand = e.data.scheduled_for
    if (typeof quand === 'string' && quand.trim()) return { kind: 'requested', scheduledForIso: quand }
  }
  throw new Error(HORS_CONTRAT)
}

/**
 * `2026-08-02T13:12:00Z` → `15:12` — l'heure du LECTEUR, pas celle du serveur.
 *
 * Le serveur scelle et journalise en UTC explicite (une empreinte qui dépendrait du
 * fuseau de session produirait deux signatures pour le même effet). L'écran, lui,
 * s'adresse à quelqu'un qui regarde une horloge : afficher `13:12` à un opérateur
 * genevois qui verra le cron partir à 15:12 serait un mensonge de deux heures.
 *
 * `timeZone` laissé vide = fuseau du navigateur ; on ne le fixe que dans les tests.
 * Rend `null` plutôt qu'« Invalid Date » : l'appelant annonce alors la relance sans heure.
 */
export function formatNextRun(iso: string, timeZone?: string): string | null {
  const ms = Date.parse(iso)
  if (!Number.isFinite(ms)) return null
  return new Date(ms).toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit', timeZone })
}
