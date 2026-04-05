import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface AgentReview {
  id: string
  agent_profile_id: string
  reviewer_name: string
  is_verified: boolean
  rating_local_knowledge: number
  rating_process_expertise: number
  rating_responsiveness: number
  rating_negotiation: number
  rating_overall: number
  comment: string | null
  agent_response: string | null
  agent_responded_at: string | null
  created_at: string
}

export function useAgentReviews(agentProfileId: string, sortBy: 'recent' | 'best' = 'recent') {
  return useQuery({
    queryKey: ['agent-reviews', agentProfileId, sortBy],
    queryFn: async (): Promise<AgentReview[]> => {
      let query = supabase
        .from('agent_reviews')
        .select('id, agent_profile_id, reviewer_name, is_verified, rating_local_knowledge, rating_process_expertise, rating_responsiveness, rating_negotiation, rating_overall, comment, agent_response, agent_responded_at, created_at')
        .eq('agent_profile_id', agentProfileId)
        .eq('status', 'approved')

      if (sortBy === 'best') {
        query = query.order('rating_overall', { ascending: false })
      } else {
        query = query.order('created_at', { ascending: false })
      }

      const { data, error } = await query
      if (error) throw error
      return (data ?? []) as AgentReview[]
    },
    enabled: !!agentProfileId,
    staleTime: 60_000,
  })
}

export interface SubmitReviewInput {
  agent_profile_id: string
  reviewer_name: string
  reviewer_email: string
  rating_local_knowledge: number
  rating_process_expertise: number
  rating_responsiveness: number
  rating_negotiation: number
  comment: string
}

export function useSubmitReview() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: SubmitReviewInput) => {
      const { error } = await supabase.from('agent_reviews').insert(input)
      if (error) throw error
    },
    onSuccess: (_, input) => {
      queryClient.invalidateQueries({ queryKey: ['agent-reviews', input.agent_profile_id] })
    },
  })
}
