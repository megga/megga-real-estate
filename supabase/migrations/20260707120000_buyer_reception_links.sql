-- ============================================================================
-- Boucle de réception acheteur — lien privé + réactions LIVE (refonte Matching)
-- ============================================================================
-- L'agent transmet une SÉLECTION de biens à un acheteur via un lien privé
-- (magic link, sans compte, canal WhatsApp / lien copié — jamais d'email).
-- L'acheteur ouvre la page réception (mobile) et réagit bien par bien
-- (♥ intéressé / ✕ écarté + motif). Sa réaction est SA propre action : elle met
-- à jour `matches.status` en direct (→ trigger set_match_response_at stampe
-- response_at, log_match_reaction trace l'audit) et remonte dans la fiche contact.
-- L'AGENT reste human-in-the-loop pour l'ACTION SUIVANTE (proposer une visite,
-- relancer) via l'inbox « À traiter » — il ne réagit jamais à la place du client.
--
-- Même famille que le lien magique KYC (HMAC) et le portail vendeur : endpoints
-- publics service_role, token strict, blast radius minimal (un lien fuité ne
-- touche que les matches DE CE contact, jamais d'autre tenant).
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. matches — motif / note de la réaction acheteur (écarté = pourquoi)
-- ----------------------------------------------------------------------------
-- Le motif d'écartement affine le recalibrage futur du scoring ; la fiche contact
-- l'affiche (« Motif consigné · recalibre le matching »). Nullable, 0 PII sensible.
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS reaction_motif text,
  ADD COLUMN IF NOT EXISTS reaction_note text;

-- Nouveau canal d'envoi 'reception' (lien privé) : étend matches_sent_via_check
-- (préserve email/whatsapp/both ; NULL reste toléré car un CHECK NULL ne viole pas).
-- Requis par execSendDossier canal='reception' + l'edge buyer-reception-create.
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS matches_sent_via_check;
ALTER TABLE public.matches ADD CONSTRAINT matches_sent_via_check
  CHECK (sent_via = ANY (ARRAY['email'::text, 'whatsapp'::text, 'both'::text, 'reception'::text]));

-- ----------------------------------------------------------------------------
-- 2. buyer_reception_links — un lien privé par (contact × sélection de biens)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.buyer_reception_links (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token              text NOT NULL UNIQUE,               -- HMAC-signé (magic-link-token.ts)
  agency_id          uuid NOT NULL REFERENCES public.agencies(id) ON DELETE CASCADE,
  contact_id         uuid NOT NULL REFERENCES public.contacts(id) ON DELETE CASCADE,
  agent_id           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  match_ids          uuid[] NOT NULL,                    -- la sélection transmise
  status             text NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'viewed', 'reacted', 'expired')),
  channel            text,                               -- 'whatsapp' | 'link' (indicatif)
  expires_at         timestamptz NOT NULL,
  sent_at            timestamptz NOT NULL DEFAULT now(),
  viewed_at          timestamptz,
  reacted_at         timestamptz,
  client_ip          text,
  client_user_agent  text,
  created_by         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brl_agency_contact ON public.buyer_reception_links (agency_id, contact_id, sent_at DESC);

ALTER TABLE public.buyer_reception_links ENABLE ROW LEVEL SECURITY;

-- Agent : lecture des liens de SON agence (la fiche contact peut lister l'état
-- de transmission). Écritures via service_role (edge functions) uniquement.
DROP POLICY IF EXISTS brl_agent_read ON public.buyer_reception_links;
CREATE POLICY brl_agent_read ON public.buyer_reception_links
  FOR SELECT TO authenticated
  USING (agency_id IN (SELECT p.agency_id FROM public.profiles p WHERE p.id = auth.uid()));

-- ----------------------------------------------------------------------------
-- 3. record_buyer_reaction — réaction acheteur (portail, service_role only)
-- ----------------------------------------------------------------------------
-- Valide le lien (non expiré, match ∈ sélection), pose l'attribution GUC
-- (system / via='reception') puis met à jour le match → les triggers existants
-- (set_match_response_at + log_match_reaction) font le reste. Le motif n'est
-- consigné que pour un écartement. SECURITY DEFINER ; réservé au service_role
-- (l'edge valide déjà le token HMAC en amont).
CREATE OR REPLACE FUNCTION public.record_buyer_reaction(
  p_link_id  uuid,
  p_match_id uuid,
  p_reaction text,
  p_motif    text DEFAULT NULL,
  p_note     text DEFAULT NULL
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_contact uuid;
  v_expires timestamptz;
  v_matches uuid[];
BEGIN
  SELECT contact_id, expires_at, match_ids
    INTO v_contact, v_expires, v_matches
  FROM public.buyer_reception_links
  WHERE id = p_link_id;

  IF v_contact IS NULL THEN RAISE EXCEPTION 'link_not_found'; END IF;
  IF v_expires < now() THEN RAISE EXCEPTION 'link_expired'; END IF;
  IF NOT (p_match_id = ANY (v_matches)) THEN RAISE EXCEPTION 'match_not_in_selection'; END IF;
  IF p_reaction NOT IN ('interested', 'rejected') THEN RAISE EXCEPTION 'bad_reaction'; END IF;

  -- Attribution : réaction de l'acheteur via le portail réception (pas l'agent).
  PERFORM set_config('app.actor_kind', 'system', true);
  PERFORM set_config('app.actor_via', 'reception', true);

  -- L'acheteur ne peut basculer QUE parmi ses états de réception (sent/interested/
  -- rejected). Si l'agent a déjà fait avancer le match (visit_planned…), un lien
  -- encore valide ne doit PAS régresser cet état → la garde de statut l'en empêche.
  UPDATE public.matches
     SET status         = p_reaction,
         reaction_motif = CASE WHEN p_reaction = 'rejected' THEN NULLIF(btrim(p_motif), '') ELSE NULL END,
         reaction_note  = CASE WHEN p_reaction = 'rejected' THEN NULLIF(btrim(p_note), '')  ELSE NULL END
   WHERE id = p_match_id
     AND contact_id = v_contact                          -- garde tenant : le match appartient au contact du lien
     AND status IN ('sent', 'interested', 'rejected');   -- garde anti-régression : préserve un état avancé par l'agent

  UPDATE public.buyer_reception_links
     SET status = 'reacted', reacted_at = now(), updated_at = now()
   WHERE id = p_link_id;
END;
$function$;

REVOKE ALL ON FUNCTION public.record_buyer_reaction(uuid, uuid, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_buyer_reaction(uuid, uuid, text, text, text) TO service_role;

COMMENT ON TABLE public.buyer_reception_links IS
  'Lien privé (magic link) transmettant une sélection de biens à un acheteur ; ses réactions (record_buyer_reaction) remontent en direct dans matches + la fiche contact. HITL agent pour l''action suivante.';
