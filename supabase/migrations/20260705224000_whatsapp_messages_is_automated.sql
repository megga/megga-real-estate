-- is_automated : discrimine les SORTANTS générés par la machine (réponse copilote MEGGA,
-- templates Meta, sélection de biens send_listings) de la prose RÉELLEMENT écrite par un
-- agent. Sert au corpus de mimétisme de voix (agent-style.fetchClientVoiceSamples) : seuls
-- les messages « authored » (is_automated=false) alimentent le few-shot de ton — sinon le
-- boilerplate (« Bonjour X, voici une sélection… », « [template: …] ») fausse le style
-- appris, surtout au cold-start d'une agence (repli sur le corpus d'agence).
--
-- Pourquoi une colonne dédiée : ni media_type ni sent_by_profile_id ne discriminaient, car
-- les axes se croisent — le compositeur manuel CRM (edge whatsapp-send, prose de l'agent)
-- n'a PAS de sent_by_profile_id, alors que send_template (boilerplate) en a un ; et le texte
-- send_listings a media_type NULL comme un vrai message. Seul un flag explicite sépare
-- « écrit par un humain » de « généré ».
alter table public.whatsapp_messages
  add column if not exists is_automated boolean not null default false;

comment on column public.whatsapp_messages.is_automated is
  'true = sortant généré par la machine (copilote/template/send_listings), exclu du corpus de voix. false = prose authored par un agent (compositeur manuel, message client validé).';

-- Backfill best-effort des sortants générés historiques identifiables (table ~150 lignes,
-- bornes sûres, pas de risque de timeout) : toute IMAGE sortante = légende send_listings
-- (le compositeur manuel n'envoie que du texte) ; et les ids de repli local-* des chemins
-- générés (send_listings / template / réponse copilote). Idempotent (gate is_automated=false).
update public.whatsapp_messages
   set is_automated = true
 where is_automated = false
   and direction = 'outbound'
   and (
     media_type = 'image'
     or provider_message_id like 'local-listings-%'
     or provider_message_id like 'local-template-%'
     or provider_message_id like 'local-agent-%'
   );
