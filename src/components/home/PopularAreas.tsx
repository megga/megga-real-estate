import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import MapGL, { Marker, type ViewStateChangeEvent } from 'react-map-gl/mapbox'
import { MapPin, ArrowRight, TrendingUp, Home, Users } from 'lucide-react'
import { cn, formatCHF } from '@/lib/utils'
import 'mapbox-gl/dist/mapbox-gl.css'

const MAPBOX_TOKEN =
  import.meta.env.VITE_MAPBOX_TOKEN ||
  'pk.eyJ1IjoibWVnZ2FpIiwiYSI6ImNtbXZiM3JpYzIwdGQycXF4cnI2bDdhYzAifQ.xvmW0Co7J3F497zSCXNQsw'

interface Area {
  id: string
  name: string
  canton: string
  lat: number
  lng: number
  listings: number
  avgPrice: number
  trend: string
  popular: boolean
}

const AREAS: Area[] = [
  { id: 'champel', name: 'Champel', canton: 'GE', lat: 46.1918, lng: 6.1560, listings: 184, avgPrice: 1350000, trend: '+4.2%', popular: true },
  { id: 'eaux-vives', name: 'Eaux-Vives', canton: 'GE', lat: 46.2020, lng: 6.1620, listings: 210, avgPrice: 1120000, trend: '+3.8%', popular: true },
  { id: 'carouge', name: 'Carouge', canton: 'GE', lat: 46.1830, lng: 6.1390, listings: 156, avgPrice: 890000, trend: '+5.1%', popular: true },
  { id: 'plainpalais', name: 'Plainpalais', canton: 'GE', lat: 46.1975, lng: 6.1420, listings: 198, avgPrice: 950000, trend: '+2.9%', popular: false },
  { id: 'paquis', name: 'Pâquis', canton: 'GE', lat: 46.2100, lng: 6.1500, listings: 245, avgPrice: 780000, trend: '+6.3%', popular: true },
  { id: 'servette', name: 'Servette', canton: 'GE', lat: 46.2150, lng: 6.1300, listings: 132, avgPrice: 720000, trend: '+3.1%', popular: false },
  { id: 'cologny', name: 'Cologny', canton: 'GE', lat: 46.2130, lng: 6.1800, listings: 48, avgPrice: 3950000, trend: '+1.5%', popular: true },
  { id: 'lancy', name: 'Lancy', canton: 'GE', lat: 46.1780, lng: 6.1180, listings: 168, avgPrice: 680000, trend: '+4.7%', popular: false },
  { id: 'vernier', name: 'Vernier', canton: 'GE', lat: 46.2170, lng: 6.0830, listings: 142, avgPrice: 620000, trend: '+3.5%', popular: false },
  { id: 'meyrin', name: 'Meyrin', canton: 'GE', lat: 46.2340, lng: 6.0760, listings: 95, avgPrice: 750000, trend: '+2.8%', popular: false },
  { id: 'onex', name: 'Onex', canton: 'GE', lat: 46.1840, lng: 6.1000, listings: 88, avgPrice: 590000, trend: '+5.5%', popular: false },
  { id: 'chene-bougeries', name: 'Chêne-Bougeries', canton: 'GE', lat: 46.1960, lng: 6.1880, listings: 62, avgPrice: 1680000, trend: '+2.2%', popular: false },
]

export default function PopularAreas() {
  const [selectedArea, setSelectedArea] = useState<Area | null>(AREAS[0])
  const [viewState, setViewState] = useState({
    longitude: 6.1432,
    latitude: 46.2044,
    zoom: 12,
  })

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState)
  }, [])

  const popularAreas = AREAS.filter((a) => a.popular)

  return (
    <section className="py-16 md:py-20 bg-[var(--color-bg-section,#F9FAFB)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex items-end justify-between mb-8">
          <div>
            <p className="text-[10px] font-medium text-gray-300 uppercase tracking-[0.2em]">
              Carte interactive
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold text-primary mt-1">
              Quartiers populaires
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Explorez les zones les plus recherchées de Genève
            </p>
          </div>
          <Link
            to="/acheter"
            className="hidden md:inline-flex items-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors group"
          >
            Explorer la carte
            <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
          </Link>
        </div>

        {/* Content: Map + Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Map */}
          <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-gray-200 shadow-card bg-white" style={{ height: '480px' }}>
            <MapGL
              {...viewState}
              onMove={handleMove}
              mapboxAccessToken={MAPBOX_TOKEN}
              mapStyle="mapbox://styles/mapbox/light-v11"
              attributionControl={false}
              reuseMaps
              style={{ width: '100%', height: '100%' }}
            >
              {AREAS.map((area) => {
                const isSelected = selectedArea?.id === area.id
                return (
                  <Marker
                    key={area.id}
                    longitude={area.lng}
                    latitude={area.lat}
                    anchor="center"
                    onClick={(e) => {
                      e.originalEvent.stopPropagation()
                      setSelectedArea(area)
                    }}
                  >
                    <button
                      className={cn(
                        'flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-semibold shadow-md transition-all duration-200 cursor-pointer border whitespace-nowrap',
                        isSelected
                          ? 'bg-accent text-white border-accent scale-110 z-20 shadow-lg'
                          : area.popular
                            ? 'bg-white text-primary border-gray-200 hover:border-accent hover:text-accent z-10'
                            : 'bg-white/90 text-gray-500 border-gray-100 hover:border-gray-300 z-0'
                      )}
                    >
                      <span className={cn(
                        'w-1.5 h-1.5 rounded-full flex-shrink-0',
                        isSelected ? 'bg-white' : area.popular ? 'bg-accent' : 'bg-gray-300'
                      )} />
                      {area.name}
                    </button>
                  </Marker>
                )
              })}
            </MapGL>
          </div>

          {/* Sidebar — Selected area details + popular list */}
          <div className="flex flex-col gap-4">
            {/* Selected area card */}
            {selectedArea && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{selectedArea.name}</h3>
                    <p className="text-xs text-gray-400">{selectedArea.canton}</p>
                  </div>
                  <div className="flex items-center gap-1 text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                    <TrendingUp className="w-3 h-3" />
                    <span className="text-[11px] font-semibold">{selectedArea.trend}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mt-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Home className="w-3 h-3" />
                      <span className="text-[10px] uppercase tracking-wider font-medium">Prix moyen</span>
                    </div>
                    <p className="text-sm font-bold text-primary mt-1">{formatCHF(selectedArea.avgPrice)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <div className="flex items-center gap-1.5 text-gray-400">
                      <Users className="w-3 h-3" />
                      <span className="text-[10px] uppercase tracking-wider font-medium">Annonces</span>
                    </div>
                    <p className="text-sm font-bold text-primary mt-1">{selectedArea.listings} biens</p>
                  </div>
                </div>

                <Link
                  to="/acheter"
                  className="flex items-center justify-center gap-1.5 w-full h-10 bg-accent text-white text-sm font-medium rounded-full mt-4 hover:bg-accent/90 transition-colors"
                >
                  Voir les biens
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}

            {/* Popular areas list */}
            <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-card flex-1">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">
                Les plus recherchés
              </p>
              <div className="space-y-1">
                {popularAreas.map((area) => (
                  <button
                    key={area.id}
                    onClick={() => {
                      setSelectedArea(area)
                      setViewState((prev) => ({
                        ...prev,
                        longitude: area.lng,
                        latitude: area.lat,
                        zoom: 14,
                      }))
                    }}
                    className={cn(
                      'w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all cursor-pointer group',
                      selectedArea?.id === area.id
                        ? 'bg-accent/5 border border-accent/15'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    <div className="flex items-center gap-2.5">
                      <MapPin className={cn(
                        'w-3.5 h-3.5 flex-shrink-0',
                        selectedArea?.id === area.id ? 'text-accent' : 'text-gray-300 group-hover:text-gray-500'
                      )} />
                      <div>
                        <span className={cn(
                          'text-sm font-medium',
                          selectedArea?.id === area.id ? 'text-accent' : 'text-primary'
                        )}>
                          {area.name}
                        </span>
                        <span className="text-[11px] text-gray-300 ml-1.5">{area.listings} biens</span>
                      </div>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-medium">{area.trend}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Mobile CTA */}
            <Link
              to="/acheter"
              className="lg:hidden flex items-center justify-center gap-1.5 text-sm font-medium text-accent hover:text-accent/80 transition-colors py-2"
            >
              Explorer la carte complète
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}
