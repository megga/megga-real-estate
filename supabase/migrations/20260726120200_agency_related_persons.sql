-- Personnes liées à une agence (KYB) : signataires autorisés et ayants droit
-- économiques (UBO). Voir docs/agency-kyb-verification.md.
--
-- POURQUOI une table distincte de profiles : profiles = identité OPÉRATIONNELLE
-- (login CRM, rôle métier, agency_id). Ici c'est l'identité de CONFORMITÉ, qui peut
-- concerner quelqu'un qui ne se connectera jamais — un actionnaire à 40 % n'a aucune
-- raison d'avoir un compte. D'où profile_id nullable : lien opportuniste quand la
-- personne est aussi utilisateur, pas une dépendance.
--
-- POURQUOI les rôles dans une table séparée : dans une petite SA, le fondateur est
-- très souvent administrateur ET actionnaire majoritaire. Porter le rôle sur la
-- personne obligerait à dupliquer son identité (nom, date de naissance, pièce
-- d'identité) sur deux lignes → anomalie de mise à jour garantie le jour où l'une des
-- deux est corrigée et pas l'autre.
--
-- agency_person_roles ne porte PAS d'agency_id : il se déduit de related_person_id.
-- Le dénormaliser simplifierait les policies RLS mais introduirait une dépendance
-- transitive (3NF) — on paie donc une jointure dans les policies, délibérément.

-- ─── Helper de rôle ──────────────────────────────────────────────────────────
-- SECURITY DEFINER comme get_my_agency_id / is_super_admin : lire profiles depuis une
-- policy sans ce contournement déclencherait la RLS de profiles en cascade.
create or replace function public.is_agency_admin()
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from profiles
    where id = auth.uid()
      and role in ('admin', 'manager')
  );
$$;

comment on function public.is_agency_admin() is
  'true si l''utilisateur courant dirige son agence (admin|manager). Garde les données KYB (PII de conformité) hors de portée des agents simples.';

-- ─── agency_related_persons ──────────────────────────────────────────────────
create table if not exists public.agency_related_persons (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  first_name text not null,
  last_name text not null,
  date_of_birth date,
  nationality text,                    -- ISO 3166-1 alpha-2
  id_document_type text
    check (id_document_type is null or id_document_type in ('passport', 'id_card', 'residence_permit', 'other')),
  id_document_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.agency_related_persons is
  'Identité de conformité (KYB) des personnes liées à une agence : signataires et UBO. Distincte de profiles — un UBO passif n''a pas de compte CRM.';
comment on column public.agency_related_persons.profile_id is
  'Lien vers le compte CRM SI la personne en a un. NULL pour un ayant droit économique sans accès.';
comment on column public.agency_related_persons.id_document_number is
  'PII sensible (LPD). Lecture restreinte aux dirigeants de l''agence et au super-admin via RLS.';

create index if not exists idx_agency_related_persons_agency
  on public.agency_related_persons (agency_id);
create index if not exists idx_agency_related_persons_profile
  on public.agency_related_persons (profile_id);

-- ─── agency_person_roles ─────────────────────────────────────────────────────
create table if not exists public.agency_person_roles (
  id uuid primary key default gen_random_uuid(),
  related_person_id uuid not null references public.agency_related_persons (id) on delete cascade,
  role text not null
    check (role in ('signatory', 'ubo')),
  signature_power text
    check (signature_power is null or signature_power in ('individual', 'joint')),
  ownership_pct numeric(5,2)
    check (ownership_pct is null or (ownership_pct >= 0 and ownership_pct <= 100)),
  pep_self_declared boolean not null default false,
  source text not null default 'declared'
    check (source in ('registry_officer_listing', 'declared', 'poa_document')),
  valid_from date not null default current_date,
  valid_to date,
  created_at timestamptz not null default now(),

  -- Les deux attributs sont exclusifs de leur rôle : un pouvoir de signature n'a
  -- aucun sens pour un UBO, un pourcentage de détention aucun pour un signataire.
  -- Sans cette contrainte, la table accepterait des lignes ininterprétables.
  constraint agency_person_roles_role_attrs_chk check (
    (role = 'signatory' and ownership_pct is null)
    or (role = 'ubo' and signature_power is null)
  )
);

comment on table public.agency_person_roles is
  'Rôle(s) d''une personne dans l''agence : signataire autorisé et/ou UBO. Historisé par valid_from/valid_to — un changement d''organe se conserve pour l''audit LAB.';
comment on column public.agency_person_roles.ownership_pct is
  'Détention en % (rôle ubo). Seuil de déclaration UBO = 25 % (norme FATF, transposable telle quelle hors CH).';
comment on column public.agency_person_roles.pep_self_declared is
  'Déclaratif de la personne. À ne PAS confondre avec le résultat du screening Dilisense, qui vit dans agency_person_verification_checks.';
comment on column public.agency_person_roles.source is
  'Origine de l''information : listing officiel du registre (le plus fort), déclaration, ou procuration/résolution du CA fournie quand le registre ne publie pas les organes.';

create index if not exists idx_agency_person_roles_person
  on public.agency_person_roles (related_person_id);

-- Un seul rôle ACTIF de chaque type par personne ; l'historique (valid_to renseigné)
-- reste libre. Index partiel : `unique (…) where valid_to is null` n'est pas
-- exprimable en contrainte de table.
create unique index if not exists idx_agency_person_roles_active_unique
  on public.agency_person_roles (related_person_id, role)
  where valid_to is null;

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.agency_related_persons enable row level security;
alter table public.agency_person_roles enable row level security;

-- Scoping par agence ET par rôle : contrairement aux tables métier (contacts, biens)
-- que tout agent consulte, il s'agit ici de la PII des dirigeants et actionnaires.
-- Un agent simple n'a aucune raison de lire la date de naissance de l'actionnaire.
drop policy if exists "arp_all_agency_admin" on public.agency_related_persons;
create policy "arp_all_agency_admin" on public.agency_related_persons
  for all to authenticated
  using (
    (agency_id = public.get_my_agency_id() and public.is_agency_admin())
    or public.is_super_admin()
  )
  with check (
    (agency_id = public.get_my_agency_id() and public.is_agency_admin())
    or public.is_super_admin()
  );

-- Pas d'agency_id sur cette table (cf. en-tête) → on remonte à l'agence par jointure.
drop policy if exists "apr_all_agency_admin" on public.agency_person_roles;
create policy "apr_all_agency_admin" on public.agency_person_roles
  for all to authenticated
  using (
    exists (
      select 1 from public.agency_related_persons p
      where p.id = agency_person_roles.related_person_id
        and (
          (p.agency_id = public.get_my_agency_id() and public.is_agency_admin())
          or public.is_super_admin()
        )
    )
  )
  with check (
    exists (
      select 1 from public.agency_related_persons p
      where p.id = agency_person_roles.related_person_id
        and (
          (p.agency_id = public.get_my_agency_id() and public.is_agency_admin())
          or public.is_super_admin()
        )
    )
  );
