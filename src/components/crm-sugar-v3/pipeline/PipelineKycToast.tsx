// MEGGA CRM Sugar v3 — Toast jaune apparaissant au drop bloqué par KYC
// Arbitrage README #2 : "KYC requis pour passer en « X » " + bouton "Passer outre"
//
// Affichage 3s par défaut (auto-dismiss). Si l'agent clique "Passer outre",
// ouvre la modal de motif qui logue un AuditEvent et autorise le drop.

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'

interface Props {
  stageLabel: string
  /** Callback "Passer outre" — ouvre la modal de motif. */
  onOverride: () => void
  onDismiss: () => void
}

export function PipelineKycToast({ stageLabel, onOverride, onDismiss }: Props) {
  const { t } = useTranslation('pipeline')
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 6000)
    return () => window.clearTimeout(id)
  }, [onDismiss])

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 32,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 8500,
        minWidth: 480,
        maxWidth: 720,
        padding: '16px 20px',
        borderRadius: 18,
        background: SugarV3.card,
        color: SugarV3.ink,
        boxShadow: SugarV3.shadowLg,
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto auto',
        gap: 16,
        alignItems: 'center',
        fontFamily: SugarV3.font,
        animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        style={{
          width: 40,
          height: 40,
          borderRadius: 12,
          background: SugarV3.warnSoft,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        <SgIcon name="alert" size={18} stroke={SugarV3.warn} sw={2} />
      </div>
      <div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 700,
            letterSpacing: -0.1,
            marginBottom: 2,
          }}
        >
          {t('kyc.toast.title', { stage: stageLabel })}
        </div>
        <div
          style={{
            fontSize: 12,
            color: SugarV3.muted,
            fontWeight: 500,
          }}
        >
          {t('kyc.toast.subtitle')}
        </div>
      </div>
      <button
        onClick={onOverride}
        style={{
          height: 34,
          padding: '0 14px',
          borderRadius: 999,
          border: 0,
          background: SugarV3.black,
          color: '#fff',
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 700,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {t('kyc.toast.override')}
      </button>
      <button
        onClick={onDismiss}
        title={t('common:actions.close')}
        style={{
          width: 32,
          height: 32,
          borderRadius: 999,
          border: 0,
          background: SugarV3.cardSubtle,
          color: SugarV3.inkSoft,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <SgIcon name="close" size={14} stroke={SugarV3.inkSoft} />
      </button>
    </div>
  )
}
