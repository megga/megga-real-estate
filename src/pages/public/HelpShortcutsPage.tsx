import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'
import { KEYBOARD_SHORTCUTS } from '@/lib/helpArticles'
import KeyboardIllustration from '@/components/illustrations/KeyboardIllustration'

export default function HelpShortcutsPage() {
  const contexts = [...new Set(KEYBOARD_SHORTCUTS.map(s => s.context))]

  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
          <Link to="/help" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">Raccourcis clavier</span>
        </div>

        <div className="flex items-center gap-6 mb-8">
          <div className="w-20 h-20 shrink-0"><KeyboardIllustration /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900 mb-1">Raccourcis clavier</h1>
            <p className="text-sm text-gray-500">Gagnez du temps avec les raccourcis clavier MEGGA.</p>
          </div>
        </div>

        {contexts.map(ctx => (
          <div key={ctx} className="mb-8">
            <h2 className="text-xs font-semibold text-gray-500 capitalize mb-3">{ctx}</h2>
            <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
              {KEYBOARD_SHORTCUTS.filter(s => s.context === ctx).map((shortcut, i) => (
                <div key={i} className="flex items-center justify-between p-3.5">
                  <span className="text-sm text-gray-700">{shortcut.description}</span>
                  <kbd className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-1 rounded border border-gray-200">
                    {shortcut.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
      <Footer />
    </div>
  )
}
