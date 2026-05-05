import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

const FONT = '"Manrope", system-ui, -apple-system, sans-serif'
const M = {
  ink: '#0E1410',
  border: '#DDE2EA',
  cream: '#FAF8F4',
  card: '#FFFFFF',
  muted: '#7A8079',
}

interface LogoCellProps {
  children: ReactNode
  label: string
  first?: boolean
}

function LogoCell({ children, label, first }: LogoCellProps) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '32px 28px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        borderLeft: first ? '0' : `1px solid ${M.border}`,
      }}
    >
      <div
        style={{
          height: 44,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        {children}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 12,
          fontWeight: 500,
          color: M.muted,
          textAlign: 'center',
          lineHeight: 1.4,
          letterSpacing: -0.1,
        }}
      >
        {label}
      </div>
    </div>
  )
}

export default function TrustBar() {
  const { t } = useTranslation('common')

  return (
    <section
      style={{
        padding: 'clamp(48px, 8vw, 72px) clamp(20px, 5vw, 80px) clamp(40px, 6vw, 60px)',
        background: M.cream,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 40,
          marginBottom: 28,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ maxWidth: 620 }}>
          <h3
            style={{
              fontFamily: FONT,
              fontSize: 'clamp(20px, 3vw, 26px)',
              fontWeight: 600,
              color: M.ink,
              margin: 0,
              letterSpacing: -0.6,
              lineHeight: 1.2,
              maxWidth: 520,
            }}
          >
            {t('home.trustTitle', 'Conçu en Suisse, ouvert au reste du monde.')}
          </h3>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          background: M.card,
          border: `1px solid ${M.border}`,
          borderRadius: 20,
          overflow: 'hidden',
          flexWrap: 'wrap',
        }}
      >
        <LogoCell first label={t('home.trustSms', 'Logiciel suisse certifié')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 38 }}>
            <svg viewBox="4 7 44 38" style={{ height: 32, width: 'auto' }} xmlns="http://www.w3.org/2000/svg">
              <path
                d="M45.28,42.51H9.24c-1.76,0-3.18-1.43-3.18-3.18v-20.16c0-.43.09-.86.26-1.26l3.07-7.15c.5-1.17,1.65-1.92,2.92-1.92h13.36c1.3,0,2.47.79,2.95,2,0,0,.51,1.26,1,2.5h15.66c1.76,0,3.18,1.42,3.18,3.18v22.81c0,1.76-1.42,3.18-3.18,3.18M21.43,25.97c-1.03,0-1.57.79-1.57,1.57s.54,1.57,1.57,1.57h4.33v4.34c0,1.03.78,1.57,1.57,1.57s1.57-.54,1.57-1.57v-4.34h4.33c1.03,0,1.57-.79,1.57-1.57s-.54-1.57-1.57-1.57h-4.33v-4.34c0-1.03-.78-1.57-1.57-1.57s-1.57.54-1.57,1.57v4.34h-4.33"
                fill="#E42321"
              />
            </svg>
            <img
              src="/sms-wordmark.svg"
              alt="Swiss Made Software"
              style={{ height: 28, width: 'auto', objectFit: 'contain' }}
              loading="lazy"
              decoding="async"
            />
          </div>
        </LogoCell>

        <LogoCell label={t('home.trustC2pa', "Photos d'annonces authentifiées")}>
          <img
            src="/c2pa-logo.svg"
            alt="C2PA"
            style={{ height: 32, width: 'auto', objectFit: 'contain', maxWidth: '100%' }}
            loading="lazy"
            decoding="async"
          />
        </LogoCell>

        <LogoCell label={t('home.trustGcal', 'Visites synchronisées Google Calendar')}>
          <img
            src="/google-calendar-logo.svg"
            alt="Google Calendar"
            style={{ height: 36, width: 'auto', objectFit: 'contain', maxWidth: '100%' }}
            loading="lazy"
            decoding="async"
          />
        </LogoCell>

        <LogoCell label={t('home.trustOutlook', 'Compatible Outlook & Microsoft 365')}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 44 }}>
            <img
              src="/outlook-icon-2025.svg"
              alt=""
              style={{ height: 36, width: 'auto', objectFit: 'contain' }}
              loading="lazy"
              decoding="async"
            />
            <img
              src="/outlook-wordmark.svg"
              alt="Outlook"
              style={{ height: 22, width: 'auto', objectFit: 'contain' }}
              loading="lazy"
              decoding="async"
            />
          </div>
        </LogoCell>
      </div>
    </section>
  )
}
