# Patch 06 — Verrouiller les fonctions `SECURITY DEFINER` exposées à `anon` (S2, S10, S17)

**Type** : migration SQL. Nouveau fichier `supabase/migrations/<ts>_secdef_grants_lockdown.sql`.

## Problème
53 fonctions `SECURITY DEFINER` sont exécutables par `anon` (grant `PUBLIC` par défaut). Parmi les **appelables** :
- **S2** `get_agency_stats`/`get_onboarding_milestones` → fuite agrégée cross-agence (anon).
- **S10** `check_email_exists` → énumération de comptes (anon).
- **S17** RPC de maintenance/cron (`mark_stale_kyc_dossiers`, `unpublish_expired_mandates`, `realadvisor_probe_*`,
  `realadvisor_sweep_enum`, `purge_expired_import_raw_text`, `cleanup_orphan_property_drafts`, `accept_followup_suggestion`).

## Migration proposée

### (a) RPC de maintenance/cron → service_role uniquement
```sql
do $$
declare fn text;
begin
  foreach fn in array array[
    'mark_stale_kyc_dossiers()',
    'unpublish_expired_mandates()',
    'purge_expired_import_raw_text()',
    'cleanup_orphan_property_drafts()',
    'accept_followup_suggestion(uuid)',
    'realadvisor_health_check()',
    'realadvisor_probe_fire(text,integer)',
    'realadvisor_probe_sweep(text,integer,integer,integer,numeric,boolean)',
    'realadvisor_probe_bookkeep(text[],text[],integer)',
    'realadvisor_probe_collect()',
    'realadvisor_sweep_enum(text,integer,integer,numeric,boolean)'
  ] loop
    execute format('revoke execute on function public.%s from anon, authenticated, public;', fn);
  end loop;
end $$;
```

### (b) S2 — garde de rôle interne + révocation anon (réécriture en plpgsql)
> Les originales sont `LANGUAGE sql` : on les réécrit en `plpgsql` pour pouvoir refuser un appelant non super-admin
> (défense en profondeur au-delà du simple grant). Le corps SELECT est inchangé.
```sql
create or replace function public.get_agency_stats(agency_ids uuid[])
returns table(agency_id uuid, agent_count bigint, property_count bigint, transaction_count bigint)
language plpgsql stable security definer set search_path to 'public','pg_temp'
as $$
begin
  if not public.is_super_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query
    select a.id,
           coalesce(p.cnt,0), coalesce(pr.cnt,0), coalesce(t.cnt,0)
    from unnest(agency_ids) as a(id)
    left join lateral (select count(*) cnt from public.profiles     where agency_id=a.id) p  on true
    left join lateral (select count(*) cnt from public.properties   where agency_id=a.id and status='active') pr on true
    left join lateral (select count(*) cnt from public.transactions where agency_id=a.id and status='active') t  on true
    where a.id = any(agency_ids);
end $$;

-- get_onboarding_milestones : même traitement (ajouter la garde is_super_admin en tête, corps EXISTS inchangé).

revoke execute on function public.get_agency_stats(uuid[])        from anon, public;
revoke execute on function public.get_onboarding_milestones(uuid[]) from anon, public;
-- restent exécutables par authenticated MAIS la garde interne bloque les non super-admin.
```

### (c) S10 — `check_email_exists` : couper l'énumération anonyme
`check_email_exists` sert au signup (avant auth) → l'énumération brute est le risque. Options (à trancher par Julien) :
1. **Retirer l'appel front** et laisser Supabase Auth gérer le « email déjà utilisé » (message générique), puis
   `revoke execute on function public.check_email_exists(text) from anon, public;`.
2. La conserver mais **derrière captcha** (déjà activé) + rate-limit, et renvoyer un message générique côté UI.
```sql
-- Option 1 (recommandée si l'UX le permet) :
revoke execute on function public.check_email_exists(text) from anon, public;
```

## Note transverse
Ajouter au pipeline un garde-fou : toute **nouvelle** fonction `SECURITY DEFINER` doit inclure un
`REVOKE EXECUTE ... FROM public;` explicite (lint SQL / revue). Cf. cause racine R0-B.

## Test
- Appel anonyme de `get_agency_stats(array[...])` → refusé (avant : renvoyait les compteurs).
- Appel `authenticated` non super-admin → `forbidden`.
- Appel anonyme d'un `realadvisor_probe_*`/`mark_stale_kyc_dossiers` → refusé.
- Vérifier que le dashboard super-admin (`useAdminAgencies`) fonctionne toujours (appelant = super-admin).
