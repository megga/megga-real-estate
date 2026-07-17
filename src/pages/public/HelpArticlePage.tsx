/**
 * Article du centre d'aide — route `/help/:category/:slug` (public).
 * Récupère l'article depuis `helpArticles`, le rend via un mini-moteur markdown
 * maison, et affiche fil d'Ariane, sommaire (TOC), articles liés et bloc de feedback.
 */
import { useParams, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight } from 'lucide-react'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'
import ArticleFeedback from '@/components/help/ArticleFeedback'
import SupportIllustration from '@/components/illustrations/SupportIllustration'
import { getArticle, getArticlesBySlugs } from '@/lib/helpArticles'

const CATEGORY_LABEL_KEYS: Record<string, string> = {
  agent: 'help.categoryAgent',
  vendeur: 'help.categorySeller',
  acheteur: 'help.categoryBuyer',
}

/** Normalise un titre en slug minuscule (accents latins conservés) pour les ancres du sommaire. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u00e0-\u00ff]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

/**
 * Mini-moteur markdown → JSX (titres, listes, tables, gras/code/liens inline).
 * `dangerouslySetInnerHTML` est sûr ici : le contenu provient de la lib locale
 * `helpArticles`, jamais d'une saisie utilisateur.
 */
function renderMarkdown(content: string) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  let listItems: string[] = []

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc pl-6 space-y-2 mb-5">
          {listItems.map((item, j) => (
            <li key={j} className="text-sm text-gray-700 leading-7" dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      )
      listItems = []
    }
  }

  function inlineFormat(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      .replace(/`(.+?)`/g, '<code class="text-sm bg-gray-100 px-1.5 py-0.5 rounded font-mono text-gray-800">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-blue-600 hover:underline">$1</a>')
  }

  while (i < lines.length) {
    const line = lines[i].trimEnd()

    if (line.startsWith('## ')) {
      flushList()
      const headingText = line.slice(3)
      const headingId = slugify(headingText)
      elements.push(
        <h2 key={i} id={headingId} className="text-xl font-semibold text-gray-900 mt-10 mb-4 scroll-mt-28">
          {headingText}
        </h2>
      )
    } else if (line.startsWith('### ')) {
      flushList()
      elements.push(
        <h3 key={i} className="text-base font-semibold text-gray-900 mt-8 mb-3">
          {line.slice(4)}
        </h3>
      )
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      listItems.push(line.slice(2))
    } else if (line.startsWith('| ')) {
      // Table
      flushList()
      const tableLines: string[] = []
      while (i < lines.length && lines[i].trimEnd().startsWith('|')) {
        tableLines.push(lines[i].trimEnd())
        i++
      }
      i-- // back up one
      const rows = tableLines.filter(l => !l.match(/^\|[\s-|]+\|$/))
      if (rows.length > 0) {
        const header = rows[0].split('|').filter(Boolean).map(c => c.trim())
        const body = rows.slice(1).map(r => r.split('|').filter(Boolean).map(c => c.trim()))
        elements.push(
          <div key={i} className="overflow-x-auto mb-6 mt-3 rounded-lg border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  {header.map((h, j) => (
                    <th key={j} className="text-left px-4 py-3 font-semibold text-gray-900 text-sm">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {body.map((row, j) => (
                  <tr key={j} className="border-b border-gray-100 last:border-0">
                    {row.map((cell, k) => (
                      <td key={k} className="px-4 py-3 text-gray-700" dangerouslySetInnerHTML={{ __html: inlineFormat(cell) }} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      }
    } else if (line === '') {
      flushList()
    } else {
      flushList()
      elements.push(
        <p key={i} className="text-sm text-gray-700 leading-7 mb-4" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      )
    }
    i++
  }
  flushList()
  return elements
}

/** Rend l'article ou l'état introuvable ; calcule le temps de lecture et le sommaire depuis les `##`. */
export default function HelpArticlePage() {
  const { t } = useTranslation('common')
  const { category, slug } = useParams<{ category: string; slug: string }>()
  const article = getArticle(slug || '')

  if (!article) {
    return (
      <div className="min-h-screen bg-white">
        <HomeStickyHeader alwaysShow />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <p className="text-gray-500">{t('help.articleNotFound')}</p>
          <Link to="/help" className="text-sm text-gray-900 underline mt-4 inline-block">
            {t('help.backToHelpCenter')}
          </Link>
        </div>
        <Footer />
      </div>
    )
  }

  const related = getArticlesBySlugs(article.relatedSlugs)
  const readingTime = Math.max(1, Math.ceil(article.content.split(/\s+/).length / 200))

  // Extract ## headings for table of contents
  const headings = article.content
    .split('\n')
    .filter(line => line.startsWith('## '))
    .map(line => ({
      text: line.slice(3),
      id: slugify(line.slice(3)),
    }))

  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />

      <div className="max-w-5xl mx-auto px-6 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-10 flex-wrap">
          <Link to="/help" className="hover:text-gray-600 transition-colors">
            {t('help.helpCenter')}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/help/${category}`} className="hover:text-gray-600 transition-colors">
            {CATEGORY_LABEL_KEYS[category || ''] ? t(CATEGORY_LABEL_KEYS[category || '']) : category}
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-600 truncate max-w-[200px] sm:max-w-none">{article.title}</span>
        </div>

        {/* Content + Sidebar */}
        <div className="flex gap-16">
          {/* Main content */}
          <div className="flex-1 min-w-0">
            {/* Title area */}
            <div className="mb-10">
              <span className="text-xs font-medium text-blue-600 capitalize">
                {article.section}
              </span>
              <h1 className="text-3xl font-bold text-gray-900 mt-2 leading-tight">
                {article.title}
              </h1>
              <p className="text-sm text-gray-500 mt-3">
                {t('help.readingTime', { count: readingTime })}
              </p>
            </div>

            {/* Article body */}
            <article>{renderMarkdown(article.content)}</article>

            {/* Feedback */}
            <div className="mt-14 pt-8 border-t border-gray-100">
              <ArticleFeedback slug={article.slug} />
            </div>
          </div>

          {/* Sidebar — desktop only */}
          <div className="hidden lg:block w-72 flex-shrink-0">
            <div className="sticky top-28">
              {/* Table of Contents */}
              {headings.length > 0 && (
                <div className="mb-8">
                  <h4 className="text-xs font-semibold text-gray-500 capitalize mb-3">
                    {t('help.onThisPage')}
                  </h4>
                  <nav className="space-y-2">
                    {headings.map(h => (
                      <a
                        key={h.id}
                        href={`#${h.id}`}
                        className="block text-sm text-gray-500 hover:text-gray-900 transition-colors"
                      >
                        {h.text}
                      </a>
                    ))}
                  </nav>
                </div>
              )}

              {/* Related articles */}
              {related.length > 0 && (
                <div className="pt-6 border-t border-gray-100">
                  <h4 className="text-xs font-semibold text-gray-500 capitalize mb-3">
                    {t('help.relatedArticles')}
                  </h4>
                  <div className="space-y-3">
                    {related.map(a => (
                      <Link
                        key={a.slug}
                        to={`/help/${a.category}/${a.slug}`}
                        className="block text-sm text-gray-700 hover:text-blue-600 transition-colors"
                      >
                        {a.title}
                      </Link>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Contact CTA — bento with illustration (same as HelpCenterPage) */}
        <div className="mt-16 rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col md:flex-row items-stretch">
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
