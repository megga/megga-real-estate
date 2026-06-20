import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { useContactMatches, useRunMatching, useUpdateMatchStatus, type MatchResult } from '@/hooks/useMatching'
import MatchScoreCard from './MatchScoreCard'
import SendMatchDialog from './SendMatchDialog'

interface MatchingPanelProps {
  contactId: string
  contactName: string
}

export default function MatchingPanel({ contactId, contactName }: MatchingPanelProps) {
  const { t } = useTranslation('matching')
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
        <p className="text-sm text-theme-tertiary">{t('panel.loading')}</p>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-red-500">{t('panel.loadError')}</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-theme-tertiary">
          {t('panel.suggestionCount', { count: suggested.length })}
          {sent.length > 0 && ` · ${t('panel.sentCount', { count: sent.length })}`}
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
          {t('panel.searchCompatible')}
        </button>
      </div>

      {runMatching.isSuccess && runMatching.data && (
        <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-2">
          <p className="text-xs text-emerald-600">
            {t('panel.matchesFound', { count: runMatching.data.matches_created })}
          </p>
        </div>
      )}

      {allMatches.length === 0 ? (
        <div className="text-center py-12">
          <Sparkles className="h-8 w-8 text-theme-tertiary mx-auto mb-2" />
          <p className="text-sm text-theme-tertiary">{t('panel.emptyTitle')}</p>
          <p className="text-xs text-theme-muted mt-1">{t('panel.emptyDesc')}</p>
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
