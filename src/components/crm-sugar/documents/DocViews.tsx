// MEGGA CRM Sugar v2 — Documents Grid + Templates views
// 1:1 port from `crm-documents-sugar-views.jsx`.

import { useState } from 'react'
import type { SugarPalette } from '../tokens'
import { DocIcon, DocStatusPill } from './atoms'
import {
  DOC_PHASES,
  docFmtDate,
  type DocFolder,
  type DocItem,
  type DocTemplate,
} from './data'

interface A4ThumbProps {
  doc: DocItem
  folder: DocFolder
}

function A4Thumb({ doc, folder }: A4ThumbProps) {
  const phase = DOC_PHASES.find(p => p.id === doc.phase)
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '1 / 1.414',
        background: '#FFFFFF',
        borderRadius: 6,
        boxShadow: '0 6px 22px -10px rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 3,
          background: '#0B0C0E',
        }}
      />
      <div
        style={{
          padding: '14px 12px 10px',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              fontSize: 8,
              letterSpacing: '.26em',
              fontWeight: 700,
              color: '#0B0C0E',
            }}
          >
            MEGGA
          </div>
          <div
            style={{
              fontSize: 6.5,
              letterSpacing: '.12em',
              color: '#7A8079',
              textTransform: 'uppercase',
            }}
          >
            {doc.pages || 1}p
          </div>
        </div>
        <div>
          <div
            style={{
              fontSize: 6,
              letterSpacing: '.18em',
              color: '#7A8079',
              textTransform: 'uppercase',
              marginBottom: 3,
            }}
          >
            {phase?.label || ''}
          </div>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              lineHeight: 1.15,
              color: '#0B0C0E',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {doc.name}
          </div>
        </div>
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
        >
          {Array.from({ length: 5 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 2,
                borderRadius: 1,
                background: '#E4E8EE',
                width: i % 2 === 0 ? '85%' : '60%',
              }}
            />
          ))}
        </div>
        <div
          style={{
            borderTop: '1px solid #E4E8EE',
            paddingTop: 4,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ fontSize: 5.5, color: '#7A8079' }}>{folder.ref}</div>
          <div style={{ fontSize: 5.5, color: '#7A8079' }}>Genève</div>
        </div>
      </div>
    </div>
  )
}

interface DocGridViewProps {
  folders: DocFolder[]
  sp: SugarPalette
  onSelectDoc: (folderId: string, docId: string) => void
}

export function DocGridView({ folders, sp, onSelectDoc }: DocGridViewProps) {
  type FilterId = 'all' | 'main' | 'signed' | 'missing'
  const [filter, setFilter] = useState<FilterId>('all')
  const filterOpts: { id: FilterId; label: string }[] = [
    { id: 'all', label: 'Tous' },
    { id: 'main', label: 'Brochures' },
    { id: 'signed', label: 'Signés' },
    { id: 'missing', label: 'Manquants' },
  ]

  const items: { doc: DocItem; folder: DocFolder }[] = []
  folders.forEach(f => f.docs.forEach(d => items.push({ doc: d, folder: f })))
  const filtered = items.filter(({ doc }) => {
    if (filter === 'main') return !!doc.isMain
    if (filter === 'signed') return doc.status === 'signed'
    if (filter === 'missing') return doc.status === 'missing'
    return true
  })

  return (
    <div
      style={{
        background: sp.cardBg,
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 22,
        boxShadow: sp.shadow,
        padding: '18px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: sp.ink }}>
            Tous les documents
          </div>
          <div style={{ fontSize: 12, color: sp.sub, marginTop: 2 }}>
            {filtered.length} sur {items.length} · vue thumbnails A4
          </div>
        </div>
        <div
          style={{
            display: 'inline-flex',
            padding: 3,
            borderRadius: 999,
            background: sp.iconBtnBg,
          }}
        >
          {filterOpts.map(o => {
            const active = o.id === filter
            return (
              <button
                key={o.id}
                onClick={() => setFilter(o.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: 999,
                  background: active ? sp.ink : 'transparent',
                  color: active ? sp.pageBg : sp.soft,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: active ? 700 : 600,
                  fontFamily: 'inherit',
                }}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
        }}
      >
        {filtered.map(({ doc, folder }) => (
          <button
            key={`${folder.id}-${doc.id}`}
            onClick={() => onSelectDoc(folder.id, doc.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              padding: 8,
              borderRadius: 14,
              background: 'transparent',
              border: '1px solid transparent',
              cursor: 'pointer',
              textAlign: 'left',
              fontFamily: 'inherit',
              transition: 'all .15s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = sp.cardSubBg
              e.currentTarget.style.borderColor = sp.cardBorder
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.borderColor = 'transparent'
            }}
          >
            <A4Thumb doc={doc} folder={folder} />
            <div>
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: sp.ink,
                  lineHeight: 1.25,
                  overflow: 'hidden',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                }}
              >
                {doc.name}
              </div>
              <div
                style={{
                  fontSize: 10.5,
                  color: sp.sub,
                  marginTop: 3,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {folder.ref} · {doc.date ? docFmtDate(doc.date) : '—'}
              </div>
              <div style={{ marginTop: 6 }}>
                <DocStatusPill status={doc.status} size="sm" />
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

interface DocTemplatesViewProps {
  templates: DocTemplate[]
  sp: SugarPalette
  onEditTemplate: (template: DocTemplate | null) => void
}

export function DocTemplatesView({
  templates,
  sp,
  onEditTemplate,
}: DocTemplatesViewProps) {
  return (
    <div
      style={{
        background: sp.cardBg,
        border: `1px solid ${sp.cardBorder}`,
        borderRadius: 22,
        boxShadow: sp.shadow,
        padding: '18px 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: sp.ink }}>
            Bibliothèque de modèles
          </div>
          <div style={{ fontSize: 12, color: sp.sub, marginTop: 2 }}>
            Templates suisses — clauses MEGGA standards · variables auto-remplies
          </div>
        </div>
        <button
          onClick={() => onEditTemplate(null)}
          style={{
            padding: '8px 14px',
            borderRadius: 999,
            background: sp.ink,
            color: sp.pageBg,
            border: 'none',
            fontSize: 12,
            fontWeight: 700,
            fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}
        >
          <DocIcon name="plus" size={13} color={sp.pageBg} />
          Nouveau modèle
        </button>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 14,
        }}
      >
        {templates.map(t => (
          <div
            key={t.id}
            style={{
              background: sp.cardSubBg,
              border: `1px solid ${sp.cardBorder}`,
              borderRadius: 14,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
              }}
            >
              <div
                style={{
                  width: 36,
                  height: 44,
                  borderRadius: 4,
                  flexShrink: 0,
                  background: '#FFFFFF',
                  border: '1px solid #E4E8EE',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    height: 2,
                    background: '#0B0C0E',
                    borderRadius: '4px 4px 0 0',
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 7.5,
                    fontWeight: 700,
                    color: '#0B0C0E',
                    letterSpacing: '.18em',
                  }}
                >
                  {t.lang}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: sp.ink,
                    lineHeight: 1.25,
                  }}
                >
                  {t.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: sp.sub,
                    marginTop: 4,
                    lineHeight: 1.4,
                  }}
                >
                  {t.desc}
                </div>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 12,
                flexWrap: 'wrap',
                fontSize: 10.5,
                color: sp.sub,
              }}
            >
              <span>
                <b style={{ color: sp.ink, fontWeight: 700 }}>{t.pages}</b> pages
              </span>
              <span>
                <b style={{ color: sp.ink, fontWeight: 700 }}>{t.vars}</b> variables
              </span>
              <span>
                <b style={{ color: sp.ink, fontWeight: 700 }}>{t.uses}</b> utilisations
              </span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginTop: 4,
                gap: 8,
              }}
            >
              <div style={{ fontSize: 10.5, color: sp.sub }}>
                Dernière utilisation : {docFmtDate(t.lastUsed)}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => onEditTemplate(t)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: sp.cardBg,
                    color: sp.ink,
                    border: `1px solid ${sp.cardBorder}`,
                    fontSize: 11.5,
                    fontWeight: 600,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <DocIcon name="edit" size={11} color={sp.ink} />
                  Modifier
                </button>
                <button
                  style={{
                    padding: '6px 12px',
                    borderRadius: 999,
                    background: sp.ink,
                    color: sp.pageBg,
                    border: 'none',
                    fontSize: 11.5,
                    fontWeight: 700,
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <DocIcon name="sparkles" size={12} color={sp.pageBg} />
                  Utiliser
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
