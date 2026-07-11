// src/hooks/useFollowupSuggestions.ts
// Suivis suggérés par MEGGA depuis WhatsApp (engagements actionnables). Lecture +
// accept (RPC → crée un vrai rappel) + dismiss. RLS par agence
// (wa_followups_agency_select / _update). Human-in-the-loop : rien n'est créé sans
// le clic de l'agent.
//
// La table whatsapp_followup_suggestions n'est pas encore dans les types générés
// (database.ts est en retard sur la prod) → on cible la table via un client non
// typé (cast localisé) tout en typant fortement les entrées/sorties.



export type FollowupKind = 'commitment' | 'next_action' | 'client_availability'

export interface FollowupSuggestionRow {
  id: string
  contact_id: string
  action: string
  due_at: string | null
  kind: FollowupKind
  status: 'suggested' | 'accepted' | 'dismissed'
  created_at: string
}

