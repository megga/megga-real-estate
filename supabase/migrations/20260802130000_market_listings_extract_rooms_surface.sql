-- market_listings — récupération déterministe de pièces/surface depuis la description.
--
-- Constat (audit du 02/08/2026) : sur les 44 104 annonces RealAdvisor vivantes,
-- 13,7 % n'ont pas de nombre de pièces et 14,9 % pas de surface — champs absents de
-- l'API elle-même (le mapping du sync est complet, vérifié). Or le scoring du matching
-- ([_shared/matching-normalize.ts] scoreRooms/scoreSurface) traite un champ null comme
-- un axe ACTIF à 0 quand le client filtre dessus : ~22 points perdus sur 100, souvent
-- sous le seuil de 55 — des biens invisibles pour un trou de données, pas pour un vrai
-- désaccord. Beaucoup de ces descriptions CONTIENNENT pourtant la valeur en clair
-- (« villa de 6 pièces », « Wohnfläche: ca. 192 m² »).
--
-- Extraction par regex (0 LLM), calibrée et mesurée contre la vérité terrain — les
-- annonces où l'API fournit la valeur ET une description (échantillons de 3-6k, 02/08) :
--   · pièces apartment (motif générique)         : 94,3 % exacts, 2,7 % faux (>½ pièce)
--   · pièces house (motifs ANCRÉS au logement)   : 89,7 % exacts, 6,7 % faux
--   · surface (ancres explicites, cf. ci-dessous): ~88 % à ±10 % ; les « faux » mesurés
--     sont largement des désaccords API/texte où l'API sert son computed_surface estimé
--     alors que le texte donne la Wohnfläche de l'agence — le texte est alors la
--     meilleure source, le taux mesuré est un MAJORANT.
--
-- Garde-fous issus des modes d'échec observés (et pas théoriques) :
--   · fourchette « de 2.5 à 5.5 pièces » / « 5,5 oder 6,5 Zimmer » ⇒ promotion, RIEN ;
--   · marqueur multi-lots (immeuble, Mehrfamilienhaus, logements, appartements…) ⇒ le
--     nombre de pièces d'UN lot ne décrit pas l'objet vendu ⇒ RIEN ;
--   · plusieurs valeurs DISTINCTES matchées ⇒ ambigu ⇒ RIEN ;
--   · maisons : le nombre doit TOUCHER le nom du logement (sinon on lit les
--     descriptions étage par étage : « OG: 3 Zimmer » sur une 4,5 pièces) ;
--   · surface : ancres explicites seules (Wohnfläche, surface habitable, superficie
--     abitabile) + « appartement de X m² » pour les seuls appartements — « villa de
--     X m² » attrape des parcelles ;
--   · sommes « 100 + 90 m² » et potentiels « bis zu 360 m² neuer Wohnfläche » ⇒ RIEN ;
--   · apostrophe suisse « 1'383 m² » lue comme 1383 (pas 383) ;
--   · bornes de vraisemblance : pièces ∈ [1;20], surface ∈ [10;1500].
--
-- On ne remplit QUE les NULL : une valeur servie par l'API n'est jamais écrasée.
-- Le trigger vaut pour toutes les sources (flatfox compris) ; le backfill ne touche
-- que les annonces vivantes. updated_at n'est PAS bumpé (l'histogramme horaire
-- d'updated_at est un outil de diagnostic du rolling — cf. incident du 29/07).
--
-- RENDEMENT MESURÉ (simulation prod du 02/08, transaction annulée) : ~120 pièces +
-- ~372 surfaces récupérées au backfill — loin des ~6 000 trous, parce que les annonces
-- sans champ API sont majoritairement celles dont la description ne le donne pas non
-- plus (enchères, objets mixtes, textes muets), et que les garde-fous écartent le
-- reste. Flatfox : 0 ligne à gagner (pas de trou avec description). L'essentiel de la
-- valeur est donc le TRIGGER, qui extraira au fil de l'eau sur les ingestions futures.

-- ── 1. Extraction du nombre de pièces ────────────────────────────────────────────────
create or replace function public.ml_extract_rooms(p_type text, p_description text)
returns numeric
language plpgsql
immutable
as $function$
declare
  v_text text;
  v_vals numeric[];
begin
  if p_description is null or p_type not in ('apartment', 'house') then
    return null;
  end if;

  -- Normalisation AVANT tout motif : « 3 1/2 pièces » et « 3½ » deviennent « 3.5 ».
  -- Sans elle, le « / » de « 1/2 » déclenche le kill fourchette ci-dessous (bug vu au
  -- test) ; une vraie fourchette « 2 1/2 - 4 1/2 Zimmer » reste tuée après conversion.
  v_text := replace(replace(p_description, ' 1/2', '.5'), '½', '.5');

  -- Fourchette ou alternative ⇒ promotion / projet à choix, pas UNE valeur.
  if v_text ~* '\d{1,2}(?:[.,]5)?\s*(?:au|à|a|bis|al|-|–|/|oder|ou)\s*\d{1,2}(?:[.,]5)?[\s-]*(?:pièces|pces|zimmer|locali)' then
    return null;
  end if;
  -- Multi-lots ⇒ les pièces d'un lot ne décrivent pas l'objet vendu.
  if v_text ~* '(?:immeuble|promotion|résidence|mehrfamilienhaus|wohnungen|logements|appartements|appartamenti|apartments)' then
    return null;
  end if;

  if p_type = 'apartment' then
    select array_agg(distinct replace(m[1], ',', '.')::numeric)
      into v_vals
      from regexp_matches(v_text,
        '(\d{1,2}(?:[.,]5)?)[\s-]*(?:pièces|pces|zimmer(?:n)?[\s-]|zi\.|locali)', 'gi') m
     where replace(m[1], ',', '.')::numeric between 1 and 20;
  else
    -- house : motifs ancrés seulement (le générique lit les inventaires par étage).
    select array_agg(distinct replace(coalesce(m[1], m[2], m[3]), ',', '.')::numeric)
      into v_vals
      from regexp_matches(v_text,
        '(?:(?:maison|villa|chalet|ferme|propriété|casa|rustico|habitation)(?:\s+\w+){0,2}\s+d[eu]\s+(\d{1,2}(?:[.,]5)?)\s*(?:pièces|pces|locali))' ||
        '|(?:(\d{1,2}(?:[.,]5)?)[\s-]*(?:zimmer|pièces|pces|locali)[\s-]*(?:haus\b|villa|einfamilienhaus|efh\b|chalet|maison|casa|liegenschaft))' ||
        '|(?:(?:einfamilienhaus|doppeleinfamilienhaus|haus|villa|chalet)\s+mit\s+(\d{1,2}(?:[.,]5)?)\s*zimmern?\b)', 'gi') m
     where replace(coalesce(m[1], m[2], m[3]), ',', '.')::numeric between 1 and 20;
  end if;

  -- Une seule valeur distincte, sinon ambigu ⇒ rien.
  if v_vals is null or array_length(v_vals, 1) <> 1 then
    return null;
  end if;
  return v_vals[1];
end $function$;

-- ── 2. Extraction de la surface habitable (m²) ───────────────────────────────────────
create or replace function public.ml_extract_surface_m2(p_type text, p_description text)
returns numeric
language plpgsql
immutable
as $function$
declare
  v_vals numeric[];
begin
  if p_description is null or p_type not in ('apartment', 'house') then
    return null;
  end if;

  -- Somme (« 100 + 90 m² ») ou potentiel (« bis zu 360 m² ») près d'une mention m².
  if p_description ~* '(?:\+|bis zu|jusqu''à|jusqu''a)\s*(?:ca\.?\s*|env\.?\s*)?\d{2,4}(?:[.,]\d{1,2})?\s*m[²2]' then
    return null;
  end if;

  if p_type = 'apartment' then
    -- Ancres explicites + « appartement de X m² » (sûr pour un logement unique).
    select array_agg(distinct replace(replace(coalesce(m[1], m[2], m[3]), '''', ''), '’', '')::numeric)
      into v_vals
      from regexp_matches(p_description,
        '(?:(?:surface habitable|wohnfläche|superficie abitabile|superficie habitable)\s*(?:de|di|von|:)?\s*(?:ca\.?|env\.?|environ|circa|~)?\s*(\d{1,2}[''’]\d{3}|\d{2,4})(?:[.,]\d{1,2})?\s*m[²2])' ||
        '|(?:(\d{1,2}[''’]\d{3}|\d{2,4})(?:[.,]\d{1,2})?\s*m[²2]\s*(?:de surface habitable|habitables?|wohnfläche))' ||
        '|(?:(?:appartement|studio|attique|duplex|loft|wohnung|appartamento)(?:\s+\S+){0,2}\s+(?:de|di|mit)\s+(?:ca\.?|env\.?|environ|circa|~)?\s*(\d{1,2}[''’]\d{3}|\d{2,4})\s*m[²2])', 'gi') m
     where replace(replace(coalesce(m[1], m[2], m[3]), '''', ''), '’', '')::numeric between 10 and 1500;
  else
    -- house : ancres explicites SEULES (« villa de X m² » attrape des parcelles).
    select array_agg(distinct replace(replace(coalesce(m[1], m[2]), '''', ''), '’', '')::numeric)
      into v_vals
      from regexp_matches(p_description,
        '(?:(?:surface habitable|wohnfläche|superficie abitabile|superficie habitable)\s*(?:de|di|von|:)?\s*(?:ca\.?|env\.?|environ|circa|~)?\s*(\d{1,2}[''’]\d{3}|\d{2,4})(?:[.,]\d{1,2})?\s*m[²2])' ||
        '|(?:(\d{1,2}[''’]\d{3}|\d{2,4})(?:[.,]\d{1,2})?\s*m[²2]\s*(?:de surface habitable|habitables?|wohnfläche))', 'gi') m
     where replace(replace(coalesce(m[1], m[2]), '''', ''), '’', '')::numeric between 10 and 1500;
  end if;

  if v_vals is null or array_length(v_vals, 1) <> 1 then
    return null;
  end if;
  return v_vals[1];
end $function$;

-- ── 3. Trigger : ne remplit QUE les NULL, au fil de l'ingestion ──────────────────────
-- BEFORE ⇒ le remplissage arrive dans la même écriture, y compris quand l'upsert
-- nocturne re-sert rooms=null sur une ligne déjà extraite (re-calcul, même valeur).
create or replace function public.market_listings_fill_rooms_surface()
returns trigger
language plpgsql
as $function$
begin
  if new.rooms is null then
    new.rooms := public.ml_extract_rooms(new.type, new.description);
  end if;
  if new.surface_m2 is null then
    new.surface_m2 := public.ml_extract_surface_m2(new.type, new.description);
  end if;
  return new;
end $function$;

drop trigger if exists trg_ml_fill_rooms_surface on public.market_listings;
create trigger trg_ml_fill_rooms_surface
  before insert or update on public.market_listings
  for each row
  when (new.type in ('apartment', 'house')
        and new.description is not null
        and (new.rooms is null or new.surface_m2 is null))
  execute function public.market_listings_fill_rooms_surface();

-- ── 4. Backfill des annonces vivantes ────────────────────────────────────────────────
-- Gardé sur « au moins une extraction possible » pour ne réécrire QUE les lignes qui
-- gagnent une valeur (pas de rewrite no-op sur les descriptions muettes). updated_at
-- volontairement intact. Sur une base CI fraîche : 0 ligne, no-op.
do $$
declare
  v_total int;
begin
  update market_listings
     set rooms = coalesce(rooms, public.ml_extract_rooms(type, description)),
         surface_m2 = coalesce(surface_m2, public.ml_extract_surface_m2(type, description))
   where type in ('apartment', 'house')
     and status in ('active', 'price_reduced')
     and description is not null and description <> ''
     and ((rooms is null and public.ml_extract_rooms(type, description) is not null)
       or (surface_m2 is null and public.ml_extract_surface_m2(type, description) is not null));
  get diagnostics v_total = row_count;
  raise notice 'ml_extract backfill : % lignes complétées', v_total;
end $$;
