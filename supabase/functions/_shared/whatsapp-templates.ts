// Templates Meta — écrire à un client HORS de la fenêtre de service 24h.
//
// Hors fenêtre, Meta refuse le texte libre (erreur 131047) ; seuls des TEMPLATES
// pré-approuvés (Meta Business Manager) passent. Ce module est le registre CÔTÉ CODE :
// il déclare les templates que MEGGA sait envoyer et remplit leurs variables — mais les
// NOMS approuvés viennent de l'env (posés une fois le template validé par Meta), pour que
// le code n'invente JAMAIS un nom non approuvé (l'API le rejetterait).
//
// ── Activation (étapes EXTERNES, hors code) ──────────────────────────────────
//  1. Compte Meta Business vérifié (débridage — cf. system-map §6bis « roadmap »).
//  2. Soumettre chaque template dans Meta Business Manager avec le corps EXACT décrit
//     ci-dessous (mêmes {{1}}, {{2}}… dans le même ordre) → attendre l'APPROBATION Meta.
//  3. Poser l'env WA_TEMPLATE_<KEY> = <nom_approuvé> (+ WA_TEMPLATE_<KEY>_LANG si ≠ défaut).
// Tant que l'env n'est pas posé, buildTemplateMessage() renvoie null → repli GRACIEUX
// (aucun envoi, l'agent est informé), jamais d'appel Meta avec un nom bidon.
//
// Contrainte produit : ces templates sont NEUTRES et courtois (pas le style appris de
// l'agent — un template figé ne peut pas l'être). Ils servent seulement à ROUVRIR la
// conversation ; la réponse du client rouvre la fenêtre 24h pour un échange libre.

import type { OutboundTemplateMessage } from './whatsapp-gateway.ts'

export type WaTemplateKey = 'followup' | 'availability' | 'new_listings'

export const WA_TEMPLATE_KEYS: WaTemplateKey[] = ['followup', 'availability', 'new_listings']

export interface WaTemplateContext {
  clientFirstName?: string   // {{1}} — prénom du client (repli « Bonjour »)
  agentName?: string         // {{2}} — nom de l'agent/agence
  count?: number             // new_listings : nombre de biens ({{2}})
  extra?: string             // availability : objet du créneau (ex. « une visite »)
}

interface WaTemplateDef {
  /** Env var portant le nom Meta APPROUVÉ (vide/absent = template non activé). */
  nameEnv: string
  /** Env var pour surcharger la langue ; sinon defaultLang. */
  langEnv: string
  defaultLang: string
  /** Corps type soumis à Meta (documentation — l'ordre des {{n}} DOIT matcher bodyParams). */
  bodyText: string
  /** Paramètres du corps dans l'ordre {{1}}, {{2}}… Chaîne non vide garantie (Meta rejette
   *  un paramètre vide). */
  bodyParams: (ctx: WaTemplateContext) => string[]
}

const nonEmpty = (v: string | undefined | null, fallback: string): string => {
  const s = (v ?? '').trim()
  return s.length > 0 ? s : fallback
}

const REGISTRY: Record<WaTemplateKey, WaTemplateDef> = {
  // « Bonjour {{1}}, {{2}} revient vers vous au sujet de votre projet immobilier.
  //   Souhaitez-vous qu'on en reparle ? »
  followup: {
    nameEnv: 'WA_TEMPLATE_FOLLOWUP', langEnv: 'WA_TEMPLATE_FOLLOWUP_LANG', defaultLang: 'fr',
    bodyText: 'Bonjour {{1}}, {{2}} revient vers vous au sujet de votre projet immobilier. Souhaitez-vous qu’on en reparle ?',
    bodyParams: (c) => [nonEmpty(c.clientFirstName, 'Bonjour'), nonEmpty(c.agentName, 'votre agent')],
  },
  // « Bonjour {{1}}, {{2}} vous propose un créneau pour {{3}}. Êtes-vous disponible ? »
  availability: {
    nameEnv: 'WA_TEMPLATE_AVAILABILITY', langEnv: 'WA_TEMPLATE_AVAILABILITY_LANG', defaultLang: 'fr',
    bodyText: 'Bonjour {{1}}, {{2}} vous propose un créneau pour {{3}}. Êtes-vous disponible ?',
    bodyParams: (c) => [nonEmpty(c.clientFirstName, 'Bonjour'), nonEmpty(c.agentName, 'votre agent'), nonEmpty(c.extra, 'une visite')],
  },
  // « Bonjour {{1}}, {{2}} nouveau(x) bien(s) correspondant à votre recherche viennent
  //   d'arriver. Voulez-vous les découvrir ? »
  new_listings: {
    nameEnv: 'WA_TEMPLATE_NEW_LISTINGS', langEnv: 'WA_TEMPLATE_NEW_LISTINGS_LANG', defaultLang: 'fr',
    bodyText: 'Bonjour {{1}}, {{2}} nouveau(x) bien(s) correspondant à votre recherche viennent d’arriver. Voulez-vous les découvrir ?',
    bodyParams: (c) => [nonEmpty(c.clientFirstName, 'Bonjour'), String(Math.max(1, c.count ?? 1))],
  },
}

/** Documentation du corps type d'un template (pour la soumission Meta). */
export function templateBodyText(key: WaTemplateKey): string {
  return REGISTRY[key].bodyText
}

/**
 * Construit le message template à envoyer, ou `null` si le template n'est pas configuré
 * (nom approuvé absent de l'env) → le caller applique un repli gracieux (pas d'envoi).
 * `env` est injecté (Deno.env.get) pour rester PUR et testable.
 */
export function buildTemplateMessage(
  key: WaTemplateKey,
  toPhone: string,
  ctx: WaTemplateContext,
  env: (k: string) => string | undefined,
): OutboundTemplateMessage | null {
  const def = REGISTRY[key]
  if (!def) return null
  const name = (env(def.nameEnv) ?? '').trim()
  if (!name) return null // template non approuvé/configuré → repli
  const languageCode = (env(def.langEnv) ?? '').trim() || def.defaultLang
  return { toPhone, templateName: name, languageCode, bodyParams: def.bodyParams(ctx) }
}

/** Liste des clés de template ACTIVÉES (nom approuvé présent dans l'env). */
export function configuredTemplateKeys(env: (k: string) => string | undefined): WaTemplateKey[] {
  return WA_TEMPLATE_KEYS.filter((k) => (env(REGISTRY[k].nameEnv) ?? '').trim().length > 0)
}
