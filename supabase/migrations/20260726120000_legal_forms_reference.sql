-- Référentiel des formes juridiques (KYB) — socle de la vérification d'identité
-- des agences à l'onboarding. Voir docs/agency-kyb-verification.md.
--
-- POURQUOI une table de référence plutôt qu'un texte libre sur agencies :
-- la forme juridique pilote une décision de conformité (déclaration UBO requise ou
-- non, diligence renforcée pour les structures opaques). Une faute de frappe dans un
-- champ libre change donc le parcours de vérification. Et surtout : la catégorie
-- (« société de capitaux ») dépend de la forme juridique, PAS de l'agence — la
-- stocker sur agencies serait une dépendance transitive (violation 3NF).
--
--   - legal_forms          : la forme juridique et sa catégorie
--   - legal_form_aliases   : libellés d'entrée qui désignent la même forme
--
-- POURQUOI les alias dans une table séparée (et non un text[]) : un tableau serait
-- un groupe répétitif (1NF), et surtout les alias servent au RUNTIME, pas seulement
-- au backfill — les registres renvoient la forme dans la langue d'enregistrement
-- (Zefix renvoie « Aktiengesellschaft » pour une SA inscrite en allemand).
--
-- NON stocké volontairement : un booléen « requires_ubo_declaration ». Il se déduit
-- entièrement de category → dépendance transitive. La règle vit dans le moteur de
-- vérification, pas en base.

-- ─── Normalisation partagée ──────────────────────────────────────────────────
-- Utilisée par le backfill ET par les connecteurs registre. `translate` plutôt que
-- l'extension unaccent : évite une dépendance d'extension pour 26 caractères.
-- « S.A. », « Sàrl », « Société Anonyme » → « sa », « sarl », « societeanonyme ».
create or replace function public.normalize_legal_form_text(p_text text)
returns text
language sql
immutable
set search_path to 'public'
as $$
  select regexp_replace(
           translate(lower(coalesce(p_text, '')),
                     'àâäáãçéèêëíìîïñóòôöõúùûüýÿ',
                     'aaaaaceeeeiiiinooooouuuuyy'),
           '[^a-z0-9]', '', 'g')
$$;

comment on function public.normalize_legal_form_text(text) is
  'Normalise un libellé de forme juridique (minuscules, sans accents ni ponctuation) pour appariement. Partagée backfill + connecteurs registre.';

-- ─── legal_forms ─────────────────────────────────────────────────────────────
create table if not exists public.legal_forms (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,          -- 'CH_SA', 'FR_SCI', 'LI_ANSTALT'…
  country text not null,              -- ISO 3166-1 alpha-2
  category text not null
    check (category in ('corporation', 'partnership', 'sole_proprietorship', 'foundation_or_trust')),
  label_fr text not null,
  label_de text not null,
  label_en text not null,
  label_it text not null,
  sort_order integer not null default 100,
  created_at timestamptz not null default now()
);

comment on table public.legal_forms is
  'Référentiel des formes juridiques par pays. category pilote le parcours KYB (UBO requis, diligence renforcée).';
comment on column public.legal_forms.category is
  'corporation | partnership | sole_proprietorship | foundation_or_trust. sole_proprietorship = le signataire EST l''entité (pas d''UBO tiers) ; foundation_or_trust = structures opaques (Anstalt, Stiftung, Treuunternehmen) → diligence renforcée.';

create index if not exists idx_legal_forms_country_sort
  on public.legal_forms (country, sort_order);

-- ─── legal_form_aliases ──────────────────────────────────────────────────────
create table if not exists public.legal_form_aliases (
  id uuid primary key default gen_random_uuid(),
  legal_form_id uuid not null references public.legal_forms (id) on delete cascade,
  alias text not null,                -- STOCKÉ DÉJÀ NORMALISÉ (cf. fonction ci-dessus)
  created_at timestamptz not null default now(),
  unique (legal_form_id, alias)
);

comment on table public.legal_form_aliases is
  'Libellés alternatifs (multilingues, abrégés) désignant une forme juridique. Alias stockés normalisés — comparer via normalize_legal_form_text().';

-- L'appariement se fait sur alias seul (le pays de l'agence peut être absent ou faux
-- au moment de la saisie) → index sur alias, pas sur (legal_form_id, alias).
create index if not exists idx_legal_form_aliases_alias
  on public.legal_form_aliases (alias);

-- ─── Seed : Suisse / France / Liechtenstein ──────────────────────────────────
-- Idempotent : on conflict sur la clé naturelle (code).
insert into public.legal_forms (code, country, category, label_fr, label_de, label_en, label_it, sort_order) values
  -- Suisse
  ('CH_SA',        'CH', 'corporation',          'Société anonyme (SA)',                          'Aktiengesellschaft (AG)',                    'Public limited company (SA)',      'Società anonima (SA)',              10),
  ('CH_SARL',      'CH', 'corporation',          'Société à responsabilité limitée (Sàrl)',       'Gesellschaft mit beschränkter Haftung (GmbH)','Limited liability company (Sàrl)',  'Società a garanzia limitata (Sagl)', 20),
  ('CH_RI',        'CH', 'sole_proprietorship',  'Raison individuelle',                           'Einzelunternehmen',                          'Sole proprietorship',              'Ditta individuale',                  30),
  ('CH_SNC',       'CH', 'partnership',          'Société en nom collectif',                      'Kollektivgesellschaft',                      'General partnership',              'Società in nome collettivo',         40),
  ('CH_SCM',       'CH', 'partnership',          'Société en commandite',                         'Kommanditgesellschaft',                      'Limited partnership',              'Società in accomandita',             50),
  ('CH_COOP',      'CH', 'corporation',          'Société coopérative',                           'Genossenschaft',                             'Cooperative',                      'Società cooperativa',                60),
  ('CH_FOND',      'CH', 'foundation_or_trust',  'Fondation',                                     'Stiftung',                                   'Foundation',                       'Fondazione',                         70),
  -- France
  ('FR_SAS',       'FR', 'corporation',          'Société par actions simplifiée (SAS)',          'Vereinfachte Aktiengesellschaft (SAS)',      'Simplified joint-stock company (SAS)', 'Società per azioni semplificata (SAS)', 10),
  ('FR_SASU',      'FR', 'corporation',          'SAS unipersonnelle (SASU)',                     'Ein-Personen-SAS (SASU)',                    'Single-member SAS (SASU)',         'SAS unipersonale (SASU)',            20),
  ('FR_SARL',      'FR', 'corporation',          'Société à responsabilité limitée (SARL)',       'Gesellschaft mit beschränkter Haftung (SARL)','Limited liability company (SARL)', 'Società a responsabilità limitata (SARL)', 30),
  ('FR_EURL',      'FR', 'corporation',          'Entreprise unipersonnelle à responsabilité limitée (EURL)', 'Ein-Personen-GmbH (EURL)',       'Single-member limited company (EURL)', 'Impresa unipersonale (EURL)',    40),
  ('FR_SA',        'FR', 'corporation',          'Société anonyme (SA)',                          'Aktiengesellschaft (SA)',                    'Public limited company (SA)',      'Società anonima (SA)',               50),
  ('FR_SCI',       'FR', 'partnership',          'Société civile immobilière (SCI)',              'Immobilien-Zivilgesellschaft (SCI)',         'Real estate civil company (SCI)',  'Società civile immobiliare (SCI)',   60),
  ('FR_SNC',       'FR', 'partnership',          'Société en nom collectif (SNC)',                'Offene Handelsgesellschaft (SNC)',           'General partnership (SNC)',        'Società in nome collettivo (SNC)',   70),
  ('FR_EI',        'FR', 'sole_proprietorship',  'Entreprise individuelle (EI)',                  'Einzelunternehmen (EI)',                     'Sole proprietorship (EI)',         'Impresa individuale (EI)',           80),
  -- Liechtenstein
  ('LI_AG',        'LI', 'corporation',          'Société anonyme (AG)',                          'Aktiengesellschaft (AG)',                    'Public limited company (AG)',      'Società anonima (AG)',               10),
  ('LI_GMBH',      'LI', 'corporation',          'Société à responsabilité limitée (GmbH)',       'Gesellschaft mit beschränkter Haftung (GmbH)','Limited liability company (GmbH)', 'Società a garanzia limitata (GmbH)', 20),
  ('LI_ANSTALT',   'LI', 'foundation_or_trust',  'Établissement (Anstalt)',                       'Anstalt',                                    'Establishment (Anstalt)',          'Stabilimento (Anstalt)',             30),
  ('LI_STIFTUNG',  'LI', 'foundation_or_trust',  'Fondation (Stiftung)',                          'Stiftung',                                   'Foundation (Stiftung)',            'Fondazione (Stiftung)',              40),
  ('LI_TRUST',     'LI', 'foundation_or_trust',  'Entreprise fiduciaire (Treuunternehmen)',       'Treuunternehmen',                            'Registered trust (Treuunternehmen)','Impresa fiduciaria (Treuunternehmen)', 50),
  ('LI_EU',        'LI', 'sole_proprietorship',  'Entreprise individuelle',                       'Einzelunternehmen',                          'Sole proprietorship',              'Impresa individuale',                60)
on conflict (code) do update set
  country    = excluded.country,
  category   = excluded.category,
  label_fr   = excluded.label_fr,
  label_de   = excluded.label_de,
  label_en   = excluded.label_en,
  label_it   = excluded.label_it,
  sort_order = excluded.sort_order;

-- ─── Seed des alias ──────────────────────────────────────────────────────────
-- Couvre : abréviations, ponctuation, libellés longs, et les 4 langues — c'est ce
-- que renverront Zefix (langue d'inscription) et recherche-entreprises (libellés INSEE).
insert into public.legal_form_aliases (legal_form_id, alias)
select lf.id, public.normalize_legal_form_text(a.alias)
from (values
  ('CH_SA',       'SA'), ('CH_SA', 'S.A.'), ('CH_SA', 'Société anonyme'), ('CH_SA', 'AG'),
  ('CH_SA',       'Aktiengesellschaft'), ('CH_SA', 'Società anonima'),
  ('CH_SARL',     'Sàrl'), ('CH_SARL', 'SARL'), ('CH_SARL', 'S.à r.l.'), ('CH_SARL', 'GmbH'),
  ('CH_SARL',     'Sagl'), ('CH_SARL', 'Société à responsabilité limitée'),
  ('CH_SARL',     'Gesellschaft mit beschränkter Haftung'),
  ('CH_RI',       'Raison individuelle'), ('CH_RI', 'Einzelunternehmen'), ('CH_RI', 'Ditta individuale'),
  ('CH_SNC',      'SNC'), ('CH_SNC', 'Société en nom collectif'), ('CH_SNC', 'Kollektivgesellschaft'),
  ('CH_SCM',      'Société en commandite'), ('CH_SCM', 'Kommanditgesellschaft'),
  ('CH_COOP',     'Société coopérative'), ('CH_COOP', 'Genossenschaft'), ('CH_COOP', 'Coopérative'),
  ('CH_FOND',     'Fondation'), ('CH_FOND', 'Stiftung'),
  ('FR_SAS',      'SAS'), ('FR_SAS', 'S.A.S.'), ('FR_SAS', 'Société par actions simplifiée'),
  ('FR_SASU',     'SASU'), ('FR_SASU', 'SAS unipersonnelle'),
  ('FR_SARL',     'SARL'), ('FR_SARL', 'S.A.R.L.'), ('FR_SARL', 'Société à responsabilité limitée'),
  ('FR_EURL',     'EURL'),
  ('FR_SA',       'Société anonyme'),
  ('FR_SCI',      'SCI'), ('FR_SCI', 'Société civile immobilière'), ('FR_SCI', 'Société civile'),
  ('FR_SNC',      'SNC'), ('FR_SNC', 'Société en nom collectif'),
  ('FR_EI',       'EI'), ('FR_EI', 'Entreprise individuelle'), ('FR_EI', 'Micro-entreprise'),
  ('FR_EI',       'Auto-entrepreneur'),
  ('LI_AG',       'AG'), ('LI_AG', 'Aktiengesellschaft'),
  ('LI_GMBH',     'GmbH'), ('LI_GMBH', 'Gesellschaft mit beschränkter Haftung'),
  ('LI_ANSTALT',  'Anstalt'), ('LI_ANSTALT', 'Établissement'), ('LI_ANSTALT', 'Establishment'),
  ('LI_STIFTUNG', 'Stiftung'), ('LI_STIFTUNG', 'Fondation'),
  ('LI_TRUST',    'Treuunternehmen'), ('LI_TRUST', 'Trust reg.'), ('LI_TRUST', 'Registered trust'),
  ('LI_EU',       'Einzelunternehmen')
) as a(code, alias)
join public.legal_forms lf on lf.code = a.code
on conflict (legal_form_id, alias) do nothing;

-- ⚠ « SA », « AG », « GmbH », « SNC » existent dans PLUSIEURS pays : l'appariement par
-- alias seul est donc ambigu et doit être filtré par le pays de l'agence. Le backfill
-- (migration suivante) ne tranche jamais une ambiguïté — il laisse la ligne non
-- appariée en revue manuelle.

-- ─── RLS ─────────────────────────────────────────────────────────────────────
alter table public.legal_forms enable row level security;
alter table public.legal_form_aliases enable row level security;

-- `using (true)` DÉLIBÉRÉ et justifié : données de référence publiques (aucune PII,
-- aucune donnée d'agence) qui alimentent un menu déroulant côté client. L'écriture
-- n'a AUCUNE policy → réservée de fait au service_role et aux migrations.
drop policy if exists "legal_forms_select_all" on public.legal_forms;
create policy "legal_forms_select_all" on public.legal_forms
  for select to authenticated
  using (true);

drop policy if exists "legal_form_aliases_select_all" on public.legal_form_aliases;
create policy "legal_form_aliases_select_all" on public.legal_form_aliases
  for select to authenticated
  using (true);
