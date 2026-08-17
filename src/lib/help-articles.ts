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
// IDs réels — audit du 2026-08-17 (`gh workflow run intercom-content.yml -f mode=audit`).
// Les 12 identifiants ci-dessous existent et sont `published`, en FR comme en EN.
// Quand un nouvel article passe « live », ajouter/échanger son ID ici (un seul endroit).
//
// ⚠ Ce catalogue ne couvre PAS tout le corpus, et l'écart est volontairement
// visible : au 17.08.2026 le Help Center porte 18 articles, ce fichier en cite 12.
// Les 6 absents (copilote 15492030, 2ᵉ article KYC 15492033, « Aujourd'hui »
// 15696489, relances 15696490, visites 15696491, commissions 15696494) n'ont pas
// d'écran à qui appartenir. Ils restent atteignables par la RECHERCHE — c'est
// précisément pourquoi le « ? » ouvre l'onglet Aide et non un article.
import { showIntercomArticle, showIntercomSpace } from './intercom'

/**
 * Clé d'aide → ID d'article Help Center publié. Les clés reprennent les `CrmScreenId`
 * de la TopNav, plus les surfaces secondaires que la prop `helpKey` sait nommer
 * (kyc / settings / billing / whatsapp / agence).
 *
 * ⚠ Une clé n'existe VRAIMENT que si une surface la produit. Quatre d'entre elles
 * ne l'étaient par personne jusqu'au 17 août 2026 : `billing`, `whatsapp` et
 * `agence` visaient des sections de réglages qui n'avaient aucun moyen de le dire
 * (la TopNav ne recevait que `'settings'`), et `portail` visait une fonctionnalité
 * retirée. Les trois premières sont désormais branchées par `helpKey` ; la
 * quatrième est partie. Ajouter une clé sans son émetteur, c'est écrire du code
 * mort qu'aucune porte ne voit — le catalogue est un `Record<string, string>`,
 * donc rien ne l'attrape.
 *
 * Toute surface non mappée retombe sur l'onglet Aide (`showIntercomSpace('help')`).
 */
export const HELP_ARTICLES: Record<string, string> = {
  today: '15424904', // Démarrer avec MEGGA
  contacts: '15424962', // Gérer ses contacts et importer des leads
  pipeline: '15424971', // Suivre vos affaires dans le pipeline
  matching: '15492029', // Lire un score de matching et proposer un bien
  calendar: '15424986', // Connecter Google, Outlook et la signature
  // ⛔ `julien: '15492030'` A ÉTÉ RETIRÉ le 17 août 2026 avec la page du même nom.
  // Les clés d'aide reprennent les `CrmScreenId` ; `'julien'` n'en est plus un,
  // donc l'entrée était devenue INATTEIGNABLE — `openHelpFor(active)` ne peut plus
  // la produire. ⚠ L'ARTICLE, lui, existe toujours et reste juste : « Le copilote
  // MEGGA AI : ce qu'il fait, ses limites », id Intercom **15492030**. Ce qui
  // manque désormais est un point d'entrée depuis le DOCK, qui n'est pas un écran
  // et n'a donc pas de clé. À poser le jour où le dock gagne son bouton d'aide.
  parcours: '15692113', // Suivre l'avancement de vos dossiers avec le Parcours
  biens: '15692114', // Gérer votre portefeuille de biens
  // Surfaces secondaires (hors TopNav) — atteintes par la prop `helpKey` de la
  // TopNav, que les pages sans onglet propre renseignent elles-mêmes.
  kyc: '15424977', // Le KYC, une aide à la conformité (LBA)
  settings: '15424986', // Intégrations (Google / Outlook / signature)
  billing: '15424993', // Facturation et abonnement — section « Facturation » des réglages
  whatsapp: '15424979', // Piloter le CRM depuis WhatsApp — modale de liaison WhatsApp
  agence: '15492032', // Gérer votre agence et inviter votre équipe — section « Agence »
  // ⛔ `portail: '15492031'` A ÉTÉ RETIRÉ le 17 août 2026. Le portail vendeur a été
  // supprimé du produit le 26 juillet 2026 (tables comprises) : aucune surface ne
  // pouvait plus produire cette clé. L'ARTICLE, lui, décrit une fonctionnalité qui
  // n'existe plus — il est à DÉPUBLIER côté Intercom, sinon Fin continue de s'en
  // servir pour répondre. Mesuré le 17.08.2026 par `mode=audit` : encore `published`.
}

/**
 * Centre d'aide public (même corpus que le Messenger, hors authentification).
 * Sert de repli quand Intercom n'est pas configuré — typiquement en dev local,
 * où `VITE_INTERCOM_APP_ID` est absent.
 */
export const HELP_CENTER_URL = 'https://intercom.help/megga/fr'

/**
 * Ouvre l'aide.
 * - Clé portant un article publié → l'article, directement dans le Messenger.
 * - Sans clé (ou clé non mappée) → l'onglet Aide : les 18 articles, la recherche et Fin.
 * - Messenger indisponible → le Centre d'aide public, dans un nouvel onglet.
 *
 * ⚠ Le dernier cas ne se limite PAS au dev local. Le repli était gardé par
 * `isIntercomEnabled()`, c'est-à-dire par la seule présence de l'App ID — donc
 * toujours vrai en production, où il ne s'exécutait jamais. Le vrai trou était
 * ailleurs : entre le chargement de la page et la fin du démarrage du Messenger,
 * `showIntercomSpace`/`showIntercomArticle` sortaient sans rien faire. Un agent
 * qui cliquait « ? » trop tôt n'obtenait rien du tout, sans erreur ni message.
 * On teste donc ce que l'ouverture a RÉELLEMENT fait, pas ce qui est configuré.
 */
export function openHelpFor(key?: string): void {
  const articleId = key ? HELP_ARTICLES[key] : undefined
  const opened = articleId ? showIntercomArticle(articleId) : showIntercomSpace('help')
  if (!opened) window.open(HELP_CENTER_URL, '_blank', 'noopener,noreferrer')
}
