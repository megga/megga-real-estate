// MEGGA Marketplace — Property X search bar (Browser component).
// Source : Figma node 11754:25582 (Browser) — code Figma exact.
//
// Structure fidèle :
//   <Browser : white pill, p-24, rounded-48, BS Small shadow, gap-2>
//     <Input "Search for properties" : 400×52, bg-fafafb, rounded-LEFT-pill>
//       inside: placeholder + absolute circle button 40×40 right-6 with search icon
//     <Select "Location" : 220×52, bg-fafafb, no rounding, chevron-down right>
//     <Select "Property" : 220×52, bg-fafafb, no rounding, chevron-down right>
//     <Select "Type"     : 220×52, bg-fafafb, rounded-RIGHT-pill, chevron-down right>
//   </Browser>
//
// Total width : 400 + 2 + 220 + 2 + 220 + 2 + 220 = 1066 + 48 padding = 1114
// Overlap au-dessus du hero : -56px (Container hero a mb-[-56])

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PX, PxIcon } from '..'

const CANTONS = [
  { value: '', label: 'Toute la Suisse' },
  { value: 'GE', label: 'Genève' },
  { value: 'VD', label: 'Vaud' },
  { value: 'VS', label: 'Valais' },
  { value: 'NE', label: 'Neuchâtel' },
  { value: 'FR', label: 'Fribourg' },
  { value: 'BE', label: 'Berne' },
  { value: 'JU', label: 'Jura' },
  { value: 'TI', label: 'Tessin' },
] as const

const TX_TYPES = [
  { value: 'buy', label: 'Acheter' },
  { value: 'rent', label: 'Louer' },
] as const

const PROPERTY_TYPES = [
  { value: '', label: 'Tous types' },
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'office', label: 'Bureau' },
  { value: 'parking', label: 'Parking' },
  { value: 'storage', label: 'Dépôt' },
  { value: 'land', label: 'Terrain' },
] as const

// Style commun aux selects : 220×52, bg #fafafb, padding 16/6/16/6
const selectFieldStyle = {
  background: PX.neutral200,
  width: 220,
  height: 52,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 6,
  paddingBottom: 6,
  position: 'relative' as const,
}

const placeholderStyle = {
  fontFamily: PX.font.display,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.25,
  letterSpacing: '-0.48px',
  color: PX.neutral500,
  background: 'transparent',
  border: 0,
  outline: 'none',
  appearance: 'none' as const,
  cursor: 'pointer',
  flex: 1,
  paddingRight: 8,
}

export default function PxSearchBar() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [tx, setTx] = useState<'buy' | 'rent'>('buy')
  const [type, setType] = useState('')
  const [canton, setCanton] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (type) params.set('type', type)
    if (canton) params.set('canton', canton)
    const route = tx === 'rent' ? '/louer' : '/acheter'
    navigate(`${route}?${params.toString()}`)
  }

  return (
    <section style={{
      // Overlap fidèle Figma : Hero Container a mb-[-56], mais comme les
      // sections sont séparées en React, on pull la SearchBar UP -56px
      display: 'flex',
      justifyContent: 'center',
      background: PX.neutral100,
      padding: '0 24px',
      position: 'relative',
      marginTop: -56,
      zIndex: 5,
    }}>
      <form onSubmit={handleSubmit} style={{
        // Outer Browser pill : white, p-24, rounded-48, BS Small shadow
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 2,
        padding: 24,
        background: PX.neutral100,
        borderRadius: 48,
        // BS Small = 0 4 4 0 #D3D3D30F + 0 1 1 0 #0E0E0E0A
        boxShadow: PX.shadow.small,
      }}>
        {/* Zone 1 : Input "Search for properties" — 400×52, bg #fafafb,
            rounded LEFT pill, contient input + circle button absolute */}
        <div style={{
          background: PX.neutral200,
          width: 400,
          height: 52,
          display: 'flex',
          alignItems: 'center',
          paddingLeft: 16,
          paddingRight: 6,
          paddingTop: 6,
          paddingBottom: 6,
          borderTopLeftRadius: PX.radius.pill,
          borderBottomLeftRadius: PX.radius.pill,
          position: 'relative',
        }}>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher un bien"
            style={{
              ...placeholderStyle,
              fontFamily: PX.font.display,
              color: q ? PX.neutral700 : PX.neutral500,
              paddingRight: 52,  // place pour le circle button absolute
            }}
          />
          <button
            type="submit"
            aria-label="Rechercher"
            style={{
              position: 'absolute',
              right: 6,
              top: '50%',
              transform: 'translateY(-50%)',
              width: 40,
              height: 40,
              borderRadius: PX.radius.pill,
              border: 0,
              background: PX.neutral700,
              color: PX.neutral100,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <PxIcon name="search" size={22} color={PX.neutral100} />
          </button>
        </div>

        {/* Zone 2 : Transaction (Acheter / Louer) — 220×52 */}
        <div style={selectFieldStyle}>
          <select
            value={tx}
            onChange={e => setTx(e.target.value as 'buy' | 'rent')}
            style={placeholderStyle}
          >
            {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <PxIcon name="chevron-down" size={16} color={PX.neutral500} />
        </div>

        {/* Zone 3 : Location (Canton) — 220×52 */}
        <div style={selectFieldStyle}>
          <select
            value={canton}
            onChange={e => setCanton(e.target.value)}
            style={{
              ...placeholderStyle,
              color: canton ? PX.neutral700 : PX.neutral500,
            }}
          >
            {CANTONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <PxIcon name="chevron-down" size={16} color={PX.neutral500} />
        </div>

        {/* Zone 4 : Type — 220×52, rounded RIGHT pill */}
        <div style={{
          ...selectFieldStyle,
          borderTopRightRadius: PX.radius.pill,
          borderBottomRightRadius: PX.radius.pill,
        }}>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{
              ...placeholderStyle,
              color: type ? PX.neutral700 : PX.neutral500,
            }}
          >
            {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <PxIcon name="chevron-down" size={16} color={PX.neutral500} />
        </div>
      </form>
    </section>
  )
}
