import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HelpSearchBar from '@/components/help/HelpSearchBar'
import SupportIllustration from '@/components/illustrations/SupportIllustration'
import HelpChatbot from '@/components/help/HelpChatbot'
import { ALL_ARTICLES } from '@/lib/helpArticles'

// ── Build section map across ALL categories ─────────────────────────────

interface SectionGroup {
  category: 'agent' | 'vendeur' | 'acheteur'
  section: string
  articles: { slug: string; title: string; category: string }[]
}

function buildSectionGroups(): SectionGroup[] {
  const map = new Map<string, SectionGroup>()

  for (const article of ALL_ARTICLES) {
    const key = `${article.category}::${article.section}`
    if (!map.has(key)) {
      map.set(key, {
        category: article.category,
        section: article.section,
        articles: [],
      })
    }
    map.get(key)!.articles.push({
      slug: article.slug,
      title: article.title,
      category: article.category,
    })
  }

  return [...map.values()]
}

const CATEGORY_LABELS: Record<string, string> = {
  agent: 'Agent',
  vendeur: 'Vendeur',
  acheteur: 'Acheteur',
}

// ── Page ────────────────────────────────────────────────────────────────

export default function HelpResourcesPage() {
  const { t } = useTranslation('common')
  const groups = buildSectionGroups()

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Header ── */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
          {t('help.resources')}
        </h1>
        <p className="text-gray-500 mt-3 text-base max-w-lg mx-auto">
          {t('help.resourcesSubtitle')}
        </p>

        {/* Search */}
        <div className="max-w-2xl mx-auto mt-8">
          <HelpSearchBar />
        </div>

        <p className="text-sm text-gray-500 mt-3">
          {t('help.articlesAvailable', { count: ALL_ARTICLES.length })}
        </p>
      </div>

      {/* ── Masonry grid — Zillow style ── */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 pb-20">
        <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
          {groups.map((group) => (
            <div
              key={`${group.category}::${group.section}`}
              className="break-inside-avoid rounded-xl border border-gray-200 p-6 hover:shadow-md transition-shadow"
            >
              {/* Section header — blue title + arrow */}
              <div className="flex items-center justify-between mb-1">
                <Link
                  to={`/aide/${group.category}`}
                  className="text-lg font-bold text-blue-600 hover:text-blue-700 transition-colors leading-snug"
                >
                  {group.section}
                </Link>
                <Link
                  to={`/aide/${group.category}`}
                  className="h-9 w-9 rounded-full border-2 border-blue-600 flex items-center justify-center flex-shrink-0 hover:bg-blue-600 hover:text-white transition-colors group"
                >
                  <ArrowRight className="h-4 w-4 text-blue-600 group-hover:text-white transition-colors" />
                </Link>
              </div>

              {/* Category badge */}
              <span className="text-xs font-medium text-gray-500 capitalize">
                {CATEGORY_LABELS[group.category]}
              </span>

              {/* Article links */}
              <div className="mt-4 space-y-3">
                {group.articles.map((article) => (
                  <Link
                    key={article.slug}
                    to={`/aide/${article.category}/${article.slug}`}
                    className="block text-sm text-gray-700 hover:text-blue-600 transition-colors leading-relaxed"
                  >
                    {article.title}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CTA Contact ── */}
      {/* Contact CTA — bento with illustration */}
      <div className="max-w-5xl mx-auto px-6 mb-16">
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col md:flex-row items-stretch">
          <div className="md:w-[55%] bg-[#FFF8F0] flex items-end justify-center p-8 pb-0 min-h-[240px] md:min-h-[280px]">
            <SupportIllustration className="w-full max-w-[360px] h-auto" />
          </div>
          <div className="md:w-[45%] flex flex-col justify-center p-8 md:p-10">
            <h3 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">{t('help.contactUs')}</h3>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              {t('help.contactSubtitle')}
            </p>
            <Link
              to="/aide/contact"
              className="h-11 px-8 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center w-fit"
            >
              {t('help.contactUs')}
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
