import { useState, useRef, useEffect } from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslatedDescription } from '@/hooks/useTranslatedDescription'

interface ListingDescriptionProps {
  description: string
}

export default function ListingDescription({ description }: ListingDescriptionProps) {
  const [expanded, setExpanded] = useState(false)
  const [needsTruncation, setNeedsTruncation] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  const { text, isLoading, isTranslated } = useTranslatedDescription(description)

  useEffect(() => {
    if (textRef.current) {
      setNeedsTruncation(textRef.current.scrollHeight > textRef.current.clientHeight + 2)
    }
  }, [text])

  if (!description) return null

  return (
    <div className="mt-8">
      <div className="flex items-center gap-2 mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Description</h2>
        {isTranslated && (
          <span className="inline-flex items-center gap-1 text-xs text-theme-tertiary">
            <Sparkles className="h-3 w-3" />
            traduction automatique
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="space-y-2">
          <div className="h-3 bg-theme-hover rounded w-full animate-pulse" />
          <div className="h-3 bg-theme-hover rounded w-11/12 animate-pulse" />
          <div className="h-3 bg-theme-hover rounded w-4/5 animate-pulse" />
        </div>
      ) : (
        <>
          <div
            ref={textRef}
            className={cn(
              'text-sm md:text-base text-gray-700 leading-relaxed space-y-4 transition-[max-height] duration-300 overflow-hidden',
              !expanded && 'max-h-[6.5em]'
            )}
          >
            {text.split('\n\n').map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          {(needsTruncation || expanded) && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-sm font-medium text-accent hover:text-accent/80 transition-colors"
            >
              {expanded ? 'Réduire' : 'Lire la suite'}
            </button>
          )}
        </>
      )}
    </div>
  )
}
