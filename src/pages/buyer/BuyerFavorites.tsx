import { Link } from 'react-router-dom'
import { Heart, MapPin, Trash2 } from 'lucide-react'
import { formatCHF } from '@/lib/utils'

const MOCK_FAVORITES = [
  { id: '1', title: 'Appartement lumineux Champel', price: 1250000, address: 'Rue de Champel 15, 1206 Genève', rooms: 4, bedrooms: 2, surface: 95, imageUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800&q=80', savedAt: '15.03.2026' },
  { id: '2', title: 'Villa contemporaine Cologny', price: 3950000, address: 'Chemin de Ruth 8, 1223 Cologny', rooms: 7, bedrooms: 4, surface: 280, imageUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80', savedAt: '12.03.2026' },
  { id: '3', title: 'Loft rénové Plainpalais', price: 890000, address: 'Rue de Carouge 42, 1205 Genève', rooms: 3, bedrooms: 1, surface: 78, imageUrl: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80', savedAt: '10.03.2026' },
  { id: '4', title: 'Penthouse vue lac Eaux-Vives', price: 2750000, address: 'Quai Gustave-Ador 30, 1207 Genève', rooms: 5, bedrooms: 3, surface: 160, imageUrl: 'https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80', savedAt: '08.03.2026' },
  { id: '5', title: 'Appartement familial Carouge', price: 980000, address: 'Rue Ancienne 18, 1227 Carouge', rooms: 5, bedrooms: 3, surface: 120, imageUrl: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=800&q=80', savedAt: '05.03.2026' },
]

export default function BuyerFavorites() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Mes favoris</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {MOCK_FAVORITES.length} bien{MOCK_FAVORITES.length > 1 ? 's' : ''} sauvegardé{MOCK_FAVORITES.length > 1 ? 's' : ''}
        </p>
      </div>

      {MOCK_FAVORITES.length === 0 ? (
        <div className="text-center py-16">
          <Heart className="w-12 h-12 text-gray-200 mx-auto" />
          <p className="text-sm text-muted-foreground mt-4">Aucun favori pour l'instant</p>
          <Link
            to="/acheter"
            className="inline-block mt-4 text-sm font-medium text-accent hover:text-accent/80"
          >
            Parcourir les annonces
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {MOCK_FAVORITES.map((fav) => (
            <div
              key={fav.id}
              className="bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-card-hover transition-all group"
            >
              <Link to={`/listing/${fav.id}`} className="block">
                <div className="relative aspect-[16/9] overflow-hidden">
                  <img
                    src={fav.imageUrl}
                    alt={fav.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    loading="lazy"
                  />
                  <button
                    onClick={(e) => {
                      e.preventDefault()
                      // TODO: remove favorite
                    }}
                    className="absolute top-3 right-3 w-9 h-9 bg-white/90 backdrop-blur-sm rounded-full flex items-center justify-center hover:bg-white transition-colors shadow-sm"
                  >
                    <Heart className="w-4 h-4 text-pink-500 fill-pink-500" />
                  </button>
                </div>
              </Link>

              <div className="p-4">
                <Link to={`/listing/${fav.id}`}>
                  <p className="text-base font-semibold text-primary group-hover:text-accent transition-colors">
                    {fav.title}
                  </p>
                </Link>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {fav.address}
                </p>
                <div className="flex items-center justify-between mt-3">
                  <p className="text-lg font-bold text-primary">{formatCHF(fav.price)}</p>
                  <p className="text-xs text-gray-400">{fav.rooms} pièces · {fav.surface} m²</p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
                  <p className="text-[11px] text-gray-400">Sauvegardé le {fav.savedAt}</p>
                  <button
                    onClick={() => {
                      // TODO: remove favorite
                    }}
                    className="text-gray-300 hover:text-danger transition-colors p-1"
                    title="Retirer des favoris"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
