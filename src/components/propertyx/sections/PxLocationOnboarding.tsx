// MEGGA Marketplace — Cold start "Où cherchez-vous ?" banner.
//
// Affiché entre le hero et la filter bar quand aucun canton n'est posé dans
// l'URL ET que l'utilisateur n'a pas dismissed pour cette session.
//
// 3 chemins de choix :
//   1. Reprendre la dernière recherche (si localStorage présent)
//   2. Détecter automatiquement (Geolocation API + reverse-geocode Mapbox)
//   3. Choisir manuellement (dropdown 26 cantons)
//
// + Lien "Voir toute la Suisse" pour dismiss la session.

import { useId, useState } from 'react'
import { PX } from '../tokens'
import PxFigmaIcon from '../PxFigmaIcon'
import {
  CANTON_LABELS,
  SWISS_CANTONS,
  useMarketFilters,
} from '@/hooks/useMarketFilters'
import {
  detectUserCanton,
  useLocationPreference,
} from '@/hooks/useLocationPreference'

interface PxLocationOnboardingProps {
  context: 'buy' | 'rent'
}

type DetectStatus =
  | 'idle'
  | 'detecting'
  | 'denied'
  | 'outside-ch'
  | 'unavailable'
  | 'timeout'

export default function PxLocationOnboarding({ context }: PxLocationOnboardingProps) {
  const { filters, update } = useMarketFilters(context)
  const { saved, setSaved, isDismissedThisSession, dismissForSession } =
    useLocationPreference()

  const [detectStatus, setDetectStatus] = useState<DetectStatus>('idle')
  const [chosenCanton, setChosenCanton] = useState<string>(saved?.canton ?? '')
  const labelId = useId()

  // Conditions d'affichage : pas de canton dans l'URL ET pas dismissé.
  if (filters.canton || isDismissedThisSession) return null

  const applyCanton = (canton: string) => {
    setSaved(canton)
    update({ canton })
  }

  const onDetect = async () => {
    setDetectStatus('detecting')
    const { canton, reason } = await detectUserCanton()
    if (canton) {
      applyCanton(canton)
      setDetectStatus('idle')
      return
    }
    // canton null → reason ne peut pas être 'ok' mais TS ne narrow pas
    // l'union sans guard explicite.
    if (reason !== 'ok') setDetectStatus(reason)
  }

  const detectLabel =
    detectStatus === 'detecting' ? 'Détection…' :
    detectStatus === 'denied' ? 'Permission refusée' :
    detectStatus === 'outside-ch' ? 'Hors Suisse — choisissez ci-dessous' :
    detectStatus === 'unavailable' ? 'Géolocalisation indisponible' :
    detectStatus === 'timeout' ? 'Délai dépassé — réessayer' :
    'Détecter ma position'

  const ctaIntro = context === 'rent'
    ? 'Pour louer en Suisse'
    : 'Pour acheter en Suisse'

  return (
    <section
      aria-labelledby={labelId}
      style={{
        width: '100%',
        maxWidth: 1392,
        margin: '0 auto',
        paddingLeft: 24,
        paddingRight: 24,
        position: 'relative',
        zIndex: 4,
      }}
    >
      <div
        style={{
          background: PX.neutral100,
          border: `1px solid ${PX.neutral300}`,
          borderRadius: PX.radius.large,
          padding: 32,
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          boxShadow: PX.shadow.small,
        }}
      >
        {/* Eyebrow + heading */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span
            style={{
              fontFamily: PX.font.display,
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '0.5px',
              color: PX.neutral500,
              textTransform: 'uppercase',
            }}
          >
            {ctaIntro}
          </span>
          <h2
            id={labelId}
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 28,
              fontWeight: 500,
              lineHeight: 1.2,
              letterSpacing: '-0.84px',
              color: PX.neutral700,
            }}
          >
            Où cherchez-vous ?
          </h2>
          <p
            style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 15,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.45px',
              color: PX.neutral500,
              maxWidth: 640,
            }}
          >
            Précisez un canton pour ne voir que les biens près de chez vous.
            Plus de 33{'’'}000 biens à travers la Suisse — autant éviter
            de scroller ceux à l{'’'}autre bout du pays.
          </p>
        </div>

        {/* Actions row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
          }}
        >
          {/* 1. Suggestion saved location */}
          {saved && (
            <button
              type="button"
              onClick={() => applyCanton(saved.canton)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                height: 48,
                paddingLeft: 16,
                paddingRight: 20,
                background: PX.neutral700,
                color: PX.neutral100,
                border: 0,
                borderRadius: PX.radius.pill,
                cursor: 'pointer',
                fontFamily: PX.font.display,
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.45px',
              }}
            >
              <PxFigmaIcon name="arrow-right" size={10} color={PX.neutral100} />
              Reprendre à {CANTON_LABELS[saved.canton] ?? saved.canton}
            </button>
          )}

          {/* 2. Détecter ma position */}
          <button
            type="button"
            onClick={onDetect}
            disabled={detectStatus === 'detecting'}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              height: 48,
              paddingLeft: 16,
              paddingRight: 20,
              background: PX.neutral100,
              color: PX.neutral700,
              border: `1px solid ${PX.neutral700}`,
              borderRadius: PX.radius.pill,
              cursor: detectStatus === 'detecting' ? 'wait' : 'pointer',
              fontFamily: PX.font.display,
              fontSize: 15,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.45px',
              opacity: detectStatus === 'detecting' ? 0.6 : 1,
            }}
          >
            <PxFigmaIcon name="location" size={16} color={PX.neutral700} />
            {detectLabel}
          </button>

          {/* 3. Canton picker (select) */}
          <div
            style={{
              position: 'relative',
              display: 'inline-flex',
              alignItems: 'center',
              background: PX.neutral200,
              borderRadius: PX.radius.pill,
              height: 48,
              minWidth: 220,
              paddingLeft: 16,
              paddingRight: 36,
            }}
          >
            <select
              aria-label="Choisir un canton"
              value={chosenCanton}
              onChange={e => {
                const v = e.target.value
                setChosenCanton(v)
                if (v) applyCanton(v)
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 0,
                outline: 'none',
                color: chosenCanton ? PX.neutral700 : PX.neutral500,
                fontFamily: PX.font.display,
                fontSize: 15,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.45px',
                paddingTop: 2,
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
              }}
            >
              <option value="">Choisir un canton…</option>
              {SWISS_CANTONS.map(code => (
                <option key={code} value={code}>
                  {CANTON_LABELS[code]} ({code})
                </option>
              ))}
            </select>
            <span
              style={{
                position: 'absolute',
                right: 14,
                top: '50%',
                transform: 'translateY(-50%)',
                pointerEvents: 'none',
                display: 'flex',
              }}
              aria-hidden
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="m4 6 4 4 4-4"
                  stroke={PX.neutral500}
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
          </div>

          {/* 4. Dismiss "Voir toute la Suisse" */}
          <button
            type="button"
            onClick={dismissForSession}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 48,
              paddingLeft: 4,
              paddingRight: 4,
              background: 'transparent',
              border: 0,
              cursor: 'pointer',
              fontFamily: PX.font.display,
              fontSize: 14,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.42px',
              color: PX.neutral500,
              textDecoration: 'underline',
              textDecorationColor: PX.neutral400,
              textUnderlineOffset: 4,
            }}
          >
            Voir toute la Suisse
          </button>
        </div>
      </div>
    </section>
  )
}
