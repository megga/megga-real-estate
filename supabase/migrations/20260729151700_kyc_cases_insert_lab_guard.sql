-- Étape 5, correctif revue (point 2, CRITIQUE) — ouvrir un dossier KYC client
-- n'était gardé QUE côté navigateur (KycLabGuard.tsx bloque la route
-- /dashboard/kyc) et côté edge function (kyc-screening, via
-- supabase/functions/_shared/agency-lab-guard.ts) — jamais côté table. La policy
-- kyc_cases_insert (baseline) ne vérifie que l'isolation inter-agences
-- (agency_id = get_my_agency_id()), rien sur l'état de vérification de l'agence.
--
-- Vérifié en conditions réelles : un agent d'une agence jamais soumise ouvre un
-- dossier KYC par appel PostgREST direct (INSERT sur kyc_cases, en contournant le
-- routeur React) — l'INSERT réussit, le déclencheur seed_kyc_lba_checks sème ses
-- vérifications LBA, activity_events journalise l'ouverture. « Ouvrir un dossier KYC
-- client » est précisément l'action que ce garde doit empêcher (docs/superpowers/sdd,
-- task-4-brief.md : « garde plein ... Aucune agence ne peut ouvrir un dossier KYC
-- client ni lancer une signature avant qu'un humain ait validé son identité »).
--
-- is_agency_lab_cleared(uuid) : même liste BLANCHE que isAgencyLabCleared côté
-- client (src/hooks/useLabGuard.ts) et côté edge (supabase/functions/_shared/
-- agency-lab-guard.ts) — dupliquée ici en SQL pour la même raison que ces deux-là se
-- dupliquent déjà entre elles : aucun import cross-runtime possible (CLAUDE.md §
-- Structure des dossiers), et le SQL est un troisième runtime distinct. La source
-- canonique des valeurs reste la contrainte CHECK agencies_verification_status_chk
-- (migration 20260728107000) — c'est elle qu'il faut modifier si une nouvelle valeur
-- de statut apparaît un jour, pas cette fonction. SECURITY DEFINER + STABLE, même
-- style que get_my_agency_id()/get_user_agency_id() (baseline) : la ligne agencies
-- lue est de toute façon déjà celle de l'appelant (agency_id = get_my_agency_id() est
-- ANDé juste à côté dans la policy), mais SECURITY DEFINER évite toute dépendance
-- implicite à la policy SELECT d'agencies si l'ordre d'évaluation ou le périmètre de
-- cette policy changent un jour.
--
-- coalesce(..., false) : une agence introuvable (jamais censé arriver, agency_id
-- vient de get_my_agency_id()) fail-close plutôt que NULL qui rendrait le AND
-- indéterminé — même discipline fail-closed que le reste du chantier.
--
-- Idempotente : CREATE OR REPLACE FUNCTION, DROP POLICY IF EXISTS avant CREATE.

begin;

create or replace function public.is_agency_lab_cleared(p_agency_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select coalesce(
    (select a.verification_status in ('auto_validated', 'validated')
       from public.agencies a
      where a.id = p_agency_id),
    false
  )
$$;

comment on function public.is_agency_lab_cleared(uuid) is
  'Garde LAB plein (revue étape 5/tâche 4, point 2 CRITIQUE) : true si verification_status IN (auto_validated, validated) pour cette agence. Liste BLANCHE, jamais liste noire — toute valeur absente, inconnue ou future reste bloquée par construction (objectif 2 du Document Maître). Duplique volontairement isAgencyLabCleared (src/hooks/useLabGuard.ts, supabase/functions/_shared/agency-lab-guard.ts) : troisième runtime (SQL/RLS), aucun import cross-runtime possible. Consommée par kyc_cases_insert (WITH CHECK) — c''est ce contrôle-ci, pas la route React ni l''edge function kyc-screening, qui protège réellement contre un INSERT PostgREST direct.';

revoke all on function public.is_agency_lab_cleared(uuid) from public, anon;
grant execute on function public.is_agency_lab_cleared(uuid) to authenticated, service_role;

drop policy if exists "kyc_cases_insert" on public.kyc_cases;
create policy "kyc_cases_insert" on public.kyc_cases
  for insert
  to authenticated
  with check (
    agency_id = public.get_my_agency_id()
    and public.is_agency_lab_cleared(agency_id)
  );

commit;
