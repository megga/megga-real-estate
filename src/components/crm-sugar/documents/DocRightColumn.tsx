// MEGGA CRM Sugar v2 — Documents right column (preview + viewer + metadata)
// 1:1 port from `crm-documents-sugar-right.jsx`.

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { SugarPalette } from '../tokens'
import { DocIcon, DocStatusPill } from './atoms'
import {
  DOC_PHASES,
  docFmtDate,
  type DocFolder,
  type DocItem,
} from './data'

interface DocRightColumnProps {
  folder: DocFolder
  doc: DocItem | null
  sp: SugarPalette
}

export function DocRightColumn({ folder, doc, sp }: DocRightColumnProps) {
  const [viewerOpen, setViewerOpen] = useState(false)

  if (!doc) {
    return (
      <aside
        style={{
          width: 332,
          flexShrink: 0,
          background: sp.cardBg,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 18,
          boxShadow: sp.shadowSm,
          padding: '32px 22px',
          textAlign: 'center',
          color: sp.sub,
        }}
      >
        <div style={{ marginBottom: 10 }}>
          <DocIcon name="file" size={28} color={sp.sub} />
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: sp.ink, marginBottom: 4 }}>
          Aucun document sélectionné
        </div>
        <div style={{ fontSize: 11.5, lineHeight: 1.45 }}>
          Cliquez un document dans une phase pour voir son aperçu et ses métadonnées.
        </div>
      </aside>
    )
  }

  const phase = DOC_PHASES.find(p => p.id === doc.phase)

  return (
    <aside
      style={{
        width: 332,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {viewerOpen && (
        <DocViewer doc={doc} folder={folder} onClose={() => setViewerOpen(false)} />
      )}

      {/* Preview card */}
      <div
        style={{
          background: sp.cardBg,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 18,
          boxShadow: sp.shadowSm,
          padding: 16,
        }}
      >
        <div
          onClick={() => setViewerOpen(true)}
          style={{ cursor: 'zoom-in', position: 'relative' }}
        >
          <PreviewA4 doc={doc} folder={folder} />
        </div>

        <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
          <button
            onClick={() => setViewerOpen(true)}
            style={{
              flex: 1,
              padding: '9px 12px',
              borderRadius: 12,
              background: sp.cardSubBg,
              color: sp.ink,
              border: `1px solid ${sp.cardBorder}`,
              fontSize: 12,
              fontWeight: 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <DocIcon name="eye" size={13} color={sp.ink} />
            Aperçu
          </button>
        </div>
      </div>

      {/* Metadata */}
      <div
        style={{
          background: sp.cardBg,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 18,
          boxShadow: sp.shadowSm,
          padding: 14,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 10,
          }}
        >
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              color: sp.ink,
              lineHeight: 1.25,
              paddingRight: 8,
            }}
          >
            {doc.name}
          </div>
          <DocStatusPill status={doc.status} size="sm" />
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'max-content 1fr',
            columnGap: 12,
            rowGap: 7,
            fontSize: 11.5,
          }}
        >
          <span style={{ color: sp.sub }}>Phase</span>
          <span
            style={{
              color: sp.ink,
              fontWeight: 600,
              textAlign: 'right',
            }}
          >
            {phase?.label}
          </span>
          <span style={{ color: sp.sub }}>Date</span>
          <span
            style={{
              color: sp.ink,
              fontWeight: 600,
              textAlign: 'right',
            }}
          >
            {doc.date ? docFmtDate(doc.date) : '—'}
          </span>
          {doc.expires && (
            <>
              <span style={{ color: sp.sub }}>Expire</span>
              <span
                style={{
                  color: sp.ink,
                  fontWeight: 600,
                  textAlign: 'right',
                }}
              >
                {docFmtDate(doc.expires)}
              </span>
            </>
          )}
          {doc.pages && (
            <>
              <span style={{ color: sp.sub }}>Pages</span>
              <span
                style={{
                  color: sp.ink,
                  fontWeight: 600,
                  textAlign: 'right',
                }}
              >
                {doc.pages}
              </span>
            </>
          )}
          {doc.size && (
            <>
              <span style={{ color: sp.sub }}>Taille</span>
              <span
                style={{
                  color: sp.ink,
                  fontWeight: 600,
                  textAlign: 'right',
                }}
              >
                {doc.size}
              </span>
            </>
          )}
          {doc.signers && doc.signers.length > 0 && (
            <>
              <span style={{ color: sp.sub }}>Signataires</span>
              <span
                style={{
                  color: sp.ink,
                  fontWeight: 600,
                  textAlign: 'right',
                }}
              >
                {doc.signers.join(' + ')}
              </span>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

function PreviewA4({ doc, folder }: { doc: DocItem; folder: DocFolder }) {
  const phase = DOC_PHASES.find(p => p.id === doc.phase)
  return (
    <div
      style={{
        position: 'relative',
        aspectRatio: '1 / 1.414',
        background: '#FFFFFF',
        borderRadius: 8,
        boxShadow: '0 8px 28px -10px rgba(0,0,0,.18), 0 1px 2px rgba(0,0,0,.08)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 4,
          background: '#0B0C0E',
        }}
      />
      <div
        style={{
          padding: '18px 18px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          height: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontFamily: 'Helvetica, Arial, sans-serif',
              fontSize: 9,
              letterSpacing: '.26em',
              fontWeight: 700,
              color: '#0B0C0E',
            }}
          >
            MEGGA
          </div>
          <div
            style={{
              fontSize: 7,
              letterSpacing: '.12em',
              color: '#7A8079',
              textTransform: 'uppercase',
            }}
          >
            p.1/{doc.pages || 1}
          </div>
        </div>
        <div style={{ marginTop: 4 }}>
          <div
            style={{
              fontSize: 7,
              letterSpacing: '.18em',
              color: '#7A8079',
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {phase?.label}
          </div>
          <div
            style={{
              fontSize: 13,
              fontWeight: 700,
              lineHeight: 1.15,
              color: '#0B0C0E',
            }}
          >
            {doc.name}
          </div>
          <div
            style={{
              fontSize: 8.5,
              color: '#7A8079',
              marginTop: 4,
            }}
          >
            {folder.title}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            flex: 1,
          }}
        >
          {Array.from({ length: 9 }).map((_, i) => (
            <div
              key={i}
              style={{
                height: 3,
                borderRadius: 1.5,
                background: i % 4 === 3 ? 'transparent' : '#E4E8EE',
                width: i % 3 === 0 ? '65%' : i % 3 === 1 ? '92%' : '78%',
              }}
            />
          ))}
        </div>
        <div
          style={{
            borderTop: '1px solid #E4E8EE',
            paddingTop: 6,
            display: 'flex',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: 6.5,
              color: '#7A8079',
              letterSpacing: '.08em',
            }}
          >
            {folder.ref}
          </div>
          <div style={{ fontSize: 6.5, color: '#7A8079' }}>MEGGA · Genève</div>
        </div>
      </div>
      {(doc.status === 'draft' || doc.status === 'missing') && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'rgba(11,12,14,.06)',
            fontSize: 38,
            fontWeight: 800,
            letterSpacing: '.25em',
            transform: 'rotate(-22deg)',
            pointerEvents: 'none',
          }}
        >
          {doc.status === 'draft' ? 'BROUILLON' : 'MANQUANT'}
        </div>
      )}
    </div>
  )
}

interface DocViewerProps {
  doc: DocItem
  folder: DocFolder
  onClose: () => void
}

function DocViewer({ doc, folder, onClose }: DocViewerProps) {
  const totalPages = doc.pages || 3
  const [page, setPage] = useState(1)
  const [zoom, setZoom] = useState(1)
  const phase = DOC_PHASES.find(p => p.id === doc.phase)

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown')
        setPage(p => Math.min(totalPages, p + 1))
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
        setPage(p => Math.max(1, p - 1))
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [totalPages, onClose])

  const w = Math.round(595 * zoom)

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(11,12,14,.76)',
        backdropFilter: 'blur(10px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        fontFamily: 'inherit',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '9px 16px',
          margin: '18px 0 14px',
          background: '#FFFFFF',
          borderRadius: 999,
          boxShadow: '0 12px 40px rgba(0,0,0,.22), 0 2px 8px rgba(0,0,0,.12)',
          flexShrink: 0,
          flexWrap: 'wrap',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: '#0B0C0E',
            maxWidth: 220,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {doc.name}
        </div>
        <div style={{ width: 1, height: 18, background: '#E4E8EE' }} />
        <button
          onClick={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: 0,
            background: page === 1 ? 'transparent' : '#F4F6FA',
            cursor: page === 1 ? 'not-allowed' : 'pointer',
            display: 'grid',
            placeItems: 'center',
            opacity: page === 1 ? 0.35 : 1,
          }}
        >
          <DocIcon name="arrowL" size={12} color="#0B0C0E" />
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#0B0C0E',
            minWidth: 44,
            textAlign: 'center',
          }}
        >
          {page} / {totalPages}
        </span>
        <button
          onClick={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: 0,
            background: page === totalPages ? 'transparent' : '#F4F6FA',
            cursor: page === totalPages ? 'not-allowed' : 'pointer',
            display: 'grid',
            placeItems: 'center',
            opacity: page === totalPages ? 0.35 : 1,
          }}
        >
          <DocIcon name="arrowR" size={12} color="#0B0C0E" />
        </button>
        <div style={{ width: 1, height: 18, background: '#E4E8EE' }} />
        <button
          onClick={() =>
            setZoom(z => Math.max(0.5, Math.round((z - 0.25) * 100) / 100))
          }
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: 0,
            background: '#F4F6FA',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          −
        </button>
        <span
          style={{
            fontSize: 12,
            fontWeight: 700,
            color: '#0B0C0E',
            minWidth: 34,
            textAlign: 'center',
          }}
        >
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={() => setZoom(z => Math.min(2, Math.round((z + 0.25) * 100) / 100))}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: 0,
            background: '#F4F6FA',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          +
        </button>
        <div style={{ width: 1, height: 18, background: '#E4E8EE' }} />
        <button
          onClick={onClose}
          style={{
            width: 28,
            height: 28,
            borderRadius: 999,
            border: 0,
            background: '#F4F6FA',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <DocIcon name="x" size={12} color="#0B0C0E" />
        </button>
      </div>

      {/* Page A4 */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '0 24px 32px',
          width: '100%',
        }}
      >
        <div
          style={{
            width: w,
            background: '#FFFFFF',
            borderRadius: 4,
            flexShrink: 0,
            boxShadow: '0 32px 80px -20px rgba(0,0,0,.5), 0 4px 12px rgba(0,0,0,.15)',
            overflow: 'hidden',
            position: 'relative',
            transition: 'width .2s',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: '0 0 auto 0',
              height: 5,
              background: '#0B0C0E',
            }}
          />
          <div
            style={{
              padding: `${28 * zoom}px ${32 * zoom}px`,
              display: 'flex',
              flexDirection: 'column',
              gap: 16 * zoom,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                marginTop: 6 * zoom,
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: 8 * zoom,
                    letterSpacing: '.28em',
                    color: '#7A8079',
                    textTransform: 'uppercase',
                    marginBottom: 5 * zoom,
                    fontWeight: 700,
                  }}
                >
                  {phase?.label}
                </div>
                <div
                  style={{
                    fontSize: 18 * zoom,
                    fontWeight: 800,
                    color: '#0B0C0E',
                    lineHeight: 1.15,
                    letterSpacing: '-0.4px',
                  }}
                >
                  {doc.name}
                </div>
                <div
                  style={{
                    fontSize: 10 * zoom,
                    color: '#7A8079',
                    marginTop: 5 * zoom,
                  }}
                >
                  {folder.title} · {folder.address}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: 'Helvetica, Arial, sans-serif',
                    fontSize: 11 * zoom,
                    letterSpacing: '.3em',
                    fontWeight: 800,
                    color: '#0B0C0E',
                  }}
                >
                  MEGGA
                </div>
                <div
                  style={{
                    fontSize: 8 * zoom,
                    color: '#7A8079',
                    marginTop: 3 * zoom,
                  }}
                >
                  Page {page}/{totalPages}
                </div>
              </div>
            </div>

            <div style={{ height: 1, background: '#E4E8EE' }} />

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10 * zoom,
              }}
            >
              {page === 1 && (
                <div>
                  <div
                    style={{
                      height: 8 * zoom,
                      borderRadius: 2,
                      background: '#0B0C0E',
                      width: '45%',
                      marginBottom: 10 * zoom,
                    }}
                  />
                  {[92, 78, 100, 65, 88, 55].map((ww, i) => (
                    <div
                      key={i}
                      style={{
                        height: 5 * zoom,
                        borderRadius: 2,
                        background: '#E4E8EE',
                        width: ww + '%',
                        marginBottom: 5 * zoom,
                      }}
                    />
                  ))}
                </div>
              )}
              {Array.from({ length: page === 1 ? 3 : 5 }).map((_, si) => (
                <div key={si}>
                  <div
                    style={{
                      height: 6 * zoom,
                      borderRadius: 2,
                      background: '#D0D4DC',
                      width: '38%',
                      marginBottom: 8 * zoom,
                    }}
                  />
                  {[100, 85, 100, 72, 90, 60].slice(0, 4 + (si % 2)).map((ww, i) => (
                    <div
                      key={i}
                      style={{
                        height: 4.5 * zoom,
                        borderRadius: 2,
                        background: '#ECEEF2',
                        width: ww + '%',
                        marginBottom: 4.5 * zoom,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>

            {doc.signers && doc.signers.length > 0 && page === totalPages && (
              <div
                style={{
                  display: 'flex',
                  gap: 24 * zoom,
                  marginTop: 20 * zoom,
                  paddingTop: 14 * zoom,
                  borderTop: '1px solid #E4E8EE',
                }}
              >
                {doc.signers.map((sig, i) => (
                  <div key={i} style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: 7.5 * zoom,
                        color: '#7A8079',
                        marginBottom: 6 * zoom,
                        textTransform: 'uppercase',
                        letterSpacing: '.1em',
                      }}
                    >
                      Signature — {sig}
                    </div>
                    <div
                      style={{
                        height: 1,
                        background: '#D0D4DC',
                        width: '80%',
                        marginBottom: 4 * zoom,
                      }}
                    />
                    <div style={{ fontSize: 7 * zoom, color: '#B5BAC2' }}>Date :</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {doc.status === 'draft' && (
            <div
              style={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgba(11,12,14,.05)',
                fontSize: 52 * zoom,
                fontWeight: 900,
                letterSpacing: '.25em',
                transform: 'rotate(-22deg)',
                pointerEvents: 'none',
                userSelect: 'none',
              }}
            >
              BROUILLON
            </div>
          )}

          <div
            style={{
              padding: `${8 * zoom}px ${32 * zoom}px`,
              borderTop: '1px solid #ECEEF2',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div
              style={{
                fontSize: 6.5 * zoom,
                color: '#B5BAC2',
                letterSpacing: '.08em',
              }}
            >
              {folder.ref}
            </div>
            <div style={{ fontSize: 6.5 * zoom, color: '#B5BAC2' }}>
              MEGGA Real Estate · Genève
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
