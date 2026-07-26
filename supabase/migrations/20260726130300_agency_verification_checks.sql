-- Journal des vérifications KYB — une ligne par check exécuté, avec la réponse brute
-- de la source. Voir docs/agency-kyb-verification.md.
--
-- POURQUOI deux tables de checks (entité / personne) plutôt qu'une seule polymorphe
-- (subject_type + subject_id) : une FK polymorphe interdit toute contrainte d'intégrité
-- référentielle réelle en Postgres — rien ne garantirait que subject_id pointe vers une
-- ligne existante. Deux vraies FK gardent l'intégrité et donnent des policies RLS
-- lisibles (chaque table remonte à l'agence par son propre chemin).
--
-- POURQUOI trois tables pour ce qui pourrait tenir en une :
--   • verification_check_types  : le catalogue des checks (le TYPE existe)
--   • verification_check_config : sa pondération À UNE DATE (le poids CHANGE)
--   • *_verification_checks     : l'exécution (le résultat CONSTATÉ)
-- Ce sont trois faits de durées de vie différentes. Les fondre ferait porter à chaque
-- ligne de check un poids qui dépend du type et non de l'occurrence — dépendance
-- transitive (3NF) — et surtout, retoucher une pondération rendrait tous les scores
-- passés inexplicables. Ici l'audit rejoint la config en vigueur à checked_at.

-- ─── verification_check_types ────────────────────────────────────────────────
-- Catalogue référencé par FK : sans lui, check_type serait du texte libre et une
-- faute de frappe créerait un type fantôme dans une piste d'audit LAB, sans erreur.
create table if not exists public.verification_check_types (
  code text primary key,
  scope text not null
    check (scope in ('agency', 'person')),
  label_fr text not null,
  created_at timestamptz not null default now()
);

comment on table public.verification_check_types is
  'Catalogue des types de vérification KYB. scope indique la table de checks concernée — la cohérence est garantie par l''Edge Function d''écriture, pas par une colonne redondante sur chaque check.';

insert into public.verification_check_types (code, scope, label_fr) values
  -- Vétos entité : même donnée vue par deux sources indépendantes
  ('registry_number_format',       'agency', 'Format et clé de contrôle du numéro de registre'),
  ('registry_lookup',              'agency', 'Existence et statut actif au registre du commerce'),
  ('registry_legal_name_match',    'agency', 'Raison sociale saisie ↔ raison sociale du registre'),
  ('registry_country_match',       'agency', 'Pays déclaré ↔ juridiction du registre'),
  -- Vétos personne
  ('pep_sanctions_screening',      'person', 'Screening PEP et listes de sanctions'),
  ('id_document',                  'person', 'Pièce d''identité et détection du vivant'),
  -- Signaux moyens entité
  ('vat_lookup',                   'agency', 'Numéro de TVA (VIES en UE, registre UID en CH/LI)'),
  ('address_registry_match',       'agency', 'Adresse saisie ↔ adresse du registre'),
  ('address_geocode',              'agency', 'Existence réelle de l''adresse postale'),
  ('activity_code_match',          'agency', 'Code d''activité ↔ activité immobilière'),
  ('professional_registry',        'agency', 'Registre professionnel immobilier (RCC, carte pro…)'),
  ('lei_lookup',                   'agency', 'Legal Entity Identifier (GLEIF)'),
  -- Signaux moyens personne
  ('signatory_registry_match',     'person', 'Signataire listé comme organe au registre'),
  ('poa_document_review',          'person', 'Procuration ou résolution du conseil (revue humaine)'),
  -- Signaux faibles entité
  ('domain_website_match',         'agency', 'Domaine e-mail ↔ site web déclaré'),
  ('domain_trade_name_similarity', 'agency', 'Domaine ↔ nom commercial (similarité floue)'),
  ('domain_whois_age',             'agency', 'Ancienneté du domaine et enregistrements MX'),
  ('domain_generic_provider',      'agency', 'Adresse « pro » sur un domaine grand public'),
  ('phone_country_match',          'agency', 'Indicatif téléphonique ↔ pays déclaré')
on conflict (code) do update set
  scope    = excluded.scope,
  label_fr = excluded.label_fr;

-- ─── verification_check_config ───────────────────────────────────────────────
create table if not exists public.verification_check_config (
  id uuid primary key default gen_random_uuid(),
  check_type text not null references public.verification_check_types (code) on delete restrict,
  weight numeric(4,2) not null
    check (weight >= 0),
  is_veto boolean not null default false,
  valid_from timestamptz not null default now(),
  valid_to timestamptz
);

comment on table public.verification_check_config is
  'Pondération d''un type de check, versionnée. Un audit rejoue le poids en vigueur à la date du check plutôt que de le lire figé sur la ligne.';
comment on column public.verification_check_config.is_veto is
  'true = échec bloquant, HORS score : le dossier part en revue humaine quel que soit le reste. Un véto ne se compense jamais par un bon score ailleurs.';
comment on column public.verification_check_config.weight is
  'Ignoré quand is_veto. Sinon : poids dans la moyenne pondérée, normalisée sur les seuls checks disponibles — un pays sans VIES n''est donc pas pénalisé.';

-- Une seule version active par type (l'historique reste libre une fois valid_to posé).
create unique index if not exists idx_verification_check_config_active
  on public.verification_check_config (check_type)
  where valid_to is null;

-- Pondération initiale. Les vétos portent weight = 0 : ils sont hors score par
-- construction, la colonne ne les concerne pas.
insert into public.verification_check_config (check_type, weight, is_veto)
select t.code, v.weight, v.is_veto
from (values
  ('registry_number_format',       0::numeric, true),
  ('registry_lookup',              0::numeric, true),
  ('registry_legal_name_match',    0::numeric, true),
  ('registry_country_match',       0::numeric, true),
  ('pep_sanctions_screening',      0::numeric, true),
  ('id_document',                  0::numeric, true),
  ('vat_lookup',                   3.00,       false),
  ('address_registry_match',       2.50,       false),
  ('address_geocode',              1.50,       false),
  ('activity_code_match',          2.00,       false),
  ('professional_registry',        2.00,       false),
  ('lei_lookup',                   1.50,       false),
  ('signatory_registry_match',     3.00,       false),
  ('poa_document_review',          2.00,       false),
  ('domain_website_match',         1.00,       false),
  ('domain_trade_name_similarity', 0.75,       false),
  ('domain_whois_age',             0.75,       false),
  ('domain_generic_provider',      1.00,       false),
  ('phone_country_match',          0.50,       false)
) as v(code, weight, is_veto)
join public.verification_check_types t on t.code = v.code
where not exists (
  select 1 from public.verification_check_config c
  where c.check_type = v.code and c.valid_to is null
);

-- ─── agency_verification_checks ──────────────────────────────────────────────
create table if not exists public.agency_verification_checks (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies (id) on delete cascade,
  check_type text not null references public.verification_check_types (code) on delete restrict,
  source text not null
    check (source in ('zefix', 'uid_register', 'vies', 'recherche_entreprises', 'insee_sirene',
                      'oera_li', 'rdap', 'gleif', 'mapbox', 'cci_immobilier', 'manual')),
  result text not null
    check (result in ('match', 'partial', 'mismatch', 'unavailable', 'pending_manual_review')),
  raw_response jsonb,
  checked_at timestamptz not null default now()
);

comment on table public.agency_verification_checks is
  'Un check KYB au niveau ENTITÉ (registre, TVA, domaine, géocodage…). raw_response conserve la réponse de la source comme pièce d''audit LAB.';
comment on column public.agency_verification_checks.result is
  'match | partial | mismatch | unavailable | pending_manual_review. `unavailable` (source injoignable ou inexistante dans ce pays) EXCLUT le check du dénominateur : il ne pénalise pas.';
comment on column public.agency_verification_checks.raw_response is
  'Réponse brute de la source. Ne JAMAIS en dépendre pour la logique applicative : c''est une pièce d''audit, son format suit le fournisseur.';

create index if not exists idx_agency_verification_checks_agency
  on public.agency_verification_checks (agency_id, check_type, checked_at desc);

-- ─── agency_person_verification_checks ───────────────────────────────────────
create table if not exists public.agency_person_verification_checks (
  id uuid primary key default gen_random_uuid(),
  related_person_id uuid not null references public.agency_related_persons (id) on delete cascade,
  check_type text not null references public.verification_check_types (code) on delete restrict,
  source text not null
    check (source in ('dilisense', 'registry', 'id_vendor', 'manual')),
  result text not null
    check (result in ('match', 'partial', 'mismatch', 'unavailable', 'pending_manual_review')),
  raw_response jsonb,
  checked_at timestamptz not null default now()
);

comment on table public.agency_person_verification_checks is
  'Un check KYB au niveau PERSONNE (pièce d''identité, screening PEP/sanctions, appariement au listing des organes du registre).';

create index if not exists idx_agency_person_verification_checks_person
  on public.agency_person_verification_checks (related_person_id, check_type, checked_at desc);

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.verification_check_types enable row level security;
alter table public.verification_check_config enable row level security;
alter table public.agency_verification_checks enable row level security;
alter table public.agency_person_verification_checks enable row level security;

-- Catalogue : lecture ouverte aux authentifiés — ce ne sont que des libellés, et le
-- dirigeant doit pouvoir lire « Existence au registre du commerce » en face de son
-- dossier. `using (true)` délibéré : aucune PII, aucune donnée d'agence.
drop policy if exists "vct_select_all" on public.verification_check_types;
create policy "vct_select_all" on public.verification_check_types
  for select to authenticated
  using (true);

-- Pondérations : AUCUN accès client, même en lecture. Exposer les poids inviterait à
-- optimiser sa saisie pour franchir le seuil d'auto-validation. Le scoring tourne en
-- Edge Function (service_role, qui contourne la RLS) ; le super-admin lit pour régler
-- les seuils depuis admin.megga.ch.
drop policy if exists "vcc_select_super_admin" on public.verification_check_config;
create policy "vcc_select_super_admin" on public.verification_check_config
  for select to authenticated
  using (public.is_super_admin());

-- Checks : lecture seule côté client (suivi de dossier). Aucune policy d'écriture →
-- seul le service_role écrit, depuis l'Edge Function de vérification. Un client ne
-- doit jamais pouvoir se déclarer « match ».
drop policy if exists "avc_select_agency_admin" on public.agency_verification_checks;
create policy "avc_select_agency_admin" on public.agency_verification_checks
  for select to authenticated
  using (
    (agency_id = public.get_my_agency_id() and public.is_agency_admin())
    or public.is_super_admin()
  );

drop policy if exists "apvc_select_agency_admin" on public.agency_person_verification_checks;
create policy "apvc_select_agency_admin" on public.agency_person_verification_checks
  for select to authenticated
  using (
    exists (
      select 1 from public.agency_related_persons p
      where p.id = agency_person_verification_checks.related_person_id
        and (
          (p.agency_id = public.get_my_agency_id() and public.is_agency_admin())
          or public.is_super_admin()
        )
    )
  );
