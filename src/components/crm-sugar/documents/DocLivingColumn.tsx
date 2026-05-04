// MEGGA CRM Sugar v2 — Documents living center column (Hero + AI dropzone + 6 phase rows DnD)
// 1:1 port from `crm-documents-sugar-living.jsx`.

import { useEffect, useRef, useState } from 'react'
import type { SugarPalette } from '../tokens'
import { DocIcon, DocStatusPill } from './atoms'
import {
  DOC_PHASES,
  docFmtDate,
  docFmtPrice,
  type DocFolder,
  type DocItem,
  type DocPhase,
  type DocPhaseId,
} from './data'

interface DocLivingColumnProps {
  folder: DocFolder
  sp: SugarPalette
  selectedDoc: string | null
  onSelectDoc: (id: string) => void
}

export function DocLivingColumn({
  folder,
  sp,
  selectedDoc,
  onSelectDoc,
}: DocLivingColumnProps) {
  const [open, setOpen] = useState<Record<DocPhaseId, boolean>>(() => {
    const init = {} as Record<DocPhaseId, boolean>
    DOC_PHASES.forEach(p => (init[p.id] = p.id === folder.currentPhase))
    return init
  })
  const [localDocs, setLocalDocs] = useState<DocItem[]>(() => folder.docs)
  const [dragging, setDragging] = useState<{
    docId: string
    fromPhase: DocPhaseId
  } | null>(null)

  useEffect(() => {
    const init = {} as Record<DocPhaseId, boolean>
    DOC_PHASES.forEach(p => (init[p.id] = p.id === folder.currentPhase))
    setOpen(init)
    setLocalDocs(folder.docs)
  }, [folder.id, folder.currentPhase, folder.docs])

  const docsByPhase = (phaseId: DocPhaseId) =>
    localDocs.filter(d => d.phase === phaseId)

  const handleDropPhase = (
    docId: string,
    fromPhase: DocPhaseId,
    toPhase: DocPhaseId,
  ) => {
    if (fromPhase === toPhase) return
    setLocalDocs(prev =>
      prev.map(d => (d.id === docId ? { ...d, phase: toPhase } : d)),
    )
    setOpen(o => ({ ...o, [toPhase]: true }))
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <FolderHero folder={folder} sp={sp} />
      <AIDropzone sp={sp} />

      {dragging && (
        <div
          style={{
            padding: '7px 14px',
            borderRadius: 10,
            background: sp.cardSubBg,
            border: `1px solid ${sp.cardBorder}`,
            fontSize: 11.5,
            color: sp.sub,
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <DocIcon name="upload" size={12} color={sp.sub} />
          Glisser vers une autre phase pour déplacer le document
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {DOC_PHASES.map(phase => (
          <PhaseRow
            key={phase.id}
            phase={phase}
            docs={docsByPhase(phase.id)}
            isOpen={!!open[phase.id]}
            onToggle={() => setOpen(o => ({ ...o, [phase.id]: !o[phase.id] }))}
            currentPhase={folder.currentPhase}
            selectedDoc={selectedDoc}
            onSelectDoc={onSelectDoc}
            dragging={dragging}
            onDragStart={setDragging}
            onDragEnd={() => setDragging(null)}
            onDropPhase={handleDropPhase}
            sp={sp}
          />
        ))}
      </div>
    </div>
  )
}

function FolderHero({ folder, sp }: { folder: DocFolder; sp: SugarPalette }) {
  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 22,
        overflow: 'hidden',
        background: sp.cardBg,
        border: `1px solid ${sp.cardBorder}`,
        boxShadow: sp.shadow,
      }}
    >
      <div style={{ display: 'flex', gap: 0 }}>
        {/* Photo placeholder */}
        <div
          style={{
            width: 184,
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
            borderRight: `1px solid ${sp.cardBorder}`,
            background: sp.cardSubBg,
          }}
        >
          <svg
            width="100%"
            height="100%"
            style={{ position: 'absolute', inset: 0 }}
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <pattern
                id="stripes-living"
                patternUnits="userSpaceOnUse"
                width="12"
                height="12"
                patternTransform="rotate(45)"
              >
                <rect width="6" height="12" fill={sp.cardBorder} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#stripes-living)" opacity="0.45" />
          </svg>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={sp.sub}
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span
              style={{
                fontSize: 9,
                color: sp.sub,
                fontWeight: 600,
                letterSpacing: '.06em',
                textTransform: 'uppercase',
              }}
            >
              Photo
            </span>
          </div>
        </div>
        {/* Info */}
        <div
          style={{
            flex: 1,
            padding: '16px 18px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 11,
                  color: sp.sub,
                  letterSpacing: '.08em',
                  textTransform: 'uppercase',
                  marginBottom: 4,
                }}
              >
                {folder.ref} · {folder.type}
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: sp.ink,
                  lineHeight: 1.2,
                }}
              >
                {folder.title}
              </div>
              <div
                style={{
                  fontSize: 12.5,
                  color: sp.soft,
                  marginTop: 4,
                }}
              >
                {folder.address}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div
                style={{
                  fontSize: 20,
                  fontWeight: 700,
                  color: sp.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {folder.isRent ? `${docFmtPrice(folder.price)}/mois` : docFmtPrice(folder.price)}
              </div>
              <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 2 }}>
                {folder.surface} m²
              </div>
            </div>
          </div>

          {folder.tags && folder.tags.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {folder.tags.map((t, i) => (
                <span
                  key={i}
                  style={{
                    padding: '3px 9px',
                    borderRadius: 999,
                    fontSize: 10.5,
                    fontWeight: 600,
                    background: sp.cardSubBg,
                    color: sp.soft,
                    border: `1px solid ${sp.cardBorder}`,
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          )}

          <div
            style={{
              marginTop: 4,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <div
              style={{
                flex: 1,
                height: 5,
                borderRadius: 3,
                background: sp.cardSubBg,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${Math.round(folder.progress * 100)}%`,
                  height: '100%',
                  background: folder.isArchived ? sp.sub : sp.ink,
                }}
              />
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: sp.sub,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {Math.round(folder.progress * 100)}% complet
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function AIDropzone({ sp }: { sp: SugarPalette }) {
  const [hover, setHover] = useState(false)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<{ name: string; type: string } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const processFile = (file: File | undefined) => {
    if (!file) return
    setLoading(true)
    setDone(null)
    setTimeout(() => {
      const name = file.name.replace(/\.[^.]+$/, '')
      const lower = file.name.toLowerCase()
      const type = lower.includes('mandat')
        ? 'Mandat exclusif'
        : lower.includes('compromis') || lower.includes('promesse')
          ? 'Compromis de vente'
          : lower.includes('visite')
            ? 'Bon de visite'
            : lower.includes('estimation')
              ? 'Estimation'
              : lower.includes('offre')
                ? "Offre d'achat"
                : 'Document importé'
      setLoading(false)
      setDone({ name, type })
      setTimeout(() => setDone(null), 3500)
    }, 1400)
  }

  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setHover(true)
      }}
      onDragLeave={() => setHover(false)}
      onDrop={e => {
        e.preventDefault()
        setHover(false)
        processFile(e.dataTransfer.files[0])
      }}
      style={{
        padding: '14px 18px',
        borderRadius: 16,
        background: done ? '#05966910' : hover ? sp.focusSurface : sp.cardSubBg,
        border: `1.5px dashed ${
          done ? '#059669' : hover ? sp.ink : sp.cardBorder
        }`,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        transition: 'all .2s ease',
        cursor: loading ? 'wait' : 'default',
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,.docx,.doc"
        style={{ display: 'none' }}
        onChange={e => {
          processFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          flexShrink: 0,
          background: done ? '#059669' : sp.ink,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'background .3s',
        }}
      >
        {loading ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke={sp.pageBg}
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ animation: 'docSpin 1s linear infinite' }}
          >
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        ) : done ? (
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#fff"
            strokeWidth="2.4"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m5 13 4 4 10-12" />
          </svg>
        ) : (
          <DocIcon name="sparkles" size={16} color={sp.pageBg} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        {loading ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink }}>
              Analyse en cours…
            </div>
            <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 2 }}>
              L'IA détecte le type et la phase
            </div>
          </>
        ) : done ? (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>
              {done.type} détecté
            </div>
            <div
              style={{
                fontSize: 11.5,
                color: sp.sub,
                marginTop: 2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {done.name}
            </div>
          </>
        ) : (
          <>
            <div style={{ fontSize: 13, fontWeight: 700, color: sp.ink }}>
              Glisser un PDF, je classe automatiquement
            </div>
            <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 2 }}>
              L'IA détecte le type, la phase, et propose la signature si nécessaire.
            </div>
          </>
        )}
      </div>
      {!loading && !done && (
        <button
          onClick={() => inputRef.current?.click()}
          style={{
            padding: '7px 13px',
            borderRadius: 999,
            background: sp.cardBg,
            border: `1px solid ${sp.cardBorder}`,
            color: sp.ink,
            fontSize: 12,
            fontWeight: 600,
            fontFamily: 'inherit',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            flexShrink: 0,
          }}
        >
          <DocIcon name="upload" size={13} color={sp.ink} />
          Parcourir
        </button>
      )}
      <style>{`@keyframes docSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

interface PhaseRowProps {
  phase: DocPhase
  docs: DocItem[]
  isOpen: boolean
  onToggle: () => void
  currentPhase: DocPhaseId
  selectedDoc: string | null
  onSelectDoc: (id: string) => void
  dragging: { docId: string; fromPhase: DocPhaseId } | null
  onDragStart: (d: { docId: string; fromPhase: DocPhaseId }) => void
  onDragEnd: () => void
  onDropPhase: (docId: string, fromPhase: DocPhaseId, toPhase: DocPhaseId) => void
  sp: SugarPalette
}

function PhaseRow({
  phase,
  docs,
  isOpen,
  onToggle,
  currentPhase,
  selectedDoc,
  onSelectDoc,
  dragging,
  onDragStart,
  onDragEnd,
  onDropPhase,
  sp,
}: PhaseRowProps) {
  const isCurrent = phase.id === currentPhase
  const total = docs.length
  const signed = docs.filter(d => d.status === 'signed').length
  const missing = docs.filter(d => d.status === 'missing').length
  const draft = docs.filter(d => d.status === 'draft' || d.status === 'pending').length
  const hasMissing = missing > 0
  const [dropHover, setDropHover] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    if (!dragging || dragging.fromPhase === phase.id) return
    e.preventDefault()
    setDropHover(true)
  }
  const handleDragLeave = () => setDropHover(false)
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDropHover(false)
    if (dragging && dragging.fromPhase !== phase.id) {
      onDropPhase(dragging.docId, dragging.fromPhase, phase.id)
    }
  }

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        background: sp.cardBg,
        border: dropHover
          ? `2px solid ${phase.color}`
          : `1px solid ${sp.cardBorder}`,
        borderRadius: 16,
        boxShadow: dropHover
          ? `0 0 0 3px ${phase.color}22, ${sp.shadowSm}`
          : sp.shadowSm,
        overflow: 'hidden',
        transition: 'border-color .15s, box-shadow .15s',
      }}
    >
      {dropHover && (
        <div
          style={{
            padding: '6px 14px',
            background: phase.color + '18',
            fontSize: 11.5,
            fontWeight: 700,
            color: phase.color,
            display: 'flex',
            alignItems: 'center',
            gap: 7,
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke={phase.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          Déplacer vers {phase.label}
        </div>
      )}

      <button
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '12px 16px',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 10,
            flexShrink: 0,
            background: isCurrent ? phase.color : sp.cardSubBg,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: isCurrent ? 'none' : `1px solid ${sp.cardBorder}`,
          }}
        >
          {/* phase icon mapped through DocIcon names */}
          <DocIcon
            name={
              phase.icon === 'file-signature' ? 'file-signature'
                : phase.icon === 'package' ? 'package'
                : phase.icon === 'door-open' ? 'door-open'
                : phase.icon === 'hand-coin' ? 'hand-coin'
                : phase.icon === 'file-check' ? 'file-check'
                : 'award'
            }
            size={15}
            color={isCurrent ? '#fff' : sp.soft}
          />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 700,
                color: sp.ink,
              }}
            >
              {phase.label}
            </div>
            {isCurrent && (
              <span
                style={{
                  padding: '2px 7px',
                  borderRadius: 999,
                  fontSize: 10,
                  fontWeight: 700,
                  background: sp.ink,
                  color: sp.pageBg,
                  letterSpacing: '.04em',
                }}
              >
                EN COURS
              </span>
            )}
          </div>
          <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 2 }}>
            {total} docs · {signed} signés
            {draft > 0 ? ` · ${draft} en cours` : ''}
            {hasMissing ? ` · ${missing} manquants` : ''}
          </div>
        </div>
        <div
          style={{
            width: 56,
            height: 4,
            borderRadius: 2,
            background: sp.cardSubBg,
            overflow: 'hidden',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: total ? `${Math.round((signed / total) * 100)}%` : '0%',
              height: '100%',
              background: phase.color,
            }}
          />
        </div>
        <div
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(90deg)' : 'none',
            transition: 'transform .15s',
          }}
        >
          <DocIcon name="chevron" size={14} color={sp.sub} />
        </div>
      </button>

      {isOpen && (
        <div
          style={{
            borderTop: `1px solid ${sp.cardBorder}`,
            background: sp.cardSubBg,
          }}
        >
          {docs.map((doc, i) => {
            const isSel = doc.id === selectedDoc
            const isMissing = doc.status === 'missing'
            const isDragging = dragging?.docId === doc.id
            return (
              <div
                key={doc.id}
                draggable={!isMissing}
                onDragStart={e => {
                  e.dataTransfer.effectAllowed = 'move'
                  onDragStart({ docId: doc.id, fromPhase: phase.id })
                }}
                onDragEnd={onDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 16px',
                  borderTop: i === 0 ? 'none' : `1px solid ${sp.cardBorder}`,
                  opacity: isDragging ? 0.35 : isMissing ? 0.65 : 1,
                  cursor: isMissing ? 'default' : 'grab',
                  background: isSel ? sp.focusSurface : 'transparent',
                  transition: 'opacity .15s',
                }}
              >
                {!isMissing && (
                  <div
                    style={{
                      color: sp.sub,
                      flexShrink: 0,
                      cursor: 'grab',
                      opacity: 0.5,
                    }}
                  >
                    <svg width="10" height="14" viewBox="0 0 10 14" fill="none">
                      <circle cx="3" cy="2.5" r="1.2" fill="currentColor" />
                      <circle cx="7" cy="2.5" r="1.2" fill="currentColor" />
                      <circle cx="3" cy="7" r="1.2" fill="currentColor" />
                      <circle cx="7" cy="7" r="1.2" fill="currentColor" />
                      <circle cx="3" cy="11.5" r="1.2" fill="currentColor" />
                      <circle cx="7" cy="11.5" r="1.2" fill="currentColor" />
                    </svg>
                  </div>
                )}
                <button
                  onClick={() => !isMissing && onSelectDoc(doc.id)}
                  disabled={isMissing}
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    background: 'transparent',
                    border: 'none',
                    cursor: isMissing ? 'default' : 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    padding: 0,
                  }}
                >
                  <DocIcon
                    name={doc.isMain ? 'file-check' : isMissing ? 'file-plus' : 'file'}
                    size={15}
                    color={isMissing ? sp.sub : sp.ink}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: sp.ink,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {doc.name}
                      {doc.isMain && (
                        <span
                          style={{
                            marginLeft: 8,
                            fontSize: 9.5,
                            fontWeight: 700,
                            letterSpacing: '.06em',
                            padding: '1px 6px',
                            borderRadius: 4,
                            background: sp.ink,
                            color: sp.pageBg,
                          }}
                        >
                          PRINCIPAL
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: sp.sub, marginTop: 2 }}>
                      {doc.date ? docFmtDate(doc.date) : '—'}
                      {doc.size ? ` · ${doc.size}` : ''}
                      {doc.pages ? ` · ${doc.pages}p` : ''}
                    </div>
                  </div>
                  <DocStatusPill status={doc.status} size="sm" />
                </button>
              </div>
            )
          })}
          {docs.length === 0 && (
            <div
              style={{
                padding: '16px 16px',
                fontSize: 12,
                color: dropHover ? phase.color : sp.sub,
                textAlign: 'center',
                fontWeight: dropHover ? 700 : 400,
                transition: 'color .15s',
              }}
            >
              {dropHover ? 'Déposer ici →' : 'Aucun document dans cette phase.'}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

