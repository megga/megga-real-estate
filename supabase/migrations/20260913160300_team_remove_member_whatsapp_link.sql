-- Un membre retiré d'une agence perd AUSSI son copilote WhatsApp (audit du 13.09.2026,
-- point S9, même racine que la réclamation d'invitation).
--
-- ⛔ CE QUI RESTAIT OUVERT. `whatsapp-agent` ne tire pas l'agence de l'APPARTENANCE mais du
-- LIEN : `whatsapp_agent_links.agency_id`, pour le lien vérifié du numéro qui écrit
-- (whatsapp-agent/index.ts, « l'agence vient du lien VÉRIFIÉ »). Tous les outils du copilote
-- se bornent ensuite à ce seul `ctx.agencyId`. Or `team_remove_member` passait le profil à
-- `agency_id = NULL, role = 'buyer'` et vidait la pile d'onglets (20260913130000), sans
-- toucher au lien. Un agent licencié gardait donc, depuis son téléphone, la recherche, la
-- création et la mise à jour de contacts et de deals DANS l'agence qui venait de le retirer.
--
-- LE GESTE : le lien du membre retiré est VIDÉ comme le fait `unlink_whatsapp_number`
-- (numéro, vérification, appairage et OTP en cours effacés ; `otp_sent_count` et
-- `otp_window_started_at` SURVIVENT, sinon un retrait remettrait le quota à zéro) et son
-- `agency_id` suit le profil, à NULL. Pas de « ré-hébergement » possible ici : la personne
-- ne rejoint aucune agence. Son numéro retombe sur le chemin CLIENT du webhook, ce qu'il est
-- désormais.
--
-- ⚠ La piste d'audit du lien (20260911000100) recensait TROIS gestes qui basculent
-- `verified` et exigeait une trace pour chacun. Celui-ci est le quatrième : il écrit
-- `whatsapp_number_unlinked`, même forme que la déliaison volontaire, avec
-- `metadata.via = 'member_removed'` — l'acteur est celui qui retire, l'agence est celle du
-- LIEN, jamais le numéro complet (`phone_tail`). Seulement si une preuve existait : vider un
-- lien jamais vérifié ne retire rien et ne ferait que bruiter le journal.
--
-- Corps repris de 20260913130000 (garde super-admin, puis admin/manager de la même agence,
-- purge de `crm_open_tabs` sur les deux branches). La vérification d'autorisation est seulement
-- remontée avant un tronc commun, pour ne pas écrire deux fois le même départ.
--
-- ⚠ HORODATAGE : comme toute migration du dépôt, sautée sans bruit si mergée après le
-- 13.09.2026 (date-guard de deploy.yml). La renommer au jour du merge.

create or replace function public.team_remove_member(p_member_id uuid)
returns void
language plpgsql security definer
set search_path to 'public'
as $function$
DECLARE
  v_uid           uuid := auth.uid();
  v_caller_role   text;
  v_caller_agency uuid;
  v_target_agency uuid;
  v_link          public.whatsapp_agent_links%rowtype;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_member_id = v_uid THEN RAISE EXCEPTION 'cannot remove yourself'; END IF;

  IF NOT public.is_super_admin() THEN
    SELECT role, agency_id INTO v_caller_role, v_caller_agency FROM public.profiles WHERE id = v_uid;
    SELECT agency_id INTO v_target_agency FROM public.profiles WHERE id = p_member_id;

    IF v_caller_role NOT IN ('admin', 'manager') OR v_caller_agency IS NULL
       OR v_target_agency IS DISTINCT FROM v_caller_agency THEN
      RAISE EXCEPTION 'forbidden: agency admin/manager of the same agency required' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.profiles SET agency_id = NULL, role = 'buyer' WHERE id = p_member_id;
  -- La pile d'onglets porte des noms de clients de l'agence quittée (20260913130000).
  DELETE FROM public.crm_open_tabs WHERE user_id = p_member_id;

  -- Le lien WhatsApp suit la personne (voir l'en-tête). FOR UPDATE : une confirmation d'OTP
  -- concurrente attend ce retrait au lieu de revérifier un lien qu'on est en train de vider.
  SELECT * INTO v_link FROM public.whatsapp_agent_links WHERE profile_id = p_member_id FOR UPDATE;
  IF FOUND THEN
    UPDATE public.whatsapp_agent_links
       SET agency_id = NULL,
           wa_number = NULL,
           verified = false,
           verified_at = NULL,
           pairing_code = NULL,
           pairing_expires_at = NULL,
           pending_number = NULL,
           otp_hash = NULL,
           otp_expires_at = NULL,
           otp_attempts = 0
     WHERE id = v_link.id;

    IF v_link.verified THEN
      INSERT INTO public.activity_events
        (agency_id, actor_id, actor_kind, action, entity_type, entity_id,
         category, severity, metadata)
      VALUES (
        v_link.agency_id, v_uid, 'user', 'whatsapp_number_unlinked',
        'whatsapp_agent_link', v_link.id,
        'settings', 'info',
        jsonb_build_object(
          'profile_id', p_member_id,
          'phone_tail', right(regexp_replace(v_link.wa_number, '\D', '', 'g'), 4),
          'via', 'member_removed'
        )
      );
    END IF;
  END IF;
END;
$function$;

alter function public.team_remove_member(uuid) owner to postgres;
revoke all on function public.team_remove_member(uuid) from public, anon;
grant execute on function public.team_remove_member(uuid) to authenticated, service_role;

-- ASSERTION : la fonction lit bien le lien, et reste appelable par qui doit l'appeler.
do $$
begin
  if position('whatsapp_agent_links' in pg_get_functiondef('public.team_remove_member(uuid)'::regprocedure)) = 0 then
    raise exception 'S9 : team_remove_member ne touche pas whatsapp_agent_links';
  end if;
  -- Contrôle positif : la purge des onglets (20260913130000) n'a pas été perdue en route.
  if position('crm_open_tabs' in pg_get_functiondef('public.team_remove_member(uuid)'::regprocedure)) = 0 then
    raise exception 'S9 : team_remove_member a perdu la purge de crm_open_tabs';
  end if;
  if has_function_privilege('anon', 'public.team_remove_member(uuid)', 'EXECUTE') then
    raise exception 'S9 : team_remove_member est exécutable par anon';
  end if;
  if not has_function_privilege('authenticated', 'public.team_remove_member(uuid)', 'EXECUTE') then
    raise exception 'S9 : team_remove_member n''est plus exécutable par authenticated — la gestion d''équipe tombe';
  end if;
end
$$;
