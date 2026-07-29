-- Fermeture de join_agency(uuid).
--
-- La fonction ne vérifie aucune invitation et restait accordée à authenticated : tout
-- compte authentifié pouvait s'attacher à n'importe quelle agence par son UUID et
-- devenir agent dessus, avec l'accès RLS aux contacts, deals et dossiers KYC de cette
-- agence. Le commentaire d'origine (baseline) annonçait déjà son remplacement par un
-- workflow agency_join_requests validé par un admin, jamais écrit.
--
-- Le besoin est couvert par accept-team-invite, qui vérifie l'expiration et la
-- correspondance d'e-mail. La fonction est conservée (service_role) plutôt que
-- supprimée : elle reste utile pour un rattachement d'exploitation.
--
-- Idempotente : REVOKE est rejouable.

revoke execute on function public.join_agency(uuid) from public, anon, authenticated;

comment on function public.join_agency(uuid) is
  'Rattachement direct d''un utilisateur à une agence, SANS vérification d''invitation. Révoquée de authenticated le 26.07.2026 (faille cross-agence) : service_role uniquement. Le chemin utilisateur est accept-team-invite.';
