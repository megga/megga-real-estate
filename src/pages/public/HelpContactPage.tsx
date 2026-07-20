// Contacter le support — route /help/contact.
// Le ticketing maison est remplacé par Intercom (Messenger + Fin + Inbox).
// Cette page invite à ouvrir le Messenger ; fallback /contact (Resend) tant que
// l'App ID Intercom n'est pas configuré.
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { MessageSquare } from 'lucide-react'
import { ArrowRight } from '@/components/icons'
import HomeStickyHeader from '@/components/home/HomeStickyHeader'
import Footer from '@/components/layout/Footer'
import AgentIllustration from '@/components/illustrations/AgentIllustration'
import { showIntercom, isIntercomEnabled } from '@/lib/intercom'

export default function HelpContactPage() {
  const { t } = useTranslation('common')
  const intercomReady = isIntercomEnabled()

  const ctaClass =
    'h-11 px-6 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors inline-flex items-center gap-2'

  return (
    <div className="min-h-screen bg-white">
      <HomeStickyHeader alwaysShow />
      <div className="max-w-xl mx-auto px-4 py-16 text-center">
        <div className="w-full max-w-[260px] mx-auto mb-8">
          <AgentIllustration className="w-full h-full" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900 mb-3">{t('help.contactSupport')}</h1>
        <p className="text-base text-gray-500 mb-8">{t('help.contactSupportDesc')}</p>

        {intercomReady ? (
          <button type="button" onClick={() => showIntercom()} className={ctaClass}>
            <MessageSquare className="h-4 w-4" />
            {t('help.contactUs')}
          </button>
        ) : (
          // Fallback si Intercom est coupé : page contact de la vitrine (ContactPage
          // interne supprimée au pivot CRM-first).
          <a href="https://megga.ch/contact" className={ctaClass}>
            <MessageSquare className="h-4 w-4" />
            {t('help.contactUs')}
          </a>
        )}

        <div className="mt-6">
          <Link
            to="/help"
            className="text-sm text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center gap-1"
          >
            {t('help.backToHelpCenter')} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
      <Footer />
    </div>
  )
}
