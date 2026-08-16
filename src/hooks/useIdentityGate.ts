/**
 * Gate identite legale (route /dashboard/identite) - decide si un dirigeant
 * doit saisir l'identite legale de son agence avant d'acceder au reste du
 * CRM. Consomme par AgentLayout, qui emet la redirection.
 *
 * Le coeur de la decision (resolveIdentityGateStatus) est une fonction pure,
 * sur le meme motif que l'ancien resolveOnboardingGate
 * (src/components/layout/onboardingGate.ts, retire en juillet 2026) : aucune
 * dependance React, donc testable sans rendu. Contrairement a l'ancien gate
 * (100% synchrone depuis `profile`), celui-ci depend aussi d'une lecture
 * agences (agencies.identity_submitted_at) et d'une RPC (is_super_admin()) -
 * useIdentityGate() resout ces deux sources puis appelle la fonction pure.
 *
 * Trois garde-fous non negociables (incident P0 c830f9a9, "boucle
 * onboarding" - une redirection emise sur un etat non resolu a fait rebondir
 * un agent indefiniment entre deux routes qui se redirigeaient l'une
 * l'autre) :
 *   1. resolveIdentityGateStatus ne renvoie JAMAIS 'required' tant qu'une
 *      des trois sources (session/profil, is_super_admin(), agence) n'est
 *      pas resolue - elle renvoie 'loading'.
 *   2. shouldRedirectToIdentityGate refuse toujours de rediriger la route du
 *      gate vers elle-meme.
 *   3. Une fois soumis (identity_submitted_at pose), le statut reste 'done'
 *      - jamais 'required' de nouveau (couvert par tests/unit/identity-gate.spec.ts).
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { useSuperAdminGate } from '@/hooks/useSuperAdminGate'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/auth'

/** Route du wizard de saisie d'identite - cible de la redirection ET seule route qui s'en exempte. */
export const IDENTITY_GATE_ROUTE = '/dashboard/identite'

export type IdentityGateStatus = 'loading' | 'required' | 'exempt' | 'done'

export interface IdentityGateState {
  status: IdentityGateStatus
}

/** Sous-ensemble de UserProfile utile a la decision (mirroir de Pick<UserProfile, ...> de l'ancien gate). */
interface IdentityGateProfile {
  role: UserRole
  agency_id: string | null
}

export interface ResolveIdentityGateStatusInput {
  /** useAuth().loading - session/profil en cours de resolution. */
  authLoading: boolean
  /** null si pas encore charge (couvert par authLoading en pratique, mais verifie a part par prudence). */
  profile: IdentityGateProfile | null
  /** useSuperAdminGate().checking - RPC is_super_admin() en cours. */
  superAdminChecking: boolean
  /** useSuperAdminGate().allowed - is_super_admin() confirme. */
  superAdminAllowed: boolean
  /** Lecture agencies.identity_submitted_at en cours (useQuery().isLoading). */
  agencyStatusLoading: boolean
  /** null = pas encore soumis ; horodatage = soumis ; undefined = non charge/erreur (fail-closed, traite comme null). */
  identitySubmittedAt: string | null | undefined
}

/**
 * Decide le statut du gate pour un etat entierement resolu (pur -> testable
 * sans React). Ordre des verifications = ordre de la condition du plan
 * etape 2 : agence + role, puis exemption super-admin, puis soumission.
 */
export function resolveIdentityGateStatus(input: ResolveIdentityGateStatusInput): IdentityGateStatus {
  const {
    authLoading, profile, superAdminChecking, superAdminAllowed,
    agencyStatusLoading, identitySubmittedAt,
  } = input

  // Garde-fou 1 : tant que la session/le profil n'est pas resolu(e), on ne
  // decide rien. `!profile` couvre aussi le cas (normalement transitoire)
  // ou authLoading est deja faux mais le profil n'a pas encore atterri -
  // mieux vaut attendre que deduire "exempt" faute de donnees.
  if (authLoading || !profile) return 'loading'

  // Un agent simple (ou tout role hors admin/manager) n'engage pas
  // juridiquement l'agence : il ne voit jamais ce gate. Une agence non
  // provisionnee (agency_id nul) n'est pas non plus de son ressort - elle
  // est auto-provisionnee au signup (migration 20260718130000) ; un
  // agency_id nul ici est un etat transitoire que ce gate ne couvre pas.
  if (!profile.agency_id || (profile.role !== 'admin' && profile.role !== 'manager')) {
    return 'exempt'
  }

  // Exemption super-admin EXPLICITE via is_super_admin() (role ET allowlist
  // email, migration 20260705160000) - decision du plan etape 2, pas une
  // deduction depuis profile.role. Un precedent chantier a du ajouter cette
  // exemption APRES COUP sur l'ancien gate onboarding (commit e6c26c02,
  // "les super-admins ne passent plus par le gate d'onboarding agent") faute
  // de l'avoir rendue explicite des le depart : on ne rejoue pas l'oubli.
  if (superAdminChecking) return 'loading'
  if (superAdminAllowed) return 'exempt'

  if (agencyStatusLoading) return 'loading'

  // `identitySubmittedAt == null` couvre a la fois "pas encore soumis"
  // (null) et "lecture en echec" (undefined - reseau, RLS) : fail-closed,
  // coherent avec l'objectif 2 du Document Maitre (reduire le risque
  // LAB/KYC). On ne laisse jamais passer un dirigeant faute d'une preuve
  // positive de soumission.
  return identitySubmittedAt == null ? 'required' : 'done'
}

/**
 * Garde-fou 2 : la route du gate ne se redirige jamais vers elle-meme, meme
 * quand le statut vaut 'required' - sinon un dirigeant qui l'ouvre
 * directement (lien, retour navigateur) ne pourrait jamais l'atteindre. Pur,
 * consomme par AgentLayout avec `location.pathname`.
 */
export function shouldRedirectToIdentityGate(status: IdentityGateStatus, pathname: string): boolean {
  return status === 'required' && pathname !== IDENTITY_GATE_ROUTE
}

/**
 * Garde-fou 1, VERSANT AFFICHAGE : tant que le statut n'est pas resolu, on ne
 * rend pas non plus le CRM.
 *
 * Le garde-fou 1 ci-dessus dit seulement de ne pas REDIRIGER sur un etat
 * indetermine. Il ne disait rien de ce qu'on affiche pendant ce temps, et
 * AgentLayout rendait donc l'<Outlet/> - c'est-a-dire le CRM - jusqu'a ce
 * que la lecture agence reponde. Un dirigeant qui vient d'activer son compte
 * voyait son tableau de bord s'afficher une fraction de seconde avant d'etre
 * renvoye sur le wizard d'identite : l'app lui montrait une porte ouverte puis
 * la lui fermait au nez. Signale par Julien le 1er aout 2026.
 *
 * KycLabGuard applique deja cette discipline pour son propre statut ("Ne rend
 * JAMAIS le blocage ni le contenu reel tant que le statut n'est pas connu") ;
 * ce predicat la rend disponible au gate identite, du meme cote de la barriere.
 *
 * ⚠ `alreadyResolved` n'est PAS une precaution decorative, c'est le coeur du
 * predicat. Retenir l'ecran d'arrivee remplace l'<Outlet/> : l'arbre sous la
 * route est DEMONTE, et avec lui tout l'etat local de la page. Si le statut
 * retombait a 'loading' apres avoir tranche une premiere fois - cle de requete
 * qui change, profil qui se re-resout, reconnexion - le wizard d'identite
 * repartirait de zero : ecran d'arrivee de nouveau affiche, etape en cours de
 * saisie perdue. Attrape par la suite E2E KYB le 01.08.2026, qui bouclait sur
 * l'ecran d'arrivee : chaque clic sur « Identifier mon agence » montait la
 * coquille, un passage a 'loading' la demontait, et l'ecran revenait.
 *
 * On ne retient donc QUE la premiere resolution. Apres elle, un statut
 * indetermine ne provoque plus rien : il n'y a plus de flash a eviter, seulement
 * du travail a ne pas detruire. La redirection, elle, reste gouvernee par le
 * garde-fou 1 et ne part jamais sur un etat non resolu.
 */
export function shouldHoldForIdentityGate(
  status: IdentityGateStatus,
  alreadyResolved: boolean,
): boolean {
  return status === 'loading' && !alreadyResolved
}

interface AgencyIdentityRow {
  identity_submitted_at: string | null
}

/**
 * Hook consomme par AgentLayout. Resout les trois sources (profil,
 * is_super_admin(), agencies.identity_submitted_at) puis delegue la
 * decision a resolveIdentityGateStatus.
 *
 * Contrat d'invalidation pour la tache 7 (soumission) : la cle de requete
 * est ['agency-identity-status', agencyId]. Apres un submit_agency_identity()
 * reussi, invalider (ou poser directement) cette cle AVANT de naviguer vers
 * /dashboard, sinon ce hook relit l'ancien identity_submitted_at (null) et
 * renvoie l'utilisateur droit au gate qu'il vient de quitter - la meme
 * classe de bug que l'incident P0 c830f9a9 (etat suppose a jour mais en
 * realite perime au moment de la navigation).
 */
export function useIdentityGate(): IdentityGateState {
  const { profile, loading: authLoading } = useAuth()
  const superAdmin = useSuperAdminGate()

  const agencyId = profile?.agency_id ?? null
  // Role admin/manager : seul cas ou la lecture agence importe (cf.
  // resolveIdentityGateStatus). Evite une requete reseau pour tout agent
  // simple ou profil sans agence.
  const gateMayApply = !authLoading && !!agencyId && (profile?.role === 'admin' || profile?.role === 'manager')

  const { data, isLoading: agencyStatusLoading } = useQuery({
    queryKey: ['agency-identity-status', agencyId],
    queryFn: async (): Promise<AgencyIdentityRow> => {
      const { data, error } = await supabase
        .from('agencies')
        .select('identity_submitted_at')
        .eq('id', agencyId as string)
        .single<AgencyIdentityRow>()
      if (error) throw error
      return data
    },
    enabled: gateMayApply,
    staleTime: 60_000,
  })

  const status = resolveIdentityGateStatus({
    authLoading,
    profile: profile ? { role: profile.role, agency_id: profile.agency_id } : null,
    superAdminChecking: superAdmin.checking,
    superAdminAllowed: superAdmin.allowed,
    agencyStatusLoading,
    identitySubmittedAt: data?.identity_submitted_at,
  })

  return { status }
}
