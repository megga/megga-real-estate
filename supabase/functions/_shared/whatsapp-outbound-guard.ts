// LA GARDE D'ENVOI — point de passage unique de tout message WhatsApp sortant.
//
// POURQUOI ELLE NE PEUT PAS VIVRE AILLEURS.
//   · Pas dans `MetaProvider` : `buildSendTextRequest` ne reçoit qu'un `toPhone` en chiffres
//     nus, ni contactId ni agencyId. Il n'a pas de quoi décider.
//   · Pas dans `sendWithRetry` seul : cinq `fetch` bruts l'évitaient, dont DEUX chemins
//     client. Une garde qu'on peut contourner en écrivant `fetch` n'est pas une garde.
// Elle remplace donc l'ensemble BUILD + EXÉCUTION, et devient le seul endroit du dépôt qui
// appelle `provider.build*Request` hors de la gateway. C'est ce que vérifie la porte CI.
//
// TROIS DÉCISIONS PORTÉES PAR SA SIGNATURE.
//   · `kind` n'existe pas. Le sujet est DÉRIVÉ en SQL ; `contactId`/`profileId` sont des
//     INDICES que la RPC vérifie et peut contredire. Un `kind` déclaré par l'appelant était
//     un laissez-passer — le site de l'avis LPD passait déjà `'phone'`, ce qui désactivait
//     tout le registre, et une porte CI par grep de symboles ne lit pas les arguments.
//   · Le résultat est un TRIPLET. `sendWhatsAppText` rendait `{ok:false, error}` pour tout,
//     si bien que l'alerte d'échec de livraison aurait prévenu l'agent d'un « échec de
//     livraison » pour un refus de consentement. Un refus n'est pas une panne.
//   · `optOutAck` n'est pas un booléen TS mais `purpose:'opt_out_ack'`, arbitré EN SQL
//     (`contact_suppressions.ack_sent_at`). Un argument TS libre était contournable par
//     n'importe lequel des douze sites d'envoi.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getProvider, type SendConfig, type WhatsAppProvider, type OutboundTemplateMessage,
} from './whatsapp-gateway.ts'
import { sendWithRetry, type SendWithRetryOpts } from './whatsapp-retry.ts'
import { toWhatsAppText } from './whatsapp-format.ts'
import { meggaProse } from './megga-prose.ts'
import { isWhatsAppEnabled } from './whatsapp-config.ts'

export type OutboundPurpose =
  | 'service' | 'utility' | 'marketing' | 'lpd_notice' | 'opt_out_ack'
  /**
   * Code de vérification d'un numéro que l'agent vient de saisir. TROISIÈME finalité
   * PRIVILÉGIÉE — c'est la seule qui écrive à un numéro NON vérifié, donc la seule
   * capable de servir de démarchage si elle traînait. Comme `lpd_notice` et
   * `opt_out_ack`, elle est bornée géographiquement par la porte CI à un unique
   * fichier, et la RPC ne l'honore que s'il existe une vérification en cours, non
   * expirée, pour CE numéro et demandée par CET agent.
   */
  | 'number_verification'

/** Motif PRÉCIS — journalisé, jamais affiché tel quel à un agent. */
export type GuardReason =
  | 'invalid_phone' | 'subject_mismatch' | 'phone_suppressed'
  | 'ack_without_suppression' | 'ack_already_sent' | 'ack_not_requested'
  | 'agent_link_unverified' | 'do_not_contact' | 'opted_out' | 'no_opt_in'
  | 'marketing_requires_consent' | 'window_closed' | 'kill_switch'
  /** `number_verification` demandée sans vérification en cours pour ce numéro. */
  | 'no_pending_verification'

/** Motif EXPOSABLE — ce que le site d'appel a le droit de montrer. */
export type PublicReason = GuardReason | 'not_contactable'

export type OutboundPayload =
  | { type: 'text'; body: string }
  | { type: 'image'; url: string; caption?: string }
  | { type: 'document'; mediaId: string; filename: string; caption?: string }
  /**
   * `templateKey` est la clé INTERNE (`WaTemplateKey`), absente d'`OutboundTemplateMessage`
   * qui ne porte que le nom approuvé par Meta. C'est elle que l'historique du CRM journalise
   * depuis toujours, et elle seule qui reste lisible quand le nom Meta change au réapprouvage.
   */
  | { type: 'template'; message: OutboundTemplateMessage; templateKey?: string }

export interface SendOutboundArgs {
  admin: SupabaseClient
  provider?: WhatsAppProvider
  config?: SendConfig
  /** Numéro BRUT ; normalisé dans la garde. */
  to: string
  /** ⚠ Littéral de chaîne obligatoire — la porte CI de L6 refuse une variable. */
  purpose: OutboundPurpose
  payload: OutboundPayload
  /** Sujet DÉCLARÉ à titre d'indice. La RPC le VÉRIFIE et peut le contredire. */
  contactId?: string | null
  profileId?: string | null
  /** Agence de l'APPELANT — pilote la visibilité du motif, jamais la portée du blocage. */
  agencyId?: string | null
  scope?: 'all' | 'daily_brief'
  sentByProfileId?: string | null
  isAutomated?: boolean
  /** Parité colonne `whatsapp_messages.is_agent_error` — lue par l'alerte de livraison. */
  isAgentError?: boolean
  retry?: boolean
  /**
   * Profil de retry FIN, fusionné par-dessus ce que `retry` décide : chaque clé posée ici
   * l'emporte, les autres gardent le comportement du booléen.
   *
   * ⚠ `retry` est un booléen à deux positions, et deux positions ne suffisent pas. L'accusé
   * de désinscription et l'avis LPD ont un TROISIÈME régime, choisi explicitement : rejouer
   * les seuls refus de QUOTA (`retryNetworkError: false`), jamais un 5xx ni un timeout, qui
   * sont ambigus — Meta a peut-être livré, et rejouer doublonnerait un message vers un
   * CLIENT. En passant par la garde, ces deux sites avaient silencieusement basculé sur
   * `maxAttempts: 1` et le `timeoutMs` par défaut de 8000 : un throttle 429 sur l'accusé —
   * seul message que recevra jamais qui écrit « stop » en premier — n'était plus rejoué, et
   * chaque envoi du cron pouvait bloquer 8 s au lieu de 6 sur un budget de 90 s.
   */
  retryProfile?: Pick<SendWithRetryOpts, 'maxAttempts' | 'baseDelayMs' | 'timeoutMs' | 'retryNetworkError'>
  /** Défaut TRUE pour tout payload non-template. Fail-closed. */
  requireWindow?: boolean
  /** Appelé sur `window_closed` AVANT de rendre le refus (repli template HITL). */
  onWindowClosed?: () => Promise<boolean>
}

export type SendOutboundResult =
  | { ok: true; blocked?: false; providerMessageId: string | null; inWindow: boolean }
  | {
      ok: false; blocked: true; reason: GuardReason; publicReason: PublicReason
      inWindow: boolean; fallbackOffered: boolean
    }
  | { ok: false; blocked: false; error: string; inWindow: boolean }

/**
 * Marge appliquée à la fenêtre de service de 24 h.
 *
 * C'est une POLITIQUE, pas un fait : entre le verdict et le POST il s'écoule un build, un
 * éventuel retry et une latence réseau. Sans elle, un message décidé à 23 h 59 part après
 * l'expiration et revient en 131047 — alors qu'avec la marge l'agent se voit proposer le
 * repli template pendant que la fenêtre est encore ouverte.
 */
export const WINDOW_MARGIN_MINUTES = 15

interface Verdict {
  allowed: boolean
  reason: string
  public_reason: string
  in_24h_window: boolean
  legal_basis: string | null
  subject_kind: string | null
}

/** Digits nus. Aucun appel réseau : c'est la première barrière et la moins chère. */
export function normalizeOutboundPhone(raw: string | null | undefined): string {
  return (raw ?? '').replace(/\D/g, '')
}

/**
 * Un payload non-template exige-t-il la fenêtre ouverte ?
 *
 * ⚠ Le défaut est TRUE. Un défaut qui échoue OUVERT sur une garde de conformité est le
 * mauvais sens : l'appelant qui oublie l'argument obtient la règle, pas l'exception.
 * Un template, lui, EST le mécanisme prévu par Meta pour sortir de la fenêtre.
 */
export function needsOpenWindow(payloadType: OutboundPayload['type'], requireWindow?: boolean): boolean {
  if (payloadType === 'template') return false
  return requireWindow !== false
}

function metaConfig(): SendConfig {
  return {
    metaToken: Deno.env.get('META_WHATSAPP_TOKEN'),
    metaPhoneNumberId: Deno.env.get('META_PHONE_NUMBER_ID'),
    metaApiVersion: Deno.env.get('META_API_VERSION') ?? 'v22.0',
  }
}

/**
 * Journal d'un refus ou d'un échec.
 *
 * ⛔ JAMAIS le numéro complet : `activity_events` est append-only et conservé dix ans ; y
 * recopier un numéro créerait une seconde rétention, hors registre et hors DSAR.
 */
async function auditGuard(
  admin: SupabaseClient,
  action: 'whatsapp_send_blocked' | 'whatsapp_send_failed',
  a: SendOutboundArgs,
  meta: Record<string, unknown>,
): Promise<void> {
  try {
    // ⛔ `supabase-js` RETOURNE `{ error }`, il ne JETTE pas. Le `try/catch` seul n'attrapait
    // donc rien et le `console.error` ci-dessous n'était jamais atteint : une violation de
    // contrainte — `activity_events_category_messaging` pas encore appliquée, par exemple —
    // rendait l'audit des refus silencieusement inexistant. C'est très exactement le défaut
    // que ce bloc dit corriger. On lit le retour ; le `catch` ne couvre plus que ce qui jette
    // pour de bon (client mal construit, métadonnée non sérialisable).
    const { error } = await admin.from('activity_events').insert({
      agency_id: a.agencyId ?? null,
      actor_id: null,
      actor_kind: 'system',
      action,
      entity_type: a.contactId ? 'contact' : 'whatsapp_message',
      entity_id: a.contactId ?? null,
      category: 'messaging',
      severity: 'warn',
      metadata: {
        ...meta,
        purpose: a.purpose,
        payload_type: a.payload.type,
        phone_tail: normalizeOutboundPhone(a.to).slice(-4),
      },
    })
    if (error) console.error('whatsapp guard: audit non écrit:', error.message.slice(0, 120))
  } catch (e) {
    console.error('whatsapp guard: audit non écrit (exception):', String((e as Error)?.message ?? 'error').slice(0, 120))
  }
}

/**
 * Envoie un message WhatsApp, ou explique pourquoi il ne part pas.
 *
 * Ordre des vérifications, et il compte : bornage (aucun réseau) → kill-switch → registre
 * (dont la SUPPRESSION passe avant tout consentement) → fenêtre 24 h → build → envoi →
 * persistance. Chaque étape ne coûte que si la précédente a laissé passer.
 */
export async function sendOutboundGuarded(a: SendOutboundArgs): Promise<SendOutboundResult> {
  const provider = a.provider ?? getProvider('meta')
  const config = a.config ?? metaConfig()
  const to = normalizeOutboundPhone(a.to)

  const blocked = async (
    reason: GuardReason, publicReason: PublicReason, inWindow: boolean,
    fallbackOffered?: boolean,
  ): Promise<SendOutboundResult> => {
    await auditGuard(a.admin, 'whatsapp_send_blocked', a, {
      reason, in_window: inWindow,
      // La clé n'apparaît QUE là où la notion existe (`window_closed`, seul refus qui ait un
      // repli à proposer). L'écrire partout poserait un `false` sans signification dans les
      // douze autres motifs d'un journal append-only conservé dix ans.
      ...(fallbackOffered === undefined ? {} : { fallback_offered: fallbackOffered }),
    })
    return { ok: false, blocked: true, reason, publicReason, inWindow, fallbackOffered: fallbackOffered ?? false }
  }

  // 1. Bornage. La borne HAUTE empêche un JID de groupe (18 chiffres) de faire échouer
  //    l'insert, donc de rendre 500, donc de déclencher une tempête de rejeux Meta.
  if (to.length < 6 || to.length > 15) return blocked('invalid_phone', 'invalid_phone', false)

  // 2. Kill-switch. Gain réel du passage par la garde : `whatsapp-agent-async` et
  //    `kyc-report-pdf` sont les deux seules fonctions du dépôt qui ne le vérifiaient pas.
  if (!(await isWhatsAppEnabled(a.admin))) return blocked('kill_switch', 'kill_switch', false)

  // 3. Le registre. Le sujet y est DÉRIVÉ, jamais déclaré.
  const { data: rows, error: rpcErr } = await a.admin.rpc('whatsapp_send_allowed', {
    p_wa_phone: to,
    p_purpose: a.purpose,
    p_contact_id: a.contactId ?? null,
    p_profile_id: a.profileId ?? null,
    p_agency_id: a.agencyId ?? null,
    p_scope: a.scope ?? 'all',
    p_window_margin_minutes: WINDOW_MARGIN_MINUTES,
  })
  if (rpcErr) {
    // FAIL CLOSED. Une garde de conformité qui laisse passer quand elle ne sait pas ne
    // garde rien : la panne deviendrait le chemin d'attaque.
    console.error('whatsapp guard: verdict indisponible:', rpcErr.message.slice(0, 120))
    return { ok: false, blocked: false, error: `guard_unavailable: ${rpcErr.message}`, inWindow: false }
  }
  const v = (rows as Verdict[] | null)?.[0]
  if (!v) return { ok: false, blocked: false, error: 'guard_unavailable: verdict absent', inWindow: false }

  const inWindow = v.in_24h_window === true
  if (!v.allowed) {
    return blocked(v.reason as GuardReason, v.public_reason as PublicReason, inWindow)
  }

  // 4. Routage 24 h. Le crochet AVANT le refus : sans lui, refuser en amont du POST rendrait
  //    `offerTemplateFallback` du code MORT — c'est le `!sres.ok` du 131047 qui le déclenche
  //    aujourd'hui, et l'agent recevrait un refus sec au lieu de la proposition de template.
  if (needsOpenWindow(a.payload.type, a.requireWindow) && !inWindow) {
    let fallbackOffered = false
    if (a.onWindowClosed) {
      try { fallbackOffered = await a.onWindowClosed() }
      catch (e) { console.warn('whatsapp guard: repli template échoué:', String((e as Error)?.message ?? 'error').slice(0, 80)) }
    }
    // ⚠ Par `blocked()`, comme les treize autres refus. Le retour construit à la main ici
    // avait fait diverger deux chemins qui doivent rendre la même forme — et laissé le
    // paramètre `fallbackOffered` de `blocked()` sans aucun appelant, donc jamais éprouvé.
    return blocked('window_closed', 'window_closed', false, fallbackOffered)
  }

  // 5. Build — dernier point du dépôt à appeler provider.build*Request.
  let req
  try {
    req = buildRequest(provider, to, a.payload, config)
  } catch (e) {
    return { ok: false, blocked: false, error: String((e as Error)?.message ?? 'build_failed'), inWindow }
  }
  if (!req) return { ok: false, blocked: false, error: 'unsupported_payload', inWindow }

  // 6. Envoi. ⚠ `retry` n'est sûr que vers un AGENT : l'API Meta n'est pas idempotente, un
  //    rejeu vers un client doublonnerait son message.
  const sr = await sendWithRetry(req, (s, b) => provider.parseSendResult(s, b),
    { maxAttempts: a.retry ? 3 : 1, ...a.retryProfile })
  if (!sr.ok) {
    await auditGuard(a.admin, 'whatsapp_send_failed', a, {
      in_window: inWindow, error: String(sr.error ?? 'error').slice(0, 120),
    })
    return { ok: false, blocked: false, error: sr.error ?? 'send_failed', inWindow }
  }

  // 7. Persistance. ⚠ AUCUNE ligne `queued` avant le POST : `whatsapp_messages_status_check`
  //    n'a pas ce barreau, et l'échelle est lue par le filtre d'UPDATE de parseStatusUpdates.
  //    L'idempotence pré-POST est un chantier distinct, à ne pas glisser ici.
  try {
    // Même lecture du retour qu'en `auditGuard` : sans elle, un sortant non persisté ne
    // laissait aucune trace, et le message parti n'existait nulle part côté CRM.
    const { error } = await a.admin.from('whatsapp_messages').upsert({
      provider: provider.name,
      // Repli synthétique : `provider_message_id` est NOT NULL et Meta peut rendre 200 sans
      // id. Même convention que les sites existants.
      provider_message_id: sr.providerMessageId ?? `local-${a.purpose}-${to.slice(-4)}-${Date.now()}`,
      direction: 'outbound',
      wa_to: to,
      // ⚠ `metaPhoneNumberId` (id de compte Meta) et NON le numéro Business : c'est la
      // convention en place sur les cinq sites existants, et la changer ferait diverger
      // l'historique. Le repli 'megga' satisfait le NOT NULL.
      wa_from: config.metaPhoneNumberId ?? 'megga',
      contact_id: a.contactId ?? null,
      agency_id: a.agencyId ?? null,
      body: outboundBody(a.payload),
      media_type: a.payload.type === 'image' ? 'image' : a.payload.type === 'document' ? 'document' : null,
      media_url: a.payload.type === 'image' ? a.payload.url : null,
      // ⛔ 'received' et non 'sent' : l'échelle est MONOTONE et `allowedPriorStatuses('sent')`
      // vaut ['received']. Un sortant inséré en 'sent' ne matcherait plus l'event `sent` de
      // Meta, et la progression des statuts démarrerait cassée.
      status: 'received',
      sent_by_profile_id: a.sentByProfileId ?? null,
      is_automated: a.isAutomated ?? false,
      is_agent_error: a.isAgentError ?? false,
    }, { onConflict: 'provider,provider_message_id', ignoreDuplicates: true })
    // Le message EST parti : ne pas le trahir en rendant un échec. On journalise et on rend ok.
    if (error) console.error('whatsapp guard: sortant non persisté:', error.message.slice(0, 120))
  } catch (e) {
    console.error('whatsapp guard: sortant non persisté (exception):', String((e as Error)?.message ?? 'error').slice(0, 120))
  }

  // L'accusé de désinscription consomme son unique jeton — et seulement s'il est PARTI.
  // ⚠ Le retour compte plus qu'ailleurs : un `mark_suppression_ack_sent` raté laisse
  // `ack_sent_at` NULL, donc le prochain passage renverra un SECOND accusé à quelqu'un qui
  // a demandé le silence.
  if (a.purpose === 'opt_out_ack') {
    try {
      const { error } = await a.admin.rpc('mark_suppression_ack_sent', { p_wa_phone: to })
      if (error) console.error('whatsapp guard: ack non marqué:', error.message.slice(0, 80))
    } catch (e) {
      console.error('whatsapp guard: ack non marqué (exception):', String((e as Error)?.message ?? 'error').slice(0, 80))
    }
  }

  return { ok: true, providerMessageId: sr.providerMessageId, inWindow }
}

/** Corps journalisé côté CRM. Une légende vaut mieux qu'un vide pour une image. */
function outboundBody(p: OutboundPayload): string | null {
  switch (p.type) {
    case 'text': return p.body
    case 'image': return p.caption ?? null
    case 'document': return p.caption ?? p.filename
    // ⚠ L'espace et la CLÉ, tous deux repris de l'existant : le CRM affiche `[template: <clé>]`
    // depuis l'origine (webhook, avant la garde). En rendant `[template:<nom Meta>]` on avait
    // introduit un SECOND format dans un historique qui n'en avait qu'un, et remplacé un mot
    // stable par un nom qui change à chaque réapprouvage Meta.
    case 'template': return `[template: ${p.templateKey ?? p.message.templateName}]`
  }
}

/**
 * Construit la requête HTTP. `meggaProse` + `toWhatsAppText` s'appliquent aux textes ET aux
 * légendes — un message client est un message client, quel que soit son support. JAMAIS au
 * template : ses variables sont validées telles quelles par Meta.
 */
function buildRequest(
  provider: WhatsAppProvider, to: string, p: OutboundPayload, config: SendConfig,
) {
  switch (p.type) {
    case 'text':
      return provider.buildSendTextRequest({ toPhone: to, body: toWhatsAppText(meggaProse(p.body)) }, config)
    case 'image':
      return provider.buildSendImageRequest?.({
        toPhone: to, link: p.url,
        caption: p.caption ? toWhatsAppText(meggaProse(p.caption)) : undefined,
      }, config) ?? null
    case 'document':
      return provider.buildSendDocumentRequest?.({
        toPhone: to, mediaId: p.mediaId, filename: p.filename,
        caption: p.caption ? toWhatsAppText(meggaProse(p.caption)) : undefined,
      }, config) ?? null
    case 'template':
      return provider.buildSendTemplateRequest?.({ ...p.message, toPhone: to }, config) ?? null
  }
}
