// Garde LAB plein (etape 5, tache 4) — decision pure et testable, meme motif que
// useIdentityGate.ts (resolveIdentityGateStatus) : bloque deux actions a risque
// (ouverture d'un dossier KYC client, signature electronique) tant que l'agence
// n'a pas atteint agencies.verification_status IN ('auto_validated', 'validated').
//
// Garde-fou herite, a ne pas rejouer (voir l'en-tete de useIdentityGate.ts, incident
// P0 c830f9a9) : ne jamais afficher de bandeau alarmant ni de blocage tant que le
// statut n'est pas connu ('loading') — un faux positif bloquerait une agence
// legitime sans raison. Une fois le statut connu, meme discipline fail-closed que
// useIdentityGate sur une lecture en echec (identitySubmittedAt undefined traite
// comme une absence de preuve, jamais confondu avec l'etat 'loading' lui-meme).

import { describe, it, expect } from 'vitest'
import {
  resolveLabGuardStatus,
  canActOnLabGuard,
  type ResolveLabGuardStatusInput,
} from '@/hooks/useLabGuard'
import type { UserRole } from '@/types/auth'

// Etat de base "agence cleared" — devie par les tests ci-dessous (memes noms de
// champs que le hook reel, meme motif que identity-gate.spec.ts).
const base: ResolveLabGuardStatusInput = {
  authLoading: false,
  agencyId: 'agency-1',
  agencyStatusLoading: false,
  agencyStatusError: false,
  identitySubmittedAt: '2026-07-20T08:00:00.000Z',
  verificationStatus: 'auto_validated',
}

describe('resolveLabGuardStatus — garde-fou : jamais de blocage ni de bandeau sur un etat indetermine', () => {
  it('session/profil en cours de resolution (useAuth().loading) -> loading', () => {
    expect(resolveLabGuardStatus({ ...base, authLoading: true })).toBe('loading')
  })

  it('lecture agencies.verification_status en cours -> loading', () => {
    expect(resolveLabGuardStatus({ ...base, agencyStatusLoading: true })).toBe('loading')
  })

  it('authLoading prime sur tout le reste, meme sans agence connue', () => {
    expect(resolveLabGuardStatus({ ...base, authLoading: true, agencyId: null })).toBe('loading')
  })
})

describe('resolveLabGuardStatus — correctif revue (point 3, important) : une lecture en echec retombe sur loading, jamais un blocage', () => {
  // Le fail-closed serveur (supabase/functions/_shared/agency-lab-guard.ts) reste
  // correct et INCHANGE : une lecture en echec y refuse l'action, par construction —
  // c'est LUI qui protege reellement. Cote CLIENT en revanche, afficher
  // "blocked_not_submitted" sur une simple erreur reseau/RLS AFFIRME une chose fausse
  // ("jamais soumis") a une agence par ailleurs deja validee : verifie en conditions
  // reelles, une agence validee s'est vue murement hors du KYC avec ce message errone.
  // Le garde doit se taire (rester 'loading', memes ecrans neutres que l'etat non
  // resolu) tant qu'il ne SAIT pas — le controle qui compte reste le serveur.
  it('agencyStatusError (useQuery().isError) -> loading, jamais blocked_not_submitted', () => {
    expect(resolveLabGuardStatus({ ...base, agencyStatusError: true })).toBe('loading')
  })

  it('agencyStatusError prime sur un identitySubmittedAt absent (la lecture a echoue, on ne sait rien affirmer)', () => {
    expect(
      resolveLabGuardStatus({ ...base, agencyStatusError: true, identitySubmittedAt: undefined, verificationStatus: undefined })
    ).toBe('loading')
  })

  it('agencyStatusError prime meme si un ancien identitySubmittedAt reste en cache (staleTime 60s) — ne pas affirmer un verdict perime', () => {
    expect(
      resolveLabGuardStatus({ ...base, agencyStatusError: true, verificationStatus: 'rejected' })
    ).toBe('loading')
  })
})

describe('resolveLabGuardStatus — pas d agence a garder', () => {
  it('agencyId nul -> clear (rien a gater, meme etat transitoire que useIdentityGate)', () => {
    // Un profil sans agence ne peut de toute facon pas appeler kyc-screening ni
    // sign-document (requireAgentAuth renvoie 403 des la racine) : le cote client
    // n a rien de plus a bloquer ici, ni rien de vrai a affirmer sur une agence
    // qui n existe pas.
    expect(resolveLabGuardStatus({ ...base, agencyId: null })).toBe('clear')
  })

  it('agencyId nul court-circuite avant agencyStatusLoading (jamais de requete a evaluer)', () => {
    expect(resolveLabGuardStatus({ ...base, agencyId: null, agencyStatusLoading: true })).toBe('clear')
  })
})

describe('resolveLabGuardStatus — dossier jamais soumis', () => {
  it('identitySubmittedAt null -> blocked_not_submitted', () => {
    expect(resolveLabGuardStatus({ ...base, identitySubmittedAt: null })).toBe('blocked_not_submitted')
  })

  it('identitySubmittedAt undefined SANS agencyStatusError -> blocked_not_submitted, filet defensif', () => {
    // Etat qui ne devrait jamais survenir en pratique : une lecture reussie
    // (agencyStatusError=false, agencyStatusLoading=false) renvoie toujours une ligne
    // complete (AgencyLabGuardRow — identity_submitted_at: string | null, jamais
    // undefined) ou leve une erreur qui pose agencyStatusError=true. Ce test couvre
    // uniquement le filet defensif si cette hypothese etait un jour violee (donnee
    // malformee) : contrairement a une ERREUR DE LECTURE (couverte par
    // agencyStatusError, cf. describe ci-dessus -> loading), une donnee reputee
    // presente mais vide reste traitee comme une absence de preuve.
    expect(resolveLabGuardStatus({ ...base, identitySubmittedAt: undefined })).toBe('blocked_not_submitted')
  })

  it('identitySubmittedAt null prime sur verificationStatus, meme deja a auto_validated', () => {
    // Etat impossible en pratique (verification_status par defaut a 'pending' tant que
    // rien n'est soumis, cf. migration 20260728101000) mais l'ordre de priorite doit
    // rester correct par construction : la preuve de soumission passe avant le verdict.
    expect(
      resolveLabGuardStatus({ ...base, identitySubmittedAt: null, verificationStatus: 'auto_validated' }),
    ).toBe('blocked_not_submitted')
  })
})

describe('resolveLabGuardStatus — dossier soumis, verdict rendu', () => {
  it('auto_validated (moteur) -> clear', () => {
    expect(resolveLabGuardStatus({ ...base, verificationStatus: 'auto_validated' })).toBe('clear')
  })

  it('validated (decision humaine, admin_validate_agency_review) -> clear', () => {
    expect(resolveLabGuardStatus({ ...base, verificationStatus: 'validated' })).toBe('clear')
  })

  it('rejected -> blocked_rejected', () => {
    expect(resolveLabGuardStatus({ ...base, verificationStatus: 'rejected' })).toBe('blocked_rejected')
  })
})

describe('resolveLabGuardStatus — dossier soumis, en attente de revue', () => {
  it('pending (juste soumis, connecteurs pas encore passes) -> blocked_pending_review', () => {
    expect(resolveLabGuardStatus({ ...base, verificationStatus: 'pending' })).toBe('blocked_pending_review')
  })

  it('manual_review (verdict du moteur ou filet de rattrapage) -> blocked_pending_review', () => {
    expect(resolveLabGuardStatus({ ...base, verificationStatus: 'manual_review' })).toBe('blocked_pending_review')
  })

  it('valeur inconnue -> blocked_pending_review, fail-closed (liste blanche, jamais liste noire)', () => {
    // Seuls 'auto_validated'/'validated' sont explicitement admis : toute autre
    // valeur, connue ou future, reste bloquee par construction.
    expect(
      resolveLabGuardStatus({ ...base, verificationStatus: 'some_future_status' }),
    ).toBe('blocked_pending_review')
  })
})

describe('canActOnLabGuard — qui peut completer la soumission d identite depuis le bandeau/l ecran bloque', () => {
  it('admin et manager peuvent agir (seuls roles autorises par submit_agency_identity)', () => {
    expect(canActOnLabGuard('admin')).toBe(true)
    expect(canActOnLabGuard('manager')).toBe(true)
  })

  it('tous les autres roles ne peuvent pas agir eux-memes, y compris super_admin', () => {
    const roles: UserRole[] = ['agent', 'assistant', 'buyer', 'seller', 'particulier', 'super_admin']
    for (const role of roles) {
      expect(canActOnLabGuard(role)).toBe(false)
    }
  })
})
