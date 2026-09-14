/**
 * Jalons d'activation de l'agent → événements Intercom, envoyés UNE fois par agent.
 *
 * Cinq événements du registre (`INTERCOM_EVENTS`) sont des jalons : `profile_completed` et
 * les quatre `first_*`. Les Series d'onboarding ciblent « a fait X pour la première fois » ;
 * un jalon renvoyé à chaque session fausserait ce ciblage.
 *
 * Deux entrées :
 * - `markIntercomMilestone` : le geste qui franchit le jalon (bien publié, dossier KYC
 *   ouvert, match envoyé, profil à 100 %) le signale sur-le-champ ;
 * - `syncIntercomMilestones` : au boot identifié, constat en base des jalons pas encore
 *   envoyés. Il rattrape ce que l'app n'a pas vu : un dossier KYC ou un match passé par
 *   WhatsApp, un autre appareil, l'historique d'avant ce câblage. Aussi après la création
 *   d'un contact, parce que le seuil de 5 ne se voit qu'en comptant.
 *
 * Garde anti-doublon : `profiles.preferences.intercom` = { <événement>: <date ISO d'envoi> }.
 * En base, elle vaut pour tous les appareils de l'agent. Écrite par lecture-modification-
 * écriture, comme `useUiPreferences` pour sa sous-clé `ui`.
 *
 * Constats à l'échelle de l'AGENCE, comme l'ancienne checklist d'onboarding qui a défini
 * ces jalons : ni `kyc_cases` ni `matches` ne portent leur auteur. Un agent invité dans
 * une agence active reçoit donc les jalons déjà franchis par l'équipe.
 *
 * Best-effort : aucune erreur ne remonte au geste appelant. Un jalon manqué se rattrape au
 * prochain boot ; un jalon envoyé mais pas retenu (écriture échouée) repart une fois de
 * plus, ce qui ne coûte qu'un compteur dans Intercom. Aucune métadonnée : le signal seul
 * part, jamais une donnée client (frontière LPD).
 */
import { supabase } from '@/lib/supabase'
import type { Json } from '@/types/database'
import { INTERCOM_EVENTS, getIntercomUserId, trackIntercomEvent } from '@/lib/intercom'

export type IntercomMilestone =
  | typeof INTERCOM_EVENTS.PROFILE_COMPLETED
  | typeof INTERCOM_EVENTS.FIRST_CONTACTS_IMPORTED
  | typeof INTERCOM_EVENTS.FIRST_PROPERTY_CREATED
  | typeof INTERCOM_EVENTS.FIRST_KYC_CASE_OPENED
  | typeof INTERCOM_EVENTS.FIRST_MATCH_SENT

/** Sous-clé de `profiles.preferences` qui retient les jalons déjà envoyés. */
const PREF_KEY = 'intercom'

/** « Importer 5+ contacts » : le seuil de l'ancienne checklist d'onboarding. */
const CONTACTS_THRESHOLD = 5

type CountQuery = PromiseLike<{ count: number | null; error: unknown }>

/** Lignes comptées par une requête `head` ; 0 si la lecture échoue (le jalon attendra le prochain boot). */
async function counted(query: CountQuery): Promise<number> {
  const { count, error } = await query
  return error ? 0 : count ?? 0
}

const head = { count: 'exact', head: true } as const

// Constat en base de chaque jalon. `profile_completed` n'y figure pas : son score se calcule
// sur trois tables, et c'est l'écran Profil qui le signale (`useAgentProfileScreen`).
const CHECKS: readonly (readonly [IntercomMilestone, (agencyId: string) => Promise<boolean>])[] = [
  [INTERCOM_EVENTS.FIRST_CONTACTS_IMPORTED, async (agencyId) =>
    (await counted(supabase.from('contacts').select('id', head).eq('agency_id', agencyId)))
      >= CONTACTS_THRESHOLD],
  // Le wizard crée un brouillon dès la première saisie : un brouillon n'est pas un bien créé.
  [INTERCOM_EVENTS.FIRST_PROPERTY_CREATED, async (agencyId) =>
    (await counted(supabase.from('properties').select('id', head).eq('agency_id', agencyId)
      .neq('status', 'draft'))) > 0],
  [INTERCOM_EVENTS.FIRST_KYC_CASE_OPENED, async (agencyId) =>
    (await counted(supabase.from('kyc_cases').select('id', head).eq('agency_id', agencyId))) > 0],
  // `sent_at` et non `status = 'sent'` : la réaction du client (intéressé, visite, refus)
  // remplace le statut, et un match envoyé cesserait de compter.
  [INTERCOM_EVENTS.FIRST_MATCH_SENT, async (agencyId) =>
    (await counted(supabase.from('matches').select('id', head).eq('agency_id', agencyId)
      .not('sent_at', 'is', null))) > 0],
]

// Jalons déjà envoyés pour l'agent de la session : lus une fois, puis tenus à jour.
// Évite de recompter à chaque boot ce qui est acquis.
let guard: { userId: string; sent: Set<string> } | null = null
// File unique : un boot et un geste simultanés enverraient sinon le même jalon deux fois.
let queue: Promise<void> = Promise.resolve()

function enqueue(task: () => Promise<void>): Promise<void> {
  queue = queue.then(task).catch(() => undefined)
  return queue
}

async function readPreferences(userId: string): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.from('profiles').select('preferences').eq('id', userId).single()
  if (error) throw error
  const prefs = data?.preferences
  return prefs && typeof prefs === 'object' && !Array.isArray(prefs) ? (prefs as Record<string, unknown>) : {}
}

function sentIn(prefs: Record<string, unknown>): Record<string, string> {
  const sent = prefs[PREF_KEY]
  return sent && typeof sent === 'object' && !Array.isArray(sent) ? (sent as Record<string, string>) : {}
}

async function sessionGuard(userId: string): Promise<Set<string>> {
  if (guard?.userId !== userId) {
    guard = { userId, sent: new Set(Object.keys(sentIn(await readPreferences(userId)))) }
  }
  return guard.sent
}

/** Envoie le jalon puis le retient en base. Rien n'est retenu si rien n'est parti. */
async function send(userId: string, sent: Set<string>, milestone: IntercomMilestone): Promise<void> {
  // Relu frais : un autre appareil l'a peut-être envoyé depuis le début de la session,
  // et l'écriture ne doit pas écraser une sous-clé (`ui`…) posée entre-temps.
  const prefs = await readPreferences(userId)
  const already = sentIn(prefs)
  if (already[milestone]) {
    sent.add(milestone)
    return
  }
  // L'agent a pu changer pendant les lectures (déconnexion, autre compte) : le jalon d'un
  // agent ne part jamais sur la session d'un autre.
  if (getIntercomUserId() !== userId || !trackIntercomEvent(milestone)) return
  sent.add(milestone)
  const preferences = { ...prefs, [PREF_KEY]: { ...already, [milestone]: new Date().toISOString() } }
  const { error } = await supabase
    .from('profiles')
    .update({ preferences: preferences as unknown as Json })
    .eq('id', userId)
  if (error) throw error
}

/** Signale un jalon que le geste appelant vient de franchir. Envoyé une seule fois par agent. */
export function markIntercomMilestone(milestone: IntercomMilestone): Promise<void> {
  return enqueue(async () => {
    const userId = getIntercomUserId()
    if (!userId) return
    const sent = await sessionGuard(userId)
    if (!sent.has(milestone)) await send(userId, sent, milestone)
  })
}

/** Constate en base les jalons pas encore envoyés (tous, ou ceux d'`only`) et envoie ceux qui sont franchis. */
export function syncIntercomMilestones(agencyId: string, only?: readonly IntercomMilestone[]): Promise<void> {
  return enqueue(async () => {
    const userId = getIntercomUserId()
    if (!userId) return
    const sent = await sessionGuard(userId)
    for (const [milestone, reached] of CHECKS) {
      if (sent.has(milestone) || (only && !only.includes(milestone))) continue
      if (await reached(agencyId)) await send(userId, sent, milestone)
    }
  })
}
