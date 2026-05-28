import { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Star, Phone, Mail, Globe, ArrowLeft, User } from 'lucide-react'
import { useAgentProfile } from '@/hooks/useAgentProfile'
import { useAgentReviews } from '@/hooks/useAgentReviews'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import VerifiedBadge from '@/components/directory/VerifiedBadge'
import ClaimProfileCTA from '@/components/directory/ClaimProfileCTA'
import AgentStatsPanel from '@/components/directory/AgentStatsPanel'
import ReviewCard from '@/components/directory/ReviewCard'
import ReviewForm from '@/components/directory/ReviewForm'

// Page agent publique en design Sugar Editorial — cohérente avec la page Agence
// (Helvetica Neue + JetBrains Mono pour les méta, fond #FAFAFA, sections numérotées).

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

const SPECIALTY_KEYS: Record<string, string> = {
  residential: 'specialty.residential',
  commercial: 'specialty.commercial',
  luxury: 'specialty.luxury',
  new: 'specialty.new',
  rental: 'specialty.rental',
}

export default function AgentProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { t } = useTranslation('directory')
  const { data, isLoading, error } = useAgentProfile(slug ?? '')
  const [reviewSort, setReviewSort] = useState<'recent' | 'best'>('recent')
  const { data: reviews } = useAgentReviews(data?.agent?.id ?? '', reviewSort)

  if (isLoading) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', fontFamily: FF }}>
        <HomeStickyHeader alwaysShow />
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '120px 80px' }}>
          <div style={{ height: 12, width: 200, background: T.fade, marginBottom: 16 }} />
          <div style={{ height: 80, width: 600, background: T.fade }} />
        </div>
      </div>
    )
  }

  if (error || !data?.agent) {
    return (
      <div style={{ background: T.bg, minHeight: '100vh', fontFamily: FF }}>
        <HomeStickyHeader alwaysShow />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '120px 32px', textAlign: 'center' }}>
          <User style={{ width: 56, height: 56, color: T.muted, margin: '0 auto 24px' }} />
          <p style={{ fontFamily: FF, fontSize: 24, fontWeight: 500, color: T.ink, marginBottom: 12, letterSpacing: -0.5 }}>
            {t('noResults')}
          </p>
          <p style={{ fontFamily: FF, fontSize: 14, color: T.soft, marginBottom: 32 }}>{t('noResultsSubtitle')}</p>
          <Link
            to="/agents"
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
            {t('toggleAgents')}
          </Link>
        </div>
      </div>
    )
  }

  const { agent, agency } = data
  const fullName = `${agent.first_name} ${agent.last_name}`
  const initials = `${agent.first_name[0] ?? ''}${agent.last_name[0] ?? ''}`.toUpperCase()
  const slugUpper = (slug ?? fullName).toUpperCase()

  return (
    <div style={{ background: T.bg, fontFamily: FF }}>
      <HomeStickyHeader alwaysShow />

      {/* HERO Editorial — meta strip + portrait + name + identity */}
      <section style={{ background: T.bg, padding: '72px 80px 0' }}>
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
          <span>MEGGA / AGENT / {slugUpper}</span>
          <span style={{ fontFamily: FF, fontWeight: 600, color: T.ink }}>
            {agent.experience_years ? `EXP. ${agent.experience_years} ANS` : 'COURTIER PROFESSIONNEL'}
          </span>
          <span style={{ textAlign: 'right' }}>
            {agent.city || ''} {agent.canton ? `· ${agent.canton}` : ''}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 56, padding: '64px 0 60px', alignItems: 'start' }}>
          {/* Photo */}
          <div>
            <div
              style={{
                width: '100%',
                paddingTop: '120%',
                position: 'relative',
                background: agent.photo_url ? `center/cover no-repeat url(${agent.photo_url})` : T.fade,
                filter: 'grayscale(0.2) contrast(1.05)',
              }}
            >
              {!agent.photo_url && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontFamily: FF,
                    fontSize: 64,
                    fontWeight: 500,
                    color: T.muted,
                    letterSpacing: -2,
                  }}
                >
                  {initials}
                </div>
              )}
              <div
                style={{
                  position: 'absolute',
                  left: 16,
                  bottom: 16,
                  padding: '6px 10px',
                  background: T.paper,
                  fontFamily: FF_MONO,
                  fontSize: 10,
                  color: T.ink,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}
              >
                Portrait
              </div>
            </div>
          </div>

          {/* Title block */}
          <div style={{ paddingTop: 12 }}>
            <div style={{ fontFamily: FF_MONO, fontSize: 12, color: T.muted, letterSpacing: 1, marginBottom: 16, textTransform: 'uppercase' }}>
              Courtier en immobilier
            </div>
            <h1
              style={{
                margin: 0,
                fontFamily: FF,
                fontWeight: 500,
                fontSize: 'clamp(48px, 7vw, 96px)',
                lineHeight: 0.95,
                letterSpacing: -3,
                color: T.ink,
              }}
            >
              {agent.first_name}
              <br />
              <span style={{ fontStyle: 'italic', fontWeight: 400 }}>{agent.last_name}</span>
            </h1>

            <div
              style={{
                marginTop: 20,
                display: 'flex',
                gap: 12,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <VerifiedBadge status={agent.status} />
              {agency && (
                <Link
                  to={`/agencies/${agency.slug}`}
                  style={{
                    fontFamily: FF,
                    fontSize: 14,
                    color: T.ink,
                    textDecoration: 'underline',
                    textUnderlineOffset: 3,
                  }}
                >
                  {agency.name}
                </Link>
              )}
              {agent.rating_count > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      style={{
                        width: 14,
                        height: 14,
                        fill: i < Math.round(agent.rating_avg) ? '#0B0C0E' : 'none',
                        color: i < Math.round(agent.rating_avg) ? '#0B0C0E' : T.muted,
                      }}
                    />
                  ))}
                  <span style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 0.4 }}>
                    ({agent.rating_count})
                  </span>
                </span>
              )}
            </div>

            {agent.bio && (
              <p
                style={{
                  marginTop: 28,
                  fontFamily: FF,
                  fontSize: 19,
                  fontWeight: 400,
                  lineHeight: 1.5,
                  color: T.soft,
                  letterSpacing: -0.2,
                  maxWidth: 640,
                }}
              >
                {agent.bio}
              </p>
            )}

            {/* Contact actions */}
            <div style={{ marginTop: 32, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {agent.phone && (
                <a
                  href={`tel:${agent.phone}`}
                  style={{
                    height: 48,
                    padding: '0 20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    background: T.ink,
                    color: '#fff',
                    textDecoration: 'none',
                    fontFamily: FF,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  <Phone style={{ width: 14, height: 14 }} />
                  {t('contact')}
                </a>
              )}
              {agent.email && (
                <a
                  href={`mailto:${agent.email}`}
                  style={{
                    height: 48,
                    padding: '0 20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    border: `1px solid ${T.ink}`,
                    color: T.ink,
                    textDecoration: 'none',
                    fontFamily: FF,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  <Mail style={{ width: 14, height: 14 }} />
                  Email
                </a>
              )}
              {agent.website_url && (
                <a
                  href={agent.website_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    height: 48,
                    padding: '0 20px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 10,
                    border: `1px solid ${T.ink}`,
                    color: T.ink,
                    textDecoration: 'none',
                    fontFamily: FF,
                    fontSize: 13,
                    fontWeight: 600,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                  }}
                >
                  <Globe style={{ width: 14, height: 14 }} />
                  Site
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Claim CTA */}
      {agent.status !== 'verified' && (
        <section style={{ padding: '0 80px 60px' }}>
          <ClaimProfileCTA name={fullName} status={agent.status} />
        </section>
      )}

      {/* §01 Profil — specialties / langues / certifs */}
      <section style={{ background: T.bg, padding: '80px 80px', scrollMarginTop: 80 }}>
        <SectionLabel num="01" label="Profil" right="Compétences" />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 64 }}>
          <div>
            <div style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' }}>
              Spécialités
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agent.specialties.length > 0 ? (
                agent.specialties.map((s) => (
                  <div key={s} style={{ fontFamily: FF, fontSize: 17, color: T.ink, letterSpacing: -0.2 }}>
                    {SPECIALTY_KEYS[s] ? t(SPECIALTY_KEYS[s]) : s}
                  </div>
                ))
              ) : (
                <div style={{ fontFamily: FF, fontSize: 14, color: T.muted, fontStyle: 'italic' }}>—</div>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' }}>
              Langues parlées
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agent.languages.length > 0 ? (
                agent.languages.map((l) => (
                  <div key={l} style={{ fontFamily: FF, fontSize: 17, color: T.ink, letterSpacing: -0.2, textTransform: 'capitalize' }}>
                    {l}
                  </div>
                ))
              ) : (
                <div style={{ fontFamily: FF, fontSize: 14, color: T.muted, fontStyle: 'italic' }}>—</div>
              )}
            </div>
          </div>
          <div>
            <div style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' }}>
              Certifications
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {agent.certifications.length > 0 ? (
                agent.certifications.map((c) => (
                  <div key={c} style={{ fontFamily: FF, fontSize: 17, color: T.ink, letterSpacing: -0.2 }}>
                    {c}
                  </div>
                ))
              ) : (
                <div style={{ fontFamily: FF, fontSize: 14, color: T.muted, fontStyle: 'italic' }}>—</div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* §02 Statistiques + contact card */}
      <section style={{ background: T.bg, padding: '80px 80px', borderTop: `1px solid ${T.rule}` }}>
        <SectionLabel num="02" label="Performance" right="Sur 12 mois" />
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 48, alignItems: 'start' }}>
          <AgentStatsPanel agent={agent} />
          <div style={{ background: T.paper, padding: 28, border: `1px solid ${T.rule}` }}>
            <div style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 18, textTransform: 'uppercase' }}>
              Coordonnées
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FF, fontSize: 14 }}>
              {agent.phone && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${T.rule}`, paddingBottom: 8 }}>
                  <span style={{ fontFamily: FF_MONO, fontSize: 10.5, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Tél.</span>
                  <a href={`tel:${agent.phone}`} style={{ color: T.ink, textDecoration: 'none', fontVariantNumeric: 'tabular-nums' }}>
                    {agent.phone}
                  </a>
                </div>
              )}
              {agent.email && (
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${T.rule}`, paddingBottom: 8 }}>
                  <span style={{ fontFamily: FF_MONO, fontSize: 10.5, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Email</span>
                  <a href={`mailto:${agent.email}`} style={{ color: T.ink, textDecoration: 'underline', textUnderlineOffset: 3 }}>
                    {agent.email}
                  </a>
                </div>
              )}
              {agent.website_url && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: FF_MONO, fontSize: 10.5, color: T.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>Site</span>
                  <a href={agent.website_url} target="_blank" rel="noopener noreferrer" style={{ color: T.ink, textDecoration: 'none' }}>
                    Visiter ↗
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* §03 Avis clients */}
      <section style={{ background: T.bg, padding: '80px 80px', borderTop: `1px solid ${T.rule}` }}>
        <SectionLabel num="03" label="Avis clients" right={`${reviews?.length ?? 0} témoignage${(reviews?.length ?? 0) > 1 ? 's' : ''}`} />

        <div style={{ display: 'flex', gap: 12, marginBottom: 32 }}>
          {(['recent', 'best'] as const).map((sort) => (
            <button
              key={sort}
              onClick={() => setReviewSort(sort)}
              style={{
                border: 'none',
                background: 'none',
                cursor: 'pointer',
                padding: '0 24px 14px 0',
                fontFamily: FF,
                fontSize: 15,
                fontWeight: 500,
                color: reviewSort === sort ? T.ink : T.muted,
                borderBottom: reviewSort === sort ? `2px solid ${T.ink}` : '2px solid transparent',
                marginBottom: -1,
                letterSpacing: -0.2,
              }}
            >
              {sort === 'recent' ? t('review.sortRecent') : t('review.sortBest')}
            </button>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 64, alignItems: 'start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {reviews && reviews.length > 0 ? (
              reviews.map((review) => <ReviewCard key={review.id} review={review} />)
            ) : (
              <div
                style={{
                  fontFamily: FF_MONO,
                  fontSize: 12,
                  color: T.muted,
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                  padding: '40px 0',
                  textAlign: 'center',
                  border: `1px dashed ${T.rule}`,
                }}
              >
                {t('review.noReviews')}
              </div>
            )}
          </div>
          <div style={{ background: T.paper, padding: 28, border: `1px solid ${T.rule}` }}>
            <div style={{ fontFamily: FF_MONO, fontSize: 11, color: T.muted, letterSpacing: 1, marginBottom: 14, textTransform: 'uppercase' }}>
              {t('review.writeReview')}
            </div>
            <ReviewForm agentProfileId={agent.id} />
          </div>
        </div>
      </section>

      {/* Footer minimal */}
      <footer style={{ background: T.bg, padding: '60px 80px 40px', borderTop: `1px solid ${T.ink}` }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontFamily: FF_MONO,
            fontSize: 10.5,
            color: T.muted,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
          }}
        >
          <span>© 2026 {fullName}</span>
          <span>
            Hébergé par <span style={{ color: T.ink, fontWeight: 600 }}>MEGGA</span>
          </span>
        </div>
      </footer>
    </div>
  )
}
