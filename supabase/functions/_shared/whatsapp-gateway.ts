// Couche d'abstraction provider WhatsApp. Le code applicatif (edge functions)
// parle à cette interface, jamais directement à l'API Meta. C'est ce qui a
// permis de retirer OpenWA (04.08.2026) sans toucher aux fonctions d'envoi.
// Couvre : entrant (parseInbound), envoi (buildSend*), accusés de lecture, et
// statuts de livraison des sortants (parseStatusUpdates — events `statuses` Meta).
// N'utilise que la Web Crypto API → testable Vitest (Node) ET exécutable Deno.

export interface NormalizedInboundMessage {
  providerMessageId: string
  sessionId: string | null
  fromPhone: string
  toPhone: string | null
  body: string | null
  mediaType: NormalizedMediaType | null
  mediaUrl: string | null
  mediaId: string | null
  mediaMime: string | null
  timestamp: string | null
  raw: unknown
}

export type NormalizedMediaType =
  | 'image' | 'audio' | 'video' | 'document' | 'location' | 'contact' | 'sticker'

export interface OutboundTextMessage {
  toPhone: string   // digits only, international without +
  body: string
}

export interface OutboundDocumentMessage {
  toPhone: string       // digits only, international sans +
  mediaId: string       // media id Meta (upload préalable)
  filename: string      // nom affiché dans WhatsApp
  caption?: string      // légende optionnelle
}

export interface OutboundImageMessage {
  toPhone: string       // digits only, international sans +
  link: string          // URL https publique (photo R2) — Meta la télécharge, pas d'upload
  caption?: string      // légende optionnelle
}

// Message TEMPLATE (Meta) — seul type autorisé HORS de la fenêtre de service 24h. Le
// template doit être pré-approuvé dans Meta Business Manager ; `templateName` + `languageCode`
// doivent correspondre EXACTEMENT à l'approbation, et `bodyParams` remplit {{1}}, {{2}}… du
// corps DANS L'ORDRE. Cf. _shared/whatsapp-templates.ts (registre côté code).
export interface OutboundTemplateMessage {
  toPhone: string           // digits only, international sans +
  templateName: string      // nom EXACT du template approuvé
  languageCode: string      // ex. 'fr', 'fr_CH', 'en' — doit matcher l'approbation
  bodyParams?: string[]     // variables du corps {{1}}, {{2}}… dans l'ordre (omis si aucune)
}

export interface SendConfig {
  // Meta Cloud API
  metaToken?: string
  metaPhoneNumberId?: string
  metaApiVersion?: string        // default 'v22.0'
}

export interface SendHttpRequest {
  url: string
  method: 'POST'
  headers: Record<string, string>
  body: string                    // JSON string
}

export interface SendResult {
  ok: boolean
  providerMessageId: string | null
  error?: string
}

// Statut de livraison normalisé d'un message SORTANT (events `statuses` du webhook).
export interface StatusUpdate {
  providerMessageId: string
  status: 'sent' | 'delivered' | 'read' | 'failed'
  timestamp: string | null
  recipientPhone: string | null
  errorCode: number | null
  errorDetail: string | null
}

/**
 * Un seul provider depuis le retrait d'OpenWA (04.08.2026) : Meta Cloud API.
 *
 * L'interface est conservée — c'est elle qui a rendu ce retrait possible sans
 * toucher aux quatre fonctions d'envoi — mais les méthodes ci-dessous restent
 * optionnelles pour une raison HISTORIQUE : elles l'étaient parce qu'OpenWA ne
 * les supportait pas. Meta les implémente toutes. Un futur second provider
 * décidera s'il faut les rendre obligatoires ; les rendre obligatoires
 * aujourd'hui n'apporterait rien et toucherait les appelants qui testent leur
 * présence.
 */
export interface WhatsAppProvider {
  readonly name: 'meta'
  parseInbound(payload: unknown): NormalizedInboundMessage | null
  buildSendTextRequest(msg: OutboundTextMessage, config: SendConfig): SendHttpRequest
  parseSendResult(status: number, responseBody: unknown): SendResult
  /** Accusé de lecture (coches bleues) + indicateur « typing… » optionnel. */
  buildMarkReadRequest?(messageId: string, config: SendConfig, opts?: { typing?: boolean }): SendHttpRequest
  /** Envoi d'un document (PDF) déjà uploadé en média. */
  buildSendDocumentRequest?(msg: OutboundDocumentMessage, config: SendConfig): SendHttpRequest
  /** Envoi d'une image par URL publique (photo R2). */
  buildSendImageRequest?(msg: OutboundImageMessage, config: SendConfig): SendHttpRequest
  /** Envoi d'un TEMPLATE approuvé (seul type autorisé hors fenêtre 24 h). */
  buildSendTemplateRequest?(msg: OutboundTemplateMessage, config: SendConfig): SendHttpRequest
  /** Events `statuses` d'un webhook (sent/delivered/read/failed). `[]` si aucun. */
  parseStatusUpdates?(payload: unknown): StatusUpdate[]
}

export function normalizePhone(jid: string): string {
  return (jid || '').split('@')[0].replace(/\D/g, '')
}

/** Bornes d'un numéro joignable, en chiffres nus. 15 = maximum E.164. */
export const PHONE_MIN_DIGITS = 6
export const PHONE_MAX_DIGITS = 15

/**
 * Un numéro peut-il porter un message WhatsApp — dans un sens comme dans l'autre ?
 *
 * Jumelle TS du CHECK SQL `wa_phone ~ '^[0-9]{6,15}$'` du registre de consentement.
 * La règle vivait en trois exemplaires (triage, garde d'envoi, contraintes SQL) ; elle
 * n'en a plus qu'un côté code, sinon les trois divergeront.
 *
 * La borne HAUTE fait le vrai travail : un JID de groupe (`120363…@g.us`) donne 18
 * chiffres. Le laisser passer coûte deux fois — l'insert viole la contrainte, la fonction
 * rend 500, et Meta rejoue ; et si l'insert passait, `normalize_phone` (= 9 derniers
 * chiffres) le rapprocherait d'un contact au hasard.
 */
export function isDialablePhone(value: string | null | undefined): boolean {
  const digits = (value ?? '').replace(/\D/g, '')
  return digits.length >= PHONE_MIN_DIGITS && digits.length <= PHONE_MAX_DIGITS
}

// Progression monotone des statuts d'un sortant : received < sent < delivered < read.
// `failed` est terminal et n'écrase jamais `read` (un message lu a forcément été livré).
// L'UPDATE filtre sur ces statuts antérieurs : un event en retard ou rejoué ne matche
// aucune ligne → no-op idempotent (pas de rétrogradation possible).
export function allowedPriorStatuses(next: StatusUpdate['status']): string[] {
  switch (next) {
    case 'sent': return ['received']
    case 'delivered': return ['received', 'sent']
    case 'read': return ['received', 'sent', 'delivered']
    case 'failed': return ['received', 'sent', 'delivered']
  }
}

/**
 * Comparaison à temps constant de deux chaînes.
 *
 * Sort tôt sur une longueur différente — la longueur d'un condensat hexadécimal
 * ou d'un jeton de vérification n'est pas un secret. Ce qui ne doit pas fuir,
 * c'est la position du premier caractère qui diverge : un `===` s'arrête dessus
 * et le temps de réponse dit alors combien de préfixe l'attaquant a deviné.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

export async function verifyHmac(rawBody: string, signatureHeader: string, secret: string): Promise<boolean> {
  if (!signatureHeader || !signatureHeader.startsWith('sha256=')) return false
  const provided = signatureHeader.slice('sha256='.length)
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sigBuf = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody))
  const expected = [...new Uint8Array(sigBuf)].map(b => b.toString(16).padStart(2, '0')).join('')
  return constantTimeEqual(provided, expected)
}

// ── Meta Cloud API provider ──────────────────────────────────────
// Payload Meta : { object:'whatsapp_business_account', entry:[{ changes:[{
//   field:'messages', value:{ messages:[...], metadata:{...} } }] }] }
// Signature : header X-Hub-Signature-256 = sha256=HMAC-SHA256(app_secret, rawBody),
// vérifiée par verifyHmac() — désormais le seul chemin d'entrée accepté.

const META_TYPE_TO_MEDIA: Record<string, NormalizedMediaType> = {
  image: 'image', audio: 'audio', voice: 'audio', video: 'video',
  document: 'document', location: 'location', contacts: 'contact', sticker: 'sticker',
}

class MetaProvider implements WhatsAppProvider {
  readonly name = 'meta' as const

  parseInbound(payload: unknown): NormalizedInboundMessage | null {
    const p = payload as Record<string, unknown>
    if (!p || p.object !== 'whatsapp_business_account') return null
    const entry = (p.entry as Record<string, unknown>[] | undefined)?.[0]
    const changes = entry?.changes as Record<string, unknown>[] | undefined
    const change = changes?.find((c) => c.field === 'messages') ?? changes?.[0]
    const value = change?.value as Record<string, unknown> | undefined
    const message = (value?.messages as Record<string, unknown>[] | undefined)?.[0]
    if (!message) return null // statuses-only / events non-message → ignorer
    const metadata = value?.metadata as Record<string, unknown> | undefined
    const type = (message.type as string) || 'text'
    const text = message.text as { body?: string } | undefined
    const mediaObj = message[type] as { id?: string; mime_type?: string; caption?: string } | undefined
    // Réponses à un BOUTON. Elles ne portent ni `text.body` ni `caption` : jusqu'ici
    // `body` valait null, donc le bouton « Stop promotions » que Meta attache lui-même à
    // nos templates marketing — le chemin d'opt-out qu'il met en avant — était INVISIBLE,
    // et le message restait orphelin (isTriageEligible exige un corps non vide).
    const button = message.button as { text?: string; payload?: string } | undefined
    const interactive = message.interactive as {
      button_reply?: { id?: string; title?: string }
      list_reply?: { id?: string; title?: string }
    } | undefined
    const fromPhone = normalizePhone(message.from as string)
    // Hors bornes = pas un interlocuteur (JID de groupe, expéditeur absent). On ignore au
    // lieu d'insérer : le webhook rend alors 200 sans écrire, seule issue qui ne déclenche
    // pas de rejeu Meta.
    if (!isDialablePhone(fromPhone)) return null
    const tsRaw = message.timestamp as string | number | undefined
    const ts = tsRaw != null ? Number(tsRaw) : undefined
    return {
      providerMessageId: message.id as string,
      sessionId: (metadata?.phone_number_id as string) ?? null,
      fromPhone,
      // UNIQUEMENT le vrai numéro Business (display_phone_number), JAMAIS phone_number_id
      // (ID de compte Meta ~15 chiffres, déjà en sessionId) : ce toPhone route l'attribution
      // d'agence (agency_for_wa_business_number) via normalize_phone = 9 derniers chiffres ;
      // un phone_number_id pourrait collisionner par ses 9 derniers chiffres → lead + avis LPD
      // sous la MAUVAISE agence. Absent → null → repli sur l'heuristique de comptage.
      toPhone: metadata?.display_phone_number
        ? normalizePhone(metadata.display_phone_number as string)
        : null,
      // `payload` seulement à défaut de `text`, et le `title` du reply plutôt que son `id` :
      // ce corps alimente le corpus de voix et la compréhension — y injecter un identifiant
      // technique le polluerait.
      body: text?.body
        ?? mediaObj?.caption
        ?? button?.text ?? button?.payload
        ?? interactive?.button_reply?.title
        ?? interactive?.list_reply?.title
        ?? null,
      mediaType: META_TYPE_TO_MEDIA[type] ?? null,
      mediaUrl: null, // bytes récupérés en différé via Graph API (whatsapp-media)
      mediaId: mediaObj?.id ?? null,
      mediaMime: mediaObj?.mime_type ?? null,
      timestamp: ts ? new Date(ts * 1000).toISOString() : null,
      raw: payload,
    }
  }

  // Events `statuses` (sent/delivered/read/failed) — émis par Meta pour CHAQUE message
  // sortant. Parcourt toutes les entries/changes (Meta peut batcher), ignore les statuts
  // hors contrat. L'erreur (failed) remonte code + détail (ex. 131047 = fenêtre 24h).
  parseStatusUpdates(payload: unknown): StatusUpdate[] {
    const p = payload as Record<string, unknown>
    if (!p || p.object !== 'whatsapp_business_account') return []
    const out: StatusUpdate[] = []
    for (const entry of (p.entry as Record<string, unknown>[] | undefined) ?? []) {
      for (const change of (entry.changes as Record<string, unknown>[] | undefined) ?? []) {
        if (change.field !== 'messages') continue
        const value = change.value as Record<string, unknown> | undefined
        for (const s of (value?.statuses as Record<string, unknown>[] | undefined) ?? []) {
          const id = s.id as string | undefined
          const status = s.status as string | undefined
          if (!id || !status || !['sent', 'delivered', 'read', 'failed'].includes(status)) continue
          const tsRaw = s.timestamp as string | number | undefined
          const ts = tsRaw != null ? Number(tsRaw) : undefined
          const err = (s.errors as Array<Record<string, unknown>> | undefined)?.[0]
          const errData = err?.error_data as Record<string, unknown> | undefined
          out.push({
            providerMessageId: id,
            status: status as StatusUpdate['status'],
            timestamp: ts ? new Date(ts * 1000).toISOString() : null,
            recipientPhone: s.recipient_id ? normalizePhone(String(s.recipient_id)) : null,
            errorCode: typeof err?.code === 'number' ? err.code : null,
            errorDetail: err
              ? (String(errData?.details ?? err.title ?? err.message ?? '').slice(0, 200) || null)
              : null,
          })
        }
      }
    }
    return out
  }

  buildSendTextRequest(msg: OutboundTextMessage, config: SendConfig): SendHttpRequest {
    const apiVersion = config.metaApiVersion ?? 'v22.0'
    return {
      url: `https://graph.facebook.com/${apiVersion}/${config.metaPhoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.metaToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.toPhone,
        type: 'text',
        text: { body: msg.body },
      }),
    }
  }

  parseSendResult(status: number, responseBody: unknown): SendResult {
    const body = responseBody as Record<string, unknown>
    if (status >= 200 && status < 300) {
      const id = (body.messages as Array<{ id?: string }>)?.[0]?.id ?? null
      return { ok: true, providerMessageId: id }
    }
    const err =
      ((body.error as Record<string, unknown>)?.message as string) ?? `HTTP ${status}`
    return { ok: false, providerMessageId: null, error: err }
  }

  buildSendDocumentRequest(msg: OutboundDocumentMessage, config: SendConfig): SendHttpRequest {
    const apiVersion = config.metaApiVersion ?? 'v22.0'
    const document: Record<string, unknown> = { id: msg.mediaId, filename: msg.filename }
    if (msg.caption) document.caption = msg.caption
    return {
      url: `https://graph.facebook.com/${apiVersion}/${config.metaPhoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.metaToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.toPhone,
        type: 'document',
        document,
      }),
    }
  }

  // Image par lien (pas d'upload préalable : Meta télécharge l'URL, qui doit être
  // publique — nos photos R2 le sont). Même squelette que buildSendDocumentRequest.
  buildSendImageRequest(msg: OutboundImageMessage, config: SendConfig): SendHttpRequest {
    const apiVersion = config.metaApiVersion ?? 'v22.0'
    const image: Record<string, unknown> = { link: msg.link }
    if (msg.caption) image.caption = msg.caption
    return {
      url: `https://graph.facebook.com/${apiVersion}/${config.metaPhoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.metaToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.toPhone,
        type: 'image',
        image,
      }),
    }
  }

  // Template approuvé (hors fenêtre 24h). Corps `type:'template'` avec name + language ;
  // un composant `body` n'est ajouté que s'il y a des paramètres (templates sans variable
  // = pas de components). Ne valide PAS l'approbation Meta (faite côté Business Manager) :
  // un nom non approuvé → l'API renvoie une erreur remontée par parseSendResult.
  buildSendTemplateRequest(msg: OutboundTemplateMessage, config: SendConfig): SendHttpRequest {
    const apiVersion = config.metaApiVersion ?? 'v22.0'
    const template: Record<string, unknown> = {
      name: msg.templateName,
      language: { code: msg.languageCode },
    }
    if (msg.bodyParams && msg.bodyParams.length > 0) {
      template.components = [{
        type: 'body',
        parameters: msg.bodyParams.map((text) => ({ type: 'text', text })),
      }]
    }
    return {
      url: `https://graph.facebook.com/${apiVersion}/${config.metaPhoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.metaToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: msg.toPhone,
        type: 'template',
        template,
      }),
    }
  }

  // Marque le message entrant comme lu (coches bleues). opts.typing → affiche en plus
  // l'indicateur "typing…" (dissipé à la réponse ou après 25 s) ; à n'utiliser que si
  // MEGGA va effectivement répondre.
  buildMarkReadRequest(messageId: string, config: SendConfig, opts?: { typing?: boolean }): SendHttpRequest {
    const apiVersion = config.metaApiVersion ?? 'v22.0'
    const body: Record<string, unknown> = {
      messaging_product: 'whatsapp',
      status: 'read',
      message_id: messageId,
    }
    if (opts?.typing) body.typing_indicator = { type: 'text' }
    return {
      url: `https://graph.facebook.com/${apiVersion}/${config.metaPhoneNumberId}/messages`,
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + config.metaToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    }
  }
}

const PROVIDERS: Record<string, WhatsAppProvider> = {
  meta: new MetaProvider(),
}

/**
 * ⚠ Le nom du provider est OBLIGATOIRE, volontairement.
 *
 * Il portait un défaut — `name = 'openwa'` — qui faisait retomber tout appelant
 * distrait sur le prototype de la Phase 1. Un défaut qui désigne le chemin le
 * moins sûr est un piège : il agit précisément quand personne n'a réfléchi.
 * Aucun appelant ne s'en servait (tous passaient 'meta'), donc l'exiger ne
 * casse rien et le compilateur attrape désormais l'oubli.
 */
export function getProvider(name: string): WhatsAppProvider {
  const p = PROVIDERS[name]
  if (!p) throw new Error(`Unknown WhatsApp provider: ${name}`)
  return p
}
