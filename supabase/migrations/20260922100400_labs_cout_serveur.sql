-- Labs — le coût fournisseur reste au SERVEUR (revue post-fusion de #1338, 21.09.2026).
--
-- `labs_assets.cost_chf` ne sortait pas de `src/`, mais il sortait de la BASE : la politique de
-- lecture ne restreignait aucune colonne, si bien que `select('*')`, le flux Realtime et les
-- réponses des edges portaient le coût à côté du prix en crédits — la marge, que CLAUDE.md §8
-- interdit de sortir de `_shared/credits.ts`. Même geste que 20260913170000 pour les colonnes
-- Stripe : `revoke select` sur la table, puis un grant CALCULÉ de toutes les autres colonnes.
-- Le bail de finalisation (`finalizing_until`, 20260922100300) est rangé avec lui.
--
-- ⛔ UN GRANT DE COLONNE NE RESTREINT RIEN tant que le GRANT DE TABLE survit : d'où le revoke
-- d'abord. Les colonnes accordées sont calculées pour qu'un rejeu et une base de CI donnent
-- l'état de la production.
--
-- ⚠ CONSÉQUENCE À CONNAÎTRE : une colonne ajoutée DEMAIN à `labs_assets` naît illisible pour
-- `authenticated` — l'accorder dans la migration qui la crée, ou l'ajouter ici aux secrètes.
-- Et un `select('*')` du client y répond 42501 : l'écran lit `LABS_ASSET_COLONNES`.
--
-- ⚠ HORODATAGE : voir 20260922100000 — à redater avec elle si la fusion glisse après le 22.09.
--
-- Rejouable : revoke puis grant recalculé, et un contrôle final dont chaque négatif a son témoin.

do $$
declare
  v_secretes constant text[] := array['cost_chf', 'finalizing_until'];
  v_cols text;
begin
  revoke select on table public.labs_assets from authenticated;
  select string_agg(quote_ident(c.column_name), ', ' order by c.ordinal_position)
    into v_cols
    from information_schema.columns c
   where c.table_schema = 'public'
     and c.table_name = 'labs_assets'
     and not (c.column_name = any (v_secretes));
  execute format('grant select (%s) on public.labs_assets to authenticated', v_cols);
end $$;

do $$
begin
  if has_column_privilege('authenticated', 'public.labs_assets', 'cost_chf', 'SELECT') then
    raise exception 'coût fournisseur : labs_assets.cost_chf reste lisible par authenticated';
  end if;
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'labs_assets' and column_name = 'finalizing_until')
     and has_column_privilege('authenticated', 'public.labs_assets', 'finalizing_until', 'SELECT') then
    raise exception 'coût fournisseur : le bail de finalisation reste lisible par authenticated';
  end if;
  -- Témoins : la galerie lit toujours ses colonnes, et filtre sur la corbeille.
  if not has_column_privilege('authenticated', 'public.labs_assets', 'url', 'SELECT')
     or not has_column_privilege('authenticated', 'public.labs_assets', 'deleted_at', 'SELECT') then
    raise exception 'coût fournisseur : labs_assets n''est plus lisible — la galerie tomberait en 42501';
  end if;
end $$;
