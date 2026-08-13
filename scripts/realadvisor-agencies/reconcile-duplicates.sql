-- Réconciliation des doublons d'agency_profiles — joué le 13.08.2026.
--
-- Contexte : agency_profiles accumule la même société sous plusieurs graphies
-- (« Amma Immo » / « Amma Immo Sàrl », « Wincasa AG » / « Wincasa SA »), parce
-- que flatfox-sync et le rattachement RealAdvisor y écrivent chacun avec la
-- graphie de leur source. Au 13.08.2026 : 106 doublons issus de l'import RA du
-- jour, puis 260 groupes préexistants — 6654 lignes ramenées à 6283.
--
-- ⛔ LE RISQUE N'EST PAS LE DOUBLON, C'EST LA CLÉ ÉTRANGÈRE.
--   market_listings.agency_profile_id est en ON DELETE SET NULL
--     ⇒ supprimer un doublon DÉTACHE SES ANNONCES EN SILENCE. 3570 annonces
--       étaient concernées ; sans repointage préalable on défait une partie du
--       rattachement de la PR #1009 sans qu'aucune erreur ne le signale.
--   agent_profiles.agency_profile_id est en NO ACTION
--     ⇒ la suppression ÉCHOUE (bruyant, donc moins dangereux).
--
-- ⛔ L'ORDRE EST IMPOSÉ — ne pas fusionner ces trois étapes en un seul énoncé :
--   les CTE modifiantes de Postgres partagent un snapshot et s'exécutent dans un
--   ordre non spécifié, ce qui rend le résultat indéterminé.
--
-- Avant de rejouer : passer chaque étape en SELECT de comptage d'abord. Les
-- suppressions ne sont pas réversibles.

-- ── Étape 0 — capturer les uid_che à transférer ────────────────────────────
-- uid_che est sous index UNIQUE PARTIEL et IMMÉDIAT : le survivant ne peut porter
-- la valeur qu'une fois le perdant supprimé. Il faut donc la lire MAINTENANT,
-- sinon elle meurt avec la ligne à l'étape 2.
with norm as (
  select id, name, source, phone, uid_che, logo_url, website_url, source_id, created_at,
         regexp_replace(regexp_replace(lower(unaccent(name)),
           '\y(sa|s\.a\.|sarl|s\.a\.r\.l\.|sagl|gmbh|ag|ltd|llc|co|und|and)\y',' ','g'),
           '[^a-z0-9]+','','g') as nu          -- raison sociale NUE : c'est la clé de regroupement
  from public.agency_profiles
),
grp as (select nu from norm where nu <> '' group by nu having count(*) > 1),
membres as (select n.* from norm n join grp g on g.nu = n.nu),
mlc as (select agency_profile_id id, count(*) c from public.market_listings
        where agency_profile_id is not null group by 1),
ranked as (
  -- Survivant = le plus d'ANNONCES d'abord (c'est la ligne que l'écosystème
  -- connaît), puis la richesse, puis l'ancienneté. Ce classement reste STABLE
  -- après l'étape 1 : le survivant récupère toutes les annonces, les perdants
  -- tombent à 0 — l'étape 2 peut donc le recalculer sans mémoriser d'ids.
  select m.*, coalesce(c.c,0) as n_ann,
         row_number() over (partition by m.nu order by
           coalesce(c.c,0) desc,
           (m.phone is not null)::int + (m.uid_che is not null)::int
         + (m.logo_url is not null)::int + (m.website_url is not null)::int
         + (m.source_id is not null)::int desc,
           m.created_at, m.id) as rk
  from membres m left join mlc c on c.id = m.id
)
select g.id as gagnant, p.uid_che
from ranked p join ranked g on g.nu = p.nu and g.rk = 1
where p.rk > 1 and p.uid_che is not null and g.uid_che is null;

-- ── Étape 1 — repointer les annonces, puis enrichir le survivant ───────────
-- On ne remplit que les TROUS du survivant : il peut porter un phone ou un
-- uid_che que le perdant n'a pas. Corollaire assumé : quand les deux ont la
-- valeur, celle du perdant est perdue (mesuré : ~97 tél., ~81 logos, 15 sites).
-- source_id n'est repris que si le survivant est source='realadvisor' — un uuid
-- RA sur une ligne flatfox lui ferait mentir sur sa provenance.
--
-- [voir le corps complet dans l'historique de la PR ; même CTE `ranked` que
--  ci-dessus, puis :
--    update market_listings set agency_profile_id = <gagnant> where agency_profile_id = <perdant>
--    update agency_profiles set <champ> = coalesce(<champ>, <apport du perdant>) ]

-- ── Étape 2 — supprimer les perdants, avec garde-fou ───────────────────────
-- Le `not exists` n'est pas décoratif : si un perdant portait encore une annonce,
-- le ON DELETE SET NULL l'orphelinerait. Mieux vaut l'épargner et enquêter.
-- Attendu après l'étape 1 : 0 épargné.
--   delete from agency_profiles
--   where id in (<perdants>)
--     and not exists (select 1 from market_listings ml where ml.agency_profile_id = agency_profiles.id)
--     and not exists (select 1 from agent_profiles ap where ap.agency_profile_id = agency_profiles.id);

-- ── Étape 3 — transférer les uid_che capturés à l'étape 0 ──────────────────
--   update agency_profiles a set uid_che = <che>
--   where a.id = <gagnant> and a.uid_che is null
--     and not exists (select 1 from agency_profiles b where b.uid_che = <che>);
--
-- ⚠ Vérification faite le 13.08.2026 : 2 uid_che ont été perdus (survivant et
-- perdant en portaient chacun un, DIFFÉRENT). Contrôle au registre LINDAS des 14
-- groupes candidats : le CHE conservé existe au registre dans les 14 cas, et une
-- entreprise suisse n'a qu'UN seul IDE — les paires fusionnées n'étant que des
-- variantes d'écriture (AG↔SA, GmbH↔Sàrl sont la même forme en DE et FR), les 2
-- valeurs tombées étaient de mauvaises attributions. La perte est une correction.
