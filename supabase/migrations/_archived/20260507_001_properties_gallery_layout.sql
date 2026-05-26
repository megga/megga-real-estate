-- 20260507_001 — properties.gallery_layout
-- Permet à l'agent qui poste l'annonce de choisir la variante de galerie
-- affichée sur la fiche bien publique (port proto megga-bien-gallery.jsx).
--
-- Variantes (port 1:1 du proto):
--   hero     — 1 grande photo + grille 2×2 (5 photos visibles)
--   mosaic   — 6 photos asymétriques (grid 2fr 1fr 1fr 1fr × 1fr 1fr 1fr)
--   carousel — single full-width + flèches + bandeau de thumbs
--
-- Default = 'hero' (correspond au défaut du proto window.MEGGA_BienGallery).

ALTER TABLE public.properties
  ADD COLUMN IF NOT EXISTS gallery_layout text
  NOT NULL
  DEFAULT 'hero'
  CHECK (gallery_layout IN ('hero', 'mosaic', 'carousel'));

COMMENT ON COLUMN public.properties.gallery_layout IS
  'Variante de galerie affichée sur /listing/:id. Choisi par l''agent à la création. Valeurs: hero | mosaic | carousel. Default: hero.';
