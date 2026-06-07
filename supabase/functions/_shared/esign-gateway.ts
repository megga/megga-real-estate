// Couche d'abstraction provider e-signature. Le code applicatif (edge
// sign-document / esign-webhook) parle à CETTE interface, jamais directement à
// l'API Skribble ni DocuSign. Décision produit : cerveau « signature-qes-planned ».
//
// Pur : chaque méthode CONSTRUIT une requête HTTP (url/method/headers/body) ou
// PARSE une réponse — aucun fetch ici. → testable Vitest (Node) ET exécutable
// Deno. N'utilise que des built-ins JS + Web Crypto. ZÉRO import (comme
// _shared/whatsapp-gateway.ts).

// ── Types normalisés ────────────────────────────────────────────────────────

export type EsignProviderName = 'skribble' | 'docusign'
export type SignatureQuality = 'SES' | 'AES' | 'QES'
export type Legislation = 'ZERTES' | 'EIDAS'

// Statut MEGGA unifié (≠ vocabulaire provider, mappé par parse*).
export type EsignStatus =
  | 'draft' | 'sent' | 'viewed' | 'signed' | 'declined' | 'withdrawn' | 'error' | 'expired'

export interface EsignSigner {
  email: string
  firstName?: string
  lastName?: string
  name?: string
  mobile?: string
  language?: string   // 'fr' | 'de' | 'en' | 'it'
  sequence?: number   // ordre de signature (1-based)
}

export interface CreateRequestInput {
  title: string
  message?: string
  pdfBase64: string            // PDF à signer (base64 brut, sans préfixe data:)
  signers: EsignSigner[]
  quality: SignatureQuality
  legislation: Legislation
  callbackUrl: string          // notre webhook esign-webhook (porte sr + token)
  notify?: boolean             // le provider notifie le signataire par email (def. true)
}

// Credentials décryptés depuis Vault + config non-secrète.
export interface ProviderCredentials {
  // Skribble (clé API)
  skribbleUsername?: string
  skribbleApiKey?: string
  skribbleBaseUrl?: string     // def. https://api.skribble.com (ou .de)
  // DocuSign (OAuth)
  docusignAccessToken?: string
  docusignAccountId?: string
  docusignBaseUri?: string     // ex. https://eu.docusign.net
}

export interface ProviderHttpRequest {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers: Record<string, string>
  body?: string
  // Hint pour l'EF : comment lire la réponse (login Skribble = text/plain).
  responseType?: 'json' | 'text' | 'binary'
}

export interface SignerResult {
  email: string
  signingUrl: string | null
  statusCode: string | null
  signedAt: string | null
}

export interface CreateRequestResult {
  ok: boolean
  providerRequestId: string | null
  providerDocumentId: string | null
  signers: SignerResult[]
  status: EsignStatus
  error?: string
}

export interface StatusResult {
  ok: boolean
  status: EsignStatus
  providerDocumentId: string | null
  signers: SignerResult[]
  error?: string
}

export interface LoginResult {
  ok: boolean
  token?: string
  error?: string
}

// ── Interface provider ──────────────────────────────────────────────────────

export interface EsignProvider {
  readonly name: EsignProviderName

  // Skribble exige un login (token court) avant tout appel. DocuSign réutilise
  // l'access_token OAuth stocké → buildLoginRequest absent.
  buildLoginRequest?(creds: ProviderCredentials): ProviderHttpRequest
  parseLoginResult?(status: number, body: unknown): LoginResult

  buildCreateRequest(input: CreateRequestInput, creds: ProviderCredentials, token?: string): ProviderHttpRequest
  parseCreateResult(status: number, body: unknown): CreateRequestResult

  buildStatusRequest(providerRequestId: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest
  parseStatusResult(status: number, body: unknown): StatusResult

  // Téléchargement du PDF signé (réponse binaire).
  buildDownloadRequest(providerDocumentId: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest

  // Annulation / retrait (optionnel).
  buildCancelRequest?(providerRequestId: string, reason: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest
}

// ── Utils ────────────────────────────────────────────────────────────────────

/** Comparaison timing-safe de deux tokens (webhook). Web Crypto only. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

const SKRIBBLE_DEFAULT_BASE = 'https://api.skribble.com'

function skribbleBase(creds: ProviderCredentials): string {
  return (creds.skribbleBaseUrl || SKRIBBLE_DEFAULT_BASE).replace(/\/+$/, '')
}

function asRecord(v: unknown): Record<string, unknown> {
  return (v && typeof v === 'object') ? (v as Record<string, unknown>) : {}
}

// ── Skribble (suisse — QES/AES conforme ZertES/eIDAS, préféré CH) ────────────
// Doc v2 : POST /v2/access/login (username + api-key → bearer) ;
// POST /v2/signature-requests (content base64, quality, legislation,
// signatures[].account_email, callback_*_url) ; GET /v2/signature-requests/{id}
// (status_overall, document_id, signatures[]) ; GET /v2/documents/{id}/content.

const SKRIBBLE_STATUS: Record<string, EsignStatus> = {
  OPEN: 'sent',
  SIGNED: 'signed',
  DECLINED: 'declined',
  WITHDRAWN: 'withdrawn',
  ERROR: 'error',
  EXPIRED: 'expired',
}

class SkribbleProvider implements EsignProvider {
  readonly name = 'skribble' as const

  buildLoginRequest(creds: ProviderCredentials): ProviderHttpRequest {
    return {
      url: `${skribbleBase(creds)}/v2/access/login`,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // Skribble renvoie le token en text/plain (parfois JSON {access_token}).
      body: JSON.stringify({ username: creds.skribbleUsername, 'api-key': creds.skribbleApiKey }),
      responseType: 'text',
    }
  }

  parseLoginResult(status: number, body: unknown): LoginResult {
    if (status < 200 || status >= 300) return { ok: false, error: `login HTTP ${status}` }
    // body = texte brut (le token) OU JSON { access_token }
    if (typeof body === 'string') {
      const trimmed = body.trim().replace(/^"|"$/g, '')
      if (trimmed) return { ok: true, token: trimmed }
    }
    const rec = asRecord(body)
    const token = (rec.access_token as string) || (rec.token as string) || ''
    return token ? { ok: true, token } : { ok: false, error: 'login: token absent' }
  }

  buildCreateRequest(input: CreateRequestInput, creds: ProviderCredentials, token?: string): ProviderHttpRequest {
    const signatures = input.signers.map((s) => {
      const sig: Record<string, unknown> = { account_email: s.email }
      if (s.firstName || s.lastName || s.mobile || s.language) {
        sig.signer_identity_data = {
          email_address: s.email,
          first_name: s.firstName,
          last_name: s.lastName,
          mobile_number: s.mobile,
          language: s.language,
        }
      }
      if (typeof s.sequence === 'number') sig.sequence = s.sequence
      return sig
    })

    const payload: Record<string, unknown> = {
      title: input.title,
      content: input.pdfBase64,
      legislation: input.legislation,
      quality: input.quality,
      signatures,
      notify: input.notify !== false,
      callback_success_url: input.callbackUrl,
      callback_update_url: input.callbackUrl,
      callback_error_url: input.callbackUrl,
    }
    if (input.message) payload.message = input.message

    return {
      url: `${skribbleBase(creds)}/v2/signature-requests`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      responseType: 'json',
    }
  }

  parseCreateResult(status: number, body: unknown): CreateRequestResult {
    if (status < 200 || status >= 300) {
      const rec = asRecord(body)
      return {
        ok: false, providerRequestId: null, providerDocumentId: null, signers: [],
        status: 'error', error: (rec.message as string) || `create HTTP ${status}`,
      }
    }
    const rec = asRecord(body)
    return {
      ok: true,
      providerRequestId: (rec.id as string) ?? null,
      providerDocumentId: (rec.document_id as string) ?? null,
      signers: skribbleSigners(rec.signatures),
      status: SKRIBBLE_STATUS[(rec.status_overall as string) ?? ''] ?? 'sent',
    }
  }

  buildStatusRequest(providerRequestId: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest {
    return {
      url: `${skribbleBase(creds)}/v2/signature-requests/${encodeURIComponent(providerRequestId)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'json',
    }
  }

  parseStatusResult(status: number, body: unknown): StatusResult {
    if (status < 200 || status >= 300) {
      return { ok: false, status: 'error', providerDocumentId: null, signers: [], error: `status HTTP ${status}` }
    }
    const rec = asRecord(body)
    return {
      ok: true,
      status: SKRIBBLE_STATUS[(rec.status_overall as string) ?? ''] ?? 'sent',
      providerDocumentId: (rec.document_id as string) ?? null,
      signers: skribbleSigners(rec.signatures),
    }
  }

  buildDownloadRequest(providerDocumentId: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest {
    return {
      url: `${skribbleBase(creds)}/v2/documents/${encodeURIComponent(providerDocumentId)}/content`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'binary',
    }
  }

  buildCancelRequest(providerRequestId: string, _reason: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest {
    return {
      url: `${skribbleBase(creds)}/v2/signature-requests/${encodeURIComponent(providerRequestId)}`,
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
      responseType: 'json',
    }
  }
}

function skribbleSigners(raw: unknown): SignerResult[] {
  if (!Array.isArray(raw)) return []
  return raw.map((s) => {
    const r = asRecord(s)
    return {
      email: (r.account_email as string) ?? '',
      signingUrl: (r.signing_url as string) ?? null,
      statusCode: (r.status_code as string) ?? null,
      signedAt: (r.signed_at as string) ?? null,
    }
  })
}

// ── DocuSign (international — eSignature REST API v2.1) ───────────────────────
// Base : {baseUri}/restapi/v2.1/accounts/{accountId}. Envelope = document +
// recipients. status='sent' déclenche l'email. Téléchargement combiné PDF.

const DOCUSIGN_STATUS: Record<string, EsignStatus> = {
  created: 'draft',
  sent: 'sent',
  delivered: 'viewed',
  completed: 'signed',
  declined: 'declined',
  voided: 'withdrawn',
}

function docusignBase(creds: ProviderCredentials): string {
  const base = (creds.docusignBaseUri || '').replace(/\/+$/, '')
  return `${base}/restapi/v2.1/accounts/${creds.docusignAccountId}`
}

class DocuSignProvider implements EsignProvider {
  readonly name = 'docusign' as const

  buildCreateRequest(input: CreateRequestInput, creds: ProviderCredentials, token?: string): ProviderHttpRequest {
    const signers = input.signers.map((s, i) => ({
      email: s.email,
      name: s.name || [s.firstName, s.lastName].filter(Boolean).join(' ') || s.email,
      recipientId: String(i + 1),
      routingOrder: String(s.sequence ?? i + 1),
      tabs: {
        // Ancre texte : le générateur PDF place « /sigN/ » à l'emplacement de signature.
        signHereTabs: [{ anchorString: `/sig${i + 1}/`, anchorUnits: 'pixels', anchorXOffset: '0', anchorYOffset: '0' }],
      },
    }))

    const payload = {
      emailSubject: input.title,
      documents: [{ documentBase64: input.pdfBase64, name: input.title, fileExtension: 'pdf', documentId: '1' }],
      recipients: { signers },
      eventNotification: {
        url: input.callbackUrl,
        loggingEnabled: 'true',
        requireAcknowledgment: 'true',
        envelopeEvents: [
          { envelopeEventStatusCode: 'completed' },
          { envelopeEventStatusCode: 'declined' },
          { envelopeEventStatusCode: 'voided' },
        ],
      },
      status: 'sent',
    }

    return {
      url: `${docusignBase(creds)}/envelopes`,
      method: 'POST',
      headers: { Authorization: `Bearer ${token || creds.docusignAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      responseType: 'json',
    }
  }

  parseCreateResult(status: number, body: unknown): CreateRequestResult {
    if (status < 200 || status >= 300) {
      const rec = asRecord(body)
      return {
        ok: false, providerRequestId: null, providerDocumentId: null, signers: [],
        status: 'error', error: (rec.message as string) || `create HTTP ${status}`,
      }
    }
    const rec = asRecord(body)
    const envelopeId = (rec.envelopeId as string) ?? null
    return {
      ok: true,
      providerRequestId: envelopeId,
      providerDocumentId: envelopeId, // le download DocuSign utilise l'envelopeId
      signers: [],
      status: DOCUSIGN_STATUS[(rec.status as string) ?? 'sent'] ?? 'sent',
    }
  }

  buildStatusRequest(providerRequestId: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest {
    return {
      url: `${docusignBase(creds)}/envelopes/${encodeURIComponent(providerRequestId)}`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token || creds.docusignAccessToken}` },
      responseType: 'json',
    }
  }

  parseStatusResult(status: number, body: unknown): StatusResult {
    if (status < 200 || status >= 300) {
      return { ok: false, status: 'error', providerDocumentId: null, signers: [], error: `status HTTP ${status}` }
    }
    const rec = asRecord(body)
    return {
      ok: true,
      status: DOCUSIGN_STATUS[(rec.status as string) ?? 'sent'] ?? 'sent',
      providerDocumentId: (rec.envelopeId as string) ?? null,
      signers: [],
    }
  }

  buildDownloadRequest(providerDocumentId: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest {
    return {
      url: `${docusignBase(creds)}/envelopes/${encodeURIComponent(providerDocumentId)}/documents/combined`,
      method: 'GET',
      headers: { Authorization: `Bearer ${token || creds.docusignAccessToken}` },
      responseType: 'binary',
    }
  }

  buildCancelRequest(providerRequestId: string, reason: string, creds: ProviderCredentials, token?: string): ProviderHttpRequest {
    return {
      url: `${docusignBase(creds)}/envelopes/${encodeURIComponent(providerRequestId)}`,
      method: 'PUT',
      headers: { Authorization: `Bearer ${token || creds.docusignAccessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'voided', voidedReason: reason || 'Annulé par l\'agent' }),
      responseType: 'json',
    }
  }
}

// ── Registre ─────────────────────────────────────────────────────────────────

const PROVIDERS: Record<EsignProviderName, EsignProvider> = {
  skribble: new SkribbleProvider(),
  docusign: new DocuSignProvider(),
}

export function getEsignProvider(name: string): EsignProvider {
  const p = PROVIDERS[name as EsignProviderName]
  if (!p) throw new Error(`Unknown e-sign provider: ${name}`)
  return p
}
