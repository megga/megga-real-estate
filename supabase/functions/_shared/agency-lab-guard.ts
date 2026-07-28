// Garde LAB plein (etape 5, tache 4) — volet serveur. Verrouille kyc-screening et
// sign-document (action 'create') tant que l'agence appelante n'a pas ete validee
// par le moteur (recompute_agency_verification -> 'auto_validated') ou par un
// humain dans la file de revue (admin_validate_agency_review -> 'validated').
//
// Aucune exemption, aucun interrupteur : decision produit de Thomas, prise en
// connaissance de la consequence que TOUTE agence passe par la file aujourd'hui
// (docs/agency-kyb-handoff.md §7bis — deux des quatre vetos d'entite n'ont aucun
// connecteur). Voir .superpowers/sdd/task-4-brief.md.
//
// C'est ce controle-ci qui protege reellement : un blocage seulement dans
// l'interface se contourne en appelant l'edge function directement. Le cote
// client (src/hooks/useLabGuard.ts, src/components/layout/LabGuardBanner.tsx,
// KycLabGuard.tsx) evite seulement de proposer une action vouee a l'echec.
//
// Duplique volontairement isAgencyLabCleared de src/hooks/useLabGuard.ts plutot
// que de le reutiliser : jamais d'import cross-runtime entre src/ (navigateur,
// bundle Vite) et supabase/functions/ (Deno), cf. CLAUDE.md § Structure des
// dossiers. La liste canonique des valeurs vit dans la contrainte CHECK
// agencies_verification_status_chk (migration
// 20260728107000_agencies_identity_submission.sql) — c'est elle qu'il faut
// modifier si une nouvelle valeur de statut apparait un jour, pas ce fichier.

import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/**
 * true si `verificationStatus` autorise les deux actions a risque (ouverture d'un
 * dossier KYC client, lancement d'une signature electronique). Liste BLANCHE,
 * jamais liste noire : toute valeur absente, inconnue ou future reste bloquee par
 * construction (coherent avec l'objectif 2 du Document Maitre — reduire le risque
 * LAB/KYC).
 */
export function isAgencyLabCleared(verificationStatus: string | null | undefined): boolean {
  return verificationStatus === 'auto_validated' || verificationStatus === 'validated'
}

/**
 * Lit agencies.verification_status pour `agencyId` et renvoie une Response 403
 * JSON si l'agence n'est pas cleared, ou `null` si l'appel peut continuer. A
 * appeler juste apres avoir resolu l'agence appelante (requireAgentAuth ou le
 * chemin service-role), AVANT toute autre logique metier ou verification de
 * configuration (ex. cle API d'un fournisseur tiers) : une agence bloquee n'a pas
 * a apprendre si la ressource visee existe ni si le service est correctement
 * configure.
 *
 * `supabase` doit etre un client service_role (celui deja utilise par l'appelant,
 * jamais un nouveau client anon) : cette lecture n'a pas a passer par RLS, au
 * meme titre que le reste de kyc-screening/sign-document.
 */
export async function requireAgencyLabCleared(
  supabase: SupabaseClient,
  agencyId: string,
  corsHeaders: Record<string, string>,
): Promise<Response | null> {
  const { data, error } = await supabase
    .from('agencies')
    .select('verification_status')
    .eq('id', agencyId)
    .single()

  // Lecture impossible (agence introuvable, panne reseau) : on ne SAIT pas si
  // l'agence est cleared. Fail-closed, meme posture que le cote client
  // (resolveLabGuardStatus traite une lecture en echec comme une absence de
  // preuve, jamais comme un laissez-passer).
  const verificationStatus: string | null | undefined = error || !data ? undefined : data.verification_status
  if (isAgencyLabCleared(verificationStatus)) return null

  return new Response(
    JSON.stringify({
      error: 'agency_not_verified',
      message: "Cette action est bloquee tant que l'identite de votre agence n'a pas ete validee par l'equipe MEGGA.",
      verification_status: verificationStatus ?? null,
    }),
    { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
}
