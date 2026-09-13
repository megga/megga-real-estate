// supabase/functions/_shared/function-url.test.ts
import { describe, it, expect } from 'vitest'
import { REGION_FONCTIONS, urlFonction } from './function-url.ts'

describe('urlFonction — une fonction appelée par une autre s’exécute dans la région de la base', () => {
  it('épingle la région par le paramètre d’URL', () => {
    expect(urlFonction('https://x.supabase.co', 'whatsapp-agent')).toBe('https://x.supabase.co/functions/v1/whatsapp-agent?forceFunctionRegion=eu-west-1')
    expect(REGION_FONCTIONS).toBe('eu-west-1')
  })
  it('garde les paramètres de l’appelant, dans leur ordre, AVANT l’épingle', () => {
    const u = new URL(urlFonction('https://x.supabase.co/', 'esign-webhook', { sr: 'abc', token: 't/o k', provider: 'skribble' }))
    expect([...u.searchParams.keys()]).toEqual(['sr', 'token', 'provider', 'forceFunctionRegion'])
    expect(u.searchParams.get('token')).toBe('t/o k')
    expect(u.pathname).toBe('/functions/v1/esign-webhook')
  })
  it('une barre finale sur la base ne double pas le séparateur', () => {
    expect(urlFonction('https://x.supabase.co//', 'send-email')).toMatch(/^https:\/\/x\.supabase\.co\/functions\/v1\/send-email\?/)
  })
})
