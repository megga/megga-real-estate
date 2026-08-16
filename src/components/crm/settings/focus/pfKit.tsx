// MEGGA CRM — Atomes composants du kit « Focus » des Réglages (port 1:1 du design).
// Partagé par ProfileFocusSection / AgencyFocusSection.
// Édition EN LIGNE (Entrée = enregistrer, Échap = annuler, mention « Enregistré »).
// Sans dépendance i18n : les libellés UI sont fournis traduits par la section (props
// `labels`). Constantes/palette/types dans pfKitCore.tsx (règle react-refresh).

import { crmVoileEncre } from '@/components/crm/tokens'
import { MXC_COLOR } from '@/components/megga-x-crm/tokens'
import {
  useEffect, useRef, useState,
  type ReactNode, type RefObject,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ChangeEvent, type SyntheticEvent,
} from 'react'
import {
  PF_ICONS,
  type PfIconName, type PfColors, type PfRow, type PfEditLabels, type PfPhotoLabels,
} from './pfKitCore'

// Ré-exports de type (erasés au build → n'entrent pas dans la règle only-export-components) :
// permet aux sections d'importer composants + types depuis le même module.
export type { PfIconName, PfColors, PfRow, PfEditLabels, PfPhotoLabels, FocusSectionProps } from './pfKitCore'

export function PfIc({ name, size = 16, stroke = 'currentColor', sw = 1.7, solid = false }: {
  name: PfIconName; size?: number; stroke?: string; sw?: number; solid?: boolean
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={solid ? stroke : 'none'} stroke={solid ? 'none' : stroke}
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, display: 'block' }}>{PF_ICONS[name]}</svg>
  )
}

function PfChip({ name, c, size = 34 }: { name: PfIconName; c: PfColors; size?: number }) {
  return (
    <span style={{ width: size, height: size, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <PfIc name={name} size={name === 'linkedin' ? 20 : 22} stroke={c.ink} solid={name === 'linkedin'} />
    </span>
  )
}

/* Pilules d'état et d'action — grammaire `.badge-light` de la vitrine : rayon
   plein, encre de poids 500, jamais 700. La graisse ne porte pas la hiérarchie
   en MEGGA X ; c'est le remplissage qui la porte. */

function PfSeal({ c, label }: { c: PfColors; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', height: 28, padding: '0 var(--crm-space-xl) 0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: c.seal.bg, color: c.seal.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
      <PfIc name="seal" size={14} stroke={c.seal.ink} sw={1.8} />{label}
    </span>
  )
}

/**
 * Action secondaire d'une ligne — et le SEUL marqueur de champ vide.
 *
 * Une pilule jaune « À renseigner » doublait ce bouton : elle ne s'affichait
 * qu'à côté d'un « Ajouter », et « Ajouter » ne s'affiche que sur un champ vide
 * (« Modifier » sinon). Deux marques pour un seul état, dont la plus voyante de
 * l'écran — sur un profil neuf, douze pastilles jaunes couvraient la section et
 * criaient plus fort que les libellés. Retirée le 11 août 2026 ; rien n'est
 * perdu, le verbe du bouton porte l'information.
 *
 * Bouton PILULE à hauteur de doigt, comme les boutons secondaires de la
 * vitrine — l'ancien 32 px venait de la densité Sugar.
 */
function PfGhost({ c, children, onClick }: { c: PfColors; children: ReactNode; onClick?: () => void }) {
  return (
    <button onClick={onClick} style={{ height: 40, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0, color: c.ink, background: c.card, border: c.hair, boxShadow: c.shadowSm }}>{children}</button>
  )
}

export function PfAvatar({ c, photo, initials, size = 62 }: { c: PfColors; photo?: string | null; initials: string; size?: number }) {
  return (
    <div style={{ width: size, height: size, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, overflow: 'hidden', boxShadow: `0 10px 26px -12px ${crmVoileEncre(false, 0.45)}`,
      background: photo ? `${MXC_COLOR.n100} center/cover no-repeat url("${photo}")` : c.ink, color: c.dark ? MXC_COLOR.n100 : '#fff', display: 'grid', placeItems: 'center', fontSize: size * 0.36, fontWeight: 500, letterSpacing: -0.5 }}>
      {photo ? null : initials}
    </div>
  )
}

export function PfEditField({ c, row, value, editing, saved, draft, setDraft, onEdit, onSave, onCancel, labels }: {
  c: PfColors; row: PfRow; value: string; editing: boolean; saved: boolean; draft: string
  setDraft: (v: string) => void; onEdit: () => void; onSave: () => void; onCancel: () => void; labels: PfEditLabels
}) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null)
  useEffect(() => {
    if (editing && inputRef.current) { inputRef.current.focus(); inputRef.current.select?.() }
  }, [editing])
  // Ligne à choix unique : `value` est un id opaque, le libellé se résout via options.
  // Un id absent des options (p. ex. forme juridique d'un autre pays que celui déclaré)
  // est traité comme vide → la ligne propose de la renseigner plutôt que d'afficher un
  // libellé introuvable. La donnée en base n'est écrasée que si l'utilisateur enregistre.
  const selected = row.options ? row.options.find((o) => o.id === value) ?? null : null
  const empty = row.options ? !selected : !value
  const blockEdit = (row.multiline || row.chips || row.options) && editing
  const onKey = (e: ReactKeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onCancel() }
    else if (e.key === 'Enter' && !(row.multiline && e.shiftKey)) { e.preventDefault(); onSave() }
  }
  return (
    <div className="pfx-row" style={{ display: 'flex', alignItems: blockEdit ? 'flex-start' : 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-xl) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', minWidth: 0, background: editing ? c.editBg : 'transparent' }}>
      <PfChip name={row.icon} c={c} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Libellé en CASSE NORMALE, 16 px, poids 400. Les micro-capitales de
            13 px grasses étaient l'ergonomie Sugar (Linear/Notion) ; MEGGA X
            écrit ses libellés de champ comme une phrase — c'est ce que fait
            l'onboarding, qui est le même produit vu par le même agent. */}
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 400, color: c.sub }}>{row.label}</div>
        {editing ? (
          row.multiline ? (
            <textarea ref={inputRef as RefObject<HTMLTextAreaElement>} className="pfx-inp pfx-edit-in" value={draft} placeholder={row.placeholder} rows={4}
              onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
              style={{ width: '100%', marginTop: 'var(--crm-space-sm)', borderRadius: 'var(--crm-radius-xl)', border: 0, background: c.inputBg, color: c.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-2xl)', fontWeight: 400, lineHeight: 1.5, padding: 'var(--crm-space-2xl) var(--crm-space-2xl)', outline: 'none', resize: 'vertical', boxShadow: `0 0 0 1px ${c.hairSoft} inset` }} />
          ) : row.chips ? (
            <div className="pfx-edit-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 7 }}>
              {row.chips.map((opt) => {
                const set = (draft || '').split(',').map((s) => s.trim()).filter(Boolean)
                const on = set.includes(opt)
                return (
                  <button key={opt} onClick={() => { const next = on ? set.filter((x) => x !== opt) : [...set, opt]; setDraft(next.join(', ')) }}
                    style={{ height: 40, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, whiteSpace: 'nowrap', background: on ? c.seal.bg : c.cardSub, color: on ? c.seal.ink : c.soft }}>{opt}</button>
                )
              })}
            </div>
          ) : row.options ? (
            <div className="pfx-edit-in" style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginTop: 7 }}>
              {row.options.map((o) => {
                const on = o.id === draft
                return (
                  <button key={o.id} onClick={() => setDraft(o.id)}
                    style={{ height: 40, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, textAlign: 'left', background: on ? c.seal.bg : c.cardSub, color: on ? c.seal.ink : c.soft }}>{o.label}</button>
                )
              })}
            </div>
          ) : (
            <input ref={inputRef as RefObject<HTMLInputElement>} className="pfx-inp pfx-edit-in" value={draft} placeholder={row.placeholder} type="text"
              onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey}
              style={{ width: '100%', height: 48, marginTop: 'var(--crm-space-sm)', borderRadius: 'var(--crm-radius-lg)', border: 0, background: c.inputBg, color: c.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-2xl)', fontWeight: 400, padding: '0 var(--crm-space-2xl)', outline: 'none', boxShadow: `0 0 0 1px ${c.hairSoft} inset` }} />
          )
        ) : !empty ? (
          // Valeur en 16 px / poids 500 — un cran au-dessus du libellé, sans le
          // gras de Sugar. C'est le CONTRASTE D'ENCRE (`ink` contre `sub`) qui
          // sépare la valeur de son libellé, comme dans toute la vitrine.
          <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: row.multiline ? 400 : 500, color: row.multiline ? c.sub : c.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: 2, maxWidth: row.multiline ? 420 : 'none' }}>
            {(() => {
              if (row.options) return selected?.label ?? ''
              if (row.multiline) return value.length > 58 ? value.replace(/\s+/g, ' ').slice(0, 58).trimEnd() + '…' : value
              if (row.chips) {
                const set = value.split(',').map((s) => s.trim()).filter(Boolean)
                const budget = 46; const out: string[] = []; let len = 0
                for (const it of set) { const add = it.length + (out.length ? 2 : 0); if (len + add > budget && out.length) break; out.push(it); len += add }
                return out.join(', ') + (out.length < set.length ? '…' : '')
              }
              return value
            })()}
          </div>
        ) : null}
      </div>
      {editing ? (
        <div className="pfx-ctrl-in" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', alignSelf: blockEdit ? 'flex-start' : 'center', marginTop: blockEdit ? 6 : 0 }}>
          <button onClick={onCancel} title={labels.cancel} style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: c.card, color: c.sub, display: 'grid', placeItems: 'center', boxShadow: c.shadowSm }}>
            <PfIc name="x" size={16} stroke={c.sub} sw={1.8} />
          </button>
          {/* Valider = l'ACCENT de la marque, pas l'encre. C'est la seule action
              affirmative de la ligne ; la vitrine peint ses boutons primaires
              en `--primary-colors--100`, jamais en noir. */}
          <button onClick={onSave} title={labels.save} style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: c.seal.bg, color: c.seal.ink, display: 'grid', placeItems: 'center', boxShadow: c.shadowSm }}>
            <PfIc name="check" size={17} stroke={c.seal.ink} sw={2.2} />
          </button>
        </div>
      ) : row.locked ? (
        <span title={row.hint} style={{ display: 'inline-flex' }}><PfIc name="lock" size={15} stroke={c.ghost} /></span>
      ) : saved ? (
        <span className="pfx-ctrl-in" style={{ display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', background: c.saved.bg, color: c.saved.ink, fontSize: 'var(--crm-text-lg)', fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {labels.saved}
        </span>
      ) : (
        <>
          {row.verified && row.verifiedLabel && <PfSeal c={c} label={row.verifiedLabel} />}
          <PfGhost c={c} onClick={onEdit}>{empty ? labels.add : labels.edit}</PfGhost>
        </>
      )}
    </div>
  )
}

/* ─── Modale de calibrage photo (upload + zoom + glisser-recadrer, cercle) ──── */
// Découpe circulaire via background-image : le border-radius clippe le fond de
// façon 100% fiable sur TOUS les navigateurs (Safari inclus). Le <img> reste monté
// caché, uniquement pour lire les dimensions naturelles et servir de source au canvas.
export function PfPhotoModal({ c, initial, onCancel, onSave, labels }: {
  c: PfColors; initial: string | null; onCancel: () => void; onSave: (dataUrl: string) => void; labels: PfPhotoLabels
}) {
  const D = 248
  const fileRef = useRef<HTMLInputElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null)
  const [src, setSrc] = useState<string | null>(initial)
  const [nat, setNat] = useState<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState<number>(1)
  const [pos, setPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })

  const baseScale = nat ? Math.max(D / nat.w, D / nat.h) : 1
  const scale = baseScale * zoom
  const scaledW = nat ? nat.w * scale : D
  const scaledH = nat ? nat.h * scale : D
  const clamp = (p: { x: number; y: number }, sw: number, sh: number) => ({ x: Math.min(0, Math.max(D - sw, p.x)), y: Math.min(0, Math.max(D - sh, p.y)) })

  const mCard = c.dark ? '#242426' : '#FFFFFF'
  const mView = c.dark ? '#161616' : c.cardSub
  const mBtnSub = c.dark ? 'rgba(255,255,255,0.09)' : c.cardSub
  const mRing = c.dark ? 'rgba(255,255,255,0.10)' : c.hair
  const mOverlay = c.dark ? 'rgba(0,0,0,0.58)' : crmVoileEncre(false, 0.42)
  const mShadow = c.dark ? '0 30px 80px rgba(0,0,0,0.6)' : `0 40px 100px ${crmVoileEncre(false, 0.30)}, 0 8px 24px ${crmVoileEncre(false, 0.12)}`

  const onFile = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const rd = new FileReader()
    rd.onload = () => setSrc(rd.result as string)
    rd.readAsDataURL(f)
  }
  const onImgLoad = (e: SyntheticEvent<HTMLImageElement>) => {
    const t = e.target as HTMLImageElement
    const w = t.naturalWidth, h = t.naturalHeight
    const bs = Math.max(D / w, D / h)
    setNat({ w, h }); setZoom(1)
    setPos({ x: (D - w * bs) / 2, y: (D - h * bs) / 2 })
  }
  const changeZoom = (z: number) => {
    if (nat) setPos((p) => {
      const oldS = baseScale * zoom, newS = baseScale * z, cc = D / 2
      const nx = cc - (cc - p.x) * (newS / oldS), ny = cc - (cc - p.y) * (newS / oldS)
      return clamp({ x: nx, y: ny }, nat.w * newS, nat.h * newS)
    })
    setZoom(z)
  }
  const onDown = (e: ReactPointerEvent) => { if (!src) return; drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y } }
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!drag.current) return
      const nx = drag.current.px + (e.clientX - drag.current.sx), ny = drag.current.py + (e.clientY - drag.current.sy)
      setPos(clamp({ x: nx, y: ny }, scaledW, scaledH))
    }
    const onUp = () => { drag.current = null }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  })
  const commit = () => {
    if (!src || !nat || !imgRef.current) return
    const S = 256, k = S / D
    const cv = document.createElement('canvas')
    cv.width = S; cv.height = S
    const ctx = cv.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = MXC_COLOR.n100; ctx.fillRect(0, 0, S, S)
    ctx.imageSmoothingQuality = 'high'
    try {
      ctx.drawImage(imgRef.current, pos.x * k, pos.y * k, scaledW * k, scaledH * k)
      onSave(cv.toDataURL('image/jpeg', 0.92))
    } catch {
      // Filet de sécurité : si le canvas est « tainted » (image cross-origin sans
      // CORS), toDataURL lève un SecurityError → on ferme proprement au lieu de
      // laisser la modale bloquée. Le crossOrigin sur le <img> ci-dessous évite ce cas.
      onCancel()
    }
  }

  return (
    <div onClick={onCancel} style={{ position: 'fixed', inset: 0, zIndex: 500, background: mOverlay, backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', display: 'grid', placeItems: 'center', padding: 'var(--crm-space-5xl)' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: mCard, borderRadius: 'var(--crm-radius-6xl)', padding: 26, width: 384, maxWidth: '100%', boxShadow: mShadow, animation: 'pfxEditIn .28s cubic-bezier(.2,.8,.2,1) both' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', marginBottom: 20 }}>
          <PfIc name="camera" size={24} stroke={c.ink} sw={1.7} />
          <h3 style={{ flex: 1, margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: c.ink, letterSpacing: -0.4 }}>{labels.title}</h3>
          <button onClick={onCancel} style={{ width: 34, height: 34, border: 0, borderRadius: 'var(--crm-radius-pill)', background: mBtnSub, color: c.sub, cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
            <PfIc name="x" size={14} stroke={c.sub} sw={2.2} />
          </button>
        </div>

        <div style={{ display: 'grid', placeItems: 'center', marginBottom: 20 }}>
          <div onPointerDown={onDown} onClick={() => { if (!src && fileRef.current) fileRef.current.click() }}
            style={{ position: 'relative', width: D, height: D, borderRadius: 'var(--crm-radius-pill)', overflow: 'hidden', clipPath: 'circle(50% at 50% 50%)', WebkitClipPath: 'circle(50% at 50% 50%)',
              backgroundColor: mView,
              backgroundImage: src ? `url("${src}")` : 'none',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: `${pos.x}px ${pos.y}px`,
              backgroundSize: `${scaledW}px ${scaledH}px`,
              cursor: src ? 'grab' : 'pointer', touchAction: 'none' }}>
            {!src && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
                <span style={{ display: 'grid', placeItems: 'center', gap: 'var(--crm-space-md)' }}>
                  <PfIc name="camera" size={30} stroke={c.ghost} sw={1.6} />
                  <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 400, color: c.sub }}>{labels.choose}</span>
                </span>
              </div>
            )}
            <div style={{ position: 'absolute', inset: 0, borderRadius: 'var(--crm-radius-pill)', boxShadow: `0 0 0 3px ${mCard}, 0 0 0 4px ${mRing}`, pointerEvents: 'none' }} />
          </div>
          {src && <img ref={imgRef} src={src} alt="" crossOrigin="anonymous" onLoad={onImgLoad} style={{ display: 'none' }} />}
        </div>

        {src && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', marginBottom: 22, padding: '0 var(--crm-space-xs)' }}>
            <PfIc name="image" size={16} stroke={c.sub} sw={1.7} />
            <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={(e) => changeZoom(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: c.ink, height: 4, cursor: 'pointer' }} />
          </div>
        )}

        <input ref={fileRef} type="file" accept="image/*" onChange={onFile} style={{ display: 'none' }} />

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-xl)' }}>
          {src ? (
            <button onClick={() => fileRef.current && fileRef.current.click()} style={{ height: 44, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, background: 'transparent', color: c.sub }}>{labels.change}</button>
          ) : <span />}
          <div style={{ display: 'flex', gap: 'var(--crm-space-lg)' }}>
            <button onClick={onCancel} style={{ height: 44, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, background: mBtnSub, color: c.soft }}>{labels.cancel}</button>
            <button onClick={commit} disabled={!src} style={{ height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: src ? 'pointer' : 'not-allowed', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, background: src ? c.seal.bg : c.ghost, color: src ? c.seal.ink : c.onInk }}>{labels.save}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
