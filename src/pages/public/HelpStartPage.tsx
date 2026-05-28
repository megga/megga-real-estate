import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ChevronRight, ArrowRight } from 'lucide-react'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'
import GettingStartedIllustration from '@/components/illustrations/GettingStartedIllustration'

const STEPS = [
  { num: 1, title: 'Configurez votre profil', description: 'Remplissez votre nom, canton, et uploadez votre photo. Configurez les informations de votre agence.', link: '/help/agent/configurer-profil' },
  { num: 2, title: 'Importez vos contacts', description: 'CSV, vCard, ou saisie manuelle. 4 méthodes disponibles pour importer votre base clients.', link: '/help/agent/importer-contacts' },
  { num: 3, title: "Découvrez votre Action Board", description: "MEGGA vous dit quoi faire aujourd'hui : relances, matchs, urgences, suggestions IA.", link: '/help/agent/action-board' },
  { num: 4, title: 'Créez votre premier deal', description: 'Drag & drop dans le pipeline. 14 étapes de "Nouveau lead" à "Signé".', link: '/help/agent/premier-deal' },
  { num: 5, title: 'Lancez votre première vérification KYC', description: 'Conformité LAB en quelques clics. Screening PEP & Sanctions intégré.', link: '/help/agent/creer-kyc' },
]

export default function HelpStartPage() {
  const { t } = useTranslation('common')
  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />
      <div className="max-w-3xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-8">
          <Link to="/help" className="hover:text-gray-600 transition-colors">{t('help.backToHelpCenter')}</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">{t('help.quickStart')}</span>
        </div>

        <div className="mb-10">
          <div className="w-full max-w-xs mx-auto mb-6"><GettingStartedIllustration /></div>
          <h1 className="text-2xl font-semibold text-gray-900 mb-2 text-center">{t('help.quickStartTitle')}</h1>
          <p className="text-sm text-gray-500 text-center">{t('help.quickStartSubtitle')}</p>
        </div>

        <div className="space-y-8">
          {STEPS.map(step => (
            <div key={step.num} className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-900 text-white text-sm font-semibold flex items-center justify-center mt-0.5">
                {step.num}
              </div>
              <div className="flex-1">
                <h2 className="text-base font-medium text-gray-900 mb-1">{step.title}</h2>
                <p className="text-sm text-gray-500 mb-3">{step.description}</p>
                <div className="bg-gray-50 rounded-xl h-48 flex items-center justify-center text-gray-500 text-sm border border-gray-100">
                  {t('help.screenshotComing')}
                </div>
                <Link to={step.link} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-accent mt-2 transition-colors">
                  {t('help.readFullGuide')} <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center rounded-xl border border-gray-200 p-8">
          <p className="text-xl font-semibold text-gray-900 mb-2">{t('help.youAreReady')}</p>
          <p className="text-sm text-gray-500 mb-4">{t('help.needHelp')}</p>
          <div className="flex items-center justify-center gap-3">
            <Link to="/help" className="h-9 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors inline-flex items-center">
              {t('help.browseGuides')}
            </Link>
            <Link to="/help/contact" className="h-9 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors inline-flex items-center">
              {t('help.sendTicket')}
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
