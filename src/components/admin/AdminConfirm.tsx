/**
 * Confirmation d'une action irréversible, en grammaire Sugar.
 *
 * Remplace `window.confirm` / `window.prompt`, qui juraient avec le reste de la
 * console (chrome du navigateur, pas de traduction, pas de thème) et, pour le
 * second, ne validaient la saisie qu'APRÈS coup, par un toast d'échec.
 *
 * `requireText` reproduit la garde forte de la suppression de compte : tant que
 * la chaîne exacte n'est pas saisie, le bouton reste désactivé. La contrainte
 * est ainsi visible AVANT l'action plutôt que reprochée après.
 *
 * Volontairement hors du kit : il tire `Modal`, et `adminKit` est importé par
 * une quarantaine de fichiers — l'y placer aurait chargé la modale dans le
 * chunk partagé de toute la console. Même raison que `ModerationActionDialog`.
 */
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import Modal from '@/components/ui/modal'
import { AdminGhostBtn, AdminIc } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { sgVoileEncre } from '@/components/crm-sugar/tokens'

interface AdminConfirmProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  message: string
  /** Libellé du bouton d'action. Dit ce qui va se passer, jamais « OK ». */
  confirmLabel: string
  /** Ton du signal : `err` pour une destruction, `warn` pour une mise en pause. */
  tone?: 'err' | 'warn'
  /** Si fourni, l'action reste bloquée tant que cette chaîne n'est pas saisie. */
  requireText?: string
  /** Libellé du champ de saisie ; requis dès que `requireText` l'est. */
  requireTextLabel?: string
  /** Action en cours : bouton désactivé, libellé remplacé. */
  busy?: boolean
  busyLabel?: string
}

/** Modale de confirmation ; saisie exigée en option pour les actions définitives. */
export default function AdminConfirm({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  tone = 'err',
  requireText,
  requireTextLabel,
  busy = false,
  busyLabel,
}: AdminConfirmProps) {
  const { t } = useTranslation('admin')
  const { sp, surf, dark, tones } = useAdminSugar()
  const [typed, setTyped] = useState('')
  const inputId = useId()

  // Repartir vierge à chaque ouverture : une saisie laissée d'une fois sur
  // l'autre pré-débloquerait l'action suivante, ce qui vide la garde de son sens.
  useEffect(() => {
    if (open) setTyped('')
  }, [open])

  const signal = tone === 'warn' ? tones.warn : tones.err
  // Comparaison insensible à la casse et aux espaces de bord : la garde protège
  // d'une action machinale, pas d'une faute de frappe sur la casse d'un e-mail.
  const unlocked = !requireText || typed.trim().toLowerCase() === requireText.toLowerCase()

  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <div style={{ padding: 'var(--crm-space-6xl)' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-lg)' }}>
          <AdminIc icon={AlertTriangle} size={17} color={signal} style={{ marginTop: 1, flexShrink: 0 }} />
          <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 500, lineHeight: 1.55, color: sp.ink }}>
            {message}
          </p>
        </div>

        {requireText && (
          <div style={{ marginTop: 16 }}>
            <label
              htmlFor={inputId}
              style={{ display: 'block', marginBottom: 6, fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2, color: sp.sub }}
            >
              {requireTextLabel}
            </label>
            <input
              id={inputId}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              style={{
                width: '100%', boxSizing: 'border-box', height: 38, padding: '0 var(--crm-space-xl)',
                borderRadius: ADMIN_RADII.row, border: 0, background: surf.cardSub, color: sp.ink,
                fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, outline: 'none',
                boxShadow: `0 0 0 1.5px ${sgVoileEncre(dark, 0.07)} inset`,
              }}
            />
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--crm-space-md)', marginTop: 18 }}>
          <AdminGhostBtn onClick={onClose} disabled={busy}>{t('common.cancel')}</AdminGhostBtn>
          {/* Icône passée en enfant : la prop `icon` la peindrait en encre, or
              c'est sa teinte qui porte le signal — même choix que la modale de
              modération. */}
          <AdminGhostBtn onClick={onConfirm} disabled={!unlocked || busy} style={{ color: signal }}>
            <AdminIc icon={AlertTriangle} size={15} color={signal} />
            {busy && busyLabel ? busyLabel : confirmLabel}
          </AdminGhostBtn>
        </div>
      </div>
    </Modal>
  )
}
