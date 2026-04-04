import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'

export function useTicketAiSuggestion() {
  const [suggestion, setSuggestion] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateSuggestion = useCallback(async (ticketId: string) => {
    setLoading(true)
    setError(null)
    setSuggestion('')

    try {
      const { data, error: fnError } = await supabase.functions.invoke('ticket-ai-reply', {
        body: { ticket_id: ticketId },
      })

      if (fnError) throw fnError
      if (data?.error) throw new Error(data.error)

      setSuggestion(data?.reply ?? '')
    } catch (err) {
      setError((err as Error).message ?? 'Erreur lors de la generation')
    } finally {
      setLoading(false)
    }
  }, [])

  const clear = useCallback(() => {
    setSuggestion('')
    setError(null)
  }, [])

  return { suggestion, loading, error, generateSuggestion, clear }
}
