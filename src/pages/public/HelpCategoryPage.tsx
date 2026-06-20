import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight, ChevronRight } from 'lucide-react'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'
import HelpSearchBar from '@/components/help/HelpSearchBar'
import SupportIllustration from '@/components/illustrations/SupportIllustration'
import { getArticlesByCategory, getSections, type HelpArticle } from '@/lib/helpArticles'

const CATEGORY_META: Record<string, { labelKey: string; descriptionKey: string }> = {
  agent: {
    labelKey: 'help.categoryAgentLabel',
    descriptionKey: 'help.categoryAgentDescription',
  },
  vendeur: {
    labelKey: 'help.categorySellerLabel',
    descriptionKey: 'help.categorySellerDescription',
  },
  acheteur: {
    labelKey: 'help.categoryBuyerLabel',
    descriptionKey: 'help.categoryBuyerDescription',
  },
}

export default function HelpCategoryPage() {
  const { t } = useTranslation('common')
  const { category } = useParams<{ category: string }>()
  const meta = CATEGORY_META[category || '']
  const articles = getArticlesByCategory(category as HelpArticle['category'])
  const sections = getSections(category as HelpArticle['category'])

  if (!meta || articles.length === 0) {
    return (
      <div className="min-h-screen bg-white">
        <HomeStickyHeader alwaysShow />
        <div className="max-w-4xl mx-auto px-6 py-20 text-center">
          <p className="text-gray-500 text-base">{t('help.categoryNotFound')}</p>
          <Link
            to="/help"
            className="text-sm text-gray-900 underline mt-4 inline-block hover:text-gray-700 transition-colors"
          >
            {t('help.backToHelpCenter')}
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-12">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 text-sm mb-8">
          <Link
            to="/help"
            className="text-gray-500 hover:text-gray-600 transition-colors"
          >
            {t('help.helpCenter')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5 text-gray-500" />
          <span className="text-gray-700 font-medium">{t(meta.labelKey)}</span>
        </nav>

        {/* Category header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t(meta.labelKey)}
          </h1>
          <p className="text-base text-gray-500 mb-1">
            {t(meta.descriptionKey)}
          </p>
          <p className="text-sm text-gray-500">
            {t('help.articleCount', { count: articles.length })}
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
                        to={`/help/${category}/${article.slug}`}
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
            <h3 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">{t('help.contactUs')}</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {t('help.contactSubtitle')}
            </p>
            <Link
              to="/help/contact"
              className="h-11 px-8 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center w-fit"
            >
              {t('help.contactUs')}
            </Link>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
