import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'

// Client-side sha256 for cache key. Matches the server hash so we can
// peek at translation_cache directly via RLS (public SELECT) on the happy
// path and skip the EF round-trip for cache hits.
async function sha256(input: string): Promise<string> {
  const buf = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', buf)
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

type SupportedLang = 'de' | 'en' | 'it'

function normalizeLang(raw: string | undefined): SupportedLang | null {
  if (!raw) return null
  const short = raw.slice(0, 2).toLowerCase()
  if (short === 'de' || short === 'en' || short === 'it') return short
  return null
}

/**
 * Returns the translated description for the current i18n language.
 * - If language is FR → returns the original (no network call).
 * - If language is DE/EN/IT → checks translation_cache client-side first,
 *   then calls translate-on-demand EF on miss.
 * - Fallback on any error: the original (FR) description.
 */
export function useTranslatedDescription(description: string | null | undefined): {
  text: string
  isLoading: boolean
  isTranslated: boolean
} {
  const { i18n } = useTranslation()
  const targetLang = normalizeLang(i18n.language)
  const content = (description || '').trim()

  const enabled = !!content && !!targetLang

  const query = useQuery({
    queryKey: ['translation', targetLang, content.slice(0, 40), content.length],
    enabled,
    staleTime: Infinity,
    gcTime: 1000 * 60 * 60,
    queryFn: async () => {
      if (!targetLang) return content
      const hash = await sha256(content)

      // 1. Try cache via public RLS read (no EF invocation)
      const { data: cached } = await supabase
        .from('translation_cache')
        .select('translated_text')
        .eq('content_hash', hash)
        .eq('lang', targetLang)
        .maybeSingle()

      if (cached?.translated_text) return cached.translated_text

      // 2. Cache miss → EF (handles DeepSeek call + cache insert)
      const { data, error } = await supabase.functions.invoke('translate-on-demand', {
        body: { content, target_lang: targetLang },
      })
      if (error) throw error
      return (data?.translated as string) || content
    },
  })

  if (!enabled || !targetLang) {
    return { text: content, isLoading: false, isTranslated: false }
  }

  return {
    text: query.data || content,
    isLoading: query.isLoading,
    isTranslated: !!query.data && query.data !== content,
  }
}
