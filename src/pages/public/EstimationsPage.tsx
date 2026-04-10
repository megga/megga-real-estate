import { useState } from 'react'
import {
  Sparkles,
  Database,
  Shield,
  Clock,
  BarChart3,
  Brain,
  RefreshCw,
  ChevronDown,
  ArrowRight,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTranslation } from 'react-i18next'
import { usePageMeta } from '@/hooks/usePageMeta'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import EstimationForm from '@/components/estimation/EstimationForm'

const HOW_IT_WORKS_ICONS = [Database, BarChart3, Brain, RefreshCw]

const PRICE_DATA = [
  { canton: 'Genève', apt: "13'200", house: "13'100", trend: '+3.1%' },
  { canton: 'Vaud', apt: "9'150", house: "8'670", trend: '+2.8%' },
  { canton: 'Valais', apt: "5'800", house: "5'200", trend: '+1.9%' },
  { canton: 'Fribourg', apt: "6'400", house: "5'900", trend: '+2.2%' },
  { canton: 'Neuchâtel', apt: "5'100", house: "4'800", trend: '+1.5%' },
  { canton: 'Zurich', apt: "12'500", house: "11'800", trend: '+3.5%' },
  { canton: 'Berne', apt: "7'200", house: "6'500", trend: '+2.0%' },
  { canton: 'Bâle-Ville', apt: "8'900", house: "8'200", trend: '+2.4%' },
  { canton: 'Lucerne', apt: "8'100", house: "7'400", trend: '+2.6%' },
  { canton: 'Tessin', apt: "6'800", house: "6'300", trend: '+1.2%' },
]

const FAQ_COUNT = 7

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-gray-100 py-4">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-left cursor-pointer"
      >
        <span className="text-base font-medium text-primary pr-4">{q}</span>
        <ChevronDown
          className={cn('w-5 h-5 text-gray-500 flex-shrink-0 transition-transform', open && 'rotate-180')}
        />
      </button>
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          open ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
        )}
      >
        <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
      </div>
    </div>
  )
}

export default function EstimationsPage() {
  const { t } = useTranslation('common')
  usePageMeta({
    title: 'Estimation immobilière gratuite en Suisse',
    description:
      "Estimez la valeur de votre bien immobilier gratuitement en 2 minutes. Analyse IA basée sur 47'000+ transactions suisses. Appartement, maison, villa — tous les cantons.",
  })

  const maxTrend = 3.5

  function scrollToForm() {
    const el = document.getElementById('estimation-form')
    el?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Section 1 — Hero */}
      <section className="bg-gradient-to-b from-blue-50/50 to-white py-16 md:py-20">
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 text-center">
          <span className="bg-accent/10 text-accent text-xs font-medium px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            {t('estimations.hero.badge')}
          </span>
          <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary mt-4">
            {t('estimations.hero.title')}
          </h1>
          <p className="text-gray-500 text-lg max-w-2xl mx-auto mt-4">
            {t('estimations.hero.subtitle')}
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 mt-8">
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Database className="w-5 h-5 text-accent" />
              {t('estimations.hero.transactions')}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Shield className="w-5 h-5 text-success" />
              {t('estimations.hero.free')}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Clock className="w-5 h-5 text-accent" />
              {t('estimations.hero.result')}
            </div>
          </div>
        </div>
      </section>

      {/* Section 2 — Formulaire */}
      <section id="estimation-form" className="pb-16 md:pb-20">
        <EstimationForm />
      </section>

      {/* Section 3 — Comment ça fonctionne */}
      <section className="bg-white py-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-primary">
            {t('estimations.howItWorks.title')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-10">
            {HOW_IT_WORKS_ICONS.map((Icon, i) => (
                <div key={i} className="bg-gray-50 rounded-xl p-6 text-center">
                  <div className="bg-accent/10 rounded-full p-3 mx-auto mb-4 w-fit">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-base font-semibold text-primary mb-2">{t(`estimations.howItWorks.${i}.title`)}</h3>
                  <p className="text-sm text-gray-500">{t(`estimations.howItWorks.${i}.description`)}</p>
                </div>
              ))}
          </div>
        </div>
      </section>

      {/* Section 4 — Prix au m² par canton */}
      <section className="bg-gray-50 py-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-primary">{t('estimations.priceTable.title')}</h2>
          <p className="text-gray-500 text-sm text-center mt-1">{t('estimations.priceTable.updated')}</p>

          <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden mt-8">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="text-left px-4 py-3 text-xs font-semibold capitalize text-gray-600">
                      {t('estimations.priceTable.canton')}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold capitalize text-gray-600">
                      {t('estimations.priceTable.apartment')}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold capitalize text-gray-600">
                      {t('estimations.priceTable.house')}
                    </th>
                    <th className="text-right px-4 py-3 text-xs font-semibold capitalize text-gray-600">
                      {t('estimations.priceTable.trend')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {PRICE_DATA.map((row, i) => {
                    const trendVal = parseFloat(row.trend)
                    const barWidth = (trendVal / maxTrend) * 100
                    return (
                      <tr key={row.canton} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                        <td className="px-4 py-3 font-medium text-primary">{row.canton}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{row.apt}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{row.house}</td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <div className="w-16 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-success rounded-full"
                                style={{ width: `${barWidth}%` }}
                              />
                            </div>
                            <span className="text-success font-medium whitespace-nowrap flex items-center gap-0.5">
                              {row.trend}
                              <TrendingUp className="w-3 h-3" />
                            </span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <p className="text-center mt-4">
            <button className="text-accent text-sm font-medium hover:underline">
              {t('estimations.priceTable.seeAll')} &rarr;
            </button>
          </p>
        </div>
      </section>

      {/* Section 5 — FAQ */}
      <section className="bg-white py-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-primary">{t('estimations.faq.title')}</h2>
          <div className="max-w-3xl mx-auto mt-10">
            {Array.from({ length: FAQ_COUNT }).map((_, i) => (
              <FaqItem key={i} q={t(`estimations.faq.${i}.q`)} a={t(`estimations.faq.${i}.a`)} />
            ))}
          </div>
        </div>
      </section>

      {/* Section 6 — CTA final */}
      <section className="px-4 lg:px-8 mb-16">
        <div className="bg-primary text-white py-16 rounded-3xl max-w-7xl mx-auto">
          <div className="text-center px-4">
            <h2 className="text-2xl md:text-3xl font-bold">{t('estimations.cta.title')}</h2>
            <p className="text-white/70 mt-2">
              {t('estimations.cta.subtitle')}
            </p>
            <Button
              onClick={scrollToForm}
              variant="secondary"
              className="mt-6 rounded-full px-8 h-12 font-medium bg-white text-primary hover:bg-gray-100"
            >
              {t('estimations.cta.button')} <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
            <p className="text-white/40 text-xs mt-3">{t('estimations.cta.footer')}</p>
          </div>
        </div>
      </section>

      {/* Section 7 — Footer */}
      <Footer />
    </div>
  )
}
