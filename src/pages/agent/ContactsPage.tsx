import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Plus, Upload, ChevronLeft, ChevronRight, ChevronDown,
  FileSpreadsheet, MessageSquareText, Users as UsersIcon, PenLine,
} from 'lucide-react'
import EmptyContactsIllustration from '@/components/illustrations/EmptyContactsIllustration'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useContacts } from '@/hooks/useContacts'
import type { Contact, ContactType } from '@/types/contact'
import type { ContactScore } from '@/lib/constants'
import PageTransition from '@/components/layout/PageTransition'
import NewContactDialog from '@/components/contacts/NewContactDialog'

type SortField = 'name' | 'last_activity' | 'score'
type SortDir = 'asc' | 'desc'

const SCORE_ORDER: Record<string, number> = { hot: 0, warm: 1, cold: 2 }
const ITEMS_PER_PAGE = 10

const SCORE_DOT: Record<string, string> = {
  hot: 'bg-red-400',
  warm: 'bg-amber-400',
  cold: 'bg-blue-400',
}

const SCORE_LABEL: Record<string, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
}

const TYPE_LABEL: Record<string, string> = {
  buyer: 'Acheteur',
  seller: 'Vendeur',
  investor: 'Investisseur',
  tenant: 'Locataire',
  landlord: 'Bailleur',
  both: 'Acheteur/Vendeur',
  lead: 'Lead',
}

function getLastActivity(contact: Contact): string {
  return contact.last_interaction_at ?? contact.updated_at ?? contact.created_at
}

function ContactAvatar({ name }: { name: string }) {
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
  const colors = ['bg-accent', 'bg-success', 'bg-warning', 'bg-danger', 'bg-primary-600', 'bg-primary-400']
  const idx = name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % colors.length

  return (
    <div className={cn('h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0', colors[idx])}>
      <span className="text-[11px] font-semibold text-white">{initials}</span>
    </div>
  )
}

const selectClasses = 'h-9 px-3 pr-8 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors appearance-none'

export default function ContactsPage() {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [scoreFilter, setScoreFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField>('last_activity')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [page, setPage] = useState(1)

  const { contacts, isLoading } = useContacts()

  const filtered = useMemo(() => {
    let list = [...contacts]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((c) =>
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q)
      )
    }
    if (typeFilter) list = list.filter((c) => c.type === (typeFilter as ContactType))
    if (scoreFilter) list = list.filter((c) => c.score === (scoreFilter as ContactScore))

    list.sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') cmp = `${a.last_name}`.localeCompare(`${b.last_name}`)
      else if (sortField === 'last_activity') {
        cmp = new Date(getLastActivity(a)).getTime() - new Date(getLastActivity(b)).getTime()
      }
      else if (sortField === 'score') {
        cmp = (SCORE_ORDER[a.score ?? ''] ?? 99) - (SCORE_ORDER[b.score ?? ''] ?? 99)
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
    return list
  }, [contacts, search, typeFilter, scoreFilter, sortField, sortDir])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const paginated = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setSortField(field); setSortDir(field === 'name' ? 'asc' : 'desc') }
  }

  const hasFilters = search || typeFilter || scoreFilter
  const [showNewContact, setShowNewContact] = useState(false)
  const [skipImport, setSkipImport] = useState(false)

  // Empty state — show import options when no contacts exist
  if (!isLoading && contacts.length === 0 && !skipImport) {
    const importMethods = [
      { icon: FileSpreadsheet, title: 'CSV / Excel', desc: 'Importer depuis un fichier .csv ou .tsv', href: '/dashboard/contacts/import?method=csv' },
      { icon: UsersIcon, title: 'vCard (.vcf)', desc: 'Depuis iPhone, Android, Outlook, Gmail', href: '/dashboard/contacts/import?method=vcard' },
      { icon: MessageSquareText, title: 'Texte libre (IA)', desc: 'Coller un email ou message, MEGGA AI extrait les infos', href: '/dashboard/contacts/import?method=text' },
      { icon: PenLine, title: 'Saisie manuelle', desc: 'Ajouter un contact à la main', action: () => setShowNewContact(true) },
    ]

    return (
      <PageTransition>
        <div className="max-w-3xl mx-auto">
          <div className="min-h-[60vh] flex flex-col items-center justify-center px-4">
            <div className="w-40 h-28 mb-4"><EmptyContactsIllustration /></div>
            <h1 className="text-xl font-semibold text-theme-primary mb-1">Ajouter des contacts</h1>
            <p className="text-sm text-theme-muted mb-8">Comment souhaitez-vous ajouter vos contacts ?</p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg">
              {importMethods.map((m, i) => (
                m.action ? (
                  <button
                    key={i}
                    onClick={m.action}
                    className="text-left px-5 py-4 rounded-xl border border-theme-border hover:border-accent/40 transition-colors group"
                  >
                    <div className="flex items-start gap-3.5">
                      <m.icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-theme-muted group-hover:text-theme-secondary transition-colors" />
                      <div>
                        <p className="text-sm font-medium text-theme-primary">{m.title}</p>
                        <p className="text-[12px] text-theme-muted mt-0.5 leading-relaxed">{m.desc}</p>
                      </div>
                    </div>
                  </button>
                ) : (
                  <Link
                    key={i}
                    to={m.href!}
                    className="text-left px-5 py-4 rounded-xl border border-theme-border hover:border-accent/40 transition-colors group"
                  >
                    <div className="flex items-start gap-3.5">
                      <m.icon className="w-5 h-5 mt-0.5 flex-shrink-0 text-theme-muted group-hover:text-theme-secondary transition-colors" />
                      <div>
                        <p className="text-sm font-medium text-theme-primary">{m.title}</p>
                        <p className="text-[12px] text-theme-muted mt-0.5 leading-relaxed">{m.desc}</p>
                      </div>
                    </div>
                  </Link>
                )
              ))}
            </div>

            <button
              onClick={() => setSkipImport(true)}
              className="mt-6 text-[13px] text-theme-muted hover:text-theme-secondary transition-colors"
            >
              Passer
            </button>
          </div>

          <NewContactDialog open={showNewContact} onClose={() => setShowNewContact(false)} />
        </div>
      </PageTransition>
    )
  }

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-theme-primary">Contacts</h1>
            <p className="text-sm text-theme-tertiary mt-0.5">
              {isLoading ? 'Chargement…' : `${contacts.length} contact${contacts.length !== 1 ? 's' : ''}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/dashboard/contacts/import"
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-muted hover:text-theme-secondary border border-theme-border hover:border-theme-active transition-colors"
            >
              <Upload className="h-3.5 w-3.5" />
              Importer
            </Link>
            <button
              onClick={() => setShowNewContact(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-sm font-medium text-theme-secondary hover:text-theme-primary border border-theme-border hover:border-theme-active transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Ajouter
            </button>
          </div>
        </div>

        <NewContactDialog open={showNewContact} onClose={() => setShowNewContact(false)} />

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-theme-tertiary" />
            <input
              type="text"
              placeholder="Rechercher..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1) }}
              className="w-full h-9 pl-9 pr-3 text-sm bg-transparent border border-theme-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
            />
          </div>

          <div className="relative">
            <select value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1) }} className={selectClasses}>
              <option value="">Type</option>
              <option value="buyer">Acheteur</option>
              <option value="seller">Vendeur</option>
              <option value="both">Acheteur/Vendeur</option>
              <option value="lead">Lead</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          <div className="relative">
            <select value={scoreFilter} onChange={(e) => { setScoreFilter(e.target.value); setPage(1) }} className={selectClasses}>
              <option value="">Score</option>
              <option value="hot">Hot</option>
              <option value="warm">Warm</option>
              <option value="cold">Cold</option>
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-theme-tertiary pointer-events-none" />
          </div>

          {hasFilters && (
            <button
              onClick={() => { setSearch(''); setTypeFilter(''); setScoreFilter(''); setPage(1) }}
              className="text-xs text-theme-tertiary hover:text-theme-primary transition-colors"
            >
              Effacer
            </button>
          )}
        </div>

        {/* Mobile: cards empilées */}
        <div className="md:hidden space-y-2">
          {isLoading ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-theme-tertiary">Chargement…</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-theme-tertiary">Aucun contact trouvé</p>
            </div>
          ) : (
            paginated.map((contact) => (
              <Link
                key={contact.id}
                to={`/dashboard/contacts/${contact.id}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-theme-border hover:border-theme-active transition-colors"
              >
                <ContactAvatar name={`${contact.first_name} ${contact.last_name}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-theme-primary truncate">
                    {contact.first_name} {contact.last_name}
                  </p>
                  <p className="text-xs text-theme-tertiary mt-0.5">
                    {TYPE_LABEL[contact.type] ?? contact.type}
                    {contact.score ? ` · ${SCORE_LABEL[contact.score] ?? contact.score}` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {contact.score && <div className={cn('h-2 w-2 rounded-full', SCORE_DOT[contact.score])} />}
                  <span className="text-xs text-theme-tertiary">{formatRelativeDate(getLastActivity(contact))}</span>
                </div>
              </Link>
            ))
          )}
          {/* Mobile pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-2 py-3">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="min-h-[44px] px-3 rounded-lg text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 border border-theme-border transition-colors"
              >
                Précédent
              </button>
              <span className="text-xs text-theme-tertiary">{safePage}/{totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="min-h-[44px] px-3 rounded-lg text-sm text-theme-secondary hover:text-theme-primary disabled:opacity-40 border border-theme-border transition-colors"
              >
                Suivant
              </button>
            </div>
          )}
        </div>

        {/* Desktop: List — bento transparent */}
        <div className="hidden md:block rounded-xl border border-theme-border">
          {/* Header row */}
          <div className="flex items-center px-4 py-2.5 border-b border-theme-border text-[11px] font-medium text-theme-tertiary uppercase tracking-wider">
            <button onClick={() => toggleSort('name')} className="flex-1 flex items-center gap-1 hover:text-theme-primary transition-colors">
              Contact
              {sortField === 'name' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
            </button>
            <span className="w-32 hidden md:block">Type</span>
            <button onClick={() => toggleSort('score')} className="w-20 flex items-center gap-1 hover:text-theme-primary transition-colors">
              Score
              {sortField === 'score' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
            </button>
            <button onClick={() => toggleSort('last_activity')} className="w-24 text-right flex items-center justify-end gap-1 hover:text-theme-primary transition-colors">
              Activité
              {sortField === 'last_activity' && (sortDir === 'asc' ? ' ↑' : ' ↓')}
            </button>
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-theme-tertiary">Chargement…</p>
            </div>
          ) : paginated.length === 0 ? (
            <div className="px-4 py-12 text-center">
              <p className="text-sm text-theme-tertiary">Aucun contact trouvé</p>
            </div>
          ) : (
            paginated.map((contact, i) => (
              <Link
                key={contact.id}
                to={`/dashboard/contacts/${contact.id}`}
                className={cn(
                  'flex items-center px-4 py-3 group hover:bg-theme-hover transition-colors',
                  i < paginated.length - 1 && 'border-b border-theme-border'
                )}
              >
                {/* Name + avatar */}
                <div className="flex-1 flex items-center gap-3 min-w-0">
                  <ContactAvatar name={`${contact.first_name} ${contact.last_name}`} />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-theme-primary truncate group-hover:text-accent transition-colors">
                      {contact.first_name} {contact.last_name}
                    </p>
                    <p className="text-xs text-theme-tertiary truncate md:hidden">
                      {TYPE_LABEL[contact.type] ?? contact.type}
                    </p>
                  </div>
                </div>

                {/* Type */}
                <span className="w-32 text-xs text-theme-secondary hidden md:block">
                  {TYPE_LABEL[contact.type] ?? contact.type}
                </span>

                {/* Score */}
                <div className="w-20 flex items-center gap-1.5">
                  {contact.score && <div className={cn('h-1.5 w-1.5 rounded-full', SCORE_DOT[contact.score])} />}
                  <span className="text-xs text-theme-secondary">
                    {contact.score ? (SCORE_LABEL[contact.score] ?? contact.score) : '—'}
                  </span>
                </div>

                {/* Activity */}
                <span className="w-24 text-xs text-theme-tertiary text-right">
                  {formatRelativeDate(getLastActivity(contact))}
                </span>
              </Link>
            ))
          )}

          {/* Pagination */}
          {filtered.length > ITEMS_PER_PAGE && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-theme-border">
              <p className="text-xs text-theme-tertiary">
                {(safePage - 1) * ITEMS_PER_PAGE + 1}–{Math.min(safePage * ITEMS_PER_PAGE, filtered.length)} sur {filtered.length}
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage <= 1}
                  className="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={cn(
                      'h-7 min-w-[28px] px-2 rounded-md text-xs font-medium transition-colors',
                      p === safePage ? 'bg-accent text-white' : 'text-theme-secondary hover:text-theme-primary'
                    )}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage >= totalPages}
                  className="p-1.5 rounded-md text-theme-secondary hover:text-theme-primary disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </PageTransition>
  )
}
