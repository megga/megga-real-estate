import { useState } from 'react'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { useContactMatches, useRunMatching, useUpdateMatchStatus, type MatchResult } from '@/hooks/useMatching'
import MatchScoreCard from './MatchScoreCard'
import SendMatchDialog from './SendMatchDialog'

interface MatchingPanelProps {
  contactId: string
  contactName: string
}

export default function MatchingPanel({ contactId, contactName }: MatchingPanelProps) {
  const { matches, isLoading } = useContactMatches(contactId)
  const isError = false
  const runMatching = useRunMatching()
  const updateStatus = useUpdateMatchStatus()
  const [sendDialog, setSendDialog] = useState<MatchResult | null>(null)

  // contactName kept in props for future use (e.g. send dialog context)
  void contactName

  const allMatches = matches || []
  const suggested = allMatches.filter((m) => m.status === 'suggested')
  const sent = allMatches.filter((m) => m.status === 'sent')

  function handleRunMatching() {
    runMatching.mutate({ trigger: 'new_search', contact_id: contactId })
  }

  function handleIgnore(matchId: string) {
    updateStatus.mutate({ matchId, status: 'ignored' })
  }

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-theme-tertiary mx-auto mb-2" />
        <p className="text-sm text-theme-tertiary">Chargement des matchs...</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-500">Erreur lors du chargement</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-theme-tertiary">
          {suggested.length} suggestion{suggested.length > 1 ? 's' : ''}
          {sent.length > 0 && ` · ${sent.length} envoyé${sent.length > 1 ? 's' : ''}`}
        </p>
        <button
          onClick={handleRunMatching}
          disabled={runMatching.isPending}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-theme-secondary hover:text-theme-primary transition-colors disabled:opacity-50"
        >
          {runMatching.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          Chercher des biens compatibles
        </button>
      </div>

      {runMatching.isSuccess && runMatching.data && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
          <p className="text-xs text-emerald-600">
            {runMatching.data.matches_created} nouveau{runMatching.data.matches_created > 1 ? 'x' : ''} match{runMatching.data.matches_created > 1 ? 's' : ''} trouvé{runMatching.data.matches_created > 1 ? 's' : ''}
          </p>
        </div>
      )}

      {allMatches.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="h-8 w-8 text-theme-tertiary mx-auto mb-2" />
          <p className="text-sm text-theme-tertiary">Aucun bien compatible trouvé</p>
          <p className="text-xs text-theme-muted mt-1">Lancez la recherche ou ajoutez des critères de recherche au contact.</p>
        </div>
      ) : (
        allMatches.map((match) => (
          <MatchScoreCard
            key={match.id}
            match={match}
            onSend={() => setSendDialog(match)}
            onIgnore={() => handleIgnore(match.id)}
          />
        ))
      )}

      {sendDialog && (
        <SendMatchDialog
          open={true}
          match={sendDialog}
          onClose={() => setSendDialog(null)}
        />
      )}
    </div>
  )
}
