// supabase/functions/_shared/mail/guard.ts
// Service-role ⇒ pas de RLS : tout account_id venu du corps de la requête est
// revérifié ici contre l'identité prouvée par requireAgentAuth. Sans cette
// fonction, mail-actions serait un IDOR (même famille que les deux calendriers
// de l'audit du 02.08.2026).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { MailAccountRow } from './types.ts'
import type { OAuthClientConfig } from './secrets.ts'

export interface CallerCtx { userId: string; agencyId: string }

// ⛔ Jumelle TypeScript de `mail_account_visible` (20260903120000_mail_module.sql) :
// les deux doivent dire la même chose, et ne jamais dériver. L'appartenance à l'agence
// est CONJOINTE ; `visibility` ne dit que qui voit la boîte DANS l'agence, jamais de
// quelle agence est le LECTEUR. En disjonction, `owner_id === ctx.userId` serait une
// porte qui survit au départ : `team_remove_member`
// (20260627120000_profiles_privilege_escalation_lockdown.sql:286) ne fait qu'un
// `update profiles set agency_id = null, role = 'buyer'` — la ligne profiles SURVIT,
// donc le `on delete cascade` d'`owner_id` ne se déclenche jamais et le compte reste
// 'active' — puis `accept-team-invite/index.ts:148` réécrit `profiles.agency_id` vers
// une NOUVELLE agence. L'ex-membre, passé chez un concurrent, garderait la lecture,
// l'envoi et les pièces jointes de la boîte de son ancienne agence, par tous les edges.
export function accountVisibleTo(account: Pick<MailAccountRow, 'owner_id' | 'agency_id' | 'visibility'>, ctx: CallerCtx): boolean {
  return account.agency_id === ctx.agencyId && (account.visibility === 'agency' || account.owner_id === ctx.userId)
}

/** Charge le compte si l'appelant a le droit de le voir, sinon null. */
export async function loadVisibleAccount(admin: SupabaseClient, accountId: string, ctx: CallerCtx): Promise<MailAccountRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(accountId ?? '')) return null
  const { data } = await admin.from('mail_accounts').select('*').eq('id', accountId).maybeSingle()
  if (!data) return null
  return accountVisibleTo(data as MailAccountRow, ctx) ? (data as MailAccountRow) : null
}

export interface ProviderConfig { gmail: OAuthClientConfig; outlook: OAuthClientConfig }

/** Lit les quatre secrets. Un secret vide n'est PAS une erreur ici : c'est l'échange qui échouera, lisiblement. */
export function providerConfigFromEnv(get: (k: string) => string | undefined): ProviderConfig {
  return {
    gmail: { clientId: get('GOOGLE_CLIENT_ID') ?? '', clientSecret: get('GOOGLE_CLIENT_SECRET') ?? '' },
    outlook: { clientId: get('MICROSOFT_CLIENT_ID') ?? '', clientSecret: get('MICROSOFT_CLIENT_SECRET') ?? '' },
  }
}

/** Origines autorisées pour l'URI de redirection de la pop-up (D1). */
export const MAIL_OAUTH_ORIGINS = ['https://app.megga.ch', 'http://localhost:5173', 'http://localhost:5174'] as const
export function redirectUriFor(origin: string): string | null {
  return (MAIL_OAUTH_ORIGINS as readonly string[]).includes(origin) ? `${origin}/oauth/mail/callback` : null
}
