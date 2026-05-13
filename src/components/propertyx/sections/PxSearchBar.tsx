// MEGGA Marketplace — Property X search bar.
// Barre de recherche horizontale 4 colonnes : Recherche libre · Localisation
// · Type · Statut transaction. Visuellement "flottante" sous le hero.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PX } from '../tokens'

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

function SearchIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={PX.ink} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  )
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

  const cellStyle: React.CSSProperties = {
    flex: 1,
    minWidth: 0,
    padding: '12px 16px',
    background: 'transparent',
    border: 0,
    fontFamily: PX.font.sans,
    fontSize: 14,
    color: PX.ink,
    outline: 'none',
    cursor: 'pointer',
  }

  const separatorStyle: React.CSSProperties = {
    width: 1,
    alignSelf: 'stretch',
    background: PX.border,
  }

  return (
    <section style={{
      padding: `0 ${PX.space.pageX}px`,
      background: PX.pageBg,
      marginTop: -36,
      position: 'relative',
      zIndex: 5,
    }}>
      <form onSubmit={handleSubmit} style={{
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        background: PX.surfaceBg,
        borderRadius: PX.radiusPill,
        boxShadow: PX.shadow.card,
        padding: '4px 4px 4px 8px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', flex: 2, gap: 8, paddingLeft: 8 }}>
          <SearchIcon />
          <input
            type="text"
            placeholder="Rechercher un bien, un quartier…"
            value={q}
            onChange={e => setQ(e.target.value)}
            style={{ ...cellStyle, padding: '12px 0', cursor: 'text' }}
          />
        </div>
        <div style={separatorStyle} />
        <select value={tx} onChange={e => setTx(e.target.value as 'buy' | 'rent')} style={cellStyle}>
          {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <div style={separatorStyle} />
        <select value={canton} onChange={e => setCanton(e.target.value)} style={cellStyle}>
          {CANTONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <div style={separatorStyle} />
        <select value={type} onChange={e => setType(e.target.value)} style={cellStyle}>
          {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
        <button type="submit" style={{
          background: PX.ink,
          color: PX.inkInverse,
          border: 0,
          borderRadius: PX.radiusPill,
          padding: '12px 22px',
          fontSize: 14,
          fontWeight: 600,
          fontFamily: PX.font.sans,
          cursor: 'pointer',
          marginLeft: 4,
          boxShadow: PX.shadow.pillBlack,
        }}>Rechercher</button>
      </form>
    </section>
  )
}
