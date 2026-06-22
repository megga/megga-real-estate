-- Chantier B · Phase 1 — Met sous source control la table ai_copilot_conversations.
--
-- Contexte : la table a été créée hors-migration en prod (orpheline) pour stocker
-- l'historique des conversations agent ↔ copilote MEGGA AI. Elle est vide et n'a
-- encore AUCUN writer (la persistance arrive en Phase 2). Cette migration la
-- reproduit À L'IDENTIQUE (table + index + trigger updated_at + RLS) de façon
-- IDEMPOTENTE : no-op sur la prod existante, reproductible sur une base fraîche.
-- Aucune donnée touchée, aucun writer ajouté ici.

-- ── Table ────────────────────────────────────────────────────────────────────
create table if not exists public.ai_copilot_conversations (
  id              uuid        primary key default gen_random_uuid(),
  agency_id       uuid        not null references public.agencies(id) on delete cascade,
  user_id         uuid        not null references auth.users(id) on delete cascade,
  title           text        not null default 'Nouvelle conversation',
  messages        jsonb       not null default '[]'::jsonb,
  last_message_at timestamptz not null default now(),
  archived        boolean     not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ── Index : conversations récentes non archivées d'un utilisateur ─────────────
create index if not exists idx_ai_copilot_conv_user_recent
  on public.ai_copilot_conversations (user_id, last_message_at desc)
  where archived = false;

-- ── Trigger updated_at (BEFORE UPDATE) ────────────────────────────────────────
create or replace function public.ai_copilot_conv_touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_ai_copilot_conv_touch on public.ai_copilot_conversations;
create trigger trg_ai_copilot_conv_touch
  before update on public.ai_copilot_conversations
  for each row execute function public.ai_copilot_conv_touch_updated_at();

-- ── RLS : chaque agent ne voit/modifie que SES conversations ──────────────────
-- SELECT/UPDATE/DELETE : user_id = auth.uid(). INSERT : borné en plus à l'agence
-- de l'agent (get_user_agency_id() — helper SECURITY DEFINER déjà source-controlé).
alter table public.ai_copilot_conversations enable row level security;

drop policy if exists ai_copilot_conv_owner_select on public.ai_copilot_conversations;
create policy ai_copilot_conv_owner_select
  on public.ai_copilot_conversations
  for select to authenticated
  using (user_id = auth.uid());

drop policy if exists ai_copilot_conv_owner_insert on public.ai_copilot_conversations;
create policy ai_copilot_conv_owner_insert
  on public.ai_copilot_conversations
  for insert to authenticated
  with check (user_id = auth.uid() and agency_id = public.get_user_agency_id());

drop policy if exists ai_copilot_conv_owner_update on public.ai_copilot_conversations;
create policy ai_copilot_conv_owner_update
  on public.ai_copilot_conversations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists ai_copilot_conv_owner_delete on public.ai_copilot_conversations;
create policy ai_copilot_conv_owner_delete
  on public.ai_copilot_conversations
  for delete to authenticated
  using (user_id = auth.uid());
