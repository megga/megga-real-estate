import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
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

export interface TeamInvitation {
  id: string
  email: string
  role: 'admin' | 'manager' | 'agent' | 'assistant'
  status: 'pending' | 'accepted' | 'cancelled' | 'expired'
  created_at: string
  expires_at: string
  invited_by: string
}

const PLAN_LIMITS: Record<string, number> = {
  starter: 1,
  pro: 3,
  agency: 10,
  enterprise: 50,
}

// ─── Team Members ───

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

export function useTeamInvitations() {
  const { user, profile } = useAuth()

  return useQuery({
    queryKey: ['team-invitations', profile?.agency_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_invitations')
        .select('id, email, role, status, created_at, expires_at, invited_by')
        .eq('status', 'pending')
        .order('created_at', { ascending: false })

      if (error) throw error
      return data as TeamInvitation[]
    },
    enabled: !!user && !!profile?.agency_id,
  })
}

// ─── Agency Plan ───

export function useAgencyPlan() {
  const { user, profile } = useAuth()

  const query = useQuery({
    queryKey: ['agency-plan', profile?.agency_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('agencies')
        .select('plan')
        .eq('id', profile!.agency_id!)
        .single()

      if (error) throw error
      return data as { plan: string }
    },
    enabled: !!user && !!profile?.agency_id,
  })

  const plan = query.data?.plan ?? 'starter'
  const maxMembers = PLAN_LIMITS[plan] ?? 1

  return { plan, maxMembers, isLoading: query.isLoading }
}

// ─── Invite Team Member ───

export function useInviteTeamMember() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async (input: { email: string; role: string }) => {
      const { data, error } = await supabase.functions.invoke('send-team-invite', {
        body: { action: 'invite', email: input.email, role: input.role },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations', profile?.agency_id] })
      queryClient.invalidateQueries({ queryKey: ['team-members', profile?.agency_id] })
    },
  })
}

// ─── Resend Invitation ───

export function useResendInvitation() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.functions.invoke('send-team-invite', {
        body: { action: 'resend', invitationId },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations', profile?.agency_id] })
    },
  })
}

// ─── Cancel Invitation ───

export function useCancelInvitation() {
  const queryClient = useQueryClient()
  const { profile } = useAuth()

  return useMutation({
    mutationFn: async (invitationId: string) => {
      const { data, error } = await supabase.functions.invoke('send-team-invite', {
        body: { action: 'cancel', invitationId },
      })

      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-invitations', profile?.agency_id] })
    },
  })
}

// ─── Change Team Member Role ───

export function useChangeTeamRole() {
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

  return useMutation({
    mutationFn: async (input: { memberId: string; newRole: string }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: input.newRole })
        .eq('id', input.memberId)
        .eq('agency_id', profile!.agency_id!)

      if (error) throw error

      // Log activity
      await supabase.from('activity_events').insert({
        agency_id: profile!.agency_id,
        actor_id: user!.id,
        action: 'team_role_changed',
        entity_type: 'team',
        entity_id: input.memberId,
        metadata: { new_role: input.newRole },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', profile?.agency_id] })
    },
  })
}

// ─── Remove Team Member ───

export function useRemoveTeamMember() {
  const queryClient = useQueryClient()
  const { user, profile } = useAuth()

  return useMutation({
    mutationFn: async (memberId: string) => {
      // Get member info for activity log
      const { data: member } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', memberId)
        .single()

      const { error } = await supabase
        .from('profiles')
        .update({ agency_id: null, role: 'buyer' })
        .eq('id', memberId)
        .eq('agency_id', profile!.agency_id!)

      if (error) throw error

      // Log activity
      await supabase.from('activity_events').insert({
        agency_id: profile!.agency_id,
        actor_id: user!.id,
        action: 'team_member_removed',
        entity_type: 'team',
        entity_id: memberId,
        metadata: { email: member?.email, name: member?.full_name },
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team-members', profile?.agency_id] })
    },
  })
}
