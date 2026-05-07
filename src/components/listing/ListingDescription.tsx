// MEGGA — ListingDescription (port 1:1 du proto megga-bien-features.jsx
// DescriptionBlock).
// Card wrapper + SectionTitle (eyebrow blue + h2) + paragraphes + bouton
// "Lire la suite" / "Voir moins" avec chevron animé.

import { useState } from 'react'
import { Sparkles } from 'lucide-react'
import { useTranslatedDescription } from '@/hooks/useTranslatedDescription'

const M = {
  ink: '#0E1410',
  soft: '#3F4640',
  muted: '#7A8079',
  border: '#E6E8EC',
  card: '#FFFFFF',
  green: '#0041D9',
}
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

interface ListingDescriptionProps {
  description: string
}

export default function ListingDescription({ description }: ListingDescriptionProps) {
  const [open, setOpen] = useState(false)
  const { text, isLoading, isTranslated } = useTranslatedDescription(description)

  if (!description) return null

  // Split into paragraphes — d'abord sur \n\n, sinon sur \n simple, sinon
  // un seul paragraphe.
  const allParagraphs = text.includes('\n\n')
    ? text.split('\n\n').map(p => p.trim()).filter(Boolean)
    : text.split('\n').map(p => p.trim()).filter(Boolean)

  const visible = open ? allParagraphs : allParagraphs.slice(0, 2)
  const hasMore = allParagraphs.length > 2

  return (
    <div
      id="description"
      className="scroll-mt-28"
      style={{
        background: M.card,
        border: `1px solid ${M.border}`,
        borderRadius: 14,
        padding: 22,
        fontFamily: FONT,
      }}
    >
      {/* SectionTitle proto */}
      <div style={{ marginBottom: 16 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginBottom: 6,
          }}
        >
          <div
            style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 700,
              color: M.green,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
            }}
          >
            Description
          </div>
          {isTranslated && (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                fontSize: 11,
                color: M.muted,
                fontWeight: 500,
              }}
            >
              <Sparkles size={10} strokeWidth={2} />
              Traduction automatique
            </span>
          )}
        </div>
        <h2
          style={{
            fontFamily: FONT,
            fontSize: 24,
            fontWeight: 700,
            color: M.ink,
            margin: 0,
            letterSpacing: -0.5,
          }}
        >
          Le bien en détail
        </h2>
      </div>

      {isLoading ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div
            style={{
              height: 12,
              background: '#F2F4F8',
              borderRadius: 4,
              width: '100%',
              animation: 'megga-pulse 1.4s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 12,
              background: '#F2F4F8',
              borderRadius: 4,
              width: '92%',
              animation: 'megga-pulse 1.4s ease-in-out infinite',
            }}
          />
          <div
            style={{
              height: 12,
              background: '#F2F4F8',
              borderRadius: 4,
              width: '80%',
              animation: 'megga-pulse 1.4s ease-in-out infinite',
            }}
          />
          <style>{`@keyframes megga-pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 0.3; } }`}</style>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {visible.map((p, i) => (
              <p
                key={i}
                style={{
                  fontFamily: FONT,
                  fontSize: 14.5,
                  lineHeight: 1.65,
                  color: M.soft,
                  margin: 0,
                }}
              >
                {p}
              </p>
            ))}
          </div>
          {hasMore && (
            <button
              onClick={() => setOpen(o => !o)}
              style={{
                marginTop: 14,
                height: 36,
                padding: '0 16px',
                borderRadius: 999,
                border: `1px solid ${M.border}`,
                background: '#fff',
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 700,
                color: M.ink,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = M.ink
                e.currentTarget.style.background = '#F6F8FC'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = M.border
                e.currentTarget.style.background = '#fff'
              }}
            >
              {open ? 'Voir moins' : 'Lire la suite'}
              <svg
                width="10"
                height="10"
                viewBox="0 0 10 10"
                fill="none"
                style={{
                  transform: open ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s',
                }}
              >
                <path
                  d="M2 4l3 3 3-3"
                  stroke={M.ink}
                  strokeWidth="1.6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </>
      )}
    </div>
  )
}
