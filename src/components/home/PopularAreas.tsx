import { useState, useCallback, useEffect } from 'react'
import { Link } from 'react-router-dom'
import MapGL, { Marker, type ViewStateChangeEvent } from 'react-map-gl/mapbox'
import { MapPin, ArrowRight, TrendingUp, Home, Users, Navigation } from 'lucide-react'
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

interface City {
  id: string
  name: string
  canton: string
  lat: number
  lng: number
  zoom: number
  areas: Area[]
}

const CITIES: City[] = [
  {
    id: 'geneve',
    name: 'Genève',
    canton: 'GE',
    lat: 46.2044,
    lng: 6.1432,
    zoom: 12,
    areas: [
      { id: 'ge-champel', name: 'Champel', canton: 'GE', lat: 46.1918, lng: 6.1560, listings: 184, avgPrice: 1350000, trend: '+4.2%', popular: true },
      { id: 'ge-eaux-vives', name: 'Eaux-Vives', canton: 'GE', lat: 46.2020, lng: 6.1620, listings: 210, avgPrice: 1120000, trend: '+3.8%', popular: true },
      { id: 'ge-carouge', name: 'Carouge', canton: 'GE', lat: 46.1830, lng: 6.1390, listings: 156, avgPrice: 890000, trend: '+5.1%', popular: true },
      { id: 'ge-plainpalais', name: 'Plainpalais', canton: 'GE', lat: 46.1975, lng: 6.1420, listings: 198, avgPrice: 950000, trend: '+2.9%', popular: false },
      { id: 'ge-paquis', name: 'Pâquis', canton: 'GE', lat: 46.2100, lng: 6.1500, listings: 245, avgPrice: 780000, trend: '+6.3%', popular: true },
      { id: 'ge-servette', name: 'Servette', canton: 'GE', lat: 46.2150, lng: 6.1300, listings: 132, avgPrice: 720000, trend: '+3.1%', popular: false },
      { id: 'ge-cologny', name: 'Cologny', canton: 'GE', lat: 46.2130, lng: 6.1800, listings: 48, avgPrice: 3950000, trend: '+1.5%', popular: true },
      { id: 'ge-lancy', name: 'Lancy', canton: 'GE', lat: 46.1780, lng: 6.1180, listings: 168, avgPrice: 680000, trend: '+4.7%', popular: false },
      { id: 'ge-vernier', name: 'Vernier', canton: 'GE', lat: 46.2170, lng: 6.0830, listings: 142, avgPrice: 620000, trend: '+3.5%', popular: false },
      { id: 'ge-meyrin', name: 'Meyrin', canton: 'GE', lat: 46.2340, lng: 6.0760, listings: 95, avgPrice: 750000, trend: '+2.8%', popular: false },
      { id: 'ge-onex', name: 'Onex', canton: 'GE', lat: 46.1840, lng: 6.1000, listings: 88, avgPrice: 590000, trend: '+5.5%', popular: false },
      { id: 'ge-chene-bougeries', name: 'Chêne-Bougeries', canton: 'GE', lat: 46.1960, lng: 6.1880, listings: 62, avgPrice: 1680000, trend: '+2.2%', popular: false },
    ],
  },
  {
    id: 'lausanne',
    name: 'Lausanne',
    canton: 'VD',
    lat: 46.5197,
    lng: 6.6323,
    zoom: 13,
    areas: [
      { id: 'vd-ouchy', name: 'Ouchy', canton: 'VD', lat: 46.5080, lng: 6.6280, listings: 135, avgPrice: 1480000, trend: '+3.9%', popular: true },
      { id: 'vd-flon', name: 'Flon', canton: 'VD', lat: 46.5210, lng: 6.6290, listings: 178, avgPrice: 920000, trend: '+5.2%', popular: true },
      { id: 'vd-montbenon', name: 'Montbenon', canton: 'VD', lat: 46.5190, lng: 6.6240, listings: 92, avgPrice: 1250000, trend: '+2.8%', popular: false },
      { id: 'vd-chailly', name: 'Chailly', canton: 'VD', lat: 46.5250, lng: 6.6500, listings: 145, avgPrice: 850000, trend: '+4.5%', popular: true },
      { id: 'vd-pully', name: 'Pully', canton: 'VD', lat: 46.5100, lng: 6.6620, listings: 110, avgPrice: 1380000, trend: '+3.1%', popular: true },
      { id: 'vd-prilly', name: 'Prilly', canton: 'VD', lat: 46.5310, lng: 6.6080, listings: 168, avgPrice: 680000, trend: '+6.1%', popular: false },
      { id: 'vd-renens', name: 'Renens', canton: 'VD', lat: 46.5390, lng: 6.5880, listings: 195, avgPrice: 590000, trend: '+7.2%', popular: true },
      { id: 'vd-sous-gare', name: 'Sous-Gare', canton: 'VD', lat: 46.5150, lng: 6.6350, listings: 88, avgPrice: 780000, trend: '+4.0%', popular: false },
    ],
  },
  {
    id: 'zurich',
    name: 'Zurich',
    canton: 'ZH',
    lat: 47.3769,
    lng: 8.5417,
    zoom: 12.5,
    areas: [
      { id: 'zh-seefeld', name: 'Seefeld', canton: 'ZH', lat: 47.3580, lng: 8.5530, listings: 220, avgPrice: 2150000, trend: '+3.5%', popular: true },
      { id: 'zh-enge', name: 'Enge', canton: 'ZH', lat: 47.3620, lng: 8.5320, listings: 165, avgPrice: 1980000, trend: '+2.8%', popular: true },
      { id: 'zh-wiedikon', name: 'Wiedikon', canton: 'ZH', lat: 47.3650, lng: 8.5200, listings: 198, avgPrice: 1250000, trend: '+5.1%', popular: true },
      { id: 'zh-oerlikon', name: 'Oerlikon', canton: 'ZH', lat: 47.4090, lng: 8.5440, listings: 285, avgPrice: 890000, trend: '+6.8%', popular: true },
      { id: 'zh-altstetten', name: 'Altstetten', canton: 'ZH', lat: 47.3900, lng: 8.4880, listings: 240, avgPrice: 780000, trend: '+7.3%', popular: false },
      { id: 'zh-hottingen', name: 'Hottingen', canton: 'ZH', lat: 47.3680, lng: 8.5560, listings: 95, avgPrice: 2850000, trend: '+1.9%', popular: true },
      { id: 'zh-wipkingen', name: 'Wipkingen', canton: 'ZH', lat: 47.3950, lng: 8.5250, listings: 142, avgPrice: 1050000, trend: '+4.6%', popular: false },
      { id: 'zh-schwamendingen', name: 'Schwamendingen', canton: 'ZH', lat: 47.4050, lng: 8.5700, listings: 175, avgPrice: 720000, trend: '+5.5%', popular: false },
      { id: 'zh-affoltern', name: 'Affoltern', canton: 'ZH', lat: 47.4230, lng: 8.5130, listings: 130, avgPrice: 650000, trend: '+4.2%', popular: false },
    ],
  },
  {
    id: 'bale',
    name: 'Bâle',
    canton: 'BS',
    lat: 47.5596,
    lng: 7.5886,
    zoom: 13,
    areas: [
      { id: 'bs-altstadt', name: 'Altstadt', canton: 'BS', lat: 47.5580, lng: 7.5880, listings: 125, avgPrice: 1450000, trend: '+3.2%', popular: true },
      { id: 'bs-gundeldingen', name: 'Gundeldingen', canton: 'BS', lat: 47.5440, lng: 7.5900, listings: 195, avgPrice: 680000, trend: '+5.8%', popular: true },
      { id: 'bs-st-johann', name: 'St. Johann', canton: 'BS', lat: 47.5650, lng: 7.5720, listings: 168, avgPrice: 750000, trend: '+6.1%', popular: true },
      { id: 'bs-kleinbasel', name: 'Kleinbasel', canton: 'BS', lat: 47.5660, lng: 7.5980, listings: 210, avgPrice: 820000, trend: '+4.5%', popular: true },
      { id: 'bs-bruderholz', name: 'Bruderholz', canton: 'BS', lat: 47.5350, lng: 7.5800, listings: 65, avgPrice: 2200000, trend: '+2.1%', popular: false },
      { id: 'bs-riehen', name: 'Riehen', canton: 'BS', lat: 47.5790, lng: 7.6490, listings: 88, avgPrice: 1650000, trend: '+2.8%', popular: true },
    ],
  },
  {
    id: 'berne',
    name: 'Berne',
    canton: 'BE',
    lat: 46.9480,
    lng: 7.4474,
    zoom: 13,
    areas: [
      { id: 'be-altstadt', name: 'Vieille ville', canton: 'BE', lat: 46.9480, lng: 7.4510, listings: 85, avgPrice: 1280000, trend: '+2.5%', popular: true },
      { id: 'be-kirchenfeld', name: 'Kirchenfeld', canton: 'BE', lat: 46.9410, lng: 7.4580, listings: 110, avgPrice: 1520000, trend: '+3.1%', popular: true },
      { id: 'be-laenggasse', name: 'Länggasse', canton: 'BE', lat: 46.9560, lng: 7.4350, listings: 175, avgPrice: 780000, trend: '+5.4%', popular: true },
      { id: 'be-breitenrain', name: 'Breitenrain', canton: 'BE', lat: 46.9600, lng: 7.4520, listings: 195, avgPrice: 690000, trend: '+6.2%', popular: true },
      { id: 'be-mattenhof', name: 'Mattenhof', canton: 'BE', lat: 46.9380, lng: 7.4350, listings: 145, avgPrice: 620000, trend: '+4.8%', popular: false },
      { id: 'be-bumpliz', name: 'Bümpliz', canton: 'BE', lat: 46.9440, lng: 7.3920, listings: 165, avgPrice: 520000, trend: '+7.1%', popular: true },
    ],
  },
  {
    id: 'lugano',
    name: 'Lugano',
    canton: 'TI',
    lat: 46.0037,
    lng: 8.9511,
    zoom: 13,
    areas: [
      { id: 'ti-centro', name: 'Centro', canton: 'TI', lat: 46.0040, lng: 8.9520, listings: 98, avgPrice: 1350000, trend: '+3.8%', popular: true },
      { id: 'ti-paradiso', name: 'Paradiso', canton: 'TI', lat: 45.9920, lng: 8.9440, listings: 72, avgPrice: 1850000, trend: '+2.5%', popular: true },
      { id: 'ti-castagnola', name: 'Castagnola', canton: 'TI', lat: 46.0070, lng: 8.9720, listings: 45, avgPrice: 2650000, trend: '+1.8%', popular: true },
      { id: 'ti-massagno', name: 'Massagno', canton: 'TI', lat: 46.0130, lng: 8.9430, listings: 115, avgPrice: 780000, trend: '+5.2%', popular: true },
      { id: 'ti-viganello', name: 'Viganello', canton: 'TI', lat: 46.0150, lng: 8.9620, listings: 88, avgPrice: 650000, trend: '+6.0%', popular: false },
      { id: 'ti-pregassona', name: 'Pregassona', canton: 'TI', lat: 46.0240, lng: 8.9550, listings: 78, avgPrice: 580000, trend: '+4.5%', popular: false },
    ],
  },
]

function findClosestCity(lat: number, lng: number): City {
  let closest = CITIES[0]
  let minDist = Infinity
  for (const city of CITIES) {
    const d = Math.sqrt((city.lat - lat) ** 2 + (city.lng - lng) ** 2)
    if (d < minDist) {
      minDist = d
      closest = city
    }
  }
  return closest
}

export default function PopularAreas() {
  const [activeCity, setActiveCity] = useState<City>(CITIES[0])
  const [selectedArea, setSelectedArea] = useState<Area | null>(CITIES[0].areas[0])
  const [geoDetected, setGeoDetected] = useState(false)
  const [viewState, setViewState] = useState({
    longitude: CITIES[0].lng,
    latitude: CITIES[0].lat,
    zoom: CITIES[0].zoom,
  })

  // Geolocation on mount
  useEffect(() => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const city = findClosestCity(pos.coords.latitude, pos.coords.longitude)
        setActiveCity(city)
        setSelectedArea(city.areas[0])
        setViewState({ longitude: city.lng, latitude: city.lat, zoom: city.zoom })
        setGeoDetected(true)
      },
      () => {
        // Permission denied or error — keep default (Genève)
      },
      { timeout: 5000, maximumAge: 600000 }
    )
  }, [])

  const handleMove = useCallback((evt: ViewStateChangeEvent) => {
    setViewState(evt.viewState)
  }, [])

  function handleCityChange(city: City) {
    setActiveCity(city)
    setSelectedArea(city.areas[0])
    setViewState({ longitude: city.lng, latitude: city.lat, zoom: city.zoom })
  }

  const popularAreas = activeCity.areas.filter((a) => a.popular)

  return (
    <section className="py-16 md:py-20 bg-[var(--color-bg-section,#F9FAFB)]">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <p className="text-[10px] font-medium text-gray-300 uppercase tracking-[0.2em]">
              Carte interactive
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold text-primary mt-1">
              Quartiers populaires
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Explorez les zones les plus recherchées
              {geoDetected && (
                <span className="inline-flex items-center gap-1 ml-1.5 text-accent">
                  <Navigation className="w-3 h-3" />
                  <span className="text-[11px]">près de vous</span>
                </span>
              )}
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

        {/* City tabs */}
        <div className="flex gap-1.5 flex-wrap mb-6">
          {CITIES.map((city) => (
            <button
              key={city.id}
              onClick={() => handleCityChange(city)}
              className={cn(
                'rounded-full px-4 py-2 text-xs font-medium transition-all cursor-pointer',
                activeCity.id === city.id
                  ? 'bg-primary text-white shadow-sm'
                  : 'bg-white text-gray-500 border border-gray-200 hover:border-gray-300 hover:text-primary'
              )}
            >
              {city.name}
              <span className={cn(
                'ml-1.5 text-[10px]',
                activeCity.id === city.id ? 'text-white/60' : 'text-gray-300'
              )}>
                {city.canton}
              </span>
            </button>
          ))}
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
              {activeCity.areas.map((area) => {
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

          {/* Sidebar */}
          <div className="flex flex-col gap-4">
            {/* Selected area card */}
            {selectedArea && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-card">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-primary">{selectedArea.name}</h3>
                    <p className="text-xs text-gray-400">{activeCity.name}, {selectedArea.canton}</p>
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
                Les plus recherchés à {activeCity.name}
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
