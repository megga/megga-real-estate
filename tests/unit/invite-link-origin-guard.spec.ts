/**
 * Garde-fou : le lien d'une invitation d'équipe ne se construit JAMAIS depuis
 * un en-tête de la requête.
 *
 * Pourquoi un test structurel plutôt qu'un test de comportement. L'URL n'existe
 * que dans le corps envoyé à Resend : aucune suite ne l'observe, ni les tests
 * backend (qui ne postent pas d'e-mail réel) ni les e2e. Le défaut était donc
 * invisible, et il l'est resté d'avril à août 2026.
 *
 * Ce qu'il gardait. `send-team-invite` faisait
 * `req.headers.get('origin') || 'https://megga.ch'`, et cette valeur devenait le
 * href du bouton « Accepter l'invitation ». Un dirigeant postant avec
 * `Origin: https://evil.tld` faisait donc partir un e-mail MEGGA authentique,
 * signé DKIM, dont le bouton pointait chez lui — avec le TOKEN d'invitation dans
 * l'URL. Or ce token vaut attribution de rôle au moment du claim : c'est de
 * l'hameçonnage sur notre propre domaine doublé d'une exfiltration de capacité.
 *
 * Le repli était faux par-dessus le marché : `/accept-invite/:token` est une
 * route de l'app CRM (src/App.tsx), servie par app.megga.ch. `megga.ch` est la
 * vitrine et ne connaît pas cette route — tout envoi sans en-tête `Origin`
 * produisait un lien mort.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const FILE = 'supabase/functions/send-team-invite/index.ts'

describe("Lien d'invitation d'équipe", () => {
  const source = readFileSync(FILE, 'utf8')

  it("ne lit aucun en-tête de requête pour bâtir l'URL d'acceptation", () => {
    // On vise `origin` et `referer` : les deux en-têtes que l'appelant choisit
    // et qu'on est tenté de prendre pour l'adresse du site.
    const forbidden = /headers\.get\(\s*['"](origin|referer)['"]\s*\)/i
    expect(
      forbidden.test(source),
      "l'URL d'acceptation doit venir de la configuration, jamais de la requête",
    ).toBe(false)
  })

  it("bâtit l'URL depuis MEGGA_APP_URL, avec le domaine de l'app en repli", () => {
    expect(source).toContain("Deno.env.get('MEGGA_APP_URL')")
    // Le repli doit être l'app, pas la vitrine : c'est l'app qui sert la route.
    expect(source).toContain('https://app.megga.ch')
    expect(
      source.includes("'https://megga.ch'"),
      'la vitrine ne sert pas /accept-invite — un repli vers elle donne un lien mort',
    ).toBe(false)
  })

  it('les deux chemins d\'envoi (invitation et renvoi) passent par le même helper', () => {
    const uses = source.match(/appBaseUrl\(\)\/?/g) ?? []
    // 1 définition + 2 usages (action `invite` et action `resend`).
    expect(uses.length, `attendu 3 occurrences, trouvé ${uses.length}`).toBeGreaterThanOrEqual(3)
  })
})
