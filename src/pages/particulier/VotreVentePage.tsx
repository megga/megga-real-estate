// MEGGA — Espace vendeur « Votre vente » — page unique (lecture seule, lien personnel).
// Remplace l'ancien mini-CRM vendeur (8 pages). Grammaire Sugar Pure, vue ordinateur
// maître (reflow tablette/mobile via SELLER_CSS). Branchée sur useSellerPortalData()
// → adaptée par toVenteVM(). Aucune écriture : les modals (offre/paramètres) sont
// présentes mais leur transmission/persistance réelle est en Phase 2 (props onSubmit/onSave).
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import type { Ref, ReactNode } from 'react'
import { useSellerPortalData } from '@/hooks/useSellerPortalContext'
import {
  SELLER_SP_LIGHT,
  SELLER_SP_DARK,
  SELLER_STEPS,
  SELLER_STEP_COLORS,
  SELLER_STEP_SENTENCES,
  SELLER_NEXT,
  SELLER_CSS,
  sellerFmtCHF,
} from '@/components/seller-portal/votre-vente/tokens'
import { SellerThemeProvider, useSP, useSellerTheme } from '@/components/seller-portal/votre-vente/theme'
import { SvIcon, SvAvatarCircle, SvLogo } from '@/components/seller-portal/votre-vente/icons'
import SvGalleryLightbox from '@/components/seller-portal/votre-vente/SvGalleryLightbox'
import SvOfferModal from '@/components/seller-portal/votre-vente/SvOfferModal'
import SvSettingsModal from '@/components/seller-portal/votre-vente/SvSettingsModal'
import type { SellerSettings } from '@/components/seller-portal/votre-vente/SvSettingsModal'
import { toVenteVM } from '@/components/seller-portal/votre-vente/viewModel'
import type { VenteOfferVM, VentePropertyVM, VenteAgentVM, VenteVM } from '@/components/seller-portal/votre-vente/viewModel'

const DARK_PREF_KEY = 'megga-seller-dark'

// ── 0. Barre d'en-tête ─────────────────────────────────────────────────
function SvHeader({ agent, onAgentClick, onSettingsClick }: { agent: VenteAgentVM; onAgentClick: () => void; onSettingsClick: () => void }) {
  const SP = useSP()
  return (
    <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, marginBottom: 36 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <SvLogo height={22} color={SP.ink} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <button
          onClick={onSettingsClick}
          aria-label="Paramètres"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 0,
            flexShrink: 0,
            background: SP.card,
            boxShadow: SP.shadowSm,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            color: SP.inkSoft,
            transition: 'box-shadow .2s ease, transform .2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = SP.shadow
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = SP.shadowSm
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <SvIcon name="settings" size={19} stroke={SP.inkSoft} sw={1.7} />
        </button>

        <button
          onClick={onAgentClick}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 11,
            padding: '7px 7px 7px 16px',
            borderRadius: 999,
            border: 0,
            background: SP.card,
            boxShadow: SP.shadowSm,
            fontFamily: 'inherit',
            cursor: 'pointer',
            transition: 'box-shadow .2s ease, transform .2s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.boxShadow = SP.shadow
            e.currentTarget.style.transform = 'translateY(-1px)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.boxShadow = SP.shadowSm
            e.currentTarget.style.transform = 'translateY(0)'
          }}
        >
          <span style={{ fontSize: 13, fontWeight: 600, color: SP.inkSoft, whiteSpace: 'nowrap' }}>Votre agent</span>
          <SvAvatarCircle name={agent.name} size={32} photo={agent.photo} />
        </button>
      </div>
    </header>
  )
}

// ── 0b. Sélecteur de bien (multi-annonces) — masqué si 1 seul bien ───────
function SvPropertySwitcher({ properties, active, onSelect }: { properties: VentePropertyVM[]; active: number; onSelect: (i: number) => void }) {
  const SP = useSP()
  if (!properties || properties.length < 2) return null
  return (
    <div style={{ display: 'flex', gap: 10, marginBottom: 22, flexWrap: 'wrap', alignItems: 'center' }}>
      {properties.map((p, i) => {
        const on = i === active
        return (
          <button
            key={p.id}
            onClick={() => onSelect(i)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              whiteSpace: 'nowrap',
              padding: '9px 16px',
              borderRadius: 999,
              border: 0,
              cursor: 'pointer',
              fontFamily: 'inherit',
              background: on ? SP.accent : SP.card,
              color: on ? SP.onAccent : SP.inkSoft,
              fontSize: 13.5,
              fontWeight: 600,
              letterSpacing: -0.1,
              boxShadow: on ? SP.shadowSm : `inset 0 0 0 1.5px ${SP.line}`,
              transition: 'all .18s ease',
            }}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}

// ── Boîte photo (img réelle ou placeholder) ──────────────────────────────
function PhotoBox({ src, radius, minHeight, height }: { src?: string; radius: number; minHeight?: number; height?: number }) {
  const SP = useSP()
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{ width: '100%', height: height ?? '100%', minHeight, objectFit: 'cover', display: 'block', borderRadius: radius }}
      />
    )
  }
  return (
    <div
      style={{
        width: '100%',
        height: height ?? '100%',
        minHeight,
        borderRadius: radius,
        background: SP.cardSubtle,
        display: 'grid',
        placeItems: 'center',
        color: SP.ghost,
      }}
    >
      <SvIcon name="grid" size={20} stroke={SP.ghost} sw={1.6} />
    </div>
  )
}

// ── 1. Carte BIEN — horizontale ──────────────────────────────────────────
function SvPropertyCard({ property, delay, onOpenGallery }: { property: VentePropertyVM; delay: number; onOpenGallery: () => void }) {
  const SP = useSP()
  const photos = property.photos
  const extra = photos.length - 4
  return (
    <div
      className="sg-enter sv-propcard"
      style={{
        animationDelay: `${delay}ms`,
        background: SP.card,
        borderRadius: 26,
        boxShadow: SP.shadow,
        padding: 14,
        marginBottom: 22,
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 42%) 1fr',
        gap: 28,
      }}
    >
      {/* Galerie photos */}
      <div style={{ display: 'grid', gridTemplateRows: '1fr 78px', gap: 8, minWidth: 0 }}>
        <div style={{ position: 'relative', minHeight: 240 }}>
          <PhotoBox src={photos[0]} radius={16} minHeight={240} />
          <button
            onClick={onOpenGallery}
            style={{
              position: 'absolute',
              right: 12,
              bottom: 12,
              zIndex: 2,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              padding: '8px 14px',
              borderRadius: 999,
              border: 0,
              fontFamily: 'inherit',
              background: 'rgba(11,12,14,0.62)',
              color: '#fff',
              backdropFilter: 'blur(6px)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: -0.1,
              whiteSpace: 'nowrap',
            }}
          >
            <SvIcon name="grid" size={15} stroke="#fff" sw={1.8} />
            Voir les photos
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, minWidth: 0 }}>
          <PhotoBox src={photos[1]} radius={12} height={78} />
          <PhotoBox src={photos[2]} radius={12} height={78} />
          <div style={{ position: 'relative', minWidth: 0 }}>
            <PhotoBox src={photos[3]} radius={12} height={78} />
            {extra > 0 && (
              <button
                onClick={onOpenGallery}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 12,
                  border: 0,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(11,12,14,0.42)',
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: -0.2,
                }}
              >
                +{extra}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Infos */}
      <div className="sv-propinfo" style={{ padding: '18px 22px 18px 0', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 style={{ margin: '0 0 10px', fontSize: 27, fontWeight: 700, color: SP.ink, letterSpacing: -0.6, lineHeight: 1.18 }}>
          {property.title}
        </h1>

        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: SP.muted, marginBottom: 18 }}>
          <SvIcon name="pin" size={16} stroke={SP.muted} sw={1.6} />
          <span style={{ fontSize: 14, fontWeight: 500, color: SP.inkSoft }}>
            {[property.address, property.city, property.canton].filter(Boolean).join(' · ')}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 22 }}>
          {property.attrs.map((a, i) => (
            <Fragment key={a}>
              {i > 0 && <span style={{ width: 4, height: 4, borderRadius: 999, background: SP.ghost, margin: '0 12px' }} />}
              <span className="sg-tnum" style={{ fontSize: 14, fontWeight: 600, color: SP.inkSoft, whiteSpace: 'nowrap' }}>
                {a}
              </span>
            </Fragment>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
          <span className="sg-tnum" style={{ fontSize: 34, fontWeight: 700, color: SP.ink, letterSpacing: -1, lineHeight: 1, whiteSpace: 'nowrap' }}>
            {sellerFmtCHF(property.price)}
          </span>
        </div>

        <div className="sg-tnum" style={{ fontSize: 13, fontWeight: 500, color: SP.muted }}>
          En ligne depuis {property.daysOnline} jours
        </div>
      </div>
    </div>
  )
}

// ── 2. Carte OÙ ON EN EST — arc maître segmenté ──────────────────────────
function SvJourneyCard({ current, sentence, delay }: { current: number; sentence: string; delay: number }) {
  const SP = useSP()
  const [hovered, setHovered] = useState<number | null>(null)
  const steps = SELLER_STEPS
  const next = SELLER_NEXT[current]
  const nextIdx = current + 1
  const nextName = nextIdx < steps.length ? steps[nextIdx] : null
  const R = 150
  const cx = 180
  const cy = 172
  const L = Math.PI * R
  const n = steps.length
  const segL = L / n - 10
  const remaining = Math.max(0, n - 1 - current)
  const colorAt = (i: number) => SELLER_STEP_COLORS[i % SELLER_STEP_COLORS.length]
  const arcPath = `M ${cx - R} ${cy} A ${R} ${R} 0 0 1 ${cx + R} ${cy}`
  return (
    <div
      className="sg-enter sv-journey"
      style={{ animationDelay: `${delay}ms`, background: SP.card, borderRadius: 26, boxShadow: SP.shadow, padding: '32px 38px 34px', marginBottom: 28 }}
    >
      <h2 style={{ margin: '0 0 24px', fontSize: 19, fontWeight: 700, color: SP.ink, letterSpacing: -0.3 }}>Où en est votre vente</h2>

      <div className="sv-journeyrow" style={{ display: 'flex', alignItems: 'center', gap: 40, flexWrap: 'wrap' }}>
        {/* Arc segmenté coloré */}
        <div className="sv-arc" style={{ position: 'relative', width: 360, height: 200, flexShrink: 0 }}>
          <svg width="360" height="200" viewBox="0 0 360 200">
            <path d={arcPath} fill="none" stroke={SP.hairline} strokeWidth="15" strokeLinecap="round" />
            {steps.map((s, i) => {
              const done = i <= current
              return (
                <path
                  key={`seg-${s}`}
                  d={arcPath}
                  fill="none"
                  stroke={done ? colorAt(i) : SP.hairline}
                  strokeWidth="15"
                  strokeLinecap="round"
                  strokeDasharray={`${segL} ${L}`}
                  strokeDashoffset={-(i * (L / n) + 5)}
                  opacity={done ? 1 : 0.4}
                />
              )
            })}
            {steps.map((s, i) => {
              const a = Math.PI - (i / (n - 1)) * Math.PI
              const x = cx + R * Math.cos(a)
              const y = cy - R * Math.sin(a)
              const done = i < current
              const active = i === current
              const hl = i === hovered
              const col = colorAt(i)
              return (
                <g key={`nd-${s}`} style={{ transition: 'opacity .2s' }}>
                  {hl && <circle cx={x} cy={y} r="15" fill={col} opacity="0.16" />}
                  {active ? (
                    <>
                      <circle cx={x} cy={y} r={hl ? 12 : 11} fill={SP.card} stroke={col} strokeWidth="3" />
                      <circle cx={x} cy={y} r="4" fill={col} />
                    </>
                  ) : (
                    <circle cx={x} cy={y} r={hl ? 7 : 5} fill={done || hl ? col : SP.card} stroke={done || hl ? col : SP.ghost} strokeWidth="2" />
                  )}
                </g>
              )
            })}
          </svg>
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 30, fontWeight: 800, color: SP.ink, letterSpacing: -1, lineHeight: 1 }}>{steps[current]}</div>
            <div className="sg-tnum" style={{ fontSize: 12.5, fontWeight: 600, color: SP.muted, marginTop: 6 }}>
              Étape {current + 1}/{n} · reste {remaining} étape{remaining > 1 ? 's' : ''}
            </div>
          </div>
        </div>

        {/* Liste des étapes */}
        <div style={{ flex: '0 0 auto', minWidth: 210, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {steps.map((s, i) => {
            const done = i < current
            const active = i === current
            const hl = i === hovered
            return (
              <div
                key={s}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  cursor: 'default',
                  padding: active ? '10px 14px' : '4px 2px',
                  borderRadius: 12,
                  background: active ? SP.cardSubtle : hl ? SP.cardSubtle : 'transparent',
                  transition: 'background .15s ease',
                }}
              >
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 999,
                    flexShrink: 0,
                    background: done || active || hl ? colorAt(i) : SP.ghost,
                    opacity: done || active || hl ? 1 : 0.5,
                    transition: 'all .15s ease',
                  }}
                />
                <span style={{ fontSize: 14.5, fontWeight: active ? 700 : 600, color: active ? SP.ink : done ? SP.inkSoft : SP.ghost, whiteSpace: 'nowrap' }}>
                  {s}
                </span>
                {active && (
                  <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: colorAt(i), textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>
                    en cours
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Encart Prochaine étape */}
        <div
          style={{
            flex: 1,
            minWidth: 220,
            alignSelf: 'stretch',
            background: SP.cardSubtle,
            borderRadius: 18,
            padding: '22px 24px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          {nextName ? (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: SP.muted }}>Prochaine étape</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 12 }}>
                <span style={{ width: 11, height: 11, borderRadius: 999, background: colorAt(nextIdx), flexShrink: 0 }} />
                <span style={{ fontSize: 22, fontWeight: 700, color: SP.ink, letterSpacing: -0.4, lineHeight: 1.1 }}>{nextName}</span>
              </div>
              {next && (
                <span
                  style={{
                    alignSelf: 'flex-start',
                    marginTop: 14,
                    padding: '5px 12px',
                    borderRadius: 999,
                    background: SP.card,
                    boxShadow: SP.shadowSm,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: colorAt(nextIdx),
                    whiteSpace: 'nowrap',
                  }}
                >
                  {next.eta}
                </span>
              )}
              {next && <p style={{ margin: '14px 0 0', fontSize: 13.5, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.5 }}>{next.hint}</p>}
            </>
          ) : (
            <>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: SP.muted }}>Félicitations</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginTop: 12 }}>
                <span style={{ width: 30, height: 30, borderRadius: 999, flexShrink: 0, background: '#059669', display: 'grid', placeItems: 'center' }}>
                  <SvIcon name="check" size={17} stroke="#fff" sw={2.4} />
                </span>
                <span style={{ fontSize: 22, fontWeight: 700, color: SP.ink, letterSpacing: -0.4, lineHeight: 1.1 }}>Vente finalisée</span>
              </div>
              <p style={{ margin: '14px 0 0', fontSize: 13.5, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.5 }}>
                Votre bien est vendu. Votre agent reste disponible pour l'après-vente.
              </p>
            </>
          )}
        </div>
      </div>

      {/* Phrase contextuelle */}
      <div style={{ marginTop: 28, padding: '16px 20px', borderRadius: 16, background: SP.cardSubtle, display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: colorAt(current), flexShrink: 0 }} />
        <span style={{ fontSize: 14.5, fontWeight: 500, color: SP.inkSoft, lineHeight: 1.5 }}>{sentence}</span>
      </div>
    </div>
  )
}

// ── 3a. Jauges donut ─────────────────────────────────────────────────────
function SvDonut({ value, total, color, track, label, sub }: { value: number; total: number; color: string; track: string; label: string; sub?: string }) {
  const SP = useSP()
  const r = 60
  const c = 2 * Math.PI * r
  const pct = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0
  const off = c * (1 - pct)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg width="140" height="140" viewBox="0 0 140 140">
          <circle cx="70" cy="70" r={r} stroke={track} strokeWidth="14" fill="none" />
          <circle
            cx="70"
            cy="70"
            r={r}
            stroke={color}
            strokeWidth="14"
            fill="none"
            strokeDasharray={c}
            strokeDashoffset={off}
            strokeLinecap="round"
            transform="rotate(-90 70 70)"
            style={{ transition: 'stroke-dashoffset .65s cubic-bezier(.2,.8,.2,1)' }}
          />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div className="sg-tnum" style={{ fontSize: 30, fontWeight: 800, color: SP.ink, letterSpacing: -0.6, lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: SP.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 4 }}>{label}</div>
          </div>
        </div>
      </div>
      {sub && <span style={{ fontSize: 12.5, fontWeight: 500, color: SP.muted, textAlign: 'center', whiteSpace: 'nowrap' }}>{sub}</span>}
    </div>
  )
}

function SvStatsRow({ stats, delay }: { stats: VenteVM['stats']; delay: number }) {
  const SP = useSP()
  const { dark } = useSellerTheme()
  const items = [
    { value: stats.visits.value, total: 12, color: '#0E9F6E', track: dark ? '#10332A' : '#E1F5EC', label: 'Visites', sub: stats.visits.sub },
    { value: stats.offers, total: 3, color: '#C45A00', track: dark ? '#3A2614' : '#F8EBDC', label: 'Offres', sub: 'objectif 3' },
    { value: stats.days, total: stats.medianDays, color: '#1E5BC6', track: dark ? '#15243F' : '#E8EFFE', label: 'Jours', sub: `médiane GE · ${stats.medianDays} j` },
  ]
  return (
    <div
      className="sg-enter sv-stats"
      style={{
        animationDelay: `${delay}ms`,
        background: SP.card,
        borderRadius: 24,
        boxShadow: SP.shadow,
        padding: '30px 26px 26px',
        marginBottom: 22,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'flex-start',
        gap: 12,
      }}
    >
      {items.map((it) => (
        <SvDonut key={it.label} {...it} />
      ))}
    </div>
  )
}

// ── 3b. Carte OFFRES ─────────────────────────────────────────────────────
function SvOfferStatus({ status }: { status: VenteOfferVM['status'] }) {
  const SP = useSP()
  const map: Record<VenteOfferVM['status'], { label: string; strong: boolean; bg?: string }> = {
    pending: { label: 'En attente', strong: false },
    counter: { label: 'Contre-offre', strong: true, bg: '#C45A00' },
    accepted: { label: 'Acceptée', strong: true, bg: '#059669' },
  }
  const m = map[status]
  if (!m.strong) {
    return (
      <span
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 7,
          whiteSpace: 'nowrap',
          padding: '5px 12px',
          borderRadius: 999,
          background: SP.cardSubtle,
          fontSize: 12,
          fontWeight: 600,
          color: SP.muted,
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: 999, background: SP.muted }} />
        {m.label}
      </span>
    )
  }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 7,
        whiteSpace: 'nowrap',
        padding: '5px 13px',
        borderRadius: 999,
        background: m.bg,
        color: '#fff',
        fontSize: 12,
        fontWeight: 600,
        boxShadow: '0 4px 12px rgba(11,12,14,0.14)',
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.85)' }} />
      {m.label}
    </span>
  )
}

function SvOffersCard({ offers, onRespond, delay }: { offers: VenteOfferVM[]; onRespond: (o: VenteOfferVM) => void; delay: number }) {
  const SP = useSP()
  const empty = !offers || offers.length === 0
  return (
    <div className="sg-enter" style={{ animationDelay: `${delay}ms`, background: SP.card, borderRadius: 24, boxShadow: SP.shadow, padding: '26px 28px', marginBottom: 22 }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 18, fontWeight: 700, color: SP.ink, letterSpacing: -0.3 }}>Offres</h2>

      {empty ? (
        <div style={{ padding: '26px 20px', textAlign: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, color: SP.inkSoft, lineHeight: 1.5, marginBottom: 4 }}>Pas encore d'offre — c'est normal à ce stade.</div>
          <div style={{ fontSize: 14, fontWeight: 500, color: SP.muted, lineHeight: 1.5 }}>Les visites font leur travail.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {offers.map((o) => {
            const actionable = o.status === 'pending'
            return (
              <div key={o.id} style={{ padding: '16px 18px', borderRadius: 16, background: SP.cardSubtle }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', rowGap: 8 }}>
                  <span className="sg-tnum" style={{ fontSize: 19, fontWeight: 700, color: SP.ink, letterSpacing: -0.4, flex: '0 0 auto' }}>
                    {sellerFmtCHF(o.amount)}
                  </span>
                  <SvOfferStatus status={o.status} />
                  <span className="sg-tnum" style={{ marginLeft: 'auto', fontSize: 13, fontWeight: 500, color: SP.muted, whiteSpace: 'nowrap' }}>
                    {o.date}
                  </span>
                </div>
                {actionable && (
                  <button
                    onClick={() => onRespond(o)}
                    style={{
                      marginTop: 14,
                      width: '100%',
                      height: 44,
                      borderRadius: 999,
                      border: 0,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      background: SP.accent,
                      color: SP.onAccent,
                      fontSize: 13.5,
                      fontWeight: 700,
                      boxShadow: '0 4px 12px rgba(11,12,14,0.16)',
                      transition: 'all .18s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = SP.accentHover
                      e.currentTarget.style.transform = 'translateY(-1px)'
                      e.currentTarget.style.boxShadow = '0 10px 24px rgba(11,12,14,0.22)'
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = SP.accent
                      e.currentTarget.style.transform = 'translateY(0)'
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(11,12,14,0.16)'
                    }}
                  >
                    Répondre à l'offre
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── 3c. Carte ACTIVITÉ RÉCENTE ───────────────────────────────────────────
function sellerEventColor(text: string): string {
  const t = (text || '').toLowerCase()
  if (/contre-offre|offre/.test(t)) return '#C45A00'
  if (/visite/.test(t)) return '#0E9F6E'
  if (/en ligne|publié|photo/.test(t)) return '#0891B2'
  if (/mandat|signé|compromis/.test(t)) return '#1E5BC6'
  return '#0891B2'
}

function SvActivityCard({ events, delay }: { events: { text: string; when: string }[]; delay: number }) {
  const SP = useSP()
  return (
    <div className="sg-enter" style={{ animationDelay: `${delay}ms`, background: SP.card, borderRadius: 24, boxShadow: SP.shadow, padding: '26px 28px' }}>
      <h2 style={{ margin: '0 0 22px', fontSize: 18, fontWeight: 700, color: SP.ink, letterSpacing: -0.3 }}>Dernières nouvelles</h2>

      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', left: 5, top: 6, bottom: 6, width: 2, background: SP.hairline, borderRadius: 999 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {events.map((e, i) => {
            const col = sellerEventColor(e.text)
            return (
              <div key={`${e.text}-${i}`} style={{ display: 'flex', alignItems: 'flex-start', gap: 18, position: 'relative' }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    flexShrink: 0,
                    marginTop: 3,
                    background: col,
                    boxShadow: i === 0 ? `0 0 0 4px ${SP.cardSubtle}` : `0 0 0 4px ${SP.card}`,
                    opacity: i === 0 ? 1 : 0.85,
                    position: 'relative',
                    zIndex: 1,
                  }}
                />
                <span style={{ fontSize: 14.5, fontWeight: i === 0 ? 600 : 500, color: SP.inkSoft, lineHeight: 1.4, flex: 1 }}>{e.text}</span>
                <span className="sg-tnum" style={{ fontSize: 12.5, fontWeight: 500, color: SP.muted, whiteSpace: 'nowrap', marginTop: 1 }}>{e.when}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── 3d. Carte AGENT ──────────────────────────────────────────────────────
function SvSecondaryBtn({ icon, label, href }: { icon: ReactNode; label: string; href: string }) {
  const SP = useSP()
  const [hover, setHover] = useState(false)
  return (
    <a
      href={href}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        flex: 1,
        height: 44,
        borderRadius: 999,
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: hover ? SP.cardSubtle : SP.card,
        boxShadow: hover ? `inset 0 0 0 1.5px ${SP.lineStrong}` : `inset 0 0 0 1.5px ${SP.line}`,
        color: SP.inkSoft,
        fontSize: 13.5,
        fontWeight: 600,
        transition: 'all .18s ease',
      }}
    >
      {icon}
      {label}
    </a>
  )
}

function SvAgentCard({ agent, anchorRef, delay }: { agent: VenteAgentVM; anchorRef: Ref<HTMLDivElement>; delay: number }) {
  const SP = useSP()
  const [hover, setHover] = useState(false)
  return (
    <div
      ref={anchorRef}
      className="sg-enter"
      style={{
        animationDelay: `${delay}ms`,
        background: SP.card,
        borderRadius: 24,
        boxShadow: SP.shadow,
        padding: '30px 26px 26px',
        marginBottom: 18,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      <SvAvatarCircle name={agent.name} size={84} photo={agent.photo} />

      <div style={{ fontSize: 19, fontWeight: 700, color: SP.ink, letterSpacing: -0.3, marginTop: 16 }}>{agent.name}</div>
      <div style={{ fontSize: 13.5, fontWeight: 500, color: SP.muted, marginTop: 3, marginBottom: 22 }}>{agent.role}</div>

      <a
        href={agent.whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        style={{
          width: '100%',
          height: 50,
          borderRadius: 999,
          textDecoration: 'none',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 10,
          background: hover ? 'rgb(43, 44, 49)' : 'rgb(31, 32, 36)',
          color: '#fff',
          fontSize: 14.5,
          fontWeight: 700,
          letterSpacing: 0.1,
          boxShadow: hover ? '0 12px 30px rgba(11,12,14,0.25)' : '0 6px 16px rgba(11,12,14,0.18)',
          transform: hover ? 'translateY(-1px)' : 'translateY(0)',
          transition: 'all .18s ease',
        }}
      >
        <SvIcon name="whatsapp" size={20} stroke="#fff" />
        Écrire sur WhatsApp
      </a>

      <div style={{ display: 'flex', gap: 10, width: '100%', marginTop: 12 }}>
        <SvSecondaryBtn icon={<SvIcon name="phone" size={16} stroke={SP.inkSoft} />} label="Appeler" href={agent.phone} />
        <SvSecondaryBtn icon={<SvIcon name="mail" size={16} stroke={SP.inkSoft} />} label="Email" href={agent.email} />
      </div>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────
export default function VotreVentePage() {
  const data = useSellerPortalData()
  const vm = useMemo(() => toVenteVM(data), [data])

  const [dark, setDarkState] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DARK_PREF_KEY) === '1'
    } catch {
      return false
    }
  })
  const setDark = (v: boolean) => {
    setDarkState(v)
    try {
      localStorage.setItem(DARK_PREF_KEY, v ? '1' : '0')
    } catch {
      /* no-op */
    }
  }
  const SP = dark ? SELLER_SP_DARK : SELLER_SP_LIGHT

  const agentRef = useRef<HTMLDivElement>(null)
  const [activeOffer, setActiveOffer] = useState<VenteOfferVM | null>(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings] = useState<SellerSettings>({
    notifOffre: true,
    notifVisite: true,
    notifRetour: true,
    notifResume: true,
    jours: ['mer', 'sam'],
    creneaux: ['apresmidi'],
    preavis: '24h',
    langue: 'fr',
    canal: 'whatsapp',
  })
  const updateSetting = <K extends keyof SellerSettings>(k: K, v: SellerSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }))

  useEffect(() => {
    const prevBg = document.body.style.background
    document.body.style.background = SP.bg
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
    return () => {
      document.body.style.background = prevBg
      document.documentElement.style.colorScheme = ''
    }
  }, [dark, SP.bg])

  const scrollToAgent = () => {
    const el = agentRef.current
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 32
      window.scrollTo({ top, behavior: 'smooth' })
    }
  }

  return (
    <SellerThemeProvider value={{ SP, dark, setDark }}>
      <div style={{ minHeight: '100vh', background: SP.bgGradient, fontFamily: 'Manrope, system-ui, sans-serif', color: SP.ink }}>
        <style>{SELLER_CSS}</style>

        <div className="sv-page" style={{ maxWidth: 1160, margin: '0 auto', padding: '40px 40px 56px' }}>
          <SvHeader agent={vm.agent} onAgentClick={scrollToAgent} onSettingsClick={() => setShowSettings(true)} />

          <SvPropertySwitcher properties={[vm.property]} active={0} onSelect={() => {}} />

          <SvPropertyCard property={vm.property} delay={40} onOpenGallery={() => setGalleryOpen(true)} />

          <SvJourneyCard current={vm.current} sentence={SELLER_STEP_SENTENCES[vm.current] ?? ''} delay={120} />

          {/* Deux colonnes */}
          <div className="sv-twocol" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 28, alignItems: 'start' }}>
            <div>
              <SvStatsRow stats={vm.stats} delay={200} />
              <SvOffersCard offers={vm.offers} onRespond={setActiveOffer} delay={260} />
              <SvActivityCard events={vm.activity} delay={320} />
            </div>

            <div className="sv-aside" style={{ position: 'sticky', top: 32 }}>
              <SvAgentCard agent={vm.agent} anchorRef={agentRef} delay={240} />
            </div>
          </div>
        </div>

        {galleryOpen && <SvGalleryLightbox title={vm.property.title} photos={vm.property.photos} onClose={() => setGalleryOpen(false)} />}

        {activeOffer && (
          <SvOfferModal
            offer={activeOffer}
            askingPrice={vm.property.price}
            agentName={vm.agent.name}
            agentPhoto={vm.agent.photo}
            onClose={() => setActiveOffer(null)}
            onSubmit={() => {
              // Phase 2 : transmettre la décision à l'agent via edge function token-scoped + audit.
            }}
          />
        )}

        {showSettings && (
          <SvSettingsModal
            settings={settings}
            onChange={updateSetting}
            dark={dark}
            onDark={setDark}
            onClose={() => setShowSettings(false)}
            onSave={() => {
              // Phase 2 : persister les préférences vendeur (PATCH token-scoped).
            }}
          />
        )}
      </div>
    </SellerThemeProvider>
  )
}
