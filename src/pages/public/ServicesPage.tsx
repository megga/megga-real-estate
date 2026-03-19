import { Link } from 'react-router-dom'
import {
  Brain,
  Home,
  Search,
  Users,
  Share2,
  Wand2,
  FileText,
  Layout,
  TrendingUp,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { cn } from '@/lib/utils'

const mainServices = [
  {
    icon: Brain,
    title: 'Estimation IA',
    description:
      'Estimez la valeur de votre bien gratuitement grâce à notre algorithme basé sur les données du marché suisse.',
    cta: 'Estimer gratuitement',
    href: '/estimations',
  },
  {
    icon: Home,
    title: 'Vendre mon bien',
    description:
      'Accompagnement complet de la mise en vente jusqu\'à la signature. Visibilité sur tous les portails suisses.',
    cta: 'En savoir plus',
    href: '/vendre',
  },
  {
    icon: Search,
    title: 'Recherche personnalisée',
    description:
      'Notre agent IA vous aide à trouver le bien idéal en Suisse. Décrivez votre recherche en langage naturel.',
    cta: 'Commencer ma recherche',
    href: '/search',
  },
]

const agentServices = [
  {
    icon: Users,
    title: 'CRM gratuit intégré',
    description: 'Gérez vos contacts, pipeline et transactions en un seul endroit',
  },
  {
    icon: Share2,
    title: 'Publication multi-portails',
    description: 'Diffusez vos annonces sur MEGGA, ImmoScout24, Homegate et immobilier.ch',
  },
  {
    icon: Wand2,
    title: 'Virtual staging IA',
    description: 'Meublez virtuellement vos biens vides pour augmenter l\'attractivité',
  },
  {
    icon: FileText,
    title: 'Génération de documents',
    description: 'Mandats, bons de visite, offres générés automatiquement',
  },
  {
    icon: Layout,
    title: 'Portail vendeur',
    description: 'Offrez à vos clients un espace de suivi premium 24/7',
  },
  {
    icon: TrendingUp,
    title: 'Analytics avancés',
    description: 'Taux de conversion, source des leads, benchmark marché',
  },
]

const plans = [
  {
    name: 'Starter',
    price: 'Gratuit',
    period: '',
    features: ['5 listings', 'CRM basique', 'Messagerie'],
    cta: 'Commencer',
    href: '/register',
    popular: false,
  },
  {
    name: 'Pro',
    price: 'CHF 89',
    period: '/mois',
    features: ['Listings illimités', 'CRM complet', 'Virtual staging', 'Assistance IA'],
    cta: 'Essai gratuit 14 jours',
    href: '/register',
    popular: true,
  },
  {
    name: 'Agency',
    price: 'CHF 249',
    period: '/mois',
    features: ['Multi-agents', 'Branding agence', 'API', 'Reporting avancé'],
    cta: 'Nous contacter',
    href: '/register',
    popular: false,
  },
]

export default function ServicesPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Hero */}
      <section className="bg-gradient-to-b from-gray-50 to-white py-16 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-3xl md:text-4xl font-bold text-primary-900">
            Nos services immobiliers
          </h1>
          <p className="text-gray-500 mt-4 max-w-2xl mx-auto">
            Des outils et services premium pour vendre, acheter et gérer votre patrimoine immobilier en Suisse.
          </p>
        </div>
      </section>

      {/* Section 1 — Services principaux */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {mainServices.map((s) => {
              const Icon = s.icon
              return (
                <div
                  key={s.title}
                  className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 hover:shadow-lg transition-all text-center"
                >
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 mb-4">
                    <Icon className="w-6 h-6 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-primary-900 mb-2">{s.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed mb-6">{s.description}</p>
                  <Link to={s.href}>
                    <Button className="rounded-full px-6 h-10 bg-accent hover:bg-accent/90 text-white font-medium">
                      {s.cta}
                    </Button>
                  </Link>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Section 2 — Services agents */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center text-primary-900 mb-12">
            Pour les professionnels de l&apos;immobilier
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {agentServices.map((s) => {
              const Icon = s.icon
              return (
                <div
                  key={s.title}
                  className="bg-white rounded-xl p-6 border border-gray-100"
                >
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 mb-3">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-primary-900 mb-1">{s.title}</h3>
                  <p className="text-sm text-gray-500">{s.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Section 3 — Pricing */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center text-primary-900 mb-12">
            Des tarifs transparents
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={cn(
                  'bg-white rounded-2xl p-8 border text-center relative',
                  plan.popular
                    ? 'border-accent shadow-lg ring-1 ring-accent'
                    : 'border-gray-100 shadow-sm'
                )}
              >
                {plan.popular && (
                  <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-medium px-3 py-1 rounded-full">
                    Populaire
                  </span>
                )}
                <h3 className="text-lg font-semibold text-primary-900">{plan.name}</h3>
                <div className="mt-4">
                  <span className="text-3xl font-bold text-primary-900">{plan.price}</span>
                  {plan.period && (
                    <span className="text-sm text-gray-500">{plan.period}</span>
                  )}
                </div>
                <ul className="mt-6 space-y-3 text-left">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-gray-600">
                      <Check className="h-4 w-4 text-accent shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Link to={plan.href} className="block mt-8">
                  <Button
                    className={cn(
                      'w-full rounded-full h-11 font-medium',
                      plan.popular
                        ? 'bg-accent hover:bg-accent/90 text-white'
                        : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                    )}
                    variant={plan.popular ? 'default' : 'outline'}
                  >
                    {plan.cta}
                  </Button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA final */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-primary-900">
            Vous êtes agent immobilier ?
          </h2>
          <p className="mt-3 text-gray-500">
            Rejoignez MEGGA et accédez gratuitement à tous nos outils.
          </p>
          <Link to="/register" className="inline-block mt-6">
            <Button
              size="lg"
              className="rounded-full px-8 h-12 font-medium bg-accent hover:bg-accent/90 text-white"
            >
              Créer mon compte agent
            </Button>
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  )
}
