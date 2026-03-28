import { useState } from 'react'
import { cn } from '@/lib/utils'
import { detectIntentLocal, useIntentDetection, INTENT_CONFIG } from '@/hooks/useIntentDetection'
import type { IntentResult, MessageIntent } from '@/hooks/useIntentDetection'

interface MessageIntentBadgeProps {
  messageContent: string
  className?: string
}

/**
 * Shows an intent badge for a client message.
 * Uses local detection first (instant), then optionally calls AI for deeper analysis.
 */
export default function MessageIntentBadge({ messageContent, className }: MessageIntentBadgeProps) {
  const [showDetail, setShowDetail] = useState(false)
  const [aiResult, setAiResult] = useState<IntentResult | null>(null)
  const { detectIntent, isDetecting } = useIntentDetection()

  // Instant local detection
  const localResult = detectIntentLocal(messageContent)
  const intent: MessageIntent = aiResult?.intent ?? localResult.intent
  const config = INTENT_CONFIG[intent]

  // Don't show badge for neutral messages
  if (intent === 'neutral' && !aiResult) return null

  async function handleClick() {
    setShowDetail(!showDetail)
    // Trigger AI analysis on first click if not already done
    if (!aiResult && !isDetecting) {
      try {
        const result = await detectIntent(messageContent)
        setAiResult(result)
      } catch {
        // Ignore — local result is the fallback
      }
    }
  }

  return (
    <div className={cn('inline-flex flex-col', className)}>
      <button
        onClick={handleClick}
        className={cn(
          'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors',
          'border border-theme-border hover:border-theme-active',
          config.color,
        )}
        title={aiResult?.summary ?? config.label}
      >
        <span>{config.emoji}</span>
        <span>{config.label}</span>
        {isDetecting && <span className="animate-pulse">...</span>}
      </button>

      {/* Detail popover */}
      {showDetail && aiResult && (
        <div className="mt-1.5 p-3 rounded-lg border border-theme-border bg-theme-card text-xs max-w-[280px]">
          <p className={cn('font-medium mb-1', config.color)}>
            {config.emoji} {config.label} ({aiResult.confidence}%)
          </p>
          <p className="text-theme-secondary mb-2">{aiResult.summary}</p>
          <div className="border-t border-theme-border pt-2">
            <p className="text-theme-muted text-[10px] mb-0.5">Action suggérée :</p>
            <p className="text-theme-primary font-medium">{aiResult.suggested_action}</p>
          </div>
          {aiResult.keywords.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {aiResult.keywords.map(kw => (
                <span key={kw} className="px-1.5 py-0.5 rounded bg-theme-hover text-[10px] text-theme-muted">{kw}</span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
