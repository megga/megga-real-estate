-- La langue de CORRESPONDANCE de l'utilisateur MEGGA.
--
-- Règle posée le 15.08.2026 : la langue d'interface EST la langue des courriels. Si
-- quelqu'un bascule le CRM ou la vitrine en allemand, ses e-mails suivent.
--
-- ⛔ CE N'EST PAS `profiles.spoken_languages`. Celle-là est un TABLEAU des langues que
-- l'agent PARLE, affiché sur sa fiche publique. Les confondre écrirait en italien à un
-- agent genevois qui a coché « italien » parce qu'il reçoit des clients italophones.
--
-- POURQUOI UNE COLONNE, alors que le front connaît déjà la langue : elle ne vivait que
-- dans le `localStorage` du navigateur (clé `megga-language`). Tant qu'un humain clique,
-- le front la met dans le corps de la requête et l'e-mail part juste. Mais un envoi
-- AUTOMATIQUE — rappel J-1 de l'appel d'accueil, relance, rappel de contact — n'a
-- AUCUNE requête d'où la lire. Mesuré le 15.08 : `onboarding-call-reminder` écrivait
-- `locale: 'fr'` en dur, donc un anglophone ayant réservé en anglais recevait son rappel
-- de la veille en français.
--
-- NULL = jamais choisi explicitement. Le lecteur retombe sur 'fr', défaut du produit.
-- On ne remplit pas rétroactivement : deviner la langue de 13 comptes existants d'après
-- leur canton serait une invention, et le premier changement de langue la posera.

alter table public.profiles
  add column if not exists language text;

do $$
begin
  alter table public.profiles
    add constraint profiles_language_valid
    check (language is null or language in ('fr', 'de', 'en', 'it'));
exception
  when duplicate_object then null;
end $$;

comment on column public.profiles.language is
  'Langue de correspondance (fr|de|en|it), écrite à l''inscription puis à chaque bascule de langue. NULL = jamais choisie, le lecteur retombe sur fr. ⛔ Distincte de spoken_languages, qui dit ce que l''agent PARLE.';

-- Le trigger d'inscription la recueille.
--
-- ⚠ Redéclaration COMPLÈTE de la fonction : `create or replace` ne fusionne pas. Le
-- corps ci-dessous est celui LU EN PRODUCTION le 15.08.2026 (pg_get_functiondef), pas
-- celui d'un fichier de migration — les deux peuvent diverger, et repartir du fichier
-- aurait annulé en silence toute correction posée entre-temps. Ils étaient identiques
-- ce jour-là ; seules les deux lignes `v_language` / `language` sont neuves.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_full_name   text := coalesce(new.raw_user_meta_data ->> 'full_name',
                                 new.raw_user_meta_data ->> 'name', '');
  v_agency_name text := nullif(btrim(coalesce(new.raw_user_meta_data ->> 'agency_name', '')), '');
  v_role        text := case
    when (new.raw_user_meta_data ->> 'role') in
         ('agent', 'manager', 'admin', 'assistant', 'seller', 'buyer', 'particulier')
      then new.raw_user_meta_data ->> 'role'
    else 'buyer'
  end;
  -- Une valeur hors des quatre langues du produit vaut NULL, jamais une erreur :
  -- l'inscription ne doit pas échouer sur un champ de confort.
  v_language    text := case
    when (new.raw_user_meta_data ->> 'language') in ('fr', 'de', 'en', 'it')
      then new.raw_user_meta_data ->> 'language'
    else null
  end;
begin
  insert into public.profiles (id, email, full_name, avatar_url, role, language)
  values (
    new.id,
    coalesce(new.email, ''),
    v_full_name,
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture', ''),
    v_role,
    v_language
  );

  if v_role in ('agent', 'manager', 'admin', 'assistant') then
    begin
      perform public.provision_solo_agency(
        new.id,
        coalesce(v_agency_name,
                 nullif(btrim(v_full_name), ''),
                 split_part(coalesce(new.email, ''), '@', 1))
      );
    exception when others then
      raise warning 'provision_solo_agency failed for %: %', new.id, sqlerrm;
    end;
  end if;

  -- Consentement recueilli sur le formulaire d'inscription (case obligatoire de
  -- megga.ch/signup). La VERSION vient de legal_document_versions : la
  -- métadonnée dit que l'agent a coché, pas ce qu'il aurait coché.
  --
  -- Même filet que provision_solo_agency : un échec ici ne doit pas faire
  -- capoter la création du compte. Sans preuve, ConsentGate redemandera — une
  -- question de trop vaut mieux qu'une inscription perdue.
  if coalesce(new.raw_user_meta_data ->> 'legal_consent', '') in ('true', 't', '1') then
    begin
      insert into public.user_consents (user_id, consent_type, version)
      select new.id, v.consent_type, v.version
      from public.legal_document_versions v
      on conflict (user_id, consent_type, version) do nothing;

      if coalesce(new.raw_user_meta_data ->> 'marketing_consent', '') in ('true', 't', '1') then
        insert into public.user_consents (user_id, consent_type, version)
        select new.id, 'marketing', v.version
        from public.legal_document_versions v
        where v.consent_type = 'terms'
        on conflict (user_id, consent_type, version) do nothing;
      end if;
    exception when others then
      raise warning 'consent capture failed for %: %', new.id, sqlerrm;
    end;
  end if;

  return new;
end;
$function$;

comment on function public.handle_new_user() is
  'Trigger auth.users : profil + agence solo + preuves de consentement + langue de correspondance (raw_user_meta_data.language). Voir 20260731210000 et 20260815250000.';
