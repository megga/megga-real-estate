import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import { useSavedSearches, type SavedSearch } from '@/hooks/useSavedSearches'
import EmptyState from '../EmptyState'
import { BookmarkIcon, BellIcon, BellOffIcon, TrashIcon, ChevronRightIcon } from '../icons'

function buildChips(s: SavedSearch): string[] {
  const f = s.filters
  const chips: string[] = []
  chips.push(f.context === 'rent' ? 'Location' : 'Achat')
  if (f.types && f.types.length > 0) {
    const labels: Record<string, string> = {
      apartment: 'Appartement',
      house: 'Maison',
      villa: 'Villa',
      land: 'Terrain',
      commercial: 'Commercial',
      office: 'Bureau',
      parking: 'Parking',
      storage: 'Stockage',
    }
    chips.push(f.types.map((t) => labels[t] ?? t).join(' · '))
  }
  if (f.canton) chips.push(f.canton)
  if (f.city) chips.push(f.city)
  if (f.minPrice) {
    const n = Number(f.minPrice)
    chips.push(`≥ CHF ${(n / 1000).toFixed(0)}k`)
  }
  if (f.maxPrice) {
    const n = Number(f.maxPrice)
    chips.push(`≤ CHF ${(n / 1000).toFixed(0)}k`)
  }
  if (f.rooms) chips.push(`≥ ${f.rooms} pièces`)
  if (f.bedrooms) chips.push(`≥ ${f.bedrooms} ch`)
  return chips
}

interface CardProps {
  search: SavedSearch
  onToggleAlert: () => void
  onSetFreq: (freq: 'daily' | 'weekly') => void
  onDelete: () => void
  onOpen: () => void
}

function SearchCard({ search, onToggleAlert, onSetFreq, onDelete, onOpen }: CardProps) {
  const chips = buildChips(search)
  const created = new Date(search.createdAt)
  const dateStr = created.toLocaleDateString('fr-CH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })

  return (
    <div
      style={{
        padding: 20,
        border: `1px solid ${T.border}`,
        borderRadius: 14,
        background: '#fff',
        display: 'grid',
        gridTemplateColumns: '1fr auto',
        gap: 16,
        alignItems: 'start',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 16,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: -0.2,
            marginBottom: 4,
          }}
        >
          {search.name}
        </div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 11,
            color: T.muted,
            marginBottom: 12,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          Sauvegardée le {dateStr}
        </div>
        {chips.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
            {chips.map((c, i) => (
              <span
                key={i}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: T.section,
                  fontFamily: T.fontStack,
                  fontSize: 12,
                  fontWeight: 600,
                  color: T.soft,
                }}
              >
                {c}
              </span>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={onToggleAlert}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 12px',
              borderRadius: 999,
              border: 'none',
              background: search.alertEnabled ? T.accentSoft : T.section,
              color: search.alertEnabled ? T.ink : T.muted,
              fontFamily: T.fontStack,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {search.alertEnabled ? <BellIcon size={13} /> : <BellOffIcon size={13} />}
            <span>{search.alertEnabled ? 'Alerte active' : 'Alerte désactivée'}</span>
          </button>
          {search.alertEnabled && (
            <select
              value={search.alertFrequency}
              onChange={(e) => onSetFreq(e.target.value as 'daily' | 'weekly')}
              style={{
                height: 32,
                padding: '0 10px',
                borderRadius: 8,
                border: `1px solid ${T.border}`,
                background: '#fff',
                fontFamily: T.fontStack,
                fontSize: 12,
                fontWeight: 600,
                color: T.soft,
                cursor: 'pointer',
              }}
            >
              <option value="daily">Quotidien</option>
              <option value="weekly">Hebdomadaire</option>
            </select>
          )}
          <button
            onClick={onOpen}
            style={{
              fontFamily: T.fontStack,
              fontSize: 12,
              fontWeight: 700,
              color: T.ink,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 32,
              padding: '0 12px',
            }}
          >
            Ouvrir la recherche <ChevronRightIcon size={12} />
          </button>
        </div>
      </div>
      <button
        onClick={onDelete}
        style={{
          width: 36,
          height: 36,
          border: `1px solid ${T.border}`,
          background: '#fff',
          color: T.muted,
          cursor: 'pointer',
          borderRadius: 10,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
        title="Supprimer"
        onMouseEnter={(e) => {
          e.currentTarget.style.background = T.section
          e.currentTarget.style.color = T.warning
          e.currentTarget.style.borderColor = '#E2C5B5'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = '#fff'
          e.currentTarget.style.color = T.muted
          e.currentTarget.style.borderColor = T.border
        }}
      >
        <TrashIcon size={15} />
      </button>
    </div>
  )
}

export default function SearchesSection() {
  const { searches, deleteSearch, toggleAlert, updateFrequency } = useSavedSearches()
  const navigate = useNavigate()
  const { t } = useTranslation('compte')

  if (searches.length === 0) {
    return (
      <EmptyState
        icon={<BookmarkIcon size={28} />}
        title={t('empty.searches.title')}
        body={t('empty.searches.body')}
        cta={t('empty.searches.cta')}
        ctaHref="/louer"
      />
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {searches.map((s) => (
        <SearchCard
          key={s.id}
          search={s}
          onToggleAlert={() => toggleAlert(s.id)}
          onSetFreq={(freq) => updateFrequency(s.id, freq)}
          onDelete={() => deleteSearch(s.id)}
          onOpen={() => {
            const target = s.filters.context === 'buy' ? '/acheter' : '/louer'
            navigate(`${target}?savedSearch=${s.id}`)
          }}
        />
      ))}
    </div>
  )
}
