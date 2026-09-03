// supabase/functions/mail-actions/index.ts
// Gestes sur un fil, répercutés chez le fournisseur PUIS en base (l'UI est
// optimiste ; si le fournisseur refuse, elle rétablit — plan §4 « Flux d'actions »).
//   mark_read | mark_unread | star | unstar | archive | unarchive | trash | untrash
//     { account_id, thread_id }
//   link_contact { account_id, thread_id, contact_id, email }
//   sync_now     { account_id }
// Le libellé (label_id) s'écrit directement par PostgREST (colonne accordée) :
// il n'a pas d'équivalent fournisseur.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { loadVisibleAccount, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { getValidAccessToken } from '../_shared/mail/secrets.ts'
import { gmailModify } from '../_shared/mail/gmail.ts'
import { graphMove, graphPatch } from '../_shared/mail/graph.ts'
import { linkThreadToContact, recomputeThread } from '../_shared/mail/ingest.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import type { MailAccountRow } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

type ThreadAction = 'mark_read' | 'mark_unread' | 'star' | 'unstar' | 'archive' | 'unarchive' | 'trash' | 'untrash'
const THREAD_ACTIONS: ThreadAction[] = ['mark_read', 'mark_unread', 'star', 'unstar', 'archive', 'unarchive', 'trash', 'untrash']

interface MsgRow { id: string; provider_message_id: string; direction: 'inbound' | 'outbound' }

/** Applique le geste chez le fournisseur, message par message. Rend les nouveaux ids Graph (move). */
async function pushToProvider(account: MailAccountRow, token: string, action: ThreadAction, msgs: MsgRow[]): Promise<Record<string, string>> {
  const renamed: Record<string, string> = {}
  for (const m of msgs) {
    if (m.provider_message_id.startsWith('pending:')) continue
    if (account.provider === 'gmail') {
      const [add, remove] = ({
        mark_read: [[], ['UNREAD']], mark_unread: [['UNREAD'], []],
        star: [['STARRED'], []], unstar: [[], ['STARRED']],
        archive: [[], ['INBOX']], unarchive: [['INBOX'], []],
        trash: [['TRASH'], ['INBOX']], untrash: [['INBOX'], ['TRASH']],
      } as Record<ThreadAction, [string[], string[]]>)[action]
      await gmailModify(token, m.provider_message_id, add, remove)
    } else if (account.provider === 'outlook') {
      if (action === 'mark_read' || action === 'mark_unread') await graphPatch(token, m.provider_message_id, { isRead: action === 'mark_read' })
      else if (action === 'star' || action === 'unstar') await graphPatch(token, m.provider_message_id, { flagged: action === 'star' })
      else if (m.direction === 'inbound') {
        const dest = action === 'archive' ? 'archive' : action === 'trash' ? 'deleteditems' : 'inbox'
        renamed[m.provider_message_id] = await graphMove(token, m.provider_message_id, dest)
      }
    } else {
      throw new Error(`provider ${account.provider} not supported by this build`)
    }
  }
  return renamed
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)
  const auth = await requireAgentAuth(req, corsHeaders)
  if (auth instanceof Response) return auth
  const { user, profile, supabase: admin } = auth
  const ctx = { userId: user.id, agencyId: profile.agency_id }

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const action = String(body.action ?? '')
  const account = await loadVisibleAccount(admin, String(body.account_id ?? ''), ctx)
  if (!account) return json({ error: 'not_found' }, 404)
  const cfg = providerConfigFromEnv((k) => Deno.env.get(k))

  if (action === 'sync_now') {
    if (account.status !== 'active') return json({ error: 'account_not_active', status: account.status }, 409)
    return json(await syncAccount(admin, account, cfg, 20_000))
  }

  const threadId = String(body.thread_id ?? '')
  const { data: thread } = await admin.from('mail_threads').select('id, is_read, is_starred, is_archived, is_trashed, contact_id')
    .eq('id', threadId).eq('account_id', account.id).maybeSingle()
  if (!thread) return json({ error: 'thread_not_found' }, 404)

  if (action === 'link_contact') {
    const contactId = String(body.contact_id ?? '')
    const email = String(body.email ?? '').trim().toLowerCase()
    if (!/^[0-9a-f-]{36}$/i.test(contactId) || !email.includes('@')) return json({ error: 'invalid_input' }, 400)
    try {
      await linkThreadToContact(admin, account, thread.id, contactId, email, user.id)
    } catch (e) {
      return json({ error: e instanceof Error ? e.message : 'link_failed' }, 400)
    }
    return json({ ok: true, thread_id: thread.id, contact_id: contactId })
  }

  if (!THREAD_ACTIONS.includes(action as ThreadAction)) return json({ error: 'unknown_action' }, 400)
  const { data: msgs } = await admin.from('mail_messages').select('id, provider_message_id, direction').eq('thread_id', thread.id)

  try {
    const token = await getValidAccessToken(admin, account, account.provider === 'gmail' ? cfg.gmail : cfg.outlook)
    const renamed = await pushToProvider(account, token, action as ThreadAction, (msgs ?? []) as MsgRow[])
    for (const [oldId, newId] of Object.entries(renamed)) {
      await admin.from('mail_messages').update({ provider_message_id: newId }).eq('account_id', account.id).eq('provider_message_id', oldId)
    }
  } catch (e) {
    return json({ error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
  }

  const patch: Record<string, unknown> = {}
  if (action === 'mark_read' || action === 'mark_unread') {
    await admin.from('mail_messages').update({ is_read: action === 'mark_read' }).eq('thread_id', thread.id)
    await recomputeThread(admin, thread.id)
  }
  if (action === 'star') patch.is_starred = true
  if (action === 'unstar') patch.is_starred = false
  if (action === 'archive') patch.is_archived = true
  if (action === 'unarchive') patch.is_archived = false
  if (action === 'trash') { patch.is_trashed = true }
  if (action === 'untrash') { patch.is_trashed = false; patch.is_archived = false }
  if (Object.keys(patch).length) await admin.from('mail_threads').update(patch).eq('id', thread.id)

  const { data: after } = await admin.from('mail_threads').select('id, is_read, is_starred, is_archived, is_trashed').eq('id', thread.id).single()
  return json({ ok: true, thread: after })
})
