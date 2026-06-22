-- Photos des biens agence → Cloudflare R2 (repurpose du pipeline marketplace).
--
-- Ajoute `photos_cf` (variantes R2 thumb/detail/hero, pour un srcset responsive)
-- + `photos_cf_processed_at` sur `properties`, en miroir de market_listings.
--
-- v1 : le rendu sert depuis R2 via l'URL `detail` poussée dans `properties.photos[]`
-- (surfaces URL-agnostic, zéro changement UI). Ces colonnes `photos_cf` sont
-- AJOUTÉES POUR PLUS TARD (srcset par variante) — le broker property-photo-r2 les
-- renvoie mais ne les persiste PAS encore en v1 (l'alignement avec photos[] après
-- réordonnancement demande un keying par URL, repoussé). Lues via la RLS agence
-- existante ; écriture server-side uniquement quand le srcset sera câblé.
-- Idempotent.

alter table public.properties
  add column if not exists photos_cf jsonb,
  add column if not exists photos_cf_processed_at timestamptz;
