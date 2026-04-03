import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { COMPLIANCE_FAQ } from '@/lib/helpArticles'
import ComplianceIllustration from '@/components/illustrations/ComplianceIllustration'

export default function HelpCompliancePage() {
  const [openIdx, setOpenIdx] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-8">
          <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">Conformité</span>
        </div>

        <div className="flex items-center gap-5 mb-8">
          <div className="w-20 h-20 shrink-0"><ComplianceIllustration /></div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-900">Conformité et sécurité</h1>
            <p className="text-sm text-gray-500">Questions fréquentes sur la protection des données et la conformité.</p>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
          {COMPLIANCE_FAQ.map((faq, i) => (
            <div key={i}>
              <button
                onClick={() => setOpenIdx(openIdx === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
              >
                <span className="text-sm font-medium text-gray-900 pr-4">{faq.question}</span>
                <ChevronDown className={cn('h-4 w-4 text-gray-400 flex-shrink-0 transition-transform', openIdx === i && 'rotate-180')} />
              </button>
              {openIdx === i && (
                <div className="px-4 pb-4">
                  <p className="text-sm text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
