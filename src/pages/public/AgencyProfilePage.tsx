import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Building2, ArrowLeft } from 'lucide-react'
import { formatCHF } from '@/lib/utils'
import { supabase } from '@/lib/supabase'
import { useAgencyProfile } from '@/hooks/useAgentProfile'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'

// ─────────────────────────────────────────────────────────────────────────
// MEGGA Agence — Direction A "Sugar Editorial"
// Refonte fidèle au design Claude `megga-agence-v2-direction-a.jsx`.
// Style magazine éditorial : Helvetica Neue + JetBrains Mono pour les méta,
// fond #FAFAFA, ink franc #0B0C0E, sections numérotées §01-§05, hiérarchie
// par tailles seulement. Pas de gradient, pas d'ombres tape-à-l'œil.
// ─────────────────────────────────────────────────────────────────────────

const FF = "'Helvetica Neue', Helvetica, Arial, 'Inter', system-ui, sans-serif"
const FF_MONO = "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace"

const T = {
  bg: '#FAFAFA',
  paper: '#FFFFFF',
  ink: '#0B0C0E',
  soft: '#3A3D44',
  muted: '#7A8088',
  rule: '#E8E8EA',
  fade: '#F2F2F4',
}

interface SectionLabelProps {
  num: string
  label: string
  right?: string
}

function SectionLabel({ num, label, right }: SectionLabelProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'auto 1fr auto',
        gap: 18,
        alignItems: 'center',
        padding: '0 0 18px',
        borderBottom: `1px solid ${T.ink}`,
        marginBottom: 36,
      }}
    >
      <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.ink, fontWeight: 500, letterSpacing: 0.6 }}>§ {num}</span>
      <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 600, color: T.ink, letterSpacing: 0.5, textTransform: 'uppercase' }}>{label}</span>
      <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 0.4 }}>{right ?? ''}</span>
    </div>
  )
}

function useAgencyListings(agencyProfileId: string | null | undefined) {
  return useQuery({
    queryKey: ['agency-listings', agencyProfileId],
    enabled: !!agencyProfileId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('market_listings')
        .select('id, title, price, current_price, address, city, canton, rooms, surface_m2, photos, transaction_type, type')
        .eq('agency_profile_id', agencyProfileId!)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(24)
      if (error) throw error
      return data || []
    },
    staleTime: 5 * 60 * 1000,
  })
}

interface AgencyData {
  id?: string
  name: string
  slug?: string
  logo_url?: string | null
  address?: string | null
  city?: string | null
  canton?: string | null
  postal_code?: string | null
  description?: string | null
  founded_year?: number | null
  phone?: string | null
  email?: string | null
  website_url?: string | null
  rating_avg?: number
  rating_count?: number
  zones_covered?: string[]
  specialties?: string[]
  certifications?: string[]
  status?: string
}

interface AgentData {
  id: string
  full_name?: string | null
  avatar_url?: string | null
  role?: string | null
  city?: string | null
  slug?: string | null
}

// ── HERO — top meta + huge h1 + cover + index + stats inline ─────────────
function Hero({ agency, agentsCount }: { agency: AgencyData; agentsCount: number }) {
  const slug = (agency.slug || agency.name).toUpperCase()
  const founded = agency.founded_year ?? '—'
  const cantons = (agency.zones_covered ?? []).slice(0, 5).join(' · ') || (agency.canton ?? '')
  const cover = (agency.logo_url && !agency.logo_url.endsWith('.svg') && agency.logo_url) || '/hero-megga.jpg'

  // Split name in two lines: " & " or hyphen, otherwise full
  const nameParts = agency.name.split(/\s+&\s+|\s+et\s+/i)
  const lineOne = nameParts[0]
  const lineTwo = nameParts.length > 1 ? `& ${nameParts.slice(1).join(' ')}` : null

  return (
    <section style={{ background: T.bg, padding: '72px 80px 0', fontFamily: FF }}>
      {/* Top meta strip */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          fontFamily: FF_MONO,
          fontSize: 11,
          color: T.muted,
          letterSpacing: 0.5,
          paddingBottom: 28,
          borderBottom: `1px solid ${T.rule}`,
          textTransform: 'uppercase',
        }}
      >
        <span>MEGGA / AGENCE / {slug}</span>
        <span style={{ fontFamily: FF, fontWeight: 600, color: T.ink }}>VOL. {founded} — 2026</span>
        <span style={{ textAlign: 'right' }}>{cantons}</span>
      </div>

      {/* Title block */}
      <div style={{ padding: '80px 0 60px' }}>
        <div style={{ fontFamily: FF_MONO, fontSize: 12, color: T.muted, letterSpacing: 1, marginBottom: 20, textTransform: 'uppercase' }}>
          Courtiers en immobilier {founded ? `· depuis ${founded}` : ''}
        </div>
        <h1
          style={{
            margin: 0,
            fontFamily: FF,
            fontWeight: 500,
            fontSize: 'clamp(56px, 9vw, 132px)',
            lineHeight: 0.92,
            letterSpacing: -4,
            color: T.ink,
          }}
        >
          {lineOne}
          {lineTwo && (
            <>
              <br />
              <span style={{ fontStyle: 'italic', fontWeight: 400 }}>{lineTwo}</span>
            </>
          )}
        </h1>
        {agency.description && (
          <div
            style={{
              marginTop: 32,
              maxWidth: 640,
              fontFamily: FF,
              fontSize: 21,
              fontWeight: 400,
              lineHeight: 1.5,
              color: T.soft,
              letterSpacing: -0.2,
            }}
          >
            {agency.description}
          </div>
        )}
      </div>

      {/* Bottom row: cover image + side info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 28 }}>
        <div
          style={{
            paddingTop: '44%',
            borderRadius: 0,
            position: 'relative',
            backgroundImage: `url(${cover})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
          }}
        >
          {agency.city && (
            <div
              style={{
                position: 'absolute',
                left: 20,
                bottom: 20,
                padding: '8px 12px',
                background: T.paper,
                fontFamily: FF_MONO,
                fontSize: 10.5,
                color: T.ink,
                letterSpacing: 0.5,
                textTransform: 'uppercase',
              }}
            >
              FIG. 01 — {agency.city} {agency.canton ? `(${agency.canton})` : ''}
            </div>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', paddingTop: 4 }}>
          <div>
            <div style={{ fontFamily: FF_MONO, fontSize: 10.5, color: T.muted, letterSpacing: 1, marginBottom: 14 }}>INDEX</div>
            <ol style={{ margin: 0, padding: 0, listStyle: 'none', fontFamily: FF, fontSize: 14, color: T.ink, lineHeight: 1.9 }}>
              {[
                { label: 'À propos', anchor: '#a-propos' },
                { label: 'Bureaux', anchor: '#bureaux' },
                { label: 'Mandats actifs', anchor: '#mandats' },
                { label: 'Équipe', anchor: '#equipe' },
                { label: 'Nous écrire', anchor: '#contact' },
              ].map((it, i, arr) => (
                <li
                  key={i}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: 10,
                    borderBottom: i < arr.length - 1 ? `1px dotted ${T.rule}` : 'none',
                    paddingBottom: 6,
                    marginBottom: 6,
                  }}
                >
                  <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted }}>0{i + 1}</span>
                  <a href={it.anchor} style={{ color: T.ink, textDecoration: 'none' }}>{it.label}</a>
                  <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted }}>p.{(i + 1) * 2}</span>
                </li>
              ))}
            </ol>
          </div>
          <div style={{ marginTop: 28, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <a
              href="#contact"
              style={{
                height: 52,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: 'none',
                borderRadius: 0,
                cursor: 'pointer',
                background: T.ink,
                color: '#fff',
                fontFamily: FF,
                fontSize: 13.5,
                fontWeight: 600,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                textDecoration: 'none',
              }}
            >
              Contacter l'agence →
            </a>
            {agency.website_url && (
              <a
                href={agency.website_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  height: 52,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  border: `1px solid ${T.ink}`,
                  color: T.ink,
                  textDecoration: 'none',
                  fontFamily: FF,
                  fontSize: 13.5,
                  fontWeight: 600,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {(() => {
                  try {
                    return new URL(agency.website_url).host.replace(/^www\./, '') + ' ↗'
                  } catch {
                    return 'Site ↗'
                  }
                })()}
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Stats inline strip */}
      <div
        style={{
          marginTop: 48,
          padding: '28px 0',
          borderTop: `1px solid ${T.ink}`,
          borderBottom: `1px solid ${T.ink}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
        }}
      >
        {[
          { v: String(founded), l: 'Fondation' },
          {
            v: founded && typeof founded === 'number' ? String(2026 - founded) : '—',
            l: 'Années',
          },
          { v: String(agentsCount || '—'), l: 'Courtiers' },
          { v: String((agency.zones_covered ?? []).length || 1), l: 'Zones' },
          { v: agency.rating_count && agency.rating_avg != null ? `${agency.rating_avg.toFixed(1)} / 5` : '—', l: 'Avis' },
        ].map((s, i) => (
          <div
            key={i}
            style={{
              borderLeft: i === 0 ? 'none' : `1px solid ${T.rule}`,
              paddingLeft: i === 0 ? 0 : 24,
            }}
          >
            <div
              style={{
                fontFamily: FF,
                fontSize: 44,
                fontWeight: 500,
                color: T.ink,
                letterSpacing: -1.5,
                fontVariantNumeric: 'tabular-nums',
                lineHeight: 1,
              }}
            >
              {s.v}
            </div>
            <div style={{ marginTop: 8, fontFamily: FF_MONO, fontSize: 10.5, color: T.muted, letterSpacing: 1, textTransform: 'uppercase' }}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── §01 BIO ──────────────────────────────────────────────────────────────
function Bio({ agency }: { agency: AgencyData }) {
  const cantons = (agency.zones_covered ?? []).map((z) => z.toUpperCase())
  const specs = (agency.specialties ?? []).map((s) => s.toUpperCase())
  return (
    <section id="a-propos" style={{ background: T.bg, padding: '100px 80px', fontFamily: FF, scrollMarginTop: 80 }}>
      <SectionLabel num="01" label="À propos" right="Manifesto" />
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr 200px', gap: 64, alignItems: 'start' }}>
        <div style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 1, lineHeight: 1.8, textTransform: 'uppercase' }}>
          {agency.founded_year && `Maison fondée en ${agency.founded_year}`}
          <br />
          {agency.city && agency.address && (
            <>
              {agency.city}, {agency.address}
            </>
          )}
        </div>
        <p
          style={{
            margin: 0,
            fontFamily: FF,
            fontSize: 32,
            fontWeight: 400,
            lineHeight: 1.35,
            color: T.ink,
            letterSpacing: -0.6,
          }}
        >
          {agency.description ||
            "Nous accompagnons propriétaires, acquéreurs et investisseurs dans toute la Suisse romande."}
        </p>
        <div style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 0.6, lineHeight: 1.7 }}>
          {cantons.length > 0 ? cantons.join(' · ') : ''}
          {cantons.length > 0 && specs.length > 0 && (
            <>
              <br />
              ——
              <br />
            </>
          )}
          {specs.map((s, i) => (
            <span key={i}>
              {s}
              <br />
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// ── §02 BUREAUX ──────────────────────────────────────────────────────────
function Bureaux({ agency }: { agency: AgencyData }) {
  // Single office from agency data (we don't have multi-office in current schema)
  const offices = [
    {
      city: agency.city ?? '—',
      addr: agency.address ?? '',
      npa: agency.postal_code ?? '',
      phone: agency.phone ?? '',
      email: agency.email ?? '',
      hours: 'Lun-Ven 9h-18h',
      primary: true,
    },
  ]

  return (
    <section id="bureaux" style={{ background: T.bg, padding: '100px 80px', fontFamily: FF, scrollMarginTop: 80 }}>
      <SectionLabel num="02" label="Bureaux" right={`${offices.length} adresse${offices.length > 1 ? 's' : ''}`} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, borderTop: `1px solid ${T.rule}` }}>
        {offices.map((o, i) => (
          <article
            key={i}
            style={{
              padding: '36px 28px 32px',
              borderRight: i < 2 ? `1px solid ${T.rule}` : 'none',
              borderBottom: `1px solid ${T.rule}`,
              background: T.bg,
              position: 'relative',
            }}
          >
            <div style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' }}>
              Bureau 0{i + 1} {o.primary && '· Siège'}
            </div>
            <h3
              style={{
                margin: 0,
                fontFamily: FF,
                fontSize: 56,
                fontWeight: 400,
                color: T.ink,
                letterSpacing: -1.8,
                lineHeight: 0.95,
              }}
            >
              {o.city}
            </h3>
            <div style={{ marginTop: 20, fontFamily: FF, fontSize: 14, color: T.soft, lineHeight: 1.7 }}>
              {o.addr}
              {o.npa && (
                <>
                  <br />
                  {o.npa} {o.city}
                </>
              )}
            </div>
            <div
              style={{
                marginTop: 24,
                paddingTop: 20,
                borderTop: `1px solid ${T.rule}`,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                fontFamily: FF,
                fontSize: 13.5,
                color: T.ink,
              }}
            >
              {o.phone && <span style={{ fontVariantNumeric: 'tabular-nums' }}>{o.phone}</span>}
              {o.email && (
                <a href={`mailto:${o.email}`} style={{ color: T.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  {o.email}
                </a>
              )}
              <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, marginTop: 6, letterSpacing: 0.4, textTransform: 'uppercase' }}>
                {o.hours}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

// ── §03 MANDATS ACTIFS — liste éditoriale 1 par ligne ───────────────────
interface ListingRow {
  id: string
  title: string | null
  price: number | null
  current_price: number | null
  address: string | null
  city: string | null
  canton: string | null
  rooms: number | null
  surface_m2: number | null
  photos: string[] | null
  transaction_type: string | null
  type: string | null
}

function Mandats({ listings }: { listings: ListingRow[] }) {
  const [tab, setTab] = useState<'all' | 'buy' | 'rent'>('all')
  const counts = {
    all: listings.length,
    buy: listings.filter((l) => l.transaction_type !== 'rent').length,
    rent: listings.filter((l) => l.transaction_type === 'rent').length,
  }
  const filtered = listings.filter((l) => {
    if (tab === 'all') return true
    if (tab === 'rent') return l.transaction_type === 'rent'
    return l.transaction_type !== 'rent'
  }).slice(0, 8)

  return (
    <section id="mandats" style={{ background: T.bg, padding: '100px 80px', fontFamily: FF, scrollMarginTop: 80 }}>
      <SectionLabel num="03" label="Mandats actifs" right={`${listings.length} bien${listings.length > 1 ? 's' : ''}`} />

      {listings.length === 0 ? (
        <div style={{ padding: '60px 0', textAlign: 'center', fontFamily: FF_MONO, fontSize: 12, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
          Aucun mandat actif pour le moment
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: 0, marginBottom: 40, borderBottom: `1px solid ${T.rule}` }}>
            {(
              [
                ['all', 'Tous', counts.all],
                ['buy', 'Vente', counts.buy],
                ['rent', 'Location', counts.rent],
              ] as const
            ).map(([k, l, n]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  padding: '0 28px 18px 0',
                  marginRight: 28,
                  fontFamily: FF,
                  fontSize: 17,
                  fontWeight: 500,
                  color: tab === k ? T.ink : T.muted,
                  borderBottom: tab === k ? `2px solid ${T.ink}` : '2px solid transparent',
                  marginBottom: -1,
                  letterSpacing: -0.2,
                }}
              >
                {l}{' '}
                <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, marginLeft: 6 }}>
                  {String(n).padStart(2, '0')}
                </span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {filtered.map((l, i) => {
              const isLoc = l.transaction_type === 'rent'
              const price = Number(l.current_price ?? l.price ?? 0)
              const priceStr = price > 0 ? (isLoc ? `${formatCHF(price)}/mois` : formatCHF(price)) : '—'
              const photo = (l.photos && l.photos[0]) || ''
              return (
                <Link
                  key={l.id}
                  to={`/listing/market-${l.id}`}
                  style={{
                    textDecoration: 'none',
                    color: 'inherit',
                    display: 'grid',
                    gridTemplateColumns: '60px 280px 1fr auto',
                    gap: 32,
                    alignItems: 'center',
                    padding: '22px 0',
                    borderBottom: `1px solid ${T.rule}`,
                  }}
                >
                  <span style={{ fontFamily: FF_MONO, fontSize: 13, color: T.muted, letterSpacing: 0.5, paddingLeft: 8 }}>
                    N° {String(i + 1).padStart(2, '0')}
                  </span>
                  <div
                    style={{
                      height: 130,
                      backgroundImage: photo ? `url(${photo})` : undefined,
                      backgroundColor: photo ? 'transparent' : T.fade,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                    }}
                  />
                  <div>
                    <div
                      style={{
                        fontFamily: FF_MONO,
                        fontSize: 10.5,
                        color: T.muted,
                        letterSpacing: 1,
                        marginBottom: 8,
                        textTransform: 'uppercase',
                      }}
                    >
                      {isLoc ? 'Location' : 'Vente'} {l.canton && `· ${l.canton}`} {l.type && `· ${l.type}`}
                    </div>
                    <div
                      style={{
                        fontFamily: FF,
                        fontSize: 26,
                        fontWeight: 500,
                        color: T.ink,
                        letterSpacing: -0.6,
                        lineHeight: 1.15,
                      }}
                    >
                      {l.title || 'Bien immobilier'}
                    </div>
                    <div style={{ marginTop: 6, fontFamily: FF, fontSize: 14, color: T.soft }}>
                      {l.address || l.city || ''}
                      {l.rooms ? ` · ${l.rooms} pièces` : ''}
                      {l.surface_m2 ? ` · ${l.surface_m2} m²` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', paddingRight: 12 }}>
                    <div
                      style={{
                        fontFamily: FF,
                        fontSize: 26,
                        fontWeight: 500,
                        color: T.ink,
                        letterSpacing: -0.5,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {priceStr}
                    </div>
                    <div style={{ marginTop: 6, fontFamily: FF_MONO, fontSize: 11, color: T.ink, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                      Voir le bien →
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}
    </section>
  )
}

// ── §04 ÉQUIPE — trombi N&B sur fond noir ────────────────────────────────
function Equipe({ agents, agencyCity }: { agents: AgentData[]; agencyCity: string }) {
  if (agents.length === 0) return null
  return (
    <section id="equipe" style={{ background: T.ink, color: '#fff', padding: '100px 80px', fontFamily: FF, scrollMarginTop: 80 }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 18,
          alignItems: 'center',
          padding: '0 0 18px',
          borderBottom: '1px solid #fff',
          marginBottom: 36,
        }}
      >
        <span style={{ fontFamily: FF_MONO, fontSize: 11, color: '#fff', fontWeight: 500, letterSpacing: 0.6 }}>§ 04</span>
        <span style={{ fontFamily: FF, fontSize: 13, fontWeight: 600, color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase' }}>Équipe</span>
        <span style={{ fontFamily: FF_MONO, fontSize: 11, color: 'rgba(255,255,255,0.5)', letterSpacing: 0.4 }}>
          {agents.length} collaborateur{agents.length > 1 ? 's' : ''}
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 0 }}>
        {agents.map((a, i) => {
          const fallback = '/megga-gg.svg'
          const photo = a.avatar_url || fallback
          const city = a.city || agencyCity
          const linkHref = a.slug ? `/agents/${a.slug}` : '#'
          const Wrapper: 'a' | 'div' = a.slug ? 'a' : 'div'
          return (
            <Wrapper
              key={a.id}
              {...(a.slug ? { href: linkHref } : {})}
              style={{
                borderRight: (i + 1) % 6 !== 0 ? '1px solid rgba(255,255,255,0.1)' : 'none',
                borderBottom: i < agents.length - (agents.length % 6 || 6) ? '1px solid rgba(255,255,255,0.1)' : 'none',
                padding: '22px 18px',
                color: '#fff',
                textDecoration: 'none',
                display: 'block',
              }}
            >
              <div
                style={{
                  paddingTop: '115%',
                  position: 'relative',
                  marginBottom: 16,
                  backgroundImage: `url(${photo})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center top',
                  filter: 'grayscale(1) contrast(1.05)',
                }}
              />
              <div
                style={{
                  fontFamily: FF_MONO,
                  fontSize: 10,
                  color: 'rgba(255,255,255,0.45)',
                  letterSpacing: 1,
                  marginBottom: 6,
                  textTransform: 'uppercase',
                }}
              >
                N° {String(i + 1).padStart(2, '0')} {city && `· ${city}`}
              </div>
              <div
                style={{
                  fontFamily: FF,
                  fontSize: 16,
                  fontWeight: 500,
                  color: '#fff',
                  letterSpacing: -0.3,
                  lineHeight: 1.2,
                }}
              >
                {a.full_name || 'Collaborateur'}
              </div>
              {a.role && (
                <div
                  style={{
                    marginTop: 4,
                    fontFamily: FF,
                    fontSize: 12,
                    color: 'rgba(255,255,255,0.55)',
                    lineHeight: 1.4,
                  }}
                >
                  {a.role}
                </div>
              )}
            </Wrapper>
          )
        })}
      </div>
    </section>
  )
}

// ── §05 NOUS ÉCRIRE ──────────────────────────────────────────────────────
function Contact({ agency }: { agency: AgencyData }) {
  const [submitted, setSubmitted] = useState(false)
  const websiteHost = (() => {
    if (!agency.website_url) return null
    try {
      return new URL(agency.website_url).host.replace(/^www\./, '')
    } catch {
      return null
    }
  })()

  return (
    <section id="contact" style={{ background: T.bg, padding: '100px 80px', fontFamily: FF, scrollMarginTop: 80 }}>
      <SectionLabel num="05" label="Nous écrire" right="Réponse 24h" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.1fr', gap: 80, alignItems: 'start' }}>
        <div>
          <h2
            style={{
              margin: 0,
              fontFamily: FF,
              fontSize: 'clamp(40px, 5vw, 64px)',
              fontWeight: 500,
              color: T.ink,
              letterSpacing: -2,
              lineHeight: 0.95,
            }}
          >
            Un projet ?
            <br />
            <span style={{ fontStyle: 'italic', color: T.muted }}>Écrivez-nous.</span>
          </h2>
          <p
            style={{
              marginTop: 26,
              fontFamily: FF,
              fontSize: 16,
              color: T.soft,
              lineHeight: 1.6,
              maxWidth: 460,
            }}
          >
            Estimation gratuite, recherche personnalisée, mandat de vente — notre équipe prend contact dans les 24
            heures ouvrables.
          </p>
          <div
            style={{
              marginTop: 36,
              padding: '20px 0',
              borderTop: `1px solid ${T.ink}`,
              borderBottom: `1px solid ${T.ink}`,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            {agency.phone && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FF, fontSize: 14, color: T.ink }}>
                <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Téléphone</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{agency.phone}</span>
              </div>
            )}
            {agency.email && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FF, fontSize: 14, color: T.ink }}>
                <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Email</span>
                <a href={`mailto:${agency.email}`} style={{ color: T.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                  {agency.email}
                </a>
              </div>
            )}
            {agency.website_url && websiteHost && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: FF, fontSize: 14, color: T.ink }}>
                <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Site</span>
                <a
                  href={agency.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: T.ink, textDecoration: 'none' }}
                >
                  {websiteHost} ↗
                </a>
              </div>
            )}
          </div>
        </div>

        <div style={{ background: T.paper, padding: 36, border: `1px solid ${T.rule}` }}>
          {submitted ? (
            <div style={{ padding: '60px 30px', textAlign: 'center' }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 0,
                  margin: '0 auto 20px',
                  background: T.ink,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ fontFamily: FF, fontSize: 26, color: '#fff' }}>✓</span>
              </div>
              <div style={{ fontFamily: FF, fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: -0.5 }}>
                Message envoyé
              </div>
              <div style={{ marginTop: 8, fontFamily: FF, fontSize: 14, color: T.soft }}>
                Notre équipe vous recontacte sous 24h ouvrables.
              </div>
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSubmitted(true)
              }}
              style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
            >
              {[
                { l: 'Nom', p: 'Camille Aebischer', name: 'name', type: 'text' },
                { l: 'Email', p: 'vous@exemple.ch', name: 'email', type: 'email' },
                { l: 'Téléphone', p: '+41 …', name: 'phone', type: 'tel' },
              ].map((f) => (
                <label key={f.name} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ fontFamily: FF_MONO, fontSize: 10.5, color: T.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                    {f.l}
                  </span>
                  <input
                    name={f.name}
                    type={f.type}
                    placeholder={f.p}
                    style={{
                      height: 44,
                      padding: '0 0 8px',
                      border: 'none',
                      borderBottom: `1px solid ${T.rule}`,
                      background: 'transparent',
                      fontFamily: FF,
                      fontSize: 16,
                      color: T.ink,
                      outline: 'none',
                    }}
                  />
                </label>
              ))}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontFamily: FF_MONO, fontSize: 10.5, color: T.muted, letterSpacing: 0.8, textTransform: 'uppercase' }}>
                  Message
                </span>
                <textarea
                  name="message"
                  placeholder="Quelques mots sur votre projet…"
                  style={{
                    minHeight: 90,
                    padding: '0 0 8px',
                    border: 'none',
                    borderBottom: `1px solid ${T.rule}`,
                    background: 'transparent',
                    fontFamily: FF,
                    fontSize: 16,
                    color: T.ink,
                    outline: 'none',
                    resize: 'vertical',
                  }}
                />
              </label>
              <button
                type="submit"
                style={{
                  marginTop: 12,
                  height: 56,
                  border: 'none',
                  borderRadius: 0,
                  cursor: 'pointer',
                  background: T.ink,
                  color: '#fff',
                  fontFamily: FF,
                  fontSize: 13.5,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Envoyer ma demande →
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}

// ── FOOTER ───────────────────────────────────────────────────────────────
function EditorialFooter({ agency }: { agency: AgencyData }) {
  return (
    <footer style={{ background: T.bg, padding: '60px 80px 40px', borderTop: `1px solid ${T.ink}`, fontFamily: FF }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 32, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: FF, fontSize: 22, fontWeight: 500, color: T.ink, letterSpacing: -0.6 }}>{agency.name}</div>
          {agency.description && (
            <div style={{ marginTop: 8, fontFamily: FF, fontSize: 13, color: T.soft, lineHeight: 1.6, maxWidth: 320 }}>
              {agency.description.slice(0, 200)}
              {agency.description.length > 200 ? '…' : ''}
            </div>
          )}
        </div>
        {agency.city && (
          <div>
            <div style={{ fontFamily: FF_MONO, fontSize: 10.5, color: T.muted, letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' }}>
              {agency.city}
            </div>
            <div style={{ fontFamily: FF, fontSize: 13, color: T.ink, lineHeight: 1.7 }}>
              {agency.address}
              {agency.address && agency.postal_code && <br />}
              {agency.postal_code} {agency.city}
              {agency.phone && (
                <>
                  <br />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{agency.phone}</span>
                </>
              )}
            </div>
          </div>
        )}
      </div>
      <div
        style={{
          marginTop: 40,
          paddingTop: 18,
          borderTop: `1px solid ${T.rule}`,
          display: 'flex',
          justifyContent: 'space-between',
          fontFamily: FF_MONO,
          fontSize: 10.5,
          color: T.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
        }}
      >
        <span>© 2026 {agency.name} · Tous droits réservés</span>
        <span>
          Hébergé par <span style={{ color: T.ink, fontWeight: 600 }}>MEGGA</span>
        </span>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────

export default function AgencyProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation('directory')
  const { data, isLoading, error } = useAgencyProfile(slug ?? '')
  const agencyId = ((data?.agency as unknown as { id?: string } | undefined)?.id) ?? null
  const { data: agencyListings = [] } = useAgencyListings(agencyId)

  if (isLoading) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', fontFamily: FF }}>
        <HomeStickyHeader alwaysShow />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '120px 80px' }}>
          <div style={{ height: 12, width: 200, background: T.fade, marginBottom: 16, animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: 80, width: 600, background: T.fade, animation: 'pulse 1.5s infinite' }} />
        </div>
      </div>
    )
  }

  if (error || !data?.agency) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', fontFamily: FF }}>
        <HomeStickyHeader alwaysShow />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '120px 32px', textAlign: 'center' }}>
          <Building2 style={{ width: 56, height: 56, color: T.muted, margin: '0 auto 24px' }} />
          <p style={{ fontFamily: FF, fontSize: 24, fontWeight: 500, color: T.ink, marginBottom: 12, letterSpacing: -0.5 }}>
            {t('noResults')}
          </p>
          <p style={{ fontFamily: FF, fontSize: 14, color: T.soft, marginBottom: 32 }}>{t('noResultsSubtitle')}</p>
          <Link
            to="/agences"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 24px',
              border: `1px solid ${T.ink}`,
              color: T.ink,
              textDecoration: 'none',
              fontFamily: FF,
              fontSize: 13,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            <ArrowLeft style={{ width: 16, height: 16 }} />
            {t('toggleAgencies')}
          </Link>
        </div>
      </div>
    )
  }

  const { agency, agents } = data as { agency: AgencyData; agents: AgentData[] }

  return (
    <div style={{ background: T.bg, fontFamily: FF }}>
      <HomeStickyHeader alwaysShow />
      <Hero agency={agency} agentsCount={agents.length} />
      <Bio agency={agency} />
      <Bureaux agency={agency} />
      <Mandats listings={agencyListings} />
      <Equipe agents={agents} agencyCity={agency.city ?? ''} />
      <Contact agency={agency} />
      <EditorialFooter agency={agency} />
    </div>
  )
}
