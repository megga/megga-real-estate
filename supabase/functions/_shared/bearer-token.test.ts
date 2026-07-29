/**
 * Refus précoce des jetons qui ne peuvent pas désigner un utilisateur.
 *
 * Le piège que ces tests verrouillent : `isNonUserToken` a l'air d'un contrôle
 * de sécurité, alors que c'en est l'inverse — il ne doit JAMAIS laisser passer
 * quoi que ce soit. Il ne fait que prononcer plus tôt un refus certain. Le jour
 * où quelqu'un « l'améliore » en lui faisant renvoyer `false` sur un doute, ou
 * `true` sur un jeton porteur d'un `sub`, la garde se met soit à bavarder à
 * nouveau dans les journaux, soit à refuser des sessions valides sans jamais
 * appeler GoTrue — et ça ne se verrait qu'en production.
 */
import { describe, it, expect } from 'vitest'
import { isNonUserToken } from './bearer-token.ts'

/** Fabrique un JWT non signé (seul le payload compte ici). */
function jwt(payload: Record<string, unknown>): string {
  const b64u = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u(payload)}.signature`
}

// Vraie anon key du projet (publique par design, déjà en clair dans
// src/lib/supabase.ts) : c'est LE jeton que le navigateur envoie quand il
// invoque une Edge Function sans session, donc la cause réelle du bruit.
const REAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWN6dWd5cnZtdHFubm12am9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTM4ODgsImV4cCI6MjA4OTE4OTg4OH0.T257g0ws-PmTTBSDBcUQF6WFvVRLmTFHUwIYMgmCrMw'

describe('isNonUserToken', () => {
  it('reconnaît la vraie anon key du projet', () => {
    expect(isNonUserToken(REAL_ANON_KEY)).toBe(true)
  })

  it('reconnaît une clé service_role (même forme, aucun `sub`)', () => {
    expect(isNonUserToken(jwt({ iss: 'supabase', ref: 'eayczugyrvmtqnnmvjod', role: 'service_role' }))).toBe(true)
  })

  it('laisse passer une session d’utilisateur', () => {
    expect(isNonUserToken(jwt({ sub: '329bb0d2-13e3-4270-9d07-4109c397fad9', role: 'authenticated' }))).toBe(false)
  })

  it('ne se laisse pas tromper par un `sub` vide ou non textuel', () => {
    expect(isNonUserToken(jwt({ sub: '', role: 'authenticated' }))).toBe(true)
    expect(isNonUserToken(jwt({ sub: 42, role: 'authenticated' }))).toBe(true)
    expect(isNonUserToken(jwt({ sub: null, role: 'authenticated' }))).toBe(true)
  })

  it('laisse GoTrue trancher quand le jeton est illisible', () => {
    // Refuser ici serait tentant (GoTrue refuse aussi) mais ferait de ce module
    // un juge de validité, ce qu'il n'est pas. Il ne prononce que le refus dont
    // il est CERTAIN, sur un payload qu'il a réellement lu.
    for (const bogus of ['', 'pas-un-jwt', 'a.b', 'a..c', 'a.@@@.c', 'a.eyJub3QtanNvbg.c']) {
      expect(isNonUserToken(bogus)).toBe(false)
    }
  })

  it('lit un payload dont le base64url a besoin de padding', () => {
    // Les longueurs de payload ≢ 0 (mod 4) cassent `atob` sans padding : un
    // `sub` bien présent serait alors lu comme absent, et la garde refuserait
    // une session valide sans jamais appeler GoTrue.
    for (let n = 1; n <= 12; n++) {
      const token = jwt({ sub: 'u'.repeat(n), role: 'authenticated' })
      expect(isNonUserToken(token), `sub de ${n} caractère(s)`).toBe(false)
    }
  })
})
