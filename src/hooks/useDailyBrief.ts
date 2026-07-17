/**
 * Briefing matinal MEGGA AI pour la page « Aujourd'hui ». Génère le texte une
 * fois par jour (cache localStorage keyé agent+date) pour éviter de régénérer et
 * refacturer à chaque montage ; gated par le flag `copilot_briefing_enabled`.
 */
// Briefing matinal MEGGA AI — appelle l'action daily_brief de l'edge ai-copilot
// UNE FOIS PAR JOUR (cache localStorage keyé par agent + date), pour éviter de
// régénérer (et refacturer) à chaque montage de la page « Aujourd'hui ».
//
// L'edge renvoie { result, disabled?, empty?, generated? } : disabled si le flag
// app_config copilot_briefing_enabled est OFF (défaut), empty si aucun signal.
// Le hook expose un texte prêt à afficher (ou vide → la carte ne se rend pas).

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

interface BriefResponse {
  result?: string
  disabled?: boolean
  empty?: boolean
  generated?: boolean
}

interface CacheEntry {
  date: string       // YYYY-MM-DD
  text: string
  disabled: boolean
}

const CACHE_PREFIX = 'megga.today.brief.v1'
const today = () => new Date().toISOString().slice(0, 10)

/** Lit l'entrée de cache du jour ; null si absente ou périmée (date ≠ aujourd'hui). */
function readCache(key: string): CacheEntry | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const e = JSON.parse(raw) as CacheEntry
    return e.date === today() ? e : null
  } catch {
    return null
  }
}
/** Persiste l'entrée de cache ; silencieux en navigation privée (localStorage indisponible). */
function writeCache(key: string, entry: CacheEntry) {
  try { window.localStorage.setItem(key, JSON.stringify(entry)) } catch { /* incognito */ }
}

/** Texte du briefing du jour prêt à afficher (vide → la carte ne se rend pas), + `disabled`/`isLoading`. */
export function useDailyBrief(): { text: string; isLoading: boolean; disabled: boolean } {
  const { profile } = useAuth()
  const userId = profile?.id ?? null
  const [text, setText] = useState('')
  const [disabled, setDisabled] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const requested = useRef(false)

  useEffect(() => {
    if (!userId || requested.current) return
    requested.current = true

    const key = `${CACHE_PREFIX}.${userId}.${today()}`
    const cached = readCache(key)
    if (cached) {
      setText(cached.text)
      setDisabled(cached.disabled)
      return
    }

    let cancelled = false
    setIsLoading(true)
    supabase.functions
      .invoke<BriefResponse>('ai-copilot', { body: { action: 'daily_brief', message: '', language: 'fr' } })
      .then(({ data }) => {
        if (cancelled) return
        const off = !!data?.disabled
        const result = off || data?.empty ? '' : (data?.result ?? '')
        setText(result)
        setDisabled(off)
        writeCache(key, { date: today(), text: result, disabled: off })
      })
      .catch(() => { /* silencieux — pas de briefing plutôt qu'une erreur */ })
      .finally(() => { if (!cancelled) setIsLoading(false) })

    return () => { cancelled = true }
  }, [userId])

  return { text, isLoading, disabled }
}
