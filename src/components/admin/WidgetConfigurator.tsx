import { useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Eye, EyeOff, ChevronUp, ChevronDown, RotateCcw, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminWidgets } from '@/hooks/useAdminWidgets'

export default function WidgetConfigurator() {
  const [open, setOpen] = useState(false)
  const { widgets, toggleWidget, moveWidget, resetWidgets } = useAdminWidgets()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="h-9 px-3 text-sm font-medium border border-theme-border text-theme-secondary rounded-lg hover:text-theme-primary hover:border-theme-active transition-colors flex items-center gap-2"
      >
        <SlidersHorizontal className="h-4 w-4" />
        Personnaliser
      </button>

      {open && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)} />
          <div className="relative bg-theme-card rounded-xl border border-theme-border p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-base font-semibold text-theme-primary">Personnaliser le dashboard</h3>
              <button onClick={() => setOpen(false)} aria-label="Fermer" className="h-8 w-8 rounded-full flex items-center justify-center text-theme-secondary hover:text-theme-primary hover:bg-theme-hover transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-2">
              {widgets.map((widget, idx) => (
                <div key={widget.id} className="flex items-center gap-3 p-3 rounded-lg border border-theme-border">
                  <button
                    onClick={() => toggleWidget(widget.id)}
                    className={cn('h-7 w-7 rounded-lg flex items-center justify-center transition-colors', widget.visible ? 'bg-admin-accent/10 text-admin-accent' : 'bg-theme-hover text-theme-muted')}
                  >
                    {widget.visible ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                  </button>
                  <span className={cn('text-sm flex-1', widget.visible ? 'text-theme-primary' : 'text-theme-muted')}>{widget.label}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveWidget(widget.id, 'up')}
                      disabled={idx === 0}
                      className="h-6 w-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary disabled:opacity-30 transition-colors"
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => moveWidget(widget.id, 'down')}
                      disabled={idx === widgets.length - 1}
                      className="h-6 w-6 rounded flex items-center justify-center text-theme-muted hover:text-theme-primary disabled:opacity-30 transition-colors"
                    >
                      <ChevronDown className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end mt-5">
              <button
                onClick={resetWidgets}
                className="h-9 px-3 text-sm font-medium text-theme-secondary hover:text-theme-primary transition-colors flex items-center gap-2"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reinitialiser
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
