import { describe, it, expect } from 'vitest'
import { buildCfPdfRequestBody, parseBasicAuthPair, redactCfRenderError } from './cf-browser-render.ts'

describe('buildCfPdfRequestBody', () => {
  it('construit un corps A4 avec auth Basic + attente SPA', () => {
    const body = buildCfPdfRequestBody({
      url: 'https://megga.ch/kyc-report/TOKEN',
      basicUser: 'ai',
      basicPass: 'ai',
    })
    expect(body.url).toBe('https://megga.ch/kyc-report/TOKEN')
    expect(body.authenticate).toEqual({ username: 'ai', password: 'ai' })
    expect(body.gotoOptions).toMatchObject({ waitUntil: 'networkidle0' })
    expect(body.waitForSelector).toMatchObject({ selector: '#pdf-ready' })
    expect(body.pdfOptions).toMatchObject({ format: 'a4', printBackground: true, preferCSSPageSize: true })
  })

  it('omet authenticate si pas de creds', () => {
    const body = buildCfPdfRequestBody({ url: 'https://x/y' })
    expect(body.authenticate).toBeUndefined()
  })
})

describe('redactCfRenderError', () => {
  // Jeton réaliste (_shared/magic-link-token.ts) : payload base64url + signature HMAC de 43 car.
  const TOKEN = 'eyJpZCI6IjNmMmE5YzFlLTc3YjQtNGQyMS05YTU1LTBlMWIyYzNkNGU1ZiIsImV4cCI6MTg5MzQ1NjAwMH0.CzBVep_E6Q4zWH2ix-wRNluApcrvFDleg6jN8hc8YYY'
  const RENDER_URL = `https://app.megga.ch/kyc-report/${TOKEN}`

  it('retire l’URL rendue mais garde le motif de l’échec', () => {
    const out = redactCfRenderError(`page.goto: net::ERR_ABORTED at ${RENDER_URL}`, RENDER_URL)
    expect(out).toBe('page.goto: net::ERR_ABORTED at <render-url>')
    expect(out).not.toContain(TOKEN)
  })

  it('rattrape le jeton quand Cloudflare ne rend pas l’URL telle qu’on l’a construite', () => {
    // Cas réel : corps JSON, donc slashes échappés — la comparaison littérale ne mord pas et
    // c'est le catalogue partagé (motif TOKEN) qui ferme la fuite.
    const body = `{"success":false,"errors":[{"code":10000,"message":"Navigation timeout at https:\\/\\/app.megga.ch\\/kyc-report\\/${TOKEN}"}]}`
    const out = redactCfRenderError(body, RENDER_URL)
    expect(out).not.toContain(TOKEN)
    expect(out).toContain('[REDACTED:TOKEN]')
    expect(out).toContain('Navigation timeout')
  })

  it('laisse intact un corps d’erreur sans jeton', () => {
    const body = 'waitForSelector: #pdf-ready timeout 20000ms exceeded'
    expect(redactCfRenderError(body, RENDER_URL)).toBe(body)
  })

  it('tolère un corps vide (cfRes.text() peut échouer)', () => {
    expect(redactCfRenderError('', RENDER_URL)).toBe('')
  })
})

describe('parseBasicAuthPair', () => {
  it('découpe user:pass simple', () => {
    expect(parseBasicAuthPair('ai:ai')).toEqual({ user: 'ai', pass: 'ai' })
  })

  it('retourne {} si undefined', () => {
    expect(parseBasicAuthPair(undefined)).toEqual({})
  })

  it('tolère un pass contenant des ":"', () => {
    expect(parseBasicAuthPair('a:b:c')).toEqual({ user: 'a', pass: 'b:c' })
  })
})
