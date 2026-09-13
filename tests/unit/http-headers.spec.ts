/**
 * Les en-têtes de sécurité servis par app.getmegga.com (public/_headers).
 *
 * ⛔ Mesuré le 13.09.2026 : le CRM ne servait ni `Content-Security-Policy`, ni
 * `X-Frame-Options`, ni HSTS — encadrable dans une page tierce, console super-admin et
 * validation KYC comprises, et sans aucun filet devant une future XSS. Ce fichier tient :
 *   1. les quatre en-têtes qui ferment ça, avec leurs valeurs ;
 *   2. que la CSP ENFORCÉE reste réduite à `frame-ancestors` — élargir la politique
 *      appliquée se décide sur les rapports du mode report-only, jamais en éditant une
 *      ligne « pour voir » ;
 *   3. que la politique report-only nomme bien les origines dont l'app vit (Supabase,
 *      Mapbox, Sentry) et envoie ses rapports quelque part.
 * Vite recopie `public/` dans `dist/` : ce qui est lu ici est ce que le bord sert.
 */
import { describe, expect, it } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'

/** Les en-têtes du bloc `/*`, nom (minuscules) → valeur. */
function headersForAll(): Map<string, string> {
  const lu = readFileSafely(repoPath('public/_headers'))
  const src = lu.status === 'ok' ? lu.value : ''
  expect(src.length, 'public/_headers illisible').toBeGreaterThan(200)
  const lines = src.split('\n')
  const start = lines.findIndex((l) => l.trim() === '/*')
  expect(start, 'bloc `/*` absent').toBeGreaterThan(-1)
  const out = new Map<string, string>()
  for (const line of lines.slice(start + 1)) {
    if (!line.startsWith('  ')) break // fin du bloc : une ligne non indentée (chemin ou commentaire)
    const i = line.indexOf(':')
    if (i === -1) continue
    out.set(line.slice(0, i).trim().toLowerCase(), line.slice(i + 1).trim())
  }
  return out
}

describe('public/_headers — le bloc /*', () => {
  const h = headersForAll()

  it('interdit tout encadrement, dans les deux dialectes', () => {
    expect(h.get('content-security-policy')).toBe("frame-ancestors 'none'")
    expect(h.get('x-frame-options')).toBe('DENY')
  })

  it('impose HTTPS pour un an, sous-domaines compris', () => {
    const hsts = h.get('strict-transport-security') ?? ''
    const maxAge = Number(/max-age=(\d+)/.exec(hsts)?.[1] ?? 0)
    expect(maxAge).toBeGreaterThanOrEqual(31536000)
    expect(hsts).toContain('includeSubDomains')
  })

  it('garde le référent et le type MIME', () => {
    expect(h.get('referrer-policy')).toBe('strict-origin-when-cross-origin')
    expect(h.get('x-content-type-options')).toBe('nosniff')
  })

  it('la CSP enforcée ne porte QUE frame-ancestors — tout le reste vit en report-only', () => {
    const enforced = h.get('content-security-policy') ?? ''
    const directives = enforced.split(';').map((d) => d.trim()).filter(Boolean)
    expect(directives).toEqual(["frame-ancestors 'none'"])
  })

  it('la politique report-only nomme les origines vitales et envoie ses rapports', () => {
    const ro = h.get('content-security-policy-report-only') ?? ''
    expect(ro).toMatch(/default-src 'self'/)
    for (const origin of [
      'https://api.getmegga.com', 'wss://api.getmegga.com',
      'https://api.mapbox.com', 'https://fonts.gstatic.com', 'https://fonts.googleapis.com',
    ]) expect(ro, origin).toContain(origin)
    expect(ro).toMatch(/object-src 'none'/)
    expect(ro).toMatch(/report-uri https:\/\/[a-z0-9]+\.ingest\.[a-z.]*sentry\.io\/api\/\d+\/security\/\?sentry_key=[0-9a-f]{32}/)
    // Un `frame-ancestors` en report-only n'a aucun effet : il vit dans la CSP enforcée.
    expect(ro).not.toContain('frame-ancestors')
  })
})
