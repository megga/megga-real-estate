import { useState } from 'react'
import { createPortal } from 'react-dom'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import type { VendorDossier } from '@/hooks/useVendorDossiers'
import { CheckIcon } from './icons'

interface Props {
  open: boolean
  dossier: VendorDossier | null
  onClose: () => void
  onConfirm: () => void
}

export default function MandateSigningModal({ open, dossier, onClose, onConfirm }: Props) {
  const [agreed, setAgreed] = useState(false)
  const [signature, setSignature] = useState('')

  if (!open || !dossier) return null

  const canSign = agreed && signature.trim().length >= 3

  return createPortal(
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1100,
        background: 'rgba(14,20,16,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: T.fontStack,
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(640px, 100%)',
          maxHeight: '90vh',
          overflow: 'hidden',
          background: '#fff',
          borderRadius: 18,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px -20px rgba(14,20,16,0.45)',
        }}
      >
        <div
          style={{
            padding: '22px 26px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 11,
                fontWeight: 800,
                color: T.muted,
                textTransform: 'uppercase',
                letterSpacing: 0.6,
                marginBottom: 4,
              }}
            >
              Mandat de courtage
            </div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 20,
                fontWeight: 700,
                color: T.ink,
                letterSpacing: -0.4,
              }}
            >
              {dossier.title}
            </div>
            <div style={{ fontFamily: T.fontStack, fontSize: 12, color: T.muted, marginTop: 4 }}>
              Avec {dossier.agent.name} · {dossier.agent.role}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: T.ink,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '24px 26px', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              padding: '16px 18px',
              borderRadius: 12,
              background: T.section,
              border: `1px solid ${T.border}`,
              marginBottom: 18,
              fontFamily: T.fontStack,
              fontSize: 12.5,
              color: T.soft,
              lineHeight: 1.6,
            }}
          >
            En signant ce mandat, vous confiez à <strong style={{ color: T.ink }}>{dossier.agent.name}</strong>{' '}
            la mission de commercialiser votre bien situé{' '}
            <strong style={{ color: T.ink }}>{dossier.address}</strong> selon l'estimation reçue. La
            commission sera de <strong style={{ color: T.ink }}>3 %</strong> du prix de vente net,
            payable au moment de l'acte authentique. Aucune clause d'exclusivité — vous pouvez résilier
            à tout moment moyennant un préavis de 30 jours.
          </div>

          <div style={{ marginBottom: 18 }}>
            <button
              onClick={() => setAgreed((v) => !v)}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 12,
                width: '100%',
                padding: 14,
                borderRadius: 12,
                border: `1px solid ${agreed ? T.ink : T.border}`,
                background: agreed ? T.section : '#fff',
                cursor: 'pointer',
                textAlign: 'left',
                fontFamily: T.fontStack,
                transition: 'all 0.15s ease',
              }}
            >
              <span
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 6,
                  border: `2px solid ${agreed ? T.ink : T.border}`,
                  background: agreed ? T.ink : '#fff',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  marginTop: 1,
                }}
              >
                {agreed && <CheckIcon size={12} />}
              </span>
              <span style={{ fontSize: 13, color: T.ink, lineHeight: 1.5 }}>
                J'ai lu et j'accepte les <strong style={{ fontWeight: 700 }}>conditions générales</strong>{' '}
                et le <strong style={{ fontWeight: 700 }}>code de déontologie MEGGA</strong>.
              </span>
            </button>
          </div>

          <div>
            <label
              style={{
                display: 'block',
                fontFamily: T.fontStack,
                fontSize: 11,
                fontWeight: 700,
                color: T.ink,
                letterSpacing: 0.2,
                marginBottom: 6,
              }}
            >
              Signature électronique (tapez votre nom complet)
            </label>
            <input
              type="text"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Camille Aebischer"
              style={{
                width: '100%',
                height: 56,
                padding: '0 18px',
                border: `1.5px solid ${T.border}`,
                borderRadius: 12,
                fontFamily: "'Caveat', cursive",
                fontSize: 28,
                fontWeight: 600,
                color: T.ink,
                outline: 'none',
                background: '#FAFBFD',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = T.ink)}
              onBlur={(e) => (e.currentTarget.style.borderColor = T.border)}
            />
          </div>
        </div>

        <div
          style={{
            padding: '16px 26px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
            background: '#FAFBFD',
          }}
        >
          <button
            onClick={onClose}
            style={{
              height: 42,
              padding: '0 18px',
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              color: T.ink,
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => {
              if (canSign) onConfirm()
            }}
            disabled={!canSign}
            style={{
              height: 42,
              padding: '0 22px',
              borderRadius: 999,
              border: 'none',
              background: canSign ? T.ink : T.section,
              color: canSign ? '#fff' : T.muted,
              fontFamily: T.fontStack,
              fontSize: 13,
              fontWeight: 700,
              cursor: canSign ? 'pointer' : 'not-allowed',
            }}
          >
            Signer le mandat
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
