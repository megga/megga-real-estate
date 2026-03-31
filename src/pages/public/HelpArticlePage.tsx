import { useParams, Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import ArticleFeedback from '@/components/help/ArticleFeedback'
import { getArticle, getArticlesBySlugs } from '@/lib/helpArticles'

const CATEGORY_LABELS: Record<string, string> = {
  agent: 'Guides Agent',
  vendeur: 'Guides Vendeur',
  acheteur: 'Guides Acheteur',
}

// Simple markdown-to-JSX renderer
function renderMarkdown(content: string) {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let i = 0
  let listItems: string[] = []

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc pl-5 space-y-1 mb-4">
          {listItems.map((item, j) => (
            <li key={j} className="text-sm text-gray-700 leading-relaxed" dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
          ))}
        </ul>
      )
      listItems = []
    }
  }

  function inlineFormat(text: string): string {
    return text
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/`(.+?)`/g, '<code class="text-xs bg-gray-100 px-1 py-0.5 rounded">$1</code>')
      .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" class="text-accent hover:underline">$1</a>')
  }

  while (i < lines.length) {
    const line = lines[i].trimEnd()

    if (line.startsWith('## ')) {
      flushList()
      elements.push(<h2 key={i} className="text-lg font-semibold text-gray-900 mt-8 mb-3">{line.slice(3)}</h2>)
    } else if (line.startsWith('### ')) {
      flushList()
      elements.push(<h3 key={i} className="text-base font-medium text-gray-900 mt-6 mb-2">{line.slice(4)}</h3>)
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
          <div key={i} className="overflow-x-auto mb-4 mt-2">
            <table className="w-full text-sm border border-gray-200 rounded-lg">
              <thead>
                <tr className="bg-gray-50">
                  {header.map((h, j) => <th key={j} className="text-left px-3 py-2 font-medium text-gray-700 border-b border-gray-200">{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {body.map((row, j) => (
                  <tr key={j} className="border-b border-gray-100 last:border-0">
                    {row.map((cell, k) => <td key={k} className="px-3 py-2 text-gray-600">{cell}</td>)}
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
        <p key={i} className="text-sm text-gray-700 leading-relaxed mb-3" dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />
      )
    }
    i++
  }
  flushList()
  return elements
}

export default function HelpArticlePage() {
  const { category, slug } = useParams<{ category: string; slug: string }>()
  const article = getArticle(slug || '')

  if (!article) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <p className="text-gray-500">Article introuvable.</p>
          <Link to="/aide" className="text-sm text-gray-900 underline mt-4 inline-block">Retour au centre d'aide</Link>
        </div>
        <Footer />
      </div>
    )
  }

  const related = getArticlesBySlugs(article.relatedSlugs)

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-8 flex-wrap">
          <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link to={`/aide/${category}`} className="hover:text-gray-600 transition-colors">{CATEGORY_LABELS[category || ''] || category}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-600">{article.title}</span>
        </div>

        {/* Section badge */}
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">{article.section}</p>

        {/* Article content */}
        <article className="prose-sm">
          {renderMarkdown(article.content)}
        </article>

        {/* Related articles */}
        {related.length > 0 && (
          <div className="mt-12 pt-8 border-t border-gray-100">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Articles liés</h3>
            <div className="space-y-2">
              {related.map(a => (
                <Link
                  key={a.slug}
                  to={`/aide/${a.category}/${a.slug}`}
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-gray-300 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{a.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-gray-300 flex-shrink-0" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Feedback */}
        <div className="mt-10">
          <ArticleFeedback slug={article.slug} />
        </div>
      </div>
      <Footer />
    </div>
  )
}
