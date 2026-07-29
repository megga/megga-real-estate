-- Étape 3 du chantier KYB, tâche 1 — bareme reglable du moteur de verification.
--
-- Patron app_config (jumeau de get_property_score_config / get_contact_score_config,
-- 20260616190000 / 20260616170000) : une cle JSON versionnee dans app_config, lue par
-- un wrapper SECURITY DEFINER plutot que d'exposer la table brute au client.
--
-- Deux seuils pilotent le moteur de la tache 2 (recompute_agency_verification, pas
-- encore ecrit) — voir docs/agency-kyb-verification.md §2 :
--   auto_validate_min   -- score >= ce seuil (et aucun veto) -> auto-validation
--   review_priority_min -- score sous ce seuil -> revue humaine PRIORITAIRE (la
--                           priorite vient du tri de la file, pas d'une colonne dediee)
--
-- GRANTS — divergence assumee vs get_property_score_config (qui autorise
-- authenticated) : ces seuils pilotent l'auto-validation KYB/LAB. Les exposer a un
-- dirigeant en cours de verification l'inviterait a calibrer sa saisie pour juste
-- franchir le seuil — meme raisonnement que verification_check_config (20260728103000),
-- deja verrouille a is_super_admin() plutot qu'a authenticated. Contrainte globale du
-- plan etape 3 (docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-3.md) :
-- service_role SEUL pour l'instant, a elargir plus tard si la console admin appelle la
-- RPC directement — plutot sous-accorder que l'inverse.
--
-- Idempotente : INSERT … ON CONFLICT, CREATE OR REPLACE FUNCTION, REVOKE/GRANT
-- rejouables sans effet de bord.

-- ─── (1) TUNABLE app_config 'agency_verification_v1' ───────────────────────────────
-- value TEXT -> chaine JSON, lue en ::jsonb comme les jumeaux. Reglable en DB sans
-- redeploy.
insert into public.app_config (key, value)
values (
  'agency_verification_v1',
  '{"auto_validate_min":0.85,"review_priority_min":0.5}'
)
on conflict (key) do update set value = excluded.value;

-- ─── (2) RPC de lecture du bareme ───────────────────────────────────────────────────
-- N'expose QUE ces deux cles — construites explicitement via jsonb_build_object,
-- jamais un passthrough de la ligne brute ni de app_config en entier : la securite
-- tient aux GRANTs ci-dessous, pas a une hypothese sur la facon dont l'appelant s'en
-- sert. Defauts surs en dur (0.85 / 0.5) si la cle est absente (environnement frais,
-- ligne supprimee) : le moteur de la tache 2 ne doit jamais recevoir null.
create or replace function public.get_agency_verification_config()
returns jsonb
language sql
stable
security definer
set search_path to 'public'
as $$
  select jsonb_build_object(
    'auto_validate_min',
    coalesce((cfg.value::jsonb ->> 'auto_validate_min')::numeric, 0.85),
    'review_priority_min',
    coalesce((cfg.value::jsonb ->> 'review_priority_min')::numeric, 0.5)
  )
  from (select 1) as one
  left join public.app_config cfg on cfg.key = 'agency_verification_v1';
$$;

comment on function public.get_agency_verification_config() is
  'Bareme du moteur de verification KYB (etape 3) : auto_validate_min (score >= seuil et aucun veto -> auto-validation) et review_priority_min (score sous seuil -> revue prioritaire). N''expose que ces deux cles, jamais tout app_config. service_role uniquement : des seuils lisibles inviteraient a calibrer une saisie pour les franchir.';

revoke all on function public.get_agency_verification_config() from public, anon, authenticated;
grant execute on function public.get_agency_verification_config() to service_role;
