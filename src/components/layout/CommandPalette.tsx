import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Search, Sparkles, LayoutDashboard, Users, GitBranch, Shuffle,
  Building2, Plus, Calendar, ShieldCheck, FileText,
  Zap, Settings,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContacts } from '@/hooks/useContacts'

interface CommandItem {
  id: string
  label: string
  category: 'pages' | 'contacts' | 'biens' | 'actions'
  icon: React.ElementType
  href: string
  subtitle?: string
  shortcut?: string
}

const pageItems: CommandItem[] = [
  { id: 'p-today', label: "Aujourd'hui", category: 'pages', icon: Sparkles, href: '/dashboard', shortcut: '' },
  { id: 'p-dashboard', label: 'Dashboard', category: 'pages', icon: LayoutDashboard, href: '/dashboard/analytics' },
  { id: 'p-contacts', label: 'Contacts', category: 'pages', icon: Users, href: '/dashboard/contacts' },
  { id: 'p-pipeline', label: 'Pipeline', category: 'pages', icon: GitBranch, href: '/dashboard/pipeline' },
  { id: 'p-matching', label: 'Matching', category: 'pages', icon: Shuffle, href: '/dashboard/matching' },
  { id: 'p-listings', label: 'Mes biens', category: 'pages', icon: Building2, href: '/dashboard/listings' },
  { id: 'p-calendar', label: 'Calendrier', category: 'pages', icon: Calendar, href: '/dashboard/calendar' },
  { id: 'p-kyc', label: 'KYC', category: 'pages', icon: ShieldCheck, href: '/dashboard/kyc' },
  { id: 'p-documents', label: 'Documents', category: 'pages', icon: FileText, href: '/dashboard/documents' },
  { id: 'p-automation', label: 'Automatisation', category: 'pages', icon: Zap, href: '/dashboard/automation' },
  { id: 'p-settings', label: 'Paramètres', category: 'pages', icon: Settings, href: '/dashboard/settings' },
]

const actionItems: CommandItem[] = [
  { id: 'a-contact', label: 'Créer un contact', category: 'actions', icon: Plus, href: '/dashboard/contacts', shortcut: '⌘⇧C' },
  { id: 'a-listing', label: 'Nouveau bien', category: 'actions', icon: Plus, href: '/dashboard/listings/new' },
  { id: 'a-deal', label: 'Nouvelle transaction', category: 'actions', icon: Plus, href: '/dashboard/pipeline' },
]

const TYPE_LABELS: Record<string, string> = {
  buyer: 'Acheteur',
  seller: 'Vendeur',
  both: 'Acheteur/Vendeur',
  investor: 'Investisseur',
  tenant: 'Locataire',
  landlord: 'Bailleur',
  lead: 'Lead',
}

const categoryLabels: Record<string, string> = {
  pages: 'Pages',
  contacts: 'Contacts',
  biens: 'Biens',
  actions: 'Actions rapides',
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onCreateContact?: () => void
}

export default function CommandPalette({ isOpen, onClose, onCreateContact }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Fetch contacts from Supabase (search filter applied server-side when query has 2+ chars)
  const { contacts } = useContacts(query.length >= 2 ? { search: query } : undefined)

  // Map contacts to CommandItems
  const contactItems: CommandItem[] = useMemo(() =>
    contacts.slice(0, 8).map((c) => ({
      id: `c-${c.id}`,
      label: `${c.first_name} ${c.last_name}`,
      category: 'contacts' as const,
      icon: Users,
      href: `/dashboard/contacts/${c.id}`,
      subtitle: TYPE_LABELS[c.type] || 'Contact',
    })),
    [contacts]
  )

  const allItems = useMemo(() => [...pageItems, ...contactItems, ...actionItems], [contactItems])

  // Filter results
  const filtered = useMemo(() => {
    if (!query.trim()) return allItems
    const q = query.toLowerCase()
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        (item.subtitle && item.subtitle.toLowerCase().includes(q))
    )
  }, [query, allItems])

  // Group by category
  const grouped = useMemo(() => {
    const groups: { category: string; items: CommandItem[] }[] = []
    const seen = new Set<string>()
    for (const item of filtered) {
      if (!seen.has(item.category)) {
        seen.add(item.category)
        groups.push({ category: item.category, items: [] })
      }
      groups.find((g) => g.category === item.category)?.items.push(item)
    }
    return groups
  }, [filtered])

  // Flat list for keyboard nav
  const flatItems = useMemo(() => grouped.flatMap((g) => g.items), [grouped])

  const handleSelect = useCallback((item: CommandItem) => {
    onClose()
    setQuery('')
    setSelectedIndex(0)
    // Special action: create contact opens the quick dialog
    if (item.id === 'a-contact' && onCreateContact) {
      onCreateContact()
      return
    }
    navigate(item.href)
  }, [navigate, onClose, onCreateContact])

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [isOpen])

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    function handleKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1))
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex((prev) => Math.max(prev - 1, 0))
          break
        case 'Enter':
          e.preventDefault()
          if (flatItems[selectedIndex]) {
            handleSelect(flatItems[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          onClose()
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, flatItems, selectedIndex, handleSelect, onClose])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selected = listRef.current.querySelector('[data-selected="true"]')
    selected?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  // Reset selected index when query changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  if (!isOpen) return null

  let flatIndex = -1

  return (
    <div
      className="fixed inset-0 z-50 bg-theme-overlay/40 backdrop-blur-[2px] flex items-start justify-center pt-[15vh] transition-opacity duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-[560px] bg-theme-elevated rounded-xl shadow-2xl border border-theme-border overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 h-12 border-b border-theme-border-subtle">
          <Search className="w-5 h-5 text-theme-tertiary flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher un contact, un bien, une page..."
            className="flex-1 text-base border-0 bg-transparent text-theme-primary placeholder:text-theme-tertiary focus:outline-none focus:ring-0"
          />
          <button
            onClick={onClose}
            className="flex items-center"
          >
            <kbd className="text-xs bg-theme-active text-theme-tertiary px-1.5 py-0.5 rounded font-mono">
              ESC
            </kbd>
          </button>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[360px] overflow-y-auto py-2">
          {grouped.length === 0 ? (
            <div className="px-4 py-8 text-center">
              <p className="text-sm text-theme-muted">Aucun résultat pour "{query}"</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.category}>
                <div className="px-4 py-1.5 text-xs capitalize text-theme-tertiary font-medium">
                  {categoryLabels[group.category] || group.category}
                </div>
                {group.items.map((item) => {
                  flatIndex++
                  const isSelected = flatIndex === selectedIndex
                  const Icon = item.icon
                  const currentFlatIndex = flatIndex

                  return (
                    <button
                      key={item.id}
                      data-selected={isSelected}
                      onClick={() => handleSelect(item)}
                      onMouseEnter={() => setSelectedIndex(currentFlatIndex)}
                      className={cn(
                        'mx-2 px-3 h-10 rounded-lg flex items-center gap-3 cursor-pointer transition-colors duration-100 w-[calc(100%-16px)] text-left',
                        isSelected ? 'bg-accent/8 text-accent' : 'hover:bg-theme-hover'
                      )}
                    >
                      {item.category === 'contacts' ? (
                        <div className="w-6 h-6 rounded-full bg-accent/10 text-accent text-xs font-semibold flex items-center justify-center flex-shrink-0">
                          {item.label.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)}
                        </div>
                      ) : item.category === 'actions' ? (
                        <div className="w-5 h-5 rounded-full bg-theme-active text-theme-muted flex items-center justify-center flex-shrink-0">
                          <Icon className="w-3.5 h-3.5" />
                        </div>
                      ) : (
                        <Icon className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-accent' : 'text-theme-tertiary')} />
                      )}

                      <span className={cn('text-sm flex-1 truncate', isSelected ? 'text-accent' : 'text-theme-primary')}>
                        {item.label}
                      </span>

                      {item.subtitle && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-theme-active text-theme-muted flex-shrink-0">
                          {item.subtitle}
                        </span>
                      )}

                      {item.shortcut && (
                        <span className="text-xs text-theme-tertiary font-mono flex-shrink-0">
                          {item.shortcut}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
