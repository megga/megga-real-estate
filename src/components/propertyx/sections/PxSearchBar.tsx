// MEGGA Marketplace — Property X search bar.
// Source : Figma node 11754:25582 ("Browser") — 1114×100 pill blanc overlap hero.
// Layout fidèle :
//   [Search input + magnifier circle button] | Location ⌄ | Property ⌄ | Type ⌄
//   Dividers verticaux entre chaque zone.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PX, PxIcon } from '..'

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

const TX_TYPES = [
  { value: 'buy', label: 'Acheter' },
  { value: 'rent', label: 'Louer' },
] as const

const inputStyleBase: React.CSSProperties = {
  border: 0,
  outline: 'none',
  background: 'transparent',
  fontFamily: 'inherit',
  fontSize: 14,
  fontWeight: 400,
  letterSpacing: '-0.42px',
  color: PX.neutral700,
  width: '100%',
  padding: 0,
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
      // Section largeur viewport, positionnement absolu sur le hero
      padding: '0 24px',
      background: PX.neutral100,
      // Overlap fidèle Figma : searchbar y=868 dans hero h=900 → 32px d'overlap
      marginTop: -32,
      position: 'relative',
      zIndex: 5,
    }}>
      <form onSubmit={handleSubmit} style={{
        // Pill 1114×100 centré (fidèle Figma)
        maxWidth: 1114,
        height: 100,
        margin: '0 auto',
        display: 'grid',
        // 4 zones : search (50%) | tx | location | type (~16% chacun)
        // Fidèle Figma : search wider, selects égaux
        gridTemplateColumns: '3fr 1px 1fr 1px 1fr 1px 1fr',
        alignItems: 'center',
        background: PX.neutral100,
        borderRadius: PX.radius.pill,
        boxShadow: PX.shadow.large,
        padding: '0 16px',
      }}>
        {/* Zone 1 : Search input avec circle button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px' }}>
          <input
            type="text"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher un bien…"
            style={{ ...inputStyleBase, flex: 1 }}
          />
          <button
            type="submit"
            aria-label="Rechercher"
            style={{
              width: 40,
              height: 40,
              borderRadius: PX.radius.pill,
              border: 0,
              background: PX.neutral700,
              color: PX.neutral100,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <PxIcon name="search" size={16} color={PX.neutral100} />
          </button>
        </div>

        {/* Divider 1 */}
        <div style={{ width: 1, height: 32, background: PX.neutral300 }} />

        {/* Zone 2 : Transaction type */}
        <div style={{ padding: '0 20px', position: 'relative' }}>
          <select
            value={tx}
            onChange={e => setTx(e.target.value as 'buy' | 'rent')}
            style={{
              ...inputStyleBase,
              appearance: 'none',
              cursor: 'pointer',
              paddingRight: 24,
            }}
          >
            {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <PxIcon name="chevron-down" size={14} color={PX.neutral500} />
          </span>
        </div>

        {/* Divider 2 */}
        <div style={{ width: 1, height: 32, background: PX.neutral300 }} />

        {/* Zone 3 : Canton (Location) */}
        <div style={{ padding: '0 20px', position: 'relative' }}>
          <select
            value={canton}
            onChange={e => setCanton(e.target.value)}
            style={{
              ...inputStyleBase,
              appearance: 'none',
              cursor: 'pointer',
              paddingRight: 24,
              color: canton ? PX.neutral700 : PX.neutral500,
            }}
          >
            {CANTONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <PxIcon name="chevron-down" size={14} color={PX.neutral500} />
          </span>
        </div>

        {/* Divider 3 */}
        <div style={{ width: 1, height: 32, background: PX.neutral300 }} />

        {/* Zone 4 : Type de bien */}
        <div style={{ padding: '0 20px', position: 'relative' }}>
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            style={{
              ...inputStyleBase,
              appearance: 'none',
              cursor: 'pointer',
              paddingRight: 24,
              color: type ? PX.neutral700 : PX.neutral500,
            }}
          >
            {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <span style={{ position: 'absolute', right: 24, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <PxIcon name="chevron-down" size={14} color={PX.neutral500} />
          </span>
        </div>
      </form>
    </section>
  )
}
