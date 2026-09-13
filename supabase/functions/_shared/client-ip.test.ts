import { describe, it, expect } from 'vitest'
import { isIpAddress, trustedClientIp } from './client-ip'

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

// ⛔ S14 (13.09.2026) : `detect-new-device` interpolait l'IP d'en-tête dans l'URL d'ipapi.co
// et dans l'e-mail d'alerte. `isIpAddress` est le contrôle d'INTERPOLATION : tout ce qui
// n'est pas une adresse littérale reste dehors, quelle que soit sa provenance.
describe('isIpAddress', () => {
  it('accepte les IPv4 pointées, bornes comprises', () => {
    for (const ip of ['203.0.113.7', '0.0.0.0', '255.255.255.255', '10.0.0.1', '8.8.8.8']) {
      expect(isIpAddress(ip), ip).toBe(true)
    }
  })

  it('refuse une IPv4 hors plage, tronquée, à zéro de tête, ou suivie d’un port', () => {
    for (const ip of ['256.1.1.1', '1.2.3', '1.2.3.4.5', '01.2.3.4', '1.2.3.4:8080', '1.2.3.-4']) {
      expect(isIpAddress(ip), ip).toBe(false)
    }
  })

  it('accepte les IPv6 complètes, compressées et à IPv4 encapsulée', () => {
    for (const ip of [
      '2001:db8::42', '2001:DB8:0:0:0:0:0:42', '::1', '::', '1::', 'fe80::1',
      '::ffff:203.0.113.7', '1:2:3:4:5:6:203.0.113.7', '1:2:3:4:5:6:7::',
    ]) {
      expect(isIpAddress(ip), ip).toBe(true)
    }
  })

  it('refuse les formes IPv6 fausses', () => {
    for (const ip of [
      '1:2:3:4:5:6:7:8:9', // neuf groupes
      '1::2::3', // deux compressions
      '1:2:3:4:5:6:7::8:9', // `::` qui ne remplacerait rien
      '1:2:3:4:5:6:7:203.0.113.7', // IPv4 encapsulée au-delà de huit groupes
      '12345::1', // groupe de cinq chiffres
      'g::1', // pas de l'hexadécimal
      ':1', ':::', '1.2.3.4::', // IPv4 ailleurs qu'en fin
      '::ffff:999.1.1.1',
    ]) {
      expect(isIpAddress(ip), ip).toBe(false)
    }
  })

  it('refuse tout ce qui ferait sortir la valeur de son champ : zone, crochets, espace, chemin', () => {
    // Les formes que l'en-tête laissait passer jusqu'à l'URL d'ipapi.co et dans l'e-mail.
    for (const ip of [
      'fe80::1%eth0', '[2001:db8::1]', ' 203.0.113.7', '203.0.113.7\n', '../../json',
      '8.8.8.8/json/?', 'unknown', '"><script>alert(1)</script>', '', 'a'.repeat(46),
    ]) {
      expect(isIpAddress(ip), JSON.stringify(ip)).toBe(false)
    }
  })

  it('accepte ce que trustedClientIp rend sur une chaîne normale', () => {
    const ip = trustedClientIp(reqWith({ 'x-forwarded-for': '1.2.3.4, 203.0.113.7, 10.0.0.5' }))
    expect(ip).toBe('203.0.113.7')
    expect(isIpAddress(ip as string)).toBe(true)
  })
})
