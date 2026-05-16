// MEGGA CRM Sugar v3 — Modal "Passer outre verrou KYC"
// Arbitrage README #2 : justification écrite (min 20 chars) → AuditEvent severity warn/critical.
//
// Sortie sur validation : (reason: string) => void, parent logue l'AuditEvent et autorise le drop.

import { useEffect, useRef, useState } from 'react'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycBlackPill, KycGhostPill } from '../primitives'

const MIN_REASON_LENGTH = 20

interface Props {
  stageLabel: string
  contactName: string
  /** Sévérité pré-calculée (warn ou critical si stage=signed). */
  severity: 'warn' | 'critical'
  onCancel: () => void
  onConfirm: (reason: string) => void
}

export function KycOverrideModal({
  stageLabel,
  contactName,
  severity,
  onCancel,
  onConfirm,
}: Props) {
  const [reason, setReason] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    textareaRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancel])

  const valid = reason.trim().length >= MIN_REASON_LENGTH

  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9100,
        background: 'rgba(11,12,14,0.45)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        fontFamily: SugarV3.font,
      }}
    >
      <div
        style={{
          width: 'min(560px, 90vw)',
          background: SugarV3.card,
          borderRadius: 28,
          padding: '32px 36px',
          boxShadow: SugarV3.shadowLg,
          animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 18 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background:
                severity === 'critical' ? SugarV3.errSoft : SugarV3.warnSoft,
              color: severity === 'critical' ? SugarV3.errDarker : SugarV3.warn,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <SgIcon
              name="alert"
              size={20}
              stroke={severity === 'critical' ? SugarV3.errDarker : SugarV3.warn}
              sw={2}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: SugarV3.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 4,
              }}
            >
              Dérogation · journalisée nLPD
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 700,
                color: SugarV3.ink,
                letterSpacing: -0.4,
                lineHeight: 1.2,
              }}
            >
              Passer outre le verrou KYC ?
            </h2>
          </div>
        </div>

        <p
          style={{
            margin: '0 0 20px',
            fontSize: 14,
            color: SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Vous allez déplacer le deal de <strong>{contactName}</strong> en{' '}
          <strong>« {stageLabel} »</strong> alors que son dossier KYC n'est pas
          encore validé. Cette action est enregistrée dans le journal d'audit
          nLPD pendant 10 ans.
        </p>

        <label style={{ display: 'block', marginBottom: 6 }}>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SugarV3.inkSoft,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
            }}
          >
            Motif de la dérogation
          </span>
          <span
            style={{
              fontSize: 11,
              fontWeight: 500,
              color: SugarV3.muted,
              marginLeft: 8,
            }}
          >
            (minimum {MIN_REASON_LENGTH} caractères)
          </span>
        </label>
        <textarea
          ref={textareaRef}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ex : Client de longue date, mandat de recherche actif depuis 6 mois, KYC en cours de signature. Validation provisoire en attendant la pièce d'identité."
          rows={4}
          style={{
            width: '100%',
            boxSizing: 'border-box',
            padding: '12px 14px',
            borderRadius: 14,
            border: 0,
            background: SugarV3.cardSubtle,
            color: SugarV3.ink,
            fontFamily: 'inherit',
            fontSize: 13.5,
            fontWeight: 500,
            lineHeight: 1.5,
            outline: 'none',
            resize: 'vertical',
            boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          }}
          onFocus={(e) => {
            e.currentTarget.style.boxShadow = `0 0 0 2px ${SugarV3.black}, 0 4px 12px rgba(15,23,42,0.05)`
          }}
          onBlur={(e) => {
            e.currentTarget.style.boxShadow =
              'inset 0 0 0 1px rgba(15,23,42,0.04)'
          }}
        />

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 6,
            fontSize: 11,
            color: reason.length >= MIN_REASON_LENGTH ? SugarV3.ok : SugarV3.muted,
            fontWeight: 600,
          }}
        >
          <span>
            {reason.trim().length} / {MIN_REASON_LENGTH} caractères
          </span>
        </div>

        <div
          style={{
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            marginTop: 24,
          }}
        >
          <KycGhostPill onClick={onCancel} size="md">
            Annuler
          </KycGhostPill>
          <KycBlackPill
            onClick={() => valid && onConfirm(reason.trim())}
            disabled={!valid}
            size="md"
            icon={<SgIcon name="check" size={14} stroke="#fff" sw={2} />}
          >
            Confirmer & journaliser
          </KycBlackPill>
        </div>
      </div>
    </div>
  )
}
