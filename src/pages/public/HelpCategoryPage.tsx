import { useParams, Link } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HelpSearchBar from '@/components/help/HelpSearchBar'
import SupportIllustration from '@/components/illustrations/SupportIllustration'
import HelpChatbot from '@/components/help/HelpChatbot'
import { getArticlesByCategory, getSections, type HelpArticle } from '@/lib/helpArticles'

const CATEGORY_META: Record<string, { label: string; description: string }> = {
  agent: {
    label: 'Guides Agent immobilier',
    description: 'CRM, pipeline, KYC, matching, communication, IA — tout ce dont vous avez besoin.',
  },
  vendeur: {
    label: 'Guides Vendeur',
    description: 'Estimation, mandat, suivi de vente, portail vendeur, analyse march\u00e9.',
  },
  acheteur: {
    label: 'Guides Acheteur',
    description: 'Recherche, visites, financement, comparaison, alertes.',
  },
}

export default function HelpCategoryPage() {
  const { category } = useParams<{ category: string }>()
  const meta = CATEGORY_META[category || '']
  const articles = getArticlesByCategory(category as HelpArticle['category'])
  const sections = getSections(category as HelpArticle['category'])

  if (!meta || articles.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <p className="text-gray-500 text-base">Cat\u00e9gorie introuvable.</p>
          <Link
            to="/aide"
            className="text-sm text-gray-900 underline mt-4 inline-block hover:text-gray-700 transition-colors"
          >
            Retour au centre d'aide
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm mb-8">
          <Link
            to="/aide"
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            Centre d'aide
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-gray-300" />
          <span className="text-gray-700 font-medium">{meta.label}</span>
        </nav>

        {/* Category header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {meta.label}
          </h1>
          <p className="text-base text-gray-500 mb-1">
            {meta.description}
          </p>
          <p className="text-sm text-gray-400">
            {articles.length} article{articles.length > 1 ? 's' : ''}
          </p>
        </div>

        {/* Search bar */}
        <div className="mb-12">
          <HelpSearchBar />
        </div>

        {/* Masonry grid of section cards */}
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {sections.map(section => {
            const sectionArticles = articles.filter(a => a.section === section)
            return (
              <div key={section} className="break-inside-avoid">
                <div className="rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow">
                  {/* Section header */}
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-blue-600">
                      {section}
                    </h2>
                    <div className="h-9 w-9 rounded-full border-2 border-blue-600 flex items-center justify-center flex-shrink-0">
                      <ArrowRight className="h-4 w-4 text-blue-600" />
                    </div>
                  </div>

                  {/* Article links */}
                  <div className="space-y-3">
                    {sectionArticles.map(article => (
                      <Link
                        key={article.slug}
                        to={`/aide/${category}/${article.slug}`}
                        className="block text-sm text-gray-700 hover:text-blue-600 transition-colors leading-relaxed"
                      >
                        {article.title}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Contact CTA — bento with illustration */}
        <div className="mt-16 mb-8 rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col md:flex-row items-stretch">
          <div className="md:w-[55%] bg-[#FFF8F0] flex items-end justify-center p-8 pb-0 min-h-[240px] md:min-h-[280px]">
            <SupportIllustration className="w-full max-w-[360px] h-auto" />
          </div>
          <div className="md:w-[45%] flex flex-col justify-center p-8 md:p-10">
            <h3 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">Contactez-nous</h3>
            <p className="text-[15px] text-gray-500 mb-6 leading-relaxed">
              Posez votre question à notre assistant IA pour une réponse instantanée, ou envoyez un ticket à notre équipe.
            </p>
            <Link
              to="/aide/contact"
              className="h-11 px-8 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center w-fit"
            >
              Contactez-nous
            </Link>
          </div>
        </div>
      </div>

      <div className="fixed bottom-6 right-6 z-50">
        <HelpChatbot />
      </div>

      <Footer />
    </div>
  )
}
