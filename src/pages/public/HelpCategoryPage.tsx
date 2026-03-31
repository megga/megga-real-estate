import { useParams, Link } from 'react-router-dom'
import { UserCog, Home, Search, ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { getArticlesByCategory, getSections, type HelpArticle } from '@/lib/helpArticles'

const CATEGORY_META: Record<string, { label: string; description: string; icon: typeof UserCog }> = {
  agent: { label: 'Guides Agent', description: 'Tout ce dont vous avez besoin pour maîtriser le CRM MEGGA.', icon: UserCog },
  vendeur: { label: 'Guides Vendeur', description: 'Suivez la vente de votre bien en toute transparence.', icon: Home },
  acheteur: { label: 'Guides Acheteur', description: 'Trouvez le bien idéal avec les outils MEGGA.', icon: Search },
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
        <div className="max-w-4xl mx-auto px-4 py-20 text-center">
          <p className="text-gray-500">Catégorie introuvable.</p>
          <Link to="/aide" className="text-sm text-gray-900 underline mt-4 inline-block">Retour au centre d'aide</Link>
        </div>
        <Footer />
      </div>
    )
  }

  const Icon = meta.icon

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-4xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-8">
          <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">{meta.label}</span>
        </div>

        {/* Header */}
        <div className="flex items-center gap-3 mb-2">
          <div className="h-10 w-10 rounded-xl bg-gray-100 flex items-center justify-center">
            <Icon className="h-5 w-5 text-gray-600" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">{meta.label}</h1>
            <p className="text-sm text-gray-500">{meta.description}</p>
          </div>
        </div>

        {/* Articles grouped by section */}
        <div className="mt-10 space-y-8">
          {sections.map(section => {
            const sectionArticles = articles.filter(a => a.section === section)
            return (
              <div key={section}>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{section}</h2>
                <div className="space-y-2">
                  {sectionArticles.map(article => (
                    <Link
                      key={article.slug}
                      to={`/aide/${category}/${article.slug}`}
                      className="block rounded-lg border border-gray-100 p-4 hover:border-gray-300 transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900 group-hover:text-gray-700">{article.title}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{article.description}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-gray-500 transition-colors flex-shrink-0" />
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
      <Footer />
    </div>
  )
}
