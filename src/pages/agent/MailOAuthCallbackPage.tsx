/**
 * MEGGA CRM — retour d'autorisation de la Messagerie (`/oauth/mail/callback`).
 *
 * ⚠ PLACEHOLDER de la tâche 2.1 : la route existe pour que l'URI de redirection
 * déclarée chez Google et Microsoft ait déjà une cible, mais le relais
 * `postMessage` (et son repli sans `window.opener`) est écrit en T2.9. Tant que
 * ce fichier rend `null`, la pop-up ne rapporte rien à la fenêtre d'origine.
 *
 * Sous `pages/agent` et non `pages/public` : `polices-domaines.spec.ts` réserve
 * Manrope aux surfaces CLIENT, et celle-ci est une surface d'agent.
 */
export default function MailOAuthCallbackPage() {
  return null
}
