// MEGGA CRM Sugar v2 Wizard — Step 4 : Photos
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step4.jsx).
// 3 modes : ordinateur (dropzone), téléphone (QR géant), drive (connectors).

import { useState, useRef, useMemo, type ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { SugarV2, shade, sgOn, sgAcc, type WizardData, type WizardPhoto } from '../tokens'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

const STOCK: WizardPhoto[] = [
  { id: 'p1', label: 'Salon',         kind: 'interior', tone: '#D4DDE3' },
  { id: 'p2', label: 'Cuisine',       kind: 'interior', tone: '#E2D8C8' },
  { id: 'p3', label: 'Chambre',       kind: 'interior', tone: '#D8DCE3' },
  { id: 'p4', label: 'Salle de bain', kind: 'interior', tone: '#CFD7D9' },
  { id: 'p5', label: 'Façade',        kind: 'exterior', tone: '#C8D2DA' },
  { id: 'p6', label: 'Jardin',        kind: 'exterior', tone: '#CDD6CC' },
  { id: 'p7', label: 'Vue',           kind: 'exterior', tone: '#BDCAD3' },
  { id: 'p8', label: 'Plan',          kind: 'plan',     tone: '#EAEAEA' },
]

// Formats acceptés côté upload (useUploadPropertyPhotos refuse le reste) + plafond
// aligné sur le texte de la dropzone.
const ACCEPTED_PHOTO_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_WIZARD_PHOTOS = 30

export function Step4Photos({ data, set }: StepProps) {
  const { t: tr } = useTranslation('listings')
  const photos = data.photos || []
  const [mode, setMode] = useState<'pc' | 'mobile' | 'drive'>('pc')
  const [dragOver, setDragOver] = useState(false)
  const [hoverPhoto, setHoverPhoto] = useState<string | null>(null)
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addStock = (n = 1) => {
    const taken = photos.length
    const next = STOCK.slice(taken, taken + n).map((p, i) => ({
      ...p, id: `${p.id}-${Date.now()}-${i}`,
      uploadedAt: new Date().toISOString(),
    }))
    set({ photos: [...photos, ...next] })
  }

  // Dropzone PC = SEUL chemin qui porte de vrais fichiers. On les capture pour de
  // bon (object URL d'aperçu + File conservé jusqu'à la publication où il est
  // uploadé bucket + miroir R2). Les modes téléphone (QR) et drive restent
  // simulés (addStock) faute de backend de transfert — leurs tuiles, sans `file`,
  // ne sont jamais persistées.
  const handleFiles = (files: FileList | null) => {
    if (!files || !files.length) return
    const room = Math.max(0, MAX_WIZARD_PHOTOS - photos.length)
    if (room <= 0) return
    const accepted = Array.from(files)
      .filter(f => ACCEPTED_PHOTO_MIME.includes(f.type))
      .slice(0, room)
    if (!accepted.length) return
    const mapped: WizardPhoto[] = accepted.map((file, i) => ({
      id: `up-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
      label: file.name.replace(/\.[^.]+$/, ''),
      kind: 'interior',
      tone: '#D4DDE3',
      uploadedAt: new Date().toISOString(),
      file,
      previewUrl: URL.createObjectURL(file),
    }))
    set({ photos: [...photos, ...mapped] })
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }

  const onPhotoDrop = (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault()
    if (draggedIdx == null || draggedIdx === targetIdx) {
      setDraggedIdx(null); setOverIdx(null); return
    }
    const next = [...photos]
    const [moved] = next.splice(draggedIdx, 1)
    next.splice(targetIdx, 0, moved)
    set({ photos: next })
    setDraggedIdx(null); setOverIdx(null)
  }

  const removePhoto = (id: string) => {
    const gone = photos.find(p => p.id === id)
    if (gone?.previewUrl) URL.revokeObjectURL(gone.previewUrl)
    set({ photos: photos.filter(p => p.id !== id) })
  }
  const clearPhotos = () => {
    photos.forEach(p => { if (p.previewUrl) URL.revokeObjectURL(p.previewUrl) })
    set({ photos: [] })
  }
  const setCover = (id: string) => {
    const idx = photos.findIndex(p => p.id === id)
    if (idx <= 0) return
    const next = [...photos]
    const [moved] = next.splice(idx, 1)
    next.unshift(moved)
    set({ photos: next })
  }

  const quality = computeQuality(photos, tr)

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      <div style={{ marginBottom: 36, maxWidth: 760 }}>
        <div style={{
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{tr('wizard.step4.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{tr('wizard.step4.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          <Trans
            t={tr}
            i18nKey="wizard.step4.intro"
            components={{ strong: <strong style={{ color: SugarV2.ink }} /> }}
          />
        </p>
      </div>

      {/* Mode picker */}
      <div style={{
        display: 'inline-flex', padding: 5, borderRadius: 999,
        background: SugarV2.card, boxShadow: SugarV2.shadowSm, marginBottom: 24,
      }}>
        {[
          { v: 'pc' as const,     label: tr('wizard.step4.mode.pc'),     icon: 'computer' as const },
          { v: 'mobile' as const, label: tr('wizard.step4.mode.mobile'), icon: 'phone' as const },
          { v: 'drive' as const,  label: tr('wizard.step4.mode.drive'),  icon: 'cloud' as const },
        ].map(m => {
          const sel = mode === m.v
          return (
            <button key={m.v} onClick={() => setMode(m.v)} style={{
              height: 38, padding: '0 18px', borderRadius: 999, border: 0,
              background: sel ? SugarV2.black : 'transparent',
              color: sel ? sgOn() : SugarV2.inkSoft,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, letterSpacing: 0.1,
              cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 8,
              boxShadow: sel ? '0 6px 14px rgba(0,0,0,0.22)' : 'none',
              transition: 'all .2s ease',
            }}>
              <PhotoIcon name={m.icon} size={16} stroke={sel ? sgOn() : SugarV2.inkSoft} />
              {m.label}
            </button>
          )
        })}
      </div>

      {/* MODE PC */}
      {mode === 'pc' && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          style={{
            background: SugarV2.card, borderRadius: 28,
            padding: '56px 32px',
            boxShadow: dragOver ? SugarV2.shadowHover : SugarV2.shadow,
            cursor: 'pointer',
            transform: dragOver ? 'translateY(-2px) scale(1.005)' : 'translateY(0)',
            transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18,
            position: 'relative', overflow: 'hidden',
          }}>
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: dragOver
              ? 'radial-gradient(circle at 50% 50%, rgba(0,0,0,0.04) 0%, transparent 60%)'
              : 'transparent',
            transition: 'background .3s',
          }} />
          <div style={{
            width: 88, height: 88, borderRadius: 28,
            background: dragOver ? SugarV2.black : SugarV2.cardSubtle,
            color: dragOver ? sgOn() : SugarV2.black,
            display: 'grid', placeItems: 'center',
            transition: 'all .25s ease',
            boxShadow: dragOver ? '0 16px 36px rgba(0,0,0,0.25)' : 'none',
            transform: dragOver ? 'scale(1.05)' : 'scale(1)',
          }}>
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 16V4M12 4l-5 5M12 4l5 5"/>
              <path d="M4 16v3a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-3"/>
            </svg>
          </div>

          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.4, marginBottom: 6 }}>
              {dragOver ? tr('wizard.step4.dropzone.titleActive') : tr('wizard.step4.dropzone.title')}
            </div>
            <div style={{ fontSize: 14, color: SugarV2.inkSoft, fontWeight: 500 }}>
              <Trans
                t={tr}
                i18nKey="wizard.step4.dropzone.browse"
                components={{ browse: <span style={{ color: SugarV2.black, fontWeight: 700, textDecoration: 'underline' }} /> }}
              />
            </div>
          </div>

          <div style={{
            display: 'flex', gap: 16, marginTop: 4, flexWrap: 'wrap', justifyContent: 'center',
          }}>
            {['JPG · PNG · HEIC', tr('wizard.step4.dropzone.maxPhotos', { count: 30 }), tr('wizard.step4.dropzone.maxSize', { size: 20 })].map(s => (
              <div key={s} style={{
                padding: '6px 12px', borderRadius: 999,
                background: SugarV2.cardSubtle,
                fontSize: 11.5, fontWeight: 600, color: SugarV2.inkSoft, letterSpacing: 0.1,
              }}>{s}</div>
            ))}
          </div>

          <input ref={fileInputRef} type="file" multiple accept="image/*"
            onChange={e => handleFiles(e.target.files)}
            style={{ display: 'none' }} />
        </div>
      )}

      {/* MODE MOBILE */}
      {mode === 'mobile' && <SgPhoneTransfer addStock={addStock} />}

      {/* MODE DRIVE */}
      {mode === 'drive' && <SgDriveConnect addStock={addStock} />}

      {/* Grille de photos */}
      <div style={{ marginTop: 36 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h2 style={{
            margin: 0, fontSize: 18, fontWeight: 700,
            color: SugarV2.ink, letterSpacing: -0.3,
          }}>
            {photos.length === 0 ? tr('wizard.step4.grid.empty') : tr('wizard.step4.grid.count', { count: photos.length })}
            {photos.length > 0 && (
              <span style={{ color: SugarV2.muted, fontWeight: 500, marginLeft: 8 }}>
                {tr('wizard.step4.grid.reorderHint')}
              </span>
            )}
          </h2>
          {photos.length > 0 && (
            <button onClick={clearPhotos} style={{
              border: 0, background: 'transparent', color: SugarV2.muted,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', padding: '6px 12px', borderRadius: 8,
            }}>{tr('wizard.step4.grid.clearAll')}</button>
          )}
        </div>

        {photos.length === 0 ? (
          <div style={{
            background: SugarV2.card, borderRadius: 22,
            padding: '48px 28px',
            boxShadow: SugarV2.shadowSm,
            textAlign: 'center', color: SugarV2.muted, fontSize: 14, fontWeight: 500,
          }}>
            {tr('wizard.step4.grid.emptyHint')}
          </div>
        ) : (
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14,
          }}>
            {photos.map((p, idx) => {
              const isCover = idx === 0
              const isHover = hoverPhoto === p.id
              const isDragOver = overIdx === idx && draggedIdx !== idx
              return (
                <div key={p.id}
                  draggable
                  onDragStart={() => setDraggedIdx(idx)}
                  onDragOver={e => { e.preventDefault(); setOverIdx(idx) }}
                  onDragLeave={() => setOverIdx(null)}
                  onDrop={e => onPhotoDrop(e, idx)}
                  onMouseEnter={() => setHoverPhoto(p.id)}
                  onMouseLeave={() => setHoverPhoto(null)}
                  style={{
                    position: 'relative',
                    aspectRatio: '4 / 3', borderRadius: 22,
                    background: SugarV2.card,
                    boxShadow: isHover ? SugarV2.shadowHover : SugarV2.shadow,
                    overflow: 'hidden',
                    cursor: draggedIdx === idx ? 'grabbing' : 'grab',
                    transition: 'all .2s cubic-bezier(.2,.8,.2,1)',
                    transform: isDragOver
                      ? 'translateY(-4px) scale(1.02)'
                      : (isHover ? 'translateY(-2px)' : 'translateY(0)'),
                    opacity: draggedIdx === idx ? 0.45 : 1,
                    outline: isDragOver ? `3px solid ${SugarV2.black}` : 'none',
                    outlineOffset: -3,
                  }}>
                  <FakePhoto p={p} />

                  {isCover && (
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      padding: '5px 11px', borderRadius: 999,
                      background: SugarV2.black, color: sgOn(),
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                      textTransform: 'uppercase',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.30)',
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                    }}>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill={sgOn()}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
                      </svg>
                      {tr('wizard.step4.cover')}
                    </div>
                  )}
                  {!isCover && (
                    <div style={{
                      position: 'absolute', top: 10, left: 10,
                      width: 24, height: 24, borderRadius: 999,
                      background: sgAcc(0.92), color: SugarV2.ink,
                      fontSize: 11, fontWeight: 700,
                      display: 'grid', placeItems: 'center',
                      boxShadow: '0 4px 10px rgba(0,0,0,0.12)',
                    }}>{idx + 1}</div>
                  )}

                  <div style={{
                    position: 'absolute', inset: 0,
                    background: isHover
                      ? 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55) 100%)'
                      : 'transparent',
                    opacity: isHover ? 1 : 0,
                    transition: 'opacity .2s ease',
                    display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
                    padding: 10, gap: 6,
                    pointerEvents: isHover ? 'auto' : 'none',
                  }}>
                    {!isCover && (
                      <button onClick={e => { e.stopPropagation(); setCover(p.id) }}
                        title={tr('wizard.step4.action.setCover')}
                        style={{
                          width: 32, height: 32, borderRadius: 999, border: 0,
                          background: sgAcc(0.95), color: SugarV2.ink,
                          cursor: 'pointer', display: 'grid', placeItems: 'center',
                          boxShadow: '0 6px 14px rgba(0,0,0,0.20)',
                        }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
                        </svg>
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); removePhoto(p.id) }}
                      title={tr('common:actions.delete')}
                      style={{
                        width: 32, height: 32, borderRadius: 999, border: 0,
                        background: sgAcc(0.95), color: SugarV2.err,
                        cursor: 'pointer', display: 'grid', placeItems: 'center',
                        boxShadow: '0 6px 14px rgba(0,0,0,0.20)',
                      }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                      </svg>
                    </button>
                  </div>

                  <div style={{
                    position: 'absolute', bottom: 10, left: 10,
                    padding: '4px 10px', borderRadius: 999,
                    background: sgAcc(0.92),
                    fontSize: 10.5, fontWeight: 600, color: SugarV2.ink,
                    letterSpacing: 0.2,
                    opacity: isHover ? 0 : 1,
                    transition: 'opacity .2s',
                  }}>{p.id.length === 2 && p.id[0] === 'p' ? tr('wizard.staging.stock.' + p.id) : p.label}</div>
                </div>
              )
            })}

            <button onClick={() => fileInputRef.current?.click()}
              style={{
                aspectRatio: '4 / 3', borderRadius: 22, border: 0,
                background: SugarV2.cardSubtle, color: SugarV2.muted,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                fontSize: 13, fontWeight: 600,
                transition: 'all .2s ease',
                boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.06)',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = SugarV2.card
                e.currentTarget.style.color = SugarV2.ink
                e.currentTarget.style.boxShadow = SugarV2.shadow
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = SugarV2.cardSubtle
                e.currentTarget.style.color = SugarV2.muted
                e.currentTarget.style.boxShadow = 'inset 0 0 0 2px rgba(0,0,0,0.06)'
              }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              {tr('common:actions.add')}
            </button>
          </div>
        )}
      </div>

      {/* AI Quality bar */}
      {photos.length > 0 && (
        <div style={{
          marginTop: 32,
          background: SugarV2.card, borderRadius: 22, padding: '20px 24px',
          boxShadow: SugarV2.shadow,
          display: 'flex', alignItems: 'center', gap: 18,
          animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: quality.bg, color: quality.color,
            display: 'grid', placeItems: 'center', flexShrink: 0,
            boxShadow: `0 8px 20px ${quality.color}22`,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: SugarV2.muted, letterSpacing: 1, textTransform: 'uppercase' }}>
                {tr('wizard.step4.quality.eyebrow')}
              </span>
              <span style={{ fontSize: 12, fontWeight: 700, color: quality.color, letterSpacing: -0.1 }}>
                {quality.label}
              </span>
            </div>
            <div style={{ fontSize: 14, color: SugarV2.ink, fontWeight: 600, letterSpacing: -0.2, marginBottom: 10 }}>
              {quality.message}
            </div>
            <div style={{ height: 6, borderRadius: 999, background: SugarV2.cardSubtle, overflow: 'hidden' }}>
              <div style={{
                height: '100%', width: `${quality.score}%`,
                background: quality.color, borderRadius: 999,
                transition: 'width .6s cubic-bezier(.2,.8,.2,1)',
              }} />
            </div>
          </div>
          {quality.suggestions.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0, maxWidth: 280 }}>
              {quality.suggestions.slice(0, 2).map((s, i) => (
                <div key={i} style={{
                  fontSize: 11.5, color: SugarV2.inkSoft, fontWeight: 500,
                  display: 'flex', alignItems: 'flex-start', gap: 6,
                }}>
                  <span style={{ color: SugarV2.muted, flexShrink: 0 }}>·</span>
                  {s}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

    </div>
  )
}

// ─── Mode Phone (QR) ───────────────────────────────────────────────────
function SgPhoneTransfer({ addStock }: { addStock: (n?: number) => void }) {
  const { t: tr } = useTranslation('listings')
  const [pulse, setPulse] = useState(false)
  const [phase, setPhase] = useState<'waiting' | 'connected' | 'receiving'>('waiting')

  const simulateConnect = () => {
    setPhase('connected')
    setTimeout(() => setPhase('receiving'), 1200)
    setTimeout(() => { addStock(2); setPulse(true); setTimeout(() => setPulse(false), 800) }, 2400)
    setTimeout(() => { addStock(2); setPulse(true); setTimeout(() => setPulse(false), 800) }, 3800)
    setTimeout(() => setPhase('connected'), 5200)
  }

  return (
    <div style={{
      background: SugarV2.card, borderRadius: 28, padding: 36,
      boxShadow: SugarV2.shadow,
      display: 'grid', gridTemplateColumns: '260px 1fr', gap: 36,
      alignItems: 'center',
    }}>
      <div style={{
        background: SugarV2.cardSubtle, borderRadius: 22,
        padding: 22,
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14,
      }}>
        <FakeQR pulse={pulse} />
        <div style={{
          fontSize: 11, fontWeight: 700, color: SugarV2.muted,
          letterSpacing: 1, textTransform: 'uppercase',
        }}>{tr('wizard.step4.phone.uniqueCode')}</div>
        <div style={{
          fontSize: 13, fontWeight: 700, color: SugarV2.ink, letterSpacing: 1,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          padding: '4px 10px', borderRadius: 8,
          background: SugarV2.card,
        }}>
          {/* Code d'appairage d'exemple (démo) — hors catalogue i18n. */}
          {'MGA-7K2P-9X'}
        </div>
      </div>

      <div>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '5px 11px', borderRadius: 999,
          background: phase === 'waiting' ? SugarV2.cardSubtle : 'rgba(16,185,129,0.10)',
          color: phase === 'waiting' ? SugarV2.muted : SugarV2.ok,
          fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
          marginBottom: 14,
        }}>
          <span style={{
            width: 7, height: 7, borderRadius: 999,
            background: phase === 'waiting' ? SugarV2.muted : SugarV2.ok,
            animation: phase !== 'waiting' ? 'sgPulse 1.4s ease-in-out infinite' : 'none',
          }} />
          {phase === 'waiting' && tr('wizard.step4.phone.phase.waiting')}
          {phase === 'connected' && tr('wizard.step4.phone.phase.connected')}
          {phase === 'receiving' && tr('wizard.step4.phone.phase.receiving')}
        </div>

        <h3 style={{
          margin: '0 0 10px', fontSize: 24, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.5, lineHeight: 1.2,
        }}>{tr('wizard.step4.phone.title')}</h3>
        <p style={{ margin: '0 0 22px', fontSize: 14, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55, maxWidth: 480 }}>
          {tr('wizard.step4.phone.intro')}
        </p>

        <ol style={{
          margin: '0 0 24px', padding: 0, listStyle: 'none',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {[
            tr('wizard.step4.phone.step1'),
            tr('wizard.step4.phone.step2'),
            tr('wizard.step4.phone.step3'),
          ].map((t, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              fontSize: 13.5, color: SugarV2.inkSoft, fontWeight: 500,
            }}>
              <span style={{
                width: 22, height: 22, borderRadius: 999,
                background: SugarV2.cardSubtle, color: SugarV2.ink,
                fontSize: 11, fontWeight: 700,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>{i + 1}</span>
              {t}
            </li>
          ))}
        </ol>

        <button onClick={simulateConnect} disabled={phase !== 'waiting'}
          style={{
            height: 42, padding: '0 18px', borderRadius: 999, border: 0,
            background: phase === 'waiting' ? SugarV2.black : SugarV2.cardSubtle,
            color: phase === 'waiting' ? sgOn() : SugarV2.muted,
            fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
            cursor: phase === 'waiting' ? 'pointer' : 'not-allowed',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: phase === 'waiting' ? '0 6px 16px rgba(0,0,0,0.18)' : 'none',
            transition: 'all .2s ease',
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
          {phase === 'waiting' ? tr('wizard.step4.phone.simulate') : tr('wizard.step4.phone.connected')}
        </button>
      </div>
    </div>
  )
}

// ─── Mode Drive ────────────────────────────────────────────────────────
function SgDriveConnect({ addStock }: { addStock: (n?: number) => void }) {
  const { t: tr } = useTranslation('listings')
  const [connecting, setConnecting] = useState<string | null>(null)

  const SERVICES: { v: string; label: string; color: string; icon: ReactNode }[] = [
    { v: 'gdrive',   label: 'Google Drive', color: '#1A73E8',
      icon: <svg width="28" height="28" viewBox="0 0 87.3 78" fill="none">
        <path d="M6.6 66.85L10.45 73.5C11.25 74.9 12.4 76 13.75 76.8L27.5 53H0C0 54.55 0.4 56.1 1.2 57.5L6.6 66.85Z" fill="#0066DA"/>
        <path d="M43.65 25L29.9 1.2C28.55 2 27.4 3.1 26.6 4.5L1.2 48.5C0.413 49.866 -0.001 51.42 0 53H27.5L43.65 25Z" fill="#00AC47"/>
        <path d="M73.55 76.8C74.9 76 76.05 74.9 76.85 73.5L78.45 70.75L86.1 57.5C86.9 56.1 87.3 54.55 87.3 53H59.799L65.65 64.5L73.55 76.8Z" fill="#EA4335"/>
        <path d="M43.65 25L57.4 1.2C56.05 0.4 54.5 0 52.9 0H34.4C32.8 0 31.25 0.45 29.9 1.2L43.65 25Z" fill="#00832D"/>
        <path d="M59.8 53H27.5L13.75 76.8C15.1 77.6 16.65 78 18.25 78H69.05C70.65 78 72.2 77.55 73.55 76.8L59.8 53Z" fill="#2684FC"/>
        <path d="M73.4 26.5L60.7 4.5C59.9 3.1 58.75 2 57.4 1.2L43.65 25L59.8 53H87.25C87.25 51.45 86.85 49.9 86.05 48.5L73.4 26.5Z" fill="#FFBA00"/>
      </svg> },
    { v: 'dropbox', label: 'Dropbox', color: '#0061FF',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="#0061FF">
        <path d="M6 1.807L0 5.629l6 3.822 6-3.822-6-3.822zm12 0l-6 3.822 6 3.822 6-3.822-6-3.822zM0 13.274l6 3.822 6-3.822-6-3.823-6 3.823zm18-3.823l-6 3.823 6 3.822 6-3.822-6-3.823zM6 18.371l6 3.822 6-3.822-6-3.822-6 3.822z"/>
      </svg> },
    { v: 'onedrive', label: 'OneDrive', color: '#0078D4',
      icon: <svg width="28" height="28" viewBox="0 0 24 24" fill="#0078D4">
        <path d="M14.4 9.025c-.7-3-3.3-5.225-6.4-5.225-2.5 0-4.65 1.475-5.65 3.6C1.05 7.55 0 8.85 0 10.4c0 1.6 1.3 2.9 2.9 2.9h11.2c1.65 0 3-1.35 3-3 0-.45-.1-.875-.275-1.275-.6-.225-1.275-.225-1.875 0M16.825 9.5c2.05.275 3.625 2 3.625 4.1 0 2.275-1.85 4.125-4.125 4.125H7.275c-.6 0-1.1-.5-1.1-1.1 0-.075.025-.15.05-.225.55.15 1.1.225 1.675.225h11.2c2.275 0 4.125-1.85 4.125-4.125 0-1.95-1.375-3.6-3.225-4.025-.025-.5-.075-.975-.175-1.45h.025c.95 0 1.85.275 2.625.75.05.275.075.55.075.825 0 .425-.075.825-.2 1.2-.275.075-.55.125-.825.175z"/>
      </svg> },
  ]

  const connect = (v: string) => {
    setConnecting(v)
    setTimeout(() => { setConnecting(null); addStock(4) }, 1800)
  }

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {SERVICES.map(s => {
          const loading = connecting === s.v
          return (
            <button key={s.v} onClick={() => !connecting && connect(s.v)}
              disabled={!!connecting}
              style={{
                background: SugarV2.card, borderRadius: 22,
                padding: 22, border: 0,
                boxShadow: SugarV2.shadow,
                cursor: connecting ? 'wait' : 'pointer',
                fontFamily: 'inherit', textAlign: 'left',
                display: 'flex', alignItems: 'center', gap: 16,
                transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
                transform: loading ? 'translateY(-2px)' : 'translateY(0)',
              }}
              onMouseEnter={e => {
                if (!connecting) {
                  e.currentTarget.style.boxShadow = SugarV2.shadowHover
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={e => {
                if (!loading) {
                  e.currentTarget.style.boxShadow = SugarV2.shadow
                  e.currentTarget.style.transform = 'translateY(0)'
                }
              }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: SugarV2.cardSubtle,
                display: 'grid', placeItems: 'center', flexShrink: 0,
              }}>{s.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.2, marginBottom: 2 }}>
                  {s.label}
                </div>
                <div style={{ fontSize: 12.5, color: SugarV2.muted, fontWeight: 500 }}>
                  {loading ? tr('wizard.step4.drive.connecting') : tr('wizard.step4.drive.connect')}
                </div>
              </div>
              <div style={{ flexShrink: 0, color: loading ? SugarV2.black : SugarV2.muted }}>
                {loading ? (
                  <div style={{
                    width: 18, height: 18, borderRadius: 999,
                    border: `2px solid ${SugarV2.cardSubtle}`,
                    borderTopColor: SugarV2.black,
                    animation: 'sgSpin .8s linear infinite',
                  }} />
                ) : (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l6-6-6-6"/>
                  </svg>
                )}
              </div>
            </button>
          )
        })}
      </div>

      <div style={{
        marginTop: 16, padding: '14px 18px',
        display: 'flex', alignItems: 'center', gap: 12,
        color: SugarV2.muted, fontSize: 12.5, fontWeight: 500,
      }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>
        </svg>
        {tr('wizard.step4.drive.readOnlyNote')}
      </div>
    </div>
  )
}

// ─── Helpers visuels ───────────────────────────────────────────────────
function PhotoIcon({ name, size = 16, stroke = 'currentColor' }: { name: 'computer' | 'phone' | 'cloud'; size?: number; stroke?: string }) {
  const p = {
    computer: <><rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8M12 17v4"/></>,
    phone:    <><rect x="6" y="2" width="12" height="20" rx="2"/><path d="M11 18h2"/></>,
    cloud:    <><path d="M18 10a4 4 0 0 0-7.55-1A4 4 0 1 0 7 18h11a4 4 0 0 0 0-8Z"/></>,
  }
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {p[name]}
    </svg>
  )
}

function FakePhoto({ p }: { p: WizardPhoto }) {
  // Vraie photo (dropzone PC) ou URL déjà persistée → on affiche l'image réelle.
  const realSrc = p.previewUrl || p.url
  if (realSrc) {
    return (
      <img
        src={realSrc}
        alt={p.label}
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        draggable={false}
      />
    )
  }
  const stripes = `repeating-linear-gradient(135deg, ${p.tone} 0 14px, ${shade(p.tone, -0.03)} 14px 28px)`
  return (
    <div style={{
      width: '100%', height: '100%', position: 'relative',
      background: stripes,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'grid', placeItems: 'center',
        color: 'rgba(0,0,0,0.18)',
      }}>
        {p.kind === 'interior' && (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M3 21V11l9-7 9 7v10"/><path d="M9 21v-7h6v7"/>
          </svg>
        )}
        {p.kind === 'exterior' && (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="9" r="3"/><path d="M3 21l5-7 4 5 4-3 5 5"/>
          </svg>
        )}
        {p.kind === 'plan' && (
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4">
            <rect x="3" y="3" width="18" height="18"/><path d="M3 12h10M13 3v18M13 9h8M13 15h5"/>
          </svg>
        )}
      </div>
    </div>
  )
}

function FakeQR({ pulse }: { pulse: boolean }) {
  const cells = useMemo(() => {
    const seed = 42
    const rng = (i: number) => ((Math.sin(i * seed) + 1) / 2) > 0.55
    const arr: boolean[] = []
    for (let y = 0; y < 21; y++) {
      for (let x = 0; x < 21; x++) {
        const isFinder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13)
        if (isFinder) {
          const fx = x < 7 ? x : (x - 14)
          const fy = y < 7 ? y : (y - 14)
          const inOuter = fx === 0 || fx === 6 || fy === 0 || fy === 6
          const inInner = fx >= 2 && fx <= 4 && fy >= 2 && fy <= 4
          arr.push(inOuter || inInner)
        } else {
          arr.push(rng(x * 23 + y * 7))
        }
      }
    }
    return arr
  }, [])

  return (
    <div style={{
      width: 200, height: 200, padding: 12, borderRadius: 18,
      background: sgOn(),
      boxShadow: pulse
        ? '0 0 0 6px rgba(16,185,129,0.30), 0 12px 30px rgba(0,0,0,0.08)'
        : '0 12px 30px rgba(0,0,0,0.08)',
      transition: 'box-shadow .4s ease',
      display: 'grid',
      gridTemplateColumns: 'repeat(21, 1fr)',
      gap: 1,
    }}>
      {cells.map((on, i) => (
        <div key={i} style={{
          background: on ? '#0B0C0E' : 'transparent',
          borderRadius: 1,
          aspectRatio: '1',
        }} />
      ))}
    </div>
  )
}

// ─── Quality scoring ──────────────────────────────────────────────────
function computeQuality(photos: WizardPhoto[], tr: TFunction) {
  const n = photos.length
  const interior = photos.filter(p => p.kind === 'interior').length
  const exterior = photos.filter(p => p.kind === 'exterior').length
  const plan = photos.filter(p => p.kind === 'plan').length

  let score = Math.min(100, n * 10)
  const suggestions: string[] = []
  if (n < 8) suggestions.push(tr('wizard.step4.quality.suggestion.addMore', { count: 8 - n }))
  if (exterior === 0) suggestions.push(tr('wizard.step4.quality.suggestion.exterior'))
  if (plan === 0) suggestions.push(tr('wizard.step4.quality.suggestion.plan'))
  if (interior < 4 && n > 0) suggestions.push(tr('wizard.step4.quality.suggestion.rooms'))

  let label: string, color: string, bg: string, message: string
  if (n === 0) {
    label = tr('wizard.step4.quality.label.none'); color = SugarV2.muted; bg = SugarV2.cardSubtle
    message = tr('wizard.step4.quality.message.none')
    score = 5
  } else if (n < 4) {
    label = tr('wizard.step4.quality.label.insufficient'); color = '#EF4444'; bg = 'rgba(239,68,68,0.08)'
    message = tr('wizard.step4.quality.message.insufficient', { count: n })
  } else if (n < 8) {
    label = tr('wizard.step4.quality.label.toComplete'); color = '#F59E0B'; bg = 'rgba(245,158,11,0.10)'
    message = tr('wizard.step4.quality.message.toComplete', { count: n })
  } else if (n < 12) {
    label = tr('wizard.step4.quality.label.good'); color = '#10B981'; bg = 'rgba(16,185,129,0.10)'
    message = tr('wizard.step4.quality.message.good', { count: n })
  } else {
    label = tr('wizard.step4.quality.label.excellent'); color = '#10B981'; bg = 'rgba(16,185,129,0.12)'
    message = tr('wizard.step4.quality.message.excellent', { count: n })
    score = 100
  }
  return { score, label, color, bg, message, suggestions }
}
