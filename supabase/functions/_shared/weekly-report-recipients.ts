/**
 * Destinataires du rapport hebdomadaire de la plateforme (`weekly-report`).
 *
 * Module PUR — aucun import Deno ni esm.sh : les accès à Supabase sont injectés, et
 * `tests/unit/weekly-report-recipients.spec.ts` le lit tel quel sous Node.
 *
 * LA RÈGLE : un destinataire est un titulaire du rôle `super_admin` DONT l'e-mail
 * d'AUTHENTIFICATION figure dans l'allowlist — exactement la définition d'`is_super_admin()`
 * et de `requireSuperAdmin`. Avant l'audit du 13.09.2026 (point S8), la fonction envoyait les
 * métriques de toute la plateforme à `profiles.email` de chaque titulaire du rôle, allowlisté
 * ou non. Or `profiles.email` est modifiable par son titulaire ; l'e-mail d'authentification,
 * lui, ne se choisit pas depuis le CRM.
 *
 * ÉCHEC FERMÉ, destinataire par destinataire : un e-mail d'authentification introuvable, une
 * allowlist qui répond autre chose que `true` ou qui lève, et la personne est écartée. Aucun
 * destinataire retenu ⇒ l'appelant n'envoie rien. La LISTE des titulaires, elle, n'est pas
 * avalée : une panne de lecture remonte à l'appelant au lieu de se lire « aucun super-admin ».
 *
 * ⚠ DIFFÉRENT DES ALERTES DE PLATEFORME, et à dessein. `_shared/admin-alerts.ts` écrit à
 * l'allowlist ELLE-MÊME (`super_admin_allowlist()`), sans regarder le rôle : une alerte doit
 * atteindre l'équipe même le jour où un rôle a été retiré par erreur. Le rapport hebdomadaire
 * porte des MÉTRIQUES de plateforme : il ne part qu'à qui passerait aujourd'hui la garde de la
 * console.
 */

/** Accès injectés : la fonction edge les branche sur Supabase, le banc sur des faux. */
export interface RecipientDeps {
  /** Identifiants des profils de rôle `super_admin`. Une erreur REMONTE à l'appelant. */
  listSuperAdminIds(): Promise<string[]>
  /** E-mail d'AUTHENTIFICATION (`auth.users`) du compte, `null` s'il n'en a pas. */
  authEmailOf(id: string): Promise<string | null>
  /** L'e-mail figure-t-il dans l'allowlist super-admin (`super_admin_allowlist_match`) ? */
  isAllowlisted(email: string): Promise<boolean>
}

/**
 * E-mails des super-admins allowlistés, dans l'ordre de la liste des titulaires, dédupliqués
 * sans égard à la casse. L'allowlist est interrogée avec l'e-mail rendu par `authEmailOf`,
 * tel quel — jamais avec une autre valeur.
 */
export async function selectReportRecipients(deps: RecipientDeps): Promise<string[]> {
  const ids = await deps.listSuperAdminIds()
  const vus = new Set<string>()
  const retenus: string[] = []

  for (const id of ids) {
    let email: string | null
    try {
      email = await deps.authEmailOf(id)
    } catch {
      continue
    }
    if (typeof email !== 'string' || email.trim() === '') continue

    let autorise: boolean
    try {
      // `=== true` : une réponse qui n'est pas exactement vraie n'autorise personne.
      autorise = (await deps.isAllowlisted(email)) === true
    } catch {
      autorise = false
    }
    if (!autorise) continue

    const cle = email.trim().toLowerCase()
    if (vus.has(cle)) continue
    vus.add(cle)
    retenus.push(email)
  }

  return retenus
}
