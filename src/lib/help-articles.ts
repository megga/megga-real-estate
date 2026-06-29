// src/lib/help-articles.ts
// Catalogue central « surface produit → article Help Center Intercom ».
//
// Aide CONTEXTUELLE : au lieu d'ouvrir le Centre d'aide à sa racine, on ouvre
// directement l'article qui parle de l'écran courant (`showIntercomArticle`).
//
// Règle : on ne mappe QUE des articles PUBLIÉS. Un article en brouillon ne s'ouvre
// pas dans le Messenger côté agent → on retombe sur le Centre d'aide
// (`showIntercomSpace('help')`) pour toute surface sans article publié dédié.
//
// IDs réels — audit du 2026-06-29 (`gh workflow run intercom-content.yml -f mode=audit`).
// Quand un nouvel article passe « live », ajouter/échanger son ID ici (un seul endroit).
import { showIntercomArticle, showIntercomSpace, isIntercomEnabled } from './intercom'

/**
 * Clé d'aide → ID d'article Help Center publié. Les clés reprennent les `SugarScreenId`
 * de la TopNav, plus quelques surfaces secondaires (kyc / settings / billing / whatsapp / portail).
 *
 * Surfaces SANS article publié dédié (→ fallback Centre d'aide) : parcours, biens (à rédiger).
 */
export const HELP_ARTICLES: Record<string, string> = {
  today: '15424904', // Démarrer avec MEGGA
  contacts: '15424962', // Gérer ses contacts et importer des leads
  pipeline: '15424971', // Suivre vos affaires dans le pipeline
  matching: '15492029', // Lire un score de matching et proposer un bien
  calendar: '15424986', // Connecter Google, Outlook et la signature
  julien: '15492030', // Le copilote MEGGA AI : ce qu'il fait, ses limites
  // Surfaces secondaires (hors TopNav) — utilisables par les pages dédiées :
  kyc: '15424977', // Le KYC, une aide à la conformité (LBA)
  settings: '15424986', // Intégrations (Google / Outlook / signature)
  billing: '15424993', // Facturation et abonnement
  whatsapp: '15424979', // Piloter le CRM depuis WhatsApp
  portail: '15492031', // Le portail vendeur : tenir votre client informé
  agence: '15492032', // Gérer votre agence et inviter votre équipe
}

/**
 * Ouvre l'aide contextuelle pour une surface donnée.
 * - Article publié connu → l'ouvre directement.
 * - Sinon → ouvre le Centre d'aide (l'agent y retrouve la recherche + Fin).
 *
 * @returns `false` si Intercom n'est pas configuré (l'appelant peut alors router
 *          vers la page `/help` interne, comme le fait le menu profil).
 */
export function openHelpFor(key?: string): boolean {
  if (!isIntercomEnabled()) return false
  const articleId = key ? HELP_ARTICLES[key] : undefined
  if (articleId) showIntercomArticle(articleId)
  else showIntercomSpace('help')
  return true
}
