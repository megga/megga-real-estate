// src/hooks/useAgencyFollowupSuggestions.ts
// Suivis WhatsApp en attente À TRAVERS les contacts de l'agence — pour la surface
// proactive du cockpit « Aujourd'hui ». Lecture seule : l'action HITL (accepter →
// vrai rappel / écarter) reste sur la fiche contact (CdFollowupSuggestions +
// useFollowupActions) ; ici on ne fait que RENDRE VISIBLE + deep-linker.
//
// RLS : wa_followups_agency_select (agency_id = get_my_agency_id()) — borne déjà à
// l'agence de l'agent connecté, comme le partage des contacts. La table n'est pas
// encore dans les types générés (database.ts en retard sur la prod) → client casté,
// même pattern que useFollowupSuggestions.

import { useQuery } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import type { FollowupKind } from './useFollowupSuggestions'

const db = supabase as unknown as SupabaseClient

export interface AgencyFollowupRow {
  id: string
  contact_id: string
  contact_name: string
  action: string
  due_at: string | null
  kind: FollowupKind
}

interface RawRow {
  id: string
  contact_id: string
  action: string
  due_at: string | null
  kind: FollowupKind
}

// Borne de lecture. Exportée pour que la surface cockpit sache distinguer un total
// exact d'un compte plafonné (affiche « N+ » quand on atteint la borne).
export const AGENCY_FOLLOWUPS_LIMIT = 20

/**
 * Suivis WhatsApp `suggested` de l'agence, triés par urgence (échéance la plus
 * proche d'abord — en retard en tête ; non datés en fin), enrichis du nom du
 * contact. `limit` borne la lecture (le cockpit n'en affiche que quelques-uns).
 */
export function useAgencyFollowupSuggestions(limit = AGENCY_FOLLOWUPS_LIMIT) {
  return useQuery({
    queryKey: ['wa-agency-followups', limit],
    staleTime: 60_000,
    queryFn: async (): Promise<AgencyFollowupRow[]> => {
      const res = await db
        .from('whatsapp_followup_suggestions')
        .select('id, contact_id, action, due_at, kind')
        .eq('status', 'suggested')
        .order('due_at', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false })
        .limit(limit)
      const { data, error } = res as unknown as { data: RawRow[] | null; error: { message: string } | null }
      if (error) throw new Error(error.message)
      const rows = data ?? []
      if (!rows.length) return []

      // Noms des contacts en une requête bornée aux ids présents (RLS agence).
      const ids = Array.from(new Set(rows.map((r) => r.contact_id)))
      const { data: contacts, error: cErr } = await supabase
        .from('contacts')
        .select('id, first_name, last_name')
        .in('id', ids)
      // On remonte l'erreur (état error react-query) au lieu de rendre en silence des
      // puces anonymisées « Contact » comme si tout allait bien.
      if (cErr) throw new Error(cErr.message)
      const nameById = new Map<string, string>()
      for (const c of (contacts ?? []) as Array<{ id: string; first_name: string | null; last_name: string | null }>) {
        const n = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
        nameById.set(c.id, n || 'Contact')
      }

      return rows.map((r) => ({
        id: r.id,
        contact_id: r.contact_id,
        contact_name: nameById.get(r.contact_id) ?? 'Contact',
        action: r.action,
        due_at: r.due_at,
        kind: r.kind,
      }))
    },
  })
}
