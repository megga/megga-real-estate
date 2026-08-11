// MEGGA CRM Sugar v2 Wizard — Step 4 : Photos (concept « Couverture héro + pellicule »)
// Port du handoff « complet » (crm-wizard-sugar-step4.jsx — `SgStepPhotos` + `SgCropModal`).
//
// Upload RÉEL depuis l'ordinateur (drag-drop ou parcourir) → object URLs d'aperçu.
// Couverture en grand + pellicule de vignettes : ★ promeut en couverture, corbeille
// supprime, glisser-déposer réordonne. Recadrage (ratios, poignées, canvas). Compteur.
//
// ⚠ Honnêteté des données : on stocke le `File` (pour l'upload bucket + R2 à la
// publication, cf WizardShell.handlePublish) + `previewUrl` (object URL d'aperçu),
// JAMAIS l'URL blob dans `url` (réservé aux URLs déjà persistées). Le recadrage
// produit un VRAI File via canvas.toBlob (pas un dataURL éphémère).

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { SugarV2, sgOn, type WizardData, type WizardPhoto } from '../tokens'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

const rid = (i: number): string => `ph-${Date.now()}-${i}-${(i * 2654435761 % 1e6).toString(36)}`
const photoSrc = (p: WizardPhoto): string | undefined => p.previewUrl || p.url

// Bouton rond flottant (★ / recadrer / corbeille). Composant au niveau module
// (pas déclaré au render — évite les remounts, règle react-hooks/static-components).
function RoundBtn({ children, onClick, title, danger }: { children: ReactNode; onClick: () => void; title: string; danger?: boolean }) {
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick() }} title={title} style={{
      width: 32, height: 32, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
      background: danger ? 'rgba(142,31,61,0.94)' : 'rgba(255,255,255,0.94)',
      display: 'grid', placeItems: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.20)',
    }}>{children}</button>
  )
}

export function Step4Photos({ data, set }: StepProps) {
  const { t } = useTranslation('listings')
  const photos = data.photos || []
  const cover = photos[0]
  const fileRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const [drag, setDrag] = useState<number | null>(null)
  const [overIdx, setOverIdx] = useState<number | null>(null)
  const [cropId, setCropId] = useState<string | null>(null)

  const addFiles = (files: FileList | null) => {
    const arr = [...(files || [])].filter(f => f.type && f.type.startsWith('image/'))
    if (!arr.length) return
    const items: WizardPhoto[] = arr.map((f, i) => ({
      id: rid(i),
      label: f.name,
      kind: 'interior',
      tone: '#D4DDE3',
      file: f,
      previewUrl: URL.createObjectURL(f),
    }))
    set({ photos: [...photos, ...items] })
  }
  const removePhoto = (id: string) => {
    const target = photos.find(p => p.id === id)
    if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
    set({ photos: photos.filter(p => p.id !== id) })
  }
  const setCover = (id: string) => {
    const i = photos.findIndex(p => p.id === id)
    if (i <= 0) return
    const n = [...photos]; const [m] = n.splice(i, 1); n.unshift(m)
    set({ photos: n })
  }
  const move = (from: number | null, to: number | null) => {
    if (from == null || to == null || from === to) return
    const n = [...photos]; const [m] = n.splice(from, 1); n.splice(to, 0, m)
    set({ photos: n })
  }
  // Recadrage → nouveau File réel (uploadé à la publication), previewUrl rafraîchi.
  const applyCrop = (id: string, file: File) => set({
    photos: photos.map(p => {
      if (p.id !== id) return p
      if (p.previewUrl) URL.revokeObjectURL(p.previewUrl)
      return { ...p, file, previewUrl: URL.createObjectURL(file), url: undefined }
    }),
  })
  const pick = () => fileRef.current?.click()

  const IUp = (c: string, s = 22): ReactNode => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" /></svg>
  const IStar = (c: string, s = 15): ReactNode => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8L6.6 19.6l1-6L3.3 9.4l6-.9z" /></svg>
  const ITrash = (c: string, s = 15): ReactNode => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></svg>
  const ICrop = (c: string, s = 15): ReactNode => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14M18 22V8a2 2 0 0 0-2-2H2" /></svg>

  return (
    <div style={{ maxWidth: 900, margin: '0 auto', animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>
      <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { addFiles(e.target.files); e.target.value = '' }} />

      <div style={{ marginBottom: 26, maxWidth: 680 }}>
        <h1 style={{ margin: '0 0 4px', fontSize: 'var(--crm-text-9xl)', fontWeight: 500, color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1 }}>{t('wizard.step4.title')}</h1>
      </div>

      {photos.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-xl)', marginBottom: 16, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: SugarV2.ink }}>{t('wizard.step4.count', { count: photos.length })}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-sm) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: SugarV2.card, boxShadow: SugarV2.shadowSm, fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SugarV2.inkSoft }}>
            {photos.length < 8 ? t('wizard.step4.tipFew') : t('wizard.step4.tipMany')}
          </span>
        </div>
      )}

      {/* Couverture */}
      {cover ? (
        <div
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); if (drag == null) addFiles(e.dataTransfer.files) }}
          style={{ position: 'relative', aspectRatio: '16/9', borderRadius: 'var(--crm-radius-5xl)', overflow: 'hidden', background: SugarV2.cardSubtle, boxShadow: over ? `inset 0 0 0 3px ${SugarV2.black}, ${SugarV2.shadow}` : SugarV2.shadow, marginBottom: 16 }}>
          <img src={photoSrc(cover)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          <div style={{ position: 'absolute', top: 14, left: 14 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', padding: 'var(--crm-space-sm) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: SugarV2.black, color: sgOn(), fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2 }}>
              {IStar(sgOn(), 12)}{t('wizard.step4.cover')}
            </span>
          </div>
          <div style={{ position: 'absolute', top: 14, right: 14, display: 'flex', gap: 'var(--crm-space-md)' }}>
            <RoundBtn title={t('wizard.step4.crop')} onClick={() => setCropId(cover.id)}>{ICrop(SugarV2.ink)}</RoundBtn>
            <RoundBtn danger title={t('wizard.step4.delete')} onClick={() => removePhoto(cover.id)}>{ITrash('#fff')}</RoundBtn>
          </div>
          {cover.label && <div style={{ position: 'absolute', bottom: 14, left: 14, padding: 'var(--crm-space-sm) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', background: 'rgba(3,3,3,0.55)', color: '#fff', fontSize: 'var(--crm-text-md)', fontWeight: 600, backdropFilter: 'blur(6px)', maxWidth: '70%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cover.label}</div>}
        </div>
      ) : (
        <div
          onClick={pick}
          onDragOver={e => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={e => { e.preventDefault(); setOver(false); addFiles(e.dataTransfer.files) }}
          style={{ cursor: 'pointer', aspectRatio: '16/9', borderRadius: 'var(--crm-radius-5xl)', marginBottom: 16, background: over ? SugarV2.cardSubtle : SugarV2.card, boxShadow: over ? `inset 0 0 0 3px ${SugarV2.black}` : `inset 0 0 0 1.5px ${SugarV2.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-3xl)', transition: 'box-shadow .15s, background .15s' }}>
          <span style={{ width: 60, height: 60, borderRadius: 'var(--crm-radius-3xl)', background: SugarV2.black, display: 'grid', placeItems: 'center', boxShadow: '0 10px 24px rgba(3,3,3,0.22)' }}>{IUp(sgOn(), 26)}</span>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: SugarV2.ink }}>{t('wizard.step4.dropTitle')}</div>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: SugarV2.muted, marginTop: 4 }}>{t('wizard.step4.dropHint')}</div>
          </div>
        </div>
      )}

      {/* Pellicule */}
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', overflowX: 'auto', paddingBottom: 'var(--crm-space-md)' }}>
          {photos.map((p, i) => {
            const isCover = i === 0
            return (
              <div key={p.id} draggable
                onDragStart={() => setDrag(i)}
                onDragOver={e => { e.preventDefault(); setOverIdx(i) }}
                onDrop={e => { e.preventDefault(); move(drag, i); setDrag(null); setOverIdx(null) }}
                onDragEnd={() => { setDrag(null); setOverIdx(null) }}
                style={{
                  position: 'relative', flex: '0 0 auto', width: 132, aspectRatio: '4/3', borderRadius: 'var(--crm-radius-xl)', overflow: 'hidden', background: SugarV2.cardSubtle, cursor: 'grab',
                  boxShadow: isCover ? `inset 0 0 0 3px ${SugarV2.black}` : SugarV2.shadowSm,
                  outline: overIdx === i && drag !== i ? `2px dashed ${SugarV2.black}` : 'none', outlineOffset: 2,
                  opacity: drag === i ? 0.5 : 1,
                }}>
                <img src={photoSrc(p)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {isCover && <div style={{ position: 'absolute', top: 6, left: 6, padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)', background: SugarV2.black, color: sgOn(), fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: 0.3 }}>{t('wizard.step4.coverShort')}</div>}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end', gap: 'var(--crm-space-xs)', padding: 'var(--crm-space-sm)', background: 'linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.30))' }}>
                  {!isCover && <RoundBtn title={t('wizard.step4.setCover')} onClick={() => setCover(p.id)}>{IStar(SugarV2.ink, 14)}</RoundBtn>}
                  <RoundBtn title={t('wizard.step4.crop')} onClick={() => setCropId(p.id)}>{ICrop(SugarV2.ink, 14)}</RoundBtn>
                  <RoundBtn danger title={t('wizard.step4.delete')} onClick={() => removePhoto(p.id)}>{ITrash('#fff', 14)}</RoundBtn>
                </div>
              </div>
            )
          })}
          <button onClick={pick} style={{ flex: '0 0 auto', width: 132, aspectRatio: '4/3', borderRadius: 'var(--crm-radius-xl)', border: 0, cursor: 'pointer', fontFamily: 'inherit', background: SugarV2.card, boxShadow: `inset 0 0 0 1.5px ${SugarV2.line}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)', color: SugarV2.ink }}>
            <span style={{ width: 34, height: 34, borderRadius: 'var(--crm-radius-md)', background: SugarV2.cardSubtle, display: 'grid', placeItems: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={SugarV2.ink} strokeWidth="2.2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
            </span>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{t('wizard.step4.add')}</span>
          </button>
        </div>
      )}

      {cropId && (() => {
        const ph = photos.find(p => p.id === cropId)
        return ph ? <SgCropModal photo={ph} onClose={() => setCropId(null)} onApply={(file) => { applyCrop(cropId, file); setCropId(null) }} /> : null
      })()}
    </div>
  )
}

// ─── Modale de recadrage ───────────────────────────────────────────────
interface CropBox { x: number; y: number; w: number; h: number }
const SG_CROP_ASPECTS: { k: string; label: string; r: number | null }[] = [
  { k: 'free', label: '', r: null },   // label « Libre » via i18n
  { k: '1', label: '1:1', r: 1 },
  { k: '43', label: '4:3', r: 4 / 3 },
  { k: '32', label: '3:2', r: 3 / 2 },
  { k: '169', label: '16:9', r: 16 / 9 },
]

function SgCropModal({ photo, onClose, onApply }: { photo: WizardPhoto; onClose: () => void; onApply: (file: File) => void }) {
  const { t } = useTranslation('listings')
  const imgRef = useRef<HTMLImageElement>(null)
  const dragRef = useRef<{ mode: string; sx: number; sy: number; box: CropBox } | null>(null)
  const [disp, setDisp] = useState({ w: 0, h: 0 })
  const [box, setBox] = useState<CropBox | null>(null)
  const [aspect, setAspect] = useState<number | null>(null)
  const [ready, setReady] = useState(false)

  const initBox = (w: number, h: number, r: number | null): CropBox => {
    let bw: number, bh: number
    if (r) { const mw = w * 0.9, mh = h * 0.9; if (mw / r <= mh) { bw = mw; bh = mw / r } else { bh = mh; bw = mh * r } }
    else { bw = w * 0.82; bh = h * 0.82 }
    return { x: (w - bw) / 2, y: (h - bh) / 2, w: bw, h: bh }
  }
  useEffect(() => {
    const el = imgRef.current
    const measure = (): boolean => {
      if (!el) return false
      const w = el.offsetWidth, h = el.offsetHeight
      if (w && h && el.naturalWidth) { setDisp({ w, h }); setBox(initBox(w, h, aspect)); setReady(true); return true }
      return false
    }
    if (measure()) return
    const onLoad = () => measure()
    el?.addEventListener('load', onLoad)
    const iv = setInterval(() => { if (measure()) clearInterval(iv) }, 60)
    const to = setTimeout(() => clearInterval(iv), 3000)
    return () => { el?.removeEventListener('load', onLoad); clearInterval(iv); clearTimeout(to) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setA = (r: number | null) => { setAspect(r); if (disp.w) setBox(initBox(disp.w, disp.h, r)) }
  const clamp = (b: CropBox): CropBox => {
    let { x, y, w, h } = b
    w = Math.min(w, disp.w); h = Math.min(h, disp.h)
    x = Math.max(0, Math.min(x, disp.w - w))
    y = Math.max(0, Math.min(y, disp.h - h))
    return { x, y, w, h }
  }
  const onMove = (e: PointerEvent) => {
    const d = dragRef.current; if (!d) return
    const dx = e.clientX - d.sx, dy = e.clientY - d.sy
    const b: CropBox = { ...d.box }
    if (d.mode === 'move') { b.x += dx; b.y += dy; setBox(clamp(b)); return }
    if (d.mode.includes('e')) b.w = d.box.w + dx
    if (d.mode.includes('s')) b.h = d.box.h + dy
    if (d.mode.includes('w')) { b.w = d.box.w - dx; b.x = d.box.x + dx }
    if (d.mode.includes('n')) { b.h = d.box.h - dy; b.y = d.box.y + dy }
    b.w = Math.max(48, b.w); b.h = Math.max(48, b.h)
    if (aspect) { const nh = b.w / aspect; if (d.mode.includes('n')) b.y = b.y + (b.h - nh); b.h = nh }
    setBox(clamp(b))
  }
  const onUp = () => { dragRef.current = null; window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  const start = (mode: string) => (e: React.PointerEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (!box) return
    dragRef.current = { mode, sx: e.clientX, sy: e.clientY, box: { ...box } }
    window.addEventListener('pointermove', onMove); window.addEventListener('pointerup', onUp)
  }
  const apply = () => {
    const el = imgRef.current; if (!el || !box || !disp.w) return
    const sX = el.naturalWidth / disp.w, sY = el.naturalHeight / disp.h
    const cw = Math.max(1, Math.round(box.w * sX)), ch = Math.max(1, Math.round(box.h * sY))
    const canvas = document.createElement('canvas'); canvas.width = cw; canvas.height = ch
    const ctx = canvas.getContext('2d'); if (!ctx) { onClose(); return }
    try {
      ctx.drawImage(el, box.x * sX, box.y * sY, box.w * sX, box.h * sY, 0, 0, cw, ch)
      // VRAI File (uploadé à la publication), pas un dataURL éphémère.
      canvas.toBlob((blob) => {
        if (!blob) { onClose(); return }
        onApply(new File([blob], photo.label ? `${photo.label}.jpg` : 'photo.jpg', { type: 'image/jpeg' }))
      }, 'image/jpeg', 0.9)
    } catch { onClose() }
  }
  const handle = (pos: string, cursor: string): ReactNode => (
    <div onPointerDown={start(pos)} style={{
      position: 'absolute', width: 16, height: 16, background: '#fff', borderRadius: 'var(--crm-radius-xs)', boxShadow: '0 1px 4px rgba(0,0,0,0.4)', cursor,
      ...(pos.includes('n') ? { top: -8 } : { bottom: -8 }), ...(pos.includes('w') ? { left: -8 } : { right: -8 }),
    }} />
  )

  return createPortal(
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(3,3,3,0.55)', backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center', padding: 'var(--crm-space-7xl)' }}>
      <div onClick={e => e.stopPropagation()} style={{ background: SugarV2.card, borderRadius: 'var(--crm-radius-6xl)', padding: 26, boxShadow: '0 40px 100px rgba(15,23,42,0.28)', maxWidth: 760, width: '100%', animation: 'sgFadeUp .3s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-xl)', marginBottom: 18, flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: SugarV2.ink, letterSpacing: -0.3 }}>{t('wizard.step4.cropTitle')}</h3>
          <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
            {SG_CROP_ASPECTS.map(a => {
              const sel = aspect === a.r
              return <button key={a.k} onClick={() => setA(a.r)} style={{ height: 32, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, background: sel ? SugarV2.black : SugarV2.cardSubtle, color: sel ? sgOn() : SugarV2.inkSoft }}>{a.k === 'free' ? t('wizard.step4.aspectFree') : a.label}</button>
            })}
          </div>
        </div>

        <div style={{ display: 'grid', placeItems: 'center', background: SugarV2.cardSubtle, borderRadius: 'var(--crm-radius-2xl)', padding: 'var(--crm-space-3xl)', marginBottom: 20 }}>
          <div style={{ position: 'relative', lineHeight: 0, overflow: 'hidden', borderRadius: 'var(--crm-radius-sm)', touchAction: 'none' }}>
            <img ref={imgRef} src={photoSrc(photo)} alt="" draggable={false} style={{ maxWidth: '100%', maxHeight: '52vh', display: 'block', userSelect: 'none' }} />
            {ready && box && (
              <div onPointerDown={start('move')} style={{ position: 'absolute', left: box.x, top: box.y, width: box.w, height: box.h, boxShadow: '0 0 0 9999px rgba(3,3,3,0.5)', outline: '1.5px solid #fff', cursor: 'move' }}>
                <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)', backgroundSize: '33.33% 33.33%', pointerEvents: 'none' }} />
                {handle('nw', 'nwse-resize')}{handle('ne', 'nesw-resize')}{handle('sw', 'nesw-resize')}{handle('se', 'nwse-resize')}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)' }}>
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SugarV2.muted }}>{t('wizard.step4.cropHint')}</span>
          <div style={{ display: 'flex', gap: 'var(--crm-space-lg)' }}>
            <button onClick={onClose} style={{ height: 44, padding: '0 var(--crm-space-5xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: 'transparent', color: SugarV2.inkSoft }}>{t('common:actions.cancel')}</button>
            <button onClick={apply} style={{ height: 44, padding: '0 var(--crm-space-7xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: SugarV2.black, color: sgOn(), boxShadow: '0 8px 22px rgba(3,3,3,0.18)' }}>{t('wizard.step4.crop')}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
