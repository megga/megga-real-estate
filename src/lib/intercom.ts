// src/lib/intercom.ts
// Intercom Messenger — boot / identify / track wrapper. Miroir de `posthog.ts`.
//
// Intercom est le système de support UNIQUE de MEGGA (Messenger + Fin + Inbox +
// Help Center). C'est une intégration PLATEFORME bootée globalement (≠ connexion
// par-agent type Google/Skribble → ne va PAS dans IntegrationsSection).
//
// Données : région US (contrainte plan startup Intercom ; la région est fixée à la
// création du workspace et irréversible). ⚠️ FLAG nLPD : données de support hébergées
// aux US — à migrer en EU au passage sur un plan supérieur. Frontière qui limite le
// risque : Intercom = utilisateurs SaaS (prospects + agents), JAMAIS les clients
// finaux des agents (eux = WhatsApp + CRM, données sensibles).
// L'identité vérifiée (user_hash HMAC) vient de l'edge function `intercom-identity`
// (le secret ne quitte jamais le serveur).
// Import NOMMÉ (pas default) : le paquet est en CommonJS et l'interop ESM de Vite
// ne résout pas le default en fonction. L'export nommé `Intercom`, lui, est fiable.
import {
  Intercom,
  update as sdkUpdate,
  shutdown as sdkShutdown,
  showSpace as sdkShowSpace,
  showArticle as sdkShowArticle,
  trackEvent as sdkTrackEvent,
} from '@intercom/messenger-js-sdk'
import { sanitizeIntercomArgs } from './intercom-allowlist'

// Seule la production parle à Intercom. Un poste de développement boote avec son propre
// projet Supabase, donc avec d'autres `user_id` : c'est ce qui dédoublait les fiches
// (un même e-mail sous 2 à 4 fiches, plan Intercom §2 et §3.1). Pour essayer le Messenger
// en local : `VITE_INTERCOM_FORCE_DEV=true`, comme `VITE_SENTRY_FORCE_DEV` pour Sentry.
const APP_ID = import.meta.env.PROD || import.meta.env.VITE_INTERCOM_FORCE_DEV === 'true'
  ? (import.meta.env.VITE_INTERCOM_APP_ID as string | undefined)
  : undefined

/** Filtre LPD : ne laisse passer que les clés allowlistées + alerte en dev si on en bloque. */
function guardArgs(args: IntercomBootArgs): Record<string, unknown> {
  const { sanitized, dropped } = sanitizeIntercomArgs(args)
  if (dropped.length && import.meta.env.DEV) {
    console.error('[intercom] clés bloquées (hors allowlist LPD, frontière agents-only) :', dropped)
  }
  return sanitized
}

export interface IntercomBootArgs {
  user_id?: string
  email?: string
  name?: string
  /** Unix timestamp en secondes (date d'inscription). */
  created_at?: number
  /** JWT « Messenger Security » (HS256) émis par l'edge `intercom-identity`. */
  intercom_user_jwt?: string
  /** company_id + name (seules clés d'entreprise de l'allowlist — cf. intercom-allowlist.ts). */
  company?: { company_id: string; name?: string; [key: string]: unknown }
  /** Produit d'origine : l'espace Intercom est partagé (la holding envoie 'holding', Shield 'shield'). */
  produit?: 'crm'
  [key: string]: unknown
}

let booted = false
// Agent de la session, seulement si son identité est VÉRIFIÉE (user_id ET JWT).
// Sans JWT, un espace qui exige l'identité vérifiée refuse la session : un événement
// qui y partirait se perdrait sans bruit. Et en impersonation le boot est anonyme,
// donc un événement y serait attribué à un visiteur au lieu de l'agent.
let identifiedUserId: string | null = null

/**
 * Boote (ou re-boote) le Messenger. Anonyme si aucun argument utilisateur.
 * No-op tant que `VITE_INTERCOM_APP_ID` n'est pas défini (comme PostHog sans clé), et hors
 * production sauf `VITE_INTERCOM_FORCE_DEV=true`.
 */
export function bootIntercom(args: IntercomBootArgs = {}) {
  if (!APP_ID || typeof window === 'undefined') return
  Intercom({ app_id: APP_ID, region: 'us', ...guardArgs(args) } as Parameters<typeof Intercom>[0])
  booted = true
  identifiedUserId = args.user_id && args.intercom_user_jwt ? args.user_id : null
}

export function updateIntercom(args: IntercomBootArgs = {}) {
  if (!APP_ID || !booted) return
  sdkUpdate(guardArgs(args) as Parameters<typeof sdkUpdate>[0])
}

/** Ferme la session courante (utilisé au logout + avant un re-boot identifié). */
export function shutdownIntercom() {
  if (!APP_ID) return
  sdkShutdown()
  booted = false
  identifiedUserId = null
}

/** Id de l'agent dont le Messenger porte l'identité vérifiée ; `null` si anonyme ou non booté. */
export function getIntercomUserId(): string | null {
  return APP_ID && booted ? identifiedUserId : null
}

/** Espaces du Messenger Intercom. */
export type IntercomSpace = 'home' | 'messages' | 'help' | 'news' | 'tasks' | 'tickets'

// ⚠ Les deux ouvertures ci-dessous rendent un BOOLÉEN, comme `trackIntercomEvent`
// plus bas. Ce sont les seules dont l'appel naît d'un CLIC : `booted` est faux
// pendant le démarrage du Messenger, et un clic sur « ? » à cet instant sortait
// sans rien faire — ni fenêtre, ni erreur, ni message. L'appelant a besoin de
// savoir que rien ne s'est ouvert pour proposer le centre d'aide public à la
// place. `update` reste un no-op silencieux : il n'a aucun spectateur.

/** Ouvre un espace précis du Messenger (ex. 'help' pour le Help Center, 'news' pour les Actualités).
 *  Rend `false` si le Messenger ne peut pas répondre (App ID absent, ou pas encore booté). */
export function showIntercomSpace(space: IntercomSpace): boolean {
  if (!APP_ID || !booted) return false
  sdkShowSpace(space)
  return true
}

/** Ouvre un article du Help Center par son ID Intercom (aide contextuelle).
 *  Rend `false` si le Messenger ne peut pas répondre (App ID absent, ou pas encore booté). */
export function showIntercomArticle(articleId: string): boolean {
  if (!APP_ID || !booted) return false
  sdkShowArticle(articleId)
  return true
}

/** Registre central des events produit MEGGA → Intercom (Fin / Series / Outbound / ciblage).
 *  Tout nouvel event passe par ici : évite les typos et garde le ciblage cohérent.
 *  Les `first_*` et `profile_completed` sont des jalons envoyés UNE fois par agent :
 *  ils passent par `intercom-milestones.ts`, jamais directement par `trackIntercomEvent`.
 *  ⚠️ Un event custom ne devient ciblable dans Intercom qu'après réception d'un VRAI user en prod. */
export const INTERCOM_EVENTS = {
  PROFILE_COMPLETED: 'profile_completed',
  LEAD_IMPORTED: 'lead_imported',
  FIRST_CONTACTS_IMPORTED: 'first_contacts_imported',
  FIRST_PROPERTY_CREATED: 'first_property_created',
  FIRST_KYC_CASE_OPENED: 'first_kyc_case_opened',
  FIRST_MATCH_SENT: 'first_match_sent',
  DEAL_CREATED: 'deal_created',
} as const

export type IntercomEventName = (typeof INTERCOM_EVENTS)[keyof typeof INTERCOM_EVENTS]

/** Envoie un event produit → alimente Fin / Series / Outbound.
 *  Rend `false` si rien n'est parti (App ID absent, Messenger non booté, ou agent non
 *  identifié) : la garde des jalons ne retient un envoi que s'il a eu lieu.
 *  ⚠️ LPD : ne JAMAIS mettre de PII client dans `metadata` — uniquement un signal d'activation agent. */
export function trackIntercomEvent(event: IntercomEventName, metadata?: Record<string, unknown>): boolean {
  if (!APP_ID || !booted || !identifiedUserId) return false
  sdkTrackEvent(event, metadata)
  return true
}

/** True si un App ID est configuré (sinon tout est no-op). */
export function isIntercomEnabled() {
  return !!APP_ID
}
