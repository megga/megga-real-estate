// MEGGA — Auth particulier preview (port 1:1 du proto megga-auth-shell.jsx).
// Right-side panel : favorites mockup + alert chip + footer features.
// Background : light cream gradient.

import { AUTH_FONT, AUTH_M } from './authTokens'

const FAVORITES = [
  {
    t: 'Villa Cologny',
    p: "CHF 1’250’000",
    d: '+ CHF 30K vs marché',
    trend: 'up' as const,
  },
  {
    t: 'Loft Lausanne',
    p: 'CHF 890’000',
    d: '− CHF 45K depuis 30j',
    trend: 'down' as const,
  },
  {
    t: 'Chalet Verbier',
    p: "CHF 2’100’000",
    d: 'Stable',
    trend: 'flat' as const,
  },
]

const FOOTER_STATS = [
  { n: 'Gratuit', l: "Publication d'annonce" },
  { n: '< 60s', l: 'Estimation IA' },
  { n: '26', l: 'Cantons couverts' },
]

export default function ParticulierPreview() {
  return (
    <div
      style={{
        height: '100%',
        padding: 'clamp(40px, 5vw, 60px) clamp(32px, 4vw, 60px) 40px',
        background: 'linear-gradient(180deg, #F2F4F8 0%, #EBEFF6 100%)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: AUTH_FONT,
        color: AUTH_M.ink,
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background photo (subtle) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage:
            'url(https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&auto=format)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background:
            'linear-gradient(180deg, rgba(244,246,242,0.8) 0%, rgba(236,240,232,0.95) 100%)',
        }}
      />

      {/* Headline */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h2
          style={{
            fontSize: 'clamp(26px, 3.5vw, 32px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -0.8,
            margin: 0,
            maxWidth: 380,
          }}
        >
          Trouvez et publiez,
          <br />
          tout au même endroit.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: AUTH_M.soft,
            lineHeight: 1.5,
            margin: '14px 0 0',
            maxWidth: 360,
          }}
        >
          Favoris synchronisés, alertes prix, estimation IA, planning de
          visites — et la publication d’annonce reste gratuite.
        </p>
      </div>

      {/* Favorites mockup */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 24 }}>
        <div
          style={{
            background: '#fff',
            borderRadius: 16,
            padding: 18,
            boxShadow: '0 20px 50px rgba(14,20,16,0.10)',
            border: `1px solid ${AUTH_M.border}`,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 700 }}>Mes favoris · 4</div>
            <div style={{ fontSize: 11, color: AUTH_M.muted }}>↕ Tri prix</div>
          </div>
          {FAVORITES.map((row, i) => (
            <div
              key={row.t}
              style={{
                display: 'grid',
                gridTemplateColumns: '32px minmax(0, 1fr) auto',
                gap: 12,
                alignItems: 'center',
                padding: '10px 0',
                borderTop: i === 0 ? 'none' : `1px solid ${AUTH_M.border}`,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  background: '#F2F4F8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 13,
                  fontWeight: 700,
                  color: AUTH_M.muted,
                }}
              >
                {row.t.split(' ')[0][0]}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {row.t}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color:
                      row.trend === 'down'
                        ? '#2D7A2D'
                        : row.trend === 'up'
                          ? '#A85020'
                          : AUTH_M.muted,
                    fontWeight: 500,
                  }}
                >
                  {row.d}
                </div>
              </div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {row.p}
              </div>
            </div>
          ))}
        </div>

        {/* Floating alert chip */}
        <div
          style={{
            position: 'absolute',
            bottom: -16,
            right: -10,
            background: AUTH_M.ink,
            color: '#fff',
            padding: '10px 14px',
            borderRadius: 12,
            boxShadow: '0 12px 30px rgba(14,20,16,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            maxWidth: 280,
          }}
        >
          <span
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: AUTH_M.green,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 13,
              fontWeight: 800,
            }}
          >
            ↓
          </span>
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                opacity: 0.7,
              }}
            >
              Alerte prix
            </div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Loft Lausanne · −5% aujourd’hui
            </div>
          </div>
        </div>
      </div>

      {/* Footer stats */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          gap: 0,
          borderTop: `1px solid ${AUTH_M.border}`,
          paddingTop: 22,
          marginTop: 32,
        }}
      >
        {FOOTER_STATS.map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: i === 0 ? '0 16px 0 0' : '0 16px',
              borderLeft: i === 0 ? 'none' : `1px solid ${AUTH_M.border}`,
            }}
          >
            <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: -0.5 }}>
              {s.n}
            </div>
            <div style={{ fontSize: 11, color: AUTH_M.muted, marginTop: 2 }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
