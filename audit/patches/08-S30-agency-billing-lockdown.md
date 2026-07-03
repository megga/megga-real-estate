# Patch 08 — Restreindre la modification du plan/facturation d'agence (S30)

**Type** : migration SQL. Nouveau fichier `supabase/migrations/<ts>_agency_billing_guard.sql`.

## Problème (vérifié live)
La policy `agencies_members_update` = `USING/ WITH CHECK (id = get_user_agency_id())` autorise **tout membre**
(y compris `agent`/`assistant`) à modifier **n'importe quelle colonne** de sa ligne `agencies`, dont `plan`,
`billing`, `stripe_customer_id`. Un membre peu privilégié peut donc changer le plan de facturation (fraude/abus).

## Correctif — trigger de garde sur les colonnes sensibles
Aligné sur le pattern `tg_profiles_guard_role_agency` : un `BEFORE UPDATE` qui refuse la modification des colonnes
billing par un appelant non-admin.
```sql
create or replace function public.tg_agencies_guard_billing()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare v_role text;
begin
  -- service_role / postgres (SECURITY DEFINER légitimes : Stripe webhook, admin) ne sont pas 'authenticated'
  if current_user in ('authenticated', 'anon') then
    if (new.plan is distinct from old.plan)
       or (new.billing is distinct from old.billing)
       or (new.stripe_customer_id is distinct from old.stripe_customer_id)
    then
      select role into v_role from public.profiles where id = auth.uid();
      if coalesce(v_role, '') not in ('admin','manager') then
        raise exception 'billing columns are admin-only' using errcode = '42501';
      end if;
    end if;
  end if;
  return new;
end $$;

drop trigger if exists trg_agencies_guard_billing on public.agencies;
create trigger trg_agencies_guard_billing
  before update on public.agencies
  for each row execute function public.tg_agencies_guard_billing();
```
> `plan`/`billing` restent modifiables par le **Stripe webhook** (service_role) et par un `admin`/`manager`.
> Ajuster la liste de rôles autorisés selon la politique produit (owner-only ?).

## Alternative (grants colonne)
Variante sans trigger : `revoke update (plan, billing, stripe_customer_id) on public.agencies from authenticated;`
puis exposer une RPC `set_agency_plan(...)` `SECURITY DEFINER` gardée par rôle. Le trigger est plus simple à
appliquer sans changer les chemins d'écriture existants (`savePlanOnAgency` continue de marcher pour un admin).

## Test
- `agent` tentant `update agencies set plan=... where id=<sa propre agence>` → `billing columns are admin-only`.
- `admin` de l'agence → OK.
- Simuler l'update du Stripe webhook (service_role) → OK (non bloqué).
