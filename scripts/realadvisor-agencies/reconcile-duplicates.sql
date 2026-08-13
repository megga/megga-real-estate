-- Réconciliation des doublons d'agency_profiles — joué le 13.08.2026.
--
-- agency_profiles accumule la même société sous plusieurs graphies
-- (« Amma Immo » / « Amma Immo Sàrl », « Wincasa AG » / « Wincasa SA »), parce
-- que flatfox-sync et le rattachement RealAdvisor y écrivent chacun avec la
-- graphie de leur source. 366 doublons résorbés le 13.08.2026 : 6654 → 6283.
--
-- ⛔ LE RISQUE N'EST PAS LE DOUBLON, C'EST LA CLÉ ÉTRANGÈRE.
--   market_listings.agency_profile_id est en ON DELETE SET NULL
--     ⇒ supprimer un doublon DÉTACHE SES ANNONCES EN SILENCE (3570 annonces
--       concernées au 13.08) et défait le rattachement de la PR #1009 sans
--       qu'aucune erreur ne le signale.
--   agent_profiles.agency_profile_id est en NO ACTION ⇒ la suppression ÉCHOUE.
--
-- ⛔ LES TROIS ÉTAPES NE SONT PAS FUSIONNABLES en un seul énoncé : les CTE
--    modifiantes de Postgres partagent un snapshot et s'exécutent dans un ordre
--    non spécifié. Les jouer une par une, dans l'ordre.
--
-- Chaque étape est précédée de son équivalent en SELECT. Jouer le SELECT d'abord,
-- lire les nombres, puis l'énoncé modifiant. Les suppressions sont définitives.

-- ═══ Vue partagée ═══════════════════════════════════════════════════════════
-- `nu` = raison sociale NUE : minuscules, accents pliés (unaccent gère les
-- majuscules accentuées, contrairement à un translate écrit à la main), forme
-- juridique et ponctuation retirées. AG↔SA et GmbH↔Sàrl sont la MÊME forme en
-- allemand et en français, d'où leur présence dans la liste.
create or replace view public.v_agency_dupes as
with norm as (
  select id, name, source, phone, uid_che, logo_url, website_url, address, city,
         canton, source_id, email, description, created_at,
         regexp_replace(regexp_replace(lower(unaccent(name)),
           '\y(sa|s\.a\.|sarl|s\.a\.r\.l\.|sagl|gmbh|ag|ltd|llc|co|und|and)\y',' ','g'),
           '[^a-z0-9]+','','g') as nu
  from public.agency_profiles
),
grp as (select nu from norm where nu <> '' group by nu having count(*) > 1),
membres as (select n.* from norm n join grp g on g.nu = n.nu),
mlc as (select agency_profile_id id, count(*) c from public.market_listings
        where agency_profile_id is not null group by 1)
-- Survivant = le plus d'ANNONCES d'abord (la ligne que l'écosystème connaît),
-- puis la richesse, puis l'ancienneté. Ce classement reste STABLE après
-- l'étape 1 : le survivant récupère toutes les annonces, les perdants tombent à
-- 0 — l'étape 2 peut donc le recalculer sans mémoriser d'ids entre les énoncés.
select m.*, coalesce(c.c,0) as n_ann,
       row_number() over (partition by m.nu order by
         coalesce(c.c,0) desc,
         (m.phone is not null)::int + (m.uid_che is not null)::int
       + (m.logo_url is not null)::int + (m.website_url is not null)::int
       + (m.source_id is not null)::int desc,
         m.created_at, m.id) as rk
from membres m left join mlc c on c.id = m.id;

-- ═══ Étape 0 — capturer les uid_che à transférer ════════════════════════════
-- uid_che est sous index UNIQUE PARTIEL et IMMÉDIAT : le survivant ne peut
-- porter la valeur qu'une fois le perdant supprimé. La lire MAINTENANT, sinon
-- elle meurt avec la ligne à l'étape 2. Conserver le résultat pour l'étape 3.
select g.id as gagnant, p.uid_che
from public.v_agency_dupes p
join public.v_agency_dupes g on g.nu = p.nu and g.rk = 1
where p.rk > 1 and p.uid_che is not null and g.uid_che is null;

-- ═══ Étape 1 — repointer les annonces, puis enrichir le survivant ═══════════
-- Contrôle (n'écrit rien) :
select count(*) as paires,
       sum(p.n_ann) as annonces_a_repointer,
       count(*) filter (where p.website_url is not null and g.website_url is null) as sites,
       count(*) filter (where p.phone is not null and g.phone is null) as tels
from public.v_agency_dupes p
join public.v_agency_dupes g on g.nu = p.nu and g.rk = 1 where p.rk > 1;

with map as (
  select p.id as perdant, g.id as gagnant
  from public.v_agency_dupes p
  join public.v_agency_dupes g on g.nu = p.nu and g.rk = 1
  where p.rk > 1
),
-- Ce que les perdants apportent. `uid_che` est EXCLU (index UNIQUE, voir étape 3).
apport as (
  select m.gagnant,
         min(p.phone)       filter (where p.phone is not null)       as phone,
         min(p.email)       filter (where p.email is not null)       as email,
         min(p.website_url) filter (where p.website_url is not null) as website_url,
         min(p.logo_url)    filter (where p.logo_url is not null)    as logo_url,
         min(p.address)     filter (where p.address is not null)     as address,
         min(p.city)        filter (where p.city is not null)        as city,
         min(p.canton)      filter (where p.canton is not null)      as canton,
         min(p.description) filter (where p.description is not null) as description,
         min(p.source_id)   filter (where p.source_id is not null)   as source_id
  from map m join public.v_agency_dupes p on p.id = m.perdant
  group by m.gagnant
),
repoint as (
  update public.market_listings ml set agency_profile_id = m.gagnant
  from map m where ml.agency_profile_id = m.perdant
  returning ml.id
)
-- On ne remplit que les TROUS du survivant : il peut porter un phone ou un
-- uid_che que le perdant n'a pas. Contrepartie assumée : quand les deux ont la
-- valeur, celle du perdant est perdue (~97 tél., ~81 logos, 15 sites au 13.08).
-- source_id n'est repris que si le survivant est realadvisor — un uuid RA sur
-- une ligne flatfox lui ferait mentir sur sa provenance.
update public.agency_profiles a
set phone       = coalesce(a.phone,       ap.phone),
    email       = coalesce(a.email,       ap.email),
    website_url = coalesce(a.website_url, ap.website_url),
    logo_url    = coalesce(a.logo_url,    ap.logo_url),
    address     = coalesce(a.address,     ap.address),
    city        = coalesce(a.city,        ap.city),
    canton      = coalesce(a.canton,      ap.canton),
    description = coalesce(a.description, ap.description),
    source_id   = case when a.source = 'realadvisor'
                       then coalesce(a.source_id, ap.source_id) else a.source_id end,
    updated_at  = now()
from apport ap, (select count(*) from repoint) _
where a.id = ap.gagnant;

-- ═══ Étape 2 — supprimer les perdants, avec garde-fou ═══════════════════════
-- Le `not exists` n'est pas décoratif : si un perdant portait encore une annonce,
-- le ON DELETE SET NULL l'orphelinerait. Attendu après l'étape 1 : 0 épargné.
delete from public.agency_profiles ap
where ap.id in (select id from public.v_agency_dupes where rk > 1)
  and not exists (select 1 from public.market_listings ml where ml.agency_profile_id = ap.id)
  and not exists (select 1 from public.agent_profiles a  where a.agency_profile_id  = ap.id);

-- ═══ Étape 3 — transférer les uid_che capturés à l'étape 0 ══════════════════
-- Remplacer la liste par le résultat de l'étape 0.
update public.agency_profiles a
set uid_che = t.che, updated_at = now()
from (values ('00000000-0000-0000-0000-000000000000'::uuid, 'CHE-000.000.000')) as t(gagnant, che)
where a.id = t.gagnant
  and a.uid_che is null
  and not exists (select 1 from public.agency_profiles b where b.uid_che = t.che);

-- ═══ Contrôle final ═════════════════════════════════════════════════════════
select (select count(*) from public.agency_profiles)                          as total,
       (select count(*) from public.v_agency_dupes)                           as doublons_restants,
       (select count(*) from public.market_listings ml
          where ml.agency_profile_id is not null
            and not exists (select 1 from public.agency_profiles a
                            where a.id = ml.agency_profile_id))               as annonces_orphelines;

-- ═══ Ce que ce script NE fait PAS ═══════════════════════════════════════════
-- Il ne rapproche que par la raison sociale. ~91 paires partagent LOGO et
-- COMMUNE sous des noms trop éloignés pour être vues — « Sven Lott Immobilien »
-- et « RE/MAX Immobilien in Affoltern am Albis » sont la même agence.
-- La requête ci-dessous les liste ; elle N'EST PAS branchée sur une fusion
-- automatique, et c'est délibéré : le même signal rapproche aussi des sociétés
-- RÉELLEMENT distinctes d'un même groupe (« Arimo Vermarktung AG » et « Arimo
-- Bewirtschaftung AG » partagent logo et commune sans être la même entité).
-- Cette liste demande un arbitrage humain avant toute fusion.
select a.id, a.name, b.id, b.name, coalesce(a.city, a.canton) as lieu,
       round(similarity(lower(a.name), lower(b.name))::numeric, 2) as sim
from public.agency_profiles a
join public.agency_profiles b
  on b.logo_url = a.logo_url and b.id > a.id
 and a.city is not null and lower(a.city) = lower(b.city)
where similarity(lower(a.name), lower(b.name)) < 0.4
order by lieu, a.name;
