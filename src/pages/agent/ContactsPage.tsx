import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Eye, Pencil, Trash2, Users,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { MOCK_CONTACTS, type MockContact } from '@/lib/mockData'
import { toast } from '@/hooks/useToast'
import ConfirmDialog from '@/components/ui/confirm-dialog'
import EmptyState from '@/components/ui/empty-state'

type SortField = 'name' | 'last_activity' | 'score'
type SortDir = 'asc' | 'desc'

const SCORE_ORDER = { hot: 0, warm: 1, cold: 2 }
const ITEMS_PER_PAGE = 10

const scoreBadge = (score: MockContact['score']) => {
  const map = {
    hot:  { label: 'Hot',  dot: 'bg-danger',  bg: 'bg-danger/10 text-danger' },
    warm: { label: 'Warm', dot: 'bg-warning', bg: 'bg-warning/10 text-warning' },
    cold: { label: 'Cold', dot: 'bg-accent',  bg: 'bg-accent/10 text-accent' },
  }
  const s = map[score]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-badge', s.bg)}>
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

const typeBadge = (type: MockContact['type']) => {
  const map = {
    buyer:  { label: 'Acheteur', cls: 'bg-accent/10 text-accent' },
    seller: { label: 'Vendeur',  cls: 'bg-success/10 text-success' },
    both:   { label: 'Acheteur/Vendeur', cls: 'bg-warning/10 text-warning' },
    lead:   { label: 'Lead',     cls: 'bg-primary-100 text-primary-600' },
  }
  const t = map[type]
  return (
    <span className={cn('text-xs font-medium px-2 py-0.5 rounded-badge', t.cls)}>
      {t.label}
    </span>
  )
}

function ContactAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Deterministic color from name
  const colors = [
    'bg-accent', 'bg-success', 'bg-warning', 'bg-danger',
    'bg-primary-600', 'bg-primary-400',
  ]
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length

  return (
    <div className={cn('h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0', colors[idx])}>
      <span className="text-xs font-semibold text-white">{initials}</span>
    </div>
  )
}

function SortIcon({ field, sortField, sortDir }: { field: SortField; sortField: SortField; sortDir: SortDir }) {
  if (field !== sortField) {
    return <ChevronUp className="h-3.5 w-3.5 text-primary-300" />
  }
  return sortDir === 'asc'
    ? <ChevronUp className="h-3.5 w-3.5 text-accent" />
    : <ChevronDown className="h-3.5 w-3.5 text-accent" />
}

export default function ContactsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [scoreFilter, setScoreFilter] = useState<string>('')
  const [tagFilter, setTagFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('last_activity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)
  const [deleteTarget, setDeleteTarget] = useState<MockContact | null>(null)

  // All unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    MOCK_CONTACTS.forEach((c) => c.tags.forEach((t) => tags.add(t)))
    return Array.from(tags).sort()
  }, [])

  // Filter
  const filtered = useMemo(() => {
    let list = [...MOCK_CONTACTS]

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        (c) =>
          `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
          c.email.toLowerCase().includes(q)
      )
    }
    if (typeFilter) list = list.filter((c) => c.type === typeFilter)
    if (scoreFilter) list = list.filter((c) => c.score === scoreFilter)
    if (tagFilter) list = list.filter((c) => c.tags.includes(tagFilter))

    // Sort
    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
      } else if (sortField === 'last_activity') {
        cmp = new Date(a.last_activity).getTime() - new Date(b.last_activity).getTime()
      } else if (sortField === 'score') {
        cmp = SCORE_ORDER[a.score] - SCORE_ORDER[b.score]
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [search, typeFilter, scoreFilter, tagFilter, sortField, sortDir])

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir(field === 'name' ? 'asc' : 'desc')
    }
  }

  function handleDeleteConfirm() {
    if (!deleteTarget) return
    toast.success('Contact supprimé', `${deleteTarget.first_name} ${deleteTarget.last_name} a été supprimé.`)
    setDeleteTarget(null)
  }

  return (
    <div className="space-y-6">
      {/* Delete confirmation dialog */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null) }}
        title="Supprimer le contact"
        description={deleteTarget ? `Êtes-vous sûr de vouloir supprimer ${deleteTarget.first_name} ${deleteTarget.last_name} ? Cette action est irréversible.` : ''}
        confirmLabel="Supprimer"
        variant="danger"
        onConfirm={handleDeleteConfirm}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{MOCK_CONTACTS.length} contacts au total</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-button transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2">
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajouter un contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            aria-label="Rechercher par nom ou email"
            className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
          aria-label="Filtrer par type"
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les types</option>
          <option value="buyer">Acheteur</option>
          <option value="seller">Vendeur</option>
          <option value="both">Acheteur/Vendeur</option>
          <option value="lead">Lead</option>
        </select>

        {/* Score filter */}
        <select
          value={scoreFilter}
          onChange={(e) => { setScoreFilter(e.target.value); setPage(1) }}
          aria-label="Filtrer par score"
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les scores</option>
          <option value="hot">🔴 Hot</option>
          <option value="warm">🟠 Warm</option>
          <option value="cold">🔵 Cold</option>
        </select>

        {/* Tag filter */}
        <select
          value={tagFilter}
          onChange={(e) => { setTagFilter(e.target.value); setPage(1) }}
          aria-label="Filtrer par tag"
          className="h-10 px-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les tags</option>
          {allTags.map((tag) => (
            <option key={tag} value={tag}>{tag}</option>
          ))}
        </select>

        {/* Active filters count */}
        {(search || typeFilter || scoreFilter || tagFilter) && (
          <button
            onClick={() => { setSearch(''); setTypeFilter(''); setScoreFilter(''); setTagFilter(''); setPage(1) }}
            className="text-xs text-accent hover:text-accent/80 font-medium"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-card shadow-card border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-section">
                <th scope="col" className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 uppercase tracking-wider hover:text-primary-900"
                  >
                    Contact
                    <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th scope="col" className="text-left px-4 py-3 hidden md:table-cell">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Email</span>
                </th>
                <th scope="col" className="text-left px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Téléphone</span>
                </th>
                <th scope="col" className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Type</span>
                </th>
                <th scope="col" className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort('score')}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 uppercase tracking-wider hover:text-primary-900"
                  >
                    Score
                    <SortIcon field="score" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th scope="col" className="text-left px-4 py-3 hidden xl:table-cell">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Source</span>
                </th>
                <th scope="col" className="text-left px-4 py-3 hidden sm:table-cell">
                  <button
                    onClick={() => toggleSort('last_activity')}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 uppercase tracking-wider hover:text-primary-900"
                  >
                    Activité
                    <SortIcon field="last_activity" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th scope="col" className="text-right px-4 py-3">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12">
                    <EmptyState
                      icon={Users}
                      title="Aucun contact trouvé"
                      description="Essayez de modifier vos filtres ou ajoutez un nouveau contact."
                      action={{
                        label: 'Effacer les filtres',
                        onClick: () => { setSearch(''); setTypeFilter(''); setScoreFilter(''); setTagFilter(''); setPage(1) },
                      }}
                    />
                  </td>
                </tr>
              ) : (
                paginated.map((contact) => (
                  <tr
                    key={contact.id}
                    className="hover:bg-section/50 transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <Link
                        to={`/dashboard/contacts/${contact.id}`}
                        className="flex items-center gap-3"
                      >
                        <ContactAvatar name={`${contact.first_name} ${contact.last_name}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-primary-900 truncate group-hover:text-accent transition-colors">
                            {contact.first_name} {contact.last_name}
                          </p>
                          <p className="text-xs text-muted-foreground truncate md:hidden">
                            {contact.email}
                          </p>
                        </div>
                      </Link>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <span className="text-sm text-primary-600">{contact.email}</span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-sm text-primary-600">{contact.phone}</span>
                    </td>
                    <td className="px-4 py-3">
                      {typeBadge(contact.type)}
                    </td>
                    <td className="px-4 py-3">
                      {scoreBadge(contact.score)}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      <span className="text-sm text-muted-foreground">{contact.source}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className="text-xs text-muted-foreground">
                        {formatRelativeDate(contact.last_activity)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          to={`/dashboard/contacts/${contact.id}`}
                          className="p-1.5 rounded-md text-primary-400 hover:text-accent hover:bg-accent/10 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
                          title="Voir"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Voir</span>
                        </Link>
                        <button
                          className="p-1.5 rounded-md text-primary-400 hover:text-warning hover:bg-warning/10 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
                          aria-label="Éditer"
                        >
                          <Pencil className="h-4 w-4" aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(contact)}
                          className="p-1.5 rounded-md text-primary-400 hover:text-danger hover:bg-danger/10 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20"
                          aria-label={`Supprimer ${contact.first_name} ${contact.last_name}`}
                        >
                          <Trash2 className="h-4 w-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filtered.length > ITEMS_PER_PAGE && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border bg-section/50">
            <p className="text-xs text-muted-foreground">
              {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length} contacts
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="p-1.5 rounded-md text-primary-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Page précédente"
              >
                <ChevronLeft className="h-4 w-4" aria-hidden="true" />
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={cn(
                    'h-8 min-w-[32px] px-2 rounded-md text-sm font-medium transition-colors',
                    p === safePage
                      ? 'bg-accent text-white'
                      : 'text-primary-600 hover:bg-white'
                  )}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="p-1.5 rounded-md text-primary-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Page suivante"
              >
                <ChevronRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
