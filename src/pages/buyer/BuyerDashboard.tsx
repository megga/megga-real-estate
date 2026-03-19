import { Link } from 'react-router-dom'
import { Heart, Search, Bell, MessageSquare, Eye, Clock, ArrowRight, Home, MapPin } from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

const MOCK_STATS = [
  { label: 'Favoris', value: '12', icon: Heart, color: 'text-pink-600 bg-pink-50', href: '/mon-espace/favoris' },
  { label: 'Recherches', value: '3', icon: Search, color: 'text-accent bg-accent/10', href: '/mon-espace/recherches' },
  { label: 'Alertes actives', value: '2', icon: Bell, color: 'text-amber-600 bg-amber-50', href: '/mon-espace/alertes' },
  { label: 'Messages', value: '5', icon: MessageSquare, color: 'text-emerald-600 bg-emerald-50', href: '/mon-espace/messages' },
]

const MOCK_RECENT_VIEWS = [
  { id: '1', title: 'Appartement 4 pièces Champel', price: 1250000, address: 'Rue de Champel 15, Genève', rooms: 4, surface: 95, imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=400&q=80', viewedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
  { id: '2', title: 'Villa Cologny avec vue lac', price: 3950000, address: 'Chemin de Ruth 8, Cologny', rooms: 7, surface: 280, imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=400&q=80', viewedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString() },
  { id: '3', title: 'Loft rénové Plainpalais', price: 890000, address: 'Rue de Carouge 42, Genève', rooms: 3, surface: 78, imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=400&q=80', viewedAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString() },
]

const MOCK_ACTIVITY = [
  { id: '1', text: 'Nouveau bien correspondant à votre alerte "3 pièces Champel"', time: 'il y a 1h', icon: Bell, color: 'text-amber-600 bg-amber-50' },
  { id: '2', text: 'Réponse de l\'agent sur l\'appartement Eaux-Vives', time: 'il y a 3h', icon: MessageSquare, color: 'text-accent bg-accent/10' },
  { id: '3', text: 'Baisse de prix : Villa Cologny -5%', time: 'il y a 1 jour', icon: Home, color: 'text-emerald-600 bg-emerald-50' },
  { id: '4', text: 'Visite confirmée le 25.03.2026 à 14h', time: 'il y a 2 jours', icon: Eye, color: 'text-purple-600 bg-purple-50' },
]

export default function BuyerDashboard() {
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] ?? 'là'

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-primary">Bonjour, {firstName}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Retrouvez vos favoris, recherches et alertes en un coup d'œil.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {MOCK_STATS.map((stat) => {
          const Icon = stat.icon
          return (
            <Link
              key={stat.label}
              to={stat.href}
              className="bg-white rounded-xl border border-gray-100 p-4 hover:shadow-card-hover hover:-translate-y-0.5 transition-all group"
            >
              <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center', stat.color)}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="text-2xl font-bold text-primary mt-3">{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 group-hover:text-accent transition-colors">{stat.label}</p>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Recent views */}
        <div className="lg:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primary">Consultés récemment</h2>
            <Link to="/acheter" className="text-xs text-accent hover:text-accent/80 inline-flex items-center gap-1">
              Rechercher
              <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-3">
            {MOCK_RECENT_VIEWS.map((item) => (
              <Link
                key={item.id}
                to={`/listing/${item.id}`}
                className="flex gap-4 bg-white rounded-xl border border-gray-100 p-3 hover:shadow-card-hover transition-all group"
              >
                <img
                  src={item.imageUrl}
                  alt={item.title}
                  className="w-24 h-20 rounded-lg object-cover flex-shrink-0 group-hover:scale-105 transition-transform"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-primary truncate group-hover:text-accent transition-colors">
                    {item.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {item.address}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm font-bold text-primary">{formatCHF(item.price)}</p>
                    <p className="text-[11px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatRelativeDate(item.viewedAt)}
                    </p>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">{item.rooms} pièces · {item.surface} m²</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Activity feed */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-semibold text-primary mb-4">Activité récente</h2>
          <div className="bg-white rounded-xl border border-gray-100 divide-y divide-gray-50">
            {MOCK_ACTIVITY.map((item) => {
              const Icon = item.icon
              return (
                <div key={item.id} className="flex items-start gap-3 p-4">
                  <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0', item.color)}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-primary leading-snug">{item.text}</p>
                    <p className="text-[11px] text-gray-400 mt-1">{item.time}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
