import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, ChevronLeft, ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import HelpChatbot from '@/components/help/HelpChatbot'
import { supabase } from '@/lib/supabase'
import { getArticle } from '@/lib/helpArticles'
import Footer from '@/components/layout/Footer'
import HelpSearchBar from '@/components/help/HelpSearchBar'
import { getArticlesByCategory } from '@/lib/helpArticles'
import AgentIllustration from '@/components/illustrations/AgentIllustration'
import SellerIllustration from '@/components/illustrations/SellerIllustration'
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
    Illustration: null,
    illustrationSrc: '/illustration-looking.svg',
    border: 'hover:border-purple-200',
  },
]

const FALLBACK_ARTICLES = [
  { title: 'Comment importer mes contacts dans le CRM ?', slug: 'importer-contacts', category: 'agent', description: '4 méthodes disponibles : CSV/Excel, vCard, texte libre IA, ou saisie manuelle.' },
  { title: 'Comment fonctionne le calculateur d\'accessibilité ?', slug: 'calculateur', category: 'acheteur', description: 'Règle suisse des 33%, fonds propres 20% minimum, taux de charge 7%.' },
  { title: 'Comment lancer une vérification KYC ?', slug: 'creer-kyc', category: 'agent', description: 'Créer un dossier conformité LAB, checklist auto-générée PP/PM.' },
  { title: 'Créer votre premier bien en 3 minutes', slug: 'premier-bien-3min', category: 'agent', description: 'Guide pas-à-pas pour créer et publier un bien immobilier.' },
  { title: 'Les étapes d\'une vente en Suisse', slug: 'processus-vente-suisse', category: 'vendeur', description: 'De l\'estimation au notaire : 8 étapes clés de la vente.' },
  { title: 'Financer votre achat en Suisse', slug: 'financer-achat-suisse', category: 'acheteur', description: 'Fonds propres, hypothèque, taux d\'intérêt, amortissement.' },
]

// ── Popular Articles Carousel ──────────────────────────────────────────

function PopularArticlesCarousel() {
  const [page, setPage] = useState(0)
  const [articles, setArticles] = useState(FALLBACK_ARTICLES)

  // Load dynamic popular articles from Supabase
  useEffect(() => {
    supabase.rpc('get_popular_articles', { limit_count: 6 }).then(({ data }) => {
      if (data && data.length >= 3) {
        const dynamic = data
          .map((row: { article_slug: string }) => {
            const article = getArticle(row.article_slug)
            if (!article) return null
            return { title: article.title, slug: article.slug, category: article.category, description: article.description }
          })
          .filter(Boolean) as typeof FALLBACK_ARTICLES
        if (dynamic.length >= 3) setArticles(dynamic)
      }
    })
  }, [])

  const perPage = 3
  const totalPages = Math.ceil(articles.length / perPage)
  const visible = articles.slice(page * perPage, page * perPage + perPage)

  return (
    <div className="mx-6 md:mx-12 lg:mx-16 pb-16">
      <div className="bg-gray-900 py-16 md:py-20 px-8 md:px-14 lg:px-20">
        {/* Header + arrows */}
        <div className="flex items-end justify-between mb-10">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold text-white">Articles populaires</h2>
            <p className="text-base text-gray-400 mt-2">Réponses rapides aux questions fréquentes.</p>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="h-10 w-10 rounded-full border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                className="h-10 w-10 rounded-full border border-gray-600 flex items-center justify-center text-gray-400 hover:text-white hover:border-white transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>
          )}
        </div>

        {/* Square cards */}
        <div className="flex flex-wrap justify-center gap-5">
          {visible.map((article) => (
            <Link
              key={article.slug}
              to={`/aide/${article.category}/${article.slug}`}
              className="bg-white rounded-2xl p-7 hover:shadow-lg transition-all group flex flex-col w-[320px] h-[280px] flex-shrink-0"
            >
              {/* Category dot */}
              <span className={`w-2.5 h-2.5 rounded-full mb-4 ${
                article.category === 'agent' ? 'bg-blue-500' :
                article.category === 'vendeur' ? 'bg-emerald-500' : 'bg-purple-500'
              }`} />

              <h3 className="text-sm font-bold text-gray-900 leading-snug mb-2 flex-1">
                {article.title}
              </h3>

              <p className="text-xs text-gray-500 leading-relaxed mb-4 line-clamp-2">
                {article.description}
              </p>

              <span className="text-xs text-blue-600 font-semibold flex items-center gap-1.5 group-hover:gap-2.5 transition-all mt-auto">
                Lire l'article <ArrowRight className="h-3.5 w-3.5" />
              </span>
            </Link>
          ))}
        </div>

        {/* Page dots */}
        {totalPages > 1 && (
          <div className="flex justify-center gap-2 mt-8">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setPage(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === page ? 'w-6 bg-white' : 'w-1.5 bg-gray-600 hover:bg-gray-400'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ── Page ────────────────────────────────────────────────────────────────

export default function HelpCenterPage() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />

      {/* ── Hero section ── */}
      <div className="max-w-4xl mx-auto px-6 md:px-10 pt-20 md:pt-28 pb-16 md:pb-20 text-center">
        <h1 className="text-4xl md:text-[56px] font-bold text-gray-900 tracking-tight leading-[1.1]">
          Comment pouvons-nous
          <br />
          <span className="text-blue-600">vous aider</span> ?
        </h1>

        <p className="text-gray-500 mt-5 text-lg max-w-md mx-auto leading-relaxed">
          Guides, tutoriels et réponses rapides pour tirer le meilleur de MEGGA.
        </p>

        {/* Search bar */}
        <div className="max-w-xl mx-auto mt-10">
          <div className="rounded-2xl shadow-lg shadow-gray-200/60 ring-1 ring-gray-200/50">
            <HelpSearchBar />
          </div>
        </div>

        {/* Quick links */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
          <span className="text-xs text-gray-400">Populaires :</span>
          {['Importer contacts', 'KYC', 'Matching', 'Calendrier'].map(tag => (
            <span key={tag} className="text-xs text-gray-500 px-3 py-1 rounded-full border border-gray-200 hover:border-gray-300 hover:text-gray-700 cursor-pointer transition-colors">
              {tag}
            </span>
          ))}
        </div>
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
              {/* Illustration area — large */}
              <div className="h-64 md:h-72 flex items-center justify-center px-4 pt-4">
                {persona.Illustration ? <persona.Illustration className="w-full h-full max-h-60" /> : persona.illustrationSrc ? <img src={persona.illustrationSrc} alt="" className="h-full w-auto max-h-60 object-contain" /> : null}
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

      {/* ── Popular Articles — carousel with square cards ── */}
      <PopularArticlesCarousel />

      {/* ── Browse all ── */}
      <div className="flex justify-center pb-16">
        <Link
          to="/aide/ressources"
          className="h-12 px-8 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          Parcourir tous les guides <ArrowRight className="h-4 w-4" />
        </Link>
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

      {/* ── Floating Chatbot ── */}
      <div className="fixed bottom-6 right-6 z-50">
        <HelpChatbot />
      </div>

      <Footer />
    </div>
  )
}
