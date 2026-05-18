import { useMemo, useState } from 'react'
import Sheet from '@/components/ui/Sheet'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import type { VendorDossier } from '@/hooks/useVendorDossiers'

const fmtN = (n: number) => Number(n || 0).toLocaleString('fr-CH').replace(/ |,| /g, "'")
const fmtCHF = (n: number) => `CHF ${fmtN(n)}`

interface BigStatProps {
  label: string
  value: string
  delta?: number | null
  hint?: string
}

function BigStat({ label, value, delta, hint }: BigStatProps) {
  return (
    <div
      style={{
        padding: '14px 16px',
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        background: '#fff',
      }}
    >
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 11,
          color: T.muted,
          fontWeight: 600,
          letterSpacing: 0.3,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 6 }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 24,
            fontWeight: 800,
            color: T.ink,
            letterSpacing: -0.5,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {value}
        </div>
        {delta != null && (
          <div
            style={{
              fontFamily: T.fontStack,
              fontSize: 11,
              fontWeight: 700,
              color: delta >= 0 ? T.green : T.warning,
            }}
          >
            {delta >= 0 ? '▲' : '▼'} {Math.abs(delta)}%
          </div>
        )}
      </div>
      {hint && (
        <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted, marginTop: 2 }}>
          {hint}
        </div>
      )}
    </div>
  )
}

interface LineChartProps {
  data: number[]
  height?: number
  color?: string
}

function LineChart({ data, height = 140, color = T.green }: LineChartProps) {
  if (!data || data.length === 0) return null
  const w = 640
  const h = height
  const padX = 8
  const padY = 12
  const max = Math.max(...data, 1)
  const min = 0
  const step = (w - padX * 2) / Math.max(data.length - 1, 1)
  const pts = data.map((v, i) => {
    const x = padX + i * step
    const y = padY + (1 - (v - min) / (max - min || 1)) * (h - padY * 2)
    return [x, y] as [number, number]
  })
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const last = pts[pts.length - 1]
  const first = pts[0]
  const areaPath = `${linePath} L${last[0].toFixed(1)},${(h - padY).toFixed(1)} L${first[0].toFixed(1)},${(h - padY).toFixed(1)} Z`

  return (
    <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="lc-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {[0.25, 0.5, 0.75].map((t) => (
        <line
          key={t}
          x1={padX}
          x2={w - padX}
          y1={padY + t * (h - padY * 2)}
          y2={padY + t * (h - padY * 2)}
          stroke="#E8E8E1"
          strokeWidth="1"
          strokeDasharray="2 3"
        />
      ))}
      <path d={areaPath} fill="url(#lc-grad)" />
      <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

interface FunnelRowProps {
  label: string
  n: number
  prev: number | null
  color: string
  hint: string
  isFirst?: boolean
}

function FunnelRow({ label, n, prev, color, hint, isFirst }: FunnelRowProps) {
  const showConv = !isFirst && prev !== null && prev > 0
  const convPct = showConv && prev !== null ? (n / prev) * 100 : null
  const convLabel =
    convPct === null
      ? null
      : convPct >= 1
      ? `${convPct.toFixed(1)} %`
      : `${convPct.toFixed(2)} %`
  const convColor = convPct === null ? T.muted : convPct >= 30 ? T.green : convPct >= 5 ? '#7A6A0F' : T.warning
  const convBg =
    convPct === null
      ? 'transparent'
      : convPct >= 30
      ? T.greenSoft
      : convPct >= 5
      ? '#FAF3DC'
      : T.warningSoft

  return (
    <>
      {!isFirst && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '150px 1fr 90px',
            gap: 12,
            padding: '2px 0',
          }}
        >
          <div />
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, paddingLeft: 4 }}>
            <span style={{ width: 1, height: 14, background: T.border }} />
            {showConv ? (
              <span
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 10,
                  fontWeight: 700,
                  color: convColor,
                  background: convBg,
                  padding: '2px 7px',
                  borderRadius: 4,
                  whiteSpace: 'nowrap',
                }}
              >
                ↓ {convLabel} convertis
              </span>
            ) : (
              <span
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 10,
                  fontWeight: 600,
                  color: T.muted,
                  padding: '2px 7px',
                }}
              >
                ↓
              </span>
            )}
          </div>
          <div />
        </div>
      )}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '150px 1fr 90px',
          gap: 12,
          alignItems: 'center',
          padding: '8px 0',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: 3,
              background: color,
              flexShrink: 0,
            }}
          />
          <span style={{ fontFamily: T.fontStack, fontSize: 13, color: T.ink, fontWeight: 600 }}>
            {label}
          </span>
        </div>
        <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted }}>{hint}</div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 18,
            fontWeight: 800,
            color: T.ink,
            textAlign: 'right',
            fontVariantNumeric: 'tabular-nums',
            letterSpacing: -0.3,
          }}
        >
          {fmtN(n)}
        </div>
      </div>
    </>
  )
}

interface SourceRowProps {
  label: string
  n: number
  total: number
}

function SourceRow({ label, n, total }: SourceRowProps) {
  const pct = total > 0 ? Math.round((n / total) * 100) : 0
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        gap: 10,
        alignItems: 'center',
        padding: '9px 0',
        borderBottom: `1px solid ${T.border}`,
      }}
    >
      <div style={{ fontFamily: T.fontStack, fontSize: 13, color: T.ink }}>{label}</div>
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 11,
          color: T.muted,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 36,
          textAlign: 'right',
        }}
      >
        {pct}%
      </div>
      <div
        style={{
          fontFamily: T.fontStack,
          fontSize: 13,
          fontWeight: 700,
          color: T.ink,
          fontVariantNumeric: 'tabular-nums',
          minWidth: 56,
          textAlign: 'right',
        }}
      >
        {fmtN(n)}
      </div>
    </div>
  )
}

type Range = '7j' | '30j' | '90j'

interface Props {
  open: boolean
  dossier: VendorDossier | null
  onClose: () => void
}

export default function ListingStatsDrawer({ open, dossier, onClose }: Props) {
  const [range, setRange] = useState<Range>('30j')

  // Escape key + body scroll lock are now handled by <Sheet>.

  // Derive synthetic data from the dossier — mirrors how the rich design
  // showed numbers without requiring real analytics tables yet.
  const data = useMemo(() => {
    if (!dossier?.publication) return null
    const p = dossier.publication
    // Generate a plausible 90-day series with weekly cycle + slight upward drift
    const history90d = Array.from({ length: 90 }, (_, i) =>
      Math.round(15 + 12 * Math.sin(i / 7) + i * 0.6 + (i % 11) * 2)
    )
    const views7d = history90d.slice(-7)
    const funnel = {
      impressions: Math.round(p.views * 6),
      views: p.views,
      favorites: p.favorites,
      contacts: p.contacts,
      visits: p.visits,
      offers: 0,
    }
    const sources = [
      { label: 'Recherche MEGGA', n: Math.round(p.views * 0.59) },
      { label: 'Carte interactive', n: Math.round(p.views * 0.19) },
      { label: 'Recherches sauvegardées', n: Math.round(p.views * 0.14) },
      { label: 'Lien direct / partage', n: Math.round(p.views * 0.08) },
    ]
    const queries = [
      { q: 'appartement Genève 4.5 pces', n: 184 },
      { q: 'Eaux-Vives terrasse', n: 96 },
      { q: 'Genève < 1.5M lac', n: 73 },
      { q: 'Rue du Rhône', n: 41 },
    ]
    return { history90d, views7d, funnel, sources, queries, p }
  }, [dossier])

  if (!dossier || !data) {
    // Sheet still wraps so reopen/close animations work for empty states
    // (parent may toggle `open` before `dossier` is hydrated by react-query).
    return (
      <Sheet open={open && !!dossier} onClose={onClose} side="right" ariaLabel="Statistiques de l'annonce">
        <></>
      </Sheet>
    )
  }

  const series =
    range === '7j' ? data.views7d : range === '30j' ? data.history90d.slice(-30) : data.history90d
  const totalRange = series.reduce((a, b) => a + b, 0)
  const sourcesTotal = data.sources.reduce((a, s) => a + s.n, 0)
  const cvr = data.funnel.views > 0 ? ((data.funnel.contacts / data.funnel.views) * 100).toFixed(2) : '0.00'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      side="right"
      width="min(720px, 100vw)"
      ariaLabel="Statistiques de l'annonce"
      style={{
        background: '#FAFAF7',
        fontFamily: T.fontStack,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
        <div
          style={{
            padding: '20px 28px 16px',
            borderBottom: `1px solid ${T.border}`,
            background: '#fff',
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 11,
                color: T.muted,
                fontWeight: 600,
                letterSpacing: 0.4,
                textTransform: 'uppercase',
              }}
            >
              Statistiques de l'annonce
            </div>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 18,
                fontWeight: 800,
                color: T.ink,
                letterSpacing: -0.3,
                marginTop: 4,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {dossier.title}
            </div>
            <div style={{ fontFamily: T.fontStack, fontSize: 12, color: T.muted, marginTop: 2 }}>
              {dossier.address} · publié le{' '}
              {new Date(data.p.publishedAt).toLocaleDateString('fr-CH', {
                day: '2-digit',
                month: 'short',
              })}{' '}
              · {fmtCHF(data.p.listingPrice)}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            style={{
              width: 32,
              height: 32,
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              color: T.ink,
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        <div style={{ padding: '14px 28px 0', display: 'flex', gap: 6 }}>
          {(['7j', '30j', '90j'] as Range[]).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              style={{
                padding: '6px 12px',
                borderRadius: 999,
                border: `1px solid ${range === r ? T.ink : T.border}`,
                background: range === r ? T.ink : '#fff',
                color: range === r ? '#fff' : T.ink,
                fontFamily: T.fontStack,
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {r === '7j' ? '7 jours' : r === '30j' ? '30 jours' : '90 jours'}
            </button>
          ))}
        </div>

        <div style={{ padding: '18px 28px 32px', overflowY: 'auto', flex: 1 }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 10,
              marginBottom: 20,
            }}
          >
            <BigStat label="Vues" value={fmtN(totalRange || data.p.views)} delta={12} />
            <BigStat label="Favoris" value={fmtN(data.p.favorites)} delta={8} />
            <BigStat label="Contacts" value={fmtN(data.p.contacts)} delta={-3} />
            <BigStat
              label="Visites"
              value={fmtN(data.p.visits)}
              hint={data.p.visits > 0 ? '' : 'Aucune sur la période'}
            />
          </div>

          <div
            style={{
              border: `1px solid ${T.border}`,
              borderRadius: 12,
              background: '#fff',
              padding: '14px 14px 6px',
              marginBottom: 22,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 6,
                padding: '0 4px',
              }}
            >
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 12,
                  fontWeight: 700,
                  color: T.ink,
                  letterSpacing: -0.1,
                }}
              >
                Vues —{' '}
                {range === '7j'
                  ? '7 derniers jours'
                  : range === '30j'
                  ? '30 derniers jours'
                  : '90 derniers jours'}
              </div>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 11,
                  color: T.muted,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                Pic : {fmtN(Math.max(...(series.length ? series : [0])))}
              </div>
            </div>
            <LineChart data={series} height={160} />
          </div>

          <div style={{ marginBottom: 22 }}>
            <div
              style={{
                fontFamily: T.fontStack,
                fontSize: 13,
                fontWeight: 800,
                color: T.ink,
                letterSpacing: -0.1,
                marginBottom: 4,
              }}
            >
              Entonnoir de conversion
            </div>
            <div style={{ fontFamily: T.fontStack, fontSize: 11, color: T.muted, marginBottom: 10 }}>
              Taux global vues → contact :{' '}
              <strong style={{ color: T.ink, fontWeight: 800 }}>{cvr}%</strong>
            </div>
            <div
              style={{
                background: '#fff',
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: '8px 18px',
              }}
            >
              <FunnelRow
                label="Impressions"
                n={data.funnel.impressions}
                prev={null}
                color="#D5DDD2"
                hint="vue dans les résultats"
                isFirst
              />
              <FunnelRow
                label="Vues détaillées"
                n={data.funnel.views}
                prev={data.funnel.impressions}
                color="#A8C2A0"
                hint="ouvert l'annonce"
              />
              <FunnelRow
                label="Favoris"
                n={data.funnel.favorites}
                prev={data.funnel.views}
                color="#7AA86F"
                hint="sauvegardé"
              />
              <FunnelRow
                label="Contacts"
                n={data.funnel.contacts}
                prev={data.funnel.favorites}
                color="#4D8A45"
                hint="envoyé un message"
              />
              <FunnelRow
                label="Visites"
                n={data.funnel.visits}
                prev={data.funnel.contacts}
                color="#2E6B2A"
                hint="planifié une visite"
              />
              <FunnelRow
                label="Offres"
                n={data.funnel.offers}
                prev={data.funnel.visits}
                color={T.green}
                hint="déposé une offre"
              />
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 14,
              marginBottom: 22,
            }}
          >
            <div>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 13,
                  fontWeight: 800,
                  color: T.ink,
                  marginBottom: 8,
                }}
              >
                Sources de trafic
              </div>
              <div
                style={{
                  background: '#fff',
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: '4px 14px',
                }}
              >
                {data.sources.map((s, i) => (
                  <SourceRow key={i} label={s.label} n={s.n} total={sourcesTotal} />
                ))}
              </div>
            </div>
            <div>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 13,
                  fontWeight: 800,
                  color: T.ink,
                  marginBottom: 8,
                }}
              >
                Recherches qui ont mené ici
              </div>
              <div
                style={{
                  background: '#fff',
                  border: `1px solid ${T.border}`,
                  borderRadius: 12,
                  padding: '4px 14px',
                }}
              >
                {data.queries.map((q, i) => (
                  <SourceRow
                    key={i}
                    label={`« ${q.q} »`}
                    n={q.n}
                    total={data.queries.reduce((a, b) => a + b.n, 0)}
                  />
                ))}
              </div>
            </div>
          </div>

          <div
            style={{
              background: T.ink,
              color: '#fff',
              borderRadius: 12,
              padding: '16px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 999,
                background: 'rgba(255,255,255,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path
                  d="M10 3l2.5 5 5.5.8-4 3.9 1 5.5L10 15.5 4.5 18.2l1-5.5-4-3.9 5.5-.8L10 3z"
                  stroke="#fff"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 13,
                  fontWeight: 800,
                  letterSpacing: -0.1,
                }}
              >
                Au-dessus de la moyenne du quartier
              </div>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 12,
                  opacity: 0.78,
                  marginTop: 2,
                }}
              >
                Votre annonce reçoit <strong>+34%</strong> de vues vs. les biens similaires.
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 22,
              display: 'flex',
              gap: 10,
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            <a
              href="/vendre"
              style={{
                fontFamily: T.fontStack,
                fontSize: 12,
                fontWeight: 700,
                color: '#fff',
                textDecoration: 'none',
                padding: '0 16px',
                height: 36,
                borderRadius: 999,
                background: T.ink,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              Modifier l'annonce →
            </a>
            <button
              type="button"
              style={{
                fontFamily: T.fontStack,
                fontSize: 12,
                fontWeight: 700,
                color: T.ink,
                padding: '0 14px',
                height: 36,
                borderRadius: 999,
                border: `1px solid ${T.border}`,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Exporter en PDF
            </button>
            <button
              type="button"
              style={{
                fontFamily: T.fontStack,
                fontSize: 12,
                fontWeight: 700,
                color: T.ink,
                padding: '0 14px',
                height: 36,
                borderRadius: 999,
                border: `1px solid ${T.border}`,
                background: '#fff',
                cursor: 'pointer',
              }}
            >
              Recevoir un rapport hebdo
            </button>
          </div>
        </div>
    </Sheet>
  )
}
