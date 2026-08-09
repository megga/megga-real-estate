/**
 * Garde-fou anti-fuite de clé dans le bundle navigateur.
 *
 * Ce que ces tests protègent : `src/lib/publicKeyGuard.ts` décide de ce qui a le
 * droit de servir de clé publique. Le défaut qu'ils verrouillent est réel et a
 * été mesuré — le contrôle précédent ne décodait qu'un JWT, donc un secret au
 * format `sb_secret_…` (celui que ce projet utilise déjà) passait sans un mot.
 * Voir docs/audits/2026-08-04-blast-radius-service-role.md §4.2.
 */
import { describe, it, expect } from 'vitest'
import { classifyPublicKey, publicKeyRefusalMessage } from '@/lib/publicKeyGuard'

/** Fabrique un JWT non signé — seule la forme compte ici. */
function jwt(payload: Record<string, unknown>): string {
  const b64 = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64url')
  return `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.signature-non-verifiee`
}

// La VRAIE clé anon du projet (publique par conception, déjà dans git).
// Elle sert de contrôle positif : un garde-fou qui refuserait tout passerait
// tous les tests de refus ci-dessous sans rien protéger.
const REAL_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVheWN6dWd5cnZtdHFubm12am9kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MTM4ODgsImV4cCI6MjA4OTE4OTg4OH0.T257g0ws-PmTTBSDBcUQF6WFvVRLmTFHUwIYMgmCrMw'

describe('classifyPublicKey — contrôles positifs (ce qui DOIT passer)', () => {
  it("accepte la vraie clé anon du projet — sinon le garde-fou casse la production", () => {
    expect(classifyPublicKey(REAL_ANON_KEY)).toEqual({ safe: true, kind: 'anon-jwt' })
  })

  it('accepte une clé publiable au nouveau format', () => {
    expect(classifyPublicKey(`sb_publishable_${'x'.repeat(26)}`)).toEqual({
      safe: true, kind: 'publishable',
    })
  })
})

describe('classifyPublicKey — le trou que ce module ferme', () => {
  it('REFUSE une clé secrète au nouveau format `sb_secret_` (invisible pour un décodeur JWT)', () => {
    // 41 caractères, zéro point : exactement la forme constatée en base le 04.08.2026.
    const verdict = classifyPublicKey(`sb_secret_${'x'.repeat(31)}`)
    expect(verdict).toEqual({ safe: false, reason: 'secret-key' })
  })

  it('refuse `sb_secret_` quelles que soient la casse résiduelle et les espaces autour', () => {
    expect(classifyPublicKey(`  sb_secret_${'y'.repeat(31)}  `)).toEqual({
      safe: false, reason: 'secret-key',
    })
  })
})

describe('classifyPublicKey — ce que le contrôle historique attrapait déjà (non-régression)', () => {
  it('refuse un JWT de rôle service_role', () => {
    const verdict = classifyPublicKey(jwt({ iss: 'supabase', role: 'service_role' }))
    expect(verdict).toEqual({ safe: false, reason: 'non-anon-jwt', role: 'service_role' })
  })

  it('refuse un JWT dont le payload n’est pas un multiple de 4 en base64 (bourrage rétabli)', () => {
    // Fait varier la longueur du payload pour balayer les 4 restes possibles :
    // aucun ne doit permettre à un service_role de passer.
    for (let pad = 0; pad < 4; pad++) {
      const token = jwt({ iss: 'supabase', ref: 'x'.repeat(20 + pad), role: 'service_role' })
      expect(classifyPublicKey(token)).toMatchObject({ safe: false, reason: 'non-anon-jwt' })
    }
  })
})

describe('classifyPublicKey — refus par défaut', () => {
  it.each([
    ['chaîne vide', ''],
    ['espaces seuls', '   '],
    ['undefined', undefined],
    ['null', null],
    ['valeur quelconque', 'pk.eyJhbalorspasunecle'],
    ['JWT illisible', 'eyJ.pas-du-base64-valide.sig'],
  ])('refuse %s', (_label, value) => {
    expect(classifyPublicKey(value as string | null | undefined).safe).toBe(false)
  })

  it("refuse un JWT de rôle inconnu plutôt que de publier ce qu'on ne sait pas nommer", () => {
    expect(classifyPublicKey(jwt({ role: 'postgres' }))).toEqual({
      safe: false, reason: 'non-anon-jwt', role: 'postgres',
    })
  })
})

describe('publicKeyRefusalMessage', () => {
  it('nomme la cause précise, pour que la correction soit évidente en console', () => {
    expect(publicKeyRefusalMessage({ safe: false, reason: 'secret-key' })).toContain('sb_secret_')
    expect(publicKeyRefusalMessage({ safe: false, reason: 'non-anon-jwt', role: 'service_role' }))
      .toContain('service_role')
    expect(publicKeyRefusalMessage({ safe: false, reason: 'unrecognised' })).toContain('non reconnue')
  })

  it('dit toujours ce qui se passe ensuite (repli), pour ne pas laisser croire à une panne', () => {
    for (const reason of ['secret-key', 'non-anon-jwt', 'unrecognised'] as const) {
      expect(publicKeyRefusalMessage({ safe: false, reason })).toContain('repli')
    }
  })
})
