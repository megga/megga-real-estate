// MEGGA — Bien agent card sticky (port focused du proto megga-bien-contact.jsx).
//
// Différences vs proto complet :
// - Pas de PARTNER_AGENCIES registry (Naef/Cardis/Bernard Nicod) — sera porté
//   dans une PR ultérieure quand on aura les vraies agences partenaires
// - Pas de QuickQuestionForm inline (le bouton "Poser une question" ouvre
//   l'ancien ContactAgentModal via onContact)
// - Pas de visit-request modal 3-step (le bouton "Demander une visite"
//   ouvre l'ancien RequestVisitModal via onVisit)
//
// Match proto pour : layout sticky, avatar 56px gradient ink/blue, chip
// "Partenaire MEGGA", stats row 3 cols (biens / rating / langues),
// CTAs (Demander visite ink/blue · Poser question outline · Voir numéro),
// footer Vérifiée + Partager.

import { useState } from 'react'

const M = {
  ink: '#0E1410',
  soft: '#4A5249',
  muted: '#847D6E',
  border: '#DDE2EA',
  card: '#FFFFFF',
  cardSoft: '#F6F8FC',
  green: '#0041D9',
  greenAccent: '#1A7A3A',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

interface AgentInfo {
  name: string
  agency?: string
  phone?: string
  email?: string
  photo?: string | null
}

interface BienAgentCardProps {
  agent: AgentInfo
  bienId?: string | null
  /** Stats agent — affichées en row 3 cols. Tous optionnels. */
  soldThisYear?: number | null
  rating?: number | null
  ratingCount?: number | null
  langs?: string[] | null
  /** Statut du bien — désactive le CTA "Demander une visite" si sold/compromis */
  status?: 'available' | 'compromis' | 'sold'
  isFavorite?: boolean
  onToggleFavorite?: () => void
  onAskVisit?: () => void
  onContact?: () => void
}

export default function BienAgentCard({
  agent,
  bienId,
  soldThisYear,
  rating,
  ratingCount,
  langs,
  status = 'available',
  isFavorite: _isFavorite,
  onToggleFavorite: _onToggleFavorite,
  onAskVisit,
  onContact,
}: BienAgentCardProps) {
  void _isFavorite
  void _onToggleFavorite

  const [phoneShown, setPhoneShown] = useState(false)
  const [shared, setShared] = useState(false)

  const initials = agent.name
    .split(/\s+/)
    .filter(Boolean)
    .map(n => n[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)

  const isUnavail = status === 'sold' || status === 'compromis'
  const statusLabel = status === 'sold' ? 'vendu' : 'sous compromis'

  const verifiedRef = bienId ? `MG-${String(bienId).padStart(5, '0')}` : 'MG-—'

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    }
  }

  return (
    <div
      style={{
        position: 'sticky',
        top: 24,
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 16,
        padding: 22,
        boxShadow: '0 1px 3px rgba(14,20,16,0.04)',
        fontFamily: FONT,
      }}
    >
      {/* Agent identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            background: 'linear-gradient(135deg, #0041D9, #6A8CFF)',
            color: '#fff',
            fontFamily: FONT,
            fontSize: 20,
            fontWeight: 800,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            letterSpacing: 0.5,
            flexShrink: 0,
            backgroundImage: agent.photo ? `url(${agent.photo})` : undefined,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {!agent.photo && initials}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
            <span
              style={{
                fontFamily: FONT,
                fontSize: 10,
                fontWeight: 800,
                letterSpacing: 0.6,
                color: M.green,
                background: '#E8EFFE',
                padding: '2px 7px',
                borderRadius: 4,
                textTransform: 'uppercase',
              }}
            >
              Partenaire MEGGA
            </span>
          </div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 16,
              fontWeight: 700,
              color: M.ink,
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {agent.name}
          </div>
          {agent.agency && (
            <div
              style={{
                fontFamily: FONT,
                fontSize: 12,
                color: M.muted,
                marginTop: 2,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {agent.agency}
            </div>
          )}
        </div>
      </div>

      {/* Stats row */}
      {(soldThisYear || rating || (langs && langs.length > 0)) && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 0,
            background: M.cardSoft,
            borderRadius: 10,
            padding: '10px 4px',
            marginBottom: 16,
          }}
        >
          {[
            soldThisYear != null
              ? { v: String(soldThisYear), l: `Biens ${new Date().getFullYear()}` }
              : { v: '—', l: 'Biens' },
            rating != null
              ? { v: `${rating}/5`, l: `${ratingCount || 0} avis` }
              : { v: '—', l: 'Avis' },
            { v: (langs && langs.length > 0 ? langs.join(' · ') : 'FR'), l: 'Langues' },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                textAlign: 'center',
                padding: '0 4px',
                borderRight: i < 2 ? `1px solid ${M.border}` : 'none',
              }}
            >
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 14,
                  fontWeight: 800,
                  color: M.ink,
                  fontVariantNumeric: 'tabular-nums',
                  letterSpacing: -0.2,
                }}
              >
                {s.v}
              </div>
              <div
                style={{
                  fontFamily: FONT,
                  fontSize: 10,
                  color: M.muted,
                  fontWeight: 600,
                  marginTop: 2,
                }}
              >
                {s.l}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Primary CTA */}
      {isUnavail ? (
        <div
          style={{
            padding: 14,
            background: '#FEF3F3',
            border: '1px solid #FBC8C8',
            borderRadius: 10,
            marginBottom: 12,
            fontFamily: FONT,
            fontSize: 13,
            color: '#A93D26',
            lineHeight: 1.5,
          }}
        >
          Ce bien est <b>{statusLabel}</b>. {agent.name.split(' ')[0]} peut vous proposer
          des biens similaires.
        </div>
      ) : (
        <button
          onClick={onAskVisit}
          style={{
            width: '100%',
            height: 48,
            borderRadius: 999,
            border: 'none',
            background: M.green,
            color: '#fff',
            fontFamily: FONT,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            marginBottom: 8,
            transition: 'filter 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.9)')}
          onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path
              d="M3 4l4 3 4-3M2 3h10v8H2z"
              stroke="#fff"
              strokeWidth="1.6"
              fill="none"
            />
          </svg>
          Demander une visite
        </button>
      )}

      {/* Secondary CTA — Poser une question (ouvre ContactAgentModal existant) */}
      <button
        onClick={onContact}
        style={{
          width: '100%',
          height: 44,
          borderRadius: 999,
          border: `1px solid ${M.ink}`,
          background: 'transparent',
          color: M.ink,
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          marginBottom: 8,
          transition: 'background 0.15s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = M.cardSoft)}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
      >
        Poser une question
      </button>

      {/* Phone reveal */}
      {agent.phone && (
        <button
          onClick={() => setPhoneShown(true)}
          disabled={phoneShown}
          style={{
            width: '100%',
            height: 40,
            borderRadius: 8,
            border: `1px solid ${M.border}`,
            background: phoneShown ? M.cardSoft : '#fff',
            color: M.ink,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 700,
            cursor: phoneShown ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14 11.4v2.1a1.4 1.4 0 0 1-1.5 1.4 13.9 13.9 0 0 1-6.1-2.2 13.7 13.7 0 0 1-4.2-4.2A13.9 13.9 0 0 1 0 2.5 1.4 1.4 0 0 1 1.4 1h2.1a1.4 1.4 0 0 1 1.4 1.2c.1.7.2 1.4.5 2a1.4 1.4 0 0 1-.3 1.5L4.2 6.7a11.2 11.2 0 0 0 4.2 4.2l1-.9a1.4 1.4 0 0 1 1.5-.3c.6.2 1.3.4 2 .5a1.4 1.4 0 0 1 1.2 1.4z" />
          </svg>
          {phoneShown ? agent.phone : 'Voir le numéro'}
        </button>
      )}

      {/* Footer: Verified + Share */}
      <div
        style={{
          marginTop: 16,
          paddingTop: 14,
          borderTop: `1px solid ${M.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontFamily: FONT,
          fontSize: 11,
          color: M.muted,
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            whiteSpace: 'nowrap',
          }}
        >
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke={M.green} strokeWidth="1.4" />
            <path
              d="M3.5 6l2 2 3-4"
              stroke={M.green}
              strokeWidth="1.4"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Vérifiée · {verifiedRef}
        </div>
        <button
          onClick={handleShare}
          style={{
            background: 'transparent',
            border: 'none',
            color: M.muted,
            fontFamily: FONT,
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          {shared ? (
            'Lien copié ✓'
          ) : (
            <>
              <svg
                width="11"
                height="11"
                viewBox="0 0 14 14"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              >
                <circle cx="3.5" cy="7" r="1.8" />
                <circle cx="10.5" cy="3.5" r="1.8" />
                <circle cx="10.5" cy="10.5" r="1.8" />
                <path d="M5 6l4-2 M5 8l4 2" />
              </svg>
              Partager
            </>
          )}
        </button>
      </div>
    </div>
  )
}
