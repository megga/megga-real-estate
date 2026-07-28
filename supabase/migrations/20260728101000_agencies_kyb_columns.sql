-- Identité légale des agences — généralisation internationale + état de vérification KYB.
-- Voir docs/agency-kyb-verification.md. Dépend de 20260726120000 (legal_forms).
--
-- 1. ide → business_registration_number : le nom « IDE » est le terme SUISSE. Dès qu'on
--    onboarde une agence française (SIREN) ou liechtensteinoise, la colonne ment sur son
--    contenu. Renommage plutôt qu'ajout d'une 2e colonne : deux colonnes pour le même
--    fait se désynchronisent (et c'est de la redondance pure).
-- 2. legal_form (texte libre) → legal_form_id (FK) : cf. l'en-tête de la migration
--    précédente. Le texte libre est conservé UNIQUEMENT pour les lignes non appariées.
-- 3. trade_name : nom commercial, distinct de la raison sociale. C'est LUI la cible du
--    rapprochement flou avec le domaine e-mail — jamais legal_name, qui doit matcher le
--    registre au caractère près.
-- 4. verification_status / score / verified_at : résultat du moteur de vérification.

-- ─── 1. Renommage ide → business_registration_number ─────────────────────────
-- RENAME COLUMN n'est pas idempotent (échoue si déjà fait) et la CI ré-applique les
-- migrations du jour à chaque deploy → garde explicite. Les 3 cas sont couverts :
-- déjà renommée (no-op), à renommer, absente des deux côtés (base fraîche → add).
do $$
begin
  if exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'agencies' and column_name = 'ide'
     )
     and not exists (
       select 1 from information_schema.columns
       where table_schema = 'public' and table_name = 'agencies'
         and column_name = 'business_registration_number'
     )
  then
    alter table public.agencies rename column ide to business_registration_number;
  end if;
end $$;

alter table public.agencies
  add column if not exists business_registration_number text;

comment on column public.agencies.business_registration_number is
  'Identifiant au registre du commerce, générique multi-pays : IDE/UID (CHE-…) en CH, SIREN en FR, n° de registre en LI. Ancrage dur de la vérification KYB.';

-- ─── 2. Colonnes KYB ─────────────────────────────────────────────────────────
alter table public.agencies
  add column if not exists legal_form_id       uuid references public.legal_forms (id),
  add column if not exists trade_name          text,
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_score  numeric(4,3),
  add column if not exists verified_at         timestamptz;

-- DROP avant ADD : `add constraint` seul n'est pas idempotent.
--
-- 'validated' figure ici alors que cette migration ne l'utilise pas encore (il
-- n'apparaît qu'en 20260728107000) : le pipeline rejoue INTÉGRALEMENT chaque
-- migration datée du jour à chaque déploiement, dans l'ordre des fichiers. Une
-- fois qu'une ligne réelle porte 'validated' (posée par 140300 lors d'un déploiement
-- antérieur), rejouer CETTE migration avec une liste plus étroite fait échouer le
-- DROP/ADD sur "check constraint ... is violated by some row" et casse tout le
-- déploiement. Une contrainte, un seul propriétaire : la liste ici doit donc rester
-- un sur-ensemble de celle de 140300, jamais plus étroite qu'un état déjà atteint.
alter table public.agencies drop constraint if exists agencies_verification_status_chk;
alter table public.agencies
  add constraint agencies_verification_status_chk
  check (verification_status in ('pending', 'auto_validated', 'validated', 'manual_review', 'rejected'));

alter table public.agencies drop constraint if exists agencies_verification_score_chk;
alter table public.agencies
  add constraint agencies_verification_score_chk
  check (verification_score is null or (verification_score >= 0 and verification_score <= 1));

comment on column public.agencies.legal_form_id is
  'Forme juridique (référentiel legal_forms). Pilote le parcours KYB : UBO requis, diligence renforcée.';
comment on column public.agencies.trade_name is
  'Nom commercial si différent de la raison sociale. Cible du rapprochement flou avec le domaine e-mail — jamais legal_name.';
comment on column public.agencies.verification_status is
  'pending | auto_validated | manual_review | rejected. Les vétos durs et un hit PEP/sanctions forcent manual_review quel que soit le score.';
comment on column public.agencies.verification_score is
  'Score agrégé 0..1, normalisé sur les checks DISPONIBLES (un pays sans VIES n''est pas pénalisé). Cache calculé depuis agency_verification_checks — donnée dérivée assumée, pas une source de vérité.';

-- ─── 3. Backfill legal_form (texte) → legal_form_id ──────────────────────────
-- Défensif par construction : « SA », « AG », « GmbH », « SNC » existent dans plusieurs
-- pays. On filtre donc par le pays de l'agence quand il est exploitable, et on
-- n'apparie QUE si le résultat est unique (match_count = 1). Toute ambiguïté, tout
-- pays inconnu, tout libellé exotique → la ligne reste non appariée et part en saisie
-- manuelle. Aucun arbitrage automatique : une forme juridique fausse fausserait le
-- parcours de conformité.
with normalized as (
  select
    a.id as agency_id,
    public.normalize_legal_form_text(a.legal_form) as lf_norm,
    case public.normalize_legal_form_text(a.country)
      when 'ch' then 'CH' when 'suisse' then 'CH' when 'switzerland' then 'CH'
      when 'schweiz' then 'CH' when 'svizzera' then 'CH' when 'che' then 'CH'
      when 'fr' then 'FR' when 'france' then 'FR' when 'fra' then 'FR'
      when 'li' then 'LI' when 'liechtenstein' then 'LI' when 'lie' then 'LI'
      else null
    end as country_code
  from public.agencies a
  where a.legal_form is not null
    and btrim(a.legal_form) <> ''
    and a.legal_form_id is null          -- ré-exécutable : n'écrase jamais un appariement acquis
),
candidates as (
  select
    n.agency_id,
    lf.id as legal_form_id,
    count(*) over (partition by n.agency_id) as match_count
  from normalized n
  join public.legal_form_aliases al on al.alias = n.lf_norm
  join public.legal_forms lf on lf.id = al.legal_form_id
  where n.country_code is null or lf.country = n.country_code
)
update public.agencies a
set legal_form_id = c.legal_form_id
from candidates c
where a.id = c.agency_id
  and c.match_count = 1;

-- Une fois apparié, le texte libre ferait doublon avec la FK (même fait, deux endroits
-- → risque de désynchronisation). On le vide : l'information n'est pas perdue, elle est
-- canonisée dans legal_forms (libellés dans les 4 langues). Le texte ne survit que sur
-- les lignes NON appariées, où il est la seule trace de la saisie.
update public.agencies
set legal_form = null
where legal_form_id is not null
  and legal_form is not null;

comment on column public.agencies.legal_form is
  'HÉRITÉ — saisie libre non appariée au référentiel, à trier manuellement. Vidée dès que legal_form_id est posé. Ne PAS écrire ici : la source de vérité est legal_form_id.';

-- ─── 4. Index ────────────────────────────────────────────────────────────────
create index if not exists idx_agencies_legal_form
  on public.agencies (legal_form_id);

-- File de revue manuelle (console admin.megga.ch) : index partiel, la très grande
-- majorité des agences n'y sera jamais.
create index if not exists idx_agencies_verification_review
  on public.agencies (verification_status, verified_at)
  where verification_status = 'manual_review';
