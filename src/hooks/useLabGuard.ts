/**
 * Garde LAB plein (route /dashboard/kyc, edge functions kyc-screening et
 * sign-document) — decide si une agence peut ouvrir un dossier KYC client ou
 * lancer une signature electronique. Consomme par LabGuardBanner (bandeau global,
 * AgentSugarLayout) et KycLabGuard (blocage plein de /dashboard/kyc, App.tsx).
 *
 * Reprend la FORME de useIdentityGate.ts (hook + fonction pure resolveXStatus,
 * testable sans rendu) et surtout ses garde-fous, sur la meme base : un gate
 * bloquant a deja cause un incident P0 sur ce projet (commit c830f9a9, "boucle
 * onboarding") ou une redirection emise sur un etat non resolu a fait rebondir un
 * agent indefiniment. Ici la consequence d'un etat non resolu serait pire qu'une
 * boucle de redirection : un faux positif bloquerait une agence legitime sans
 * raison, ou pire, un faux negatif (traiter 'loading' comme 'clear') laisserait
 * passer une action a risque LAB. D'ou le meme garde-fou : resolveLabGuardStatus
 * ne renvoie JAMAIS 'blocked_*' ni 'clear' tant que la session ou la lecture
 * agence ne sont pas resolues — elle renvoie 'loading', et ni le bandeau ni
 * l'ecran bloque n'affichent quoi que ce soit dans cet etat (cf. leurs propres
 * fichiers).
 *
 * Ecart assume avec useIdentityGate : PAS d'exemption super-admin ici. Le garde
 * est une fonction directe de agencies.verification_status (spec de conception
 * §11) — decision produit de Thomas, "garde plein... aucune exemption
 * transitoire" (task-4-brief.md). Un profil sans agence (agencyId nul) reste
 * neanmoins hors du perimetre de ce hook ('clear'), au meme titre que
 * useIdentityGate traite ce cas comme 'exempt' : il n'y a rien de vrai a
 * affirmer sur une agence qui n'existe pas, et les deux edge functions
 * refusent de toute facon un profil sans agency_id (requireAgentAuth, 403)
 * avant meme d'atteindre ce garde.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/auth'

export type LabGuardStatus =
  | 'loading'
  | 'clear'
  | 'blocked_not_submitted'
  | 'blocked_pending_review'
  | 'blocked_rejected'

export interface ResolveLabGuardStatusInput {
  /** useAuth().loading — session/profil en cours de resolution. */
  authLoading: boolean
  /** profile?.agency_id ?? null. */
  agencyId: string | null
  /** Lecture agencies.verification_status/identity_submitted_at en cours (useQuery().isLoading). */
  agencyStatusLoading: boolean
  /** null = jamais soumis ; horodatage = soumis ; undefined = lecture non aboutie/en echec (fail-closed, traite comme null). */
  identitySubmittedAt: string | null | undefined
  /** undefined = lecture non aboutie/en echec. Sinon une des 5 valeurs de la contrainte
   *  CHECK agencies_verification_status_chk (migration 20260728107000). */
  verificationStatus: string | undefined
}

/**
 * Decide le statut du garde pour un etat entierement resolu (pur -> testable sans
 * React, tests/unit/lab-guard.spec.ts). Ordre des verifications : etat non resolu
 * d'abord (garde-fou anti-faux-positif), puis preuve de soumission, puis verdict.
 */
export function resolveLabGuardStatus(input: ResolveLabGuardStatusInput): LabGuardStatus {
  const { authLoading, agencyId, agencyStatusLoading, identitySubmittedAt, verificationStatus } = input

  // Garde-fou : tant que la session n'est pas resolue, on ne decide rien.
  if (authLoading) return 'loading'

  // Rien a gater sur un profil sans agence (etat transitoire hors perimetre de ce
  // garde, meme motif que useIdentityGate — agencies.agency_id nul apres
  // l'auto-provisioning au signup). Court-circuite AVANT d'evaluer
  // agencyStatusLoading : la requete agence n'est jamais lancee dans ce cas
  // (cf. useLabGuard, plus bas, `enabled`).
  if (!agencyId) return 'clear'

  if (agencyStatusLoading) return 'loading'

  // Fail-closed, meme motif que resolveIdentityGateStatus ("lecture en echec ->
  // required") : identitySubmittedAt undefined (erreur reseau/RLS) n'est jamais
  // confondu avec une preuve positive de soumission. `== null` couvre a la fois
  // null (jamais soumis) et undefined (lecture en echec) en une seule branche.
  if (identitySubmittedAt == null) return 'blocked_not_submitted'

  // Liste BLANCHE, jamais liste noire : seules ces deux valeurs debloquent l'agence.
  // Toute autre valeur, connue (pending/manual_review/rejected) ou future, reste
  // bloquee par construction — coherent avec l'objectif 2 du Document Maitre
  // (reduire le risque LAB/KYC).
  if (verificationStatus === 'auto_validated' || verificationStatus === 'validated') return 'clear'
  if (verificationStatus === 'rejected') return 'blocked_rejected'
  return 'blocked_pending_review'
}

/**
 * true si `role` peut lui-meme completer la verification d'identite de l'agence
 * (soumettre le wizard /dashboard/identite) — seuls admin/manager passent la garde
 * is_agency_admin de submit_agency_identity (etape 2, tache 1). Determine si le
 * bandeau/l'ecran bloque affiche un bouton d'action ou un simple renvoi vers un
 * administrateur/gerant de l'agence.
 */
export function canActOnLabGuard(role: UserRole): boolean {
  return role === 'admin' || role === 'manager'
}

interface AgencyLabGuardRow {
  verification_status: string
  identity_submitted_at: string | null
}

/**
 * Hook consomme par LabGuardBanner et KycLabGuard. Resout profil + une lecture
 * dediee de agencies (verification_status, identity_submitted_at) puis delegue la
 * decision a resolveLabGuardStatus.
 *
 * Cle de requete DISTINCTE de celle de useIdentityGate (['agency-identity-status', ...])
 * bien que les deux lisent la meme ligne agencies : useIdentityGate ne lance sa
 * requete que pour admin/manager (gateMayApply), ce garde-ci doit s'appliquer a
 * TOUS les roles (un agent simple peut tout autant ouvrir un dossier KYC ou lancer
 * une signature). Partager la cle aurait donc force soit une requete pour tout le
 * monde cote useIdentityGate (hors de son perimetre, modifie un hook au passe
 * fragile qu'on ne touche pas ici), soit un `enabled` incompatible entre les deux
 * consommateurs. Cout accepte : un aller-retour reseau de plus sur la meme ligne
 * pour un admin/manager, contre un couplage entre deux gates independants.
 */
export function useLabGuard(): LabGuardStatus {
  const { profile, loading: authLoading } = useAuth()
  const agencyId = profile?.agency_id ?? null

  const { data, isLoading: agencyStatusLoading } = useQuery({
    queryKey: ['agency-lab-guard-status', agencyId],
    queryFn: async (): Promise<AgencyLabGuardRow> => {
      const { data, error } = await supabase
        .from('agencies')
        .select('verification_status, identity_submitted_at')
        .eq('id', agencyId as string)
        .single<AgencyLabGuardRow>()
      if (error) throw error
      return data
    },
    enabled: !authLoading && !!agencyId,
    staleTime: 60_000,
  })

  return resolveLabGuardStatus({
    authLoading,
    agencyId,
    agencyStatusLoading,
    identitySubmittedAt: data?.identity_submitted_at,
    verificationStatus: data?.verification_status,
  })
}
