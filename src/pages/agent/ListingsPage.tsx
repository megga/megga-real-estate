import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Eye, Pencil, MoreHorizontal,
  Building2, TrendingUp, Heart,
} from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import EmptyState from '@/components/ui/empty-state'

type PropertyStatus = 'active' | 'draft' | 'reserved' | 'sold' | 'archived'

interface MockProperty {
  id: string
  title: string
  address: string
  type: string
  status: PropertyStatus
  price: number
  rooms: number
  surface: number
  views: number
  favorites: number
  photo: string
}

const STATUS_MAP: Record<PropertyStatus, { label: string; cls: string }> = {
  active: { label: 'Actif', cls: 'bg-success/10 text-success' },
  draft: { label: 'Brouillon', cls: 'bg-primary-100 text-primary-600' },
  reserved: { label: 'Réservé', cls: 'bg-warning/10 text-warning' },
  sold: { label: 'Vendu', cls: 'bg-danger/10 text-danger' },
  archived: { label: 'Archivé', cls: 'bg-primary-100 text-primary-400' },
}

const MOCK_PROPERTIES: MockProperty[] = [
  {
    id: '1', title: 'Appartement Eaux-Vives', address: 'Rue du Lac 12, Genève',
    type: 'Appartement', status: 'active', price: 720000, rooms: 3, surface: 75,
    views: 342, favorites: 18, photo: 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400&h=300&fit=crop',
  },
  {
    id: '2', title: 'Villa Cologny', address: 'Ch. de la Gradelle 8, Cologny',
    type: 'Villa', status: 'active', price: 3200000, rooms: 8, surface: 280,
    views: 567, favorites: 42, photo: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&h=300&fit=crop',
  },
  {
    id: '3', title: 'Studio Plainpalais', address: 'Rue de Carouge 78, Genève',
    type: 'Appartement', status: 'reserved', price: 385000, rooms: 1, surface: 32,
    views: 189, favorites: 8, photo: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=400&h=300&fit=crop',
  },
  {
    id: '4', title: 'Maison de ville Carouge', address: 'Rue Ancienne 34, Carouge',
    type: 'Maison', status: 'active', price: 1450000, rooms: 5, surface: 145,
    views: 421, favorites: 31, photo: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&h=300&fit=crop',
  },
  {
    id: '5', title: 'Duplex Champel', address: 'Av. de Champel 45, Genève',
    type: 'Appartement', status: 'sold', price: 1250000, rooms: 5, surface: 120,
    views: 634, favorites: 55, photo: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&h=300&fit=crop',
  },
  {
    id: '6', title: 'Appartement Carouge', address: 'Place du Marché 8, Carouge',
    type: 'Appartement', status: 'draft', price: 650000, rooms: 3, surface: 68,
    views: 0, favorites: 0, photo: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=400&h=300&fit=crop',
  },
]

export default function ListingsPage() {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('')

  const filtered = useMemo(() => {
    let list = [...MOCK_PROPERTIES]
    if (search) {
      const q = search.toLowerCase()
      list = list.filter((p) => p.title.toLowerCase().includes(q) || p.address.toLowerCase().includes(q))
    }
    if (statusFilter) list = list.filter((p) => p.status === statusFilter)
    return list
  }, [search, statusFilter])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-primary-900">Mes biens</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{MOCK_PROPERTIES.length} biens au total</p>
        </div>
        <Link
          to="/dashboard/listings/new"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2.5 rounded-button transition-colors focus:outline-none focus:ring-2 focus:ring-accent/20 focus:ring-offset-2"
        >
          <Plus className="h-4 w-4" aria-hidden="true" />
          Ajouter un bien
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Rechercher par titre ou adresse..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Rechercher un bien"
            className="w-full h-10 pl-9 pr-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-colors"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filtrer par statut"
          className="h-10 px-3 text-sm bg-card border border-border rounded-input focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
        >
          <option value="">Tous les statuts</option>
          <option value="active">Actif</option>
          <option value="draft">Brouillon</option>
          <option value="reserved">Réservé</option>
          <option value="sold">Vendu</option>
          <option value="archived">Archivé</option>
        </select>
        {(search || statusFilter) && (
          <button
            onClick={() => { setSearch(''); setStatusFilter('') }}
            className="text-xs text-accent hover:text-accent/80 font-medium"
          >
            Effacer les filtres
          </button>
        )}
      </div>

      {/* Property grid */}
      {filtered.length === 0 ? (
        <div className="bg-card rounded-card shadow-card border border-border p-12">
          <EmptyState
            icon={Building2}
            title="Aucun bien trouvé"
            description="Essayez de modifier vos filtres ou ajoutez un nouveau bien."
            action={{ label: 'Effacer les filtres', onClick: () => { setSearch(''); setStatusFilter('') } }}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((property) => {
            const status = STATUS_MAP[property.status]
            return (
              <div
                key={property.id}
                className="bg-card rounded-card shadow-card border border-border overflow-hidden hover:shadow-card-hover transition-shadow duration-200 group"
              >
                {/* Photo */}
                <div className="relative aspect-[4/3] bg-primary-100 overflow-hidden">
                  <img
                    src={property.photo}
                    alt={property.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <span className={cn('absolute top-3 left-3 text-xs font-medium px-2 py-0.5 rounded-badge', status.cls)}>
                    {status.label}
                  </span>
                  <button
                    className="absolute top-3 right-3 p-1.5 bg-card/80 backdrop-blur rounded-full hover:bg-card transition-colors"
                    aria-label="Plus d'options"
                  >
                    <MoreHorizontal className="h-4 w-4 text-primary-600" aria-hidden="true" />
                  </button>
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="text-xl font-bold text-primary-900">{formatCHF(property.price)}</p>
                  <h3 className="text-sm font-semibold text-primary-900 mt-1 truncate">{property.title}</h3>
                  <p className="text-xs text-muted-foreground truncate">{property.address}</p>

                  <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
                    <span>{property.rooms} pièces</span>
                    <span>·</span>
                    <span>{property.surface} m²</span>
                    <span>·</span>
                    <span>{property.type}</span>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{property.views}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Heart className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{property.favorites}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5" aria-hidden="true" />
                      <span>{property.views > 0 ? `${((property.favorites / property.views) * 100).toFixed(1)}%` : '—'}</span>
                    </div>
                    <button
                      className="ml-auto p-1.5 rounded-md text-primary-400 hover:text-accent hover:bg-accent/10 transition-colors"
                      aria-label={`Modifier ${property.title}`}
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
