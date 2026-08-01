-- Étape 19 — la régénération de lien KYC cesse de détruire ce qu'elle ne sait pas remplacer.
--
-- CE QUI NE VA PAS AUJOURD'HUI. La RPC promet un geste ATOMIQUE que la spec écrit en trois
-- temps — « invalide l'ancien lien, en émet un nouveau, le dépose côté agence »
-- (HANDOFF_KYC_DIAGNOSTIC §4). Elle n'en exécute qu'un : elle expire l'ancien lien, dépose
-- l'émission dans l'outbox, journalise `kyc_link_regenerate`, et rend `regenerated_at`.
--
-- Or AUCUN CONSOMMATEUR D'OUTBOX N'EXISTE (mesuré sur tout le dépôt : zéro appelant de
-- admin_outbox_claim hors tests ; le seul cron outbox est une purge ; outbox_jobs = 0 ligne).
-- Le lien de la cliente cesse donc de fonctionner, le remplaçant ne part jamais, et le
-- registre — infalsifiable, chaîné — atteste d'une régénération qui n'a pas eu lieu.
--
-- Une entrée manquante est un trou : on la voit, on la comble. Une entrée FAUSSE et scellée
-- est pire, parce qu'elle sera crue. Tout le Lot 2 sert à rendre ce registre digne de foi ;
-- y laisser une affirmation fausse attaque la propriété qu'on construit.
--
-- POURQUOI NE PLUS EXPIRER, PLUTÔT QUE REFUSER OU QUE TOUT GARDER. Les sept documents de
-- spec ne décrivent QU'UN scénario : « une agence signale que sa cliente n'a jamais reçu son
-- lien ». Aucun ne parle d'un lien compromis qu'il faudrait tuer — « invalider » n'y apparaît
-- qu'une fois, comme CONSÉQUENCE de la réémission, jamais comme le but. Sous ce scénario,
-- expirer sans remplacer est le pire des trois états possibles : la cliente avait peut-être
-- le lien (il dormait dans ses indésirables), et on vient de le lui retirer.
--
-- L'invalidation n'est donc pas abandonnée : elle est DÉPLACÉE là où elle a du sens, avec
-- l'émission, chez celui qui saura faire les deux. Le drapeau `expire_previous` la porte
-- dans la charge du job.
--
-- ⚠ CE QUE CETTE MIGRATION NE RÉPARE PAS, et qu'il faut savoir : le worker d'outbox n'existe
-- toujours pas, donc la réémission reste EN ATTENTE. La différence est qu'on ne détruit plus
-- rien et qu'on ne l'écrit plus comme un succès. Mesuré au passage : le coût du worker est
-- bien plus faible qu'estimé — `executeSendKycLink` (_shared/whatsapp-actions.ts) frappe déjà
-- un jeton et crée une ligne EN SERVICE-ROLE, hors UI. C'est le patron d'un consommateur.

create or replace function public.admin_kyc_link_regenerate(
  p_link_id uuid,
  p_motive_agency_id uuid,
  p_motive_ref text,
  p_idempotency_key text)
returns jsonb
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_lien record;
  v_job  uuid;
begin
  if not (public.is_super_admin() or public.is_service_role()) then
    raise exception 'forbidden: super_admin only' using errcode = '42501';
  end if;
  if p_motive_agency_id is null or coalesce(btrim(p_motive_ref), '') = '' then
    return public.admin_error('precondition_failed',
      'Indiquez l''agence qui signale et la référence du signalement.');
  end if;
  if coalesce(btrim(p_idempotency_key), '') = '' then
    return public.admin_error('precondition_failed', 'Clé d''idempotence manquante.');
  end if;

  -- ORDRE DES VERROUS (§10.2 amendé) : entité D'ABORD, état ensuite, chaîne du journal en
  -- dernier. L'inverse produit un interblocage 40P01 dès que deux gestes touchent le même
  -- lien — et admin_log_write prend la chaîne, donc l'appeler avant serait l'erreur.
  perform public.admin_lock_entity('kyc_link', p_link_id);

  select l.id, l.status, l.agency_id, l.kyc_case_id, l.contact_id
    into v_lien
    from public.kyc_magic_links l
   where l.id = p_link_id;

  if v_lien.id is null then
    return public.admin_error('not_found', 'Ce lien est introuvable.');
  end if;
  if v_lien.status = 'submitted' then
    -- Régénérer un parcours DÉJÀ terminé n'aiderait personne et relancerait une cliente qui
    -- a fini. Le handoff décrit un lien « jamais reçu », pas un dossier complet.
    return public.admin_error('precondition_failed',
      'Ce parcours est déjà terminé : il n''y a pas de lien à réémettre.');
  end if;
  if v_lien.status = 'expired' then
    -- Nouveau refus : un lien déjà expiré n'a plus rien à invalider, et redemander son
    -- émission empilerait des jobs identiques. L'état EST la garde, comme sur le changelog.
    return public.admin_error('precondition_failed',
      'Ce lien est déjà expiré : demandez-en un nouveau depuis la fiche du dossier.');
  end if;

  -- ── La clé d'idempotence, prise APRÈS les refus et non avant ───────────────────
  -- Les refus ci-dessus sont des `return` : la transaction COMMITTE. La clé réservée plus
  -- haut resterait donc consommée, non scellée, par un geste qui n'a rien fait — et le
  -- réessai avec la même clé répondrait `already_done`, un FAUX SUCCÈS. Le verrou d'entité
  -- au-dessus tient déjà la course entre deux appels simultanés ; la clé ne protège que du
  -- rejeu, et n'a de sens qu'une fois le geste engagé.
  if not public.admin_receipt_try(p_idempotency_key, 'admin_kyc_link_regenerate') then
    return public.admin_ok(jsonb_build_object('already_done', true));
  end if;

  -- ⚠ PLUS D'`update ... status = 'expired'` ICI. C'était la moitié destructrice d'un geste
  -- dont l'autre moitié ne peut pas s'exécuter en SQL. Invalider l'ancien lien appartient
  -- désormais à celui qui émettra le nouveau, dans le même souffle : `expire_previous`.
  v_job := public.admin_outbox_enqueue('notify', jsonb_build_object(
    'kind', 'kyc_link_regenerate',
    'agency_id', v_lien.agency_id,
    'kyc_case_id', v_lien.kyc_case_id,
    'contact_id', v_lien.contact_id,
    'previous_link_id', p_link_id,
    -- Le consommateur DOIT expirer l'ancien lien une fois le nouveau frappé, et seulement
    -- alors. C'est le contrat que cette RPC ne pouvait pas honorer seule.
    'expire_previous', true,
    -- Le lien régénéré est REMIS À L'AGENCE (§2 du handoff) : la console n'envoie jamais
    -- rien au client final elle-même.
    'deliver_to', 'agency'));

  -- L'action DIT ce qui a eu lieu : une DEMANDE. La ligne de complétion appartient au
  -- consommateur, quand il existera — deux lignes pour deux faits, plutôt qu'une seule qui
  -- affirme le second avant qu'il ne soit vrai. (`action` n'a pas de vocabulaire fermé :
  -- seules `family` et `severity` portent une FK.)
  perform public.admin_log_write(
    p_family => 'link', p_action => 'kyc_link_regenerate_requested', p_severity => 'warn',
    p_entity_type => 'kyc_link', p_entity_id => p_link_id,
    p_entity_label => 'réémission demandée',
    p_agency_id => p_motive_agency_id,
    p_metadata => jsonb_build_array(
      jsonb_build_object('l', 'Motif', 'v', p_motive_ref),
      jsonb_build_object('l', 'Agence du lien', 'v', coalesce(v_lien.agency_id::text, '—')),
      jsonb_build_object('l', 'Remise', 'v', 'à l''agence'),
      jsonb_build_object('l', 'Ancien lien', 'v', 'conservé jusqu''à l''émission'),
      jsonb_build_object('l', 'État', 'v', 'en attente d''émission')));

  perform public.admin_receipt_seal(p_idempotency_key, jsonb_build_object('job', v_job));

  -- §4 : succès + horodatage, PAS le lien lui-même. Mais l'horodatage nomme désormais ce
  -- qu'il date — une demande, pas une régénération accomplie.
  return public.admin_ok(jsonb_build_object(
    'requested_at', now(),
    'emission', 'pending'));
end;
$function$;
