-- =====================================================================
-- P8a — Annonces in-app ciblées (communication plateforme)
--
-- Table distincte d'admin_changelog (release-notes) : ciblage plan/agence +
-- fenêtre temporelle + dismissal par utilisateur sont étrangers à la
-- sémantique changelog. La VISIBILITÉ est portée par la RLS (pas d'edge) :
-- un agent ne voit une annonce que si elle est publiée, dans sa fenêtre, et
-- ciblée sur son plan/agence (ou universelle). Écriture super-admin seule.
-- Publication auditée par trigger (activity_events announcement_published).
-- =====================================================================

-- Plan de l'agence de l'appelant (pour la RLS de ciblage). SECURITY DEFINER :
-- lit agencies.plan sans exposer la table à l'agent.
create or replace function public.get_my_agency_plan()
returns text
language sql
stable
security definer
set search_path to 'public'
as $$
  select a.plan::text
  from public.agencies a
  join public.profiles p on p.agency_id = a.id
  where p.id = auth.uid()
$$;

comment on function public.get_my_agency_plan() is
  'Plan de l''agence de l''utilisateur courant — utilisé par la RLS de ciblage des annonces (P8a).';

-- ── Annonces ─────────────────────────────────────────────────────────────────
create table if not exists public.platform_announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text not null,
  severity text not null default 'info' check (severity in ('info','warning','critical')),
  audience_plans text[] not null default '{}',      -- {} = tous les plans
  audience_agencies uuid[] not null default '{}',   -- {} = toutes les agences
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  cta_label text,
  cta_href text,
  published boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.platform_announcements is
  'Annonces in-app ciblées par plan/agence + fenêtre (P8a). Visibilité par RLS. Écriture super-admin. Distinct d''admin_changelog (release-notes).';

create index if not exists idx_platform_announcements_active
  on public.platform_announcements (starts_at desc)
  where published;

alter table public.platform_announcements enable row level security;

-- Lecture : super-admin voit tout ; un agent voit une annonce publiée, dans sa
-- fenêtre, ciblée sur son plan/agence (ou universelle = tableau vide).
drop policy if exists "announcements_select" on public.platform_announcements;
create policy "announcements_select" on public.platform_announcements
  for select to authenticated
  using (
    public.is_super_admin()
    or (
      published = true
      and starts_at <= now()
      and (ends_at is null or ends_at > now())
      and (cardinality(audience_plans) = 0 or public.get_my_agency_plan() = any(audience_plans))
      and (cardinality(audience_agencies) = 0 or public.get_my_agency_id() = any(audience_agencies))
    )
  );

drop policy if exists "announcements_write" on public.platform_announcements;
create policy "announcements_write" on public.platform_announcements
  for all to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

-- ── Dismissals (par utilisateur) ─────────────────────────────────────────────
create table if not exists public.platform_announcement_dismissals (
  announcement_id uuid not null references public.platform_announcements (id) on delete cascade,
  user_id uuid not null,
  dismissed_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

alter table public.platform_announcement_dismissals enable row level security;

drop policy if exists "announcement_dismissals_self" on public.platform_announcement_dismissals;
create policy "announcement_dismissals_self" on public.platform_announcement_dismissals
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Audit de publication (trigger, false→true) ──────────────────────────────
create or replace function public.log_announcement_published()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if new.published = true and coalesce(old.published, false) = false then
    insert into activity_events
      (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
       category, severity, object_label, metadata)
    values (
      null, auth.uid(), 'user', 'announcement_published', 'announcement', new.id,
      'settings', 'info', new.title,
      jsonb_build_object('severity', new.severity,
                         'audience_plans', new.audience_plans,
                         'audience_agencies', new.audience_agencies)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_log_announcement_published on public.platform_announcements;
create trigger trg_log_announcement_published
  after insert or update of published on public.platform_announcements
  for each row execute function public.log_announcement_published();

-- ── Grants ───────────────────────────────────────────────────────────────────
revoke all on function public.get_my_agency_plan() from public, anon;
grant execute on function public.get_my_agency_plan() to authenticated;
