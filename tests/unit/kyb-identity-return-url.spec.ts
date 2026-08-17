/**
 * Garde-fou : la vérification d'identité RENVOIE le dirigeant dans le wizard.
 *
 * ⛔ CE QUE CE FICHIER EXISTE POUR EMPÊCHER, et qui est arrivé le 17 août 2026 :
 * `kyb-identity-verify` passait `verification_flow` (le flux « KYB dirigeant agence »
 * du tableau de bord Stripe) EN MÊME TEMPS que `return_url`. Stripe accepte les deux,
 * répond 200 — et **jette `return_url` en silence**. Mesuré sur la session
 * `vs_1U5Y6HRNzm4ajaDaoMv1BMNI` (journal d'API `req_WZUCE21ewpBdBS`) : le corps POST
 * portait `return_url=https://app.megga.ch/dashboard/identite?verification=done`, la
 * réponse ne portait AUCUN champ `return_url`.
 *
 * Conséquence vécue : le dirigeant photographie sa pièce, Stripe lui dit « vous pouvez
 * fermer cet onglet », et il n'arrive JAMAIS sur IdentityVerificationReturnScreen ni sur
 * l'étape « Rendez-vous ». Le parcours s'arrête au milieu alors que tout a marché — le
 * webhook passe, la personne est `verified`. Rien ne rougit, rien n'est journalisé :
 * c'est une panne muette, d'où ce garde-fou.
 *
 * ⚠ POURQUOI UNE LECTURE DE SOURCE et pas un test de comportement : la règle vit chez
 * Stripe, pas chez nous. Aucun test local ne peut l'observer sans appeler l'API en vrai
 * (donc sans clé LIVE et sans créer une session facturable). Ce qui EST vérifiable ici,
 * c'est que l'appel ne reforme pas la combinaison interdite.
 */
import { describe, it, expect } from 'vitest'
import { readFileSafely, repoPath } from './helpers/fs-scan'

const SOURCE = repoPath('supabase', 'functions', 'kyb-identity-verify', 'index.ts')

/**
 * Lit un fichier du dépôt, ou fait rougir.
 *
 * Contrôle positif indispensable : un fichier introuvable rendrait « ne contient pas
 * verification_flow » VERT pour la pire des raisons.
 */
function lireFichier(absPath: string, quoi: string): string {
  const lu = readFileSafely(absPath)
  expect(lu.status, `${quoi} illisible — le garde-fou ne vérifie RIEN`).toBe('ok')
  return lu.status === 'ok' ? lu.value : ''
}

const lireSource = () => lireFichier(SOURCE, 'kyb-identity-verify/index.ts')

/** Le code sans ses commentaires : la garde porte sur ce qui s'EXÉCUTE, pas sur ce qui s'explique. */
function codeSeul(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((l) => l.replace(/\/\/.*$/, ''))
    .join('\n')
}

describe('kyb-identity-verify — le retour du prestataire', () => {
  it('ne passe JAMAIS verification_flow (il annule return_url en silence)', () => {
    const code = codeSeul(lireSource())
    expect(code).not.toMatch(/verification_flow/)
    // Le secret n'a plus de lecteur : le relire signifierait qu'on s'apprête à le
    // repasser à Stripe.
    expect(code).not.toMatch(/STRIPE_IDENTITY_FLOW_ID/)
  })

  it('passe return_url, construit sur l\'origine de l\'appelant', () => {
    const code = codeSeul(lireSource())
    expect(code).toMatch(/return_url:\s*`\$\{origin\}\$\{RETURN_PATH\}`/)
    // Une URL figée serait juste en production et fausse en local comme en préversion.
    expect(code).not.toMatch(/return_url:\s*['"]https:/)
  })

  it('porte les quatre contrôles que le flux configurait', () => {
    const code = codeSeul(lireSource())
    expect(code).toMatch(/type:\s*'document'/)
    expect(code).toMatch(/allowed_types:\s*\['passport',\s*'id_card'\]/)
    expect(code).toMatch(/require_matching_selfie:\s*true/)
    expect(code).toMatch(/require_live_capture:\s*true/)
    expect(code).toMatch(/require_id_number:\s*false/)
  })

  it('renvoie sur la route du wizard, avec le paramètre que l\'écran de retour lit', () => {
    // RETURN_PATH et le lecteur de `?verification=done` (IdentityShell) doivent rester
    // d'accord : l'un pose le paramètre, l'autre l'attend, et rien ne les relie sinon.
    expect(lireSource()).toMatch(/RETURN_PATH = '\/dashboard\/identite\?verification=done'/)
    const shell = lireFichier(
      repoPath('src', 'components', 'crm-identity', 'IdentityShell.tsx'),
      'IdentityShell.tsx',
    )
    expect(shell).toMatch(/searchParams\.get\('verification'\) === 'done'/)
  })
})
