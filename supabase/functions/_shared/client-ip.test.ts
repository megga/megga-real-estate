import { describe, it, expect } from 'vitest'
import { trustedClientIp } from './client-ip'

function reqWith(headers: Record<string, string>): Request {
  return new Request('https://example.test/functions/v1/log-auth-event', {
    method: 'POST',
    headers,
  })
}

describe('trustedClientIp', () => {
  it('rend l IP quand le proxy en pose une seule', () => {
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': '203.0.113.7' }))).toBe('203.0.113.7')
  })

  it('rend le DERNIER hop, pas le premier — le premier est fourni par l appelant', () => {
    // L'attaquant envoie « 1.2.3.4 » ; le proxy ajoute l'IP réelle derrière.
    const req = reqWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7' })
    expect(trustedClientIp(req)).toBe('203.0.113.7')
  })

  it('ignore les relais internes ajoutés après le hop public', () => {
    const req = reqWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7, 10.0.0.5, 172.16.3.1' })
    expect(trustedClientIp(req)).toBe('203.0.113.7')
  })

  it('ne se laisse pas usurper par cf-connecting-ip ni x-real-ip', () => {
    const req = reqWith({
      'cf-connecting-ip': '9.9.9.9',
      'x-real-ip': '8.8.8.8',
      'x-forwarded-for': '203.0.113.7',
    })
    expect(trustedClientIp(req)).toBe('203.0.113.7')
  })

  it('rend null quand seuls cf-connecting-ip / x-real-ip sont posés', () => {
    // Sans XFF, rien n'est attribuable : ces deux en-têtes sont de l'entrée brute.
    expect(trustedClientIp(reqWith({ 'cf-connecting-ip': '9.9.9.9' }))).toBeNull()
    expect(trustedClientIp(reqWith({ 'x-real-ip': '8.8.8.8' }))).toBeNull()
  })

  it('rend null sans en-tête, ou si la chaîne est entièrement privée', () => {
    expect(trustedClientIp(reqWith({}))).toBeNull()
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': '10.0.0.1, 127.0.0.1' }))).toBeNull()
  })

  it('tolère les espaces et les segments vides', () => {
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': ' , 1.2.3.4 ,  , 203.0.113.7 , ' })))
      .toBe('203.0.113.7')
  })

  it('traite les plages privées v6 et les v4 encapsulées comme non attribuables', () => {
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': '203.0.113.7, ::1' }))).toBe('203.0.113.7')
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': '203.0.113.7, fd00::1' }))).toBe('203.0.113.7')
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': '203.0.113.7, ::ffff:10.0.0.9' }))).toBe('203.0.113.7')
  })

  it('rend une IPv6 publique telle quelle', () => {
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': '2001:db8::42' }))).toBe('2001:db8::42')
  })

  it('172.32 n est PAS privée — la plage s arrête à 172.31', () => {
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': '172.32.0.1' }))).toBe('172.32.0.1')
    expect(trustedClientIp(reqWith({ 'x-forwarded-for': '203.0.113.7, 172.31.255.1' }))).toBe('203.0.113.7')
  })
})
