-- realadvisor : détection des baisses de prix (price_reduced) + 1er prix gelé +
-- résurrection + horodatage de la baisse. Trigger BEFORE UPDATE scopé realadvisor.
-- (Révisé après red-team 19 juin : référence « prix sur demande » corrigée, ajout de
--  price_reduced_at, baisse évaluée AVANT la résurrection.)
--
-- PROBLÈME : l'upsert d'ingestion renvoie price_at_first_seen = prix COURANT à chaque
-- passage → le 1er prix était écrasé → price_reduced indétectable (0/36269 au départ).
--
-- SOLUTION (trigger scopé realadvisor, PAS de changement edge fn, Flatfox intact) :
--   - la référence « 1er prix » se cale sur le 1er prix RÉEL (>0) puis se gèle ;
--   - sur un refresh d'ingestion (new.status='active', ce que mapHit pose toujours) :
--       prix courant < référence    → 'price_reduced' (+ price_reduced_at figé)
--       sinon                        → 'active'        (stable / remonté / résurrection)
--   - un UPDATE posant explicitement un autre statut (sweep → 'removed', futur 'stale',
--     geste manuel) n'est PAS touché → le sweep destructif n'est pas perturbé.

alter table public.market_listings add column if not exists price_reduced_at timestamptz;

create or replace function public.ra_price_status()
returns trigger
language plpgsql
as $$
begin
  -- Référence « 1er prix observé » : amorcée sur le 1er prix RÉEL (>0), jamais
  -- réécrasée ensuite (le crawl renvoie le prix courant, pas un correctif). On traite 0
  -- (« prix sur demande », ~1637 biens RA) comme « pas encore de référence », sinon
  -- la référence reste empoisonnée à 0 et la baisse n'est jamais détectée. first_seen_at gelé.
  if new.current_price > 0 and (old.price_at_first_seen is null or old.price_at_first_seen <= 0) then
    new.price_at_first_seen := new.current_price;
  else
    new.price_at_first_seen := old.price_at_first_seen;
  end if;
  new.first_seen_at := old.first_seen_at;

  -- Transitions de statut UNIQUEMENT sur un refresh d'ingestion (status='active').
  -- La BAISSE est évaluée AVANT la résurrection : un bien removed/stale qui réapparaît
  -- moins cher est capté en price_reduced (signal vendeur le plus fort) ; sinon réactivé.
  if new.status = 'active' then
    if new.current_price > 0 and new.price_at_first_seen > 0
       and new.current_price < new.price_at_first_seen then
      new.status := 'price_reduced';
      new.price_reduced_at := coalesce(old.price_reduced_at, now());  -- figé à la 1re baisse
    else
      new.status := 'active';            -- stable / remonté / résurrection same-or-higher
      new.price_reduced_at := null;      -- plus en baisse → on efface l'horodatage
    end if;
  end if;
  -- NB : 'stale' = statut réservé à un futur mécanisme 2-strikes (aucun producteur
  -- aujourd'hui) ; sa sémantique de résurrection sera tranchée à sa conception.

  return new;
end $$;

drop trigger if exists trg_ra_price_status on public.market_listings;
create trigger trg_ra_price_status
  before update on public.market_listings
  for each row
  when (new.source_portal = 'realadvisor')
  execute function public.ra_price_status();
