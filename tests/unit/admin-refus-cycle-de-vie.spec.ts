/**
 * Le motif d'un refus de cycle de vie (suspendre, réinitialiser, supprimer) : lu dans le
 * corps de la réponse, traduit en mot-clé, et tenu contre ce que les deux edges rendent.
 *
 * ⛔ Mesuré le 13.09.2026 : `useAdminUserLifecycle` jetait l'erreur de `functions.invoke`
 * telle quelle — « Edge Function returned a non-2xx status code » — et le tiroir affichait
 * pour TOUT refus « les gestes de cycle de vie sont refusés côté serveur sur un compte
 * super-admin allowlisté ». Un dossier KYC en cours, un dernier administrateur d'agence,
 * une boîte mail qui ne se déconnecte pas : trois causes, un seul message, et faux.
 *
 * Le rendu à l'écran est éprouvé par admin-refus-tiroir.spec.tsx.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { FunctionsFetchError, FunctionsHttpError } from '@supabase/supabase-js'
import { lireRefusEdge } from '@/lib/refusEdge'
import { CODES_REFUS, MOTIF_REFUS_KEY, motifRefus, type MotifRefusId } from '@/lib/adminUserRegistry'
import { repoPath } from './helpers/fs-scan'

const lire = (f: string) => readFileSync(repoPath(f), 'utf8').replace(/\r\n/g, '\n')
const sansCommentaires = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
const SUPPRESSION = sansCommentaires(lire('supabase/functions/delete-account/index.ts'))
const CYCLE = sansCommentaires(lire('supabase/functions/admin-user-lifecycle/index.ts'))

const refus = (status: number, corps: unknown) =>
  new FunctionsHttpError(new Response(typeof corps === 'string' ? corps : JSON.stringify(corps), { status }))

describe('lireRefusEdge — le motif est dans le corps, pas dans « non-2xx »', () => {
  it('un code en majuscules, son message et son compte', async () => {
    expect(await lireRefusEdge(refus(400, { error: 'KYC_PENDING', message: 'Vous avez 2 dossier(s) KYC en cours.', count: 2 })))
      .toEqual({ status: 400, code: 'KYC_PENDING', texte: 'Vous avez 2 dossier(s) KYC en cours.', count: 2 })
  })
  it('une phrase dans `error` n’est pas un code : elle devient le texte', async () => {
    expect(await lireRefusEdge(refus(403, { error: 'refused: cannot delete an allowlisted admin account' })))
      .toEqual({ status: 403, code: null, texte: 'refused: cannot delete an allowlisted admin account', count: null })
  })
  it('un corps illisible garde le statut, sans lever', async () => {
    expect(await lireRefusEdge(refus(502, '<html>Bad gateway</html>'))).toEqual({ status: 502, code: null, texte: null, count: null })
  })
  it('le serveur n’a pas répondu : statut 0', async () => {
    expect((await lireRefusEdge(new FunctionsFetchError(new TypeError('Failed to fetch')))).status).toBe(0)
  })
})

describe('motifRefus — une cause par refus, jamais « allowlisté » par défaut', () => {
  const cas: [string, { status: number; code: string | null; texte: string | null }, MotifRefusId][] = [
    ['dossier KYC en cours', { status: 400, code: 'KYC_PENDING', texte: null }, 'kycPending'],
    ['dernier administrateur', { status: 400, code: 'SOLE_ADMIN', texte: null }, 'soleAdmin'],
    ['boîte mail non déconnectée', { status: 502, code: 'MAILBOX_DISCONNECT_FAILED', texte: null }, 'mailbox'],
    ['compte allowlisté (suppression)', { status: 403, code: null, texte: 'refused: cannot delete an allowlisted admin account' }, 'allowlisted'],
    ['compte allowlisté (cycle de vie)', { status: 403, code: null, texte: 'refused: cannot run lifecycle actions on an allowlisted admin account' }, 'allowlisted'],
    ['opérateur non super-admin', { status: 403, code: null, texte: 'Forbidden: super_admin required' }, 'forbidden'],
    ['session expirée', { status: 401, code: null, texte: 'Invalid or expired session' }, 'session'],
    ['compte introuvable', { status: 404, code: null, texte: 'Profile not found' }, 'notFound'],
    ['effacement à moitié fait', { status: 500, code: null, texte: 'Auth user deletion failed: boom. Data was anonymised but the auth record remains — contact support.' }, 'partial'],
    ['serveur injoignable', { status: 0, code: null, texte: 'Failed to fetch' }, 'network'],
    ['autre panne', { status: 500, code: null, texte: 'Audit log failed: timeout' }, 'other'],
  ]
  for (const [nom, r, motif] of cas) it(nom, () => expect(motifRefus(r)).toBe(motif))

  it('chaque motif a sa phrase dans les quatre langues', () => {
    for (const langue of ['fr', 'de', 'en', 'it']) {
      const cles = JSON.parse(lire(`src/i18n/locales/${langue}/admin.json`)) as Record<string, string>
      for (const cle of Object.values(MOTIF_REFUS_KEY)) expect(cles[cle], `${langue} : ${cle}`).toBeTruthy()
      for (const titre of ['userDrawer.lifecycle.deleteRefused', 'userDrawer.lifecycle.actionRefused']) expect(cles[titre], `${langue} : ${titre}`).toBeTruthy()
      // La phrase qui mentait pour tout refus ne doit pas revenir par la bande.
      expect(cles['userDrawer.lifecycle.error'], `${langue} : l’ancien message unique est revenu`).toBeUndefined()
    }
  })
})

describe('le contrat avec les edges, dans les deux sens', () => {
  it('chaque code que rend delete-account est reconnu par la console', () => {
    const codes = [...SUPPRESSION.matchAll(/error:\s*'([A-Z][A-Z0-9_]+)'/g)].map((m) => m[1]!)
    expect(codes.length, 'aucun code relevé — la garde ne mesure plus rien').toBeGreaterThanOrEqual(3)
    for (const code of codes) expect(CODES_REFUS, `${code} rendu par delete-account, inconnu de la console`).toHaveProperty(code)
  })
  it('chaque code reconnu par la console existe encore dans delete-account', () => {
    for (const code of Object.keys(CODES_REFUS)) expect(SUPPRESSION, `${code} n’est plus rendu`).toContain(`'${code}'`)
  })
  it('les deux textes reconnus sont bien ceux que les edges rendent', () => {
    // Un 403 « allowlisted » dans chacune des deux edges, et l'effacement à moitié fait.
    expect(SUPPRESSION).toMatch(/json\(\{\s*error:\s*'refused: cannot delete an allowlisted admin account'\s*\},\s*403\)/)
    expect(CYCLE).toMatch(/json\(403,\s*\{\s*error:\s*'refused: cannot run lifecycle actions on an allowlisted admin account'\s*\}\)/)
    expect(SUPPRESSION).toContain('error: `Auth user deletion failed:')
  })
})
