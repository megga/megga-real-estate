/**
 * Les deux modales du studio : le nom d'un dossier (créer / renommer) et la
 * confirmation d'une suppression (dossier ou production).
 *
 * Portées dans `<body>` (CLAUDE.md §3), voile ASSOMBRISSANT (`voile-modale.spec.ts`),
 * Échap et clic dehors ferment — depuis l'écran actif seul (`useEcranActif`).
 */
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useEcranActif } from '@/hooks/useEcranActif'
import { LABS_TRANSITION, type LabsSurfaces } from './labsTokens'

const Z_MODALE = 100

function Coquille(p: { ls: LabsSurfaces; label: string; onClose: () => void; busy?: boolean; children: ReactNode }) {
  const actif = useEcranActif()
  useEffect(() => {
    if (!actif) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !p.busy) p.onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actif, p])
  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={p.label}
      onClick={(e) => { if (e.target === e.currentTarget && !p.busy) p.onClose() }}
      style={{
        position: 'fixed', inset: 0, zIndex: Z_MODALE, display: 'grid', placeItems: 'center', padding: 'var(--crm-space-6xl)',
        background: p.ls.photoVeil(0.5), backdropFilter: 'blur(8px)', fontFamily: 'var(--crm-font), sans-serif', color: p.ls.ink,
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)', background: p.ls.solid, border: `1px solid ${p.ls.solidBorder}`, borderRadius: 'var(--crm-radius-6xl)',
          boxShadow: p.ls.solidShadow, padding: 'var(--crm-space-6xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)',
        }}
      >
        {p.children}
      </div>
    </div>,
    document.body,
  )
}

function Bouton(p: { ls: LabsSurfaces; onClick: () => void; primary?: boolean; danger?: boolean; disabled?: boolean; children: ReactNode }) {
  const bg = p.primary ? (p.danger ? p.ls.danger : p.ls.accent) : p.ls.elev
  const ink = p.primary ? (p.danger ? p.ls.dangerInk : p.ls.accentInk) : p.ls.ink
  return (
    <button
      type="button"
      onClick={p.onClick}
      disabled={p.disabled}
      style={{
        height: 40, padding: '0 var(--crm-space-2xl)', border: p.primary ? 0 : `1px solid ${p.ls.bord}`, borderRadius: 'var(--crm-radius-lg)',
        background: bg, color: ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
        cursor: p.disabled ? 'not-allowed' : 'pointer', opacity: p.disabled ? 0.5 : 1, transition: LABS_TRANSITION,
      }}
    >
      {p.children}
    </button>
  )
}

export function LabsFolderModal(p: { ls: LabsSurfaces; mode: 'create' | 'rename'; initialName?: string; busy: boolean; onSubmit: (name: string) => void; onClose: () => void }) {
  const { t } = useTranslation('labs')
  const [name, setName] = useState(p.initialName ?? '')
  const input = useRef<HTMLInputElement | null>(null)
  useEffect(() => { input.current?.focus(); input.current?.select() }, [])
  const ok = name.trim().length > 0 && name.trim().length <= 80
  const titre = p.mode === 'create' ? t('folderModal.createTitle') : t('folderModal.renameTitle')
  return (
    <Coquille ls={p.ls} label={titre} onClose={p.onClose} busy={p.busy}>
      <h2 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: '-0.01em' }}>{titre}</h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)', fontSize: 'var(--crm-text-sm)', color: p.ls.sub }}>
        {t('folderModal.name')}
        <input
          ref={input}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && ok && !p.busy) p.onSubmit(name.trim()) }}
          placeholder={t('folderModal.placeholder')}
          maxLength={80}
          style={{
            height: 40, border: `1px solid ${p.ls.bord}`, borderRadius: 'var(--crm-radius-md)', background: p.ls.elev, color: p.ls.ink,
            fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', padding: '0 var(--crm-space-lg)', outline: 'none',
          }}
        />
      </label>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-sm)' }}>
        <Bouton ls={p.ls} onClick={p.onClose} disabled={p.busy}>{t('folderModal.cancel')}</Bouton>
        <Bouton ls={p.ls} primary onClick={() => p.onSubmit(name.trim())} disabled={!ok || p.busy}>
          {p.mode === 'create' ? t('folderModal.create') : t('folderModal.save')}
        </Bouton>
      </div>
    </Coquille>
  )
}

export function LabsConfirmModal(p: { ls: LabsSurfaces; title: string; body: string; confirmLabel: string; busy: boolean; onConfirm: () => void; onClose: () => void }) {
  const { t } = useTranslation('labs')
  return (
    <Coquille ls={p.ls} label={p.title} onClose={p.onClose} busy={p.busy}>
      <h2 style={{ margin: 0, fontSize: 'var(--crm-text-3xl)', fontWeight: 600, letterSpacing: '-0.01em' }}>{p.title}</h2>
      <p style={{ margin: 0, fontSize: 'var(--crm-text-md)', lineHeight: 1.5, color: p.ls.sub }}>{p.body}</p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-sm)' }}>
        <Bouton ls={p.ls} onClick={p.onClose} disabled={p.busy}>{t('confirm.cancel')}</Bouton>
        <Bouton ls={p.ls} primary danger onClick={p.onConfirm} disabled={p.busy}>{p.confirmLabel}</Bouton>
      </div>
    </Coquille>
  )
}
