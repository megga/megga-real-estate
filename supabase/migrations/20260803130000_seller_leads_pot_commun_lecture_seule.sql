-- seller_leads : le pot commun redevient LECTURE SEULE pour les agences.
--
-- Constat : docs/audits/2026-08-03-rls-isolation-multi-agence.md §4 — seule fuite de
-- lecture mesurée de l'audit (un agent voit 1 lead qu'il ne possède pas).
--
-- CE QUI NE CHANGE PAS — décision produit, laissée intacte :
-- toute agence continue de VOIR les leads non attribués. Le partage en lecture du flux
-- entrant est un choix produit ; il n'appartient pas à un correctif de sécurité de le
-- trancher.
--
-- CE QUI EST FERMÉ :
-- `seller_leads_agents_all` était `FOR ALL` avec `assigned_agency_id IS NULL` dans le
-- USING *et* le WITH CHECK. Toute agence pouvait donc modifier et SUPPRIMER n'importe
-- quel lead entrant du pot commun — PII comprise (contact_name, contact_email,
-- contact_phone, motivation, property_data) — sans laisser de trace.
--
-- `agents_update_seller_leads` doublait la première avec un USING sans WITH CHECK : en
-- UPDATE, PostgreSQL réutilise alors le USING pour contrôler la nouvelle ligne, ce qui
-- ne refermait rien. Elle est retirée comme redondante.
--
-- POURQUOI AUCUN AGENT NE PERD DE CAPACITÉ RÉELLE :
-- l'attribution d'un lead est un geste SUPER-ADMIN, pas un geste d'agence — elle passe
-- par AdminModerationInbox.tsx (policy seller_leads_super_admin_all). Vérifié : aucun
-- chemin de code agent n'écrit dans seller_leads. useSellerLeads.ts est en lecture
-- seule, l'entonnoir public insère en `anon`, whatsapp-morning-brief passe en
-- service_role (hors RLS). Le droit d'écriture retiré ici n'était appelé par personne.
--
-- INSERT et DELETE agents : volontairement SANS policy. Ils retombent donc sur
-- seller_leads_super_admin_all (super-admin) et seller_leads_anon_insert (entonnoir
-- public), les deux seules portes réellement utilisées. Supprimer un lead entrant
-- détruit une donnée personnelle soumise par un tiers : cela doit rester un geste
-- super-admin, traçable. Pour rouvrir l'insertion agent un jour, ajouter une policy
-- INSERT explicite bornée à `assigned_agency_id = get_my_agency_id()`.

DROP POLICY IF EXISTS "seller_leads_agents_all"    ON public.seller_leads;
DROP POLICY IF EXISTS "agents_update_seller_leads" ON public.seller_leads;

-- Lecture : périmètre INCHANGÉ (leads de mon agence + pot commun non attribué).
--
-- Seul ajout : `get_my_agency_id() IS NOT NULL`. Sans lui, un compte authentifié
-- n'appartenant à AUCUNE agence (rôle `buyer`, profil sans agency_id) lisait le pot
-- commun en entier, PII comprise — la branche `IS NULL` étant vraie pour lui aussi.
-- Aucune décision produit n'a jamais visé ce cas ; le partage voulu est d'agence à
-- agence.
CREATE POLICY "seller_leads_agents_select"
  ON public.seller_leads
  FOR SELECT
  TO authenticated
  USING (
    get_my_agency_id() IS NOT NULL
    AND (
      assigned_agency_id = get_my_agency_id()
      OR assigned_agency_id IS NULL
    )
  );

-- Écriture : STRICTEMENT les leads déjà attribués à mon agence.
-- Le WITH CHECK identique au USING empêche les trois dérives : toucher un lead du pot
-- commun, pousser un lead vers une autre agence, et relâcher un lead attribué dans le
-- pot commun pour le soustraire à son agence.
CREATE POLICY "seller_leads_agents_update_own"
  ON public.seller_leads
  FOR UPDATE
  TO authenticated
  USING      (assigned_agency_id = get_my_agency_id())
  WITH CHECK (assigned_agency_id = get_my_agency_id());
