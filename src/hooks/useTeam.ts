/**
 * Membres de l'équipe de l'agence courante (table `profiles`, scopée `agency_id`).
 *
 * Les dividers en fin de fichier réservent la place des hooks d'invitation/rôle
 * (invite, resend, cancel, change role, remove) restant à câbler.
 */
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

export interface TeamMember {
  id: string
  full_name: string
  email: string
  avatar_url: string | null
  role: 'admin' | 'manager' | 'agent' | 'assistant'
  phone: string | null
  created_at: string
}

/** Liste les collègues de l'agence, triés par ancienneté (created_at croissant). */
export function useTeamMembers() {
  const { user, profile } = useAuth()

  return useQuery({
    queryKey: ['team-members', profile?.agency_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, avatar_url, role, phone, created_at')
        .eq('agency_id', profile!.agency_id!)
        .order('created_at', { ascending: true })

      if (error) throw error
      return data as TeamMember[]
    },
    enabled: !!user && !!profile?.agency_id,
  })
}

// ─── Team Invitations ───
// ─── Agency Plan ───
// ─── Invite Team Member ───
// ─── Resend Invitation ───
// ─── Cancel Invitation ───
// ─── Change Team Member Role ───
// ─── Remove Team Member ───
