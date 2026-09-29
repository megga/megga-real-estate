-- Labs — la finalisation d'une vidéo se RÉSERVE (revue post-fusion de #1338, 21.09.2026).
--
-- Chaque écran ouvert sondait toutes les 5 s sans attendre le tour précédent, et
-- `labs-video-status` finalisait sans verrou : le mux payant, la copie R2 et l'événement
-- d'audit étaient refaits en parallèle, et un échec concurrent pouvait réécrire `ready` en
-- `failed` — vidéo livrée ET remboursée. Un BAIL de quelques minutes, pris par une mise à
-- jour conditionnelle dans la base (horloge unique), ne laisse passer qu'un finaliseur ;
-- les autres appels rendent la ligne telle quelle.
--
-- La colonne `finalizing_until` est figée pour un agent (trigger de garde) et restera
-- illisible pour lui (20260922100400, qui la range avec le coût fournisseur).
--
-- ⚠ HORODATAGE : voir 20260922100000 — à redater avec elle si la fusion glisse après le 22.09.
--
-- Rejouable : ADD COLUMN IF NOT EXISTS, CREATE OR REPLACE, et un contrôle final.

alter table public.labs_assets add column if not exists finalizing_until timestamptz;

comment on column public.labs_assets.finalizing_until is
  'Bail de finalisation d''une vidéo (labs_asset_claim_finalize) : un seul appel de labs-video-status '
  'multiplexe, recopie et écrit ready/failed. Colonne serveur, illisible par authenticated.';

-- Le trigger de garde fige ce qu'un agent ne peut pas changer : le bail en fait partie.
create or replace function public.tg_labs_assets_guard()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.created_by := auth.uid();
    end if;
    new.created_at := now();
    return new;
  end if;
  if auth.uid() is not null then
    new.agency_id := old.agency_id;
    new.created_by := old.created_by;
    new.kind := old.kind;
    new.status := old.status;
    new.prompt := old.prompt;
    new.voiceover_text := old.voiceover_text;
    new.voiceover_voice := old.voiceover_voice;
    new.voiceover_lang := old.voiceover_lang;
    new.voiceover_url := old.voiceover_url;
    new.source_asset_id := old.source_asset_id;
    new.url := old.url;
    new.thumbnail_url := old.thumbnail_url;
    new.width := old.width;
    new.height := old.height;
    new.duration_s := old.duration_s;
    new.aspect_ratio := old.aspect_ratio;
    new.model := old.model;
    new.provider := old.provider;
    new.provider_request_id := old.provider_request_id;
    new.provider_status_url := old.provider_status_url;
    new.provider_response_url := old.provider_response_url;
    new.error_code := old.error_code;
    new.cost_chf := old.cost_chf;
    new.credits := old.credits;
    new.finalizing_until := old.finalizing_until;
    new.metadata := old.metadata;
    new.created_at := old.created_at;
    new.completed_at := old.completed_at;
  end if;
  return new;
end;
$$;

-- Le bail : une mise à jour CONDITIONNELLE. Rend `true` au seul appelant qui l'obtient.
create or replace function public.labs_asset_claim_finalize(p_asset uuid, p_agency uuid, p_lease_seconds integer default 180)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  pris uuid;
begin
  update public.labs_assets
     set finalizing_until = now() + make_interval(secs => greatest(30, least(coalesce(p_lease_seconds, 180), 900)))
   where id = p_asset
     and agency_id = p_agency
     and status in ('pending', 'generating')
     and (finalizing_until is null or finalizing_until < now())
  returning id into pris;
  return pris is not null;
end;
$$;

revoke all on function public.labs_asset_claim_finalize(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.labs_asset_claim_finalize(uuid, uuid, integer) to service_role;

do $$
begin
  if has_function_privilege('authenticated', 'public.labs_asset_claim_finalize(uuid, uuid, integer)', 'EXECUTE') then
    raise exception 'bail vidéo : labs_asset_claim_finalize est appelable par un agent';
  end if;
  if position('finalizing_until' in pg_get_functiondef('public.tg_labs_assets_guard()'::regprocedure)) = 0 then
    raise exception 'bail vidéo : le trigger de garde laisse un agent poser le bail';
  end if;
end $$;
