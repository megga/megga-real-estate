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
  show as sdkShow,
  trackEvent as sdkTrackEvent,
} from '@intercom/messenger-js-sdk'

const APP_ID = import.meta.env.VITE_INTERCOM_APP_ID as string | undefined

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
 * No-op tant que `VITE_INTERCOM_APP_ID` n'est pas défini (comme PostHog sans clé).
 */
export function bootIntercom(args: IntercomBootArgs = {}) {
  if (!APP_ID || typeof window === 'undefined') return
  Intercom({ app_id: APP_ID, region: 'us', ...args } as Parameters<typeof Intercom>[0])
  booted = true
}

export function updateIntercom(args: IntercomBootArgs = {}) {
  if (!APP_ID || !booted) return
  sdkUpdate(args as Parameters<typeof sdkUpdate>[0])
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

/** Envoie un event produit → alimente Fin / Series / Outbound. */
export function trackIntercomEvent(event: string, metadata?: Record<string, unknown>) {
  if (!APP_ID || !booted) return
  sdkTrackEvent(event, metadata)
}

/** True si un App ID est configuré (sinon tout est no-op). */
export function isIntercomEnabled() {
  return !!APP_ID
}
