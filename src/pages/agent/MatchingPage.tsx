import { useState, useMemo } from 'react'
import { Search } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import { useMatching } from '@/hooks/useMatching'
import SendMatchDialog from '@/components/matching/SendMatchDialog'
import type { MatchResult } from '@/lib/matching'
import PageTransition from '@/components/layout/PageTransition'

// Score dot color based on %
function scoreDot(score: number) {
  if (score >= 90) return 'bg-emerald-400'
  if (score >= 70) return 'bg-blue-400'
  if (score >= 50) return 'bg-amber-400'
  return 'bg-gray-400'
}

export default function MatchingPage() {
  const { suggested, sent, sendMatch } = useMatching()
  const [search, setSearch] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'suggested' | 'sent'>('all')
  const [sendDialog, setSendDialog] = useState<MatchResult | null>(null)

  const allMatches = useMemo(() => {
    let list = filterBy === 'suggested' ? suggested : filterBy === 'sent' ? sent : [...suggested, ...sent]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((m) =>
        m.contactName.toLowerCase().includes(q) ||
        m.listing.title.toLowerCase().includes(q) ||
        m.listing.city.toLowerCase().includes(q)
      )
    }
    return list
  }, [suggested, sent, search, filterBy])

  // Group by contact
  const groupedByContact = useMemo(() => {
    const groups = new Map<string, { name: string; matches: MatchResult[] }>()
    for (const m of allMatches) {
      const existing = groups.get(m.contactId)
      if (existing) {
        existing.matches.push(m)
      } else {
        groups.set(m.contactId, { name: m.contactName, matches: [m] })
      }
    }
    return Array.from(groups.entries())
  }, [allMatches])

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold text-theme-primary">Matching</h1>
          <p className="text-sm text-theme-tertiary mt-0.5">
            {suggested.length} suggestion{suggested.length > 1 ? 's' : ''} · {sent.length} envoyé{sent.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="flex items-center border border-theme-border rounded-lg p-0.5">
            {(['all', 'suggested', 'sent'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilterBy(f)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                  filterBy === f ? 'bg-theme-active text-theme-primary' : 'text-theme-tertiary hover:text-theme-secondary'
                )}
              >
                {f === 'all' ? 'Tous' : f === 'suggested' ? 'À envoyer' : 'Envoyés'}
              </button>
            ))}
          </div>
        </div>

        {/* Grouped by contact */}
        {groupedByContact.length === 0 ? (
          <div className="text-center py-12 rounded-xl border border-theme-border">
            <p className="text-sm text-theme-tertiary">Aucun match trouvé</p>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedByContact.map(([contactId, group]) => (
              <div key={contactId}>
                {/* Contact header */}
                <div className="flex items-center gap-2 mb-2">
                  <h2 className="text-sm font-semibold text-theme-primary">{group.name}</h2>
                  <span className="text-xs text-theme-tertiary">
                    {group.matches.length} bien{group.matches.length > 1 ? 's' : ''} compatible{group.matches.length > 1 ? 's' : ''}
                  </span>
                </div>

                {/* Match rows — bento transparent */}
                <div className="rounded-xl border border-theme-border">
                  {group.matches.map((match, i) => (
                    <div
                      key={match.id}
                      className={cn(
                        'flex items-center px-4 py-3 group hover:bg-theme-hover transition-colors cursor-pointer',
                        i < group.matches.length - 1 && 'border-b border-theme-border'
                      )}
                    >
                      {/* Thumbnail */}
                      {match.listing.photos?.[0] && (
                        <img
                          src={match.listing.photos[0]}
                          alt={match.listing.title}
                          className="h-10 w-10 rounded-lg object-cover shrink-0"
                        />
                      )}

                      {/* Bien info */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">
                          {match.listing.title}
                        </p>
                        <p className="text-xs text-theme-tertiary truncate mt-0.5">
                          {match.listing.address}, {match.listing.city}
                        </p>
                      </div>

                      {/* Score */}
                      <div className="flex items-center gap-1.5 w-16 shrink-0">
                        <div className={cn('h-1.5 w-1.5 rounded-full', scoreDot(match.score))} />
                        <span className="text-xs font-medium text-theme-secondary">{match.score}%</span>
                      </div>

                      {/* Prix */}
                      <span className="text-sm font-medium text-theme-primary w-28 text-right shrink-0 hidden sm:block">
                        {formatCHF(match.listing.price)}
                      </span>

                      {/* CTA au hover */}
                      <div className="w-24 shrink-0 flex justify-end">
                        {match.status === 'sent' ? (
                          <span className="text-[11px] text-theme-tertiary">Envoyé</span>
                        ) : (
                          <button
                            onClick={(e) => { e.stopPropagation(); setSendDialog(match) }}
                            className="text-[11px] font-medium text-theme-tertiary opacity-0 group-hover:opacity-100 hover:text-accent transition-all"
                          >
                            Envoyer →
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <SendMatchDialog
          open={sendDialog !== null}
          match={sendDialog}
          contactName={sendDialog?.contactName || ''}
          onSend={sendMatch}
          onClose={() => setSendDialog(null)}
        />
      </div>
    </PageTransition>
  )
}
