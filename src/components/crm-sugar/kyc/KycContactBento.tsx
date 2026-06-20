// MEGGA CRM Sugar v2 — KYC Contact Bento (Tier 4 — VariationD)
// 1:1 port from `megga-kyc-variations.jsx` VariationDInline (lines 750-810).
// Mini-card "Conformité KYC / LBA" pour fiche contact — mini-stepper horizontal
// + 3 KPIs + 2 CTA. À glisser tel quel dans crm-screen-contacts-sugar.jsx.

import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { BlackBtn, GhostBtn, KycIcon, Pill, SP } from './atoms'

export interface KycContactBentoData {
  status: 'review' | 'in' | 'valid'
  riskScore: number
  riskLabel: string
  docsDone: number
  docsTotal: number
  lastScreening: string
  /** index 0..5, last completed step */
  stepDone: number
  /** index 0..5, currently active step */
  stepActive: number
}

// Réutilise les libellés d'étapes partagés (kyc:steps.*) — pas de nouvelle clé.
const STEP_KEYS = [
  'steps.identity',
  'steps.beneficiary',
  'steps.funds',
  'steps.screening',
  'steps.risk',
  'steps.validation',
] as const

interface KycContactBentoProps {
  data?: KycContactBentoData
  onOpen?: () => void
  onRelance?: () => void
}

const DEFAULT_DATA: KycContactBentoData = {
  status: 'review',
  riskScore: 14,
  riskLabel: 'Faible',
  docsDone: 4,
  docsTotal: 6,
  lastScreening: '12.04.26',
  stepDone: 4,
  stepActive: 4,
}

export function KycContactBento({ data = DEFAULT_DATA, onOpen, onRelance }: KycContactBentoProps) {
  const { t } = useTranslation('kyc')
  const statusPill =
    data.status === 'valid'
      ? { tone: 'ok' as const, label: t('status.validated') }
      : data.status === 'in'
        ? { tone: 'pending' as const, label: t('status.in_progress') }
        : { tone: 'warn' as const, label: t('status.review') }

  return (
    <div
      style={{
        background: SP.surface,
        borderRadius: 22,
        padding: 22,
        boxShadow: SP.shadow,
        fontFamily: SP.font,
        color: SP.ink,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 14,
        }}
      >
        <KycIcon name="shield" size={16} stroke={SP.ink} sw={2} />
        <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: -0.2 }}>
          {t('contactBento.heading')}
        </div>
        <div style={{ flex: 1 }} />
        <Pill tone={statusPill.tone} dot>
          {statusPill.label}
        </Pill>
      </div>

      {/* Mini-stepper horizontal */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 0,
          marginBottom: 16,
        }}
      >
        {STEP_KEYS.map((stepKey, i) => {
          const done = i < data.stepDone
          const active = i === data.stepActive
          return (
            <Fragment key={stepKey}>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 4,
                  minWidth: 0,
                  flex: 1,
                }}
              >
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: done ? SP.ok : active ? SP.ink : SP.cardSubtle,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: active ? '0 0 0 4px rgba(11,12,14,0.08)' : 'none',
                    transition: 'all .2s',
                  }}
                >
                  {done && <KycIcon name="check" size={9} stroke="#fff" sw={3} />}
                </div>
                <div
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    color: done || active ? SP.ink : SP.muted,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {t(stepKey)}
                </div>
              </div>
              {i < STEP_KEYS.length - 1 && (
                <div
                  style={{
                    height: 2,
                    flex: 0.4,
                    background: i < data.stepDone - 1 ? SP.ok : SP.cardSubtle,
                    alignSelf: 'center',
                    marginTop: -16,
                    marginLeft: -4,
                    marginRight: -4,
                  }}
                />
              )}
            </Fragment>
          )
        })}
      </div>

      {/* 3 KPIs */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 10,
        }}
      >
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: SP.cardSubtle,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: SP.muted,
            }}
          >
            {t('contactBento.kpiRisk')}
          </div>
          <div
            style={{
              fontSize: 18,
              fontWeight: 700,
              color: data.riskScore >= 60 ? SP.danger : data.riskScore >= 30 ? SP.warn : SP.ok,
              marginTop: 2,
            }}
          >
            {data.riskScore}{' '}
            <span style={{ fontSize: 11, color: SP.muted, fontWeight: 600 }}>
              / {data.riskLabel}
            </span>
          </div>
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: SP.cardSubtle,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: SP.muted,
            }}
          >
            {t('contactBento.kpiDocs')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            {data.docsDone}
            <span style={{ fontSize: 11, color: SP.muted, fontWeight: 600 }}>
              {' '}
              / {data.docsTotal}
            </span>
          </div>
        </div>
        <div
          style={{
            padding: '10px 12px',
            borderRadius: 12,
            background: SP.cardSubtle,
          }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 800,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
              color: SP.muted,
            }}
          >
            {t('contactBento.kpiLastScreening')}
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, marginTop: 2 }}>
            {data.lastScreening}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <BlackBtn
          onClick={onOpen}
          style={{ height: 36, padding: '0 16px', fontSize: 12.5 }}
        >
          {t('contactBento.openDossier')}
        </BlackBtn>
        <GhostBtn
          onClick={onRelance}
          style={{ height: 36, padding: '0 14px', fontSize: 12.5 }}
        >
          {t('contactBento.followUpClient')}
        </GhostBtn>
      </div>
    </div>
  )
}
