// src/hooks/useFollowupSuggestions.ts
// Ce qui reste de l'ancien hook « suivis suggérés » de la fiche contact (#768) après
// le retrait des exports morts (f212f16f) : le seul genre de suivi, importé par
// useAgencyFollowupSuggestions — désormais la SEULE surface vivante des suivis
// WhatsApp (cockpit « Aujourd'hui »), qui porte la lecture, la RLS et les actions HITL.

export type FollowupKind = 'commitment' | 'next_action' | 'client_availability'
