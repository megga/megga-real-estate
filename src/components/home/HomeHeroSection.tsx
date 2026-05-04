import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, ChevronDown } from 'lucide-react'

// Hero refondu fidèle au design Claude « MEGGA Homepage » :
// — photo 100vh full-bleed avec gradient cinématique
// — h1 88px (Manrope) en bottom-left + sub-text en bottom-right
// — chips contextuels (Maison/Appartement/Terrain) avec backdrop blur
// — search card overlapping le bottom du hero (5 colonnes + bouton)
// — scroll indicator (mouse animation) en bas centre
// — la Navbar globale est en mode transparent sur la homepage

const FONT = "'Manrope', system-ui, -apple-system, sans-serif"

const ACCENT = '#0041D9'
const INK = '#0E1410'
const MUTED = '#847D6E'
const BORDER = '#DDE2EA'
const SECTION = '#F2F4F8'

type Tab = 'acheter' | 'louer'

interface FieldProps {
  label: string
  value: string
  placeholder: string
  onClick?: () => void
  isFirst?: boolean
}

function Field({ label, value, placeholder, onClick, isFirst }: FieldProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        borderLeft: isFirst ? 'none' : `1px solid ${BORDER}`,
        padding: '0 18px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        background: 'transparent',
        border: 'none',
        borderRadius: 0,
        cursor: 'pointer',
        textAlign: 'left',
        height: 56,
      }}
    >
      <div
        style={{
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          color: MUTED,
          marginBottom: 4,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: FONT,
          fontSize: 14,
          color: value ? INK : '#B8BCC5',
          fontWeight: 500,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
        }}
      >
        {value || placeholder}
        <ChevronDown size={12} style={{ opacity: 0.4 }} />
      </div>
    </button>
  )
}

interface ChipProps {
  children: React.ReactNode
}

function Chip({ children }: ChipProps) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        height: 28,
        padding: '0 12px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.18)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        border: '1px solid rgba(255,255,255,0.4)',
        color: '#fff',
        fontFamily: FONT,
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {children}
    </span>
  )
}

export default function HomeHeroSection() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('acheter')
  const [query, setQuery] = useState('')

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    const path = tab === 'louer' ? '/louer' : '/acheter'
    if (!query.trim()) {
      navigate(path)
      return
    }
    navigate(`${path}?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <section
      style={{
        position: 'relative',
        width: '100%',
        height: '100vh',
        minHeight: 720,
        overflow: 'hidden',
        background: 'linear-gradient(180deg, #1B2A4E 0%, #0F1A33 60%, #060B1A 100%)',
        fontFamily: FONT,
      }}
    >
      {/* Hero photo (full-bleed) */}
      <img
        src="/hero-megga.jpg"
        alt="Architecture résidentielle suisse contemporaine"
        loading="eager"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          objectPosition: 'center 60%',
        }}
      />

      {/* Cinematic dark overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(10,14,10,0.55) 0%, rgba(10,14,10,0.15) 30%, rgba(10,14,10,0.10) 55%, rgba(10,14,10,0.70) 100%)',
        }}
      />

      {/* Hero copy — bottom-left */}
      <div
        style={{
          position: 'absolute',
          left: 'clamp(20px, 5vw, 80px)',
          bottom: 'clamp(280px, 32vh, 360px)',
          maxWidth: 760,
          zIndex: 2,
        }}
      >
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          <Chip>Maison</Chip>
          <Chip>Appartement</Chip>
          <Chip>Terrain</Chip>
        </div>
        <h1
          style={{
            fontFamily: FONT,
            fontSize: 'clamp(44px, 7vw, 88px)',
            fontWeight: 700,
            lineHeight: 1.0,
            color: '#fff',
            margin: 0,
            letterSpacing: -2.5,
          }}
        >
          Trouvez votre bien.
          <br />
          Partout en Suisse.
        </h1>
      </div>

      {/* Hero sub — bottom-right */}
      <div
        style={{
          position: 'absolute',
          right: 'clamp(20px, 5vw, 80px)',
          bottom: 'clamp(310px, 34vh, 390px)',
          maxWidth: 300,
          zIndex: 2,
          display: 'none',
        }}
        className="hero-sub-md"
      >
        <p
          style={{
            fontFamily: FONT,
            fontSize: 14,
            color: 'rgba(255,255,255,0.9)',
            lineHeight: 1.55,
            margin: 0,
          }}
        >
          La marketplace de référence pour acheter, louer ou vendre un bien immobilier en Suisse —
          avec la transparence et la conformité MEGGA.
        </p>
      </div>

      {/* Search card overlapping bottom */}
      <form
        onSubmit={handleSubmit}
        style={{
          position: 'absolute',
          left: 'clamp(20px, 5vw, 80px)',
          right: 'clamp(20px, 5vw, 80px)',
          bottom: 80,
          background: '#fff',
          borderRadius: 18,
          padding: '20px 24px',
          boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
          zIndex: 3,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div style={{ fontFamily: FONT, fontSize: 16, fontWeight: 700, color: INK }}>
            Trouvez le bien idéal
          </div>
          <div
            style={{
              display: 'flex',
              gap: 4,
              padding: 4,
              background: SECTION,
              borderRadius: 999,
            }}
          >
            {(['acheter', 'louer'] as Tab[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                style={{
                  height: 32,
                  padding: '0 14px',
                  border: 'none',
                  cursor: 'pointer',
                  borderRadius: 999,
                  fontFamily: FONT,
                  fontSize: 13,
                  fontWeight: 600,
                  background: tab === t ? '#fff' : 'transparent',
                  color: tab === t ? INK : MUTED,
                  boxShadow: tab === t ? '0 1px 2px rgba(0,0,0,0.06)' : 'none',
                  textTransform: 'capitalize',
                }}
              >
                {t === 'acheter' ? 'Acheter' : 'Louer'}
              </button>
            ))}
          </div>
        </div>

        <div className="hero-search-grid">
          <div
            style={{
              padding: '0 18px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              height: 56,
              flex: '1.4 1 0',
              minWidth: 200,
            }}
          >
            <label
              htmlFor="hero-query"
              style={{
                fontFamily: FONT,
                fontSize: 11,
                fontWeight: 600,
                color: MUTED,
                marginBottom: 4,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Localisation
            </label>
            <input
              id="hero-query"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ville, NPA, canton"
              style={{
                fontFamily: FONT,
                fontSize: 14,
                color: INK,
                fontWeight: 500,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: 0,
              }}
            />
          </div>
          <Field label="Type" value="" placeholder="Tous les types" />
          <Field label="Budget" value="" placeholder="CHF" />
          <Field label="Pièces" value="" placeholder="Indifférent" />
          <button
            type="submit"
            style={{
              height: 56,
              border: 'none',
              borderRadius: 12,
              background: ACCENT,
              color: '#fff',
              fontFamily: FONT,
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '0 20px',
              minWidth: 160,
            }}
          >
            <Search size={16} />
            Rechercher
          </button>
        </div>
      </form>

      {/* Scroll indicator */}
      <div
        style={{
          position: 'absolute',
          bottom: 24,
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          color: 'rgba(255,255,255,0.7)',
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 500,
          letterSpacing: 1,
          textTransform: 'uppercase',
          zIndex: 2,
          pointerEvents: 'none',
        }}
      >
        <span>Découvrir</span>
        <svg width="14" height="20" viewBox="0 0 14 20" fill="none">
          <rect
            x="1"
            y="1"
            width="12"
            height="18"
            rx="6"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth="1"
          />
          <circle cx="7" cy="6" r="1.5" fill="#fff">
            <animate attributeName="cy" values="6;12;6" dur="1.8s" repeatCount="indefinite" />
          </circle>
        </svg>
      </div>

      <style>{`
        @media (min-width: 768px) {
          .hero-sub-md { display: block !important; }
        }
        .hero-search-grid {
          display: grid;
          grid-template-columns: 1.4fr 1fr 1fr 1fr 160px;
          gap: 0;
          align-items: stretch;
        }
        @media (max-width: 900px) {
          .hero-search-grid {
            grid-template-columns: 1fr 1fr;
            gap: 12px;
          }
          .hero-search-grid > button[type="submit"] {
            grid-column: 1 / -1;
          }
        }
      `}</style>
    </section>
  )
}
