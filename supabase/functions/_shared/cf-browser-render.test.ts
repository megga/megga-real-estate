import { describe, it, expect } from 'vitest'
import { buildCfPdfRequestBody, parseBasicAuthPair } from './cf-browser-render.ts'

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
