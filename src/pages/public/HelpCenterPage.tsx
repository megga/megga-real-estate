import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HelpSearchBar from '@/components/help/HelpSearchBar'
import { getArticlesByCategory } from '@/lib/helpArticles'
import AgentIllustration from '@/components/illustrations/AgentIllustration'
import SellerIllustration from '@/components/illustrations/SellerIllustration'
import BuyerIllustration from '@/components/illustrations/BuyerIllustration'
import SupportIllustration from '@/components/illustrations/SupportIllustration'

// ── Data ────────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    label: 'Je suis agent immobilier',
    subtitle: 'CRM, pipeline, KYC, matching, IA',
    href: '/aide/agent',
    count: getArticlesByCategory('agent').length,
    Illustration: AgentIllustration,
    border: 'hover:border-blue-200',
  },
  {
    label: 'Je vends mon bien',
    subtitle: 'Estimation, mandat, suivi, portail',
    href: '/aide/vendeur',
    count: getArticlesByCategory('vendeur').length,
    Illustration: SellerIllustration,
    border: 'hover:border-emerald-200',
  },
  {
    label: 'Je cherche un bien',
    subtitle: 'Recherche, visites, accessibilité',
    href: '/aide/acheteur',
    count: getArticlesByCategory('acheteur').length,
    Illustration: BuyerIllustration,
    border: 'hover:border-purple-200',
  },
]

const POPULAR_ARTICLES = [
  { title: 'Comment importer mes contacts dans le CRM ?', slug: 'importer-contacts', category: 'agent', description: '4 méthodes disponibles : CSV/Excel, vCard, texte libre IA, ou saisie manuelle. Compatible Gmail, Outlook, iPhone.' },
  { title: 'Comment fonctionne le calculateur d\'accessibilité ?', slug: 'calculateur', category: 'acheteur', description: 'Règle suisse des 33%, fonds propres 20% minimum, taux de charge 7%. Vérifiez si un bien est dans votre budget.' },
  { title: 'Comment lancer une vérification KYC ?', slug: 'creer-kyc', category: 'agent', description: 'Créer un dossier conformité LAB, checklist auto-générée PP/PM, screening PEP & Sanctions intégré.' },
]

// ── Page ────────────────────────────────────────────────────────────────

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero section ── */}
      <div className="max-w-6xl mx-auto px-6 md:px-10 pt-16 pb-12 text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-gray-900 tracking-tight">
          Comment pouvons-nous vous aider ?
        </h1>
        <p className="text-gray-500 mt-3 text-base max-w-lg mx-auto">
          Explorez les guides par catégorie, ou posez votre question à notre assistant IA.
        </p>

        {/* Search bar */}
        <div className="max-w-2xl mx-auto mt-8">
          <HelpSearchBar />
        </div>

        <p className="text-sm text-gray-400 mt-3">
          Astuce : tapez votre question pour obtenir une réponse guidée.
        </p>
      </div>

      {/* ── 3 Persona cards — Zillow style ── */}
      <div className="max-w-[1600px] mx-auto px-6 md:px-12 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {PERSONAS.map((persona) => (
            <Link
              key={persona.href}
              to={persona.href}
              className={`group relative rounded-2xl border border-gray-200 ${persona.border} hover:shadow-lg transition-all overflow-hidden`}
            >
              {/* Illustration area — tall like Zillow */}
              <div className="h-44 md:h-48 flex items-center justify-center px-10 pt-8">
                <persona.Illustration />
              </div>

              {/* Label + arrow — bottom section */}
              <div className="flex items-end justify-between px-7 pb-6 pt-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 leading-snug">{persona.label}</h2>
                  <p className="text-sm text-gray-400 mt-1">{persona.subtitle}</p>
                </div>
                <div className="h-10 w-10 rounded-full border-2 border-gray-200 group-hover:border-gray-900 group-hover:bg-gray-900 flex items-center justify-center transition-all flex-shrink-0 ml-3">
                  <ArrowRight className="h-4.5 w-4.5 text-gray-400 group-hover:text-white transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* ── Popular Articles — large dark container, cards rounded inside ── */}
      <div className="mx-6 md:mx-12 lg:mx-16 pb-16">
        <div className="bg-gray-900 py-16 md:py-20 px-8 md:px-14 lg:px-20">
          <div className="mb-10">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Articles populaires</h2>
            <p className="text-base text-gray-400 mt-2">Réponses rapides aux questions fréquentes, et guides pas-à-pas.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {POPULAR_ARTICLES.map((article) => (
              <Link
                key={article.slug}
                to={`/aide/${article.category}/${article.slug}`}
                className="bg-white rounded-2xl p-6 hover:shadow-lg transition-all group flex flex-col"
              >
                <h3 className="text-sm font-bold text-gray-900 mb-2 leading-snug">{article.title}</h3>
                <p className="text-xs text-gray-500 leading-relaxed flex-1 line-clamp-3">{article.description}</p>
                <span className="text-xs text-blue-600 font-semibold flex items-center gap-1.5 mt-4 group-hover:gap-2.5 transition-all">
                  Lire l'article <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </div>

          {/* Browse all */}
          <div className="flex justify-center mt-12">
            <Link
              to="/aide/agent"
              className="h-12 px-8 rounded-lg bg-white text-gray-900 text-sm font-semibold hover:bg-gray-100 transition-colors flex items-center gap-2"
            >
              Parcourir tous les guides
            </Link>
          </div>
        </div>
      </div>

      {/* ── Get in touch — Zillow-style card ── */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden flex flex-col md:flex-row items-stretch">
          {/* Illustration side — placeholder for custom illustration */}
          <div className="md:w-[55%] bg-[#FFF8F0] flex items-end justify-center p-8 pb-0 min-h-[280px] md:min-h-[320px]">
            {/* Replace this placeholder with your custom illustration */}
            <SupportIllustration className="w-full max-w-[420px] h-auto" />
          </div>

          {/* Text + CTA side */}
          <div className="md:w-[45%] flex flex-col justify-center p-8 md:p-12">
            <h2 className="text-2xl md:text-[28px] font-bold text-gray-900 mb-3 leading-tight">Contactez-nous</h2>
            <p className="text-[15px] text-gray-500 mb-8 leading-relaxed">
              Posez votre question à notre assistant IA pour une réponse instantanée, ou envoyez un ticket à notre équipe.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/aide/contact"
                className="h-12 px-8 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center justify-center"
              >
                Contactez-nous
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
