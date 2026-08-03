-- Today V2 « concept H » · LOT 4 — la session de relance devient reprenable.
--
-- Aujourd'hui la session ne vit que dans le `useState` de l'overlay : fermer la
-- fenêtre, changer d'onglet ou rafraîchir perd l'index, les compteurs et les
-- brouillons générés. L'agent recommence à zéro, et l'IA regénère ce qu'elle
-- avait déjà écrit — du temps perdu et des jetons repayés.
--
-- ═══ CE QU'ON STOCKE, ET POURQUOI C'EST ACCEPTABLE ════════════════════════════
-- `generated_text` est un brouillon de message à un client. Le dépôt stocke DÉJÀ
-- ce type de contenu — `reminders.draft_message` existe depuis le socle — et
-- c'est la donnée de l'agence sur ses propres contacts, cloisonnée par RLS
-- d'agence. On suit ce précédent plutôt que d'inventer un régime à part.
--
-- ⛔ On ne stocke AUCUN envoi : le geste central de la session reste COPIER
-- (handoff §2.4). `copied_at` dit que l'agent a pris le texte, pas qu'un message
-- est parti.
--
-- ═══ POURQUOI PAS DE RPC ══════════════════════════════════════════════════════
-- Les deux tables sont écrites par l'agent, sur ses propres lignes, sous une RLS
-- d'agence — exactement comme `reminders`. Une RPC par geste n'ajouterait qu'une
-- porte de plus à garder synchronisée, sans capacité nouvelle. C'est la même
-- conclusion qu'au Lot 2 pour « Reprendre ».

-- ── 1. La session ────────────────────────────────────────────────────────────
create table if not exists public.relance_sessions (
  id          uuid primary key default gen_random_uuid(),
  agency_id   uuid not null references public.agencies (id) on delete cascade,
  agent_id    uuid not null references auth.users (id) on delete cascade,
  started_at  timestamptz not null default now(),
  closed_at   timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.relance_sessions is
  'Session de relances de l''agent. Une session OUVERTE (closed_at null) est reprenable : ses items disent ce qui a déjà été traité.';

-- Une seule session ouverte par agent : sans ça, « reprendre » ne saurait pas
-- laquelle reprendre. L'index partiel l'impose au niveau de la base, pas de
-- l'applicatif — c'est la seule garantie qui survit à un double onglet.
create unique index if not exists relance_sessions_one_open_per_agent
  on public.relance_sessions (agent_id) where closed_at is null;

create index if not exists relance_sessions_agency_started
  on public.relance_sessions (agency_id, started_at desc);

alter table public.relance_sessions enable row level security;

drop policy if exists relance_sessions_rw_own on public.relance_sessions;
create policy relance_sessions_rw_own on public.relance_sessions
  for all to authenticated
  using (agent_id = auth.uid() and agency_id = public.get_user_agency_id())
  with check (agent_id = auth.uid() and agency_id = public.get_user_agency_id());

revoke all on table public.relance_sessions from anon;

-- ── 2. Les items ─────────────────────────────────────────────────────────────
-- `status` reprend le vocabulaire de l'overlay :
--   sent      = l'agent a copié ou envoyé (la relance est faite de son point de vue)
--   skipped   = passé, à représenter plus tard
--   discarded = « pas intéressé », sorti de la boucle
create table if not exists public.relance_items (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.relance_sessions (id) on delete cascade,
  agency_id      uuid not null references public.agencies (id) on delete cascade,
  contact_id     uuid not null references public.contacts (id) on delete cascade,
  status         text not null check (status in ('sent', 'skipped', 'discarded')),
  generated_text text,
  generated_at   timestamptz,
  copied_at      timestamptz,
  created_at     timestamptz not null default now()
);

comment on column public.relance_items.copied_at is
  'Horodate la COPIE du brouillon par l''agent. Ne dit RIEN d''un envoi : le geste central de la session est le copier-coller.';

-- Un contact ne figure qu'une fois par session : la reprise se lit par simple
-- différence entre la file du jour et les contacts déjà traités.
create unique index if not exists relance_items_one_per_contact_per_session
  on public.relance_items (session_id, contact_id);

alter table public.relance_items enable row level security;

drop policy if exists relance_items_rw_own on public.relance_items;
create policy relance_items_rw_own on public.relance_items
  for all to authenticated
  using (
    agency_id = public.get_user_agency_id()
    and exists (select 1 from public.relance_sessions s
                 where s.id = session_id and s.agent_id = auth.uid())
  )
  with check (
    agency_id = public.get_user_agency_id()
    and exists (select 1 from public.relance_sessions s
                 where s.id = session_id and s.agent_id = auth.uid())
  );

revoke all on table public.relance_items from anon;
