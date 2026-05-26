-- 20260507_002 — properties display variants (port proto MEGGA Bien.html tweaks)
--
-- Le proto megga-bien-page.jsx expose plusieurs variantes par-listing dans son
-- TweaksPanel (MEGGA Bien.html lignes 55-64). On ajoute les colonnes pour que
-- l'agent puisse les choisir à la création de l'annonce :
--
--   contact_layout       — disposition de la card agent
--                          right    = sticky 380px à droite (default proto)
--                          banner   = CTA bannière dans la card prix
--                          floating = widget fixe bottom-right
--
--   neighborhood_variant — bento "Le quartier"
--                          map    = carte Leaflet OSM + amenities (default proto)
--                          scores = ScoreTiles + éditorial + amenities groupées
--
--   partner_agency       — agence partenaire affichée en bandeau
--                          naef    = Naef Immobilier (noir, "Depuis 1881")
--                          cardis  = Cardis Sotheby's (bleu nuit)
--                          bernard = Bernard Nicod (rouge bordeaux)
--                          NULL    = pas d'agence partenaire (fallback default MEGGA)
--
-- Defaults match les TWEAK_DEFAULTS du proto.

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS contact_layout text
    NOT NULL
    DEFAULT 'right'
    CHECK (contact_layout IN ('right', 'banner', 'floating'));

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS neighborhood_variant text
    NOT NULL
    DEFAULT 'map'
    CHECK (neighborhood_variant IN ('scores', 'map'));

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS partner_agency text
    DEFAULT NULL
    CHECK (partner_agency IS NULL OR partner_agency IN ('naef', 'cardis', 'bernard'));

COMMENT ON COLUMN public.properties.contact_layout IS
  'Disposition de la card agent sur /listing/:id. right (default) | banner | floating.';
COMMENT ON COLUMN public.properties.neighborhood_variant IS
  'Bento "Le quartier" sur /listing/:id. map (default, carte Leaflet) | scores (éditorial).';
COMMENT ON COLUMN public.properties.partner_agency IS
  'Agence partenaire affichée en bandeau sur /listing/:id. naef | cardis | bernard | NULL.';
