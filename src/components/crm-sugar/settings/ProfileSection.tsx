// MEGGA CRM Sugar v2 — Settings Profile section (« Sugar Pure », full fidelity)
// Port fidèle de `crm-screen-settings-sugar.jsx` (ProfileSectionWithStickyActions
// + AvatarPhotoModal + HtmlSignatureEditor + SetProfGroup), câblé à Supabase via
// useAgentProfileSugar.
//
// Câblage réel (persisté) : firstName / lastName → full_name, title, phone,
//   mobile, rcc, bio, signature, signatureMode, signatureHtml.
//   email + agency = lecture seule.
// La photo de profil est gérée par useAvatar (upload bucket `avatars` +
//   persistance profiles.avatar_url), indépendamment du bouton « Enregistrer ».

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/Toast'
import {
  ConfirmModal,
  SetBlackBtn,
  SetGhostBtn,
  SetIcon,
  SetInput,
  SetRing,
  SetTextarea,
  StickySaveBar,
} from './atoms'
import {
  DEFAULT_PROFILE,
  profileCompletionScore,
  SET_PALETTE,
  type ProfileData,
  type SettingsIconName,
} from './data'
import { useAgentProfileSugar } from '@/hooks/useAgentProfileSugar'
import { useAvatar } from '@/hooks/useAvatar'

const SET = SET_PALETTE

// ─── Section interne d'une card groupée (icône + titre, divider en haut) ────
interface SetProfGroupProps {
  icon: SettingsIconName
  title: string
  action?: ReactNode
  children: ReactNode
  first?: boolean
}

function SetProfGroup({ icon, title, action, children, first }: SetProfGroupProps) {
  return (
    <div style={{ padding: '22px 26px', borderTop: first ? 'none' : `1px solid ${SET.line}` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <SetIcon name={icon} size={16} stroke={SET.ink} />
        <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: SET.ink, letterSpacing: -0.2 }}>
          {title}
        </h3>
        {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
      </div>
      {children}
    </div>
  )
}

// ─── Sanitize basique pour l'aperçu HTML de la signature ────────────────────
// On retire les vecteurs d'exécution évidents avant un dangerouslySetInnerHTML
// d'aperçu (script, handlers on*, javascript:). L'envoi réel reste human-in-
// the-loop et passera par un pipeline d'emailing dédié.
function sanitizeSignatureHtml(raw: string): string {
  return (raw || '')
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*script[^>]*>/gi, '')
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    .replace(/\son\w+\s*=\s*[^\s>]+/gi, '')
    .replace(/javascript:/gi, '')
}

// ─── Éditeur HTML de signature (mode « HTML ») ──────────────────────────────
function HtmlSignatureEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const { t } = useTranslation('settings')
  const [preview, setPreview] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const onImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => onChange(String(reader.result || ''))
    reader.readAsText(f)
    e.target.value = ''
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: SET.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          {t('profile.signatureHtml.codeLabel')}
        </span>
        <div style={{ flex: 1 }} />
        <input
          ref={fileRef}
          type="file"
          accept=".html,text/html"
          onChange={onImport}
          style={{ display: 'none' }}
        />
        <SetGhostBtn size="sm" onClick={() => fileRef.current?.click()}>
          {t('profile.signatureHtml.import')}
        </SetGhostBtn>
        <SetGhostBtn size="sm" onClick={() => setPreview(true)}>
          {t('profile.signatureHtml.preview')}
        </SetGhostBtn>
      </div>
      <textarea
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        rows={14}
        spellCheck={false}
        placeholder={t('profile.signatureHtml.placeholder')}
        style={{
          width: '100%',
          border: 0,
          outline: 'none',
          background: SET.cardSubtle,
          borderRadius: 14,
          padding: '14px 16px',
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          fontSize: 13,
          lineHeight: 1.6,
          color: SET.ink,
          resize: 'vertical',
          boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
        }}
      />
      <div style={{ marginTop: 8, fontSize: 12, color: SET.muted, fontWeight: 500, lineHeight: 1.45 }}>
        {t('profile.signatureHtml.hint')}
      </div>
      {preview &&
        createPortal(
          <div
            onClick={() => setPreview(false)}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 200,
              background: 'rgba(11,12,14,0.40)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              display: 'grid',
              placeItems: 'center',
              animation: 'setFadeIn .2s ease both',
            }}
          >
            <div
              onClick={e => e.stopPropagation()}
              style={{
                background: SET.card,
                borderRadius: 24,
                width: '92%',
                maxWidth: 640,
                boxShadow: '0 40px 80px rgba(11,12,14,0.30)',
                overflow: 'hidden',
                animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '18px 22px',
                  borderBottom: `1px solid ${SET.line}`,
                }}
              >
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: SET.ink, letterSpacing: -0.2 }}>
                  {t('profile.signatureHtml.preview')}
                </h3>
                <button
                  onClick={() => setPreview(false)}
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 999,
                    border: 0,
                    background: SET.cardSubtle,
                    cursor: 'pointer',
                    display: 'grid',
                    placeItems: 'center',
                    color: SET.inkSoft,
                  }}
                >
                  <SetIcon name="x" size={16} stroke={SET.inkSoft} />
                </button>
              </div>
              {/* Fond blanc volontaire : l'aperçu simule le rendu dans un client mail. */}
              <div style={{ padding: 28, background: '#FFFFFF', maxHeight: '60vh', overflowY: 'auto' }}>
                <div
                  style={{
                    fontSize: 10.5,
                    fontWeight: 700,
                    color: '#9AA0AA',
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    marginBottom: 16,
                  }}
                >
                  {t('profile.signatureLabel')}
                </div>
                <div
                  dangerouslySetInnerHTML={{
                    __html: value
                      ? sanitizeSignatureHtml(value)
                      : `<p style='color:#9AA0AA;font-style:italic;margin:0'>${t('profile.signatureHtml.empty')}</p>`,
                  }}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  )
}

// ─── Modale Photo de profil — upload + recadrage circulaire ─────────────────
// Glisser-déposer ou parcourir, zoom (molette + slider 1→4), repositionnement
// par drag dans la fenêtre ronde Ø248. Sortie : data URL carré 512px JPEG 0.92.
const AVATAR_VIEW = 248

function AvatarPhotoModal({
  open,
  currentUrl,
  fallbackBg,
  initials,
  onClose,
  onApply,
  onRemove,
}: {
  open: boolean
  currentUrl: string | null | undefined
  fallbackBg: string
  initials: string
  onClose: () => void
  onApply: (dataUrl: string) => void
  onRemove: () => void
}) {
  const { t } = useTranslation('settings')
  const [img, setImg] = useState<{ el: HTMLImageElement; w: number; h: number; name: string } | null>(
    null,
  )
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)

  useEffect(() => {
    if (open) {
      setImg(null)
      setScale(1)
      setOffset({ x: 0, y: 0 })
      setOver(false)
    }
  }, [open])

  if (!open) return null

  const baseScale = img ? Math.max(AVATAR_VIEW / img.w, AVATAR_VIEW / img.h) : 1
  const dispW = img ? img.w * baseScale * scale : AVATAR_VIEW
  const dispH = img ? img.h * baseScale * scale : AVATAR_VIEW
  const clamp = (o: { x: number; y: number }) => {
    const mx = Math.max(0, (dispW - AVATAR_VIEW) / 2)
    const my = Math.max(0, (dispH - AVATAR_VIEW) / 2)
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) }
  }
  const loadFile = (file?: File | null) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const el = new Image()
      el.onload = () => {
        setImg({ el, w: el.naturalWidth, h: el.naturalHeight, name: file.name })
        setScale(1)
        setOffset({ x: 0, y: 0 })
      }
      el.src = String(e.target?.result || '')
    }
    reader.readAsDataURL(file)
  }
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!img) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    setOffset(
      clamp({
        x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
        y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
      }),
    )
  }
  const onPointerUp = () => {
    dragRef.current = null
  }
  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!img) return
    setScale(s => Math.max(1, Math.min(4, s - e.deltaY * 0.0015)))
  }

  const apply = () => {
    if (!img) return
    const OUT = 512
    const f = OUT / AVATAR_VIEW
    const c = document.createElement('canvas')
    c.width = OUT
    c.height = OUT
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, OUT, OUT)
    const w = dispW * f
    const h = dispH * f
    const x = (OUT - w) / 2 + offset.x * f
    const y = (OUT - h) / 2 + offset.y * f
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img.el, x, y, w, h)
    onApply(c.toDataURL('image/jpeg', 0.92))
    onClose()
  }

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        background: 'rgba(11,12,14,0.40)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        animation: 'setFadeIn .2s ease both',
        padding: 20,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card,
          borderRadius: 28,
          width: '92%',
          maxWidth: 400,
          boxShadow: '0 40px 90px rgba(11,12,14,0.34)',
          overflow: 'hidden',
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '20px 24px 0',
          }}
        >
          <div>
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: SET.ink, letterSpacing: -0.3 }}>
              {t('profile.photo')}
            </h3>
            <p style={{ margin: '4px 0 0', fontSize: 12.5, color: SET.muted, fontWeight: 500 }}>
              {img ? t('profile.avatarModal.dragHint') : t('profile.avatarModal.formatHint')}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: 0,
              background: SET.cardSubtle,
              color: SET.muted,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <SetIcon name="x" size={16} stroke={SET.muted} />
          </button>
        </div>

        {/* Zone de recadrage / dropzone */}
        <div style={{ padding: '22px 24px 8px', display: 'grid', placeItems: 'center' }}>
          <div
            onDragOver={e => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={e => {
              e.preventDefault()
              setOver(false)
              loadFile(e.dataTransfer.files && e.dataTransfer.files[0])
            }}
            style={{ position: 'relative', width: AVATAR_VIEW, height: AVATAR_VIEW, flexShrink: 0 }}
          >
            <div
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onWheel={onWheel}
              onClick={() => {
                if (!img) fileRef.current?.click()
              }}
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 999,
                overflow: 'hidden',
                background: img ? '#fff' : SET.cardSubtle,
                boxShadow: `inset 0 0 0 1px ${SET.line}`,
                cursor: img ? 'grab' : 'pointer',
                touchAction: 'none',
                outline: over ? `2px dashed ${SET.black}` : 'none',
                outlineOffset: 3,
              }}
            >
              {img ? (
                <img
                  src={img.el.src}
                  alt=""
                  draggable={false}
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: dispW,
                    height: dispH,
                    transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                    userSelect: 'none',
                    pointerEvents: 'none',
                    maxWidth: 'none',
                  }}
                />
              ) : currentUrl ? (
                <img
                  src={currentUrl}
                  alt=""
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'grid',
                    placeItems: 'center',
                    background: fallbackBg,
                    color: SET.blackInk,
                    fontSize: 64,
                    fontWeight: 700,
                    letterSpacing: -1,
                  }}
                >
                  {initials}
                </div>
              )}
            </div>
            {/* Anneau de cadrage */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 999,
                boxShadow: '0 0 0 6px rgba(11,12,14,0.04)',
                pointerEvents: 'none',
              }}
            />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={e => loadFile(e.target.files && e.target.files[0])}
          />
        </div>

        {/* Zoom + parcourir */}
        <div style={{ padding: '6px 24px 0' }}>
          {img ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <SetIcon name="camera" size={15} stroke={SET.muted} />
              <input
                type="range"
                min="1"
                max="4"
                step="0.01"
                value={scale}
                onChange={e => setScale(parseFloat(e.target.value))}
                style={{ flex: 1, accentColor: SET.black, height: 4 }}
              />
              <button
                onClick={() => {
                  setScale(1)
                  setOffset({ x: 0, y: 0 })
                }}
                style={{
                  height: 32,
                  padding: '0 12px',
                  borderRadius: 999,
                  border: 0,
                  background: SET.cardSubtle,
                  color: SET.ink,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                {t('profile.avatarModal.recenter')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%',
                height: 44,
                borderRadius: 14,
                border: 0,
                background: SET.cardSubtle,
                color: SET.ink,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: `inset 0 0 0 1px ${SET.line}`,
              }}
            >
              <SetIcon name="camera" size={15} stroke={SET.ink} /> {t('profile.avatarModal.browse')}
            </button>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '18px 24px 22px',
            marginTop: 8,
          }}
        >
          {currentUrl ? (
            <button
              onClick={() => {
                onRemove()
                onClose()
              }}
              style={{
                border: 0,
                background: 'transparent',
                color: SET.err,
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 700,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              {t('profile.avatarModal.remove')}
            </button>
          ) : (
            <span />
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SetGhostBtn onClick={onClose}>{t('common:actions.cancel')}</SetGhostBtn>
            <SetBlackBtn
              onClick={apply}
              disabled={!img}
              icon={<SetIcon name="check" size={14} stroke={SET.blackInk} sw={2.4} />}
            >
              {t('profile.avatarModal.apply')}
            </SetBlackBtn>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  PROFILE SECTION
// ═══════════════════════════════════════════════════════════════════════════
export function ProfileSection() {
  const { t } = useTranslation('settings')
  // Source de vérité : Supabase via useAgentProfileSugar.
  const { profile: serverProfile, isLoading, isSaving, hasBackend, save } = useAgentProfileSugar()

  // Avatar : hook dédié (upload bucket `avatars` + persistance profiles.avatar_url).
  // Sa valeur `avatarUrl` est la source vivante après upload ; le profil hydrate
  // l'affichage initial via data.avatarUrl.
  const { avatarUrl: liveAvatarUrl, saveDataUrl, removeAvatar } = useAvatar()

  const [data, setData] = useState<ProfileData>(serverProfile)
  const [saved, setSaved] = useState<ProfileData>(serverProfile)

  // Sync depuis le serveur quand le profil charge (ou s'invalide après save)
  useEffect(() => {
    setData(serverProfile)
    setSaved(serverProfile)
  }, [serverProfile])

  const dirty = JSON.stringify(data) !== JSON.stringify(saved)

  const set = (patch: Partial<ProfileData>) => setData(d => ({ ...d, ...patch }))
  const reset = () => setData(saved)

  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [photoOpen, setPhotoOpen] = useState(false)

  const score = profileCompletionScore(data)
  const signatureMode = data.signatureMode || 'text'
  // Affichage avatar : valeur vivante du hook (post-upload) en priorité, sinon
  // l'hydratation initiale du profil. Fallback initiales si aucune photo.
  const displayAvatarUrl = liveAvatarUrl ?? data.avatarUrl ?? null

  const handleSave = async () => {
    if (!hasBackend) {
      // Pas de faux succès si l'utilisateur n'est pas authentifié.
      toast.error(t('profile.toast.sessionExpired'))
      return
    }
    try {
      // save() persiste l'intégralité du formulaire (identité, contact, bio,
      // signature). La photo est gérée à part par useAvatar — voir la modale.
      await save(data)
      setSaved(data)
      toast.success(t('profile.toast.saved'), { duration: 2400 })
    } catch (err) {
      toast.error(t('profile.toast.saveError'))
      void err
    }
  }

  const handleCancel = () => {
    if (!dirty) return
    setConfirmOpen(true)
  }

  // Skeleton : pendant le chargement initial Supabase, on évite de rendre des
  // champs vides (qui apparaîtraient dirty immédiatement contre serverProfile).
  if (isLoading && !serverProfile.firstName && !serverProfile.email) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 24 }}>
        <div
          style={{
            background: SET.card,
            borderRadius: 26,
            padding: '26px 28px',
            boxShadow: SET.shadow,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
          }}
        >
          <div
            style={{
              width: 92,
              height: 92,
              borderRadius: 999,
              background: SET.cardSubtle,
              flexShrink: 0,
              animation: 'setFadeIn 1s ease infinite alternate',
            }}
          />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ width: 180, height: 18, borderRadius: 8, background: SET.cardSubtle }} />
            <div style={{ width: 240, height: 12, borderRadius: 6, background: SET.cardSubtle }} />
          </div>
        </div>
        <div
          style={{
            background: SET.card,
            borderRadius: 24,
            padding: 28,
            boxShadow: SET.shadow,
            color: SET.muted,
            fontSize: 13,
          }}
        >
          {t('profile.loading')}
        </div>
      </div>
    )
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: dirty ? 96 : 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* HERO unifié — avatar + identité + complétude */}
        <div
          style={{
            background: SET.card,
            borderRadius: 26,
            padding: '26px 28px',
            boxShadow: SET.shadow,
            display: 'flex',
            alignItems: 'center',
            gap: 22,
            flexWrap: 'wrap',
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              style={{
                width: 92,
                height: 92,
                borderRadius: 999,
                background: SET.black,
                color: SET.blackInk,
                display: 'grid',
                placeItems: 'center',
                overflow: 'hidden',
                fontSize: 34,
                fontWeight: 700,
                letterSpacing: -0.5,
                boxShadow: '0 10px 26px rgba(11,12,14,0.28)',
              }}
            >
              {displayAvatarUrl ? (
                <img
                  src={displayAvatarUrl}
                  alt={t('profile.photo')}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                />
              ) : (
                data.initials
              )}
            </div>
            <button
              title={t('profile.changePhoto')}
              onClick={() => setPhotoOpen(true)}
              style={{
                position: 'absolute',
                bottom: -2,
                right: -2,
                width: 32,
                height: 32,
                borderRadius: 999,
                border: `3px solid ${SET.card}`,
                background: SET.cardSubtle,
                color: SET.ink,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                boxShadow: SET.shadowSm,
              }}
            >
              <SetIcon name="camera" size={15} stroke={SET.ink} />
            </button>
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 23, fontWeight: 800, color: SET.ink, letterSpacing: -0.6, lineHeight: 1.1 }}>
              {data.firstName} {data.lastName}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginTop: 6,
                color: SET.muted,
                fontSize: 13.5,
                fontWeight: 600,
                flexWrap: 'wrap',
              }}
            >
              <span>{data.title}</span>
              <span style={{ width: 3, height: 3, borderRadius: 999, background: SET.ghost }} />
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <SetIcon name="building" size={14} stroke={SET.muted} />
                {data.agency}
              </span>
            </div>
          </div>
          <div style={{ paddingLeft: 24 }}>
            <SetRing value={score} size={92} />
          </div>
        </div>

        {/* BENTO 2 colonnes — gauche: Identité · Contact / droite: Présentation · Signature */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
            gap: 20,
            alignItems: 'start',
          }}
        >
          {/* Colonne gauche */}
          <div style={{ background: SET.card, borderRadius: 24, boxShadow: SET.shadow, overflow: 'hidden' }}>
            <SetProfGroup icon="user" title={t('profile.identityTitle')} first>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <SetInput label={t('profile.firstName')} value={data.firstName} onChange={v => set({ firstName: v })} />
                <SetInput label={t('profile.lastName')} value={data.lastName} onChange={v => set({ lastName: v })} />
                <SetInput label={t('profile.function')} value={data.title} onChange={v => set({ title: v })} />
                <SetInput label={t('profile.rcc')} value={data.rcc} onChange={v => set({ rcc: v })} />
              </div>
            </SetProfGroup>

            <SetProfGroup icon="mail" title={t('profile.contactTitle')}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ gridColumn: '1 / -1' }}>
                  {/* email : lecture seule (passe par auth.users) */}
                  <SetInput label={t('profile.emailPro')} type="email" value={data.email} onChange={() => {}} disabled />
                </div>
                <SetInput label={t('profile.mobile')} type="tel" value={data.mobile} onChange={v => set({ mobile: v })} />
                <SetInput label={t('profile.landline')} type="tel" value={data.phone} onChange={v => set({ phone: v })} />
                <div style={{ gridColumn: '1 / -1' }}>
                  {/* agency : lecture seule (modifiable depuis Mon agence) */}
                  <SetInput
                    label={t('profile.agency')}
                    value={data.agency}
                    onChange={() => {}}
                    disabled
                    hint={t('profile.agencyHint')}
                  />
                </div>
              </div>
            </SetProfGroup>
          </div>

          {/* Colonne droite */}
          <div style={{ background: SET.card, borderRadius: 24, boxShadow: SET.shadow, overflow: 'hidden' }}>
            <SetProfGroup icon="globe" title={t('profile.publicPresentationTitle')} first>
              <SetTextarea
                value={data.bio}
                onChange={v => set({ bio: v })}
                placeholder={t('profile.bioPlaceholder')}
                rows={7}
                max={500}
              />
            </SetProfGroup>

            <SetProfGroup
              icon="pen"
              title={t('profile.signatureEmailTitle')}
              action={
                <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: SET.cardSubtle }}>
                  {(['text', 'html'] as const).map(id => {
                    const on = signatureMode === id
                    return (
                      <button
                        key={id}
                        onClick={() => set({ signatureMode: id })}
                        style={{
                          height: 30,
                          padding: '0 14px',
                          borderRadius: 999,
                          border: 0,
                          background: on ? SET.black : 'transparent',
                          color: on ? SET.blackInk : SET.inkSoft,
                          fontFamily: 'inherit',
                          fontSize: 12,
                          fontWeight: on ? 700 : 600,
                          cursor: 'pointer',
                          transition: 'all .15s',
                          boxShadow: on ? '0 4px 12px rgba(11,12,14,0.20)' : 'none',
                        }}
                      >
                        {id === 'text' ? t('profile.signatureMode.text') : t('profile.signatureMode.html')}
                      </button>
                    )
                  })}
                </div>
              }
            >
              {signatureMode === 'html' ? (
                <HtmlSignatureEditor value={data.signatureHtml || ''} onChange={v => set({ signatureHtml: v })} />
              ) : (
                <SetTextarea
                  value={data.signature}
                  onChange={v => set({ signature: v })}
                  placeholder={t('profile.signaturePlaceholder')}
                  rows={4}
                />
              )}
            </SetProfGroup>
          </div>
        </div>
      </div>

      {/* Sticky save bar — apparaît quand dirty */}
      <StickySaveBar dirty={dirty} saving={isSaving} onSave={handleSave} onCancel={handleCancel} />

      {/* Toast géré par le useToast() global — stack ressort en haut à droite. */}

      {/* Confirmation d'annulation */}
      {confirmOpen && (
        <ConfirmModal
          title={t('profile.cancelConfirm.title')}
          desc={t('profile.cancelConfirm.desc')}
          confirm={t('profile.cancelConfirm.confirm')}
          tone="warn"
          icon="alert"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            reset()
            setConfirmOpen(false)
          }}
        />
      )}

      {/* Modale photo de profil — upload géré par useAvatar (Storage + avatar_url) */}
      <AvatarPhotoModal
        open={photoOpen}
        currentUrl={displayAvatarUrl}
        fallbackBg={SET.black}
        initials={data.initials}
        onClose={() => setPhotoOpen(false)}
        onApply={async dataUrl => {
          // Upload vers le bucket `avatars` + persistance profiles.avatar_url.
          await saveDataUrl(dataUrl)
          // Reflète immédiatement dans le form (affichage instantané).
          set({ avatarUrl: dataUrl })
        }}
        onRemove={async () => {
          await removeAvatar()
          set({ avatarUrl: null })
        }}
      />
    </>
  )
}

// Export par défaut (conforme à la convention « la page importe par nom » — la
// page frozen SettingsSugarV2Page consomme l'export NOMMÉ `ProfileSection` ;
// l'alias default couvre les deux styles d'import).
export default ProfileSection

// Garde-fou : DEFAULT_PROFILE reste l'unique fallback de lecture (référencé par
// le hook). Importé ici pour conserver le lien sémantique maquette ↔ schéma.
void DEFAULT_PROFILE
