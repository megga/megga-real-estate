import { useState } from 'react'
import { Database, BarChart3, Brain, RefreshCw, ChevronDown } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import EstimationForm from '@/components/estimation/EstimationForm'
import { cn } from '@/lib/utils'

const howItWorks = [
  {
    icon: Database,
    title: 'Donnees du marche',
    description: 'Analyse des prix de vente reels dans votre quartier',
  },
  {
    icon: BarChart3,
    title: '47\'000+ transactions',
    description: 'Base de donnees suisse des transactions immobilieres',
  },
  {
    icon: Brain,
    title: 'IA predictive',
    description: 'Algorithme entraine sur les specificites du marche suisse',
  },
  {
    icon: RefreshCw,
    title: 'Mise a jour mensuelle',
    description: 'Donnees actualisees chaque mois pour plus de precision',
  },
]

const faqs = [
  {
    question: 'Comment est calculee l\'estimation ?',
    answer:
      'Notre algorithme analyse les transactions recentes dans votre quartier, la surface, le nombre de pieces, l\'annee de construction et l\'etat du bien pour generer une fourchette de prix.',
  },
  {
    question: 'L\'estimation est-elle fiable ?',
    answer:
      'L\'estimation donne une fourchette indicative basee sur les donnees du marche. Pour une evaluation precise, nous recommandons de faire appel a un agent certifie.',
  },
  {
    question: 'Combien coute une estimation ?',
    answer: 'L\'estimation en ligne est 100% gratuite et sans engagement.',
  },
  {
    question: 'Puis-je estimer un bien commercial ?',
    answer:
      'Oui, notre outil couvre les appartements, maisons, villas, terrains et locaux commerciaux.',
  },
  {
    question: 'Comment obtenir une estimation plus precise ?',
    answer:
      'Contactez un agent MEGGA pour une analyse approfondie incluant une visite du bien et une etude comparative detaillee.',
  },
]

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full py-4 text-left"
      >
        <span className="text-sm font-medium text-primary-900">{question}</span>
        <ChevronDown
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform shrink-0 ml-4',
            open && 'rotate-180'
          )}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm text-gray-500 leading-relaxed">{answer}</p>
      )}
    </div>
  )
}

export default function EstimationsPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-primary-900">
            Estimez votre bien immobilier
          </h1>
          <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
            Notre outil d&apos;estimation IA analyse les transactions recentes et les donnees du marche suisse pour vous donner une fourchette de prix precise.
          </p>
        </div>
      </section>

      {/* Formulaire */}
      <section className="bg-gray-50 py-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl font-semibold text-center text-primary-900">
            Estimez votre bien gratuitement
          </h2>
          <p className="text-gray-500 text-center mt-2 mb-8">
            Resultat instantane base sur les donnees du marche suisse
          </p>
          <EstimationForm />
        </div>
      </section>

      {/* Comment ca marche */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center text-primary-900 mb-12">
            Comment fonctionne notre estimation
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {howItWorks.map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.title}
                  className="bg-white rounded-xl p-6 border border-gray-100 text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-sm font-semibold text-primary-900 mb-1">{item.title}</h3>
                  <p className="text-sm text-gray-500">{item.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center text-primary-900 mb-10">
            Questions frequentes
          </h2>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6">
            {faqs.map((faq) => (
              <FaqItem key={faq.question} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>
      </section>

      <Footer />
    </div>
  )
}
