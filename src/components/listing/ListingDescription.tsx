import { useState, useRef, useEffect } from 'react'
import { cn } from '@/lib/utils'

interface ListingDescriptionProps {
  description: string
}

export default function ListingDescription({ description }: ListingDescriptionProps) {
  const [expanded, setExpanded] = useState(false)
  const [needsTruncation, setNeedsTruncation] = useState(false)
  const textRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (textRef.current) {
      setNeedsTruncation(textRef.current.scrollHeight > textRef.current.clientHeight + 2)
    }
  }, [description])

  if (!description) return null

  return (
    <div className="mt-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Description</h2>
      <div
        ref={textRef}
        className={cn(
          'text-sm md:text-base text-gray-700 leading-relaxed space-y-4 transition-[max-height] duration-300 overflow-hidden',
          !expanded && 'max-h-[6.5em]'
        )}
      >
        {description.split('\n\n').map((p, i) => (
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
    </div>
  )
}
