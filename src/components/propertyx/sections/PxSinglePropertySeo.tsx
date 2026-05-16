// MEGGA Marketplace — Property X "Single Property — SEO meta" component.
//
// Composant invisible : injecte les meta tags dynamiques (title, description,
// Open Graph) + un bloc JSON-LD schema.org pour les rich results Google
// (RealEstateListing). Aucun rendu visuel.
//
// Pourquoi pas react-helmet ? Évite une dépendance pour ~10 tags couverts
// par un hook 60 lignes (voir useDocumentMeta).

import { useTranslation } from 'react-i18next'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'
import { formatCHF, formatRent } from '@/lib/utils'
import type { ListingCardData } from '@/components/listings/ListingCard'

interface Props {
  listing?: ListingCardData
}

const SITE_NAME = 'MEGGA Real Estate'
const SITE_URL = 'https://megga.ch'

// schema.org : maps internal listing type → @type spec
function schemaItemType(type?: string): string {
  switch (type) {
    case 'house':
    case 'villa':
      return 'House'
    case 'apartment':
      return 'Apartment'
    case 'commercial':
    case 'office':
      return 'CommercialBuilding'
    default:
      return 'Residence'
  }
}

// i18n → og:locale code
function ogLocale(lang: string): string {
  switch (lang.slice(0, 2)) {
    case 'de':
      return 'de_CH'
    case 'en':
      return 'en_US'
    case 'it':
      return 'it_CH'
    default:
      return 'fr_CH'
  }
}

export default function PxSinglePropertySeo({ listing }: Props) {
  const { t, i18n } = useTranslation()

  // Mode démo (pas de listing) → on ne touche pas aux meta du site (déjà
  // configurées dans index.html avec une description marketplace générique).
  // Le hook s'appelle de toute façon car React exige un ordre stable, mais
  // avec des valeurs neutres : title undefined = pas de changement.
  const enabled = !!listing

  // Construction du titre SEO : "<Title> — <Ville>, <Canton> | MEGGA"
  const titleParts: string[] = []
  if (listing?.title) titleParts.push(listing.title)
  const locality = [listing?.city, listing?.canton].filter(Boolean).join(', ')
  if (locality) titleParts.push(locality)
  const fullTitle = titleParts.length > 0 ? `${titleParts.join(' — ')} | ${SITE_NAME}` : undefined

  // Description SEO : surface + pièces + prix + ville (≤ 160 chars)
  const descParts: string[] = []
  if (listing?.surface_m2) descParts.push(`${listing.surface_m2} m²`)
  if (listing?.rooms) descParts.push(`${listing.rooms} pièces`)
  if (listing) {
    const priceLabel = listing.context === 'rent'
      ? formatRent(listing.price)
      : formatCHF(listing.price)
    descParts.push(priceLabel)
  }
  if (listing?.city) descParts.push(listing.city)
  const description = descParts.length > 0 ? descParts.join(' · ') : undefined

  // OG image : première photo si dispo, sinon fallback logo
  const ogImage = listing?.photos?.[0]
  const canonical = listing ? `${SITE_URL}/propriete/${listing.id}` : undefined

  // JSON-LD RealEstateListing (Google rich results)
  // Spec : https://schema.org/RealEstateListing + https://schema.org/Apartment
  const jsonLd = listing ? {
    '@context': 'https://schema.org',
    '@type': 'RealEstateListing',
    name: listing.title,
    description: listing.description?.slice(0, 500),
    url: `${SITE_URL}/propriete/${listing.id}`,
    image: listing.photos?.slice(0, 5),
    datePosted: listing.published_at,
    mainEntity: {
      '@type': schemaItemType(listing.type),
      name: listing.title,
      ...(listing.surface_m2 ? {
        floorSize: {
          '@type': 'QuantitativeValue',
          value: listing.surface_m2,
          unitCode: 'MTK', // square metres
        },
      } : {}),
      ...(listing.rooms ? { numberOfRooms: listing.rooms } : {}),
      ...(listing.bedrooms ? { numberOfBedrooms: listing.bedrooms } : {}),
      ...(listing.bathrooms ? { numberOfBathroomsTotal: listing.bathrooms } : {}),
      ...(listing.year_built ? { yearBuilt: listing.year_built } : {}),
      ...((listing.address || listing.city) ? {
        address: {
          '@type': 'PostalAddress',
          ...(listing.address ? { streetAddress: listing.address } : {}),
          ...(listing.city ? { addressLocality: listing.city } : {}),
          ...(listing.canton ? { addressRegion: listing.canton } : {}),
          addressCountry: 'CH',
        },
      } : {}),
      ...((listing.lat != null && listing.lng != null) ? {
        geo: {
          '@type': 'GeoCoordinates',
          latitude: listing.lat,
          longitude: listing.lng,
        },
      } : {}),
    },
    offers: {
      '@type': 'Offer',
      price: listing.price,
      priceCurrency: 'CHF',
      availability: 'https://schema.org/InStock',
      // For rentals, businessFunction is "LeaseOut", for sale "Sell"
      businessFunction: listing.context === 'rent'
        ? 'https://purl.org/goodrelations/v1#LeaseOut'
        : 'https://purl.org/goodrelations/v1#Sell',
      ...(listing.agency_name ? {
        seller: { '@type': 'Organization', name: listing.agency_name },
      } : {}),
    },
  } : null

  useDocumentMeta({
    title: enabled ? fullTitle : undefined,
    htmlLang: enabled ? i18n.language.slice(0, 2) : undefined,
    canonical,
    jsonLd,
    meta: enabled ? [
      ...(description ? [{ name: 'description', content: description }] : []),
      // Re-affirme indexation au cas où une page parente l'a override
      { name: 'robots', content: 'index, follow' },
      // Open Graph
      ...(fullTitle ? [{ property: 'og:title', content: fullTitle }] : []),
      ...(description ? [{ property: 'og:description', content: description }] : []),
      { property: 'og:type', content: 'website' },
      { property: 'og:locale', content: ogLocale(i18n.language) },
      { property: 'og:site_name', content: SITE_NAME },
      ...(canonical ? [{ property: 'og:url', content: canonical }] : []),
      ...(ogImage ? [{ property: 'og:image', content: ogImage }] : []),
      // Twitter / X
      { name: 'twitter:card', content: ogImage ? 'summary_large_image' : 'summary' },
      ...(fullTitle ? [{ name: 'twitter:title', content: fullTitle }] : []),
      ...(description ? [{ name: 'twitter:description', content: description }] : []),
      ...(ogImage ? [{ name: 'twitter:image', content: ogImage }] : []),
    ] : [],
  })

  // Reference t to keep useTranslation subscription stable across rerenders.
  void t
  return null
}
