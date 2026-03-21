import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useMatching } from '@/hooks/useMatching'
import MatchScoreCard from './MatchScoreCard'
import SendMatchDialog from './SendMatchDialog'
import type { MatchResult } from '@/lib/matching'

interface MatchingPanelProps {
  contactId: string
  contactName: string
}

export default function MatchingPanel({ contactId, contactName }: MatchingPanelProps) {
  const { suggested, sent, sendMatch } = useMatching(contactId)
  const [sendDialog, setSendDialog] = useState<MatchResult | null>(null)

  const allMatches = [...suggested, ...sent]

  if (allMatches.length === 0) {
    return (
      <div className="text-center py-12">
        <Sparkles className="h-8 w-8 text-primary-300 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">Aucun bien compatible trouvé</p>
        <p className="text-xs text-muted-foreground mt-1">Les matchs apparaîtront automatiquement quand de nouveaux biens seront ajoutés.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {suggested.length} suggestion{suggested.length > 1 ? 's' : ''}
          {sent.length > 0 && ` · ${sent.length} envoyé${sent.length > 1 ? 's' : ''}`}
        </p>
      </div>

      {allMatches.map((match) => (
        <MatchScoreCard
          key={match.id}
          match={match}
          onSend={() => setSendDialog(match)}
          onIgnore={() => {/* planifier visite */}}
        />
      ))}

      <SendMatchDialog
        open={sendDialog !== null}
        match={sendDialog}
        contactName={contactName}
        onSend={sendMatch}
        onClose={() => setSendDialog(null)}
      />
    </div>
  )
}
