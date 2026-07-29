// Unit test (pur, Node/Vitest) — garde LAB plein (etape 5, tache 4), volet serveur.
// Couvre isAgencyLabCleared, la fonction pure qui decide si l'agence appelante peut
// declencher un screening KYC (kyc-screening) ou lancer une signature electronique
// (sign-document). NE teste PAS requireAgencyLabCleared (I/O Supabase) : couvert par
// tests/backend/agency-lab-guard.spec.ts, meme partage que requireAgentAuth.
//
// Duplique volontairement resolveLabGuardStatus de src/hooks/useLabGuard.ts plutot que
// de le reutiliser : jamais d'import cross-runtime entre src/ (navigateur) et
// supabase/functions/ (Deno), cf. CLAUDE.md § Structure des dossiers. La liste
// canonique des valeurs vit dans la contrainte CHECK agencies_verification_status_chk
// (migration 20260728107000_agencies_identity_submission.sql).

import { describe, it, expect } from 'vitest'
import { isAgencyLabCleared } from './agency-lab-guard'

describe('isAgencyLabCleared', () => {
  it('auto_validated et validated sont cleared', () => {
    expect(isAgencyLabCleared('auto_validated')).toBe(true)
    expect(isAgencyLabCleared('validated')).toBe(true)
  })

  it('pending, manual_review et rejected restent bloques', () => {
    expect(isAgencyLabCleared('pending')).toBe(false)
    expect(isAgencyLabCleared('manual_review')).toBe(false)
    expect(isAgencyLabCleared('rejected')).toBe(false)
  })

  it('valeur inconnue, null ou undefined -> bloque (liste blanche, jamais liste noire)', () => {
    expect(isAgencyLabCleared('a_future_status')).toBe(false)
    expect(isAgencyLabCleared(null)).toBe(false)
    expect(isAgencyLabCleared(undefined)).toBe(false)
  })
})
