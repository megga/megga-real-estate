-- Notes privées équipe sur un bien (fiche Vitrine, onglet « Privée »).
-- Jamais publiées : visibles uniquement par l'agence. Colonne additive,
-- nullable, non-bloquante. La RLS agency-scopée de `properties` s'applique
-- telle quelle (pas de nouvelle policy nécessaire).

alter table public.properties
  add column if not exists private_notes text;

comment on column public.properties.private_notes is
  'Notes internes équipe MEGGA sur le bien — jamais publiées (agence seulement).';
