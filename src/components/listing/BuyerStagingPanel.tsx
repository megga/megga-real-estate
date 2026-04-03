import { useState, useCallback } from 'react'
import { Wand2, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import BeforeAfterSlider from '@/components/listing/BeforeAfterSlider'

const STYLES = [
  { key: 'modern', label: 'Moderne' },
  { key: 'classic', label: 'Classique' },
  { key: 'luxury', label: 'Luxe' },
  { key: 'scandinavian', label: 'Scandinave' },
  { key: 'minimal', label: 'Minimal' },
] as const

const SESSION_KEY = 'megga-staging-count'
const MAX_FREE = 3

interface BuyerStagingPanelProps {
  photoUrl: string
  onClose: () => void
  className?: string
}

export default function BuyerStagingPanel({ photoUrl, onClose, className }: BuyerStagingPanelProps) {
  const [style, setStyle] = useState<string>('modern')
  const [loading, setLoading] = useState(false)
  const [stagedUrl, setStagedUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const getUsageCount = () => {
    try { return parseInt(sessionStorage.getItem(SESSION_KEY) || '0', 10) } catch { return 0 }
  }
  const incrementUsage = () => {
    try { sessionStorage.setItem(SESSION_KEY, String(getUsageCount() + 1)) } catch { /* noop */ }
  }

  const remaining = MAX_FREE - getUsageCount()

  const generate = useCallback(async () => {
    if (remaining <= 0) {
      setError('Vous avez atteint la limite de 3 essais gratuits par session.')
      return
    }

    setLoading(true)
    setError(null)
    setStagedUrl(null)

    try {
      const { data, error: fnError } = await supabase.functions.invoke('public-staging', {
        body: { photo_url: photoUrl, style, room_type: 'autre' },
      })

      if (fnError) throw new Error(fnError.message)
      if (data?.error) throw new Error(data.error)

      setStagedUrl(data.staged_url)
      incrementUsage()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur lors de la génération')
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [photoUrl, style, remaining])

  return (
    <div className={cn('bg-gray-900/95 backdrop-blur-sm rounded-xl p-4 max-w-md w-full', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Wand2 className="h-4 w-4 text-accent" />
          <span className="text-sm font-medium text-white">Essayer meublé</span>
        </div>
        <button onClick={onClose} className="h-7 w-7 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
          <X className="h-3.5 w-3.5 text-white" />
        </button>
      </div>

      {/* Style pills */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {STYLES.map(s => (
          <button
            key={s.key}
            onClick={() => { setStyle(s.key); setStagedUrl(null) }}
            className={cn(
              'h-8 px-3 rounded-full text-xs font-medium transition-colors',
              style === s.key ? 'bg-accent text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Generate button */}
      {!stagedUrl && (
        <button
          onClick={generate}
          disabled={loading || remaining <= 0}
          className="w-full h-10 rounded-lg text-sm font-medium bg-accent text-white hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-colors"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Génération en cours...
            </>
          ) : (
            <>
              <Wand2 className="h-4 w-4" />
              Générer ({remaining} essai{remaining !== 1 ? 's' : ''} restant{remaining !== 1 ? 's' : ''})
            </>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="text-xs text-red-400 mt-2 text-center">{error}</p>
      )}

      {/* Result: Before/After */}
      {stagedUrl && (
        <div className="mt-3">
          <BeforeAfterSlider
            before={photoUrl}
            after={stagedUrl}
            className="rounded-lg aspect-[4/3]"
          />
          <button
            onClick={() => { setStagedUrl(null); setError(null) }}
            className="w-full mt-2 h-8 rounded-lg text-xs text-white/70 hover:text-white bg-white/10 hover:bg-white/15 transition-colors"
          >
            Essayer un autre style
          </button>
        </div>
      )}
    </div>
  )
}
