-- Correctif de revue (etape 6) -- la file de revue KYB se pagine et annonce son total.
--
-- Modifie get_admin_agency_review_queue(), livree par 20260729151500_agency_review_queue.sql
-- (etape 5, tache 1). Le reste de ce fichier-la -- detail du dossier, quatre actions de
-- decision humaine -- n'est pas touche.
--
-- ── Pourquoi un fichier separe et non une reprise sur place ─────────────────────────
--
-- Tant que le chantier n'etait pas fusionne, ses correctifs de revue se faisaient SUR
-- PLACE dans 20260729151500 (voir son historique). Ce n'est plus possible : la migration
-- est desormais dans main, donc deja jouee. Or le deploiement n'applique QUE les fichiers
-- dont l'horodatage est >= la date du jour (.github/workflows/deploy.yml, « Apply Supabase
-- migrations ») -- une reprise sur place d'un fichier deja date d'hier ne serait rejouee
-- par personne. Pire : l'etape d'alerte qui rattrape les migrations sautees ne lit que les
-- fichiers AJOUTES par le push (`.commits[].added[]`), jamais les fichiers MODIFIES. Une
-- reprise sur place serait donc appliquee par rien ET signalee par rien, pendant que le
-- code de l'ecran, lui, partirait en attendant la nouvelle signature -- la file de revue
-- passerait de « silencieusement tronquee » a « cassee net » (PGRST202, fonction
-- introuvable). Un fichier AJOUTE, lui, est vu par l'alerte : si l'horodatage passe sous
-- la date du jour avant la fusion, l'omission devient visible au lieu d'etre silencieuse.
--
-- Idempotente, comme le reste du depot : DROP IF EXISTS, CREATE OR REPLACE, CREATE INDEX
-- IF NOT EXISTS, REVOKE/GRANT rejouables sans effet de bord. La rejouer sur une base qui
-- l'a deja recue ne fait rien de neuf.

-- ── CORRECTIF REVUE etape 6 : pagination reelle, et un total honnete ────────────────
--
-- Cette fonction ne portait AUCUN limit. PostgREST tronque toute reponse a max_rows
-- (supabase/config.toml, [api] max_rows = 1000) -- EN SILENCE : ni erreur, ni en-tete,
-- ni indicateur cote client. Passe 1000 agences en manual_review, la file se coupait
-- donc d'elle-meme, et comme le tri ci-dessus est CROISSANT, la troncature emportait la
-- QUEUE de la liste : les dossiers les MIEUX notes devenaient invisibles. Sur un
-- dispositif ou la revue humaine est l'UNIQUE voie de sortie (aucune agence ne peut
-- etre auto-validee aujourd'hui -- docs/agency-kyb-handoff.md §7bis), un dossier
-- invisible est un dossier bloque indefiniment. Reproduit en base avant correctif :
-- 1448 dossiers en manual_review, 1000 lignes rendues, score le plus haut visible 0.652
-- pour un maximum reel de 1.000 -- 448 dossiers hors d'atteinte.
--
-- Trois decisions, chacune contre un mode de defaillance distinct :
--
--   1. p_limit / p_offset (patron des RPC admin voisines, 20260726002000 :
--      `limit greatest(p_limit, 1) offset greatest(p_offset, 0)`) -- de quoi ATTEINDRE
--      un dossier quel que soit son rang.
--
--   2. p_limit PLAFONNE a 1000 (`least(..., 1000)`), la valeur de max_rows. Sans ce
--      plafond, un appelant demandant 5000 recevrait 1000 lignes en croyant les avoir
--      toutes : la troncature silencieuse reviendrait par la fenetre, deplacee mais
--      intacte. La RPC ne promet donc jamais plus que ce que la couche HTTP sait
--      delivrer. Ce 1000 DUPLIQUE volontairement config.toml -- une fonction SQL n'a
--      aucun moyen de lire la configuration PostgREST ; un changement de max_rows doit
--      se repercuter ici (et le test « ne rend jamais plus de lignes que PostgREST ne
--      peut en delivrer » le rappellera).
--
--   3. total_count -- combien de dossiers attendent AU TOTAL, pas seulement dans la
--      page. C'est LA donnee qui manquait : une file tronquee sans compteur est
--      indiscernable d'une file terminee. Dans la MEME requete (sous-requete scalaire)
--      plutot que via une seconde RPC : page et total partagent alors le meme
--      instantane, donc ne peuvent pas se contredire.
--
--      Sous-requete scalaire et NON `count(*) over ()`. Les deux ont ete mesurees
--      (EXPLAIN ANALYZE, requete REELLE de cette fonction -- toutes ses colonnes, pas
--      une version reduite qui donnerait un tout autre plan) :
--
--                          |  1 583 en attente  |  101 583 en attente
--        count(*) over ()  |      3.5 ms        |     79.4 ms
--        sous-requete      |      4.5 ms        |     22.1 ms
--
--      A taille realiste la fenetre gagne d'une milliseconde (elle parcourt l'ensemble
--      UNE fois la ou la sous-requete le parcourt deux fois) -- ecart sans consequence
--      sur un ecran d'administration. C'est la PENTE qui tranche : la fenetre doit voir
--      toutes les lignes AVANT le LIMIT, ce qui rend l'index de tri ci-dessous
--      inutilisable et force un tri de toute la file a chaque page ; la sous-requete
--      laisse la page etre servie par un Index Scan ordonne, sans noeud Sort. Retenue
--      pour cette raison, et pour elle seule : le defaut repare ici est precisement
--      « cela marchait tant que la file etait petite ». Choisir la variante qui se
--      degrade proprement quand la file grandit est la meme decision, prise deux fois.
--
--      PRIX A PAYER, a garder en tete : la sous-requete DUPLIQUE le predicat
--      `verification_status = 'manual_review'` du WHERE ci-dessous. Les deux doivent
--      bouger ENSEMBLE -- un filtre de file modifie d'un seul cote donnerait un total
--      qui ne compte pas les memes dossiers que la page, c'est-a-dire exactement le
--      genre de mensonge silencieux que ce correctif existe pour supprimer.
--
--      Un total EXACT, jamais approche : sur un dispositif LAB, « il reste environ 1200
--      dossiers » ne permet pas d'affirmer qu'aucun n'est oublie. Le comptage porte sur
--      le seul sous-ensemble manual_review (predicat indexe), jamais sur `agencies`
--      entiere -- distinct du `count: 'exact'` de PostgREST que proscrit CLAUDE.md §7,
--      qui compte une table complete.
--
-- Departage final `a.id asc` (AJOUT de ce correctif) : (verification_score,
-- identity_submitted_at) n'est PAS un ordre total -- deux dossiers peuvent partager les
-- deux (scores arrondis identiques, ou deux dossiers jamais scores soumis dans la meme
-- seconde). Sans troisieme cle, Postgres est libre de rendre ces ex aequo dans un ordre
-- different d'un appel a l'autre, et une pagination par OFFSET se met alors a sauter ou
-- a repeter des lignes d'une page a la suivante : un dossier qu'on ne voit jamais, le
-- defaut meme que ce correctif repare, en plus discret. `id` (uuid, unique, jamais nul)
-- rend l'ordre total, donc la pagination reproductible.
--
-- DROP explicite de la version sans argument (meme precedent que
-- admin_resolve_agency_id_document plus bas) : CREATE OR REPLACE ne sait pas changer le
-- type de retour -- total_count s'ajoute aux colonnes -- et, surtout, une signature
-- differente creerait une SURCHARGE plutot qu'un remplacement. Les deux versions
-- coexisteraient alors, et PostgREST refuserait l'appel sans argument, devenu ambigu.
-- Idempotent : `if exists` traverse sans bruit un deploiement ou seule la nouvelle
-- version a jamais existe.
drop function if exists public.get_admin_agency_review_queue();

create or replace function public.get_admin_agency_review_queue(
  p_limit  integer default 50,
  p_offset integer default 0
)
returns table (
  agency_id                   uuid,
  agency_name                 text,
  country                     text,
  verification_status         text,
  verification_score          numeric,
  identity_submitted_at       timestamptz,
  verification_sweep_attempts smallint,
  total_count                 bigint
)
language plpgsql
stable
security definer
set search_path to 'public'
as $$
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;

  return query
  select
    a.id,
    coalesce(a.legal_name, a.name),
    a.country,
    a.verification_status,
    a.verification_score,
    a.identity_submitted_at,
    a.verification_sweep_attempts,
    (select count(*) from public.agencies c where c.verification_status = 'manual_review')
  from public.agencies a
  where a.verification_status = 'manual_review'
  order by a.verification_score asc nulls first, a.identity_submitted_at asc, a.id asc
  limit least(greatest(p_limit, 1), 1000) offset greatest(p_offset, 0);
end;
$$;

comment on function public.get_admin_agency_review_queue(integer, integer) is
  'File de revue KYB (etape 5) : dossiers en manual_review, tries par verification_score croissant (NULLS FIRST -- un score jamais calcule est le cas le plus opaque, pas le moins urgent), les plus douteux en tete, departages par identity_submitted_at puis id. Sans colonne de priorite derivee : le tri suffit. Fait remonter, par le seul jeu de ce filtre, les dossiers que sweep_pending_agency_verifications() a bascules en manual_review apres avoir epuise ses tentatives (20260728150000). PAGINEE (CORRECTIF REVUE etape 6) : p_limit plafonne a 1000 = max_rows de PostgREST (supabase/config.toml) pour que la RPC ne promette jamais plus que ce que HTTP delivre, p_offset pour atteindre un dossier de n''importe quel rang, et total_count (sous-requete scalaire dans la meme requete -- jamais count(*) over (), qui rendrait l''index de tri inutilisable) pour dire combien de dossiers attendent AU TOTAL -- sans quoi une file tronquee est indiscernable d''une file terminee. Departage par id : sans ordre total, une pagination par OFFSET saute ou repete des lignes. super_admin uniquement (patron P3 : EXECUTE authenticated, garde interne is_super_admin()). Voir docs/superpowers/plans/2026-07-28-onboarding-kyb-etape-5.md.';

-- Partial index couvrant EXACTEMENT le WHERE + ORDER BY ci-dessus (regle perf
-- CLAUDE.md §7). Distinct de idx_agencies_verification_review (20260728101000, sur
-- verified_at -- un filtre different pour un autre usage) : verified_at ne sert a
-- rien ici, il vaut TOUJOURS NULL pour un dossier manual_review (pose uniquement sur
-- une conclusion positive du moteur -- recompute_agency_verification, 20260728130000,
-- etape 4). NULLS FIRST pose explicitement dans l'index pour correspondre AU TRI
-- DEMANDE et rester utilisable sans tri supplementaire en memoire.
--
-- LES TROIS colonnes du ORDER BY (correctif etape 6, ex-index sur le seul score) :
-- l'index doit couvrir le tri COMPLET, departage compris, sinon Postgres n'a d'autre
-- choix qu'un tri en memoire de toutes les lignes manual_review a chaque page.
--
-- Ce qu'il fait VRAIMENT, mesure plutot que suppose (EXPLAIN ANALYZE sur la requete
-- reelle de la fonction) : le planificateur ne le choisit PAS tant que la file est
-- petite -- a 1 583 dossiers en attente il prefere un Bitmap Scan sur l'index de statut
-- puis un quicksort de 1 583 lignes, moins cher que des acces disperses au tas ; a
-- 101 583 il bascule sur `Index Scan using idx_agencies_review_queue_order` et le noeud
-- Sort DISPARAIT. C'est donc un index qui ne sert a rien aujourd'hui et tout demain :
-- exactement le point ou cette file a deja echoue une fois. Le garder est le choix
-- assume ; il ne coute rien de plus en ecriture que celui qu'il remplace (ci-dessous).
create index if not exists idx_agencies_review_queue_order
  on public.agencies (verification_score asc nulls first, identity_submitted_at asc, id asc)
  where verification_status = 'manual_review';

-- L'index d'origine (score seul) est desormais un PREFIXE strict du precedent : il ne
-- peut plus rien servir que celui-ci ne serve mieux, et le garder ferait payer une
-- ecriture d'index de plus a chaque changement de statut de verification.
drop index if exists idx_agencies_review_queue_score;

-- ── Grants (patron P3 : EXECUTE authenticated, la garde interne filtre) ──────────────
-- Rejoues sur la NOUVELLE signature : ceux de la version sans argument sont partis avec
-- le DROP ci-dessus, une fonction recreee n'herite d'aucun droit de celle qu'elle remplace.
revoke all on function public.get_admin_agency_review_queue(integer, integer) from public, anon;
grant execute on function public.get_admin_agency_review_queue(integer, integer) to authenticated, service_role;
