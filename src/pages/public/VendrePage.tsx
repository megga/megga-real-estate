import { Link } from 'react-router-dom'
import {
  Home,
  Users,
  TrendingUp,
  Brain,
  Eye,
  BarChart3,
  Layout,
  Shield,
  Wallet,
  Star,
  ArrowRight,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import EstimationForm from '@/components/estimation/EstimationForm'

const steps = [
  {
    number: '01',
    icon: Home,
    title: 'Estimation gratuite',
    description:
      'Recevez une estimation precise de votre bien basee sur l\'IA et les donnees du marche suisse en quelques minutes.',
  },
  {
    number: '02',
    icon: Users,
    title: 'Un agent dedie',
    description:
      'Un agent immobilier certifie vous accompagne de la mise en vente jusqu\'a la signature chez le notaire.',
  },
  {
    number: '03',
    icon: TrendingUp,
    title: 'Vente au meilleur prix',
    description:
      'Votre bien est diffuse sur MEGGA et tous les portails suisses. Visibilite maximale, meilleur prix garanti.',
  },
]

const advantages = [
  {
    icon: Brain,
    title: 'Estimation IA precise',
    description: 'Basee sur les transactions recentes et le registre foncier suisse',
  },
  {
    icon: Eye,
    title: 'Visibilite maximale',
    description: 'Votre bien sur MEGGA + ImmoScout24 + Homegate + immobilier.ch',
  },
  {
    icon: BarChart3,
    title: 'CRM integre',
    description: 'Suivi en temps reel des visites, offres et interesses',
  },
  {
    icon: Layout,
    title: 'Portail vendeur dedie',
    description: 'Accedez a votre espace vendeur 24/7 pour suivre l\'avancement',
  },
  {
    icon: Shield,
    title: 'Conformite LAB/KYC',
    description: 'Dossiers de transaction conformes a la legislation suisse',
  },
  {
    icon: Wallet,
    title: '30-50% moins cher',
    description: 'Commission transparente et competitive vs les portails traditionnels',
  },
]

const testimonials = [
  {
    name: 'Marie R.',
    location: 'Champel',
    text: 'Mon appartement a ete vendu en 3 semaines, au-dessus du prix demande. L\'estimation IA etait tres precise.',
    initials: 'MR',
  },
  {
    name: 'Jean-Marc W.',
    location: 'Cologny',
    text: 'Le portail vendeur m\'a permis de suivre chaque visite en temps reel. Service exceptionnel.',
    initials: 'JW',
  },
  {
    name: 'Sophie & Pierre D.',
    location: 'Carouge',
    text: 'Nous avons economise CHF 12\'000 en commission par rapport a notre ancienne agence.',
    initials: 'SD',
  },
]

function scrollToEstimation(e: React.MouseEvent) {
  e.preventDefault()
  document.getElementById('estimation')?.scrollIntoView({ behavior: 'smooth' })
}

export default function VendrePage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* Section 1 — Hero */}
      <section className="relative min-h-[520px] md:min-h-[600px] flex items-center justify-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              'url(https://images.unsplash.com/photo-1600596542815-ffad4c1539a8?w=1920&q=80)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/70" />

        <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-6 text-center py-20">
          <h1 className="text-4xl md:text-5xl font-bold text-white leading-tight">
            Vendez votre bien au meilleur prix
          </h1>
          <p className="mt-4 text-lg text-white/80 max-w-2xl mx-auto">
            Estimation gratuite, accompagnement personnalise, visibilite maximale sur toute la
            Suisse
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              size="lg"
              className="rounded-full px-8 h-12 text-lg font-medium bg-accent hover:bg-accent/90 text-white"
              onClick={scrollToEstimation}
            >
              Estimer mon bien gratuitement
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Link to="/services">
              <Button
                variant="outline"
                size="lg"
                className="rounded-full px-6 h-12 border-white/50 text-white hover:bg-white/10 bg-transparent"
              >
                Parler a un agent
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Section 2 — Comment ca marche */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center text-primary-900 mb-12">
            Vendez en 3 etapes simples
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((step) => {
              const Icon = step.icon
              return (
                <div
                  key={step.number}
                  className="relative bg-white rounded-xl p-8 text-center shadow-sm border border-gray-100 hover:shadow-card-hover transition-all"
                >
                  <span className="absolute top-6 right-6 text-4xl font-bold text-accent/20 select-none">
                    {step.number}
                  </span>
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-accent/10 mb-5">
                    <Icon className="w-7 h-7 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-primary-900 mb-2">{step.title}</h3>
                  <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Section 2.5 — Formulaire d'estimation */}
      <section id="estimation" className="bg-gray-50 py-16 px-4 md:px-6 lg:px-8">
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

      {/* Section 3 — Avantages */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8 bg-white">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center text-primary-900 mb-12">
            Pourquoi choisir MEGGA ?
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
            {advantages.map((adv) => {
              const Icon = adv.icon
              return (
                <div key={adv.title} className="bg-white rounded-xl p-6 border border-gray-100">
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-accent/10 mb-3">
                    <Icon className="w-5 h-5 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-primary-900 mb-1">{adv.title}</h3>
                  <p className="text-sm text-gray-500">{adv.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Section 4 — Temoignages */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold text-center text-primary-900 mb-12">
            Ils ont vendu avec MEGGA
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
            {testimonials.map((t) => (
              <div
                key={t.name}
                className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm"
              >
                <div className="flex items-center gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className="w-4 h-4 fill-amber-400 text-amber-400"
                    />
                  ))}
                </div>
                <p className="text-sm text-gray-600 italic leading-relaxed mb-5">
                  &laquo;&nbsp;{t.text}&nbsp;&raquo;
                </p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <span className="text-xs font-semibold text-accent">{t.initials}</span>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-primary-900">{t.name}</p>
                    <p className="text-xs text-gray-400">{t.location}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section 5 — CTA final */}
      <section className="py-16 md:py-20 px-4 md:px-6 lg:px-8 bg-[#F9FAFB]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-primary-900">
            Pret a vendre votre bien ?
          </h2>
          <p className="mt-3 text-gray-500">
            Recevez votre estimation gratuite en 2 minutes
          </p>
          <Button
            size="lg"
            className="rounded-full px-8 h-12 font-medium bg-accent hover:bg-accent/90 text-white mt-6"
            onClick={scrollToEstimation}
          >
            Estimer mon bien
          </Button>
          <p className="mt-4 text-xs text-gray-400">
            Sans engagement · Gratuit · Resultat instantane
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
