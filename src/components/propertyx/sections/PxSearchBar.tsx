// MEGGA Marketplace — Property X search bar.
// Refactor utilisant les atomes du DS (PxInput, PxSelect, PxIcon, PxButton).

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PX, PxInput, PxSelect, PxIcon, PxButton } from '..'

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
      padding: `0 40px`,
      background: PX.neutral100,
      marginTop: -36,
      position: 'relative',
      zIndex: 5,
    }}>
      <form onSubmit={handleSubmit} style={{
        maxWidth: 1100,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.regular,
        padding: 8,
      }}>
        <div style={{ flex: 2, minWidth: 0 }}>
          <PxInput
            variant="light"
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Rechercher un bien, un quartier…"
            leftIcon={<PxIcon name="search" size={18} color={PX.neutral500} />}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PxSelect value={tx} onChange={e => setTx(e.target.value as 'buy' | 'rent')}>
            {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </PxSelect>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PxSelect value={canton} onChange={e => setCanton(e.target.value)}>
            {CANTONS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </PxSelect>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <PxSelect value={type} onChange={e => setType(e.target.value)}>
            {PROPERTY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </PxSelect>
        </div>
        <PxButton type="submit" variant="primary" size="lg">
          Rechercher
        </PxButton>
      </form>
    </section>
  )
}
