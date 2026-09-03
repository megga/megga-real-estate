// supabase/functions/_shared/mail/sync.ts
// Une passe de synchronisation d'un compte, bornée par un budget de temps.
// Curseurs (types.ts) : Gmail = historyId + pageToken de la passe initiale ;
// Graph = deltaLink/nextLink par dossier + ids de dossiers.
// Échecs : reauth_required ⇒ le compte est déjà marqué (secrets.ts) ; autre
// erreur ⇒ last_error + backoff 10 min, statut inchangé (transitoire).
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import type { GmailCursor, GraphCursor, MailAccountRow, NormalizedMessage, SyncCursor } from './types.ts'
import { MailAuthError, getValidAccessToken } from './secrets.ts'
import { gmailGetMessage, gmailHistory, gmailIdentity, gmailListInitial, historyToChanges, nextHistoryCursor, normalizeGmailMessage } from './gmail.ts'
import { deltaToChanges, graphDelta, graphFolderIds, graphGetBody, graphListAttachments, normalizeGraphMessage, resolveGraphRemoval } from './graph.ts'
import { applyRemoteChanges, ingestMessages } from './ingest.ts'
import type { RemoteChange } from './types.ts'
import type { ProviderConfig } from './guard.ts'

export interface SyncDeps { fetch?: typeof fetch; now?: () => number }
export interface SyncOutcome { inserted: number; updated: number; changes: number; done: boolean; error: string | null }

const INITIAL_WINDOW_DAYS = 90
const NEXT_TICK_MS = 2 * 60_000
const BACKOFF_MS = 10 * 60_000

/**
 * Échecs consécutifs après lesquels le compte quitte le balayage (`status = 'error'`).
 * ⚠ Un seuil, pas un verdict immédiat sur le code HTTP : le 403 de Gmail couvre AUSSI
 * `rateLimitExceeded` / `userRateLimitExceeded`, transitoires par construction —
 * l'utiliser comme état terminal éteindrait une boîte saine pendant un pic de quota.
 * Cinq échecs d'affilée, avec le backoff élargi ci-dessous, valent ~2 h de panne
 * ininterrompue : plus aucune chance que ce soit passager.
 */
const MAX_CONSECUTIVE_FAILURES = 5
/** Le backoff s'élargit avec les échecs (10, 20, 30… min), plafonné à 1 h. */
const MAX_BACKOFF_MS = 60 * 60_000

function since(now: number): string {
  return new Date(now - INITIAL_WINDOW_DAYS * 86_400_000).toISOString()
}

export async function syncAccount(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, deps: SyncDeps = {}): Promise<SyncOutcome> {
  const now = deps.now ?? Date.now
  const start = now()
  const out: SyncOutcome = { inserted: 0, updated: 0, changes: 0, done: true, error: null }
  try {
    let cursor: SyncCursor
    if (account.provider === 'gmail') cursor = await syncGmail(admin, account, cfg, budgetMs, start, deps, out)
    else if (account.provider === 'outlook') cursor = await syncGraph(admin, account, cfg, budgetMs, start, deps, out)
    else throw new Error(`provider ${account.provider} not supported by this build`)
    // ⛔ L'écriture du curseur est VÉRIFIÉE. Muette, elle laissait `{ done: true,
    // error: null }` sur une passe qui n'avait rien mémorisé : la passe initiale
    // retéléchargeait les 50 mêmes messages toutes les 2 minutes sans jamais dépasser
    // le 50e, `next_sync_at` ne bougeait pas — le compte restait en tête de la file et
    // affamait les autres — et `last_error` gardait l'erreur de la veille. Lever
    // renvoie dans le catch, qui écrit `last_error` et un backoff.
    const { error } = await admin.from('mail_accounts').update({
      sync_cursor: cursor,
      last_sync_at: new Date(now()).toISOString(),
      last_error: null,
      sync_failures: 0,
      next_sync_at: new Date(now() + (out.done ? NEXT_TICK_MS : 0)).toISOString(),
    }).eq('id', account.id)
    if (error) throw new Error(`cursor write: ${error.message}`)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    out.error = msg
    out.done = true
    const reauth = e instanceof MailAuthError && e.code === 'reauth_required'
    // Compteur d'échecs consécutifs : sans lui, `status` ne pouvait dire « cassée »
    // que pour la reconnexion, et les cinq autres façons de mourir (403 de quota,
    // pointeur Vault orphelin, erreur d'ingestion, provider non gelé, refus Graph)
    // laissaient la boîte `active` à réessayer toutes les 10 minutes pour toujours —
    // indiscernable, pour l'agent comme pour le lot 2, d'une boîte sans courrier neuf.
    const failures = (account.sync_failures ?? 0) + 1
    const terminal = reauth ? 'reauth_required' : failures >= MAX_CONSECUTIVE_FAILURES ? 'error' : null
    const { error: eWrite } = await admin.from('mail_accounts').update({
      last_error: msg.slice(0, 500),
      sync_failures: failures,
      next_sync_at: new Date(now() + Math.min(BACKOFF_MS * failures, MAX_BACKOFF_MS)).toISOString(),
      ...(terminal ? { status: terminal } : {}),
    }).eq('id', account.id)
    // Dernier filet : si même cette écriture échoue, l'échec n'existe NULLE PART.
    if (eWrite) console.error(`[mail-sync] ${account.id}: last_error non écrit (${eWrite.message})`)
    console.error(`[mail-sync] ${account.provider} ${account.id} (échec ${failures}${terminal ? `, statut ${terminal}` : ''}): ${msg}`)
  }
  return out
}

// ── Gmail ─────────────────────────────────────────────────────────────────────
async function syncGmail(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, start: number, deps: SyncDeps, out: SyncOutcome): Promise<GmailCursor> {
  const now = deps.now ?? Date.now
  const token = await getValidAccessToken(admin, account, cfg.gmail, deps)
  const c: GmailCursor = (account.sync_cursor as GmailCursor)?.kind === 'gmail'
    ? (account.sync_cursor as GmailCursor)
    : { kind: 'gmail', historyId: null, initialPageToken: null, initialDone: false, historyPageToken: null }

  if (!c.initialDone) {
    // Le historyId est capturé AVANT la première page : tout ce qui bouge pendant
    // la passe initiale sera rejoué par history.list, rien n'est perdu.
    if (!c.historyId) c.historyId = (await gmailIdentity(token, deps)).historyId
    while (now() - start < budgetMs) {
      const page = await gmailListInitial(token, c.initialPageToken, deps)
      const msgs: NormalizedMessage[] = []
      for (const id of page.ids) msgs.push(normalizeGmailMessage(await gmailGetMessage(token, id, deps), account.email))
      const r = await ingestMessages(admin, account, msgs)
      out.inserted += r.inserted; out.updated += r.updated
      c.initialPageToken = page.nextPageToken
      if (!page.nextPageToken) { c.initialDone = true; break }
    }
    out.done = c.initialDone
    return c
  }

  // ⛔ La pagination reprend là où le tick précédent l'a laissée. Le pageToken vivait
  // dans une variable LOCALE : une pagination coupée par le budget était perdue, et
  // comme le curseur était déjà avancé à la tête, les pages restantes n'étaient jamais
  // lues (cf. `nextHistoryCursor`). Il est désormais dans le curseur persisté.
  let pageToken: string | null = c.historyPageToken ?? null
  for (let i = 0; i < 5 && now() - start < budgetMs; i++) {
    const h = await gmailHistory(token, c.historyId!, pageToken, deps)
    if (h.expired) {
      // Historique trop ancien côté Google : on repart sur 90 jours, sans boucle d'erreur.
      return { kind: 'gmail', historyId: null, initialPageToken: null, initialDone: false, historyPageToken: null }
    }
    const { added, changes } = historyToChanges(h.page!)
    const msgs: NormalizedMessage[] = []
    for (const id of added) {
      try { msgs.push(normalizeGmailMessage(await gmailGetMessage(token, id, deps), account.email)) }
      catch (e) { if (!(e instanceof Error && /http 404/.test(e.message))) throw e } // supprimé entre-temps
    }
    const r = await ingestMessages(admin, account, msgs)
    out.inserted += r.inserted; out.updated += r.updated
    out.changes += await applyRemoteChanges(admin, account, changes)
    const nxt = nextHistoryCursor(c.historyId, h.page!)
    c.historyId = nxt.historyId
    pageToken = nxt.pageToken
    if (!pageToken) break
  }
  c.historyPageToken = pageToken
  out.done = pageToken === null
  return c
}

// ── Microsoft Graph ───────────────────────────────────────────────────────────
async function syncGraph(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, start: number, deps: SyncDeps, out: SyncOutcome): Promise<GraphCursor> {
  const now = deps.now ?? Date.now
  const token = await getValidAccessToken(admin, account, cfg.outlook, deps)
  const c: GraphCursor = (account.sync_cursor as GraphCursor)?.kind === 'outlook'
    ? (account.sync_cursor as GraphCursor)
    : { kind: 'outlook', inboxDelta: null, sentDelta: null, initialDone: false, folderIds: null }
  if (!c.folderIds) c.folderIds = await graphFolderIds(token, deps)

  const folders: { name: 'inbox' | 'sentitems'; key: 'inboxDelta' | 'sentDelta' }[] = [{ name: 'inbox', key: 'inboxDelta' }, { name: 'sentitems', key: 'sentDelta' }]
  let allSettled = true
  for (const f of folders) {
    if (now() - start >= budgetMs) { allSettled = false; break }
    const d = await graphDelta(token, f.name, c[f.key], since(now()), deps)
    const ids = d.items.filter((i) => !i['@removed']).map((i) => i.id)
    const { data: knownRows, error: eKnown } = ids.length
      ? await admin.from('mail_messages').select('provider_message_id').eq('account_id', account.id).in('provider_message_id', ids)
      : { data: [] as { provider_message_id: string }[], error: null }
    // Une lecture en échec ferait passer TOUS les messages connus pour neufs : autant
    // de GET de corps et de pièces inutiles, et un `update` complet de chaque ligne.
    if (eKnown) throw new Error(`known ids lookup: ${eKnown.message}`)
    const known = new Set((knownRows ?? []).map((r: { provider_message_id: string }) => r.provider_message_id))
    const { added, changes, removed } = deltaToChanges(d.items, known, c.folderIds)
    // Un `@removed` n'est PAS une suppression tant qu'un GET ne l'a pas dit (le delta
    // est par dossier : archiver produit le même signal qu'effacer).
    for (const r of removed) {
      const resolved: RemoteChange | null = await resolveGraphRemoval(token, r, c.folderIds, deps)
      if (resolved) changes.push(resolved)
    }
    const msgs: NormalizedMessage[] = []
    for (const m of added) {
      const body = await graphGetBody(token, m.id, deps)
      const atts = m.hasAttachments ? await graphListAttachments(token, m.id, deps) : []
      msgs.push(normalizeGraphMessage(m, body, atts, c.folderIds, account.email))
    }
    const r = await ingestMessages(admin, account, msgs)
    out.inserted += r.inserted; out.updated += r.updated
    out.changes += await applyRemoteChanges(admin, account, changes)
    // deltaLink = passe finie pour ce dossier ; nextLink = il reste des pages (curseur provisoire).
    c[f.key] = d.deltaLink ?? d.nextLink
    if (!d.deltaLink) allSettled = false
  }
  if (allSettled) c.initialDone = true
  out.done = allSettled
  return c
}
