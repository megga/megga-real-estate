// MEGGA CRM Sugar v2 — Mes biens · Modale « Renouveler le mandat » (+ suppression)
// Port fidèle du handoff Claude Design (crm-screen-biens-proto.jsx, BpRenewModal).
//
// Câblage réel :
//   - Renouveler → useUpdateProperty (mandate_expires_at + mandate_commission_pct)
//     + audit ('bien'). L'échéance est repoussée de N mois depuis l'échéance
//     courante. « Envoyer pour signature » NE déclenche PAS d'envoi WhatsApp
//     automatique (human-in-the-loop) : l'écran de succès est honnête — l'échéance
//     est mise à jour et l'agent transmet la reconduction au propriétaire.
//   - Supprimer → useDeleteProperty (soft-delete `deleted_at`, trigger DB audite).
//
// Grammaire Sugar Pure : modale opaque, coins 28 px, overlay flouté, Échap / clic
// dehors, createPortal(document.body) z-[100] (convention CLAUDE.md).

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmBien } from '@/components/crm-sugar/mockData'
import { type SugarPalette } from '@/components/crm-sugar/tokens'
import type { GalSurfaces } from '@/components/crm-sugar/biens/gallery/galHelpers'
import { GalPhoto } from '@/components/crm-sugar/biens/gallery/GalleryAtoms'
import { useUpdateProperty, useDeleteProperty } from '@/hooks/useProperties'
import { useLogAudit } from '@/hooks/useAuditLog'
import { bpAddMonths, bpFmtDate, expiryLabelKey } from './followupData'

interface BpRenewModalProps {
  b: CrmBien
  days: number
  sp: SugarPalette
  surf: GalSurfaces
  dark: boolean
  onClose: () => void
  /** Rafraîchit la liste après une mutation réussie (renew / delete). */
  onDone?: () => void
}

export function BpRenewModal({ b, days, sp, surf, dark, onClose, onDone }: BpRenewModalProps) {
  const { t } = useTranslation('listings')
  const [dur, setDur] = useState(12)
  // Commission : préremplie UNIQUEMENT si une valeur réelle existe. Sinon champ
  // vide (placeholder « 3 » indicatif) → on n'écrit jamais une commission
  // fabriquée si l'agent ne la renseigne pas (honnêteté compliance).
  const [comm, setComm] = useState(
    b.mandat?.commission != null ? String(b.mandat.commission) : '',
  )
  const [sent, setSent] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [removed, setRemoved] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const updateProperty = useUpdateProperty()
  const deleteProperty = useDeleteProperty()
  const logAudit = useLogAudit()

  const red = dark ? '#E0738C' : '#8E1F3D'
  const orange = dark ? '#D97A1E' : '#C45A00'
  // Accent Sugar = noir (clair) / quasi-blanc (sombre) via ink/pageBg — PAS focusBg
  // (qui est le primary périwinkle en sombre). Cf. CLAUDE.md « accent UI unique = noir ».
  const onInk = sp.pageBg
  const accent = sp.accent

  // Nouvelle échéance = échéance courante SI encore future, sinon aujourd'hui,
  // + N mois. Un mandat déjà expiré est toujours reconduit VERS L'AVANT (jamais
  // une échéance dans le passé).
  const nowDate = new Date()
  const exp = b.mandat?.expiresAt ? new Date(b.mandat.expiresAt) : null
  const base = exp && exp > nowDate ? exp : nowDate
  const newDate = bpAddMonths(base, dur)
  const newDateLabel = bpFmtDate(newDate)
  // Badge d'échéance (gère à venir / aujourd'hui / dépassé).
  const expiry = expiryLabelKey(days)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, busy])

  const submitRenew = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const parsed = parseFloat(comm.replace(',', '.'))
      const commission = Number.isFinite(parsed) && parsed >= 0 && parsed <= 100 ? parsed : undefined
      await updateProperty.mutateAsync({
        id: b.id,
        mandate_expires_at: newDate.toISOString(),
        ...(commission != null ? { mandate_commission_pct: commission } : {}),
      })
      // Audit : trace la reconduction (pas d'auto-envoi — human-in-the-loop).
      try {
        await logAudit.mutateAsync({
          category: 'bien',
          action: 'Mandat renouvelé',
          entityType: 'property',
          entityId: b.id,
          objectLabel: b.title,
          metadata: {
            duration_months: dur,
            mandate_expires_at: newDate.toISOString(),
            ...(commission != null ? { mandate_commission_pct: commission } : {}),
          },
        })
      } catch {
        /* l'audit ne doit pas bloquer le renouvellement */
      }
      onDone?.()
      setSent(true)
    } catch {
      setError(t('biens.renewModal.error'))
    } finally {
      setBusy(false)
    }
  }

  const submitDelete = async () => {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      await deleteProperty.mutateAsync(b.id)
      // Le refetch est différé au clic « Terminé » : rafraîchir maintenant peut
      // vider la liste (dernier bien) → fresh=true démonte ce composant et arrache
      // l'écran de confirmation avant que l'agent ne l'acquitte.
      setRemoved(true)
    } catch {
      setError(t('biens.deleteFlow.error'))
    } finally {
      setBusy(false)
    }
  }

  const ovBg = dark ? 'rgba(4,6,10,.62)' : 'rgba(24,32,48,.34)'
  const mSh = dark
    ? '0 40px 100px rgba(0,0,0,.62), 0 8px 24px rgba(0,0,0,.5)'
    : '0 40px 100px rgba(15,23,42,.24), 0 8px 24px rgba(15,23,42,.12)'
  const cardBg = sp.solidBg

  const wrap = (inner: React.ReactNode) =>
    createPortal(
      <div
        onMouseDown={() => !busy && onClose()}
        onWheel={(e) => e.stopPropagation()}
        style={{
          position: 'fixed',
          inset: 0,
          background: ovBg,
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          display: 'grid',
          placeItems: 'center',
          padding: 'var(--crm-space-6xl)',
          zIndex: 100,
          animation: 'bpOvIn .2s ease both',
          fontFamily: '"Inter Tight", system-ui, sans-serif',
        }}
      >
        <style>{`
          @keyframes bpOvIn{from{opacity:0}to{opacity:1}}
          @keyframes bpCardIn{from{opacity:0;transform:translateY(14px) scale(.985)}to{opacity:1;transform:none}}
          .bp-inp:focus{box-shadow:0 0 0 2px ${accent} inset !important}
        `}</style>
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            width: 'min(462px,100%)',
            maxHeight: '92%',
            overflowY: 'auto',
            background: cardBg,
            borderRadius: 'var(--crm-radius-6xl)',
            boxShadow: mSh,
            animation: 'bpCardIn .5s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          {inner}
        </div>
      </div>,
      document.body,
    )

  if (removed) {
    return wrap(
      <div style={{ padding: '42px 34px 34px', textAlign: 'center' }}>
        <div style={{ width: 62, height: 62, borderRadius: 'var(--crm-radius-pill)', background: red, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
          <MEIcon name="check" size={28} color="#fff" strokeWidth={2.2} />
        </div>
        <h2 style={{ margin: '20px 0 0', fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.4, color: sp.ink }}>
          {t('biens.deleteFlow.deletedTitle')}
        </h2>
        <div style={{ fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500, marginTop: 9, lineHeight: 1.5 }}>
          {t('biens.deleteFlow.deletedBody', { title: b.title })}
        </div>
        <button onClick={() => { onDone?.(); onClose() }} style={doneBtn(accent, onInk)}>{t('biens.renewModal.done')}</button>
      </div>,
    )
  }

  if (confirmDel) {
    return wrap(
      <div style={{ padding: '34px 30px 26px' }}>
        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.4, color: sp.ink }}>
          {t('biens.deleteFlow.confirmTitle')}
        </h2>
        <div style={{ fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500, marginTop: 10, lineHeight: 1.55 }}>
          {t('biens.deleteFlow.confirmBody', { title: b.title })}
        </div>
        {error && <div style={{ fontSize: 'var(--crm-text-md)', color: red, fontWeight: 600, marginTop: 12 }}>{error}</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-lg)', marginTop: 24 }}>
          <button
            onClick={() => setConfirmDel(false)}
            disabled={busy}
            style={{ height: 46, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: surf.cardSub, color: sp.soft }}
          >
            {t('biens.deleteFlow.cancel')}
          </button>
          <button
            onClick={submitDelete}
            disabled={busy}
            style={{ height: 46, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: red, color: '#fff', opacity: busy ? 0.7 : 1 }}
          >
            {busy ? t('biens.deleteFlow.deleting') : t('biens.deleteFlow.confirm')}
          </button>
        </div>
      </div>,
    )
  }

  if (sent) {
    return wrap(
      <div style={{ padding: '42px 34px 34px', textAlign: 'center' }}>
        <div style={{ width: 62, height: 62, borderRadius: 'var(--crm-radius-pill)', background: accent, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
          <MEIcon name="check" size={28} color={onInk} strokeWidth={2.2} />
        </div>
        <h2 style={{ margin: '20px 0 0', fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.4, color: sp.ink }}>
          {t('biens.renewModal.successTitle')}
        </h2>
        <div style={{ fontSize: 'var(--crm-text-lg)', color: sp.sub, fontWeight: 500, marginTop: 9, lineHeight: 1.5 }}>
          {t('biens.renewModal.successBody', { title: b.title, date: newDateLabel })}
        </div>
        <button onClick={onClose} style={doneBtn(accent, onInk)}>{t('biens.renewModal.done')}</button>
      </div>,
    )
  }

  return wrap(
    <>
      <div style={{ position: 'relative', padding: '26px 26px 0' }}>
        <button
          onClick={() => !busy && onClose()}
          aria-label={t('biens.deleteFlow.cancel')}
          style={{ position: 'absolute', top: 20, right: 20, width: 34, height: 34, borderRadius: 'var(--crm-radius-pill)', border: 0, background: surf.cardSub, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: 'inherit' }}
        >
          <MEIcon name="close" size={16} color={sp.soft} strokeWidth={1.9} />
        </button>
        <h2 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, letterSpacing: -0.5, color: sp.ink }}>
          {t('biens.renewModal.title')}
        </h2>
      </div>

      {/* Carte bien */}
      <div style={{ margin: '18px 26px 0', background: surf.cardSub, borderRadius: 'var(--crm-radius-2xl)', padding: 'var(--crm-space-xl)', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
        <div style={{ position: 'relative', width: 66, height: 50, borderRadius: 'var(--crm-radius-md)', overflow: 'hidden', flexShrink: 0, background: surf.cardSub }}>
          {b.photoCount === 0 ? (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <MEIcon name="home" size={18} color={sp.sub} />
            </div>
          ) : (
            <GalPhoto id={b.id} src={b.coverPhoto} dark={dark} radius={11} />
          )}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.3, color: sp.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {b.title}
          </div>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', height: 24, padding: '0 var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: orange, color: '#fff', fontSize: 'var(--crm-text-sm)', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}>
          {t(`biens.followUp.${expiry.key}`, { count: expiry.count })}
        </span>
      </div>

      {/* Durée de reconduction */}
      <div style={{ padding: '20px 26px 0' }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.soft, marginBottom: 9 }}>{t('biens.renewModal.duration')}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--crm-space-md)' }}>
          {[3, 6, 12].map((m) => {
            const on = dur === m
            return (
              <button
                key={m}
                onClick={() => setDur(m)}
                style={{ height: 44, borderRadius: 'var(--crm-radius-lg)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: on ? accent : surf.cardSub, color: on ? onInk : sp.soft }}
              >
                {t('biens.renewModal.months', { count: m })}
              </button>
            )
          })}
        </div>
      </div>

      {/* Nouvelle échéance */}
      <div style={{ margin: '12px 26px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', background: surf.cardSub, borderRadius: 'var(--crm-radius-lg)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', fontSize: 'var(--crm-text-md)', color: sp.sub, fontWeight: 600 }}>
          <MEIcon name="calendar" size={15} color={sp.sub} />
          {t('biens.renewModal.newExpiry')}
        </span>
        <span style={{ fontSize: 'var(--crm-text-lg)', color: sp.ink, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{newDateLabel}</span>
      </div>

      {/* Commission */}
      <div style={{ padding: '16px 26px 0' }}>
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.soft, marginBottom: 9 }}>{t('biens.renewModal.commission')}</div>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            className="bp-inp"
            value={comm}
            onChange={(e) => setComm(e.target.value.replace(/[^\d.]/g, ''))}
            inputMode="decimal"
            style={{ width: '100%', height: 46, borderRadius: 'var(--crm-radius-lg)', border: 0, background: surf.cardSub, color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, padding: '0 40px 0 15px', outline: 'none', transition: 'box-shadow .12s ease' }}
          />
          <span style={{ position: 'absolute', right: 16, fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.sub, pointerEvents: 'none' }}>%</span>
        </div>
      </div>

      {error && <div style={{ padding: '14px 26px 0', fontSize: 'var(--crm-text-md)', color: red, fontWeight: 600 }}>{error}</div>}

      {/* Actions */}
      <div style={{ padding: '22px 26px 26px' }}>
        <button
          onClick={submitRenew}
          disabled={busy}
          style={{ width: '100%', height: 48, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, background: accent, color: onInk, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 'var(--crm-space-md)', opacity: busy ? 0.7 : 1 }}
        >
          <MEIcon name="send" size={16} color={onInk} />
          {t('biens.renewModal.send')}
        </button>
        <button
          onClick={() => setConfirmDel(true)}
          disabled={busy}
          style={{ width: '100%', height: 40, marginTop: 8, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: busy ? 'default' : 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, background: 'transparent', color: red }}
        >
          {t('biens.renewModal.delete')}
        </button>
      </div>
    </>,
  )
}

function doneBtn(accent: string, onInk: string): React.CSSProperties {
  return {
    width: '100%',
    height: 46,
    marginTop: 24,
    borderRadius: 'var(--crm-radius-pill)',
    border: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'var(--crm-text-xl)',
    fontWeight: 600,
    background: accent,
    color: onInk,
  }
}
