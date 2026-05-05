// MEGGA CRM Sugar v2 — Template Editor Modal (Tier 3.j stub completion)
// 1:1 port from `crm-documents-template-editor.jsx`.
// Style Sugar pur — même vocabulaire visuel que le modal "Nouveau document".

import { Fragment, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import type { DocTemplate } from './data'

interface SugarTokens {
  bg: string
  modalBg: string
  subtle: string
  black: string
  blackHov: string
  ink: string
  inkSoft: string
  muted: string
  ghost: string
  shadow: string
  shadowHov: string
  modalShad: string
  selInk: string
  overlay: string
  err: string
}

function S(dark: boolean): SugarTokens {
  if (!dark) {
    return {
      bg: 'radial-gradient(ellipse 120% 80% at 50% 100%, #C8D5E0 0%, #E2E5EB 50%, #EDEFF3 100%)',
      modalBg: '#FFFFFF',
      subtle: '#F7F8FA',
      black: '#0B0C0E',
      blackHov: '#1F2024',
      ink: '#0B0C0E',
      inkSoft: '#3A3D44',
      muted: '#7A8088',
      ghost: '#B5BAC2',
      shadow: '0 12px 40px rgba(15,23,42,0.06), 0 2px 8px rgba(15,23,42,0.03)',
      shadowHov: '0 24px 60px rgba(15,23,42,0.10), 0 4px 12px rgba(15,23,42,0.05)',
      modalShad: '0 40px 100px rgba(15,23,42,0.20), 0 8px 24px rgba(15,23,42,0.10)',
      selInk: '#FFFFFF',
      overlay: 'rgba(15,23,42,0.38)',
      err: '#EF4444',
    }
  }
  return {
    bg: 'radial-gradient(ellipse 120% 80% at 50% 100%, #1A1A28 0%, #131320 50%, #0E0E18 100%)',
    modalBg: '#16161F',
    subtle: '#1E1E2A',
    black: '#ECEDF3',
    blackHov: '#FFFFFF',
    ink: '#ECEDF3',
    inkSoft: '#B5B7C4',
    muted: '#797D90',
    ghost: '#3F4252',
    shadow: '0 12px 40px rgba(0,0,0,.5), 0 2px 8px rgba(0,0,0,.3)',
    shadowHov: '0 24px 60px rgba(0,0,0,.6), 0 4px 16px rgba(0,0,0,.4)',
    modalShad: '0 40px 100px rgba(0,0,0,.7), 0 8px 24px rgba(0,0,0,.4)',
    selInk: '#16161F',
    overlay: 'rgba(0,0,4,0.72)',
    err: '#F87171',
  }
}

const DOC_TYPES = [
  { id: 'mandate-excl', label: 'Mandat exclusif' },
  { id: 'mandate-simple', label: 'Mandat simple' },
  { id: 'promise-sale', label: 'Compromis de vente' },
  { id: 'visit-form', label: 'Bon de visite' },
  { id: 'visit-report', label: 'CR visite' },
  { id: 'estimation', label: 'Estimation' },
  { id: 'intent-letter', label: "Lettre d'intention" },
  { id: 'other', label: 'Autre' },
]

const LANG_OPTS = [
  { id: 'FR', label: 'Français' },
  { id: 'DE', label: 'Deutsch' },
  { id: 'EN', label: 'English' },
  { id: 'IT', label: 'Italiano' },
]

interface TplVar {
  id: string
  key: string
  label: string
  default: string
}

const DEFAULT_VARS: TplVar[] = [
  { id: 'v1', key: 'vendeur_nom', label: 'Nom du vendeur', default: '' },
  { id: 'v2', key: 'bien_adresse', label: 'Adresse du bien', default: '' },
  { id: 'v3', key: 'prix_mandat', label: 'Prix de mandat', default: '' },
  { id: 'v4', key: 'date_mandat', label: 'Date de signature', default: '' },
  { id: 'v5', key: 'duree_mandat', label: 'Durée (mois)', default: '12' },
  { id: 'v6', key: 'agent_nom', label: "Nom de l'agent", default: '{{agent.name}}' },
  { id: 'v7', key: 'agence_nom', label: "Nom de l'agence", default: '{{agency.name}}' },
]

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
        height: 44,
        padding: '0 24px',
        borderRadius: 999,
        border: 0,
        background: disabled ? s.ghost : hov ? s.blackHov : s.black,
        color: s.selInk,
        fontFamily: 'inherit',
        fontSize: 13.5,
        fontWeight: 700,
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        boxShadow: disabled
          ? 'none'
          : hov
            ? '0 12px 30px rgba(11,12,14,0.25)'
            : '0 6px 16px rgba(11,12,14,0.18)',
        transform: hov && !disabled ? 'translateY(-1px)' : 'translateY(0)',
        transition: 'all .18s ease',
        opacity: disabled ? 0.5 : 1,
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
        height: 44,
        padding: '0 20px',
        borderRadius: 999,
        border: 0,
        background: hov ? s.subtle : 'transparent',
        color: s.inkSoft,
        fontFamily: 'inherit',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'background .18s',
      }}
    >
      {children}
    </button>
  )
}

interface FieldProps {
  label: string
  children: ReactNode
  s: SugarTokens
}

function Field({ label, children, s }: FieldProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: s.muted,
          letterSpacing: '.08em',
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      {children}
    </div>
  )
}

interface InputProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  s: SugarTokens
}

function Input({ value, onChange, placeholder, s }: InputProps) {
  return (
    <input
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        border: 0,
        background: s.modalBg,
        boxShadow: s.shadow,
        color: s.ink,
        fontSize: 13.5,
        fontFamily: 'inherit',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
      }}
    />
  )
}

interface TextareaProps {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  rows?: number
  s: SugarTokens
}

function Textarea({ value, onChange, placeholder, rows, s }: TextareaProps) {
  return (
    <textarea
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows || 3}
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        border: 0,
        background: s.modalBg,
        boxShadow: s.shadow,
        color: s.ink,
        fontSize: 13,
        fontFamily: 'inherit',
        outline: 'none',
        width: '100%',
        boxSizing: 'border-box',
        resize: 'vertical',
        lineHeight: 1.55,
      }}
    />
  )
}

interface PillSelectProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: { id: T; label: string }[]
  s: SugarTokens
}

function PillSelect<T extends string>({
  value,
  onChange,
  options,
  s,
}: PillSelectProps<T>) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {options.map(o => {
        const active = o.id === value
        return (
          <button
            key={o.id}
            onClick={() => onChange(o.id)}
            style={{
              padding: '9px 16px',
              borderRadius: 999,
              border: 0,
              background: active ? s.black : s.subtle,
              color: active ? s.selInk : s.ink,
              fontSize: 12.5,
              fontWeight: active ? 700 : 600,
              fontFamily: 'inherit',
              cursor: 'pointer',
              boxShadow: active ? '0 4px 12px rgba(11,12,14,0.18)' : s.shadow,
              transition: 'all .18s',
            }}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

interface VarEditorProps {
  vars: TplVar[]
  onChange: (vars: TplVar[]) => void
  s: SugarTokens
}

function VarEditor({ vars, onChange, s }: VarEditorProps) {
  const addVar = () => {
    onChange([
      ...vars,
      { id: 'v' + Date.now(), key: '', label: '', default: '' },
    ])
  }
  const removeVar = (id: string) => onChange(vars.filter(v => v.id !== id))
  const updateVar = (id: string, field: keyof TplVar, val: string) =>
    onChange(vars.map(v => (v.id === id ? { ...v, [field]: val } : v)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {vars.map(v => (
        <div
          key={v.id}
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            gap: 8,
            padding: '12px 14px',
            borderRadius: 14,
            background: s.modalBg,
            boxShadow: s.shadow,
            alignItems: 'center',
          }}
        >
          <input
            value={v.label}
            onChange={e => updateVar(v.id, 'label', e.target.value)}
            placeholder="Libellé (ex: Nom du vendeur)"
            style={{
              border: 0,
              background: 'transparent',
              color: s.ink,
              fontSize: 13,
              fontFamily: 'inherit',
              outline: 'none',
              padding: '2px 0',
            }}
          />
          <input
            value={v.key}
            onChange={e => updateVar(v.id, 'key', e.target.value)}
            placeholder="clé (ex: vendeur_nom)"
            style={{
              border: 0,
              background: s.subtle,
              color: s.muted,
              borderRadius: 8,
              fontSize: 11.5,
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              outline: 'none',
              padding: '5px 10px',
            }}
          />
          <button
            onClick={() => removeVar(v.id)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: 0,
              background: 'transparent',
              cursor: 'pointer',
              color: s.ghost,
              display: 'grid',
              placeItems: 'center',
              transition: 'color .15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = s.err
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = s.ghost
            }}
          >
            <svg
              width="12"
              height="12"
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
      ))}

      <button
        onClick={addVar}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          padding: '12px 16px',
          borderRadius: 14,
          border: 0,
          background: s.subtle,
          color: s.muted,
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 600,
          cursor: 'pointer',
          transition: 'background .15s',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.background = s.modalBg
          e.currentTarget.style.color = s.ink
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = s.subtle
          e.currentTarget.style.color = s.muted
        }}
      >
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 5v14M5 12h14" />
        </svg>
        Ajouter une variable
      </button>
    </div>
  )
}

interface FormState {
  name: string
  type: string
  lang: string
  desc: string
  pages: number
}

interface TemplatePreviewProps {
  form: FormState
  vars: TplVar[]
  s: SugarTokens
}

function TemplatePreview({ form, vars, s }: TemplatePreviewProps) {
  return (
    <div
      style={{
        background: s.modalBg,
        borderRadius: 18,
        boxShadow: s.shadow,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {/* Mini A4 */}
      <div
        style={{
          aspectRatio: '1 / 1.414',
          background: '#FFFFFF',
          borderRadius: 8,
          boxShadow: '0 8px 28px -10px rgba(0,0,0,.18)',
          overflow: 'hidden',
          position: 'relative',
          maxWidth: 200,
          margin: '0 auto',
          width: '100%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: '0 0 auto 0',
            height: 4,
            background: s.black,
          }}
        />
        <div
          style={{
            padding: '16px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            height: '100%',
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
          <div>
            <div
              style={{
                fontSize: 6.5,
                letterSpacing: '.18em',
                color: '#7A8079',
                textTransform: 'uppercase',
                marginBottom: 3,
              }}
            >
              {DOC_TYPES.find(t => t.id === form.type)?.label || '—'}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                lineHeight: 1.2,
                color: '#0B0C0E',
              }}
            >
              {form.name || 'Nom du modèle'}
            </div>
          </div>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                style={{
                  height: 2.5,
                  borderRadius: 1.5,
                  background: '#E4E8EE',
                  width: i % 3 === 0 ? '65%' : i % 3 === 1 ? '90%' : '78%',
                }}
              />
            ))}
          </div>
          <div
            style={{
              borderTop: '1px solid #E4E8EE',
              paddingTop: 5,
              fontSize: 5.5,
              color: '#7A8079',
              display: 'flex',
              justifyContent: 'space-between',
            }}
          >
            <span>{form.lang}</span>
            <span>MEGGA · Genève</span>
          </div>
        </div>
      </div>

      {/* Résumé */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'max-content 1fr',
          columnGap: 14,
          rowGap: 8,
          fontSize: 12.5,
        }}
      >
        <span style={{ color: s.muted }}>Nom</span>
        <span style={{ color: s.ink, fontWeight: 700 }}>{form.name || '—'}</span>
        <span style={{ color: s.muted }}>Type</span>
        <span style={{ color: s.ink, fontWeight: 600 }}>
          {DOC_TYPES.find(t => t.id === form.type)?.label || '—'}
        </span>
        <span style={{ color: s.muted }}>Langue</span>
        <span style={{ color: s.ink, fontWeight: 600 }}>{form.lang}</span>
        <span style={{ color: s.muted }}>Variables</span>
        <span style={{ color: s.ink, fontWeight: 600 }}>{vars.length}</span>
      </div>

      {/* Liste des variables */}
      {vars.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: s.muted,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
            }}
          >
            Variables
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {vars.map(v => (
              <div
                key={v.id}
                style={{
                  padding: '4px 10px',
                  borderRadius: 999,
                  background: s.subtle,
                  color: s.ink,
                  fontSize: 11.5,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                {`{{${v.key || '…'}}}`}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export interface TemplateEditorPayload extends FormState {
  vars: TplVar[]
}

interface TemplateEditorModalProps {
  template: DocTemplate | null
  dark: boolean
  onClose: () => void
  onSave?: (payload: TemplateEditorPayload) => void
}

export function TemplateEditorModal({
  template,
  dark,
  onClose,
  onSave,
}: TemplateEditorModalProps) {
  const s = S(dark)
  const isNew = !template

  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [form, setForm] = useState<FormState>({
    name: template?.name || '',
    type: template?.type || 'mandate-excl',
    lang: template?.lang || 'FR',
    desc: template?.desc || '',
    pages: template?.pages || 6,
  })
  const [vars, setVars] = useState<TplVar[]>(
    template ? DEFAULT_VARS.slice(0, template.vars || 4) : DEFAULT_VARS.slice(0, 4),
  )

  const set =
    <K extends keyof FormState>(k: K) =>
    (v: FormState[K]) =>
      setForm(f => ({ ...f, [k]: v }))
  const canStep1 = form.name.trim().length > 0
  const canStep2 = vars.every(v => v.key.trim().length > 0)

  const titles: Record<1 | 2 | 3, string> = {
    1: isNew ? 'Nouveau modèle' : 'Modifier le modèle',
    2: 'Variables',
    3: 'Aperçu & enregistrement',
  }

  const goNext = () => {
    if (step === 1 && canStep1) setStep(2)
    else if (step === 2 && canStep2) setStep(3)
    else if (step === 3) {
      if (onSave) onSave({ ...form, vars })
      onClose()
    }
  }
  const goBack = () => {
    if (step > 1) setStep(prev => (prev === 3 ? 2 : 1))
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
          maxWidth: 600,
          background: dark ? s.modalBg : '#EDEFF3',
          backgroundImage: dark ? 'none' : s.bg,
          borderRadius: 28,
          boxShadow: s.modalShad,
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
                        background: active ? s.black : done ? s.inkSoft : s.subtle,
                        color: active || done ? s.selInk : s.muted,
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
                          background: n < step ? s.inkSoft : s.subtle,
                          transition: 'background .3s',
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
        <div style={{ padding: '6px 30px 20px', flexShrink: 0 }}>
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
            {titles[step]}
          </h2>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 26px 8px' }}>
          {step === 1 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                paddingBottom: 8,
              }}
            >
              <div
                style={{
                  background: s.modalBg,
                  borderRadius: 20,
                  boxShadow: s.shadow,
                  padding: '20px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 18,
                }}
              >
                <Field label="Nom du modèle" s={s}>
                  <Input
                    value={form.name}
                    onChange={set('name')}
                    placeholder="Ex : Mandat exclusif — Standard Genève"
                    s={s}
                  />
                </Field>
                <Field label="Type de document" s={s}>
                  <PillSelect
                    value={form.type}
                    onChange={set('type')}
                    options={DOC_TYPES}
                    s={s}
                  />
                </Field>
                <Field label="Langue" s={s}>
                  <PillSelect
                    value={form.lang}
                    onChange={set('lang')}
                    options={LANG_OPTS}
                    s={s}
                  />
                </Field>
                <Field label="Description" s={s}>
                  <Textarea
                    value={form.desc}
                    onChange={set('desc')}
                    placeholder="Description courte — clauses incluses, cas d'usage…"
                    rows={2}
                    s={s}
                  />
                </Field>
                <Field label="Nombre de pages" s={s}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button
                      onClick={() => set('pages')(Math.max(1, form.pages - 1))}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        border: 0,
                        background: s.subtle,
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: s.shadow,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={s.ink}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M5 12h14" />
                      </svg>
                    </button>
                    <span
                      style={{
                        fontSize: 20,
                        fontWeight: 800,
                        color: s.ink,
                        minWidth: 32,
                        textAlign: 'center',
                      }}
                    >
                      {form.pages}
                    </span>
                    <button
                      onClick={() => set('pages')(form.pages + 1)}
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 999,
                        border: 0,
                        background: s.subtle,
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                        boxShadow: s.shadow,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke={s.ink}
                        strokeWidth="2.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                    <span style={{ fontSize: 12, color: s.muted, marginLeft: 4 }}>
                      pages
                    </span>
                  </div>
                </Field>
              </div>
            </div>
          )}

          {step === 2 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                paddingBottom: 8,
              }}
            >
              <div
                style={{
                  padding: '12px 16px',
                  borderRadius: 16,
                  background: s.modalBg,
                  boxShadow: s.shadow,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                <div
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 10,
                    flexShrink: 0,
                    background: s.subtle,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={s.ink}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M4 7h16M4 12h10M4 17h7" />
                  </svg>
                </div>
                <div style={{ fontSize: 12.5, color: s.inkSoft, lineHeight: 1.5 }}>
                  Les variables sont remplies automatiquement depuis les données du
                  dossier. Utilisez la syntaxe{' '}
                  <code
                    style={{
                      fontSize: 11.5,
                      background: s.subtle,
                      padding: '1px 6px',
                      borderRadius: 5,
                    }}
                  >
                    {'{{clé}}'}
                  </code>{' '}
                  dans le corps du document.
                </div>
              </div>
              <VarEditor vars={vars} onChange={setVars} s={s} />
            </div>
          )}

          {step === 3 && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                paddingBottom: 8,
              }}
            >
              <TemplatePreview form={form} vars={vars} s={s} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 26px 20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {step > 1 ? (
            <GhostPill onClick={goBack} s={s}>
              Retour
            </GhostPill>
          ) : (
            <GhostPill onClick={onClose} s={s}>
              Annuler
            </GhostPill>
          )}
          <BlackPill
            onClick={goNext}
            disabled={step === 1 ? !canStep1 : step === 2 ? !canStep2 : false}
            s={s}
          >
            {step === 3 ? (isNew ? 'Créer le modèle' : 'Enregistrer') : 'Continuer'}
            {step < 3 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={
                  (step === 1 ? canStep1 : canStep2) ? s.selInk : s.muted
                }
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M5 12h14" />
                <path d="M12 5l7 7-7 7" />
              </svg>
            )}
            {step === 3 && (
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke={s.selInk}
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m5 13 4 4 10-12" />
              </svg>
            )}
          </BlackPill>
        </div>
      </div>
    </div>,
    document.body,
  )
}
