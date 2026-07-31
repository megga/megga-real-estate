-- Gel des trois colonnes de facturation de `agencies` hors des deux chemins légitimes.
--
-- CONSTAT (docs/console-admin/INVENTAIRE_SOCLE.md §6, bloquant pré-lancement 0.4) :
-- la branche KYB a fermé la formulation d'origine du finding S30 — depuis
-- 20260731170000, la policy `agencies_members_update` exige `is_agency_admin()`, donc un
-- agent ou un assistant ne peut plus écrire AUCUNE colonne d'agencies. Mais le trou n'est
-- pas refermé pour autant : aucun trigger de garde n'existe sur la facturation, et le
-- GRANT UPDATE au niveau TABLE reste entier. Un compte `admin` ou `manager` d'agence peut
-- toujours écrire `plan`, `billing` et `stripe_customer_id` sur sa propre ligne par appel
-- PostgREST direct — sans garde super-admin, et SANS AUCUNE TRACE (le trigger d'audit
-- `agencies_audit_identity_columns` ne couvre que les 9 colonnes d'identité et d'adresse).
--
-- Ces trois colonnes n'ont que deux écrivains légitimes, tous deux hors du rôle
-- `authenticated` :
--   * le webhook Stripe et `stripe-checkout`, qui écrivent en service_role ;
--   * `admin_set_agency_plan(uuid, text, text, text)`, SECURITY DEFINER appartenant à
--     `postgres`, gardée par `is_super_admin()` et auditée (`subscription_changed`).
-- Le trigger ci-dessous ne gêne donc ni l'un ni l'autre : dans les deux cas `current_user`
-- vaut `service_role` ou `postgres`, jamais `authenticated`.
--
-- POURQUOI PAS LE PATCH 08 TEL QUEL. Le patch d'origine (audit/patches/08) autorise
-- `admin|manager` : c'est exactement le trou mesuré, il laisserait un dirigeant se passer
-- lui-même en plan supérieur et fausser le MRR de l'écran Plans. Ce trigger n'a donc
-- aucune liste blanche de rôles. Et sa variante « REVOKE UPDATE par colonne » n'est pas
-- utilisable ici : elle est démontrée inopérante sur cette table même
-- (`has_column_privilege('authenticated','agencies','verification_status','UPDATE')` vaut
-- toujours `true` malgré le REVOKE de 20260729151600), parce qu'un REVOKE de privilège
-- colonne ne retire pas un GRANT accordé au niveau table.
--
-- GABARIT : `agencies_guard_verification_columns()` (20260729151600), même forme, même
-- code d'erreur. Une différence assumée : on couvre aussi `anon`. Le rôle anonyme détient
-- un GRANT UPDATE hérité du baseline Supabase et n'est aujourd'hui arrêté que par la RLS ;
-- fermer les deux rôles d'un coup évite de faire dépendre trois colonnes de facturation
-- d'une seule ligne de défense.

CREATE OR REPLACE FUNCTION public.agencies_guard_billing_columns()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
begin
  if (
    new.plan is distinct from old.plan
    or new.billing is distinct from old.billing
    or new.stripe_customer_id is distinct from old.stripe_customer_id
  ) and current_user in ('authenticated', 'anon') then
    raise exception
      'forbidden: billing columns are read-only outside Stripe (service_role) and admin_set_agency_plan'
      using errcode = '42501';
  end if;
  return new;
end;
$function$;

COMMENT ON FUNCTION public.agencies_guard_billing_columns() IS
  'Refuse toute écriture de agencies.plan / billing / stripe_customer_id sous authenticated ou anon. Deux écrivains légitimes : service_role (Stripe) et admin_set_agency_plan (SECURITY DEFINER, owner postgres) — 20260731200000, bloquant pré-lancement 0.4.';

DROP TRIGGER IF EXISTS agencies_guard_billing_columns_trg ON public.agencies;
CREATE TRIGGER agencies_guard_billing_columns_trg
  BEFORE UPDATE ON public.agencies
  FOR EACH ROW EXECUTE FUNCTION public.agencies_guard_billing_columns();
