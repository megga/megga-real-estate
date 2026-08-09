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
 * message errone. Le garde client ne doit donc rendre AUCUN verdict tant qu'il ne
 * SAIT pas — d'ou le champ agencyStatusError, verifie AVANT le fail-closed
 * "jamais soumis" ci-dessous.
 *
 * Ce meme correctif renvoyait d'abord 'loading', ce qui reglait le faux verdict mais
 * en creait un autre defaut : une lecture qui echoue DURABLEMENT (colonne absente,
 * RLS, agency_id malforme, reseau coupe) laissait KycLabGuard sur son spinner
 * indefiniment — page muette, sans explication ni issue, pire qu'une porte fermee
 * avec un motif lisible. D'ou le quatrieme etat 'unavailable' : il ne dit rien du
 * dossier de l'agence (ni bloque, ni clear — le contenu KYC reste cache), il dit
 * seulement que la LECTURE a echoue, ce qui est vrai et actionnable. La discipline
 * du correctif est intacte : 'unavailable' n'est jamais un 'blocked_*', le bandeau
 * global reste muet dessus, et seul l'ecran plein en parle.
 *
 * Carve-out DEV_BYPASS (dev/E2E uniquement, cf. plus bas) : l'agence du profil mock
 * n'existe dans aucune base, donc la lecture ci-dessous ne peut RIEN dire d'elle et
 * ce garde remplacait chaque page KYC par son ecran d'echec — ce qui a rendu creuse
 * toute la couverture E2E de /dashboard/kyc (constat par mutation, 02.08.2026). Sous
 * bypass on lit donc DEV_BYPASS_AGENCY au lieu du reseau ; la REGLE, elle, tourne
 * a l'identique.
 */
import { useQuery } from '@tanstack/react-query'
import { useAuth, DEV_BYPASS_AUTH, DEV_BYPASS_AGENCY } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types/auth'

/** Cle de la lecture agence de ce garde (prefixe : l'agencyId suit). Exportee pour
 *  que l'ecran « statut indisponible » puisse relancer la lecture sans dupliquer
 *  la chaine ni redecouvrir l'agencyId. */
export const LAB_GUARD_STATUS_QUERY_KEY = 'agency-lab-guard-status'

export type LabGuardStatus =
  | 'loading'
  /** Lecture du statut en echec : on ne sait rien du dossier, on le DIT (cf. en-tete).
   *  Ni un verdict ni un feu vert — le contenu KYC reste cache. */
  | 'unavailable'
  | 'clear'
  | 'blocked_not_submitted'
  | 'blocked_pending_review'
  | 'blocked_rejected'
  /** Un relecteur a renvoye le dossier pour correction (etape 7, tache 5). Distinct de
   *  'blocked_not_submitted' bien que identity_submitted_at soit nul dans les deux cas :
   *  dire « vous n'avez rien soumis » a quelqu'un qui a soumis et dont on attend une
   *  correction precise serait faux, et le renverrait au wizard sans savoir quoi reprendre.
   *  Le MOTIF de la demande voyage par e-mail (etape 7, tache 6) et vit dans
   *  activity_events.metadata ; l'afficher dans le bandeau demanderait une lecture de plus,
   *  laissee volontairement de cote ici. */
  | 'blocked_correction_requested'

/**
 * Segment i18n de chaque statut bloque, partage par le bandeau et l'ecran plein
 * (`labGuard.banner.<segment>.*` et `labGuard.block.<segment>.*`).
 *
 * Une table plutot que des chaines de ternaires dans chaque composant : le 4e cas bloque
 * (etape 7, tache 5) aurait porte la chaine a quatre niveaux sur trois libelles, dans deux
 * fichiers. Ici un statut de plus est une ligne de plus, et le typage `Record` sur un
 * `Exclude` du type de statut REFUSE d'oublier un cas -- c'est le compilateur qui tient la
 * liste a jour, pas la relecture.
 */
export const LAB_GUARD_LABEL_KEY: Record<
  Exclude<LabGuardStatus, 'loading' | 'clear' | 'unavailable'>,
  string
> = {
  blocked_not_submitted: 'notSubmitted',
  blocked_pending_review: 'pendingReview',
  blocked_rejected: 'rejected',
  blocked_correction_requested: 'correctionRequested',
}

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
   *  correctif revue point 3 dans l'en-tete du fichier. Donne 'unavailable', pas
   *  'loading' : une lecture en echec est un etat TERMINAL (React Query a epuise ses
   *  reprises), pas une attente, et un spinner sans fin ne dit rien a personne. */
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

  // Correctif revue (point 3, important) : une lecture en echec ne rend AUCUN verdict.
  // Le fail-closed reste juste cote SERVEUR (agency-lab-guard.ts) ; cote client,
  // afficher 'blocked_not_submitted' sur une simple erreur reseau/RLS affirmerait une
  // chose fausse a une agence par ailleurs deja validee (verifie en conditions
  // reelles). Verifiee AVANT le fail-closed "jamais soumis" ci-dessous : une lecture
  // en echec ne doit jamais etre confondue avec une preuve, positive ou negative.
  //
  // 'unavailable' et non 'loading' : l'echec est terminal (React Query n'essaiera plus
  // rien de lui-meme), donc l'annoncer comme une attente condamnait la page au spinner
  // eternel. 'unavailable' garde le contenu KYC cache — il n'ouvre rien — mais permet a
  // l'ecran plein de dire ce qui se passe et d'offrir une reprise.
  if (agencyStatusError) return 'unavailable'

  // Correction demandee (etape 7, tache 5) : teste AVANT le fail-closed « jamais soumis »
  // ci-dessous, et cet ordre est le fond du cas. admin_request_agency_correction remet
  // identity_submitted_at a NULL -- c'est ainsi qu'elle rouvre le gate et degele la saisie --
  // donc la branche suivante rendrait 'blocked_not_submitted' et l'ecran dirait « vous n'avez
  // rien soumis » a une agence qui a soumis et dont on attend une correction nommee. Reste
  // fail-closed : ce statut bloque, comme tout ce qui n'est ni auto_validated ni validated.
  if (verificationStatus === 'correction_requested') return 'blocked_correction_requested'

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
    queryKey: [LAB_GUARD_STATUS_QUERY_KEY, agencyId],
    queryFn: async (): Promise<AgencyLabGuardRow> => {
      const { data, error } = await supabase
        .from('agencies')
        .select('verification_status, identity_submitted_at')
        .eq('id', agencyId as string)
        .single<AgencyLabGuardRow>()
      if (error) throw error
      return data
    },
    // Bypass dev (playwright.config.ts) : l'agence du profil mock n'existe dans
    // aucune base — la lecture repondrait 400 et ce garde rendrait « statut
    // illisible » a la place de CHAQUE page KYC. On lit donc la fiche du mock
    // (DEV_BYPASS_AGENCY) plutot que le reseau. Inoperant en prod, ou
    // DEV_BYPASS_AUTH est faux par construction (import.meta.env.DEV).
    enabled: !authLoading && !!agencyId && !DEV_BYPASS_AUTH,
    staleTime: 60_000,
  })

  // La regle ci-dessous s'applique a la fiche du mock EXACTEMENT comme a une ligne
  // lue en base : `resolveLabGuardStatus` tranche, le bypass ne court-circuite donc
  // pas le garde, il lui donne seulement une agence a juger.
  const row = DEV_BYPASS_AUTH ? DEV_BYPASS_AGENCY : data

  return resolveLabGuardStatus({
    authLoading,
    agencyId,
    // Sous bypass la requete est desactivee : ni attente, ni echec a signaler.
    agencyStatusLoading: !DEV_BYPASS_AUTH && agencyStatusLoading,
    // Correctif revue (point 3, important) : une lecture en echec (isError) donne
    // 'unavailable' dans resolveLabGuardStatus, jamais un blocage — cf. l'en-tete du
    // fichier et son propre commentaire.
    agencyStatusError: !DEV_BYPASS_AUTH && agencyStatusError,
    identitySubmittedAt: row?.identity_submitted_at,
    verificationStatus: row?.verification_status,
  })
}
