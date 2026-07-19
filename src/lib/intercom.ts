// src/lib/intercom.ts
// Intercom Messenger — boot / identify / track wrapper.
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
  show as sdkShow,
  showSpace as sdkShowSpace,
  showArticle as sdkShowArticle,
  trackEvent as sdkTrackEvent,
} from '@intercom/messenger-js-sdk'
import { sanitizeIntercomArgs } from './intercom-allowlist'

const APP_ID = import.meta.env.VITE_INTERCOM_APP_ID as string | undefined

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
  /** company_id + name + attributs custom d'entreprise (ex. stripe_customer_id pour Fin Actions). */
  company?: { company_id: string; name?: string; [key: string]: unknown }
  [key: string]: unknown
}

let booted = false

/**
 * Boote (ou re-boote) le Messenger. Anonyme si aucun argument utilisateur.
 * No-op tant que `VITE_INTERCOM_APP_ID` n'est pas défini.
 */
export function bootIntercom(args: IntercomBootArgs = {}) {
  if (!APP_ID || typeof window === 'undefined') return
  Intercom({ app_id: APP_ID, region: 'us', ...guardArgs(args) } as Parameters<typeof Intercom>[0])
  booted = true
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
}

/** Ouvre le Messenger (déclencheur « Aide » de la sidebar / pages publiques). */
export function showIntercom() {
  if (!APP_ID || !booted) return
  sdkShow()
}

/** Espaces du Messenger Intercom. */
export type IntercomSpace = 'home' | 'messages' | 'help' | 'news' | 'tasks' | 'tickets'

/** Ouvre un espace précis du Messenger (ex. 'help' pour le Help Center, 'news' pour les Actualités). */
export function showIntercomSpace(space: IntercomSpace) {
  if (!APP_ID || !booted) return
  sdkShowSpace(space)
}

/** Ouvre un article du Help Center par son ID Intercom (aide contextuelle). */
export function showIntercomArticle(articleId: string) {
  if (!APP_ID || !booted) return
  sdkShowArticle(articleId)
}

/** Registre central des events produit MEGGA → Intercom (Fin / Series / Outbound / ciblage).
 *  Tout nouvel event passe par ici : évite les typos et garde le ciblage cohérent.
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
 *  ⚠️ LPD : ne JAMAIS mettre de PII client dans `metadata` — uniquement un signal d'activation agent. */
export function trackIntercomEvent(event: IntercomEventName, metadata?: Record<string, unknown>) {
  if (!APP_ID || !booted) return
  sdkTrackEvent(event, metadata)
}

/** True si un App ID est configuré (sinon tout est no-op). */
export function isIntercomEnabled() {
  return !!APP_ID
}
