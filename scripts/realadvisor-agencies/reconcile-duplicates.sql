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

-- ═══ Second signal : le LOGO partagé ═══════════════════════════════════════
-- La partie ci-dessus ne rapproche que par la raison sociale. Un logo commun,
-- dans la même commune, rattrape ce que le nom ne dit pas.
--
-- ⛔ CE SIGNAL NE DOIT JAMAIS PILOTER UNE FUSION AUTOMATIQUE. Il rapproche aussi
-- des entités RÉELLEMENT distinctes : centres commerciaux Wincasa (« Basel
-- Stücki »), départements Privera, les cinq sociétés du groupe Tarchini, et des
-- sociétés qui partagent simplement un gérant.
--
-- Sur 91 paires ainsi trouvées (13.08.2026), 11 seulement étaient fusionnables.
-- La requête en rend 63 aujourd'hui, les fusions ayant retiré le reste : ce sont
-- des paires ARBITRÉES « ne pas fusionner », pas un reliquat à traiter.
-- Trois cribles ont écarté le reste, dans cet ordre :
--   1. les DEUX lignes portent un uid_che ⇒ deux CHE (l'index est UNIQUE) ⇒ deux
--      entités juridiques ⇒ jamais.
--   2. aucun mot distinctif partagé, mots de métier retirés ⇒ rien n'atteste la
--      même société (« FAMBAU Genossenschaft » / « Siedlungsgenossenschaft
--      Bethlehemacker »).
--   3. mot commun mais suffixes divergents ⇒ le REGISTRE tranche. Mesuré :
--      « Wirnsperger Hotel Betriebe AG » et « Wirnsperger Generalunternehmung AG »
--      sont deux inscriptions à Fehraltorf ; idem « CITY STAY AG » (Zürich) et
--      « CITY STAY Management GmbH » (Cham).
--
-- ⚠ LE SURVIVANT SE CHOISIT SUR LE NOMBRE D'ANNONCES, jamais sur l'ancienneté :
-- « Regimo Basel » en porte 274 contre 2 à sa jumelle, « Privera AG » 3609. Se
-- tromper de côté déclenche le ON DELETE SET NULL sur des milliers de lignes.
select a.id, a.name, b.id, b.name, coalesce(a.city, a.canton) as lieu,
       round(similarity(lower(a.name), lower(b.name))::numeric, 2) as sim,
       (select count(*) from public.market_listings m where m.agency_profile_id=a.id) ann_a,
       (select count(*) from public.market_listings m where m.agency_profile_id=b.id) ann_b,
       (a.uid_che is not null) ide_a, (b.uid_che is not null) ide_b
from public.agency_profiles a
join public.agency_profiles b
  on b.logo_url = a.logo_url and b.id > a.id
 and a.city is not null and lower(a.city) = lower(b.city)
where similarity(lower(a.name), lower(b.name)) < 0.4
order by lieu, a.name;

-- ═══ Sous-lignes « PARENT — suffixe » ═══════════════════════════════════════
-- Flatfox importe comme agences des noms de courtiers, des départements et des
-- noms doublés. Quand le PARENT existe lui-même comme ligne DANS LA MÊME VILLE,
-- le rattachement est certain — 33 lignes résorbées le 13.08.2026, d'où le 0 que
-- rend la requête aujourd'hui.
--
-- ⚠ LA CONTRAINTE « MÊME VILLE » EST CE QUI PROTÈGE LES SUCCURSALES. Sans elle,
-- les 16 bureaux « Wincasa AG — Baden/Basel/Chur/Lugano… » seraient absorbés par
-- le siège de Glattpark : ce sont des implantations réelles, pas du bruit.
--
-- ⚠ Quand le suffixe est LUI AUSSI une ligne existante, le libellé peut être
-- inversé (« Philipp Roth — Immowengi AG » : courtier en tête, agence en queue).
-- Retenir alors celle des deux qui porte le plus d'annonces.
select s.id, s.name as sous_ligne, p.id as parent_id, p.name as parent
from public.agency_profiles s
join public.agency_profiles p
  on lower(p.name) = lower(trim(split_part(s.name, '—', 1)))
 and lower(p.city) = lower(s.city) and p.id <> s.id
where s.name like '%—%' and s.city is not null
  and trim(substr(s.name, position('—' in s.name) + 1)) <> '';

-- ═══ Troisième signal : l'ADRESSE POSTALE ══════════════════════════════════
-- Le plus fort des trois, et le seul qui morde quand le nom ne dit RIEN. Flatfox
-- a saisi 20 bureaux Wincasa DEUX FOIS : une fois sous un toponyme nu (« Baden »,
-- « Bern PostParc »), une fois sous « Wincasa AG — X ». Aucun score lexical ne les
-- rapproche — « Basel Grosspeter » et « Wincasa AG — Basel » n'ont aucun mot en
-- commun — mais les deux portent « Grosspeteranlage 5+7 », au caractère près.
--
-- ⛔ IL FAUT LES DEUX, RUE **ET** COMMUNE — chacune seule ment, en sens inverse :
--   • la VILLE seule confond « Wincasa AG — Basel » (Grosspeteranlage) et
--     « — Basel Wohnen 1 » (Drahtzugstrasse), deux bureaux bâlois DISTINCTS ;
--   • la RUE seule confond les homonymes de voirie — « Bahnhofstrasse 1 » existe
--     dans des centaines de communes. Mesuré le 13.08.2026 : sans la commune la
--     requête rend 158 paires, avec elle 121 ; les 37 écartées sont des rues
--     homonymes dans des communes différentes.
--
-- Corroboration à exiger avant d'écrire — les cantons de la petite ligne doivent
-- être CONTENUS dans ceux de la grosse (Chur `GR` ⊂ `GL,GR,SG,SZ,TG,ZH`). Deux
-- géographies disjointes signalent un mauvais appariement, pas un doublon.
select a.name, b.name, a.address, a.city,
       (select count(*) from public.market_listings m where m.agency_profile_id=a.id) ann_a,
       (select count(*) from public.market_listings m where m.agency_profile_id=b.id) ann_b,
       (select string_agg(distinct m.canton, ',') from public.market_listings m where m.agency_profile_id=a.id) cantons_a,
       (select string_agg(distinct m.canton, ',') from public.market_listings m where m.agency_profile_id=b.id) cantons_b
from public.agency_profiles a
join public.agency_profiles b
  on lower(regexp_replace(b.address, '[^a-z0-9]', '', 'gi'))
   = lower(regexp_replace(a.address, '[^a-z0-9]', '', 'gi'))
 and lower(b.city) = lower(a.city)
 and b.id > a.id
where a.address is not null and a.address <> '' and a.city is not null
  and similarity(lower(a.name), lower(b.name)) < 0.5
order by a.city, a.address;

-- ═══ ⛔ FUSION AVEC RENOMMAGE : L'ORDRE EST CONTRAINT DANS LES DEUX SENS ═════
-- Le survivant est la ligne qui porte les ANNONCES (le toponyme nu, 228 contre 6),
-- mais c'est la jumelle qui porte le BON NOM. Le survivant doit donc être renommé,
-- et adopter le slug de la jumelle — sinon il reste `baden` sous le nom
-- « Wincasa AG — Baden », et le bon slug part à la poubelle avec la ligne supprimée.
--
--   1. PHOTOGRAPHIER slug + website_url de la jumelle  ← ils meurent avec elle
--   2. repointer market_listings vers le survivant
--   3. supprimer la jumelle (gardes sur les DEUX FK)
--   4. SEULEMENT LÀ renommer et adopter le slug        ← unique IMMÉDIAT
--
-- Les étapes 1 et 4 se contraignent en sens opposés : lire avant la suppression,
-- écrire après. Les inverser casse dans un cas ou dans l'autre.
-- ⚠ Il n'y a AUCUN trigger sur agency_profiles : renommer ne régénère pas le slug.
--
-- ⚠ NE PAS PROPAGER LE website_url DE LA LIGNE NUE. Deux portaient un site de
-- TIERS sur un bureau Wincasa (immo-lausanne.ch, gerancec.ch), écrits en avril
-- 2026 bien avant l'import RA. La fusion prend celui de la JUMELLE, ou rien.

-- ═══ ⛔ LA LEÇON QUI A COÛTÉ QUATRE ERREURS ═════════════════════════════════
-- 1. CLASSER LES LIGNES, JAMAIS LES PAIRES. Un premier tri par paire étiquetait
--    « bruit » une agence légitime dès qu'elle était appariée à du bruit —
--    « de Rham SA » (775 annonces) et « Regus » (445) s'y sont retrouvés.
-- 2. UN SCORE SUR LES MOTS COMMUNS NE RÉPOND PAS À « EST-CE UNE AGENCE ? ».
--    Une succursale et un centre commercial ont le même profil lexical ; seule
--    leur nature les sépare. 8 des 20 paires dites « haute confiance » ont dû
--    être écartées à la relecture (groupe vs filiale, succursales, adjectifs
--    géographiques pris pour des marques).
-- 3. QUAND LE NOM NE TRANCHE PAS, CHERCHER UNE CLÉ QUI N'EST PAS UN NOM.
--    L'adresse a apparié 20/20 là où aucune heuristique lexicale ne pouvait. La
--    table de correspondance, elle, proposait de verser les toponymes dans le
--    SIÈGE tout en gardant les jumelles — chaque bureau éclaté en deux parents.
-- 4. RELIRE LA LISTE AVANT D'ÉCRIRE. C'est ce qui a rattrapé les quatre fois.

-- ═══ ⛔ « GÈRE CET IMMEUBLE » ≠ « A UN BUREAU ICI » ═════════════════════════
-- Distinction qui décide si une ligne est une agence, et que trois vérifications
-- sur quatre ont d'abord manquée. Un gestionnaire administre des centaines
-- d'immeubles depuis quelques bureaux : trouver « Verwaltung : Wincasa AG » sur la
-- page d'un immeuble n'établit PAS une implantation.
--
-- ⛔ `implenia.com/standort` ÉNUMÈRE DES MANDATS, PAS DES BUREAUX. Source à ne pas
-- croire : elle place « Wincasa AG » à Klybeckstrasse 191 (immeuble de labos À
-- LOUER), donne 4 adresses bâloises distinctes, et écrit « Rue des Fléchère 7A »
-- sans le s. C'est elle qui alimentait les fausses adresses de ce lot.
-- Ce qui vaut : le site de l'EXPLOITANT quand il porte un courriel du domaine de
-- la société (stjakobpark@wincasa.ch) — l'occupant s'y déclare lui-même.
