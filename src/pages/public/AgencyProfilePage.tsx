// MEGGA Marketplace — Page profil agence publique (/agencies/:slug)
// Compose : PxNav + PxAgencyProfile (section hero + biens + équipe) + PxFooter.
// Source : useAgencyProfile (agence + agents liés) + market_listings actifs.
//
// Inclut les meta SEO (title/description/canonical/OG) + JSON-LD
// schema.org/RealEstateAgent pour les rich results Google.

import { useParams, Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '@/lib/supabase'
import { PX } from '@/components/propertyx'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import PxAgencyProfile, {
  type AgencyData,
  type AgentMini,
  type ListingMini,
} from '@/components/propertyx/sections/PxAgencyProfile'
import { useAgencyProfile } from '@/hooks/useAgentProfile'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

const SITE_NAME = 'MEGGA Real Estate'
const SITE_URL = 'https://megga.ch'

function ogLocale(lang: string): string {
  switch (lang.slice(0, 2)) {
    case 'de': return 'de_CH'
    case 'en': return 'en_US'
    case 'it': return 'it_CH'
    default: return 'fr_CH'
  }
}

function useAgencyListings(agencyId: string | undefined) {
  return useQuery({
    queryKey: ['agency-listings', agencyId],
    queryFn: async (): Promise<ListingMini[]> => {
      if (!agencyId) return []
      const { data, error } = await supabase
        .from('market_listings')
        .select('id, title, price, current_price, address, city, canton, rooms, surface_m2, photos, transaction_type, type')
        .eq('agency_profile_id', agencyId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(24)
      if (error) throw error
      return (data ?? []) as ListingMini[]
    },
    enabled: !!agencyId,
    staleTime: 60_000,
  })
}

export default function AgencyProfilePage() {
  const { slug } = useParams<{ slug: string }>()
  const { t, i18n } = useTranslation('directory')
  const { data, isLoading, error } = useAgencyProfile(slug ?? '')
  const { data: listings } = useAgencyListings(data?.agency?.id)

  const agency = data?.agency ?? null
  const canonical = agency ? `${SITE_URL}/agencies/${agency.slug}` : undefined
  const locality = agency
    ? [agency.city, agency.canton].filter(Boolean).join(', ')
    : ''
  const fullTitle = agency
    ? `${agency.name}${locality ? ` — ${locality}` : ''} | ${SITE_NAME}`
    : undefined
  const description = agency
    ? (agency.description?.slice(0, 160)
      || `${agency.name}${locality ? ` à ${locality}` : ''} — Agence immobilière vérifiée sur MEGGA. Découvrez ses biens actifs et son équipe.`)
    : undefined
  const ogImage = agency?.logo_url || undefined

  const jsonLd = agency ? {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    name: agency.name,
    url: canonical,
    ...(agency.description ? { description: agency.description.slice(0, 500) } : {}),
    ...(agency.logo_url ? { image: agency.logo_url, logo: agency.logo_url } : {}),
    ...(agency.phone ? { telephone: agency.phone } : {}),
    ...(agency.email ? { email: agency.email } : {}),
    ...(agency.website_url ? { sameAs: [agency.website_url] } : {}),
    ...((agency.address || agency.city) ? {
      address: {
        '@type': 'PostalAddress',
        ...(agency.address ? { streetAddress: agency.address } : {}),
        ...(agency.city ? { addressLocality: agency.city } : {}),
        ...(agency.canton ? { addressRegion: agency.canton } : {}),
        addressCountry: 'CH',
      },
    } : {}),
    ...(agency.founded_year ? { foundingDate: String(agency.founded_year) } : {}),
    ...(typeof agency.rating_avg === 'number' && (agency.rating_count ?? 0) > 0 ? {
      aggregateRating: {
        '@type': 'AggregateRating',
        ratingValue: agency.rating_avg,
        reviewCount: agency.rating_count,
      },
    } : {}),
  } : null

  useDocumentMeta({
    title: fullTitle,
    htmlLang: agency ? i18n.language.slice(0, 2) : undefined,
    canonical,
    jsonLd,
    meta: agency ? [
      ...(description ? [{ name: 'description', content: description }] : []),
      { name: 'robots', content: 'index, follow' },
      ...(fullTitle ? [{ property: 'og:title', content: fullTitle }] : []),
      ...(description ? [{ property: 'og:description', content: description }] : []),
      { property: 'og:type', content: 'profile' },
      { property: 'og:locale', content: ogLocale(i18n.language) },
      { property: 'og:site_name', content: SITE_NAME },
      ...(canonical ? [{ property: 'og:url', content: canonical }] : []),
      ...(ogImage ? [{ property: 'og:image', content: ogImage }] : []),
      { name: 'twitter:card', content: ogImage ? 'summary_large_image' : 'summary' },
      ...(fullTitle ? [{ name: 'twitter:title', content: fullTitle }] : []),
      ...(description ? [{ name: 'twitter:description', content: description }] : []),
      ...(ogImage ? [{ name: 'twitter:image', content: ogImage }] : []),
    ] : [],
  })

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: PX.neutral100, fontFamily: PX.font.sans }}>
        <PxNav bg={PX.neutral100} />
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '120px 24px' }}>
          <div style={{ height: 14, width: 160, background: PX.neutral200, borderRadius: 4, marginBottom: 16 }} />
          <div style={{ height: 56, width: 420, maxWidth: '80%', background: PX.neutral200, borderRadius: 8 }} />
        </div>
      </div>
    )
  }

  if (error || !agency) {
    return (
      <div style={{ minHeight: '100vh', background: PX.neutral100, fontFamily: PX.font.sans }}>
        <PxNav bg={PX.neutral100} />
        <div style={{
          maxWidth: 720,
          margin: '0 auto',
          padding: '160px 24px',
          textAlign: 'center',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 28,
            fontWeight: 500,
            color: PX.ink,
          }}>{t('agency.notFound.title', 'Agence introuvable')}</h1>
          <p style={{
            marginTop: 12,
            color: PX.neutral500,
            fontSize: 16,
          }}>
            {t('agency.notFound.subtitle', "Cette agence n'existe pas ou n'est plus référencée.")}
          </p>
          <Link
            to="/agencies"
            style={{
              display: 'inline-block',
              marginTop: 32,
              padding: '12px 24px',
              background: PX.neutral700,
              color: PX.neutral100,
              borderRadius: PX.radius.pill,
              fontSize: 14,
              fontWeight: 500,
              textDecoration: 'none',
            }}
          >
            {t('agency.notFound.cta', 'Voir toutes les agences')}
          </Link>
        </div>
        <PxFooterPropertyX />
      </div>
    )
  }

  const agencyData = agency as unknown as AgencyData
  const agents = (data?.agents ?? []) as unknown as AgentMini[]

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.neutral100,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav bg={PX.neutral100} />
      <PxAgencyProfile agency={agencyData} agents={agents} listings={listings ?? []} />
      <PxFooterPropertyX />
    </div>
  )
}
