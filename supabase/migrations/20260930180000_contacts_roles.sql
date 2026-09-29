-- Les rôles multiples d'un contact (étape 3, 22.09.2026).
--
-- `contacts.roles` fait foi ; `contacts.type` en dérive et reste écrit, parce que 103
-- emplacements le lisent — dont trois politiques RLS et quatre fonctions SQL. Le déclencheur
-- tient les deux d'accord DANS LES DEUX SENS : écrire `roles` recalcule `type` ; écrire `type`
-- seul (l'IA d'extraction, un import, `create_lead_with_optional_deal`) AJOUTE le rôle
-- correspondant sans effacer les rôles de réseau.
--
-- ⚠ Rejouable : le date-guard de deploy.yml réapplique une migration du jour à chaque push.
set local lock_timeout = '5s';

alter table public.contacts add column if not exists roles text[] not null default '{}';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'contacts_roles_valides') then
    alter table public.contacts add constraint contacts_roles_valides check (
      roles <@ array['buyer','seller','tenant','landlord','investor',
                     'family_office','referrer','private_banker','lawyer','trustee','broker','architect']::text[]
    );
  end if;
end $$;

-- Le filtre par rôle de la liste Contacts : `roles && array['private_banker']`.
create index if not exists idx_contacts_roles on public.contacts using gin (roles);

comment on column public.contacts.roles is
  'Rôles multiples (étape 3). Source de vérité ; contacts.type en dérive par trigger. Vide = lead.';

-- Dédoublonne et ORDONNE selon le vocabulaire. Un rôle inconnu en sort : le déclencheur
-- compare les longueurs et refuse, plutôt que de le laisser tomber en silence.
create or replace function public.contacts_roles_ordonnes(p_roles text[])
returns text[]
language sql
immutable
parallel safe
set search_path = ''
as $$
  select coalesce(array_agg(v.role order by v.ord), '{}')
  from (values
    ('buyer', 1), ('seller', 2), ('tenant', 3), ('landlord', 4), ('investor', 5),
    ('family_office', 6), ('referrer', 7), ('private_banker', 8), ('lawyer', 9),
    ('trustee', 10), ('broker', 11), ('architect', 12)
  ) as v(role, ord)
  where v.role = any(coalesce(p_roles, '{}'));
$$;

create or replace function public.contacts_roles_sync()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_roles text[];
  v_roles_change boolean;
  v_type_change boolean;
begin
  v_roles_change := case tg_op
    when 'INSERT' then coalesce(array_length(new.roles, 1), 0) > 0
    else new.roles is distinct from old.roles
  end;
  v_type_change := case tg_op
    when 'INSERT' then new.type is distinct from 'lead'
    else new.type is distinct from old.type
  end;

  -- `type` écrit SEUL : son rôle s'ajoute. `type` ne parle pas des rôles de réseau,
  -- il ne peut donc pas en retirer un.
  if v_type_change and not v_roles_change then
    new.roles := coalesce(new.roles, '{}') || case new.type
      when 'both' then array['buyer', 'seller']
      when 'lead' then '{}'::text[]
      else array[new.type]
    end;
  end if;

  v_roles := public.contacts_roles_ordonnes(new.roles);
  if coalesce(array_length(v_roles, 1), 0)
     <> coalesce(array_length(array(select distinct unnest(coalesce(new.roles, '{}'))), 1), 0) then
    raise exception 'rôle de contact inconnu : %', new.roles using errcode = '23514';
  end if;
  new.roles := v_roles;

  -- `type` dérive TOUJOURS des rôles : une seule vérité.
  new.type := case
    when 'buyer' = any(v_roles) and ('seller' = any(v_roles) or 'landlord' = any(v_roles)) then 'both'
    when 'buyer' = any(v_roles) then 'buyer'
    when 'seller' = any(v_roles) then 'seller'
    when 'tenant' = any(v_roles) then 'tenant'
    when 'landlord' = any(v_roles) then 'landlord'
    when 'investor' = any(v_roles) then 'investor'
    else 'lead'
  end;
  return new;
end $$;

drop trigger if exists trg_contacts_roles_sync on public.contacts;
create trigger trg_contacts_roles_sync
  before insert or update of roles, type on public.contacts
  for each row execute function public.contacts_roles_sync();

-- Remplissage initial : chaque type devient son ou ses rôles. `lead` n'en donne aucun.
update public.contacts
set roles = case type
  when 'both' then array['buyer', 'seller']
  when 'lead' then '{}'::text[]
  else array[type]
end
where roles = '{}' and type <> 'lead';
