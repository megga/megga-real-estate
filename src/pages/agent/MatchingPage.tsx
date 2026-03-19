import { useState, useMemo } from 'react'
import { Search, Sparkles, Users, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useMatching } from '@/hooks/useMatching'
import MatchScoreCard from '@/components/matching/MatchScoreCard'
import SendMatchDialog from '@/components/matching/SendMatchDialog'
import type { MatchResult } from '@/lib/matching'

export default function MatchingPage() {
  const { suggested, sent, sendMatch, ignoreMatch } = useMatching()
  const [search, setSearch] = useState('')
  const [filterBy, setFilterBy] = useState<'all' | 'suggested' | 'sent'>('all')
  const [sendDialog, setSendDialog] = useState<MatchResult | null>(null)

  const allMatches = useMemo(() => {
    let list = filterBy === 'suggested' ? suggested : filterBy === 'sent' ? sent : [...suggested, ...sent]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (m) =>
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Matching</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {suggested.length} suggestion{suggested.length > 1 ? 's' : ''} · {sent.length} envoyé{sent.length > 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* KPI mini */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-card shadow-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center text-accent">
            <Sparkles className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Suggestions</p>
            <p className="text-sm font-bold text-primary-900">{suggested.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-card shadow-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center text-success">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Envoyés</p>
            <p className="text-sm font-bold text-primary-900">{sent.length}</p>
          </div>
        </div>
        <div className="bg-white rounded-card shadow-card p-3 flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-purple-100 flex items-center justify-center text-purple-600">
            <Building2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Contacts</p>
            <p className="text-sm font-bold text-primary-900">{groupedByContact.length}</p>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
          <input
            type="text"
            placeholder="Rechercher contact ou bien..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        <div className="flex items-center bg-section border border-border rounded-button p-0.5">
          {(['all', 'suggested', 'sent'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilterBy(f)}
              className={cn(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors',
                filterBy === f ? 'bg-white shadow-sm text-primary-900' : 'text-primary-400 hover:text-primary-600'
              )}
            >
              {f === 'all' ? 'Tous' : f === 'suggested' ? 'À envoyer' : 'Envoyés'}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped by contact */}
      {groupedByContact.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-card shadow-card">
          <Sparkles className="h-8 w-8 text-primary-300 mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">Aucun match trouvé</p>
        </div>
      ) : (
        <div className="space-y-6">
          {groupedByContact.map(([contactId, group]) => (
            <div key={contactId}>
              <h2 className="text-sm font-semibold text-primary-900 mb-3">
                {group.name}
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {group.matches.length} bien{group.matches.length > 1 ? 's' : ''} compatible{group.matches.length > 1 ? 's' : ''}
                </span>
              </h2>
              <div className="space-y-3">
                {group.matches.map((match) => (
                  <MatchScoreCard
                    key={match.id}
                    match={match}
                    onSend={() => setSendDialog(match)}
                    onIgnore={() => ignoreMatch(match.id)}
                  />
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
  )
}
