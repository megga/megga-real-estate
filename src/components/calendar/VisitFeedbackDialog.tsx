import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { Star } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import type { CalendarEvent } from '@/components/calendar/week-view-types'

interface VisitFeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  event: CalendarEvent | null
  onSubmit: (event: CalendarEvent, feedback: { feedbackBuyer: string; feedbackAgent: string; rating: number }) => void
}

export default function VisitFeedbackDialog({
  open,
  onOpenChange,
  event,
  onSubmit,
}: VisitFeedbackDialogProps) {
  if (!event) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-theme-card border-theme-border">
        <DialogHeader>
          <DialogTitle className="text-theme-primary">Feedback post-visite</DialogTitle>
          <DialogDescription className="text-theme-secondary">
            {event.title}
          </DialogDescription>
        </DialogHeader>
        <FeedbackForm
          key={event.id}
          event={event}
          onSubmit={onSubmit}
          onClose={() => onOpenChange(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

function FeedbackForm({
  event,
  onSubmit,
  onClose,
}: {
  event: CalendarEvent
  onSubmit: VisitFeedbackDialogProps['onSubmit']
  onClose: () => void
}) {
  const [feedbackBuyer, setFeedbackBuyer] = useState(event.feedbackBuyer ?? '')
  const [feedbackAgent, setFeedbackAgent] = useState(event.feedbackAgent ?? '')
  const [rating, setRating] = useState(event.rating ?? 0)
  const [hoveredStar, setHoveredStar] = useState(0)

  const handleSubmit = useCallback(() => {
    onSubmit(event, { feedbackBuyer, feedbackAgent, rating })
    onClose()
  }, [event, feedbackBuyer, feedbackAgent, rating, onSubmit, onClose])

  return (
    <div className="space-y-4 mt-2">
      {/* Rating */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-2 block">
          Note de la visite
        </label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredStar(star)}
              onMouseLeave={() => setHoveredStar(0)}
              className="p-0.5 transition-colors"
            >
              <Star
                className={cn(
                  'h-5 w-5 transition-colors',
                  (hoveredStar || rating) >= star
                    ? 'fill-amber-400 text-amber-400'
                    : 'text-theme-tertiary'
                )}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="text-xs text-theme-secondary ml-2 self-center">
              {rating}/5
            </span>
          )}
        </div>
      </div>

      {/* Feedback buyer */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          Feedback acheteur
        </label>
        <textarea
          value={feedbackBuyer}
          onChange={(e) => setFeedbackBuyer(e.target.value)}
          placeholder="Ce que le client a dit, ses impressions..."
          rows={3}
          className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
        />
      </div>

      {/* Feedback agent */}
      <div>
        <label className="text-xs font-medium text-theme-secondary mb-1.5 block">
          Notes agent
        </label>
        <textarea
          value={feedbackAgent}
          onChange={(e) => setFeedbackAgent(e.target.value)}
          placeholder="Vos observations, prochaines étapes..."
          rows={3}
          className="w-full px-3 py-2 text-sm bg-transparent border border-theme-border rounded-lg text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent resize-none"
        />
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onClose}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border text-theme-secondary hover:text-theme-primary hover:border-theme-active transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          className="h-9 px-4 rounded-lg text-sm font-medium border border-theme-border-focus text-accent hover:bg-accent/10 transition-colors"
        >
          Valider
        </button>
      </div>
    </div>
  )
}
