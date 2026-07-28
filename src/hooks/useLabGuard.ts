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
 *
 * Correctif revue (etape 5/tache 4, point 3, important) : le fail-closed sur une
 * lecture en echec reste juste cote SERVEUR (agency-lab-guard.ts refuse par
 * construction) — c'est LUI qui protege reellement. Cote CLIENT en revanche,
 * afficher 'blocked_not_submitted' sur une simple erreur reseau/RLS AFFIRME une
 * chose fausse ("jamais soumis") a une agence par ailleurs deja validee : verifie
 * en conditions reelles, une agence validee s'est vue murement hors du KYC avec ce
 * message errone. Le garde client doit se taire (retomber sur 'loading', memes
 * ecrans neutres que l'etat non resolu) tant qu'il ne SAIT pas — d'ou le champ
 * agencyStatusError, verifie AVANT le fail-closed "jamais soumis" ci-dessous.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/auth'

/** Prefixe des routes que KycLabGuard remplace par son propre ecran de blocage
 *  (kyc, kyc/bienvenue, kyc/:dossierId — App.tsx). Consomme par LabGuardBanner pour
 *  ne pas repeter son propre message au-dessus d'un ecran qui dit deja tout
 *  (correctif revue, point mineur). Vit ici (pas dans KycLabGuard.tsx, charge en
 *  lazy()) pour ne pas tirer ce module dans le chunk du bandeau, monte sur CHAQUE
 *  page du CRM agent. */
export const KYC_LAB_GUARD_ROUTE_PREFIX = '/dashboard/kyc'

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
  /** Lecture agencies.verification_status/identity_submitted_at en echec (useQuery().isError).
   *  Verifiee AVANT le fail-closed "jamais soumis" : une erreur reseau/RLS ne doit
   *  jamais s'afficher comme un verdict ("jamais soumis"/statut perime) — cf.
   *  correctif revue point 3 dans l'en-tete du fichier. */
  agencyStatusError: boolean
  /** null = jamais soumis ; horodatage = soumis ; undefined = filet defensif si la
   *  lecture est reputee reussie (agencyStatusError=false) mais renvoie quand meme
   *  une valeur absente — ne devrait pas survenir en pratique (AgencyLabGuardRow
   *  n'a pas de champ optionnel), cf. agencyStatusError pour la vraie erreur de
   *  lecture. */
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
  const { authLoading, agencyId, agencyStatusLoading, agencyStatusError, identitySubmittedAt, verificationStatus } = input

  // Garde-fou : tant que la session n'est pas resolue, on ne decide rien.
  if (authLoading) return 'loading'

  // Rien a gater sur un profil sans agence (etat transitoire hors perimetre de ce
  // garde, meme motif que useIdentityGate — agencies.agency_id nul apres
  // l'auto-provisioning au signup). Court-circuite AVANT d'evaluer
  // agencyStatusLoading : la requete agence n'est jamais lancee dans ce cas
  // (cf. useLabGuard, plus bas, `enabled`).
  if (!agencyId) return 'clear'

  if (agencyStatusLoading) return 'loading'

  // Correctif revue (point 3, important) : une lecture en echec retombe sur
  // 'loading', PAS sur un blocage. Le fail-closed reste juste cote SERVEUR
  // (agency-lab-guard.ts) ; cote client, afficher 'blocked_not_submitted' sur une
  // simple erreur reseau/RLS affirmerait une chose fausse a une agence par ailleurs
  // deja validee (verifie en conditions reelles). Verifiee AVANT le fail-closed
  // "jamais soumis" ci-dessous : une lecture en echec ne doit jamais etre confondue
  // avec une preuve, positive ou negative.
  if (agencyStatusError) return 'loading'

  // Filet defensif : identitySubmittedAt ne devrait etre undefined qu'en cas
  // d'erreur de lecture (deja ecartee ci-dessus) — AgencyLabGuardRow n'a pas de
  // champ optionnel, donc une lecture reputee reussie renvoie toujours null (jamais
  // soumis) ou un horodatage (soumis). Si cette hypothese etait un jour violee
  // (donnee malformee), rester fail-closed reste le choix le plus sur.
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

  const { data, isLoading: agencyStatusLoading, isError: agencyStatusError } = useQuery({
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
    // Correctif revue (point 3, important) : une lecture en echec (isError) retombe
    // sur 'loading' dans resolveLabGuardStatus, jamais sur un blocage — cf. l'en-tete
    // du fichier et son propre commentaire.
    agencyStatusError,
    identitySubmittedAt: data?.identity_submitted_at,
    verificationStatus: data?.verification_status,
  })
}
