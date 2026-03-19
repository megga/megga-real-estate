import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Plus, ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
  Eye, Pencil, Trash2,
} from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { MOCK_CONTACTS, type MockContact } from '@/lib/mockData'
import { useContacts } from '@/hooks/useContacts'

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

  // Real data from Supabase (falls back to mock if empty)
  const { contacts: realContacts } = useContacts()
  const dataSource: MockContact[] = realContacts.length > 0
    ? realContacts.map(c => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email ?? '',
        phone: c.phone ?? '',
        type: c.type as MockContact['type'],
        score: (c.score ?? 'cold') as MockContact['score'],
        source: (c.source ?? 'manual'),
        tags: c.tags ?? [],
        notes: c.notes ?? '',
        address: '',
        city: '',
        canton: '',
        created_at: c.created_at,
        last_activity: c.created_at,
        transactions: [] as MockContact['transactions'],
        activities: [] as MockContact['activities'],
      } as MockContact))
    : MOCK_CONTACTS

  // All unique tags
  const allTags = useMemo(() => {
    const tags = new Set<string>()
    dataSource.forEach((c) => c.tags.forEach((t) => tags.add(t)))
    return Array.from(tags).sort()
  }, [dataSource])

  // Filter
  const filtered = useMemo(() => {
    let list = [...dataSource]

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Contacts</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{dataSource.length} contacts au total</p>
        </div>
        <button className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-button transition-colors">
          <Plus className="h-4 w-4" />
          Ajouter un contact
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" />
          <input
            type="text"
            placeholder="Rechercher par nom ou email..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1) }}
            className="w-full h-10 pl-9 pr-3 text-sm bg-white border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>

        {/* Type filter */}
        <select
          value={typeFilter}
          onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }}
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
      <div className="bg-white rounded-card shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-section">
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort('name')}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 uppercase tracking-wider hover:text-primary-900"
                  >
                    Contact
                    <SortIcon field="name" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 hidden md:table-cell">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Email</span>
                </th>
                <th className="text-left px-4 py-3 hidden lg:table-cell">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Téléphone</span>
                </th>
                <th className="text-left px-4 py-3">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Type</span>
                </th>
                <th className="text-left px-4 py-3">
                  <button
                    onClick={() => toggleSort('score')}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 uppercase tracking-wider hover:text-primary-900"
                  >
                    Score
                    <SortIcon field="score" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-left px-4 py-3 hidden xl:table-cell">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Source</span>
                </th>
                <th className="text-left px-4 py-3 hidden sm:table-cell">
                  <button
                    onClick={() => toggleSort('last_activity')}
                    className="flex items-center gap-1 text-xs font-semibold text-primary-600 uppercase tracking-wider hover:text-primary-900"
                  >
                    Activité
                    <SortIcon field="last_activity" sortField={sortField} sortDir={sortDir} />
                  </button>
                </th>
                <th className="text-right px-4 py-3">
                  <span className="text-xs font-semibold text-primary-600 uppercase tracking-wider">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {paginated.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center">
                    <p className="text-sm text-muted-foreground">Aucun contact trouvé</p>
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
                          className="p-1.5 rounded-md text-primary-400 hover:text-accent hover:bg-accent/10 transition-colors"
                          title="Voir"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          className="p-1.5 rounded-md text-primary-400 hover:text-warning hover:bg-warning/10 transition-colors"
                          title="Éditer"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          className="p-1.5 rounded-md text-primary-400 hover:text-danger hover:bg-danger/10 transition-colors"
                          title="Supprimer"
                        >
                          <Trash2 className="h-4 w-4" />
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
              >
                <ChevronLeft className="h-4 w-4" />
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
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
