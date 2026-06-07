import { describe, it, expect } from 'vitest'
import {
  getEsignProvider,
  timingSafeEqual,
  type CreateRequestInput,
  type ProviderCredentials,
} from './esign-gateway.ts'

const SKRIBBLE_CREDS: ProviderCredentials = {
  skribbleUsername: 'agent@megga.ch',
  skribbleApiKey: 'sk_test_key',
  skribbleBaseUrl: 'https://api.skribble.com',
}

const DOCUSIGN_CREDS: ProviderCredentials = {
  docusignAccessToken: 'ds_access',
  docusignAccountId: 'acct-123',
  docusignBaseUri: 'https://eu.docusign.net',
}

const INPUT: CreateRequestInput = {
  title: 'Mandat de courtage — Rue du Rhône 14',
  pdfBase64: 'JVBERi0xLjcK',
  signers: [{ email: 'vendeur@example.ch', firstName: 'Anна', lastName: 'Muster', language: 'fr', sequence: 1 }],
  quality: 'QES',
  legislation: 'ZERTES',
  callbackUrl: 'https://x.supabase.co/functions/v1/esign-webhook?sr=abc&token=tok&provider=skribble',
  notify: true,
}

describe('getEsignProvider', () => {
  it('renvoie skribble et docusign', () => {
    expect(getEsignProvider('skribble').name).toBe('skribble')
    expect(getEsignProvider('docusign').name).toBe('docusign')
  })
  it('jette sur provider inconnu', () => {
    expect(() => getEsignProvider('hellosign')).toThrow(/Unknown e-sign provider/)
  })
})

describe('timingSafeEqual', () => {
  it('true sur égalité, false sinon (longueurs diff incluses)', () => {
    expect(timingSafeEqual('abc123', 'abc123')).toBe(true)
    expect(timingSafeEqual('abc123', 'abc124')).toBe(false)
    expect(timingSafeEqual('abc', 'abcd')).toBe(false)
  })
})

describe('Skribble provider', () => {
  const p = getEsignProvider('skribble')

  it('login : POST /v2/access/login avec username + api-key, réponse text', () => {
    const req = p.buildLoginRequest!(SKRIBBLE_CREDS)
    expect(req.url).toBe('https://api.skribble.com/v2/access/login')
    expect(req.method).toBe('POST')
    expect(req.responseType).toBe('text')
    const body = JSON.parse(req.body!)
    expect(body.username).toBe('agent@megga.ch')
    expect(body['api-key']).toBe('sk_test_key')
  })

  it('parseLogin : token en text/plain ou JSON', () => {
    expect(p.parseLoginResult!(200, 'eyJ.tok.en').token).toBe('eyJ.tok.en')
    expect(p.parseLoginResult!(200, '"eyJ.quoted"').token).toBe('eyJ.quoted')
    expect(p.parseLoginResult!(200, { access_token: 'jtok' }).token).toBe('jtok')
    expect(p.parseLoginResult!(401, '').ok).toBe(false)
  })

  it('create : POST /v2/signature-requests, content base64, quality/legislation, signataire + callbacks', () => {
    const req = p.buildCreateRequest(INPUT, SKRIBBLE_CREDS, 'TOK')
    expect(req.url).toBe('https://api.skribble.com/v2/signature-requests')
    expect(req.headers.Authorization).toBe('Bearer TOK')
    const body = JSON.parse(req.body!)
    expect(body.content).toBe('JVBERi0xLjcK')
    expect(body.quality).toBe('QES')
    expect(body.legislation).toBe('ZERTES')
    expect(body.signatures[0].account_email).toBe('vendeur@example.ch')
    expect(body.signatures[0].signer_identity_data.first_name).toBe('Anна')
    expect(body.signatures[0].sequence).toBe(1)
    expect(body.callback_update_url).toContain('esign-webhook')
    expect(body.notify).toBe(true)
  })

  it('parseCreate : id + document_id + statut mappé OPEN→sent', () => {
    const r = p.parseCreateResult(200, {
      id: 'sr-1', document_id: 'doc-9', status_overall: 'OPEN',
      signatures: [{ account_email: 'vendeur@example.ch', signing_url: 'https://skribble/sign/x', status_code: 'OPEN' }],
    })
    expect(r.ok).toBe(true)
    expect(r.providerRequestId).toBe('sr-1')
    expect(r.providerDocumentId).toBe('doc-9')
    expect(r.status).toBe('sent')
    expect(r.signers[0].signingUrl).toBe('https://skribble/sign/x')
  })

  it('parseStatus : SIGNED→signed, DECLINED→declined', () => {
    expect(p.parseStatusResult(200, { status_overall: 'SIGNED', document_id: 'd1' }).status).toBe('signed')
    expect(p.parseStatusResult(200, { status_overall: 'DECLINED' }).status).toBe('declined')
    expect(p.parseStatusResult(500, {}).ok).toBe(false)
  })

  it('download : GET /v2/documents/{id}/content, binaire', () => {
    const req = p.buildDownloadRequest('doc-9', SKRIBBLE_CREDS, 'TOK')
    expect(req.url).toBe('https://api.skribble.com/v2/documents/doc-9/content')
    expect(req.method).toBe('GET')
    expect(req.responseType).toBe('binary')
  })

  it('create échoué : message d\'erreur remonté', () => {
    const r = p.parseCreateResult(422, { message: 'invalid signer' })
    expect(r.ok).toBe(false)
    expect(r.error).toBe('invalid signer')
    expect(r.status).toBe('error')
  })
})

describe('DocuSign provider', () => {
  const p = getEsignProvider('docusign')

  it('create : POST envelopes avec document base64 + signer + eventNotification', () => {
    const req = p.buildCreateRequest(INPUT, DOCUSIGN_CREDS, 'DTOK')
    expect(req.url).toBe('https://eu.docusign.net/restapi/v2.1/accounts/acct-123/envelopes')
    expect(req.headers.Authorization).toBe('Bearer DTOK')
    const body = JSON.parse(req.body!)
    expect(body.status).toBe('sent')
    expect(body.documents[0].documentBase64).toBe('JVBERi0xLjcK')
    expect(body.recipients.signers[0].email).toBe('vendeur@example.ch')
    expect(body.recipients.signers[0].name).toBe('Anна Muster')
    expect(body.eventNotification.url).toContain('esign-webhook')
  })

  it('parseCreate : envelopeId → request + document id', () => {
    const r = p.parseCreateResult(201, { envelopeId: 'env-1', status: 'sent' })
    expect(r.providerRequestId).toBe('env-1')
    expect(r.providerDocumentId).toBe('env-1')
    expect(r.status).toBe('sent')
  })

  it('parseStatus : completed→signed, voided→withdrawn', () => {
    expect(p.parseStatusResult(200, { status: 'completed', envelopeId: 'e' }).status).toBe('signed')
    expect(p.parseStatusResult(200, { status: 'voided', envelopeId: 'e' }).status).toBe('withdrawn')
  })

  it('download : combined PDF via envelopeId', () => {
    const req = p.buildDownloadRequest('env-1', DOCUSIGN_CREDS, 'DTOK')
    expect(req.url).toBe('https://eu.docusign.net/restapi/v2.1/accounts/acct-123/envelopes/env-1/documents/combined')
    expect(req.responseType).toBe('binary')
  })

  it('cancel : PUT envelope status=voided', () => {
    const req = p.buildCancelRequest!('env-1', 'doublon', DOCUSIGN_CREDS, 'DTOK')
    expect(req.method).toBe('PUT')
    expect(JSON.parse(req.body!).status).toBe('voided')
  })
})
