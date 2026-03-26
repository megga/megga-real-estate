import { useState, useEffect, useCallback } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SmartRepliesProps {
  lastClientMessage: string | null
  contactName: string
  onSelect: (reply: string) => void
  className?: string
}

interface SmartReply {
  id: string
  label: string
  text: string
  tone: 'short' | 'detailed' | 'followup'
}

/**
 * Generates 3 contextual reply suggestions based on the last client message.
 * Uses the AI copilot Edge Function for smart generation.
 */
export default function SmartReplies({ lastClientMessage, contactName, onSelect, className }: SmartRepliesProps) {
  const [replies, setReplies] = useState<SmartReply[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const generateReplies = useCallback(async () => {
    if (!lastClientMessage || lastClientMessage.length < 5) return

    setIsLoading(true)
    setIsVisible(true)
    setSelectedId(null)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
      const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

      const response = await fetch(`${supabaseUrl}/functions/v1/ai-copilot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseKey}`,
        },
        body: JSON.stringify({
          action: 'chat',
          message: `Le client ${contactName} vient d'envoyer ce message : "${lastClientMessage}"

Génère EXACTEMENT 3 réponses possibles pour l'agent, au format JSON strict :
[
  { "label": "Confirmer", "text": "texte de la réponse courte", "tone": "short" },
  { "label": "Détailler", "text": "texte de la réponse détaillée avec proposition", "tone": "detailed" },
  { "label": "Relancer", "text": "texte de relance ou question de suivi", "tone": "followup" }
]

Règles :
- Vouvoiement, ton professionnel suisse
- La réponse courte fait 1-2 lignes max
- La réponse détaillée mentionne un bien ou une action concrète si pertinent
- La relance pose une question ouverte pour maintenir l'échange
- Retourne UNIQUEMENT le JSON, rien d'autre`,
          language: 'fr',
        }),
      })

      if (!response.ok) throw new Error('Failed')

      const data = await response.json()

      // Parse JSON from AI response
      let parsed: SmartReply[]
      try {
        const raw = typeof data.result === 'string' ? data.result : JSON.stringify(data.result)
        // Extract JSON array from response (may have markdown wrapper)
        const jsonMatch = raw.match(/\[[\s\S]*\]/)
        parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : []
      } catch {
        parsed = []
      }

      if (parsed.length > 0) {
        setReplies(parsed.map((r, i) => ({ ...r, id: `reply-${i}` })))
      } else {
        // Fallback — generate basic replies locally
        setReplies([
          { id: 'r1', label: 'Confirmer', text: `Bonjour ${contactName}, merci pour votre message. Je reviens vers vous rapidement.`, tone: 'short' },
          { id: 'r2', label: 'Détailler', text: `Bonjour ${contactName}, merci pour votre retour. Je vous propose que nous en discutions de vive voix. Quand seriez-vous disponible cette semaine ?`, tone: 'detailed' },
          { id: 'r3', label: 'Relancer', text: `Bonjour ${contactName}, avez-vous eu l'occasion de réfléchir à notre dernière proposition ? Je reste à votre disposition.`, tone: 'followup' },
        ])
      }
    } catch {
      // Fallback replies
      setReplies([
        { id: 'r1', label: 'Confirmer', text: `Merci ${contactName}, bien noté. Je reviens vers vous.`, tone: 'short' },
        { id: 'r2', label: 'Détailler', text: `Merci pour votre message. Je vous propose un échange cette semaine pour en discuter.`, tone: 'detailed' },
        { id: 'r3', label: 'Relancer', text: `Bien reçu. Avez-vous des questions supplémentaires ?`, tone: 'followup' },
      ])
    } finally {
      setIsLoading(false)
    }
  }, [lastClientMessage, contactName])

  // Auto-generate when last message changes
  useEffect(() => {
    if (lastClientMessage && lastClientMessage.length > 10) {
      generateReplies()
    } else {
      setIsVisible(false)
    }
  }, [lastClientMessage, generateReplies])

  if (!isVisible) return null

  function handleSelect(reply: SmartReply) {
    setSelectedId(reply.id)
    onSelect(reply.text)
  }

  const toneStyles: Record<string, string> = {
    short: 'border-emerald-500/30 hover:border-emerald-500',
    detailed: 'border-accent/30 hover:border-accent',
    followup: 'border-amber-500/30 hover:border-amber-500',
  }

  return (
    <div className={cn('px-3 pb-2', className)}>
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles className="w-3 h-3 text-theme-muted" />
        <span className="text-[10px] text-theme-muted">Réponses suggérées</span>
        {isLoading && <Loader2 className="w-3 h-3 animate-spin text-theme-muted" />}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {replies.map(reply => (
          <button
            key={reply.id}
            onClick={() => handleSelect(reply)}
            title={reply.text}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-colors',
              selectedId === reply.id
                ? 'bg-theme-active text-theme-primary border-theme-active'
                : cn('text-theme-secondary border-theme-border', toneStyles[reply.tone])
            )}
          >
            {reply.label}
          </button>
        ))}
      </div>
    </div>
  )
}
