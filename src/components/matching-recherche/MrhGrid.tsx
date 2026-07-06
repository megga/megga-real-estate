// Matching · Recherche — grille d'annonces (wrapper des cartes).

import MrhCard from './MrhCard'
import type { MrhBien } from './types'
import type { MrhCtx, MrhScore } from './mrhCtx'

export interface MrhItem {
  b: MrhBien
  m: MrhScore | null
}

interface Props {
  items: MrhItem[]
  offset?: number
  useMiss?: boolean
  /** texte d'explication par item (raisons résolues / motif « proche ») */
  reasonFor: (it: MrhItem) => string | null
  ctx: MrhCtx
}

export default function MrhGrid({ items, offset = 0, useMiss = false, reasonFor, ctx }: Props) {
  return (
    <div className="mrh-grid">
      {items.map((it, i) => (
        <MrhCard
          key={it.b.id}
          bien={it.b}
          index={i + offset}
          score={it.m ? it.m.score : null}
          reasonText={reasonFor(it)}
          useMiss={useMiss}
          ctx={ctx}
        />
      ))}
    </div>
  )
}
