// MEGGA — Auth agent preview (port 1:1 du proto megga-auth-shell.jsx).
// Right-side panel : CRM mockup avec pipeline + KPIs + contacts.
// Background : dark ink.

import { AUTH_FONT, AUTH_M } from './authTokens'

const PIPELINE_ROWS = [
  {
    tag: 'C',
    c: '#E8B14B',
    t: 'Cologny',
    v: '4.5 p · 145 m²',
    pri: 'HAUTE',
    priColor: '#A85020',
    pct: 86,
  },
  {
    tag: 'L',
    c: '#A85020',
    t: 'Lausanne',
    v: 'Villa · 210 m²',
    pri: 'MOYENNE',
    priColor: '#E8B14B',
    pct: 65,
  },
  {
    tag: 'G',
    c: '#2D7A2D',
    t: 'Genève',
    v: '3.5 p · 88 m²',
    pri: 'HAUTE',
    priColor: '#A85020',
    pct: 38,
  },
  {
    tag: 'M',
    c: '#5A6B85',
    t: 'Montreux',
    v: 'Loft · 130 m²',
    pri: 'BASSE',
    priColor: AUTH_M.muted,
    pct: 100,
  },
]

const FOOTER_STATS = [
  { n: '26', l: 'cantons' },
  { n: '33K+', l: 'biens' },
  { n: '100%', l: 'compliance nLPD' },
  { n: '0 CHF', l: 'à payer' },
]

const CONTACTS = [
  { n: 'Grégory L.', r: 'Propriétaire', c: '#E8B14B' },
  { n: 'Sophie M.', r: 'Éditeur', c: '#A85020' },
  { n: 'Robert F.', r: 'Éditeur', c: '#2D7A2D' },
]

export default function AgentPreview() {
  return (
    <div
      style={{
        height: '100%',
        padding: 'clamp(40px, 5vw, 60px) clamp(32px, 4vw, 60px) 40px',
        background: AUTH_M.ink,
        color: '#fff',
        fontFamily: AUTH_FONT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Subtle grid bg */}
      <svg
        style={{
          position: 'absolute',
          inset: 0,
          opacity: 0.06,
          pointerEvents: 'none',
        }}
        width="100%"
        height="100%"
      >
        <defs>
          <pattern
            id="auth-grid"
            width="32"
            height="32"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 32 0 L 0 0 0 32"
              fill="none"
              stroke="#fff"
              strokeWidth="1"
            />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#auth-grid)" />
      </svg>

      {/* Headline */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <h2
          style={{
            fontSize: 'clamp(26px, 3.5vw, 32px)',
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: -0.8,
            margin: 0,
            maxWidth: 400,
          }}
        >
          Gérez votre immobilier suisse comme jamais auparavant.
        </h2>
        <p
          style={{
            fontSize: 14,
            color: 'rgba(255,255,255,0.7)',
            lineHeight: 1.5,
            margin: '14px 0 0',
            maxWidth: 380,
          }}
        >
          Pipeline mandats, équipe, mailing automatique, agenda partagé — tous
          les outils inclus, sans plan payant caché.
        </p>
      </div>

      {/* CRM mockup */}
      <div style={{ position: 'relative', zIndex: 1, marginTop: 28 }}>
        <div
          style={{
            background: '#fff',
            color: AUTH_M.ink,
            borderRadius: 16,
            padding: 18,
            boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 14,
              flexWrap: 'wrap',
              gap: 10,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 700 }}>Pipeline</div>
              <div
                style={{
                  height: 22,
                  padding: '0 8px',
                  borderRadius: 6,
                  background: '#F2F4F8',
                  fontSize: 11,
                  fontWeight: 600,
                  color: AUTH_M.muted,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                Tous les mandats ▾
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ fontSize: 11, color: AUTH_M.muted }}>
                27 mars – 19 avr.
              </div>
              <div style={{ display: 'flex', marginLeft: 8 }}>
                {['#E8B14B', '#A85020', '#2D7A2D'].map((c, i) => (
                  <div
                    key={c}
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      background: c,
                      border: '2px solid #fff',
                      marginLeft: i === 0 ? 0 : -6,
                    }}
                  />
                ))}
                <div
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    background: '#F2F4F8',
                    border: '2px solid #fff',
                    marginLeft: -6,
                    fontSize: 9,
                    fontWeight: 700,
                    color: AUTH_M.muted,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  +2
                </div>
              </div>
              <button
                style={{
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: 'none',
                  background: AUTH_M.ink,
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  marginLeft: 6,
                }}
              >
                Ajouter +
              </button>
            </div>
          </div>

          {/* KPIs */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
              gap: 10,
              marginBottom: 12,
            }}
          >
            {[
              {
                l: 'Mandats actifs / mois',
                v: '12',
                d: '+33%',
              },
              {
                l: 'Visites / semaine',
                v: '8.5',
                d: '+18%',
              },
            ].map(k => (
              <div
                key={k.l}
                style={{
                  background: '#F2F4F8',
                  borderRadius: 10,
                  padding: '10px 12px',
                }}
              >
                <div
                  style={{
                    fontSize: 10,
                    color: AUTH_M.muted,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                    letterSpacing: 0.4,
                  }}
                >
                  {k.l}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    justifyContent: 'space-between',
                    marginTop: 4,
                  }}
                >
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      letterSpacing: -0.5,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {k.v}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#2D7A2D',
                    }}
                  >
                    {k.d}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pipeline rows */}
          <div
            style={{
              fontSize: 10,
              color: AUTH_M.muted,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.4,
              padding: '8px 0 6px',
              borderTop: `1px solid ${AUTH_M.border}`,
            }}
          >
            Mandats — performance
          </div>
          {PIPELINE_ROWS.map(r => (
            <div
              key={r.t}
              style={{
                display: 'grid',
                gridTemplateColumns: '24px minmax(0, 1fr) 64px 60px',
                gap: 10,
                alignItems: 'center',
                padding: '8px 0',
                fontSize: 11,
              }}
            >
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 999,
                  background: r.c,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: 10,
                }}
              >
                {r.tag}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 700,
                    fontSize: 12,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {r.t}
                </div>
                <div
                  style={{
                    color: AUTH_M.muted,
                    fontSize: 10,
                  }}
                >
                  {r.v}
                </div>
              </div>
              <div
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  color: r.priColor,
                  letterSpacing: 0.4,
                }}
              >
                {r.pri}
              </div>
              <div>
                <div
                  style={{
                    height: 4,
                    background: '#F2F4F8',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      height: '100%',
                      width: r.pct + '%',
                      background: r.pct === 100 ? '#2D7A2D' : AUTH_M.ink,
                    }}
                  />
                </div>
                <div
                  style={{
                    fontSize: 9,
                    color: AUTH_M.muted,
                    marginTop: 2,
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {r.pct}%
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Floating contacts widget */}
        <div
          style={{
            position: 'absolute',
            right: -20,
            bottom: -10,
            background: '#fff',
            color: AUTH_M.ink,
            borderRadius: 12,
            padding: '12px 14px',
            boxShadow: '0 18px 40px rgba(0,0,0,0.4)',
            width: 220,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 8,
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 700 }}>
              Ajouter un contact
            </div>
            <span style={{ color: AUTH_M.muted, fontSize: 12 }}>×</span>
          </div>
          <div
            style={{
              background: '#F2F4F8',
              borderRadius: 8,
              padding: '6px 8px',
              fontSize: 10,
              fontWeight: 600,
              marginBottom: 8,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>julien@megga.ch</span>
            <span
              style={{
                background: AUTH_M.green,
                color: '#fff',
                padding: '2px 6px',
                borderRadius: 4,
                fontWeight: 700,
              }}
            >
              Inviter
            </span>
          </div>
          {CONTACTS.map(c => (
            <div
              key={c.n}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '4px 0',
                fontSize: 10,
              }}
            >
              <div
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: 999,
                  background: c.c,
                  flexShrink: 0,
                }}
              />
              <span style={{ flex: 1, fontWeight: 600, minWidth: 0 }}>
                {c.n}
              </span>
              <span style={{ color: AUTH_M.muted }}>{c.r}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer trust line */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 0,
          borderTop: '1px solid rgba(255,255,255,0.12)',
          paddingTop: 22,
          marginTop: 32,
        }}
      >
        {FOOTER_STATS.map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: i === 0 ? '0 12px 0 0' : '0 12px',
              borderLeft: i === 0 ? 'none' : '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 700,
                letterSpacing: -0.4,
                color: i === 3 ? AUTH_M.green : '#fff',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                fontSize: 10,
                color: 'rgba(255,255,255,0.55)',
                marginTop: 2,
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                fontWeight: 600,
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
