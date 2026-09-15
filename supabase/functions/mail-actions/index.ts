// supabase/functions/mail-actions/index.ts
// Gestes sur un fil, répercutés chez le fournisseur PUIS en base (l'UI est
// optimiste ; si le fournisseur refuse, elle rétablit — plan §4 « Flux d'actions »).
//   mark_read | mark_unread | star | unstar | archive | unarchive | trash | untrash
//   | spam | not_spam
//     { account_id, thread_id }        un fil
//     { account_id, thread_ids: [] }   un LOT (15.09.2026), 50 fils au plus : 200 et un
//                                      verdict PAR FIL, jamais un refus en bloc (_shared/mail/lot.ts)
//   link_contact { account_id, thread_id, contact_id, email }
//   sync_now     { account_id }
// Le libellé (label_id) s'écrit directement par PostgREST (colonne accordée) :
// il n'a pas d'équivalent fournisseur.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { requireAgentAuth } from '../_shared/require-agent-auth.ts'
import { redactedErrorMessage } from '../_shared/audit-edge-error.ts'
import { loadVisibleAccount, providerConfigFromEnv } from '../_shared/mail/guard.ts'
import { getValidAccessToken } from '../_shared/mail/secrets.ts'
import { gmailLabelPatch, gmailModify } from '../_shared/mail/gmail.ts'
import { graphMove, graphPatch } from '../_shared/mail/graph.ts'
import { imapApply } from '../_shared/mail/imap.ts'
import { linkThreadToContact, rattacherApresSpam, recomputeThread } from '../_shared/mail/ingest.ts'
import { syncAccount } from '../_shared/mail/sync.ts'
import { appliquerEnLot, lireLot } from '../_shared/mail/lot.ts'
import type { MailAccountRow, MailThreadAction } from '../_shared/mail/types.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, sentry-trace, baggage',
}
function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
}

// Le type vit dans `types.ts` : `gmailLabelPatch` (gmail.ts) en dépend, et deux unions
// jumelles qui dérivent l'une de l'autre est exactement le défaut que ce module ne veut pas.
type ThreadAction = MailThreadAction
const THREAD_ACTIONS: ThreadAction[] = ['mark_read', 'mark_unread', 'star', 'unstar', 'archive', 'unarchive', 'trash', 'untrash', 'spam', 'not_spam']

interface MsgRow { id: string; provider_message_id: string; direction: 'inbound' | 'outbound'; rfc822_message_id: string | null; is_spam: boolean }

/** Applique le geste chez le fournisseur, message par message. Rend les nouveaux ids Graph (move). */
async function pushToProvider(account: MailAccountRow, token: string, action: ThreadAction, msgs: MsgRow[]): Promise<Record<string, string>> {
  const renamed: Record<string, string> = {}
  for (const m of msgs) {
    if (m.provider_message_id.startsWith('pending:')) continue
    if (account.provider === 'gmail') {
      // La table des libellés vit dans `gmail.ts` — pure, donc éprouvée par un test
      // unitaire. Elle dépend de la DIRECTION du message : voir son en-tête (INBOX ne se
      // pose jamais sur une copie « Envoyés »).
      const { add, remove } = gmailLabelPatch(action, m.direction)
      if (add.length === 0 && remove.length === 0) continue
      await gmailModify(token, m.provider_message_id, add, remove)
    } else if (account.provider === 'outlook') {
      if (action === 'mark_read' || action === 'mark_unread') await graphPatch(token, m.provider_message_id, { isRead: action === 'mark_read' })
      else if (action === 'star' || action === 'unstar') await graphPatch(token, m.provider_message_id, { flagged: action === 'star' })
      else if (m.direction === 'inbound') {
        const dest = action === 'archive' ? 'archive' : action === 'trash' ? 'deleteditems' : action === 'spam' ? 'junkemail' : 'inbox'
        renamed[m.provider_message_id] = await graphMove(token, m.provider_message_id, dest)
      }
    } else {
      throw new Error(`provider ${account.provider} not supported by this build`)
    }
  }
  return renamed
}

/** Réécrit en base les ids que le déplacement a changés. Lève sur un échec d'écriture. */
async function renommerIds(admin: SupabaseClient, account: MailAccountRow, renamed: Record<string, string>): Promise<void> {
  for (const [oldId, newId] of Object.entries(renamed)) {
    if (oldId === newId) continue // id immuable : le déplacement ne le change plus
    // ⚠ Si un id CHANGE malgré `Prefer: IdType="ImmutableId"`, ce n'est pas seulement
    // `mail_messages` qui dérive : les `provider_attachment_id` d'Exchange sont
    // rattachés à l'item PARENT, donc ils cessent de résoudre avec lui, et
    // mail-attachment rendrait 502 sur un mandat PDF archivé. Ce cas ne devrait plus
    // exister ; s'il réapparaît, il doit se voir dans les journaux avant d'être
    // découvert par un agent.
    // En IMAP c'est la règle (un déplacement change l'UID) ; chez Graph, une anomalie.
    if (account.provider === 'outlook') console.error(`[mail-actions] id Graph modifié malgré l'id immuable (${oldId} → ${newId}) — pièces jointes du message potentiellement irrésolubles`)
    const { error } = await admin.from('mail_messages').update({ provider_message_id: newId }).eq('account_id', account.id).eq('provider_message_id', oldId)
    if (error) throw new Error(`renommage d'id: ${error.message}`)
  }
}

/**
 * L'état local d'UN fil, une fois le geste accepté par le fournisseur. Rend un code
 * d'échec, ou `null`. ⚠ Le texte d'une erreur Postgres ne part pas à l'appelant (audit
 * S14) : il est journalisé caviardé.
 */
async function ecrireLocalement(admin: SupabaseClient, account: MailAccountRow, action: ThreadAction, threadId: string, msgs: MsgRow[]): Promise<string | null> {
  const echec = (etape: string, e: unknown) => {
    console.error(`[mail-actions] fil ${threadId}, ${etape}: ${redactedErrorMessage(e)}`)
    return 'local_write_failed'
  }
  if (action === 'mark_read' || action === 'mark_unread') {
    const { error } = await admin.from('mail_messages').update({ is_read: action === 'mark_read' }).eq('thread_id', threadId)
    if (error) return echec('lu des messages', error)
    try { await recomputeThread(admin, threadId) } catch (e) { return echec('recalcul du fil', e) }
  }
  const patch: Record<string, unknown> = {}
  if (action === 'star') patch.is_starred = true
  if (action === 'unstar') patch.is_starred = false
  if (action === 'archive') patch.is_archived = true
  if (action === 'unarchive') patch.is_archived = false
  if (action === 'trash') { patch.is_trashed = true }
  if (action === 'untrash') { patch.is_trashed = false; patch.is_archived = false }
  // Le spam se pose sur les messages ENTRANTS — les seuls que le fournisseur a déplacés — et
  // sur le fil ; en sortir le rend à la Réception, jamais à Archivé.
  const sortisDuSpam = msgs.filter((m) => m.is_spam).map((m) => m.id)
  if (action === 'spam' || action === 'not_spam') {
    const auSpam = action === 'spam'
    let q = admin.from('mail_messages').update({ is_spam: auSpam }).eq('thread_id', threadId)
    if (auSpam) q = q.eq('direction', 'inbound')
    const { error } = await q
    if (error) return echec('spam des messages', error)
    patch.is_spam = auSpam
    if (!auSpam) patch.is_archived = false
  }
  if (Object.keys(patch).length) {
    const { error } = await admin.from('mail_threads').update(patch).eq('id', threadId)
    if (error) return echec('fil', error)
  }
  // ⛔ Sorti du spam, le fil entre dans le CRM comme s'il arrivait : rattaché à son contact et
  // journalisé — l'ingestion le lui refusait tant qu'il était du spam. Après l'écriture du
  // fil : `rattacherApresSpam` ne touche pas un fil encore marqué spam.
  if (action === 'not_spam') {
    try { await rattacherApresSpam(admin, account, threadId, sortisDuSpam) } catch (e) { return echec('sortie du spam', e) }
  }
  return null
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

  // ── Un LOT de fils (15.09.2026) ────────────────────────────────────────────
  if (body.thread_ids !== undefined) {
    if (!THREAD_ACTIONS.includes(action as ThreadAction)) return json({ error: 'unknown_action' }, 400)
    const geste = action as ThreadAction
    const ids = lireLot(body.thread_ids)
    if (!ids) return json({ error: 'invalid_input' }, 400)
    // Bornés à la BOÎTE : un fil d'une autre boîte ou d'une autre agence est « introuvable »,
    // comme un par un — jamais « interdit » (tests/backend/mail-edges.spec.ts).
    const { data: fils, error: eFils } = await admin.from('mail_threads').select('id').eq('account_id', account.id).in('id', ids)
    if (eFils) { console.error(`[mail-actions] lot, fils: ${redactedErrorMessage(eFils)}`); return json({ error: 'thread_query_failed' }, 500) }
    const connus = new Set(((fils ?? []) as { id: string }[]).map((f) => f.id))
    // Aucun fil de la boîte : rien à demander au fournisseur — ni jeton, ni connexion.
    if (connus.size === 0) return json({ ok: true, results: await appliquerEnLot(ids, connus, async () => null) })
    const parFil = new Map<string, MsgRow[]>()
    {
      const { data: tous, error: eTous } = await admin.from('mail_messages')
        .select('id, thread_id, provider_message_id, direction, rfc822_message_id, is_spam').in('thread_id', [...connus])
      if (eTous) { console.error(`[mail-actions] lot, messages: ${redactedErrorMessage(eTous)}`); return json({ error: 'messages_query_failed' }, 500) }
      for (const m of (tous ?? []) as (MsgRow & { thread_id: string })[]) parFil.set(m.thread_id, [...(parFil.get(m.thread_id) ?? []), m])
    }
    let chezLeFournisseur: (msgs: MsgRow[]) => Promise<void>
    if (account.provider === 'imap') {
      // UNE connexion pour tout le lot : douze connexions d'affilée, ce sont douze
      // identifications par mot de passe — ce qu'un hébergeur peut prendre pour une attaque.
      // Un refus y vaut donc pour tout le lot ; la synchro suivante recale ce qui serait
      // passé avant lui.
      try {
        await renommerIds(admin, account, await imapApply(admin, account, geste, [...connus].flatMap((id) => parFil.get(id) ?? [])))
      } catch (e) {
        console.error(`[mail-actions] lot IMAP refusé: ${redactedErrorMessage(e)}`)
        return json({ ok: true, results: ids.map((id) => ({ thread_id: id, ok: false, error: connus.has(id) ? 'provider_failed' : 'thread_not_found' })) })
      }
      chezLeFournisseur = async () => {}
    } else {
      let token: string
      try { token = await getValidAccessToken(admin, account, account.provider === 'gmail' ? cfg.gmail : cfg.outlook) } catch (e) {
        console.error(`[mail-actions] lot, jeton: ${redactedErrorMessage(e)}`)
        return json({ error: 'provider_failed' }, 502)
      }
      chezLeFournisseur = async (msgs) => renommerIds(admin, account, await pushToProvider(account, token, geste, msgs))
    }
    const results = await appliquerEnLot(ids, connus, async (id) => {
      const msgs = parFil.get(id) ?? []
      if (msgs.length === 0) return 'thread_empty'
      try { await chezLeFournisseur(msgs) } catch (e) {
        console.error(`[mail-actions] fil ${id}, fournisseur: ${redactedErrorMessage(e)}`)
        return 'provider_failed'
      }
      return ecrireLocalement(admin, account, geste, id, msgs)
    })
    return json({ ok: true, results })
  }

  const threadId = String(body.thread_id ?? '')
  const { data: thread, error: eThread } = await admin.from('mail_threads').select('id, is_read, is_starred, is_archived, is_trashed, is_spam, contact_id')
    .eq('id', threadId).eq('account_id', account.id).maybeSingle()
  // Une lecture en échec n'est pas un fil absent : la dire 404 enverrait l'agent
  // chercher un fil qu'il voit pourtant à l'écran.
  if (eThread) return json({ error: 'thread_query_failed', detail: eThread.message }, 500)
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
  // ⛔ Ce que le fournisseur doit recevoir, on refuse de le DEVINER. La lecture ne
  // vérifiait pas son erreur : `msgs = null` donnait une liste vide, la boucle de
  // `pushToProvider` « réussissait » sans rien envoyer, l'état local était écrit quand
  // même et l'API répondait `{ ok: true }`. L'agent archivait un fil : archivé dans le
  // CRM, intact dans Gmail — et le balayage de 2 minutes le rétablissait. Rien nulle
  // part ne pointait vers la cause. Un fil sans message est, lui, une anomalie : la
  // ligne de fil naît AVEC son premier message et `recomputeThread` la supprime dès
  // qu'elle se vide — mieux vaut le dire que le traiter comme un succès vide.
  const { data: msgs, error: eMsgs } = await admin.from('mail_messages').select('id, provider_message_id, direction, rfc822_message_id, is_spam').eq('thread_id', thread.id)
  if (eMsgs) return json({ error: 'messages_query_failed', detail: eMsgs.message }, 500)
  if (!msgs || msgs.length === 0) {
    console.error(`[mail-actions] fil ${thread.id} sans message — geste ${action} refusé`)
    return json({ error: 'thread_empty' }, 409)
  }

  try {
    // IMAP : un mot de passe et UNE connexion pour tout le fil (imap.ts) — pas de jeton OAuth.
    const renamed = account.provider === 'imap'
      ? await imapApply(admin, account, action as ThreadAction, msgs as MsgRow[])
      : await pushToProvider(account, await getValidAccessToken(admin, account, account.provider === 'gmail' ? cfg.gmail : cfg.outlook), action as ThreadAction, msgs as MsgRow[])
    await renommerIds(admin, account, renamed)
  } catch (e) {
    return json({ error: 'provider_failed', detail: e instanceof Error ? e.message : String(e) }, 502)
  }

  const echec = await ecrireLocalement(admin, account, action as ThreadAction, thread.id, msgs as MsgRow[])
  if (echec) return json({ error: echec }, 500)

  const { data: after, error: eAfter } = await admin.from('mail_threads').select('id, is_read, is_starred, is_archived, is_trashed, is_spam').eq('id', thread.id).single()
  // `{ ok: true, thread: null }` disait « c'est fait » sur un fil devenu illisible.
  if (eAfter || !after) return json({ error: 'thread_reload_failed', detail: eAfter?.message ?? 'aucune ligne' }, 500)
  return json({ ok: true, thread: after })
})
