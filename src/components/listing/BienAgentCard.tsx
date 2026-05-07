// MEGGA — Bien agent card sticky (port 1:1 du proto megga-bien-contact.jsx).
// Inclut le registre PARTNER_AGENCIES (Naef, Cardis, Bernard Nicod) et la
// variante "partenaire" complète : bandeau agence en haut + avatar/CTA aux
// couleurs partenaire + footer agence (fullName, address, USPI, mandat).

import { useState } from 'react'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  card: '#FFFFFF',
  cardSoft: '#F6F8FC',
  green: '#0041D9',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

/** Partner agencies registry — port 1:1 du proto megga-bien-contact.jsx. */
export interface PartnerAgency {
  name: string
  monogram: string
  monogramFont: string
  accent: string
  accentSoft: string
  tagline: string
  establishedYear: number
  address: string
  badge: 'Exclusif' | 'Partagé'
  fullName: string
  site: string
}

export const PARTNER_AGENCIES: Record<string, PartnerAgency> = {
  naef: {
    name: 'Naef Immobilier',
    monogram: 'N',
    monogramFont: "'Cormorant Garamond', 'Times New Roman', serif",
    accent: '#0E1410',
    accentSoft: '#F4F2EE',
    tagline: 'Depuis 1881',
    establishedYear: 1881,
    address: 'Av. de la Gare 4, 1003 Lausanne',
    badge: 'Exclusif',
    fullName: 'Naef Immobilier Lausanne SA',
    site: 'naef.ch',
  },
  cardis: {
    name: "Cardis Sotheby's",
    monogram: 'C',
    monogramFont: "'Cormorant Garamond', 'Times New Roman', serif",
    accent: '#0B2545',
    accentSoft: '#EEF2F7',
    tagline: "Sotheby's International Realty",
    establishedYear: 1979,
    address: 'Rue du Mont-Blanc 17, 1201 Genève',
    badge: 'Exclusif',
    fullName: "Cardis Immobilier Sotheby's SA",
    site: 'cardis.ch',
  },
  bernard: {
    name: 'Bernard Nicod',
    monogram: 'BN',
    monogramFont: "'Manrope', sans-serif",
    accent: '#9C1B2C',
    accentSoft: '#FBEDEF',
    tagline: 'Régie immobilière',
    establishedYear: 1973,
    address: 'Av. de la Gare 25, 1001 Lausanne',
    badge: 'Partagé',
    fullName: 'Bernard Nicod SA',
    site: 'bernard-nicod.ch',
  },
}

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
  /** Stats agent — affichées en row 3 cols. */
  soldThisYear?: number | null
  rating?: number | null
  ratingCount?: number | null
  langs?: string[] | null
  /** Clé du partenaire dans PARTNER_AGENCIES — active la variante partner */
  partnerKey?: 'naef' | 'cardis' | 'bernard' | null
  /** Disposition de la card (port proto megga-bien-contact.jsx wrapper).
   *  - sticky (default) : sticky 380px en colonne droite
   *  - banner           : card simple sans sticky (à intégrer dans le flow)
   *  - floating         : fixed bottom-right widget                        */
  layout?: 'sticky' | 'banner' | 'floating'
  /** Statut du bien — désactive le CTA si sold/compromis */
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
  partnerKey,
  layout = 'sticky',
  status = 'available',
  isFavorite: _isFavorite,
  onToggleFavorite: _onToggleFavorite,
  onAskVisit,
  onContact,
}: BienAgentCardProps) {
  void _isFavorite
  void _onToggleFavorite

  const partner = partnerKey ? PARTNER_AGENCIES[partnerKey] : null

  const [phoneShown, setPhoneShown] = useState(false)
  const [shared, setShared] = useState(false)


  const isUnavail = status === 'sold' || status === 'compromis'
  const statusLabel = status === 'sold' ? 'vendu' : 'sous compromis'

  // Build 5-digit reference from bien id
  const verifiedRef = (() => {
    if (!bienId) return 'MG-—'
    const digits = String(bienId).replace(/\D/g, '')
    if (digits) return `MG-${digits.slice(-5).padStart(5, '0')}`
    let hash = 0
    for (let i = 0; i < String(bienId).length; i++) {
      hash = (hash * 31 + String(bienId).charCodeAt(i)) >>> 0
    }
    return `MG-${String(hash % 100000).padStart(5, '0')}`
  })()

  const handleShare = () => {
    if (typeof window !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href)
      setShared(true)
      setTimeout(() => setShared(false), 1800)
    }
  }

  // Wrapper styles — port proto megga-bien-contact.jsx (no padding, overflow:hidden,
  // partner banner inside top, body padding 20×18 with flex column gap 14)
  const wrapperStyle: React.CSSProperties = (() => {
    if (layout === 'banner') {
      return {
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 24,
        fontFamily: FONT,
      }
    }
    if (layout === 'floating') {
      return {
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 90,
        width: 360,
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        boxShadow: '0 20px 50px rgba(14,20,16,0.18)',
        fontFamily: FONT,
      }
    }
    // sticky (default)
    return {
      position: 'sticky',
      top: 24,
      background: M.card,
      border: `1px solid ${M.border}`,
      borderRadius: 16,
      overflow: 'hidden',
      boxShadow: '0 1px 3px rgba(14,20,16,0.04)',
      fontFamily: FONT,
    }
  })()

  // Initials from agent name (e.g. "Sophie Martin" → "SM")
  const initials = agent.name
    .split(/\s+/)
    .filter(Boolean)
    .map(n => n[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2)

  return (
    <div style={wrapperStyle}>

      {/* === Bandeau agence partenaire (port 1:1 du code design fourni) === */}
      {partner && (
        <div
          style={{
            padding: '14px 18px',
            background: partner.accentSoft,
            borderBottom: `1px solid ${M.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          {/* Monogramme */}
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 6,
              flexShrink: 0,
              background: partner.accent,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: partner.monogramFont,
              fontSize: partner.monogram.length > 1 ? 16 : 24,
              fontWeight: 700,
            }}
          >
            {partner.monogram}
          </div>
          {/* Nom + tagline */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 700, color: M.ink, lineHeight: 1.2 }}>
              {partner.name}
            </div>
            <div style={{ fontSize: 11, color: partner.accent, fontWeight: 600, marginTop: 2 }}>
              {partner.tagline}
            </div>
          </div>
          {/* Badge EXCLUSIF */}
          <div
            style={{
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: 0.8,
              color: partner.accent,
              border: `1.5px solid ${partner.accent}`,
              padding: '3px 8px',
              borderRadius: 3,
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            {partner.badge}
          </div>
        </div>
      )}

      {/* === Corps de la carte === */}
      <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Identité agent — HORIZONTAL avec avatar 56×56 (port 1:1) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 999,
              flexShrink: 0,
              background: partner ? partner.accent : M.green,
              color: '#fff',
              fontSize: 19,
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              letterSpacing: 0.5,
              backgroundImage: agent.photo ? `url(${agent.photo})` : undefined,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}
          >
            {!agent.photo && initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: M.ink, lineHeight: 1.2 }}>
              {agent.name}
            </div>
            <div style={{ fontSize: 12, color: M.muted, marginTop: 3 }}>
              Courtier · {partner ? partner.name : (agent.agency || 'MEGGA Real Estate')}
            </div>
          </div>
        </div>

        {/* Stats — 3 cols Biens / Avis / Langues */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            background: '#F2F4F8',
            borderRadius: 10,
          }}
        >
          {[
            { v: soldThisYear != null ? String(soldThisYear) : '—', l: `Biens ${new Date().getFullYear()}` },
            rating != null
              ? { v: `${rating}/5`, l: `${ratingCount || 0} avis` }
              : { v: '—', l: 'Avis' },
            { v: (langs && langs.length > 0 ? langs.join(' · ') : 'FR'), l: 'Langues' },
          ].map((s, i) => (
            <div
              key={i}
              style={{
                textAlign: 'center',
                padding: '10px 4px',
                borderRight: i < 2 ? `1px solid ${M.border}` : 'none',
              }}
            >
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 800,
                  color: M.ink,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {s.v}
              </div>
              <div
                style={{
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

        {/* CTAs */}
        {isUnavail ? (
          <div
            style={{
              padding: 14,
              background: '#FEF3F3',
              border: '1px solid #FBC8C8',
              borderRadius: 10,
              fontSize: 13,
              color: '#A93D26',
              lineHeight: 1.5,
            }}
          >
            Ce bien est <b>{statusLabel}</b>. {agent.name.split(' ')[0]} peut vous proposer des biens similaires.
          </div>
        ) : (
          <button
            onClick={onAskVisit}
            style={{
              width: '100%',
              height: 50,
              borderRadius: 999,
              border: 'none',
              background: partner ? partner.accent : M.green,
              color: '#fff',
              fontSize: 15,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 9,
              transition: 'filter 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(0.88)')}
            onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
          >
            {/* icône enveloppe */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="1.5" y="3.5" width="13" height="9" rx="1.5" stroke="white" strokeWidth="1.5" />
              <path d="M1.5 5l6.5 4.5L14.5 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            Demander une visite
          </button>
        )}

        {/* Poser une question */}
        <button
          onClick={onContact}
          style={{
            width: '100%',
            height: 46,
            borderRadius: 999,
            border: `1.5px solid ${M.ink}`,
            background: 'transparent',
            color: M.ink,
            fontSize: 14,
            fontWeight: 700,
            cursor: 'pointer',
            transition: 'background 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = '#F2F4F8')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        >
          Poser une question
        </button>

        {/* Voir le numéro */}
        {agent.phone && (
          <button
            onClick={() => setPhoneShown(true)}
            disabled={phoneShown}
            style={{
              width: '100%',
              height: 42,
              borderRadius: 10,
              border: `1px solid ${M.border}`,
              background: phoneShown ? '#F2F4F8' : '#fff',
              color: M.ink,
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
            {/* icône téléphone */}
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 11.4v2.1a1.4 1.4 0 0 1-1.5 1.4 13.9 13.9 0 0 1-6.1-2.2 13.7 13.7 0 0 1-4.2-4.2A13.9 13.9 0 0 1 0 2.5 1.4 1.4 0 0 1 1.4 1h2.1a1.4 1.4 0 0 1 1.4 1.2c.1.7.2 1.4.5 2a1.4 1.4 0 0 1-.3 1.5L4.2 6.7a11.2 11.2 0 0 0 4.2 4.2l1-.9a1.4 1.4 0 0 1 1.5-.3c.6.2 1.3.4 2 .5a1.4 1.4 0 0 1 1.2 1.4z" />
            </svg>
            {phoneShown ? agent.phone : 'Voir le numéro'}
          </button>
        )}

        <hr style={{ border: 'none', borderTop: `1px solid ${M.border}`, margin: 0 }} />

        {/* Pied agence */}
        {partner && (
          <>
            <div style={{ fontSize: 11, color: M.muted, lineHeight: 1.6 }}>
              <div style={{ fontWeight: 700, color: M.ink, marginBottom: 1 }}>{partner.fullName}</div>
              <div>{partner.address}</div>
              <div>{partner.site} · Membre USPI · Mandat depuis {partner.establishedYear}</div>
            </div>
            <hr style={{ border: 'none', borderTop: `1px solid ${M.border}`, margin: 0 }} />
          </>
        )}

        {/* Vérifié + Partager */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: M.muted }}>
            {/* icône check cerclé */}
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <circle cx="7" cy="7" r="6" stroke={M.green} strokeWidth="1.4" />
              <path d="M4 7l2.2 2.2L10 5" stroke={M.green} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {partner ? 'Vérifié MEGGA' : 'Vérifié'} · {verifiedRef}
          </div>
          <button
            onClick={handleShare}
            style={{
              background: 'transparent',
              border: 'none',
              color: M.muted,
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontFamily: FONT,
            }}
          >
            {shared ? (
              'Lien copié ✓'
            ) : (
              <>
                <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4">
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
    </div>
  )
}
