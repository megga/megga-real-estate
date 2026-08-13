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
--
-- ⛔ ET CE SIGNAL A DES FAUX NÉGATIFS — « logos différents » ne prouve RIEN.
-- Mesuré sur CBRE : `CBRE (Zürich) AG` porte `s6qxwnnglmy….jpg` quand les autres
-- lignes CBRE portent `louadjzkc01….jpg`, alors que les cinq appartiennent à la
-- MÊME organisation Flatfox (leurs annonces pointent toutes vers
-- `/fr/cbre-zurich-ag/`). Ce sont deux fichiers distincts captés à des dates de
-- synchronisation différentes, pas deux marques. ⇒ Un logo commun RAPPROCHE,
-- un logo différent n'ÉCARTE pas. Pour trancher, passer par le portail (section
-- « qu'est-ce que cette ligne ? » plus bas).
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
--
-- ⛔⛔ CETTE REQUÊTE NE VOIT QUE LE TIRET CADRATIN « — ». LE TIRET SIMPLE « - »
-- EN CACHAIT 97 AUTRES, sur 44 familles et 4145 annonces — invisibles pendant
-- tout le chantier. Chercher LES DEUX séparateurs, toujours.
--
-- ⛔ ET LA CONTRAINTE « MÊME VILLE » NE MARCHE PAS SUR CETTE FAMILLE-LÀ : la
-- plupart de ces sous-lignes n'ont AUCUNE ville. Le discriminant devient
-- l'ADRESSE PROPRE, et deux signaux objectifs qui ne lisent pas le suffixe :
--   • **adresse propre ⇒ implantation réelle, GARDER** (53 lignes ; ce sont
--     massivement les entrées d'annuaire RA, avec 0 annonce pour l'instant) ;
--     ⛔⛔ MAIS SEULEMENT SI L'ADRESSE VIENT DE L'ANNUAIRE. Voir juste dessous :
--     sur une ligne de source FLATFOX, l'adresse n'appartient pas à la ligne.
--   • **aucune adresse + annonces sur ≥ 5 CANTONS ⇒ ce n'est pas un bureau de
--     ville**, quel que soit son nom. « PREMIUM HOMES AG - Gerlafingen » couvre
--     23 cantons, « - Wallisellen » 20 : des flux, pas des agences ;
--   • **suffixe = la ville DU PARENT et pas d'adresse ⇒ flux du parent**
--     (« VAL Group SA - Sion » quand VAL Group SA siège à Sion) ;
--   • suffixe de TERRITOIRE (Ostschweiz, Ticino, « SUI - T 1 ») ou de FONCTION
--     (Vente, Vermarktung, Real Estate) ⇒ région commerciale ou département.
-- Résultat sur les 97 (13.08.2026) : **24 fusionnées (2896 annonces), 53 gardées,
-- 19 indécidables** — suffixe de ville SANS adresse ET avec des annonces
-- (« Valimmobilier SA - Martigny », 410). Là, seule la procédure du portail tranche.
--
-- ⚠ Le parent n'est pas forcément le plus riche : « ImmoSky AG » portait 1 annonce
-- contre 1158 à sa sous-ligne « Zentrale », et n'avait NI site NI logo quand elle
-- avait les deux. Repointer vers le parent (le nom propre) mais REMONTER ses trous
-- depuis la sous-ligne la plus fournie — 12 sites et 8 logos récupérés ainsi.
--
-- ═══ Trancher les indécidables : l'ANNUAIRE RA est la source primaire ═══════
-- ⛔ La procédure du portail Flatfox NE S'APPLIQUE PAS à ces lignes : les 19
-- indécidables sont toutes `source='realadvisor'` avec **0 annonce Flatfox**.
-- L'équivalent existe et il est LOCAL : `agencies.csv`, les 1236 fiches
-- d'annuaire collectées par ce dossier. Apparier sur le nom plié.
--   • **fiche propre AVEC adresse de rue ⇒ implantation reconnue, GARDER.**
--     11 des 19 en avaient une — dont « Valimmobilier SA - Martigny », Avenue de
--     la Gare 52, 1920 Martigny : ses **410 annonces** allaient être versées à
--     tort dans Conthey. C'est la vérification qui a le plus rapporté du lot.
--   • **ASYMÉTRIE : parent dans l'annuaire, enfant absent ⇒ libellé de flux.**
--     (« Swiss Patrimoine Immobilier SA - Agence de Genève », 202 annonces.)
--   ⚠ L'absence SEULE ne prouve rien : l'annuaire (1236) et le flux d'annonces
--     (4714 lignes RA) sont deux populations DISTINCTES, pas l'une incluse dans
--     l'autre. 7 lignes sont restées muettes faute de parent à l'annuaire.
--
-- ⚠ LE SEUIL DE 5 CANTONS A UN PLANCHER, et il laisse passer les petits
-- territoires : « ImmoSky AG - Bern » (BE+FR) et « - Basel » (BL+BS) n'en
-- couvrent que 2 et ont survécu au tri, alors qu'elles appartiennent visiblement
-- au MÊME schéma de nommage que les 7 territoires fusionnés (Aargau, Ostschweiz,
-- Ticino, Zentralschweiz…). ⇒ Après un tri par seuil, relire la FAMILLE entière :
-- une ligne isolée d'un schéma déjà tranché se range avec lui.
-- ⚠ Un suffixe en « c/o » est une DOMICILIATION, jamais une implantation.
--
-- ═══ Dernier crible, gratuit : le CONFINEMENT COMMUNAL ══════════════════════
-- Quand ni l'annuaire ni l'adresse ne disent rien, comparer les COMMUNES des
-- annonces (plus fin que les cantons utilisés pour les jumelles Wincasa) :
--   **communes de la sous-ligne ⊆ communes du parent ⇒ elle n'ouvre AUCUN
--   territoire, donc ce n'est pas une implantation ⇒ fusionner sans risque.**
-- Mesuré : « de Rham SA - Montreux » publiait à Blonay et Montreux, deux communes
-- où le parent publiait DÉJÀ (avec Clarens, Territet, Glion) ; « Arlewo AG -
-- Stans » n'avait qu'une annonce à Beckenried, déjà couverte. Fusion sûre.
-- ⛔ À l'inverse « Property One Partners AG - Pfäffikon SZ » ouvrait Arth et
-- Feusisberg, et « - Zug » ouvrait Risch : NON confinées. Fusionnées le
-- 13.08.2026 sur décision de Julien, **pas sur une preuve** — 13 annonces,
-- réversibles par `agency_name`. Le noter est le minimum.
--
-- ⛔ ORDRE DE PRÉSÉANCE quand les deux signaux se contredisent : **une fiche
-- d'annuaire avec ADRESSE DÉCLARÉE bat le confinement communal.** Mesuré :
-- « Valimmobilier SA - Collombey » et « - Brig » SONT confinées (le parent
-- publie déjà dans leurs communes) et seraient donc fusionnables par ce crible —
-- mais l'annuaire leur donne une rue à chacune (Route de la Fin 2A ; Rhonesand-
-- strasse 7). Une adresse est un fait DÉCLARÉ ; le confinement n'est qu'une
-- inférence tirée d'une distribution d'annonces, qui reflète le marché local
-- autant que l'organisation. Deux bureaux voisins se recouvrent forcément.
-- ⇒ Le confinement ne sert QUE là où l'annuaire est muet.
-- (Corollaire rassurant : 9 des 11 lignes conservées ne sont PAS confinées —
-- elles ouvrent des communes que le parent n'a pas. Les deux verdicts concordent
-- donc dans 9 cas sur 11.)
--
-- ⛔⛔ QUELLES ADRESSES SONT « DÉCLARÉES » — la nuance qui manquait ci-dessus.
-- **Sur une ligne de source FLATFOX, `address` N'EST PAS un attribut de la ligne :
-- c'est l'adresse d'UNE de ses annonces, prise au hasard de la synchro.** Mesuré
-- le 13.08.2026 sur « ImmoSky AG - Dübendorf » : le MÊME libellé d'annonceur,
-- sous l'organisation `immosky-zurich`, porte « Ringstrasse 18b, 8600 Dübendorf »
-- sur une annonce et « Spittelweg 2, 5034 Suhr » sur une autre — cette dernière
-- étant précisément l'adresse que l'ANNUAIRE donne à « ImmoSky AG - Standort
-- Suhr AG ». Un seul libellé couvre donc plusieurs bureaux.
-- ⇒ « adresse propre ⇒ implantation » ne vaut QUE pour les adresses issues de
--    l'ANNUAIRE RA (déclarées sur une fiche d'agence). Sur du flatfox, l'adresse
--    ne prouve rien et cette ligne-là a été fusionnée (493 annonces).
-- ⇒ Et si on remonte une telle adresse vers le parent, EXIGER qu'elle concorde
--    avec la commune déjà déclarée du parent — sans quoi on pose une adresse
--    argovienne sur une société zurichoise.
--
-- ⚠ CELA DIT LA MISE EN GARDE CI-DESSUS EST TROP LARGE, et voici sa mesure :
-- sur les **1213** lignes flatfox ayant une adresse ET des annonces, **1090
-- portent bien l'adresse de l'AGENCE** ; seules **123 (10 %)** reprennent celle
-- d'une de leurs annonces. L'adresse flatfox est donc utilisable la plupart du
-- temps — il faut simplement la TESTER au lieu de la croire ou de la rejeter.
--
-- ✅ ET LE TEST EST GRATUIT : **comparer l'adresse de la ligne à celles de SES
-- PROPRES annonces.**
--   • elle n'apparaît dans AUCUNE ⇒ c'est l'adresse de l'AGENCE, exploitable ;
--   • elle coïncide avec celle d'une annonce ⇒ suspecte, elle en vient sans doute.
-- Mesuré le 13.08.2026 : « Koch Immobilien » porte `Birgistrasse` alors que ses
-- 4 annonces sont toutes à Hertistrasse 29/31 ⇒ adresse d'agence, et le registre
-- inscrit *KOCH Group AG* à **Birgistrasse 3, Wallisellen** ⇒ **l'IDE détenu était
-- BON**, le doute levé dans le sens du maintien. Idem « Niederer AG Immobilien und
-- Verwaltungen » (Unterdorfstrasse 5 ; annonces à Bern, Ittigen, Worblaufen,
-- Zollikofen). À l'inverse « ImmoSky AG - Dübendorf » portait tour à tour deux
-- adresses d'annonces ⇒ inexploitable.
select a.name, a.address as adresse_ligne,
       not exists (select 1 from public.market_listings m
                   where m.agency_profile_id = a.id and m.address is not null
                     and lower(regexp_replace(m.address,'[^a-z0-9]','','gi'))
                       like lower(regexp_replace(a.address,'[^a-z0-9]','','gi')) || '%')
       as adresse_est_celle_de_l_agence
from public.agency_profiles a
where a.source = 'flatfox' and coalesce(a.address,'') <> ''
  and exists (select 1 from public.market_listings m where m.agency_profile_id = a.id);

-- ⚠ `market_listings.agency_name` n'est pas qu'un moyen de DÉFAIRE : c'est une
-- PREUVE. « Groupe Prisme » détenait l'IDE de *Prisme Immobilier SA* alors que
-- 2 de ses 3 libellés d'annonce disent « Groupe Prisme S.A. » / « Groupe Prisme
-- SA » — nom que le registre inscrit (CHE-105.698.572). La source se nomme
-- elle-même ; c'est plus fort qu'un rapprochement calculé.
select p.name as parent, s.name as sous_ligne,
       (select count(*) from public.market_listings m where m.agency_profile_id=s.id) as ann,
       not exists (
         select 1 from public.market_listings ms
         where ms.agency_profile_id = s.id and ms.city is not null
           and not exists (select 1 from public.market_listings mp
                           where mp.agency_profile_id = p.id and mp.city = ms.city)
       ) as communes_confinees
from public.agency_profiles s
join public.agency_profiles p
  on lower(p.name) = lower(trim(regexp_replace(s.name,' [-—] .*$',''))) and p.id <> s.id
where s.name ~ ' [-—] ' and coalesce(s.address,'') = ''
  and (select count(*) from public.market_listings m where m.agency_profile_id=s.id) > 0;

-- ═══ BILAN du chantier des sous-lignes (13.08.2026) ════════════════════════
-- 97 lignes à tiret sur 44 familles → **11 restantes**, toutes légitimes : ce
-- sont exactement les implantations que l'annuaire RA reconnaît, adresse à
-- l'appui (« Valimmobilier SA - Martigny » et ses 410 annonces en tête).
-- 3137 annonces regroupées sous le bon parent, aucune perdue, 0 orpheline.
-- ⇒ Le reliquat n'est pas un reste à traiter : c'est le RÉSULTAT.
-- Version couvrant LES DEUX séparateurs, avec les signaux qui décident. Trier
-- soi-même : `adresse_propre` ⇒ garder ; `nb_cantons` ≥ 5 sans adresse ⇒ fusionner.
select p.name as parent, s.name as sous_ligne,
       (select count(*) from public.market_listings m where m.agency_profile_id=p.id) as ann_parent,
       (select count(*) from public.market_listings m where m.agency_profile_id=s.id) as ann,
       coalesce(s.address,'') <> '' as adresse_propre,
       coalesce((select count(distinct m.canton) from public.market_listings m
                 where m.agency_profile_id=s.id), 0) as nb_cantons,
       lower(coalesce(p.city,'')) = lower(trim(regexp_replace(s.name, '^.*? [-—] ', ''))) as suffixe_est_ville_du_parent,
       s.id as id_sous_ligne, p.id as id_parent
from public.agency_profiles s
join public.agency_profiles p
  on lower(p.name) = lower(trim(regexp_replace(s.name, ' [-—] .*$', '')))
 and p.id <> s.id
where s.name ~ ' [-—] '
order by (select count(*) from public.market_listings m where m.agency_profile_id=s.id) desc;

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
--
-- ⛔ ET LE CONTRE-EXEMPLE QUI BORNE CE SIGNAL : UN SIÈGE DE GROUPE. Via Cantonale 3
-- à Manno abrite **7 sociétés Tarchini INSCRITES** (Brands SA, FoxTown SA, Luxury
-- Real Estate SA, Consulting SA, Real Estate SA, Residential Real Estate SA, la
-- Fondazione) — 18 « Tarchini » au registre en tout. Même adresse, même logo,
-- noms proches : toutes les corroborations concordent, et pourtant rien n'est
-- fusionnable. ⇒ Avant d'écrire sur un groupe d'adresse, INTERROGER LE REGISTRE
-- sur le token distinctif : plusieurs inscriptions à la même rue = plusieurs
-- sociétés. Le signal d'adresse rapproche des BUREAUX, pas des personnes morales.
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

-- ═══ ⛔ UNE LISTE DE PAIRES N'EST PAS UNE LISTE DE DÉCISIONS ════════════════
-- Piège rencontré sur Tarchini : « fusionne toutes les paires SAUF celle-ci » est
-- IRRÉALISABLE dès que les paires forment un groupe connexe. Sur 4 lignes,
-- Consulting↔Group et Consulting↔Residential réunissent Group et Residential par
-- TRANSITIVITÉ — donc exactement la paire qu'on voulait exclure.
-- ⇒ Une exclusion ne se décide pas paire par paire : elle se décide sur la LIGNE
-- (retirer Residential du groupe), ou le groupe entier reste intact.
-- ⚠ Corollaire pour les CSV d'arbitrage : n lignes à une adresse produisent
-- n(n-1)/2 paires — 3 lignes REMICOM ont donné 3 « paires », qui étaient UN seul
-- geste. Compter les GROUPES, pas les paires, avant d'annoncer un volume.

-- ═══ BILAN DE L'AUDIT DES uid_che (clos le 13.08.2026) ═════════════════════
-- 93 lignes de la classe à risque → **7 corrigées · 7 vidées · 3 sans erreur
-- après vérification · 0 ouverte**. `uid_che` renseignés : 594 → **587**.
-- ⚠ La baisse est le RÉSULTAT, pas une perte : 7 numéros désignaient une autre
-- société que la ligne qui les portait. Mieux vaut aucun IDE qu'un faux — le
-- check KYB `registry_lookup` rend alors `unavailable`, donc un dossier
-- visiblement incomplet plutôt qu'un verdict adossé à la mauvaise personne morale.

-- ═══ Vérifier un uid_che contre le registre ════════════════════════════════
-- LA SEULE MÉTHODE QUI MARCHE, en une phrase : **demander au registre ce qu'il
-- inscrit sous NOTRE numéro, et comparer au nôtre.** Sens IDE→nom, rapide
-- (~53 ms), exact, sans candidat ni score. `VALUES ?ident { "CHE…" "CHE…" }` en
-- résout 25 par requête ; les 93 tiennent en 4 lots.
-- ⚠ FORMATS INCOMPATIBLES : la base stocke `CHE-XXX.XXX.XXX` (594/594 lignes),
-- LINDAS rend `CHEXXXXXXXXX`. Convertir, sinon 0 résultat et fausse quiétude.
--
-- Résultat du 13.08.2026 sur les 93 : **55 portent exactement le nom inscrit,
-- 38 diffèrent**, dont **7 avec la signature de l'erreur Tarchini** — une ligne
-- d'exploitation qui détient l'IDE de sa maison mère, ou l'inverse (« Naef
-- Immobilier Genève » → *Naef Holding SA*, « keller real estate » → *Keller
-- Holding AG*, « Koch Immobilien » → *KOCH Group AG*…). Une société suisse n'a
-- qu'UN IDE : l'un des deux ment. Livré dans `uid-che-a-verifier.csv`.
--
-- ⛔ TROIS MÉTHODES ESSAYÉES AVANT, TOUTES FAUSSES — ne pas les refaire :
--  1. « le nom du registre ressemble-t-il au nôtre ? » (recouvrement de tokens)
--     → rend 93/93 concordants, **y compris sur l'erreur Tarchini** : « Tarchini
--     Group » et « Tarchini Real Estate SA » partagent leur unique token
--     distinctif. Un test aveugle à la classe qu'il vise est un VERT CREUX.
--     ⇒ Éprouver tout audit sur une erreur CONNUE avant de croire son résultat.
--  2. « quels concurrents portent le token distinctif ? » → sondait sur le token
--     le plus LONG, donc « lausanne » plutôt que « nicod », « genevoise » plutôt
--     qu'« alliance » : les toponymes gagnent en longueur. Et `LIMIT 30`
--     tronquait — 16 des 19 « suspects » affichaient exactement 30 candidats,
--     donc une liste arbitraire. Un plafond atteint ⇒ INDÉCIDABLE, pas « absent ».
--  3. conjonction de tous les tokens, accents pliés **de notre côté seulement** :
--     le registre garde les siens. Mesuré — `madorin` rend **0**, `madörin` rend
--     **51** ; `kappeli` 9, `käppeli` 231. Six « suspects » n'étaient que ça.
--
-- La requête ci-dessous isole la classe à risque (93 lignes) : nom sans forme
-- juridique en suffixe, ou portant « group »/« holding ».
--
-- ═══ CORRIGER un IDE suspect : la COMMUNE décide ═══════════════════════════
-- Une fois l'écart constaté, énumérer toute la PARENTÉ au registre (CONTAINS sur
-- le token distinctif, avec `schema:addressLocality`), puis croiser deux critères :
--
--   nom exact ET même commune        → correction MÉCANIQUE, rien à arbitrer
--   nom et commune se CONTREDISENT   → arbitrage humain, ne pas trancher seul
--
-- Mesuré le 13.08.2026 sur les 7 lignes « holding » : **5 mécaniques, 2 humaines**.
--   • « Naef Immobilier Genève » (Petit-Lancy) détenait *Naef Holding SA* alors que
--     « Naef Immobilier Genève SA, à Lancy » existe, MÊME commune. Idem Habitrust,
--     keller real estate, Swiss Residence Group — le bon IDE existait, inutilisé.
--   • ⛔ « Koch Immobilien » (Wallisellen) : « Koch Immobilien AG » existe mais à
--     Büttikon **AG**, autre canton ; la seule entité Koch de Wallisellen est
--     « KOCH Group AG », celle que nous détenons. Nom et ville se contredisent.
--   • ⛔ « Groupe Prisme » : « Groupe Prisme S.A. » ET « Prisme Immobilier SA »
--     coexistent dans LA MÊME commune. Le nom désigne l'une, l'activité l'autre.
--
-- ⚠ DEMANDER `schema:streetAddress`, PAS SEULEMENT LA COMMUNE — la RUE tranche
-- ce que la commune laisse ouvert, et elle a renversé 3 des 4 lignes « activité
-- divergente » (13.08.2026) :
--   • « Mentor Immobilier » (Seestrasse 33b, Wädenswil) et *MENTOR TREUHAND AG*
--     sont inscrites à la MÊME RUE ⇒ **aucune erreur**, l'IDE était bon.
--   • « Lehmann Immobilien » (Bahnhofstrasse 4, Langnau i.E.) détenait *Treuhand
--     Lehmann AG*, Mezenerweg 8a à BERNE ; à SA propre adresse est inscrite
--     *Lehmann AG Baumanagement* ⇒ correction, malgré un nom non identique.
--     L'adresse exacte prime sur le mot « Immobilien » dans la raison sociale.
--   • « Niederer AG Immobilien und Verwaltungen » : **4 sociétés Niederer à
--     l'Unterdorfstrasse 5** ⇒ l'adresse est ÉPUISÉE comme discriminant, comme
--     au siège Tarchini. Arbitrage humain.
--
-- ⛔ « ACTIVITÉ DIFFÉRENTE » (nous *Immobilien*, l'inscription *Treuhand*) N'EST
-- PAS UN INDICE — une fiduciaire suisse fait couramment de la gérance. Ce critère
-- a produit 4 signalements dont 1 seule vraie erreur. Ne pas s'en servir seul.
--
-- ═══ QUAND VIDER, ET QUAND S'ABSTENIR — « réfuté » ≠ « non établi » ════════
-- La distinction qui a structuré les 6 champs vidés, et qui ne se voit qu'après
-- coup :
--   • **RÉFUTÉ** — l'entité détenue est démontrablement une autre : autre canton,
--     société d'un autre nom, ou unique homonyme suisse à 200 km. ⇒ VIDER.
--     Fait sur `DELTA Immobilien` (Delta Treuhand AG, `c/o` Gümligen ; aucune
--     « Delta » immobilière du canton), `Rinesa Gjukaj` (0 annonce ; la SEULE
--     « Rinesa » du registre est à Vallorbe/VD quand la ligne est à Olten/SO) et
--     `Naef Immobilier` Vevey (détenait *Naef Immobilier **Nyon** SA*).
--   • **NON ÉTABLI mais plausible** — même canton, rien qui réfute. Vider est
--     alors une POSTURE (« pas d'IDE plutôt qu'un IDE non prouvé »), pas une
--     correction : c'est au propriétaire de la donnée de trancher.
--     Retiré sur décision de Julien le 13.08.2026, valeurs conservées ICI pour
--     pouvoir défaire :
--       `Minder Immobilien` (Oberburgstrasse 12, Burgdorf/BE) ← CHE-112.418.890
--            = Minder AG, Fenchern 1, Scheuren/BE
--       `Stefan Diethelm`   (Gärischstrasse 20, Bellach/SO)   ← CHE-101.103.809
--            = Diethelm Immobilien AG, Buchmattstrasse 52, Burgdorf/BE
--       `Reto Knuchel`      (Jurastrasse 1, Utzenstorf/BE)     ← CHE-103.044.431
--            = Knuchel Immobilien AG, Steinackerweg 13, Wiedlisbach/BE
--   • **SOUTENU mais NON UNIQUE** — quatrième situation, la plus inconfortable :
--     une preuve positive désigne l'entité détenue, mais elle en désigne
--     plusieurs à la fois. `Niederer AG Immobilien und Verwaltungen` : le test
--     d'adresse établit que l'Unterdorfstrasse 5 est bien celle de l'AGENCE (ses
--     21 annonces sont à Bern, Ittigen, Worblaufen, Zollikofen) et *Niederer AG
--     Services* y est inscrite — mais **4 sociétés Niederer partagent cette
--     adresse** (AG FM, AG Services, mobil in immobilien, Treuhand AG) et
--     l'homonyme EXACT de la ligne est à Muttenz (CHE-381.678.199). L'adresse
--     réduit à 4, pas à 1.
--     ⇒ Vider y détruit une information probablement juste : c'est une décision
--       de PRUDENCE, pas une correction. Prise par Julien le 13.08.2026.
--       Valeur retirée : **CHE-100.156.192** = Niederer AG Services,
--       Unterdorfstrasse 5, 3072 Ostermundigen.
--   • Les autres cas de ce type ont été RÉSOLUS et non vidés : `Groupe Prisme`
--     (corrigé vers CHE-105.698.572 — le NOM tranchait là où l'adresse ne
--     pouvait pas), `Koch Immobilien` (aucune erreur, le test d'adresse a
--     innocenté l'IDE détenu), `Bucher` (vidé : aucune adresse du tout, donc
--     « non établi » et non « soutenu »).
--
-- ⛔ QUAND AUCUN CANDIDAT NE CONVIENT, VIDER LE CHAMP plutôt qu'affirmer un faux.
-- « DELTA Immobilien » (Seftigen) détenait *Delta Treuhand AG*, `c/o` à Gümligen,
-- sans aucune société immobilière « Delta » dans le canton : lien fondé sur un
-- token générique. `uid_che = NULL` fait produire `unavailable` au check KYB
-- `registry_lookup` — un dossier visiblement incomplet, au lieu d'un verdict
-- adossé à la mauvaise personne morale, qui lui a l'air valide.
--
-- ═══ BILAN DE L'AUDIT DES 93 (clos le 13.08.2026) ═════════════════════════
--   55  le registre porte exactement notre nom
--   13  nom différent mais ADRESSE IDENTIQUE ⇒ libellé de portail, aucune erreur
--        (« AGENCE REMICOM GENEVE » = *REMICOM IMMOBILIER SA*, 584 annonces ;
--         « Regimo Zürich » = *Regimo AG*, 242 ; « Bernard Nicod Lausanne
--         Gérance » = *Bernard Nicod SA*, 64)
--    7  rue différente, même commune ⇒ siège inscrit vs bureau, ou `c/o`
--    6  CORRIGÉES vers la bonne société · 3 VIDÉES faute de candidat crédible
--    2  aucune erreur après vérification · 7 laissées à l'arbitrage humain
-- ⇒ La grande majorité des « écarts de nom » ne sont PAS des erreurs. Ne jamais
--    corriger sur le seul écart de raison sociale.
--
-- ✅ MOTIF POSITIF À RECONNAÎTRE — même nom inscrit, DEUX IDE, deux rues :
-- « Rosset Fribourg » et « Rosset Lausanne » mènent toutes deux à *Rosset SA
-- agence immobilière*, chacune à SA propre adresse et avec un CHE distinct.
-- C'est une société principale et sa succursale, correctement séparées : deux
-- lignes qui pointent le même NOM ne sont pas forcément un doublon.
--
-- ⚠ NORMALISER LES ABRÉVIATIONS DE VOIRIE avant de comparer deux adresses.
-- Ma comparaison a opposé « Rte de la Clochatte » à « Route de la Clochatte »
-- comme deux rues différentes. Traiter au moins Rte/Route, Av./Avenue,
-- Ch./Chemin, Pl./Place, str./strasse.
--
-- ⚠ TROIS PIÈGES DE CETTE ÉNUMÉRATION :
--  1. **chercher sur NOTRE nom, pas sur celui du registre.** J'ai interrogé
--     « residence immobilien » (le nom inscrit) et conclu qu'il n'y avait pas
--     d'alternative — alors que « Swiss Residence Group AG », notre nom, EXISTE
--     verbatim à Zoug. La question est « notre nom est-il inscrit ? ».
--  2. **commune ≠ localité.** « keller real estate » siège à Madetswil, qui est
--     un hameau de Russikon — notre ville. Une égalité stricte l'aurait écarté.
--  3. **une succursale a son PROPRE IDE.** « Interfida SA Lugano » a reçu celui
--     d'« Interfida SA succursale di Lugano » (nom ET ville concordants) plutôt
--     que celui d'« Interfida SA » (Chiasso). Choix défendable, pas forcé.
select a.name, a.uid_che, replace(replace(a.uid_che,'-',''),'.','') as ide_pour_lindas
from public.agency_profiles a
where a.uid_che is not null
  and (a.name !~* '(AG|SA|GmbH|Sàrl|Sagl)$' or a.name ~* 'group|holding')
order by a.name;

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

-- ═══ « QU'EST-CE QUE CETTE LIGNE ? » — LA SOURCE EST LE PORTAIL ════════════
-- À faire AVANT toute décision sur une ligne au nom opaque (« Bern », « Zug »,
-- « Jessica — Gabbani »). ⛔ Ne PAS partir chercher sur le site de l'entreprise
-- présumée : la ligne ne vient pas de là. Elle vient d'un portail, et c'est le
-- portail qui dit ce qu'elle est. Mesuré sur « Bern » (Laupenstrasse 19), que
-- trois recherches web contradictoires n'avaient pas tranché :
--
--   1. récupérer une annonce encore vivante de la ligne (requête ci-dessous) ;
--   2. l'ouvrir : son bloc « Annonceur » porte un lien vers la fiche
--      d'ORGANISATION du portail — ici `/fr/wincasa/listings/` ;
--   3. cette fiche donne la raison sociale — « Wincasa AG ». Tranché.
--   4. recouper avec le `logo_url` : même fichier = même organisation.
--
-- ⚠ LA STRUCTURE FLATFOX EXPLIQUE TOUTE CETTE CLASSE DE LIGNES, confirmée trois
-- fois (Wincasa, CBRE, REMICOM) : **UNE organisation, un libellé d'annonceur
-- LIBRE par annonce**, au format `<DESK> <ADRESSE>` — « AGENCE REMICOM PME Route
-- de Frontenex 58 Bis 1207 Genève ». Notre sync fabrique une `agency_profile` par
-- libellé distinct. D'où, pour une seule société : 22 lignes Wincasa, 4 CBRE,
-- 9 REMICOM. Quand le desk n'a pas de nom, le libellé se réduit à l'adresse —
-- d'où « Bern » (Laupenstrasse 19). Le nom opaque EST le symptôme, pas un mystère.
-- ⚠ Le slug de la ligne portant la raison sociale vaut souvent l'identifiant
-- d'organisation du portail : `cbre-zurich-ag` ↔ `/fr/cbre-zurich-ag/`.

-- ═══ ✅ COMMENT DÉFAIRE UNE DE CES FUSIONS ══════════════════════════════════
-- `market_listings.agency_name` conserve le libellé d'annonceur d'ORIGINE sur
-- chaque annonce, 1:1 avec la ligne dont elle venait, et la fusion n'y touche pas
-- (elle ne bouge que `agency_profile_id`). ⇒ Inutile de sauvegarder les
-- identifiants d'annonces avant de fusionner : recréer la ligne, puis
--     update market_listings set agency_profile_id = <ligne recréée>
--      where agency_name = '<libellé exact>';
-- Vérifié sur REMICOM : après fusion, la survivante genevoise porte 3 libellés
-- distincts et la neuchâteloise 2 — exactement les lignes absorbées.
-- Ne reste à sauvegarder que les MÉTADONNÉES des lignes supprimées (slug,
-- claim_token, created_at), que rien d'autre ne porte.
select a.name, m.agency_name, count(*) as n
from public.market_listings m
join public.agency_profiles a on a.id = m.agency_profile_id
where a.name = 'AGENCE REMICOM GENEVE'
group by 1, 2 order by 3 desc;
-- Remplacer le `name` par celui de la ligne à identifier ; l'exemple est la ligne
-- qui a servi de cas d'école (elle s'appelait « Bern » avant d'être tranchée).
select m.source_url, m.agency_name, m.city, m.canton
from public.market_listings m
join public.agency_profiles a on a.id = m.agency_profile_id
where a.name = 'Wincasa AG — Bern'
  and m.source_url is not null
order by m.updated_at desc nulls last
limit 3;

-- ⚠ REPLI QUAND LES ANNONCES SONT MORTES — Flatfox rend **410 Gone** sur les
-- annonces retirées, et un échantillon entier peut être périmé (4 sur 4, mesuré).
-- La fiche d'ORGANISATION, elle, survit : `https://flatfox.ch/fr/<slug>/listings/`
-- répond 200 et son `<title>` donne la raison sociale de l'annonceur. Le slug se
-- devine depuis le nom, ou se lit sur une annonce encore vivante d'une ligne
-- SŒUR. Mesuré : `/fr/niederer/` → « Niederer AG Immobilien und Verwaltungen »,
-- ce qui a validé la fusion alors qu'aucune annonce de la survivante ne répondait.

-- ═══ ⛔ COMPARER DEUX ADRESSES NORMALISÉES SANS GARDE-FOU DE VIDE ═══════════
-- Le piège le plus bête et le plus coûteux de ce chantier, évité de justesse.
-- `regexp_replace(NULL_ou_vide, …)` rend `''` des DEUX côtés, donc l'égalité est
-- VRAIE. Une exploration des lignes « - Standort » m'a ainsi rendu 4 paires
-- « même rue » qui étaient 4 paires d'adresses ABSENTES. J'allais les documenter
-- comme une classe de doublons.
-- ⇒ Toute comparaison d'adresse exige `and coalesce(x.address,'') <> ''` sur les
--    DEUX côtés. Idem pour la ville, le logo, l'IDE : `md5('')` = `d41d8cd9…`
--    rapproche joyeusement toutes les lignes SANS logo.
--
-- Ce que les 12 lignes « - Standort » sont VRAIMENT (mesuré, 13.08.2026) : deux
-- groupes DISJOINTS, ce qui interdit d'en faire une classe de doublons —
--   • 4 SANS adresse mais AVEC les annonces (« ImmoSky AG - Standort Dübendorf ZH
--     (Zentrale) » en porte 1158) : ce sont des lignes dérivées du flux d'annonces
--     RA, où `address`/`city` sont NULL par construction ;
--   • 8 AVEC une adresse complète (NPA compris) et **0 annonce** : celles-là
--     viennent de l'annuaire RA, importées par ce dossier.
-- Aucune paire ne partage donc une rue. Le seul vrai doublon inter-sources
-- rencontré est « Kocher Immobilien AG » (flatfox, 276 ann.) ↔ « … - Standort
-- Solothurn » (RA, 0 ann.), même nom ET même rue — traité le 13.08.2026.
-- ⚠ L'adresse RA porte le NPA (« Schmiedengasse 25, 4500 Solothurn ») là où celle
-- de Flatfox ne l'a pas : couper au premier virgule avant de comparer.
-- ⚠ Et la ligne RA n'est PAS la plus pauvre : celle de Solothurn (0 annonce)
-- portait le SEUL site web du couple. Remonter les trous avant de supprimer,
-- même quand la perdante paraît vide.
-- ⛔ Ne PAS reprendre son `source_id` : il identifie chez RealAdvisor, et le poser
-- sur une ligne `source='flatfox'` lui ferait mentir sur sa provenance.
select s.name, s.city, s.source,
       (select count(*) from public.market_listings m where m.agency_profile_id=s.id) as ann,
       p.name as parent, p.source as parent_source
from public.agency_profiles s
join public.agency_profiles p
  on lower(p.name) = lower(trim(split_part(s.name, ' - Standort ', 1))) and p.id <> s.id
 and coalesce(p.address,'') <> '' and coalesce(s.address,'') <> ''      -- ⛔ le garde-fou
 and lower(regexp_replace(p.address,'[^a-z0-9]','','gi'))
   = lower(regexp_replace(split_part(s.address,',',1),'[^a-z0-9]','','gi'))
where s.name like '% - Standort %'
order by s.name;

-- ⛔ CE QUI NE MARCHE PAS, mesuré le 13.08.2026 — ne pas y repasser :
-- • **le site de l'entreprise** : wincasa.ch rend ses adresses côté client, sa
--   charge RSC n'en contient AUCUNE, la carte est derrière un mur de consentement
--   (qu'on n'accepte pas sans l'accord de Julien) et son robots.txt interdit
--   `/api/`, d'où elles viennent. Sa page de contact ne donne qu'une case postale.
-- • **le registre du commerce** : Wincasa n'a QU'UNE inscription
--   (CHE-106.840.111, Theaterstrasse 17, 8400 Winterthur) et ZÉRO succursale.
--   Le RC ne connaît pas les bureaux, il ne tranchera jamais une question
--   d'implantation. Il tranche en revanche le SIÈGE, et vaut mieux que n'importe
--   quel annuaire pour ça.

-- ═══ Le NOM DÉCOUPÉ AU MAUVAIS ENDROIT — invisible aux requêtes de nom ══════
-- Flatfox scinde parfois un nom d'agence n'importe où, et notre sync en fait des
-- lignes. Mesuré sur de Rham SA (Avenue Mon-Repos 14, Lausanne) : **10 libellés
-- d'annonceur pour UNE agence**, dont `de — SA`, `de — de Rham SA`,
-- `Jessica — Gabbani`, `Jessica Gabbani — Jessica Gabbani` (une courtière).
-- ⛔ AUCUNE requête « PARENT — suffixe » ne les trouve : elles cherchent un parent
-- nommé « de » ou « Jessica », qui n'existe pas. **Le nom lui-même est corrompu,
-- donc tout crible fondé sur le nom est aveugle par construction.**
-- ⇒ Seule l'ADRESSE les rattache. Deux pièges dans le crible ci-dessous, mesurés :
--   ⛔ **`Postfach` (et `c/o`, `.`) est une adresse VIDE déguisée** — le garde-fou
--      `<> ''` ne l'attrape pas, et elle apparie alors toutes les lignes qui n'ont
--      qu'une case postale (« Spross Lebensräume AG » ↔ « BVK »…). Les exclure.
--   ⛔ **Une rue partagée n'est pas une société partagée** : « kade & partner ag »
--      et ImmoSky sont toutes deux Ringstrasse 18b — un immeuble de bureaux.
--      Ce crible SUGGÈRE, il ne conclut pas ; c'est le NOM tronqué qui confirme
--      (un fragment du nom du parent, ou un prénom+nom de personne).
select p.name as agence, p.address, count(*) as fragments, sum(f.ann) as annonces
from public.agency_profiles p
join lateral (
  select s.id, s.name,
         (select count(*) from public.market_listings m where m.agency_profile_id=s.id) as ann
  from public.agency_profiles s
  where s.id <> p.id
    and lower(regexp_replace(s.address,'[^a-z0-9]','','gi'))
      = lower(regexp_replace(p.address,'[^a-z0-9]','','gi'))
    and lower(coalesce(s.city,'')) = lower(coalesce(p.city,''))
    and similarity(lower(s.name), lower(p.name)) < 0.55
) f on true
where p.uid_che is not null           -- l'agence « réelle » est celle qui a un IDE
  and coalesce(p.address,'') <> ''
  and p.address !~* '^\s*(postfach|case postale|c/o|casella|\.)\s*$'   -- ⛔ adresses vides déguisées
  and p.address ~ '[0-9]'                                             -- une vraie rue a un numéro
group by p.id, p.name, p.address
order by annonces desc;

-- ⚠ CETTE TABLE DÉCRIT QUI GÈRE, PAS QUI POSSÈDE. « PVS der Burgergemeinde Bern »
-- est la caisse de pension de la bourgeoisie — une entité juridique distincte —
-- mais domiciliée « p. A. Domänenverwaltung », c'est-à-dire chez son gestionnaire.
-- Elle a donc été versée dans la ligne du gestionnaire (13.08.2026). Choix de
-- MODÉLISATION, réversible : si un propriétaire institutionnel doit garder sa
-- propre ligne, ressortir ses annonces par `agency_name`.

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
