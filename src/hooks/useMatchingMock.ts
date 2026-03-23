// Legacy mock-based matching hook — kept for reference.
// New code should use useMatches/useContactMatches from useMatching.ts

import { useState, useCallback, useMemo } from 'react'
import { matchContactAgainstListings, matchAllBuyers, type MatchResult } from '@/lib/matching'

export function useMatching(contactId?: string) {
  const initialMatches = useMemo(() => {
    if (contactId) return matchContactAgainstListings(contactId)
    return matchAllBuyers()
  }, [contactId])

  const [matches, setMatches] = useState<MatchResult[]>(initialMatches)

  const sendMatch = useCallback((matchId: string, channel: 'email' | 'whatsapp' | 'both') => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId
          ? { ...m, status: 'sent' as const, sentVia: channel, sentAt: new Date().toISOString() }
          : m
      )
    )
  }, [])

  const ignoreMatch = useCallback((matchId: string) => {
    setMatches((prev) =>
      prev.map((m) =>
        m.id === matchId ? { ...m, status: 'ignored' as const } : m
      )
    )
  }, [])

  const suggested = useMemo(() => matches.filter((m) => m.status === 'suggested'), [matches])
  const sent = useMemo(() => matches.filter((m) => m.status === 'sent'), [matches])

  return {
    matches,
    suggested,
    sent,
    sendMatch,
    ignoreMatch,
    isLoading: false,
  }
}
