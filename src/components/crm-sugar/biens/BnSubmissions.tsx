// MEGGA CRM Sugar v2 — Soumissions vendeurs (Banner + Drawer)
// 1:1 port from `crm-screen-biens-sugar.jsx` (BnSubmissionsBanner, BnSubmissionsDrawer).

import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { crmContactById } from '../mockData'
import type { SugarPalette } from '../tokens'
import { BnPhoto } from './BnPhoto'
import { bnFmtCHF, bnRelative } from './helpers'
import type { CrmSubmission } from './biensData'

interface BnSubmissionsBannerProps {
  subs: CrmSubmission[]
  sp: SugarPalette
  dark: boolean
  onOpen: () => void
}

export function BnSubmissionsBanner({
  subs,
  sp,
  dark,
  onOpen,
}: BnSubmissionsBannerProps) {
  const { t } = useTranslation('listings')
  if (!subs || subs.length === 0) return null
  const urgent = subs.filter(s => s.sla && s.sla.includes('24h')).length
  return (
    <button
      onClick={onOpen}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '14px 18px',
        marginBottom: 18,
        background: dark ? 'rgba(229,57,53,.14)' : 'rgba(229,57,53,.08)',
        border: `1px solid ${dark ? 'rgba(229,57,53,.35)' : 'rgba(229,57,53,.25)'}`,
        borderRadius: 16,
        cursor: 'pointer',
        fontFamily: 'inherit',
        display: 'flex',
        alignItems: 'center',
        gap: 14,
      }}
    >
      <div
        style={{
          width: 38,
          height: 38,
          borderRadius: 999,
          flexShrink: 0,
          background: '#E53935',
          color: '#fff',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <MEIcon name="send" size={16} color="#fff" />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: sp.ink }}>
          {t('biens.submissions.bannerTitle', { count: subs.length })}
        </div>
        <div
          style={{
            fontSize: 11.5,
            color: sp.sub,
            marginTop: 2,
            fontWeight: 500,
          }}
        >
          {urgent > 0
            ? t('biens.submissions.subtitleWithUrgent', {
                count: urgent,
                urgent: t('biens.submissions.urgentClause', { count: urgent }),
              })
            : t('biens.submissions.subtitle')}
        </div>
      </div>
      <span
        style={{
          fontSize: 11.5,
          fontWeight: 700,
          color: '#E53935',
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {t('biens.submissions.open')}
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
          <path
            d="M3 2l3 3-3 3"
            stroke="#E53935"
            strokeWidth="1.7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    </button>
  )
}

interface BnSubmissionsDrawerProps {
  open: boolean
  onClose: () => void
  subs: CrmSubmission[]
  sp: SugarPalette
}

export function BnSubmissionsDrawer({
  open,
  onClose,
  subs,
  sp,
}: BnSubmissionsDrawerProps) {
  const { t } = useTranslation('listings')
  if (!open) return null
  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(15,23,42,0.45)',
          backdropFilter: 'blur(2px)',
          WebkitBackdropFilter: 'blur(2px)',
          zIndex: 100,
          animation: 'bnFade .15s ease-out',
        }}
      />
      <aside
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 460,
          maxWidth: '100vw',
          background: sp.pageBg,
          borderLeft: `1px solid ${sp.cardBorder}`,
          zIndex: 101,
          animation: 'bnSlideIn .2s ease-out',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <header
          style={{
            padding: '20px 24px',
            borderBottom: `1px solid ${sp.cardBorder}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                color: sp.sub,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              {t('biens.submissions.inbox')}
            </div>
            <h2
              style={{
                margin: '2px 0 0',
                fontSize: 20,
                fontWeight: 800,
                color: sp.ink,
                letterSpacing: -0.4,
              }}
            >
              {t('biens.submissions.count', { count: subs.length })}
            </h2>
          </div>
          <div style={{ flex: 1 }} />
          <button
            onClick={onClose}
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: 0,
              background: sp.cardBg,
              cursor: 'pointer',
              color: sp.sub,
              fontSize: 18,
              fontFamily: 'inherit',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            ×
          </button>
        </header>
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px 20px',
          }}
        >
          {subs.map(s => {
            const c = s.contactId ? crmContactById(s.contactId) : null
            const draft = s.contactDraft
            const fullName = c
              ? c.firstName + ' ' + c.lastName
              : draft
                ? draft.firstName + ' ' + draft.lastName
                : t('biens.seller')
            const isUrgent = s.sla && s.sla.includes('24h')
            return (
              <button
                key={s.id}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '14px',
                  marginBottom: 8,
                  background: sp.cardBg,
                  border: `1px solid ${sp.cardBorder}`,
                  borderRadius: 14,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  gap: 12,
                }}
              >
                <BnPhoto id={s.id} sp={sp} w={56} h={56} signed={false} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      marginBottom: 3,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: sp.ink,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      {fullName}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 800,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        color: isUrgent ? '#E53935' : '#F59E0B',
                        padding: '2px 7px',
                        borderRadius: 999,
                        background: (isUrgent ? '#E53935' : '#F59E0B') + '1F',
                      }}
                    >
                      {isUrgent ? '24h' : '48h'}
                    </span>
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      color: sp.soft,
                      fontWeight: 600,
                      marginBottom: 4,
                    }}
                  >
                    {s.title}
                  </div>
                  <div
                    style={{
                      fontSize: 10.5,
                      color: sp.sub,
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span>
                      {t('biens.submissions.roomsArea', {
                        rooms: s.rooms,
                        area: s.area,
                      })}
                    </span>
                    <span>·</span>
                    <span>
                      {s.askingPrice
                        ? bnFmtCHF(s.askingPrice)
                        : s.askingRent
                          ? bnFmtCHF(s.askingRent) + t('biens.perMonth')
                          : t('biens.toEstimate')}
                    </span>
                    <span>·</span>
                    <span>{t('biens.submissions.receivedAgo', { time: bnRelative(s.submittedAt) })}</span>
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      </aside>
      <style>{`
        @keyframes bnSlideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes bnFade { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>,
    document.body,
  )
}
