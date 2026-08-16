/**
 * Modale de modération d'un bien en super-admin : signalement (`flag`) ou
 * retrait (`remove`). Impose un motif — pilule prédéfinie ou saisie libre —
 * avant de valider ; le motif est remonté au parent via `onConfirm`.
 *
 * Rendu en grammaire Sugar (kit `admin/kit`) : motifs en pilules segmentées
 * (accent NOIR quand sélectionné), champ libre sans bordure décorative, et un
 * bouton de validation dont le signal tient à la teinte de son icône
 * (`tones.warn` pour signaler, `tones.err` pour retirer) — les anciennes
 * bordures `border-amber-500/30` et `border-red-500/30` ont disparu.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Building2, Trash2 } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { AdminGhostBtn, AdminIc } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import { crmVoileEncre } from '@/components/crm/tokens'

interface ModerationActionDialogProps {
  open: boolean
  onClose: () => void
  propertyTitle: string
  propertyPhoto?: string
  action: 'flag' | 'remove'
  onConfirm: (reason: string) => void
}

const REASON_KEYS = [
  'moderation.reason.misleadingPhoto',
  'moderation.reason.unrealisticPrice',
  'moderation.reason.duplicate',
  'moderation.reason.inappropriate',
]

/** Dialogue de confirmation d'une action de modération ; ton ambre (flag) ou rouge (remove). */
export default function ModerationActionDialog({
  open,
  onClose,
  propertyTitle,
  propertyPhoto,
  action,
  onConfirm,
}: ModerationActionDialogProps) {
  const { t } = useTranslation('admin')
  const { sp, surf, dark, tones } = useAdminSurfaces()
  const [selectedReason, setSelectedReason] = useState<string | null>(null)
  const [customReason, setCustomReason] = useState('')

  const isFlag = action === 'flag'
  const actionLabel = isFlag ? t('moderation.flagTitle') : t('moderation.removeTitle')
  const actionTone = isFlag ? tones.warn : tones.err

  // '__custom' = sentinelle de la pilule « autre » : le motif vient alors du textarea.
  const finalReason = selectedReason === '__custom' ? customReason.trim() : selectedReason ?? ''

  function handleConfirm() {
    if (!finalReason) return
    onConfirm(finalReason)
    setSelectedReason(null)
    setCustomReason('')
  }

  function handleClose() {
    setSelectedReason(null)
    setCustomReason('')
    onClose()
  }

  /** Pilule de motif : accent plein quand retenue, surface creuse sinon. */
  function reasonPill(on: boolean) {
    return {
      height: 32, padding: '0 var(--crm-space-2xl)', borderRadius: ADMIN_RADII.pill, border: 0, cursor: 'pointer',
      fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, whiteSpace: 'nowrap' as const,
      background: on ? sp.accent : surf.cardSub,
      color: on ? sp.accentInk : sp.soft,
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title={actionLabel} size="md">
      <div style={{ padding: 'var(--crm-space-6xl)' }}>
        {/* Aperçu du bien */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', marginBottom: 18 }}>
          {propertyPhoto ? (
            <img
              src={propertyPhoto}
              alt=""
              loading="lazy"
              decoding="async"
              style={{ width: 80, height: 48, borderRadius: ADMIN_RADII.row, objectFit: 'cover', display: 'block', flexShrink: 0 }}
            />
          ) : (
            <div style={{
              width: 80, height: 48, borderRadius: ADMIN_RADII.row, background: surf.cardSub,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <AdminIc icon={Building2} size={17} color={sp.sub} />
            </div>
          )}
          <p style={{
            margin: 0, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, letterSpacing: -0.2, color: sp.ink,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {propertyTitle}
          </p>
        </div>

        {/* Motifs */}
        <p style={{ margin: '0 0 8px', fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2, color: sp.sub }}>
          {t('moderation.reason')}
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginBottom: 12 }}>
          {REASON_KEYS.map((key) => {
            const label = t(key)
            const on = selectedReason === label
            return (
              <button
                key={key}
                onClick={() => setSelectedReason(on ? null : label)}
                aria-pressed={on}
                style={reasonPill(on)}
              >
                {label}
              </button>
            )
          })}
          <button
            onClick={() => setSelectedReason(selectedReason === '__custom' ? null : '__custom')}
            aria-pressed={selectedReason === '__custom'}
            style={reasonPill(selectedReason === '__custom')}
          >
            {t('moderation.reason.other')}
          </button>
        </div>

        {/* Saisie libre */}
        {selectedReason === '__custom' && (
          <textarea
            value={customReason}
            onChange={(e) => setCustomReason(e.target.value)}
            placeholder={t('moderation.customReasonPlaceholder')}
            rows={3}
            style={{
              width: '100%', boxSizing: 'border-box', marginBottom: 12, padding: 'var(--crm-space-lg) var(--crm-space-xl)',
              borderRadius: ADMIN_RADII.row, border: 0, background: surf.cardSub, color: sp.ink,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.5,
              outline: 'none', resize: 'none',
              boxShadow: `0 0 0 1.5px ${crmVoileEncre(dark, 0.07)} inset`,
            }}
          />
        )}

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--crm-space-md)', marginTop: 16 }}>
          <AdminGhostBtn onClick={handleClose}>{t('common.cancel')}</AdminGhostBtn>
          {/* L'icône est passée en enfant (et non via `icon`) : la prop la peindrait
              en encre, or c'est sa teinte qui porte le signal de l'action. */}
          <AdminGhostBtn
            onClick={handleConfirm}
            disabled={!finalReason}
            style={{ color: actionTone }}
          >
            <AdminIc icon={isFlag ? AlertTriangle : Trash2} size={15} color={actionTone} />
            {isFlag ? t('moderation.action.flag') : t('moderation.action.remove')}
          </AdminGhostBtn>
        </div>
      </div>
    </Modal>
  )
}
