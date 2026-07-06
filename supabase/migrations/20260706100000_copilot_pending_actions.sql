-- copilot_pending_actions — action sensible (tier confirm) proposée par le copilote
-- WEB (ai-copilot) et EN ATTENTE de validation explicite de l'agent dans le panneau.
--
-- Miroir web de whatsapp_pending_actions. La boucle d'outils du copilote REFUSE
-- d'exécuter un tier 'confirm' (publish_to_portals / withdraw_from_portals = action
-- SORTANTE vers un portail externe immobilier.ch). À la place, elle PRÉPARE l'action
-- (aperçu déterministe de l'annonce), fige la charge ici, et l'edge renvoie au panneau
-- une CARTE de validation. L'agent clique « Publier » → ai-copilot (action
-- execute_pending) rejoue la charge VERBATIM. Human-in-the-loop structurel : rien ne
-- part au portail sans ce clic.
--
-- UNE LIGNE PAR ACTION PRÉPARÉE, chacune avec son id PROPRE et immuable (PAS de UNIQUE
-- user_id) : la carte web porte SON id, donc deux préparations/onglets concurrents du même
-- agent ne se marchent pas dessus — chaque carte exécute EXACTEMENT ce qu'elle a montré à
-- l'agent (invariant HITL « valider exactement ce qui part »). L'edge purge les lignes
-- expirées à chaque stash et consomme (DELETE) la carte en cas de succès seulement.
-- Écrite/lue UNIQUEMENT par le service-role (ai-copilot) ; RLS activée SANS policy =>
-- aucun accès anon/authenticated direct. Le scoping par agent est appliqué DANS l'edge
-- (.eq('user_id', <auth.uid dérivé du JWT>)), jamais depuis un paramètre client forgeable.

BEGIN;

CREATE TABLE IF NOT EXISTS public.copilot_pending_actions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  agency_id   uuid        NULL REFERENCES public.agencies(id) ON DELETE SET NULL,
  kind        text        NOT NULL,           -- 'publish' | 'withdraw'
  tool        text        NOT NULL,           -- 'publish_to_portals' | 'withdraw_from_portals'
  payload     jsonb       NOT NULL DEFAULT '{}'::jsonb,  -- charge figée (property_id, portals, title, lang)
  preview     text        NOT NULL,           -- aperçu déterministe de l'annonce (montré dans la carte)
  title       text        NULL,               -- titre du bien (affichage carte)
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL DEFAULT now() + interval '15 minutes'
);

-- Scoping par agent + purge des expirées (table minuscule, mais index propre).
CREATE INDEX IF NOT EXISTS idx_copilot_pending_user ON public.copilot_pending_actions (user_id);
CREATE INDEX IF NOT EXISTS idx_copilot_pending_expires ON public.copilot_pending_actions (expires_at);

ALTER TABLE public.copilot_pending_actions ENABLE ROW LEVEL SECURITY;
-- Pas de policy = aucun accès via anon/authenticated. Le service-role (ai-copilot)
-- bypass la RLS ; toute lecture/écriture passe par l'edge, scopée à l'agent du JWT.

COMMIT;
