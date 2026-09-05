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
import { MailOwnerLeftError, assertOwnerStillInAgency } from './guard.ts'
import type { ProviderConfig } from './guard.ts'

export interface SyncDeps { fetch?: typeof fetch; now?: () => number }
export interface SyncOutcome {
  inserted: number
  updated: number
  changes: number
  /** Entrées de timeline refusées par `activity_events` — la passe a continué, mais ça se voit. */
  auditFailures: number
  done: boolean
  error: string | null
  /** Une autre passe tenait le bail de ce compte : rien n'a été fait, rien n'est perdu. */
  skipped?: 'locked'
}

const INITIAL_WINDOW_DAYS = 90
const NEXT_TICK_MS = 2 * 60_000
/**
 * Délai d'une passe initiale INACHEVÉE. ⚠ Ce n'était pas un délai mais `0` — un compte en
 * cours d'import 90 jours était donc TOUJOURS dû, avec le `next_sync_at` le plus ancien de
 * la file : il repassait en tête de `order('next_sync_at')` à chaque tick. Trois ou quatre
 * agences accueillies le même jour monopolisaient tous les ticks, et TOUTES les autres
 * boîtes du produit cessaient de se synchroniser — `status` restant 'active', `last_error`
 * nul, un `last_sync_at` de plus en plus vieux que personne ne lit. Quinze secondes suffisent
 * à les faire céder le pas aux comptes de la cadence normale sans ralentir l'import.
 */
const INITIAL_RESUME_MS = 15_000
const BACKOFF_MS = 10 * 60_000
/**
 * Marge du bail par compte au-delà du budget de la passe. Le bail existe parce que les
 * quatre chemins de synchro (balayage cron, `mail-sync` ciblé, `mail-actions sync_now`,
 * première passe de `mail-oauth exchange`) n'en prenaient AUCUN : seul le balayage était
 * sérialisé, contre lui-même. Un membre pouvait donc boucler `sync_now` sur une boîte
 * partagée — chaque appel brûlant le quota fournisseur de tous ses collègues — et deux
 * passes concurrentes écrivaient `sync_cursor` sans compare-and-set, chacune pouvant
 * rembobiner l'autre (courrier réingéré, ou sauté).
 */
const LEASE_MARGIN_MS = 30_000

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

/**
 * Prend le bail d'UN compte, même mécanique que le bail de balayage (mail-sync/index.ts) et
 * pour la même raison : `mail_cron_locks` est une table de baux, `job` en est la clé.
 *
 * ⚠ La ligne du compte n'existe pas à la première passe : on tente d'abord la prise (le cas
 * courant, une seule instruction), et on ne sème que si elle n'a rien appariée. Semer
 * d'abord coûterait un aller-retour à chaque synchro de chaque compte. `ignoreDuplicates`
 * garantit qu'un semis n'écrase jamais un bail tenu.
 */
async function acquireAccountLease(admin: SupabaseClient, job: string, until: string, nowIso: string): Promise<boolean> {
  const take = async (): Promise<boolean> => {
    const { data, error } = await admin.from('mail_cron_locks').update({ locked_until: until })
      .eq('job', job).lt('locked_until', nowIso).select('job')
    if (error) throw new Error(`account lease: ${error.message}`)
    return (data ?? []).length === 1
  }
  if (await take()) return true
  const { error } = await admin.from('mail_cron_locks')
    .upsert({ job, locked_until: new Date(0).toISOString() }, { onConflict: 'job', ignoreDuplicates: true })
  if (error) throw new Error(`account lease seed: ${error.message}`)
  return take()
}

/** Rend le bail — et SEULEMENT le sien (`locked_until` sert de jeton, cf. `releaseLock`). */
async function releaseAccountLease(admin: SupabaseClient, job: string, until: string, nowIso: string): Promise<void> {
  const { error } = await admin.from('mail_cron_locks').update({ locked_until: nowIso })
    .eq('job', job).eq('locked_until', until)
  if (error) console.error(`[mail-sync] bail ${job} non relâché:`, error.message)
}

export async function syncAccount(admin: SupabaseClient, account: MailAccountRow, cfg: ProviderConfig, budgetMs: number, deps: SyncDeps = {}): Promise<SyncOutcome> {
  const now = deps.now ?? Date.now
  const start = now()
  const out: SyncOutcome = { inserted: 0, updated: 0, changes: 0, auditFailures: 0, done: true, error: null }
  // ⛔ UNE SEULE PASSE À LA FOIS PAR COMPTE, quel que soit le chemin d'appel. Le bail est
  // pris ici et non chez les appelants, parce qu'il y en a quatre et qu'un seul d'entre eux
  // se souvenait de se protéger. TTL = budget + marge : au pire, un compte reste bloqué le
  // temps d'une passe morte, jamais plus.
  const job = `mail-sync:${account.id}`
  const leaseUntil = new Date(now() + budgetMs + LEASE_MARGIN_MS).toISOString()
  let held = false
  try {
    held = await acquireAccountLease(admin, job, leaseUntil, new Date(now()).toISOString())
    if (!held) {
      // Ni erreur ni succès : une autre passe travaille sur ce compte. `next_sync_at` n'est
      // pas touché, donc il reste dû et repassera au tick suivant.
      out.done = false
      out.skipped = 'locked'
      return out
    }
    // AVANT le moindre appel fournisseur : une boîte dont le propriétaire a quitté
    // l'agence ne s'ingère plus (guard.ts, miroir écriture de `mail_account_visible`).
    await assertOwnerStillInAgency(admin, account)
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
      next_sync_at: new Date(now() + (out.done ? NEXT_TICK_MS : INITIAL_RESUME_MS)).toISOString(),
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
    // Le départ du propriétaire est TERMINAL et immédiat : pas un échec transitoire à
    // réessayer cinq fois, mais une boîte qui ne doit plus jamais être ingérée dans
    // cette agence. `disabled` la retire de `mail_accounts_due_idx` dès ce tick.
    const terminal = e instanceof MailOwnerLeftError
      ? 'disabled'
      : reauth ? 'reauth_required' : failures >= MAX_CONSECUTIVE_FAILURES ? 'error' : null
    const { error: eWrite } = await admin.from('mail_accounts').update({
      last_error: msg.slice(0, 500),
      sync_failures: failures,
      next_sync_at: new Date(now() + Math.min(BACKOFF_MS * failures, MAX_BACKOFF_MS)).toISOString(),
      ...(terminal ? { status: terminal } : {}),
    }).eq('id', account.id)
    // Dernier filet : si même cette écriture échoue, l'échec n'existe NULLE PART.
    if (eWrite) console.error(`[mail-sync] ${account.id}: last_error non écrit (${eWrite.message})`)
    console.error(`[mail-sync] ${account.provider} ${account.id} (échec ${failures}${terminal ? `, statut ${terminal}` : ''}): ${msg}`)
  } finally {
    // Rendu quoi qu'il arrive : un bail oublié bloquerait le compte jusqu'au TTL.
    if (held) await releaseAccountLease(admin, job, leaseUntil, new Date(now()).toISOString())
  }
  return out
}

/** Ids fournisseur déjà en base parmi ceux-ci (une lecture en échec LÈVE, elle ne devine pas). */
async function knownProviderIds(admin: SupabaseClient, accountId: string, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set()
  const { data, error } = await admin.from('mail_messages').select('provider_message_id')
    .eq('account_id', accountId).in('provider_message_id', ids)
  if (error) throw new Error(`known ids lookup: ${error.message}`)
  return new Set((data ?? []).map((r: { provider_message_id: string }) => r.provider_message_id))
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
      // Les ids DÉJÀ en base ne se retéléchargent pas — même pré-contrôle que le côté
      // Graph. Sans lui, une page reprise après un dépassement de budget rejouait ses 50
      // `messages.get` à chaque tick sans jamais progresser : le budget ne suffisant pas
      // la première fois, il ne suffirait jamais.
      const known = await knownProviderIds(admin, account.id, page.ids)
      const msgs: NormalizedMessage[] = []
      let exhausted = false
      for (const id of page.ids) {
        // ⛔ LE BUDGET SE VÉRIFIE DANS LA BOUCLE DES MESSAGES, pas seulement en tête de
        // page. Une page = jusqu'à 50 `messages.get` SÉQUENTIELS : entamée à une
        // milliseconde de la fin du budget, elle allait au bout — ~8 s de dépassement à
        // 150 ms l'appel, bien plus sur un compte limité en débit. Le balayage tient un
        // bail de 180 s pendant que pg_cron tire toutes les 120 s : c'est ce
        // dépassement-là qui finit par faire tourner deux balayages côte à côte.
        if (now() - start >= budgetMs) { exhausted = true; break }
        if (known.has(id)) continue
        msgs.push(normalizeGmailMessage(await gmailGetMessage(token, id, deps), account.email))
      }
      const r = await ingestMessages(admin, account, msgs)
      out.inserted += r.inserted; out.updated += r.updated; out.auditFailures += r.auditFailures
      // ⚠ Le `pageToken` n'avance QUE si la page a été lue en entier. Sinon le tick suivant
      // la reliste et saute ce qui est déjà écrit — au lieu de sauter ce qui ne l'est pas.
      if (exhausted) break
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
  let exhausted = false
  for (let i = 0; i < 5 && now() - start < budgetMs; i++) {
    const h = await gmailHistory(token, c.historyId!, pageToken, deps)
    if (h.expired) {
      // Historique trop ancien côté Google : on repart sur 90 jours, sans boucle d'erreur.
      return { kind: 'gmail', historyId: null, initialPageToken: null, initialDone: false, historyPageToken: null }
    }
    const { added, changes } = historyToChanges(h.page!)
    const msgs: NormalizedMessage[] = []
    for (const id of added) {
      // Même borne qu'à la passe initiale : une page d'historique peut porter jusqu'à
      // 100 enregistrements, donc autant de `messages.get` séquentiels.
      if (now() - start >= budgetMs) { exhausted = true; break }
      try { msgs.push(normalizeGmailMessage(await gmailGetMessage(token, id, deps), account.email)) }
      catch (e) { if (!(e instanceof Error && /http 404/.test(e.message))) throw e } // supprimé entre-temps
    }
    const r = await ingestMessages(admin, account, msgs)
    out.inserted += r.inserted; out.updated += r.updated; out.auditFailures += r.auditFailures
    out.changes += await applyRemoteChanges(admin, account, changes)
    // ⚠ Page abandonnée en cours : le curseur NE BOUGE PAS. `historyId` et `pageToken`
    // restent ceux d'avant, donc la même page d'historique est rejouée au tick suivant —
    // les messages déjà écrits y sont réingérés à l'identique (idempotent), ceux qui
    // manquaient sont enfin chargés. Avancer ici les perdrait définitivement.
    if (exhausted) break
    const nxt = nextHistoryCursor(c.historyId, h.page!)
    c.historyId = nxt.historyId
    pageToken = nxt.pageToken
    if (!pageToken) break
  }
  c.historyPageToken = pageToken
  // ⚠ `done` dit « il ne reste rien à faire ». Une page abandonnée en cours de budget en
  // laisse, même quand la pagination était drainée : sans ce `!exhausted`, la passe se
  // déclarait finie et `next_sync_at` repartait à deux minutes au lieu de quinze secondes.
  out.done = !exhausted && pageToken === null
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
    // Une lecture en échec ferait passer TOUS les messages connus pour neufs : autant
    // de GET de corps et de pièces inutiles, et un `update` complet de chaque ligne.
    const known = await knownProviderIds(admin, account.id, ids)
    const { added, changes, removed } = deltaToChanges(d.items, known, c.folderIds)
    // Un `@removed` n'est PAS une suppression tant qu'un GET ne l'a pas dit (le delta
    // est par dossier : archiver produit le même signal qu'effacer).
    for (const r of removed) {
      const resolved: RemoteChange | null = await resolveGraphRemoval(token, r, c.folderIds, deps)
      if (resolved) changes.push(resolved)
    }
    const msgs: NormalizedMessage[] = []
    let exhausted = false
    for (const m of added) {
      // Chaque message ajouté coûte un `graphGetBody` PLUS un `graphListAttachments` :
      // une page de 50 vaut donc jusqu'à 100 allers-retours séquentiels, contrôlés
      // jusqu'ici par le seul test d'entrée de dossier.
      if (now() - start >= budgetMs) { exhausted = true; break }
      const body = await graphGetBody(token, m.id, deps)
      const atts = m.hasAttachments ? await graphListAttachments(token, m.id, deps) : []
      msgs.push(normalizeGraphMessage(m, body, atts, c.folderIds, account.email))
    }
    const r = await ingestMessages(admin, account, msgs)
    out.inserted += r.inserted; out.updated += r.updated; out.auditFailures += r.auditFailures
    out.changes += await applyRemoteChanges(admin, account, changes)
    // ⛔ Dossier abandonné en cours : le curseur de CE dossier ne bouge pas. L'avancer
    // consommerait le delta des messages jamais chargés — perdus sans une trace. Rejoué
    // au tick suivant, le même delta les rend `added` (les autres sont désormais connus,
    // donc de simples drapeaux) : la passe progresse au lieu de tourner en rond.
    if (exhausted) { allSettled = false; break }
    // deltaLink = passe finie pour ce dossier ; nextLink = il reste des pages (curseur provisoire).
    c[f.key] = d.deltaLink ?? d.nextLink
    if (!d.deltaLink) allSettled = false
  }
  if (allSettled) c.initialDone = true
  out.done = allSettled
  return c
}
