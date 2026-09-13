// supabase/functions/_shared/mail/disconnect.ts
// Déconnecter une boîte : révoquer le jeton, effacer le secret Vault, supprimer la ligne
// (fils, messages et pièces suivent en cascade — D15). UN seul chemin, partagé par le geste
// de l'agent (`mail-oauth disconnect`) et par l'effacement d'un compte (`delete-account`,
// nLPD art. 32) : deux copies de ces trois gestes auraient dérivé l'une de l'autre, comme
// `delete-account` et `admin-dsar-export` avant `personal-data-estate.ts`.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { revokeToken, type OAuthDeps } from './oauth.ts'
import { deleteAccountSecret, readAccountSecret } from './secrets.ts'
import type { MailAccountRow, OAuthSecret } from './types.ts'

/** Pourquoi une déconnexion n'a pas abouti — la boîte est alors restée, en `disabled`. */
export type DisconnectFailure = 'secret_unreadable' | 'provider_refused' | 'vault_delete_failed' | 'delete_failed'

export type DisconnectOutcome = { ok: true } | { ok: false; reason: DisconnectFailure; detail: string }

/**
 * Révoque, efface, supprime — dans cet ordre, et aucun des trois gestes n'est avalé.
 *
 * ⛔ LA LIGNE EST LE SEUL POINTEUR VERS LE SECRET. Vault n'est la cible d'aucune clé
 * étrangère : supprimer `mail_accounts` avant d'avoir effacé le secret (ou le laisser à une
 * cascade) abandonne un jeton de rafraîchissement que plus rien ne désigne. En cas d'échec
 * la ligne RESTE, en `disabled` avec la raison : le pointeur survit et le geste se rejoue.
 *
 * ⚠ Deux issues de la lecture à ne pas confondre. Une LEVÉE = Vault n'a pas répondu, on ne
 * sait pas si le jeton existe : refuser. Un `null` = le secret n'est plus là (déconnexion à
 * demi faite, purge) : rien à révoquer ni à effacer — bloquer condamnerait la boîte, et le
 * compte qui la porte, à ne jamais pouvoir être supprimés.
 */
export async function disconnectMailAccount(
  admin: SupabaseClient,
  account: Pick<MailAccountRow, 'id' | 'provider' | 'vault_secret_id'>,
  deps: OAuthDeps = {},
): Promise<DisconnectOutcome> {
  const echec = async (reason: DisconnectFailure, detail: string, lastError: string): Promise<DisconnectOutcome> => {
    console.error(`[mail disconnect] compte ${account.id} : ${reason} — ${detail}`)
    const { error } = await admin.from('mail_accounts').update({ status: 'disabled', last_error: lastError }).eq('id', account.id)
    if (error) console.error(`[mail disconnect] compte ${account.id} : statut non posé —`, error.message)
    return { ok: false, reason, detail }
  }

  if (account.vault_secret_id) {
    let secret: OAuthSecret | null = null
    try { secret = await readAccountSecret<OAuthSecret>(admin, account.vault_secret_id) }
    catch (e) {
      return echec('secret_unreadable', e instanceof Error ? e.message : String(e), 'disconnect: secret illisible, révocation impossible')
    }
    if (!secret) console.error(`[mail disconnect] compte ${account.id} : aucun secret sous ${account.vault_secret_id} — rien à révoquer`)
    if (secret && 'refresh_token' in secret && (account.provider === 'gmail' || account.provider === 'outlook')) {
      if (!await revokeToken(account.provider, secret.refresh_token, deps)) {
        return echec('provider_refused', `${account.provider} a refusé la révocation`, 'disconnect: révocation refusée par le fournisseur')
      }
    }
    // Le jeton est révoqué, donc inoffensif — mais tant qu'il est dans Vault, la ligne garde
    // le seul moyen de le retrouver.
    try { if (secret) await deleteAccountSecret(admin, account.vault_secret_id) }
    catch (e) {
      const detail = e instanceof Error ? e.message : String(e)
      return echec('vault_delete_failed', detail, `disconnect: secret non effacé (${detail.slice(0, 200)})`)
    }
  }
  const { error } = await admin.from('mail_accounts').delete().eq('id', account.id)
  if (error) return { ok: false, reason: 'delete_failed', detail: error.message }
  return { ok: true }
}
