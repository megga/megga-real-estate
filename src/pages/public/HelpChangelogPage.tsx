import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { CHANGELOG } from '@/lib/helpArticles'
import ChangelogIllustration from '@/components/illustrations/ChangelogIllustration'

function formatDate(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleDateString('fr-CH', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function HelpChangelogPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-8">
          <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">Nouveautés</span>
        </div>

        <div className="flex items-center gap-6 mb-2">
          <div className="w-20 h-20 shrink-0"><ChangelogIllustration /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Nouveautés</h1>
            <p className="text-sm text-gray-500">Les dernières améliorations de MEGGA.</p>
          </div>
        </div>
        <div className="mb-10" />

        <div className="relative pl-6 border-l-2 border-gray-100 space-y-8">
          {CHANGELOG.map((entry, i) => (
            <div key={i} className="relative">
              <div className="absolute -left-[31px] w-4 h-4 rounded-full bg-white border-2 border-gray-300" />
              <p className="text-xs text-gray-400 mb-1">{formatDate(entry.date)}</p>
              <h2 className="text-sm font-semibold text-gray-900 mb-1">{entry.title}</h2>
              <p className="text-sm text-gray-500">{entry.description}</p>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
