-- Étape 27 — « What's new » : le chemin de LECTURE agent (§5.10, plan Lot 3).
--
-- Deux choses ici, dont une qui n'était pas au programme.
--
-- ═══ 1. UNE FUITE : `anon` pouvait lire toutes les nouveautés publiées ═══════════════
--
-- Mesuré en base, pas déduit d'un fichier :
--   · le baseline accorde `GRANT ALL ON public.admin_changelog TO anon` ;
--   · l'étape 21 n'a révoqué que l'ÉCRITURE (`revoke insert, update, delete, truncate`) ;
--   · sa policy `admin_changelog_select` n'a AUCUNE clause `TO`, elle porte donc sur `public`
--     — `anon` compris — et sa première branche est `published = true`.
--
-- Résultat : n'importe quel visiteur non authentifié lisait le titre, le contenu, la
-- version et l'`author_id` (l'UUID d'un super-admin) de chaque nouveauté publiée. Le test
-- « LA PORTE D'ÉCRITURE est fermée » n'éprouvait qu'INSERT/UPDATE/DELETE : la lecture n'a
-- jamais été regardée.
--
-- La table sœur montre la forme correcte : `platform_announcements` déclare sa policy
-- `for select TO authenticated`. C'est l'écart qu'on referme.
--
-- ═══ 2. L'ENDPOINT DE LECTURE, ET POURQUOI IL EXISTE ════════════════════════════════
--
-- ⚠ DIVERGENCE ASSUMÉE ENTRE LES DEUX DOCUMENTS. §5.10 dit seulement « la page Aujourd'hui
-- lit les entrées publiées (RLS lecture published) » — donc une lecture directe de table
-- suffirait à sa lettre. Le PLAN, lui, dit « endpoint lecture agent ». Rien ne tranche.
--
-- On prend l'endpoint, pour une raison mesurée et non par goût du détour : **la RLS filtre
-- des LIGNES, jamais des COLONNES**. Une lecture directe expose à tout agent `author_id`
-- (qui a écrit la nouveauté), `status`, `scheduled_for` et `updated_at` — le calendrier
-- éditorial interne de MEGGA. Il faudrait que CHAQUE appelant pense à restreindre son
-- `select`, et le premier qui l'oublie rouvre la fuite sans que rien ne rougisse. Une
-- projection posée une fois au serveur ne s'oublie pas.
--
-- Second motif, mesuré aussi : le hook existant trie par `created_at`, alors que la carte
-- agent affiche une date de PUBLICATION. Une nouveauté rédigée en juin et publiée en août
-- sortirait au mauvais rang. L'endpoint trie par `published_at`.
--
-- ⚠ CE QUI N'EST PAS ICI, ET POURQUOI. La carte côté agent n'est pas construite : la
-- maquette qu'`admin-communications.jsx` désigne (`today-h-live.jsx`, `HL_NEWS`) N'EXISTE
-- PAS au dépôt — seul son aperçu miniature côté console. Et la pilule « Nouveau » de cet
-- aperçu n'a aucune source : il n'existe aucun état lu/non-lu pour cette table, et §5.10
-- interdit d'emprunter celui de `platform_announcements` (Q10, table dormante). Inventer
-- l'un ou l'autre serait fabriquer une décision produit.

-- ── 1. La fuite ────────────────────────────────────────────────────────────────────
revoke select on table public.admin_changelog from anon;

drop policy if exists admin_changelog_select on public.admin_changelog;
create policy admin_changelog_select on public.admin_changelog
  for select
  to authenticated
  using (published = true or public.is_super_admin());

-- ── 2. L'endpoint ──────────────────────────────────────────────────────────────────
create or replace function public.get_agent_changelog(p_limit integer default 20)
returns table (
  id           uuid,
  title        text,
  content      text,
  version      text,
  published_at timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_limit integer;
begin
  -- Garde explicite plutôt que le seul GRANT. Le dépôt a déjà payé le « footgun » des
  -- privilèges par défaut : un `GRANT ALL TO anon` posé par une migration ultérieure
  -- rouvrirait la porte en silence. Ici, même avec le GRANT, un appelant sans identité
  -- est refusé.
  if auth.uid() is null and not public.is_service_role() then
    raise exception 'forbidden: authenticated only' using errcode = '42501';
  end if;

  v_limit := least(greatest(coalesce(p_limit, 20), 1), 50);

  return query
  select c.id, c.title, c.content, c.version, c.published_at
    from public.admin_changelog c
   -- `published` et non `status` : c'est `published` qui est la vérité de la RLS, et une
   -- contrainte d'accord interdit désormais aux deux de diverger. Filtrer explicitement
   -- plutôt que de s'en remettre à la RLS : cette fonction est DEFINER, elle la contourne,
   -- et un filtre écrit noir sur blanc se relit.
   where c.published = true
   -- L'ordre de la carte agent : date de PUBLICATION. `nulls last` couvre les lignes
   -- historiques d'avant l'étape 21, dont `published_at` peut être vide.
   order by c.published_at desc nulls last, c.created_at desc
   limit v_limit;
end;
$function$;

revoke all on function public.get_agent_changelog(integer) from public, anon;
grant execute on function public.get_agent_changelog(integer) to authenticated, service_role;
