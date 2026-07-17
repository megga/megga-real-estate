// MEGGA — Gallery layout picker (form de création/édition d'annonce).
// Permet à l'agent de choisir parmi les 3 variantes du proto BienGallery :
// hero (1 grande + 2×2), mosaic (6 asymétriques), carousel (single + thumbs).
//
// Chaque option est représentée par une mini-mockup visuelle des grilles.

import { useTranslation } from 'react-i18next'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  green: '#0041D9',
}

export type GalleryLayout = 'hero' | 'mosaic' | 'carousel'

interface GalleryLayoutPickerProps {
  value: GalleryLayout
  onChange: (layout: GalleryLayout) => void
}

const OPTIONS: Array<{ value: GalleryLayout; mock: React.ReactNode }> = [
  {
    value: 'hero',
    mock: (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.5fr 1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 3,
          width: '100%',
          height: 64,
        }}
      >
        <div style={{ gridRow: '1 / 3', gridColumn: '1 / 2', background: '#9DB1D9', borderRadius: 3 }} />
        <div style={{ background: '#C7D5EB', borderRadius: 3 }} />
        <div style={{ background: '#C7D5EB', borderRadius: 3 }} />
        <div style={{ background: '#C7D5EB', borderRadius: 3 }} />
        <div style={{ background: '#C7D5EB', borderRadius: 3 }} />
      </div>
    ),
  },
  {
    value: 'mosaic',
    mock: (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr 1fr 1fr',
          gridTemplateRows: '1fr 1fr 1fr',
          gap: 3,
          width: '100%',
          height: 64,
        }}
      >
        <div style={{ gridRow: '1 / 3', gridColumn: '1 / 2', background: '#9DB1D9', borderRadius: 3 }} />
        <div style={{ gridRow: '1 / 2', gridColumn: '2 / 4', background: '#C7D5EB', borderRadius: 3 }} />
        <div style={{ gridRow: '2 / 3', gridColumn: '2 / 3', background: '#C7D5EB', borderRadius: 3 }} />
        <div style={{ gridRow: '2 / 3', gridColumn: '3 / 4', background: '#C7D5EB', borderRadius: 3 }} />
        <div style={{ gridRow: '1 / 3', gridColumn: '4 / 5', background: '#C7D5EB', borderRadius: 3 }} />
        <div style={{ gridRow: '3 / 4', gridColumn: '1 / 5', background: '#C7D5EB', borderRadius: 3 }} />
      </div>
    ),
  },
  {
    value: 'carousel',
    mock: (
      <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div
          style={{
            position: 'relative',
            background: '#9DB1D9',
            borderRadius: 3,
            height: 44,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 6px',
          }}
        >
          <div style={{ width: 10, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.95)' }} />
          <div style={{ width: 10, height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.95)' }} />
        </div>
        <div style={{ display: 'flex', gap: 2 }}>
          <div style={{ flex: '0 0 12px', height: 14, background: '#C7D5EB', borderRadius: 2 }} />
          <div style={{ flex: '0 0 12px', height: 14, background: '#C7D5EB', borderRadius: 2 }} />
          <div style={{ flex: '0 0 12px', height: 14, background: '#C7D5EB', borderRadius: 2 }} />
          <div style={{ flex: '0 0 12px', height: 14, background: '#C7D5EB', borderRadius: 2 }} />
          <div style={{ flex: '0 0 12px', height: 14, background: '#C7D5EB', borderRadius: 2 }} />
        </div>
      </div>
    ),
  },
]

export default function GalleryLayoutPicker({ value, onChange }: GalleryLayoutPickerProps) {
  const { t } = useTranslation('listings')
  return (
    <div
      style={{
        background: '#fff',
        border: `1px solid ${M.border}`,
        borderRadius: 12,
        padding: 16,
      }}
    >
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: M.ink }}>
          {t('editor.gallery.title')}
        </div>
        <div style={{ fontSize: 12, color: M.muted, marginTop: 2 }}>
          {t('editor.gallery.subtitle')}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
        {OPTIONS.map((opt) => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 10,
                borderRadius: 10,
                border: selected ? `2px solid ${M.green}` : `1px solid ${M.border}`,
                background: selected ? '#F5F8FF' : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'border-color 0.15s, background 0.15s',
                outline: 'none',
              }}
              onMouseEnter={(e) => {
                if (!selected) e.currentTarget.style.borderColor = M.muted
              }}
              onMouseLeave={(e) => {
                if (!selected) e.currentTarget.style.borderColor = M.border
              }}
            >
              <div style={{ width: '100%' }}>{opt.mock}</div>
              <div>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: selected ? M.green : M.ink,
                  }}
                >
                  {t(`editor.gallery.layout.${opt.value}.label`)}
                </div>
                <div style={{ fontSize: 11, color: M.muted, marginTop: 2 }}>
                  {t(`editor.gallery.layout.${opt.value}.description`)}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
