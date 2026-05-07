// MEGGA — Listing page skeleton (loading state).
// Reproduit la structure exacte de la fiche bien complète avec des placeholders
// gris animés (shimmer left → right). Style Airbnb/Booking : l'utilisateur voit
// la silhouette de la page avant que les données arrivent.

const M = {
  border: '#E6E8EC',
  page: '#FAFBFD',
  shimmer1: '#EDF0F4',
  shimmer2: '#F6F8FB',
}

// Inline shimmer CSS — appliqué via <style> à la racine du skeleton.
const SHIMMER_CSS = `
@keyframes megga-shimmer {
  0%   { background-position: -800px 0; }
  100% { background-position: 800px 0; }
}
.megga-skel {
  background: linear-gradient(90deg, ${M.shimmer1} 0%, ${M.shimmer2} 50%, ${M.shimmer1} 100%);
  background-size: 800px 100%;
  animation: megga-shimmer 1.4s ease-in-out infinite;
  border-radius: 6px;
}
`

interface SkelProps {
  w?: number | string
  h?: number | string
  radius?: number
  style?: React.CSSProperties
  className?: string
}

function Skel({ w = '100%', h = 16, radius = 6, style, className }: SkelProps) {
  return (
    <div
      className={`megga-skel ${className ?? ''}`}
      style={{ width: w, height: h, borderRadius: radius, ...style }}
    />
  )
}

export default function ListingPageSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: M.page }}>
      <style>{SHIMMER_CSS}</style>

      {/* Breadcrumb skeleton */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '16px clamp(20px, 4vw, 32px) 0',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <Skel w={50} h={12} />
        <span style={{ color: '#C7CDD3' }}>›</span>
        <Skel w={60} h={12} />
        <span style={{ color: '#C7CDD3' }}>›</span>
        <Skel w={40} h={12} />
        <span style={{ color: '#C7CDD3' }}>›</span>
        <Skel w={120} h={12} />
      </div>

      {/* Hero gallery skeleton (1.5fr 1fr 1fr × 1fr 1fr, height 520) */}
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '16px clamp(20px, 4vw, 32px) 0' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.5fr 1fr 1fr',
            gridTemplateRows: '1fr 1fr',
            gap: 6,
            height: 520,
            borderRadius: 16,
            overflow: 'hidden',
          }}
        >
          <Skel
            w="100%"
            h="100%"
            radius={0}
            style={{ gridRow: '1 / 3', gridColumn: '1 / 2' }}
          />
          <Skel w="100%" h="100%" radius={0} />
          <Skel w="100%" h="100%" radius={0} />
          <Skel w="100%" h="100%" radius={0} />
          <Skel w="100%" h="100%" radius={0} />
        </div>
      </div>

      {/* Title bar skeleton */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '20px clamp(20px, 4vw, 32px) 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 24,
        }}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Chips */}
          <div style={{ display: 'flex', gap: 6 }}>
            <Skel w={90} h={26} radius={999} />
            <Skel w={80} h={26} radius={999} />
          </div>
          {/* Title */}
          <Skel w="60%" h={36} />
          {/* Address */}
          <Skel w="40%" h={15} />
        </div>
        {/* Action icon buttons */}
        <div style={{ display: 'flex', gap: 8 }}>
          <Skel w={42} h={42} radius={999} />
          <Skel w={42} h={42} radius={999} />
          <Skel w={42} h={42} radius={999} />
        </div>
      </div>

      {/* Split body skeleton */}
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 clamp(20px, 4vw, 32px) 60px',
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 380px',
          gap: 32,
        }}
      >
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* Price card */}
          <div
            style={{
              background: '#fff',
              border: `1px solid ${M.border}`,
              borderRadius: 16,
              padding: 24,
              display: 'flex',
              flexDirection: 'column',
              gap: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12 }}>
              <Skel w={220} h={36} />
              <Skel w={120} h={14} />
            </div>
            {/* KPI row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  style={{
                    border: `1px solid ${M.border}`,
                    borderRadius: 12,
                    padding: 18,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                  }}
                >
                  <Skel w={50} h={11} />
                  <Skel w={70} h={24} />
                </div>
              ))}
            </div>
          </div>

          {/* Description card */}
          <div
            style={{
              background: '#fff',
              border: `1px solid ${M.border}`,
              borderRadius: 14,
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <Skel w={100} h={11} />
              <Skel w={220} h={24} />
            </div>
            <Skel w="100%" h={14} />
            <Skel w="92%" h={14} />
            <Skel w="80%" h={14} />
            <Skel w="60%" h={14} />
          </div>

          {/* Specs card */}
          <div
            style={{
              background: '#fff',
              border: `1px solid ${M.border}`,
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <Skel w={120} h={11} />
              <Skel w={240} h={24} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
              {[0, 1].map((col) => (
                <div key={col} style={{ display: 'flex', flexDirection: 'column' }}>
                  {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
                    <div
                      key={row}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '11px 0',
                        borderBottom: `1px solid ${M.border}`,
                      }}
                    >
                      <Skel w={140} h={13} />
                      <Skel w={70} h={13} />
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Energy card */}
          <div
            style={{
              background: '#fff',
              border: `1px solid ${M.border}`,
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <Skel w={150} h={11} />
              <Skel w={170} h={24} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 28, alignItems: 'center' }}>
              <div>
                <div style={{ display: 'flex', height: 56, gap: 0 }}>
                  {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                    <Skel key={i} w="100%" h={56} radius={i === 0 ? 0 : 0} />
                  ))}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                  <Skel w={70} h={11} />
                  <Skel w={60} h={11} />
                </div>
              </div>
              <Skel w="100%" h={120} radius={12} />
            </div>
          </div>

          {/* Quartier card */}
          <div
            style={{
              background: '#fff',
              border: `1px solid ${M.border}`,
              borderRadius: 14,
              padding: 22,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 16 }}>
              <Skel w={90} h={11} />
              <Skel w={140} h={24} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
              <Skel w="100%" h={380} radius={12} />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <Skel w={100} h={11} />
                    <Skel w="100%" h={13} />
                    <Skel w="80%" h={13} />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Documents card */}
          <div
            style={{
              background: '#fff',
              border: `1px solid ${M.border}`,
              borderRadius: 14,
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 8 }}>
              <Skel w={90} h={11} />
              <Skel w={170} h={24} />
            </div>
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  border: `1px solid ${M.border}`,
                  borderRadius: 10,
                }}
              >
                <Skel w={36} h={44} radius={5} />
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <Skel w={180} h={14} />
                  <Skel w={60} h={11} />
                </div>
                <Skel w={14} h={14} />
              </div>
            ))}
          </div>
        </div>

        {/* Right column — sticky agent card */}
        <div className="bien-sidebar-skeleton">
          <div
            style={{
              position: 'sticky',
              top: 24,
              background: '#fff',
              border: `1px solid ${M.border}`,
              borderRadius: 16,
              padding: 22,
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
            }}
          >
            {/* Identity row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <Skel w={56} h={56} radius={999} />
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                <Skel w={90} h={10} />
                <Skel w={140} h={16} />
                <Skel w={110} h={12} />
              </div>
            </div>
            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 4,
                background: '#F6F8FC',
                borderRadius: 10,
                padding: '10px 4px',
              }}
            >
              {[0, 1, 2].map((i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 4,
                    padding: '0 4px',
                  }}
                >
                  <Skel w={40} h={14} />
                  <Skel w={50} h={10} />
                </div>
              ))}
            </div>
            {/* CTAs */}
            <Skel w="100%" h={48} radius={999} />
            <Skel w="100%" h={44} radius={999} />
            <Skel w="100%" h={40} radius={8} />
            {/* Footer */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 14,
                borderTop: `1px solid ${M.border}`,
              }}
            >
              <Skel w={120} h={11} />
              <Skel w={60} h={11} />
            </div>
          </div>
        </div>
      </div>

      {/* Responsive: hide sidebar on mobile */}
      <style>{`
        @media (max-width: 1023px) {
          .bien-sidebar-skeleton { display: none !important; }
        }
      `}</style>
    </div>
  )
}
