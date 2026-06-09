// MEGGA X — List. Transcription fidèle : <ol|ul class="default-list"> avec des
// <li class="display-N text-color-neutral-700">. (Source : style guide la vitrine MEGGA.)
import { cn } from '@/lib/utils'

interface Props {
  items: React.ReactNode[]
  ordered?: boolean
  /** taille display des items (1 ou 2 dans la source) */
  display?: 1 | 2
  medium?: boolean
  className?: string
}

export default function MxList({ items, ordered, display = 1, medium, className }: Props) {
  const Tag = ordered ? 'ol' : 'ul'
  return (
    <Tag className={cn('default-list', className)} role="list">
      {items.map((it, i) => (
        <li key={i} className={cn(`display-${display}`, medium && 'medium', 'text-color-neutral-700')}>
          {it}
        </li>
      ))}
    </Tag>
  )
}
