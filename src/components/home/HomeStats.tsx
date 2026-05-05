// MEGGA Homepage — Stats section (4 colonnes, port 1:1 du proto megga-body.jsx).
// "33'000+ biens · 26 cantons · 4 langues · 180 villes couvertes"

import { HOME_FONT, HOME_M } from './homeTokens'

const STATS = [
  { n: "33'000+", l: 'Biens disponibles' },
  { n: '26', l: 'Cantons couverts' },
  { n: '4', l: 'Langues' },
  { n: '180', l: 'Villes couvertes' },
]

export default function HomeStats() {
  return (
    <section
      style={{
        padding: '60px clamp(20px, 5vw, 80px)',
        background: HOME_M.cream,
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          alignItems: 'start',
          gap: 0,
        }}
      >
        {STATS.map((s, i) => (
          <div
            key={s.l}
            style={{
              borderLeft: i === 0 ? 'none' : `1px solid ${HOME_M.border}`,
              padding: '8px 24px',
            }}
          >
            <div
              style={{
                fontFamily: HOME_FONT,
                fontSize: 'clamp(36px, 5vw, 56px)',
                fontWeight: 700,
                color: HOME_M.ink,
                lineHeight: 1,
                letterSpacing: -1.5,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                fontFamily: HOME_FONT,
                fontSize: 14,
                fontWeight: 500,
                color: HOME_M.muted,
                marginTop: 8,
              }}
            >
              {s.l}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
