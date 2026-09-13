-- Un agent parti ne lit plus les contacts qu'il a créés (audit du 13.09.2026, point S2).
--
-- ⛔ CE QUE LA POLICY DISAIT. `contacts_select` vivait dans la baseline avec
--     using (agency_id = get_my_agency_id() OR user_id = auth.uid())
-- La seconde branche servait la MARKETPLACE : un acheteur inscrit lisait sa propre fiche.
-- La marketplace est désactivée depuis juin 2026 ; ce qui reste de la branche est un
-- trou : `useContacts.ts` pose `user_id = user.id` sur CHAQUE contact créé par un agent,
-- et `team_remove_member` ne touche jamais `contacts.user_id`. Un agent licencié, ou
-- passé chez un concurrent, garde donc — depuis sa propre session, sans autre geste —
-- la lecture de tous les contacts qu'il a saisis : nom, e-mail, téléphone, notes, date de
-- naissance, adresse, scores. Lecture seule, sans expiration.
-- Mesuré en prod le 13.09.2026 : 0 contact sur 16 porte encore un `user_id` — le trou est
-- latent, il se remplirait avec l'usage. La messagerie (`mail_account_visible`) a déjà été
-- écrite avec `agency_id AND …` pour exactement ce scénario de départ.
--
-- Même racine, plus faible, sur deux tables par utilisateur :
--   · `ai_copilot_conversations` — les transcriptions du copilote portent le contexte
--     client de l'ancienne agence ; leurs policies gagnent la condition d'agence ;
--   · `crm_open_tabs` — la pile d'onglets porte des NOMS de clients dans ses libellés ;
--     `team_remove_member` la vide au départ (la table n'a pas d'agence : c'est le seul
--     moment où l'on sait que la personne sort).

-- ═══════════════════════════════════════════════════════════════════════════
-- CONTACTS — lecture par l'agence, et par elle seule
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists contacts_select on public.contacts;
create policy contacts_select on public.contacts
  for select to authenticated
  using (agency_id = public.get_my_agency_id());

comment on policy contacts_select on public.contacts is
  'Lecture par l''agence seule. La branche `user_id = auth.uid()` (marketplace) est retirée '
  'le 13.09.2026 : elle laissait un agent parti lire les contacts qu''il avait créés.';

-- ═══════════════════════════════════════════════════════════════════════════
-- CONVERSATIONS DU COPILOTE — à soi, ET dans son agence courante
-- ═══════════════════════════════════════════════════════════════════════════
drop policy if exists ai_copilot_conv_owner_select on public.ai_copilot_conversations;
create policy ai_copilot_conv_owner_select
  on public.ai_copilot_conversations
  for select to authenticated
  using (user_id = auth.uid() and agency_id = public.get_user_agency_id());

drop policy if exists ai_copilot_conv_owner_update on public.ai_copilot_conversations;
create policy ai_copilot_conv_owner_update
  on public.ai_copilot_conversations
  for update to authenticated
  using (user_id = auth.uid() and agency_id = public.get_user_agency_id())
  with check (user_id = auth.uid() and agency_id = public.get_user_agency_id());

drop policy if exists ai_copilot_conv_owner_delete on public.ai_copilot_conversations;
create policy ai_copilot_conv_owner_delete
  on public.ai_copilot_conversations
  for delete to authenticated
  using (user_id = auth.uid() and agency_id = public.get_user_agency_id());

-- ═══════════════════════════════════════════════════════════════════════════
-- DÉPART D'UN MEMBRE — la pile d'onglets part avec lui
-- ═══════════════════════════════════════════════════════════════════════════
-- Corps repris À L'IDENTIQUE de 20260627120000 (garde super-admin, puis admin/manager
-- de la même agence) ; seule la purge de `crm_open_tabs` est ajoutée, sur les deux branches.
create or replace function public.team_remove_member(p_member_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE
  v_uid uuid := auth.uid();
  v_caller_role text;
  v_caller_agency uuid;
  v_target_agency uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_member_id = v_uid THEN RAISE EXCEPTION 'cannot remove yourself'; END IF;

  IF public.is_super_admin() THEN
    UPDATE public.profiles SET agency_id = NULL, role = 'buyer' WHERE id = p_member_id;
    DELETE FROM public.crm_open_tabs WHERE user_id = p_member_id;
    RETURN;
  END IF;

  SELECT role, agency_id INTO v_caller_role, v_caller_agency FROM public.profiles WHERE id = v_uid;
  SELECT agency_id INTO v_target_agency FROM public.profiles WHERE id = p_member_id;

  IF v_caller_role NOT IN ('admin', 'manager') OR v_caller_agency IS NULL
     OR v_target_agency IS DISTINCT FROM v_caller_agency THEN
    RAISE EXCEPTION 'forbidden: agency admin/manager of the same agency required' USING ERRCODE = '42501';
  END IF;

  UPDATE public.profiles SET agency_id = NULL, role = 'buyer' WHERE id = p_member_id;
  -- La pile d'onglets porte des noms de clients de l'agence quittée (20260913130000).
  DELETE FROM public.crm_open_tabs WHERE user_id = p_member_id;
END;
$function$;
