// MEGGA Marketplace — Page publique /contact.
//
// Composition (haut → bas) :
//   <PxNav>                       Nav primaire (logo, liens, lang switcher)
//   <PxContactHero>               Hero noir : H1, form contrôlé (Supabase), reach-us-directly
//   <PxContactOffices>            Section "Nos bureaux" : carte image + adresse + CTA
//   <PxContactFAQs>               Accordéon de 4 FAQs MEGGA
//   <PxFooterPropertyX>           Footer du site
//
// SEO :
//   - useDocumentMeta (hook léger sans react-helmet) :
//       title, description, robots, canonical,
//       Open Graph (8 tags), Twitter card (4 tags),
//       html lang (sync avec i18n)
//   - 3 blocs JSON-LD distincts injectés en parallèle :
//       1. ContactPage  → indique à Google qu'il s'agit d'une page contact
//       2. RealEstateAgent (Organization+ContactPoint+PostalAddress)
//       3. FAQPage      → éligible aux rich snippets "questions/réponses"
//   - hreflang FR/DE/EN/IT + x-default sur FR via <link rel="alternate">
//   - H1 unique, single h1 par page, hiérarchie H2/H3 respectée par les sections
//
// Branchement Supabase :
//   - PxContactHero appelle useCreateContactMessage (insert dans contact_messages
//     + email confirmation visiteur + email notification admin via Resend)
//   - RLS : anon INSERT autorisé si consent_privacy=true (CHECK DB + policy)

import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { PX } from '@/components/propertyx'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import PxContactHero from '@/components/propertyx/sections/PxContactHero'
import PxContactOffices from '@/components/propertyx/sections/PxContactOffices'
import PxContactFAQs from '@/components/propertyx/sections/PxContactFAQs'
import { useDocumentMeta } from '@/hooks/useDocumentMeta'

const SITE_URL  = 'https://megga.ch'
const SITE_NAME = 'MEGGA Real Estate'
const CONTACT_EMAIL = 'contact@megga.ch'
const CONTACT_PHONE = '+41 22 000 00 00' // TODO : remplacer par le numéro réel (utilisé dans le JSON-LD)
const WHATSAPP_PHONE = '+41 22 000 00 00' // TODO : numéro WhatsApp Business réel (placeholder)
const OFFICE_ADDR   = {
  street:  'Rue du Rhône 84',
  city:    'Genève',
  postal:  '1204',
  country: 'CH',
  region:  'GE',
}

// FAQ utilisée à la fois pour l'accordéon visuel et le JSON-LD FAQPage
// (Google attend strictement le même contenu côté UI et microdata pour valider
//  le rich snippet — d'où la source unique ici).
const FAQS = [
  {
    question: 'Sous combien de temps recevrai-je une réponse ?',
    answer:
      'Un membre de l’équipe MEGGA répond personnellement à chaque message sous 24 heures ouvrées. Les demandes urgentes (visite déjà programmée, dossier en cours) sont traitées en priorité.',
  },
  {
    question: 'Puis-je faire estimer mon bien gratuitement ?',
    answer:
      'Oui. L’estimation MEGGA combine une analyse algorithmique (~30 secondes) et la validation d’un agent local sur place, sans aucun engagement. Vous recevez un rapport PDF en moins de 48 heures.',
  },
  {
    question: 'Quels sont vos frais de mandat ?',
    answer:
      'Nos honoraires de mandat exclusif s’élèvent à 3 % HT du prix de vente, intégralement à la charge du vendeur et uniquement dus en cas de transaction signée chez le notaire. Aucun frais caché, aucun frais de retrait.',
  },
  {
    question: 'Comment publier mon bien sur la marketplace MEGGA ?',
    answer:
      'Les particuliers passent par notre page « Publier un bien » : photos, description, prix et coordonnées. La diffusion sur megga.ch est gratuite. Les agences professionnelles bénéficient d’une intégration automatisée via notre CRM.',
  },
]

function ogLocale(lang: string): string {
  switch (lang.slice(0, 2)) {
    case 'de': return 'de_CH'
    case 'en': return 'en_US'
    case 'it': return 'it_CH'
    default:   return 'fr_CH'
  }
}

// Inject hreflang tags pour le multilingue. Ne touche pas le <head> au cycle de
// vie React via useDocumentMeta (qui ne supporte qu'un seul canonical) — on les
// gère séparément avec un effet dédié pour pouvoir avoir N alternates.
function useHreflang(path: string) {
  useEffect(() => {
    const langs: Array<{ code: string; hreflang: string }> = [
      { code: 'fr', hreflang: 'fr-CH' },
      { code: 'de', hreflang: 'de-CH' },
      { code: 'it', hreflang: 'it-CH' },
      { code: 'en', hreflang: 'en' },
    ]
    const tags: HTMLLinkElement[] = []
    for (const { hreflang } of langs) {
      const link = document.createElement('link')
      link.rel = 'alternate'
      link.hreflang = hreflang
      // Sur MEGGA on n'a pas de sous-paths /de/contact pour l'instant : on pointe
      // tout vers la même URL canonique. Google interprète ça comme "même page
      // disponible dans toutes ces langues côté contenu". À reprendre quand on
      // aura des routes localisées (cf. project_refonte_roadmap).
      link.href = `${SITE_URL}${path}`
      document.head.appendChild(link)
      tags.push(link)
    }
    const xDefault = document.createElement('link')
    xDefault.rel = 'alternate'
    xDefault.hreflang = 'x-default'
    xDefault.href = `${SITE_URL}${path}`
    document.head.appendChild(xDefault)
    tags.push(xDefault)
    return () => { for (const t of tags) t.remove() }
  }, [path])
}

export default function ContactPage() {
  const { i18n } = useTranslation()
  const lang = i18n.language || 'fr'
  const canonical = `${SITE_URL}/contact`

  const title = 'Contact — MEGGA Real Estate · Immobilier en Suisse'
  const description =
    'Une question ? Acheter, louer, vendre ou faire estimer un bien en Suisse. L’équipe MEGGA vous répond personnellement sous 24 heures ouvrées. Bureau à Genève, service dans tous les cantons.'

  // JSON-LD #1 — RealEstateAgent (Organization-like, plus précis que LocalBusiness)
  const orgLd = {
    '@context': 'https://schema.org',
    '@type': 'RealEstateAgent',
    '@id': `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/logo.svg`,
    description:
      'Plateforme immobilière suisse compliance-first : recherche, estimation, mandat de vente, KYC LAB intégré.',
    areaServed: { '@type': 'Country', name: 'Switzerland' },
    address: {
      '@type': 'PostalAddress',
      streetAddress: OFFICE_ADDR.street,
      addressLocality: OFFICE_ADDR.city,
      postalCode: OFFICE_ADDR.postal,
      addressRegion: OFFICE_ADDR.region,
      addressCountry: OFFICE_ADDR.country,
    },
    contactPoint: [{
      '@type': 'ContactPoint',
      contactType: 'customer support',
      email: CONTACT_EMAIL,
      telephone: CONTACT_PHONE,
      areaServed: 'CH',
      availableLanguage: ['French', 'German', 'English', 'Italian'],
    }],
  }

  // JSON-LD #2 — ContactPage (page type, attaché à l'org)
  const pageLd = {
    '@context': 'https://schema.org',
    '@type': 'ContactPage',
    '@id': `${canonical}#contactpage`,
    url: canonical,
    name: title,
    description,
    inLanguage: lang.slice(0, 2),
    isPartOf: { '@id': `${SITE_URL}/#organization` },
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE_URL },
        { '@type': 'ListItem', position: 2, name: 'Contact', item: canonical },
      ],
    },
  }

  // JSON-LD #3 — FAQPage (rich snippets)
  const faqLd = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQS.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  }

  // useDocumentMeta ne supporte qu'un seul jsonLd → on combine en @graph (W3C
  // OK et reconnu par Google Rich Results Test).
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [orgLd, pageLd, faqLd],
  }

  useDocumentMeta({
    title,
    htmlLang: lang.slice(0, 2),
    canonical,
    jsonLd,
    meta: [
      { name: 'description', content: description },
      { name: 'robots',      content: 'index, follow' },
      { name: 'keywords',    content: 'contact MEGGA, agence immobilière Genève, estimation gratuite, vendre appartement Suisse, mandat exclusif, marketplace immobilier' },

      // Open Graph
      { property: 'og:title',        content: title },
      { property: 'og:description',  content: description },
      { property: 'og:type',         content: 'website' },
      { property: 'og:url',          content: canonical },
      { property: 'og:locale',       content: ogLocale(lang) },
      { property: 'og:site_name',    content: SITE_NAME },
      { property: 'og:image',        content: `${SITE_URL}/og/contact.jpg` },
      { property: 'og:image:alt',    content: 'MEGGA Real Estate — Contactez notre équipe' },

      // Twitter / X
      { name: 'twitter:card',        content: 'summary_large_image' },
      { name: 'twitter:title',       content: title },
      { name: 'twitter:description', content: description },
      { name: 'twitter:image',       content: `${SITE_URL}/og/contact.jpg` },
    ],
  })

  useHreflang('/contact')

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
      display: 'flex',
      flexDirection: 'column',
    }}>
      <PxNav />

      <main>
        <PxContactHero
          contactEmail={CONTACT_EMAIL}
          whatsapp={{
            phone: WHATSAPP_PHONE,
            message: 'Bonjour MEGGA, je vous contacte au sujet de ',
          }}
          source="contact_page"
          socials={{
            linkedin:  'https://www.linkedin.com/company/megga-real-estate',
            instagram: 'https://www.instagram.com/megga.ch',
          }}
        />

        <PxContactOffices
          office={{
            title: `${OFFICE_ADDR.city}`,
            description:
              'Notre bureau historique au cœur des Eaux-Vives. Estimations, mandats et visites sur rendez-vous, du lundi au samedi.',
            address: `${OFFICE_ADDR.street} — ${OFFICE_ADDR.postal} ${OFFICE_ADDR.city}, Suisse`,
            image: '/images/sections/contact/office-sf.jpg',
            href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${OFFICE_ADDR.street}, ${OFFICE_ADDR.postal} ${OFFICE_ADDR.city}`,
            )}`,
          }}
          ctaLabel="Prendre rendez-vous"
          ctaHref={`mailto:${CONTACT_EMAIL}?subject=Demande de rendez-vous`}
        />

        <PxContactFAQs faqs={FAQS} />
      </main>

      <PxFooterPropertyX />
    </div>
  )
}
