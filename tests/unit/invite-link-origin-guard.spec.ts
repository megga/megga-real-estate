/**
 * Garde-fou : le lien d'une invitation d'équipe mène à NOTRE app, et à une route
 * qui existe.
 *
 * Ce qu'il gardait. `send-team-invite` faisait
 * `req.headers.get('origin') || 'https://megga.ch'`, et cette valeur devenait le
 * href du bouton « Accepter l'invitation ». Un dirigeant postant avec
 * `Origin: https://evil.tld` faisait donc partir un e-mail MEGGA authentique,
 * signé DKIM, dont le bouton pointait chez lui — avec le TOKEN d'invitation dans
 * l'URL. Or ce token vaut attribution de rôle au moment du claim : c'est de
 * l'hameçonnage sur notre propre domaine doublé d'une exfiltration de capacité.
 * Le repli était faux par-dessus le marché : `/accept-invite/:token` est une
 * route de l'app CRM, que la vitrine `megga.ch` ne connaît pas — tout envoi sans
 * en-tête `Origin` produisait un lien mort.
 *
 * Pourquoi le fichier mêle deux natures de vérification. L'URL n'existe que dans
 * le corps envoyé à Resend : aucune suite ne l'observe, ni les tests backend (qui
 * ne postent pas d'e-mail réel) ni les e2e — le défaut est resté invisible
 * d'avril à août 2026. Depuis que l'adresse est bâtie par `_shared/app-url.ts`,
 * sa FORME s'éprouve en appelant le constructeur ; ce qui reste propre à
 * `send-team-invite` — ne pas lire d'en-tête, ne pas réassembler l'adresse chez
 * lui — ne se lit que dans le source.
 *
 * Ce que ce fichier ne couvre PAS : que l'hôte réponde (aucun appel réseau), ni
 * qu'un `MEGGA_APP_URL` posé en production désigne bien l'app — aucune porte ne
 * peut lire la valeur d'un secret, cela se vérifie à la main au déploiement.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { teamInviteAcceptUrl } from '../../supabase/functions/_shared/app-url'

const FICHIER = 'supabase/functions/send-team-invite/index.ts'
const ROUTE = '/accept-invite/:token'

/** Jeton d'invitation de forme réaliste : `crypto.randomUUID()`. */
const JETON = '3f2a91c4-7b0d-4e6a-9c11-8d5e2f0a6b73'

/**
 * `app-url.ts` lit `Deno.env` — absent sous Node. Le module le lit DANS la
 * fonction (et non dans une `const`), ce qui permet de rejouer plusieurs
 * configurations dans le même fichier.
 */
function poserEnv(valeurs: Record<string, string> = {}): void {
  ;(globalThis as unknown as { Deno: { env: { get: (k: string) => string | undefined } } }).Deno = {
    env: { get: (k: string) => valeurs[k] },
  }
}

/** Chemins absolus déclarés par le routeur de l'app. */
function routesDeclarees(): string[] {
  const source = readFileSync(resolve(__dirname, '../../src/App.tsx'), 'utf8')
  const chemins = [...source.matchAll(/path="(\/[^"]*)"/g)].map((m) => m[1])
  if (chemins.length < 20) {
    throw new Error(
      `seulement ${chemins.length} routes extraites de src/App.tsx — l'extraction ne prouve plus rien`,
    )
  }
  return chemins
}

describe("Constructeur de l'URL d'acceptation", () => {
  beforeEach(() => poserEnv())

  it("retombe sur le domaine de l'APP, jamais sur la vitrine", () => {
    // Contrôle en dur plutôt que dérivé : c'est exactement la valeur de repli que
    // le défaut d'origine avait fausse, et `megga.ch` ne sert pas cette route.
    expect(teamInviteAcceptUrl(JETON)).toBe(`https://app.megga.ch/accept-invite/${JETON}`)
  })

  it('produit le chemin de la route déclarée dans src/App.tsx', () => {
    // Le piège n'a jamais été l'hôte mais le CHEMIN : `/accept-invite` appartient
    // au routeur. Renommer la route sans déplacer le constructeur doit rougir ici.
    expect(routesDeclarees()).toContain(ROUTE)
    expect(new URL(teamInviteAcceptUrl(JETON)).pathname).toBe(ROUTE.replace(':token', JETON))
  })

  it('le réglage porte une base, pas un domaine qui remplacerait le chemin', () => {
    // Un futur domaine de l'app change l'hôte ; le segment `/accept-invite` reste.
    // Slash final toléré : une valeur recopiée depuis un navigateur en porte un,
    // et `//accept-invite/` ne serait pas servi.
    poserEnv({ MEGGA_APP_URL: 'https://crm.megga.ch/' })
    expect(teamInviteAcceptUrl(JETON)).toBe(`https://crm.megga.ch/accept-invite/${JETON}`)
  })
})

describe('send-team-invite', () => {
  const source = readFileSync(FICHIER, 'utf8')

  it("ne lit aucun en-tête de requête pour bâtir l'URL d'acceptation", () => {
    // On vise `origin` et `referer` : les deux en-têtes que l'appelant choisit
    // et qu'on est tenté de prendre pour l'adresse du site.
    const interdit = /headers\.get\(\s*['"](origin|referer)['"]\s*\)/i
    expect(
      interdit.test(source),
      "l'URL d'acceptation doit venir de la configuration, jamais de la requête",
    ).toBe(false)
  })

  it("ne réassemble aucune adresse chez lui", () => {
    // Ni le segment de chemin ni la base : les deux appartiennent au constructeur
    // partagé. Une copie locale, même correcte le jour où elle est écrite, est une
    // occasion de divergence que personne ne verrait (aucune suite n'ouvre l'e-mail).
    expect(source).not.toContain('/accept-invite')
    expect(source).not.toContain('MEGGA_APP_URL')
    expect(source).toContain("from '../_shared/app-url.ts'")
  })

  it("les deux chemins d'envoi (invitation et renvoi) passent par le même constructeur", () => {
    // On lit les valeurs réellement passées à l'e-mail plutôt que de compter des
    // appels : si un troisième chemin d'envoi apparaît, il est couvert d'office.
    const valeurs = [...source.matchAll(/acceptUrl:\s*([^\n]+)/g)]
      .map((m) => m[1].trim())
      .filter((v) => v !== 'string') // le champ du type de `buildInviteEmailHtml`
    expect(valeurs.length, `attendu au moins 2 envois, trouvé ${valeurs.length}`).toBeGreaterThanOrEqual(2)
    for (const valeur of valeurs) {
      expect(valeur).toMatch(/^teamInviteAcceptUrl\(/)
    }
  })
})
