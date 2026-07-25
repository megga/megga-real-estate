// P7 — Probe Realtime réel (remplace le faux realtimeConnections:0 retiré en P5).
// Ouvre un channel éphémère et mesure le temps jusqu'à SUBSCRIBED :
//   ok   < 1.5s · slow < 5s · down = échec/timeout.
// Règle repo : TOUJOURS useId() pour le nom de channel (crash au re-mount sinon).

import { useEffect, useId, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type RealtimeStatus = 'checking' | 'ok' | 'slow' | 'down'

export function useRealtimeHealth(): { status: RealtimeStatus; latencyMs: number | null } {
  const channelId = useId()
  const [status, setStatus] = useState<RealtimeStatus>('checking')
  const [latencyMs, setLatencyMs] = useState<number | null>(null)

  useEffect(() => {
    const started = performance.now()
    let settled = false
    const channel = supabase.channel(`admin-rt-probe-${channelId}`)

    const timeout = setTimeout(() => {
      if (!settled) { settled = true; setStatus('down'); void supabase.removeChannel(channel) }
    }, 5000)

    channel.subscribe((state) => {
      if (settled) return
      if (state === 'SUBSCRIBED') {
        settled = true
        clearTimeout(timeout)
        const ms = Math.round(performance.now() - started)
        setLatencyMs(ms)
        setStatus(ms < 1500 ? 'ok' : 'slow')
        void supabase.removeChannel(channel)
      } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
        settled = true
        clearTimeout(timeout)
        setStatus('down')
        void supabase.removeChannel(channel)
      }
    })

    return () => {
      settled = true
      clearTimeout(timeout)
      void supabase.removeChannel(channel)
    }
  }, [channelId])

  return { status, latencyMs }
}
