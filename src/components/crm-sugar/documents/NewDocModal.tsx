// MEGGA CRM Sugar v2 — Modal "Nouveau document" v3 (Tier 3.j stub completion)
// 1:1 port from `crm-documents-new-modal.jsx`.
// Style Sugar pur — repris du Step 0 du wizard. Cards blanches, ombres douces,
// AUCUNE bordure, accent noir.

import { Fragment, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { DocIcon, type DocIconName } from './atoms'
import type { DocFolder, DocPhaseId, DocTemplate } from './data'

type ModeId = 'template' | 'upload' | null

const PHASE_COLORS: Record<DocPhaseId, string> = {
  mandate: '#1E5BC6',
  prep: '#1E5BC6',
  visits: '#0891B2',
  offer: '#C45A00',
  promise: '#059669',
  deed: '#0B0C0E',
}

interface SugarTokens {
  bg: string
  modalBg: string
  cardSubtle: string
  black: string
  blackHover: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  shadow: string
  shadowLg: string
  shadowHov: string
  modalShadow: string
  selectBg: string
  selectInk: string
  overlay: string
}

function sugarTokens(dark: boolean): SugarTokens {
  if (!dark) {
    return {
      bg: 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
      modalBg: '#FFFFFF',
      cardSubtle: '#F7F8FA',
      black: '#0B0C0E',
      blackHover: '#1F2024',
      ink: '#0B0C0E',
      inkSoft: '#3A3D44',
      muted: '#7A8088',
      ghost: '#B5BAC2',
      shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
      shadowLg: '0 24px 60px rgba(15,23,42,0.10), 0 4px 16px rgba(15,23,42,0.05)',
      shadowHov: '0 32px 70px rgba(15,23,42,0.12), 0 6px 20px rgba(15,23,42,0.05)',
      modalShadow: '0 40px 100px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.08)',
      selectBg: '#0B0C0E',
      selectInk: '#FFFFFF',
      overlay: 'rgba(15,23,42,0.32)',
    }
  }
  return {
    bg: 'radial-gradient(ellipse 120% 80% at 50% 100%, #1A1A28 0%, #131320 50%, #0E0E18 100%)',
    modalBg: '#16161F',
    cardSubtle: '#1E1E2A',
    black: '#ECEDF3',
    blackHover: '#FFFFFF',
    ink: '#ECEDF3',
    inkSoft: '#B5B7C4',
    muted: '#797D90',
    ghost: '#3F4252',
    shadow: '0 12px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3)',
    shadowLg: '0 24px 60px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4)',
    shadowHov: '0 32px 70px rgba(0,0,0,.7), 0 6px 20px rgba(0,0,0,.5)',
    modalShadow: '0 40px 100px rgba(0,0,0,.7), 0 8px 24px rgba(0,0,0,.4)',
    selectBg: '#ECEDF3',
    selectInk: '#16161F',
    overlay: 'rgba(0,0,4,0.68)',
  }
}

interface TemplateCardProps {
  tpl: DocTemplate
  selected: boolean
  onClick: () => void
  s: SugarTokens
}

function TemplateCard({ tpl, selected, onClick, s }: TemplateCardProps) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '16px 18px',
        borderRadius: 20,
        width: '100%',
        textAlign: 'left',
        background: selected ? s.cardSubtle : s.modalBg,
        border: 0,
        cursor: 'pointer',
        fontFamily: 'inherit',
        boxShadow: selected
          ? `0 0 0 2px ${s.black}, ${s.shadow}`
          : hov
            ? s.shadowHov
            : s.shadow,
        transform: hov && !selected ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .2s cubic-bezier(.2,.8,.2,1)',
      }}
    >
      <div
        style={{
          width: 44,
          height: 44,
          borderRadius: 14,
          flexShrink: 0,
          background: s.cardSubtle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <DocIcon name="file-check" size={18} color={s.ink} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 700,
            color: s.ink,
            letterSpacing: '-0.2px',
            marginBottom: 3,
          }}
        >
          {tpl.name}
        </div>
        <div style={{ fontSize: 12, color: s.muted, lineHeight: 1.45 }}>{tpl.desc}</div>
      </div>
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          flexShrink: 0,
          background: selected ? s.black : 'transparent',
          border: selected ? 0 : `2px solid ${s.ghost}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all .2s',
        }}
      >
        {selected && (
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6l3 3 5-5"
              stroke={s.selectInk}
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </button>
  )
}

interface FolderSelectProps {
  folders: DocFolder[]
  value: string | null
  onChange: (id: string) => void
  s: SugarTokens
}

function FolderSelect({ folders, value, onChange, s }: FolderSelectProps) {
  const active = folders.filter(f => !f.isArchived)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: s.muted,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
        }}
      >
        Associer à un dossier
      </div>
      <div
        style={{
          background: s.modalBg,
          borderRadius: 18,
          boxShadow: s.shadow,
          overflow: 'hidden',
          maxHeight: 184,
          overflowY: 'auto',
        }}
      >
        {active.map(f => {
          const sel = value === f.id
          return (
            <button
              key={f.id}
              onClick={() => onChange(f.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 16px',
                textAlign: 'left',
                fontFamily: 'inherit',
                background: sel ? s.cardSubtle : 'transparent',
                border: 0,
                width: '100%',
                cursor: 'pointer',
                transition: 'background .15s',
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: PHASE_COLORS[f.currentPhase] || s.muted,
                }}
              />
              <span
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: sel ? 700 : 500,
                  color: s.ink,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.title}
              </span>
              {sel && (
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={s.black}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m5 13 4 4 10-12" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

interface DropZoneProps {
  file: File | null
  onFile: (f: File) => void
  s: SugarTokens
}

function DropZone({ file, onFile, s }: DropZoneProps) {
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={e => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => {
        e.preventDefault()
        setDrag(false)
        const f = e.dataTransfer.files[0]
        if (f) onFile(f)
      }}
      onClick={() => ref.current?.click()}
      style={{
        borderRadius: 20,
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        cursor: 'pointer',
        background: drag ? s.cardSubtle : s.modalBg,
        boxShadow: drag ? `0 0 0 2px ${s.black}, ${s.shadow}` : s.shadow,
        transition: 'all .2s',
      }}
    >
      <input
        ref={ref}
        type="file"
        accept=".pdf,.docx,.doc"
        style={{ display: 'none' }}
        onChange={e => {
          const f = e.target.files?.[0]
          if (f) onFile(f)
        }}
      />
      {file ? (
        <>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: '#05966914',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DocIcon name="file-check" size={24} color="#059669" />
          </div>
          <div
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: s.ink,
              textAlign: 'center',
              letterSpacing: '-0.2px',
            }}
          >
            {file.name}
          </div>
          <div style={{ fontSize: 12, color: s.muted }}>Cliquer pour changer</div>
        </>
      ) : (
        <>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 16,
              background: s.cardSubtle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <DocIcon name="upload" size={24} color={s.ink} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: s.ink,
                letterSpacing: '-0.2px',
              }}
            >
              Glisser un fichier ici
            </div>
            <div style={{ fontSize: 12, color: s.muted, marginTop: 4 }}>
              PDF ou Word — jusqu'à 50 Mo
            </div>
          </div>
        </>
      )}
    </div>
  )
}

interface BlackPillProps {
  onClick: () => void
  disabled?: boolean
  children: ReactNode
  s: SugarTokens
}

function BlackPill({ onClick, disabled, children, s }: BlackPillProps) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 46,
        padding: '0 24px',
        borderRadius: 999,
        border: 0,
        background: disabled ? s.ghost : hov ? s.blackHover : s.black,
        color: s.selectInk,
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: 600,
        letterSpacing: '0.1px',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 10,
        boxShadow: disabled
          ? 'none'
          : hov
            ? '0 12px 30px rgba(11,12,14,0.25)'
            : '0 6px 16px rgba(11,12,14,0.18)',
        transform: hov && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .18s ease',
      }}
    >
      {children}
    </button>
  )
}

interface GhostPillProps {
  onClick: () => void
  children: ReactNode
  s: SugarTokens
}

function GhostPill({ onClick, children, s }: GhostPillProps) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        height: 46,
        padding: '0 22px',
        borderRadius: 999,
        border: 0,
        background: hov ? s.cardSubtle : 'transparent',
        color: s.inkSoft,
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background .18s',
      }}
    >
      {children}
    </button>
  )
}

interface GateCardProps {
  icon: DocIconName
  title: string
  sub: string
  onClick: () => void
  recommended?: boolean
  s: SugarTokens
}

function GateCard({ icon, title, sub, onClick, recommended, s }: GateCardProps) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        position: 'relative',
        width: '100%',
        padding: '28px 28px 24px',
        background: s.modalBg,
        border: 0,
        borderRadius: 24,
        textAlign: 'left',
        fontFamily: 'inherit',
        cursor: 'pointer',
        boxShadow: hov ? s.shadowHov : s.shadow,
        transform: hov ? 'translateY(-3px)' : 'translateY(0)',
        transition: 'all .25s cubic-bezier(.2,.8,.2,1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {recommended && (
        <span
          style={{
            position: 'absolute',
            top: 18,
            right: 18,
            padding: '5px 11px',
            borderRadius: 999,
            background: s.black,
            color: s.selectInk,
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.5px',
            textTransform: 'uppercase',
          }}
        >
          Recommandé
        </span>
      )}
      <div
        style={{
          width: 52,
          height: 52,
          borderRadius: 16,
          background: s.cardSubtle,
          color: s.ink,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <DocIcon name={icon} size={24} color={s.ink} />
      </div>
      <div>
        <h3
          style={{
            margin: '0 0 6px',
            fontSize: 18,
            fontWeight: 700,
            color: s.ink,
            letterSpacing: '-0.3px',
            lineHeight: 1.25,
          }}
        >
          {title}
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: s.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {sub}
        </p>
      </div>
      <div
        style={{
          marginTop: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: hov ? s.black : s.muted,
          fontSize: 13,
          fontWeight: 600,
          transition: 'color .2s',
        }}
      >
        Choisir
        <span
          style={{
            display: 'inline-flex',
            transform: hov ? 'translateX(4px)' : 'translateX(0)',
            transition: 'transform .25s ease',
          }}
        >
          →
        </span>
      </div>
    </button>
  )
}

export interface NewDocPayload {
  mode: 'template' | 'upload'
  folderId: string
  templateId?: string
  file?: File
  docName?: string
}

interface NewDocModalProps {
  folders: DocFolder[]
  /** Document templates. Optional — when empty, the "Depuis un modèle" path is hidden. */
  templates?: DocTemplate[]
  dark: boolean
  /** When true, the "Importer le document" CTA is disabled (upload in flight). */
  uploading?: boolean
  onClose: () => void
  onCreate?: (payload: NewDocPayload) => void
}

export function NewDocModal({
  folders,
  templates = [],
  dark,
  uploading = false,
  onClose,
  onCreate,
}: NewDocModalProps) {
  const templatesAvailable = templates.length > 0
  const s = sugarTokens(dark)

  const [mode, setMode] = useState<ModeId>(null)
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [selTpl, setSelTpl] = useState<string | null>(null)
  const [selFolder, setSelFolder] = useState<string | null>(
    folders.find(f => !f.isArchived)?.id || null,
  )
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [docName, setDocName] = useState('')

  const canProceed =
    mode === 'template'
      ? !!selTpl && !!selFolder
      : mode === 'upload'
        ? !!uploadFile && !!selFolder
        : false

  const goMode = (m: 'template' | 'upload') => {
    setMode(m)
    setStep(2)
  }
  const goBack = () => {
    if (step === 2) {
      setStep(1)
      setMode(null)
    } else if (step === 3) {
      setStep(2)
    }
  }
  const goNext = () => {
    if (step === 2 && canProceed) {
      // Le parent ferme la modal sur succès via onClose (et garde la modal
      // ouverte avec un toast d'erreur en cas d'échec). On n'avance plus
      // automatiquement à step 3 — le toast suffit comme confirmation.
      if (onCreate && mode && selFolder) {
        onCreate({
          mode,
          folderId: selFolder,
          templateId: mode === 'template' ? selTpl ?? undefined : undefined,
          file: mode === 'upload' ? uploadFile ?? undefined : undefined,
          docName: mode === 'upload' ? docName || undefined : undefined,
        })
      }
    } else if (step === 3) {
      onClose()
    }
  }

  const selFolderObj = folders.find(f => f.id === selFolder)
  const selTplObj = templates.find(t => t.id === selTpl)

  const titleMap: Record<1 | 2 | 3, string> = {
    1: 'Nouveau document',
    2: mode === 'template' ? 'Choisir un modèle' : 'Importer un fichier',
    3: 'Document prêt',
  }
  const subtitleMap: Record<1 | 2 | 3, string | null> = {
    1: 'Que voulez-vous faire ?',
    2:
      mode === 'template'
        ? 'Sélectionnez le modèle à utiliser'
        : 'Glissez votre fichier ou choisissez-le',
    3: null,
  }

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: s.overlay,
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 580,
          background: dark ? s.modalBg : '#EDEFF3',
          backgroundImage: dark ? 'none' : s.bg,
          borderRadius: 28,
          boxShadow: s.modalShadow,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '92vh',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '22px 26px 8px',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {step > 1 && (
              <button
                onClick={goBack}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 999,
                  border: 0,
                  background: s.modalBg,
                  cursor: 'pointer',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: s.shadow,
                  flexShrink: 0,
                  transition: 'transform .15s',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateX(-2px)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'translateX(0)'
                }}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke={s.ink}
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M19 12H5" />
                  <path d="M12 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
              {[1, 2, 3].map((n, i) => {
                const done = n < step
                const active = n === step
                return (
                  <Fragment key={n}>
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 999,
                        background: active ? s.black : done ? s.inkSoft : s.cardSubtle,
                        color: active || done ? s.selectInk : s.muted,
                        fontSize: 11,
                        fontWeight: 700,
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: active
                          ? '0 4px 12px rgba(11,12,14,0.25), 0 0 0 3px rgba(11,12,14,0.06)'
                          : 'none',
                        transition: 'all .2s ease',
                      }}
                    >
                      {done ? '✓' : n}
                    </div>
                    {i < 2 && (
                      <div
                        style={{
                          width: 18,
                          height: 2,
                          background: n < step ? s.inkSoft : s.cardSubtle,
                          transition: 'background .3s ease',
                        }}
                      />
                    )}
                  </Fragment>
                )
              })}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: 0,
              background: s.modalBg,
              cursor: 'pointer',
              color: s.muted,
              display: 'grid',
              placeItems: 'center',
              boxShadow: s.shadow,
              transition: 'transform .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.transform = 'rotate(90deg)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.transform = 'rotate(0deg)'
            }}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Title */}
        <div style={{ padding: '6px 30px 22px', flexShrink: 0 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 24,
              fontWeight: 700,
              color: s.ink,
              letterSpacing: '-0.6px',
              lineHeight: 1.15,
            }}
          >
            {titleMap[step]}
          </h2>
          {subtitleMap[step] && (
            <p
              style={{
                margin: '6px 0 0',
                fontSize: 13.5,
                color: s.muted,
                fontWeight: 500,
              }}
            >
              {subtitleMap[step]}
            </p>
          )}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 26px 8px' }}>
          {step === 1 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                paddingBottom: 8,
              }}
            >
              {templatesAvailable && (
                <GateCard
                  icon="template"
                  title="Depuis un modèle"
                  sub="Pré-rempli avec les données du dossier — prêt à signer en quelques secondes."
                  onClick={() => goMode('template')}
                  recommended
                  s={s}
                />
              )}
              <GateCard
                icon="upload"
                title="Importer un document"
                sub="Glissez un PDF ou Word existant — il sera ajouté au dossier choisi."
                onClick={() => goMode('upload')}
                s={s}
              />
            </div>
          )}

          {step === 2 && mode === 'template' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 22,
                paddingBottom: 8,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {templates.map(tpl => (
                  <TemplateCard
                    key={tpl.id}
                    tpl={tpl}
                    selected={selTpl === tpl.id}
                    onClick={() => setSelTpl(tpl.id)}
                    s={s}
                  />
                ))}
              </div>
              <FolderSelect
                folders={folders}
                value={selFolder}
                onChange={setSelFolder}
                s={s}
              />
            </div>
          )}

          {step === 2 && mode === 'upload' && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                paddingBottom: 8,
              }}
            >
              <DropZone file={uploadFile} onFile={setUploadFile} s={s} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    color: s.muted,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  Nom du document
                </div>
                <input
                  value={docName}
                  onChange={e => setDocName(e.target.value)}
                  placeholder={
                    uploadFile
                      ? uploadFile.name.replace(/\.[^.]+$/, '')
                      : 'Ex : Rapport expertise — Villa Eaux-Vives'
                  }
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: 0,
                    background: s.modalBg,
                    boxShadow: s.shadow,
                    color: s.ink,
                    fontSize: 13.5,
                    fontFamily: 'inherit',
                    outline: 'none',
                  }}
                />
              </div>
              <FolderSelect
                folders={folders}
                value={selFolder}
                onChange={setSelFolder}
                s={s}
              />
            </div>
          )}

          {step === 3 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 22,
                padding: '12px 0 16px',
              }}
            >
              <div
                style={{
                  width: 76,
                  height: 76,
                  borderRadius: 24,
                  background: s.modalBg,
                  boxShadow: s.shadowLg,
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 18,
                    background: '#05966914',
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <svg
                    width="28"
                    height="28"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#059669"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m5 13 4 4 10-12" />
                  </svg>
                </div>
              </div>
              <div style={{ textAlign: 'center', maxWidth: 380 }}>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 700,
                    color: s.ink,
                    marginBottom: 8,
                    letterSpacing: '-0.4px',
                  }}
                >
                  {mode === 'template' ? 'Document généré' : 'Document importé'}
                </div>
                <div
                  style={{
                    fontSize: 13,
                    color: s.inkSoft,
                    lineHeight: 1.65,
                    fontWeight: 500,
                  }}
                >
                  {mode === 'template' ? (
                    <>
                      <strong style={{ color: s.ink, fontWeight: 700 }}>
                        {selTplObj?.name}
                      </strong>{' '}
                      a été créé
                    </>
                  ) : (
                    <>
                      <strong style={{ color: s.ink, fontWeight: 700 }}>
                        {docName || uploadFile?.name}
                      </strong>{' '}
                      a été importé
                    </>
                  )}{' '}
                  et ajouté à
                  <br />
                  <strong style={{ color: s.ink, fontWeight: 700 }}>
                    {selFolderObj?.title}
                  </strong>
                  .
                </div>
              </div>

              {mode === 'template' && (
                <div
                  style={{
                    display: 'flex',
                    gap: 12,
                    padding: '14px 18px',
                    borderRadius: 18,
                    background: s.modalBg,
                    boxShadow: s.shadow,
                    width: '100%',
                    alignItems: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      background: s.cardSubtle,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <DocIcon name="sparkles" size={14} color={s.ink} />
                  </div>
                  <div style={{ fontSize: 12.5, color: s.inkSoft, lineHeight: 1.5 }}>
                    Variables pré-remplies. Ouvrez-le dans le Studio pour finaliser.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {(step === 2 || step === 3) && (
          <div
            style={{
              padding: '18px 26px 22px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 10,
              flexShrink: 0,
            }}
          >
            {step === 3 ? (
              <>
                <GhostPill onClick={onClose} s={s}>
                  Fermer
                </GhostPill>
                <BlackPill onClick={onClose} s={s}>
                  <DocIcon name="sparkles" size={13} color={s.selectInk} />
                  Ouvrir dans Studio
                </BlackPill>
              </>
            ) : (
              <>
                <GhostPill onClick={goBack} s={s}>
                  Retour
                </GhostPill>
                <BlackPill onClick={goNext} disabled={!canProceed || uploading} s={s}>
                  {uploading
                    ? 'Envoi en cours…'
                    : mode === 'template' ? 'Générer le document' : 'Importer le document'}
                  {!uploading && (
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={canProceed ? s.selectInk : s.muted}
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14" />
                      <path d="M12 5l7 7-7 7" />
                    </svg>
                  )}
                </BlackPill>
              </>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
