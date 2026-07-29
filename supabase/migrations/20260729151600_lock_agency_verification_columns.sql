-- Étape 5, correctif revue (point 1, CRITIQUE) — les colonnes de verdict LAB de
-- agencies étaient ouvertes en écriture à authenticated par agencies_members_update
-- (20260527010000, « TODO RBAC : restreindre UPDATE aux rôles admin/manager... pour
-- l'instant la politique est ouverte à tout membre »), SANS restriction de colonne.
-- Vérifié en conditions réelles : un agent simple, membre de son agence, se pose
-- lui-même verification_status='validated' via un appel PostgREST direct, puis
-- franchit sans obstacle les deux gardes serveur (kyc-screening, sign-document) qui
-- lisent EXACTEMENT cette colonne (supabase/functions/_shared/agency-lab-guard.ts).
-- Le garde lisait un fait que le gardé contrôlait — tout le dispositif était du
-- théâtre.
--
-- Colonnes protégées :
--   - verification_status         (le verdict lui-même)
--   - verification_score          (cache calculé, lu par la file de revue)
--   - verified_at                 (horodatage de la dernière conclusion positive)
--   - identity_submitted_at       (le fait « soumis », lu par CE garde ET par le
--                                   gate d'onboarding, useIdentityGate.ts)
--   - verification_sweep_attempts (compteur du filet de rattrapage, 20260728150000 —
--                                   une agence pourrait sinon se remettre à 0 pour se
--                                   faire ré-essayer indéfiniment, ou se poster au
--                                   plafond pour forcer son propre passage en
--                                   manual_review)
--
-- Toutes les écritures légitimes passent déjà par des fonctions SECURITY DEFINER,
-- toutes propriété de postgres (vérifié en base, docker exec psql,
-- pg_get_userbyid(proowner), avant d'écrire cette migration) :
--   - submit_agency_identity / submit_agency_identity_id_document
--     (20260728108000 / 110000)                          -> identity_submitted_at
--   - recompute_agency_verification (20260728130000)     -> les trois colonnes de
--                                                            verdict
--   - sweep_pending_agency_verifications (20260728150000) -> verification_sweep_attempts
--                                                            (+ verification_status à
--                                                            l'épuisement)
--   - admin_validate_agency_review / admin_reject_agency_review (20260728160000)
--                                                          -> verification_status,
--                                                             verified_at
-- À l'INTÉRIEUR de chacune, current_user devient le propriétaire de la fonction
-- (postgres), jamais authenticated — confirmé empiriquement (RPC de debug jetable,
-- appelée via une vraie session authenticated, current_user = 'postgres' à
-- l'intérieur d'un SECURITY DEFINER appartenant à postgres). Aucune des deux défenses
-- ci-dessous ne les affecte.
--
-- Deux défenses INDÉPENDANTES, jamais une seule :
--
--   1. REVOKE colonne par colonne sur authenticated — l'ACL Postgres ferme la porte
--      AVANT même que la ligne ne soit atteinte (« permission denied for column »,
--      à la préparation de la requête). Ne dépend d'aucune logique applicative.
--   2. Un trigger BEFORE UPDATE, qui referme la même porte même si la GRANT ci-dessus
--      régressait un jour (ex. un futur `GRANT UPDATE ON agencies TO authenticated`
--      sans liste de colonnes, qui redonnerait tout en un coup — précédent réel sur
--      CETTE table, 20260527010000). Bloque précisément authenticated (current_user,
--      qui vaut le rôle de connexion pour un appel direct — confirmé empiriquement
--      'authenticated' pour une session utilisateur, jamais le propriétaire de
--      fonction d'un appel SECURITY DEFINER) — jamais service_role : les fixtures des
--      specs existantes (agency-review-queue.spec.ts, agency-verification-engine.spec.ts,
--      agency-verification-run.spec.ts, agency-kyb-verification.spec.ts,
--      agency-lab-guard.spec.ts) posent leur état de départ en écrivant directement
--      ces colonnes via serviceRoleClient() — hors périmètre de ce correctif, conforme
--      à la consigne : « révoque l'écriture des colonnes de vérification au rôle
--      authenticated » (rôle nommément désigné).
--
-- Portée volontairement limitée à UPDATE (pas SELECT) : lire verification_status
-- depuis l'agence elle-même est légitime et voulu — c'est justement ce que lit
-- useLabGuard.ts pour afficher le bandeau/l'écran bloqué. Seule l'ÉCRITURE est le trou.
--
-- Idempotente : REVOKE/GRANT rejouables, CREATE OR REPLACE FUNCTION, DROP TRIGGER IF
-- EXISTS avant CREATE.

begin;

-- ─── 1. REVOKE colonne par colonne (défense n°1) ────────────────────────────────
revoke update (
  verification_status,
  verification_score,
  verified_at,
  identity_submitted_at,
  verification_sweep_attempts
) on public.agencies from authenticated;

-- ─── 2. Trigger BEFORE UPDATE (défense n°2, indépendante) ───────────────────────
create or replace function public.agencies_guard_verification_columns()
returns trigger
language plpgsql
set search_path to 'public'
as $$
begin
  if (
    new.verification_status is distinct from old.verification_status
    or new.verification_score is distinct from old.verification_score
    or new.verified_at is distinct from old.verified_at
    or new.identity_submitted_at is distinct from old.identity_submitted_at
    or new.verification_sweep_attempts is distinct from old.verification_sweep_attempts
  ) and current_user = 'authenticated' then
    raise exception
      'forbidden: verification columns are read-only outside SECURITY DEFINER verification functions'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

comment on function public.agencies_guard_verification_columns() is
  'Deuxième défense (revue étape 5/tâche 4, point 1 CRITIQUE), indépendante du REVOKE colonne ci-dessus : bloque toute écriture de verification_status/verification_score/verified_at/identity_submitted_at/verification_sweep_attempts effectuée avec current_user=authenticated (appel direct — jamais un appel SECURITY DEFINER : à l''intérieur de submit_agency_identity/recompute_agency_verification/sweep_pending_agency_verifications/admin_validate_agency_review/admin_reject_agency_review, current_user devient postgres, le propriétaire de ces fonctions). Ne bloque pas service_role, utilisé par les fixtures de test existantes pour poser leur état de départ — hors périmètre (brief : "authenticated" nommément).';

drop trigger if exists agencies_guard_verification_columns_trg on public.agencies;
create trigger agencies_guard_verification_columns_trg
  before update on public.agencies
  for each row
  execute function public.agencies_guard_verification_columns();

commit;
