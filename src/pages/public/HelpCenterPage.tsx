import { Link } from 'react-router-dom'
import { ArrowRight, ChevronRight } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import HelpSearchBar from '@/components/help/HelpSearchBar'
import HelpChatbot from '@/components/help/HelpChatbot'
import { getArticlesByCategory } from '@/lib/helpArticles'

// ── Illustrations SVG for persona cards ─────────────────────────────────

function AgentIllustration() {
  return (
    <svg viewBox="0 0 160 120" fill="none" className="w-full h-full">
      {/* Desk */}
      <rect x="30" y="70" width="100" height="6" rx="3" fill="#E5E7EB" />
      {/* Monitor */}
      <rect x="55" y="35" width="50" height="35" rx="4" fill="#1F2937" />
      <rect x="59" y="39" width="42" height="27" rx="2" fill="#3B82F6" opacity="0.15" />
      {/* Chart bars on screen */}
      <rect x="65" y="52" width="6" height="14" rx="1" fill="#3B82F6" opacity="0.6" />
      <rect x="74" y="46" width="6" height="20" rx="1" fill="#3B82F6" opacity="0.8" />
      <rect x="83" y="49" width="6" height="17" rx="1" fill="#3B82F6" opacity="0.5" />
      {/* Monitor stand */}
      <rect x="76" y="70" width="8" height="6" fill="#D1D5DB" />
      {/* Person */}
      <circle cx="42" cy="42" r="12" fill="#DBEAFE" />
      <circle cx="42" cy="38" r="5" fill="#1F2937" />
      <path d="M32 58 C32 50 52 50 52 58" fill="#1F2937" />
      {/* Document */}
      <rect x="110" y="45" width="20" height="25" rx="2" fill="#DBEAFE" />
      <rect x="114" y="50" width="12" height="2" rx="1" fill="#93C5FD" />
      <rect x="114" y="55" width="8" height="2" rx="1" fill="#93C5FD" />
      <rect x="114" y="60" width="10" height="2" rx="1" fill="#93C5FD" />
    </svg>
  )
}

function SellerIllustration() {
  return (
    <svg viewBox="0 0 160 120" fill="none" className="w-full h-full">
      {/* House */}
      <path d="M80 20 L40 55 H120 Z" fill="#D1FAE5" />
      <rect x="50" y="55" width="60" height="40" fill="#ECFDF5" />
      <rect x="50" y="55" width="60" height="40" stroke="#6EE7B7" strokeWidth="1.5" fill="none" />
      {/* Door */}
      <rect x="72" y="70" width="16" height="25" rx="2" fill="#059669" opacity="0.3" />
      <circle cx="85" cy="83" r="1.5" fill="#059669" />
      {/* Windows */}
      <rect x="55" y="62" width="12" height="10" rx="1.5" fill="#A7F3D0" />
      <rect x="93" y="62" width="12" height="10" rx="1.5" fill="#A7F3D0" />
      {/* Heart / love */}
      <path d="M125 30 C125 25 132 25 132 30 C132 25 139 25 139 30 C139 38 132 42 132 42 C132 42 125 38 125 30Z" fill="#F9A8D4" opacity="0.6" />
      {/* Price tag */}
      <rect x="15" y="50" width="22" height="14" rx="3" fill="#059669" opacity="0.15" />
      <text x="26" y="60" textAnchor="middle" fontSize="7" fill="#059669" fontWeight="600">CHF</text>
    </svg>
  )
}

function BuyerIllustration() {
  return (
    <svg viewBox="0 0 160 120" fill="none" className="w-full h-full">
      {/* Map / search area */}
      <rect x="25" y="25" width="110" height="70" rx="8" fill="#F3E8FF" opacity="0.5" />
      {/* Map pins */}
      <g>
        <circle cx="55" cy="50" r="6" fill="#7C3AED" opacity="0.3" />
        <circle cx="55" cy="50" r="3" fill="#7C3AED" />
      </g>
      <g>
        <circle cx="90" cy="40" r="6" fill="#7C3AED" opacity="0.3" />
        <circle cx="90" cy="40" r="3" fill="#7C3AED" />
      </g>
      <g>
        <circle cx="110" cy="65" r="6" fill="#7C3AED" opacity="0.3" />
        <circle cx="110" cy="65" r="3" fill="#7C3AED" />
      </g>
      {/* Magnifying glass */}
      <circle cx="70" cy="60" r="15" stroke="#7C3AED" strokeWidth="2.5" fill="none" opacity="0.4" />
      <line x1="81" y1="71" x2="92" y2="82" stroke="#7C3AED" strokeWidth="3" strokeLinecap="round" opacity="0.4" />
      {/* Small house icons */}
      <rect x="50" y="46" width="10" height="7" rx="1" fill="#C4B5FD" />
      <path d="M49 46 L55 41 L61 46" fill="#C4B5FD" />
      <rect x="85" y="36" width="10" height="7" rx="1" fill="#C4B5FD" />
      <path d="M84 36 L90 31 L96 36" fill="#C4B5FD" />
    </svg>
  )
}

// ── Data ────────────────────────────────────────────────────────────────

const PERSONAS = [
  {
    label: 'Agent immobilier',
    href: '/aide/agent',
    count: getArticlesByCategory('agent').length,
    Illustration: AgentIllustration,
    border: 'hover:border-blue-200',
  },
  {
    label: 'Vendeur, Propriétaire',
    href: '/aide/vendeur',
    count: getArticlesByCategory('vendeur').length,
    Illustration: SellerIllustration,
    border: 'hover:border-emerald-200',
  },
  {
    label: 'Acheteur, Recherche de bien',
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
      <div className="max-w-6xl mx-auto px-6 md:px-10 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
                  <h2 className="text-lg font-bold text-gray-900 leading-snug">{persona.label}</h2>
                  <p className="text-sm text-gray-400 mt-1">{persona.count} guides</p>
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

      {/* ── Get in touch — illustration + CTA (like Zillow) ── */}
      <div className="max-w-5xl mx-auto px-4 py-16">
        <div className="rounded-2xl bg-gray-50 overflow-hidden flex flex-col md:flex-row items-center">
          {/* Illustration side */}
          <div className="md:w-1/2 p-8 flex items-center justify-center">
            <svg viewBox="0 0 300 220" fill="none" className="w-full max-w-[280px]">
              {/* Background shapes */}
              <circle cx="150" cy="110" r="90" fill="#DBEAFE" opacity="0.3" />
              {/* Desk */}
              <rect x="60" y="140" width="180" height="8" rx="4" fill="#E5E7EB" />
              {/* People */}
              <circle cx="110" cy="90" r="18" fill="#BFDBFE" />
              <circle cx="110" cy="84" r="8" fill="#1E3A5F" />
              <path d="M92 115 C92 102 128 102 128 115" fill="#2563EB" opacity="0.7" />
              <circle cx="190" cy="95" r="16" fill="#FDE68A" />
              <circle cx="190" cy="89" r="7" fill="#92400E" />
              <path d="M174 118 C174 107 206 107 206 118" fill="#F59E0B" opacity="0.6" />
              {/* Chat bubbles */}
              <rect x="130" y="55" width="50" height="25" rx="12" fill="white" stroke="#E5E7EB" strokeWidth="1.5" />
              <circle cx="145" cy="67" r="2.5" fill="#3B82F6" />
              <circle cx="155" cy="67" r="2.5" fill="#3B82F6" opacity="0.5" />
              <circle cx="165" cy="67" r="2.5" fill="#3B82F6" opacity="0.3" />
              {/* Laptop */}
              <rect x="85" y="120" width="55" height="20" rx="3" fill="#1F2937" />
              <rect x="89" y="123" width="47" height="14" rx="1.5" fill="#3B82F6" opacity="0.15" />
            </svg>
          </div>

          {/* Text + CTA side */}
          <div className="md:w-1/2 p-8 md:pr-12">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Contactez-nous</h2>
            <p className="text-sm text-gray-500 mb-6 leading-relaxed">
              Posez votre question à notre assistant IA pour une réponse instantanée, ou envoyez un ticket à notre équipe.
            </p>
            <div className="flex flex-wrap gap-3">
              <HelpChatbot />
              <Link
                to="/aide/contact"
                className="h-10 px-5 rounded-lg text-sm font-medium border border-gray-200 text-gray-700 hover:border-gray-400 hover:bg-white transition-colors flex items-center gap-2"
              >
                Envoyer un ticket
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}
