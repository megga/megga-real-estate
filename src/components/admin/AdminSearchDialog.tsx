import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { Search, Building2, Users, Home, MessageSquare, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAdminSearch, type AdminSearchResult } from '@/hooks/useAdminSearch'

interface AdminSearchDialogProps {
  open: boolean
  onClose: () => void
}

const TYPE_META: Record<AdminSearchResult['type'], { icon: React.ElementType; label: string }> = {
  agency: { icon: Building2, label: 'Agences' },
  user: { icon: Users, label: 'Utilisateurs' },
  property: { icon: Home, label: 'Biens' },
  ticket: { icon: MessageSquare, label: 'Tickets' },
}

export default function AdminSearchDialog({ open, onClose }: AdminSearchDialogProps) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { results, loading } = useAdminSearch(query)

  // Auto-focus input when dialog opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  if (!open) return null

  // Group results by type
  const grouped = results.reduce<Record<string, AdminSearchResult[]>>((acc, r) => {
    if (!acc[r.type]) acc[r.type] = []
    acc[r.type].push(r)
    return acc
  }, {})

  const handleSelect = (result: AdminSearchResult) => {
    navigate(result.href)
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Dialog */}
      <div className="relative bg-theme-card rounded-xl border border-theme-border w-full max-w-lg mx-4 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-theme-border">
          {loading ? (
            <Loader2 className="h-4 w-4 text-theme-tertiary animate-spin flex-shrink-0" />
          ) : (
            <Search className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Rechercher agences, utilisateurs, biens..."
            className="flex-1 bg-transparent text-theme-primary text-sm placeholder:text-theme-muted outline-none"
          />
          <kbd className="text-[10px] bg-theme-active text-theme-tertiary px-1.5 py-0.5 rounded font-mono">
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto scrollbar-hide">
          {query.length >= 2 && results.length === 0 && !loading && (
            <div className="px-4 py-8 text-center text-sm text-theme-muted">
              Aucun resultat
            </div>
          )}

          {query.length < 2 && (
            <div className="px-4 py-8 text-center text-sm text-theme-muted">
              Tapez au moins 2 caracteres
            </div>
          )}

          {(['agency', 'user', 'property', 'ticket'] as const).map(type => {
            const items = grouped[type]
            if (!items?.length) return null
            const meta = TYPE_META[type]

            return (
              <div key={type}>
                <div className="px-4 pt-3 pb-1">
                  <span className="text-[10px] uppercase tracking-wider text-theme-tertiary font-medium">
                    {meta.label}
                  </span>
                </div>
                {items.map(item => {
                  const Icon = meta.icon
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleSelect(item)}
                      className={cn(
                        'w-full flex items-center gap-3 px-4 py-2 text-left',
                        'hover:bg-theme-hover transition-colors'
                      )}
                    >
                      <Icon className="h-4 w-4 text-theme-tertiary flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-theme-primary truncate">
                          {item.title}
                        </p>
                        <p className="text-xs text-theme-muted truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body
  )
}
