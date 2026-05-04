// MEGGA CRM Sugar v2 — Documents left column
// 1:1 port from `crm-documents-sugar-left.jsx`.

import type { SugarPalette } from '../tokens'
import { DocIcon } from './atoms'
import { DOC_PHASES, type DocFolder } from './data'

const FILTERS = [
  { id: 'active', label: 'Actifs' },
  { id: 'all', label: 'Tous' },
  { id: 'archived', label: 'Archivés' },
] as const

export type DocFilterId = (typeof FILTERS)[number]['id']

interface DocLeftColumnProps {
  sp: SugarPalette
  folders: DocFolder[]
  selected: string
  onSelect: (id: string) => void
  filter: DocFilterId
  setFilter: (f: DocFilterId) => void
  query: string
  setQuery: (q: string) => void
}

export function DocLeftColumn({
  sp,
  folders,
  selected,
  onSelect,
  filter,
  setFilter,
  query,
  setQuery,
}: DocLeftColumnProps) {
  const filtered = folders.filter(f => {
    if (filter === 'active' && f.isArchived) return false
    if (filter === 'archived' && !f.isArchived) return false
    if (query) {
      const q = query.toLowerCase()
      return (
        f.title.toLowerCase().includes(q) ||
        f.address.toLowerCase().includes(q) ||
        (f.ref || '').toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <aside
      style={{
        width: 312,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '9px 12px',
          borderRadius: 14,
          background: sp.cardBg,
          border: `1px solid ${sp.cardBorder}`,
          boxShadow: sp.shadowSm,
        }}
      >
        <DocIcon name="search" size={15} color={sp.sub} />
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Rechercher un dossier"
          style={{
            flex: 1,
            border: 'none',
            outline: 'none',
            background: 'transparent',
            color: sp.ink,
            fontSize: 13,
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: 3,
          borderRadius: 999,
          background: sp.iconBtnBg,
          alignSelf: 'flex-start',
        }}
      >
        {FILTERS.map(f => {
          const active = f.id === filter
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                background: active ? sp.ink : 'transparent',
                color: active ? sp.pageBg : sp.soft,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: active ? 700 : 600,
                fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          )
        })}
      </div>

      {/* Folders list */}
      <div
        style={{
          background: sp.cardBg,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 18,
          boxShadow: sp.shadowSm,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            padding: '12px 14px 8px',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: sp.sub,
            }}
          >
            Dossiers
          </div>
          <div style={{ fontSize: 11, color: sp.sub }}>{filtered.length}</div>
        </div>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxHeight: 420,
            overflowY: 'auto',
          }}
        >
          {filtered.map(f => {
            const isSel = f.id === selected
            const phase = DOC_PHASES.find(p => p.id === f.currentPhase)
            const phaseLabel = phase?.label || ''
            return (
              <button
                key={f.id}
                onClick={() => onSelect(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'stretch',
                  gap: 10,
                  padding: '10px 14px',
                  background: isSel ? sp.focusSurface : 'transparent',
                  border: 'none',
                  borderTop: `1px solid ${sp.cardBorder}`,
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background .15s ease',
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: sp.cardSubBg,
                    border: `1px solid ${sp.cardBorder}`,
                    display: 'grid',
                    placeItems: 'center',
                    color: sp.sub,
                  }}
                >
                  <DocIcon name="dossier" size={18} color={sp.sub} />
                </div>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 700,
                        color: sp.ink,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                      }}
                    >
                      {f.title}
                    </div>
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: sp.sub,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {f.ref} · {phaseLabel}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      marginTop: 2,
                    }}
                  >
                    <div
                      style={{
                        flex: 1,
                        height: 3,
                        borderRadius: 2,
                        background: sp.cardSubBg,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.round(f.progress * 100)}%`,
                          height: '100%',
                          background: f.isArchived ? sp.sub : sp.ink,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 10,
                        color: sp.sub,
                        fontVariantNumeric: 'tabular-nums',
                        minWidth: 26,
                        textAlign: 'right',
                      }}
                    >
                      {Math.round(f.progress * 100)}%
                    </div>
                  </div>
                </div>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <div
              style={{
                padding: '22px 14px',
                fontSize: 12,
                color: sp.sub,
                textAlign: 'center',
              }}
            >
              Aucun dossier.
            </div>
          )}
        </div>
      </div>
    </aside>
  )
}
