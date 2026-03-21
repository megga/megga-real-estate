import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Layers,
  Search,
  Brain,
  Rocket,
  Check,
  X,
  Users,
  GitBranch,
  UserPlus,
  Shield,
  FileText,
  Layout,
  Share2,
  Sparkles,
  ClipboardList,
  Star,
  Database,
  MapPin,
  Zap,
  TrendingDown,
  ArrowRight,
  ChevronDown,
  Mail,
  Send,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

// ─── Scroll reveal hook ───────────────────────────────────────────────────────

function useScrollReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return { ref, visible }
}

// ─── Animated counter hook ────────────────────────────────────────────────────

function useCountUp(target: number, duration: number, start: boolean) {
  const [value, setValue] = useState(0)

  useEffect(() => {
    if (!start) return
    let startTime: number | null = null
    let rafId: number

    function animate(timestamp: number) {
      if (!startTime) startTime = timestamp
      const progress = Math.min((timestamp - startTime) / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
      setValue(Math.round(eased * target))
      if (progress < 1) {
        rafId = requestAnimationFrame(animate)
      }
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [target, duration, start])

  return value
}

// ─── Format number with Swiss apostrophe ──────────────────────────────────────

function formatNumber(n: number): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, "'")
}

// ─── Section wrapper with reveal animation ────────────────────────────────────

function RevealSection({
  children,
  className,
  id,
}: {
  children: React.ReactNode
  className?: string
  id?: string
}) {
  const { ref, visible } = useScrollReveal<HTMLElement>()
  return (
    <section
      ref={ref}
      id={id}
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
        className
      )}
    >
      {children}
    </section>
  )
}

// ─── Staggered card ───────────────────────────────────────────────────────────

function StaggerCard({
  children,
  index,
  visible,
  className,
}: {
  children: React.ReactNode
  index: number
  visible: boolean
  className?: string
}) {
  return (
    <div
      className={cn(
        'transition-all duration-700 ease-out',
        visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-5',
        className
      )}
      style={{ transitionDelay: visible ? `${index * 100}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

// ─── Section badge ────────────────────────────────────────────────────────────

function SectionBadge({
  children,
  variant = 'accent',
}: {
  children: React.ReactNode
  variant?: 'accent' | 'primary'
}) {
  return (
    <span
      className={cn(
        'text-xs font-medium px-3 py-1 rounded-full inline-flex items-center gap-2',
        variant === 'accent' ? 'bg-accent/10 text-accent' : 'bg-primary/5 text-primary'
      )}
    >
      {children}
    </span>
  )
}

// ─── Before/After row ─────────────────────────────────────────────────────────

function CompareRow({
  before,
  after,
  even,
}: {
  before: string
  after: string
  even: boolean
}) {
  return (
    <>
      {/* Desktop: side by side */}
      <div className={cn('hidden md:flex', even ? 'bg-gray-50/30' : 'bg-white')}>
        <div className="w-1/2 flex items-center gap-3 py-4 px-6">
          <X className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-sm text-gray-600">{before}</span>
        </div>
        <div className="w-1/2 flex items-center gap-3 py-4 px-6 border-l-2 border-emerald-200">
          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="text-sm text-gray-900 font-medium">{after}</span>
        </div>
      </div>
      {/* Mobile: stacked */}
      <div className={cn('md:hidden', even ? 'bg-gray-50/30' : 'bg-white')}>
        <div className="flex items-center gap-3 py-3 px-5 border-b border-gray-100/50">
          <X className="w-4 h-4 text-red-400 flex-shrink-0" />
          <span className="text-xs text-gray-500 line-through">{before}</span>
        </div>
        <div className="flex items-center gap-3 py-3 px-5">
          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
          <span className="text-xs text-gray-900 font-medium">{after}</span>
        </div>
      </div>
    </>
  )
}

// ─── Demo request modal ───────────────────────────────────────────────────────

function DemoModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [submitted, setSubmitted] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
      setSubmitted(false) // eslint-disable-line react-hooks/set-state-in-effect
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === backdropRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-modal w-full max-w-lg p-8 animate-in">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1 rounded-full hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-400" />
        </button>

        {submitted ? (
          <div className="text-center py-8">
            <div className="bg-emerald-50 rounded-full p-4 w-16 h-16 mx-auto flex items-center justify-center">
              <Check className="w-8 h-8 text-emerald-600" />
            </div>
            <h3 className="text-xl font-semibold text-primary mt-5">Demande envoyée</h3>
            <p className="text-sm text-gray-500 mt-2 max-w-xs mx-auto">
              Notre équipe vous contactera dans les 24 heures pour planifier votre démonstration.
            </p>
            <button
              onClick={onClose}
              className="mt-6 bg-primary text-white rounded-full px-6 h-10 text-sm font-medium hover:bg-primary/90 transition-all"
            >
              Fermer
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <div className="bg-accent/10 rounded-2xl p-3">
                <Mail className="w-5 h-5 text-accent" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-primary">Demander une démo</h3>
                <p className="text-xs text-gray-400">Découvrez MEGGA en 30 minutes</p>
              </div>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault()
                setSubmitted(true)
              }}
              className="space-y-4"
            >
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Nom complet</label>
                <input
                  type="text"
                  required
                  placeholder="Jean Dupont"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Email professionnel</label>
                <input
                  type="email"
                  required
                  placeholder="jean@agence.ch"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Agence / Société</label>
                <input
                  type="text"
                  placeholder="Nom de votre agence"
                  className="w-full h-11 px-4 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Message (optionnel)</label>
                <textarea
                  rows={3}
                  placeholder="Vos questions ou besoins spécifiques..."
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors resize-none"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-accent text-white rounded-full h-11 text-sm font-medium hover:bg-accent/90 shadow-sm transition-all inline-flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                Envoyer la demande
              </button>
              <p className="text-[11px] text-gray-400 text-center">
                Nous vous répondrons sous 24h. Aucun engagement.
              </p>
            </form>
          </>
        )}
      </div>
    </div>
  )
}

// ─── FAQ Accordion ────────────────────────────────────────────────────────────

const faqItems = [
  {
    q: 'Puis-je tester gratuitement ?',
    a: "Oui. Le plan Starter est 100% gratuit, sans limite de temps et sans carte bancaire. Vous pouvez gérer jusqu'à 5 biens actifs et accéder au CRM basique, à la recherche IA et au portail vendeur.",
  },
  {
    q: 'Comment fonctionne la conformité LAB/KYC ?',
    a: "MEGGA génère automatiquement un dossier KYC structuré pour chaque transaction : identification du client, classification du risque, checklist réglementaire et upload de documents. Chaque validation requiert une action humaine (human-in-the-loop) et un audit trail complet est conservé.",
  },
  {
    q: 'Est-ce que mes données sont hébergées en Suisse ?',
    a: "Nos bases de données sont hébergées sur des serveurs conformes aux exigences suisses en matière de protection des données. Nous utilisons Supabase avec chiffrement au repos et en transit.",
  },
  {
    q: 'Puis-je migrer depuis un autre CRM ?',
    a: "Oui. MEGGA supporte l'import CSV pour vos contacts, biens et transactions. Notre équipe peut aussi vous accompagner pour une migration assistée depuis HubSpot, Salesforce ou tout autre outil.",
  },
  {
    q: 'Quelle est la différence entre Pro et Agency ?',
    a: "Le plan Pro est conçu pour les agents indépendants (jusqu'à 25 biens). Le plan Agency ajoute le multi-utilisateurs, le branding personnalisé, les intégrations API, un manager de compte dédié et un nombre illimité de biens.",
  },
  {
    q: "Comment fonctionne l'estimation IA ?",
    a: "Notre modèle analyse plus de 47'000 transactions immobilières suisses et 70 critères (localisation, surface, étage, état, proximité transports, etc.) pour produire une fourchette de prix en temps réel. L'estimation est indicative et ne remplace pas une expertise officielle.",
  },
  {
    q: 'Puis-je changer de plan à tout moment ?',
    a: "Oui, vous pouvez upgrader ou downgrader votre plan à tout moment depuis les paramètres de votre compte. Le changement prend effet immédiatement avec un prorata sur la période en cours.",
  },
  {
    q: 'La publication multicanal est-elle incluse ?',
    a: "La publication sur MEGGA est incluse dans tous les plans. La diffusion sur ImmoScout24 et Homegate est disponible à partir du plan Pro. Vos annonces sont synchronisées automatiquement : une modification sur MEGGA se répercute sur tous les portails.",
  },
]

function FaqAccordion() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  return (
    <div className="max-w-3xl mx-auto mt-14 space-y-3">
      {faqItems.map((item, i) => {
        const isOpen = openIndex === i
        return (
          <div
            key={i}
            className="bg-white rounded-xl border border-gray-100 overflow-hidden transition-all duration-200 hover:border-gray-200"
          >
            <button
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="w-full flex items-center justify-between px-6 py-5 text-left"
            >
              <span className="text-sm font-medium text-primary pr-4">{item.q}</span>
              <ChevronDown
                className={cn(
                  'w-4 h-4 text-gray-400 flex-shrink-0 transition-transform duration-200',
                  isOpen && 'rotate-180'
                )}
              />
            </button>
            <div
              className={cn(
                'grid transition-all duration-200',
                isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
              )}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-sm text-gray-500 leading-relaxed">
                  {item.a}
                </p>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const particulierCards = [
  {
    icon: Search,
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    title: 'Recherche conversationnelle',
    description:
      "Décrivez votre bien idéal en langage naturel. Notre IA comprend vos critères et vous propose les meilleurs biens — sans toucher un seul filtre.",
    features: [
      'Recherche multilingue FR/DE/EN/IT',
      'Carte Mapbox interactive avec pins',
      'Alertes personnalisées par IA',
    ],
    cta: 'Commencer',
    href: '/search',
  },
  {
    icon: Brain,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Estimation gratuite en 2 minutes',
    description:
      "Obtenez une fourchette de prix basée sur 47'000+ transactions suisses et 70 critères d'analyse.",
    features: [
      'Fourchette de prix temps réel',
      'Biens comparables dans votre quartier',
      'Prix au m² actualisé par canton',
    ],
    cta: 'Estimer mon bien',
    href: '/estimations',
  },
  {
    icon: Rocket,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Vendez au meilleur prix',
    description:
      "De l'estimation au notaire. Un agent certifié vous accompagne et votre bien est visible sur tous les portails suisses.",
    features: [
      'Portail vendeur 24/7',
      'Diffusion ImmoScout24 + Homegate',
      'Commission 30-50% moins chère',
    ],
    cta: 'Vendre mon bien',
    href: '/vendre',
  },
]

const proModules = [
  {
    letter: 'A',
    icon: Users,
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    title: 'CRM transactionnel',
    desc: 'Centralisez contacts, scoring et pipeline dans un seul outil.',
    tags: ['Scoring IA', 'Kanban', 'Import CSV', 'Dédoublonnage'],
    href: '/dashboard/contacts',
  },
  {
    letter: 'B',
    icon: GitBranch,
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    title: 'Pipeline transaction',
    desc: 'Chaque transaction = un workflow piloté de A à Z.',
    tags: ['Checklist dynamique', 'Alertes blocage', 'ETA closing'],
    href: '/dashboard/pipeline',
  },
  {
    letter: 'C',
    icon: UserPlus,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Onboarding client',
    desc: "Collecte d'infos automatisée avec parcours guidé.",
    tags: ['Portail sécurisé', 'OCR', 'Relances auto'],
    href: '/register',
  },
  {
    letter: 'D',
    icon: Shield,
    iconBg: 'bg-red-50',
    iconColor: 'text-red-600',
    title: 'Conformité LAB/KYC',
    desc: 'Dossier auditable, conforme à la législation suisse.',
    tags: ['Classification risque', 'Human-in-the-loop', 'Audit trail'],
    href: '/register',
  },
  {
    letter: 'E',
    icon: FileText,
    iconBg: 'bg-amber-50',
    iconColor: 'text-amber-600',
    title: 'Génération documentaire',
    desc: 'Mandats, bons de visite, offres — générés en 1 clic.',
    tags: ['Templates', 'PDF/DOCX', 'Pré-remplissage'],
    href: '/register',
  },
  {
    letter: 'F',
    icon: Layout,
    iconBg: 'bg-accent/10',
    iconColor: 'text-accent',
    title: 'Portail vendeur',
    desc: 'Visibilité premium 24/7 pour vos clients vendeurs.',
    tags: ['Suivi visites', 'Offres', 'Messages', 'Reporting'],
    href: '/register',
  },
  {
    letter: 'G',
    icon: Share2,
    iconBg: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    title: 'Publication multicanal',
    desc: 'Diffusez sur MEGGA + ImmoScout24 + Homegate en 1 clic.',
    tags: ['Multi-portails', 'Description IA', 'Photos optimisées'],
    href: '/register',
  },
  {
    letter: 'H',
    icon: Sparkles,
    iconBg: 'bg-purple-50',
    iconColor: 'text-purple-600',
    title: 'Copilote IA',
    desc: 'IA contextuelle sur vos vrais dossiers — pas un gadget.',
    tags: ['Next action', 'Rédaction', 'Scoring leads'],
    href: '/register',
  },
  {
    letter: 'I',
    icon: ClipboardList,
    iconBg: 'bg-gray-100',
    iconColor: 'text-gray-600',
    title: 'Audit trail',
    desc: 'Traçabilité totale : qui, quand, quoi, pourquoi.',
    tags: ['Journal narratif', 'Export audit', 'Historique complet'],
    href: '/register',
  },
]

const compareRows = [
  { before: 'CRM séparé (HubSpot, Excel...)', after: 'CRM immobilier intégré et gratuit' },
  { before: 'KYC en emails et classeurs', after: 'Dossier LAB/KYC automatisé et auditable' },
  { before: 'Documents Word manuels', after: 'Génération automatique depuis les données' },
  { before: 'Vendeur dans le noir', after: 'Portail vendeur 24/7 temps réel' },
  { before: 'Publication portail par portail', after: 'Multi-diffusion en 1 clic' },
  { before: 'Estimation approximative', after: "Estimation IA — 47'000 transactions" },
  { before: 'CHF 200-800/mois/listing', after: 'Dès CHF 0 — plan gratuit' },
]

interface PlanData {
  name: string
  slug: string
  monthly: number | null
  tagline: string
  features: string[]
  popular?: boolean
  buttonVariant: 'outline' | 'accent' | 'primary'
}

const plans: PlanData[] = [
  {
    name: 'Starter',
    slug: 'starter',
    monthly: 0,
    tagline: 'Pour démarrer',
    features: [
      '5 biens actifs',
      'CRM basique',
      'Recherche IA',
      'Portail vendeur',
      'Support email',
    ],
    buttonVariant: 'outline',
  },
  {
    name: 'Pro',
    slug: 'pro',
    monthly: 89,
    tagline: 'Pour les agents indépendants',
    features: [
      '25 biens actifs',
      'CRM complet + scoring',
      'Pipeline transaction',
      'Conformité LAB/KYC',
      'Génération documentaire',
      'Publication multicanal',
      'Copilote IA',
      'Support prioritaire',
    ],
    popular: true,
    buttonVariant: 'accent',
  },
  {
    name: 'Agency',
    slug: 'agency',
    monthly: 249,
    tagline: 'Pour les agences',
    features: [
      'Biens illimités',
      'Multi-utilisateurs',
      'Branding personnalisé',
      'API & intégrations',
      'Audit trail complet',
      'Formation dédiée',
      'Manager de compte',
      'SLA garanti',
    ],
    buttonVariant: 'primary',
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    monthly: null,
    tagline: 'Pour les groupes',
    features: [
      'Tout Agency inclus',
      'Multi-agences',
      'SSO / SAML',
      'SLA 99.9%',
      'Support dédié 24/7',
    ],
    buttonVariant: 'outline',
  },
]

const testimonials = [
  {
    initials: 'GL',
    name: 'Gregory L.',
    company: 'MEGGA Immobilier, Genève',
    color: 'bg-accent',
    quote:
      "Le CRM intégré a changé mon quotidien. Plus besoin de jongler entre HubSpot et Excel. Et le portail vendeur impressionne systématiquement mes clients.",
  },
  {
    initials: 'CM',
    name: 'Catherine M.',
    company: 'Agence du Lac, Lausanne',
    color: 'bg-emerald-600',
    quote:
      "La publication multicanal me fait gagner 2 heures par annonce. L'estimation IA m'aide à cadrer les attentes des vendeurs dès le premier rendez-vous.",
  },
  {
    initials: 'TB',
    name: 'Thomas B.',
    company: 'Alpine Real Estate, Verbier',
    color: 'bg-primary',
    quote:
      "Avec ma clientèle internationale, la conformité LAB/KYC intégrée est indispensable. Le dossier est propre, auditable, et ça rassure tout le monde.",
  },
]

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function ServicesPage() {
  const [isAnnual, setIsAnnual] = useState(false)
  const [demoOpen, setDemoOpen] = useState(false)

  // Scroll-to anchor
  const scrollTo = useCallback((id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Counter section
  const counterRef = useRef<HTMLDivElement>(null)
  const [counterVisible, setCounterVisible] = useState(false)
  useEffect(() => {
    const el = counterRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setCounterVisible(true)
          observer.disconnect()
        }
      },
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const count47k = useCountUp(47000, 2000, counterVisible)
  const count26 = useCountUp(26, 2000, counterVisible)

  // Stagger visibility for sections with cards
  const particuliersReveal = useScrollReveal<HTMLDivElement>()
  const proReveal = useScrollReveal<HTMLDivElement>()
  const pricingReveal = useScrollReveal<HTMLDivElement>()
  const testimonialsReveal = useScrollReveal<HTMLDivElement>()

  return (
    <>
      <Navbar />
      <DemoModal open={demoOpen} onClose={() => setDemoOpen(false)} />
      <main>
        {/* ═══ Section 1 — Hero ═══ */}
        <RevealSection className="bg-gradient-to-b from-gray-50/80 to-white py-24 md:py-32 relative overflow-hidden">
          {/* Subtle geometric pattern */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)',
              backgroundSize: '40px 40px',
            }}
          />

          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 text-center relative z-10">
            <SectionBadge variant="primary">
              <Layers className="w-3.5 h-3.5" />
              Plateforme tout-en-un
            </SectionBadge>

            <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-primary max-w-4xl mx-auto leading-tight mt-6">
              La plateforme immobilière suisse qui pense comme un agent
            </h1>

            <p className="text-gray-500 text-lg max-w-2xl mx-auto mt-5">
              Recherche IA, estimation, CRM, conformité LAB/KYC, portail vendeur — tout dans une
              seule plateforme.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10">
              <button
                onClick={() => scrollTo('particuliers')}
                className="bg-accent text-white rounded-full px-7 h-12 font-medium text-base hover:bg-accent/90 shadow-sm hover:shadow-md transition-all"
              >
                Je suis un particulier
              </button>
              <button
                onClick={() => scrollTo('professionnels')}
                className="bg-white border border-gray-200 text-primary rounded-full px-7 h-12 font-medium text-base hover:bg-gray-50 shadow-sm transition-all"
              >
                Je suis un professionnel
              </button>
            </div>
          </div>
        </RevealSection>

        {/* ═══ Section 2 — Services particuliers ═══ */}
        <RevealSection id="particuliers" className="bg-white py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="text-center">
              <SectionBadge>Pour les particuliers</SectionBadge>
              <h2 className="text-2xl md:text-3xl font-bold text-primary mt-4">
                Achetez, louez, vendez — simplement.
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto mt-3">
                Des outils puissants, une expérience intuitive.
              </p>
            </div>

            <div
              ref={particuliersReveal.ref}
              className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-14"
            >
              {/* eslint-disable-next-line react-hooks/refs */}
              {particulierCards.map((card, i) => {
                const Icon = card.icon
                return (
                  <StaggerCard
                    key={card.title}
                    index={i}
                    visible={particuliersReveal.visible}
                    className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300"
                  >
                    <div
                      className={cn(
                        'rounded-2xl p-4 w-14 h-14 flex items-center justify-center',
                        card.iconBg
                      )}
                    >
                      <Icon className={cn('w-7 h-7', card.iconColor)} />
                    </div>

                    <h3 className="text-xl font-semibold text-primary mt-5">{card.title}</h3>
                    <p className="text-sm text-gray-500 leading-relaxed mt-3">{card.description}</p>

                    <div className="border-t border-gray-100 mt-6 pt-4 space-y-2">
                      {card.features.map((f) => (
                        <div key={f} className="flex items-center gap-2">
                          <Check className="w-4 h-4 text-accent flex-shrink-0" />
                          <span className="text-sm text-gray-600">{f}</span>
                        </div>
                      ))}
                    </div>

                    <Link
                      to={card.href}
                      className="text-accent font-medium text-sm mt-5 inline-flex items-center gap-1 hover:gap-2 transition-all"
                    >
                      {card.cta}
                      <ArrowRight className="w-4 h-4" />
                    </Link>
                  </StaggerCard>
                )
              })}
            </div>
          </div>
        </RevealSection>

        {/* ═══ Section 3 — Services professionnels ═══ */}
        <RevealSection id="professionnels" className="bg-gray-50 py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="text-center">
              <SectionBadge variant="primary">Pour les agents & agences</SectionBadge>
              <h2 className="text-2xl md:text-3xl font-bold text-primary mt-4">
                L'OS des transactions immobilières suisses
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto mt-3">
                9 modules intégrés. Zéro outil externe. Tout est inclus.
              </p>
            </div>

            <div
              ref={proReveal.ref}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mt-14"
            >
              {/* eslint-disable-next-line react-hooks/refs */}
              {proModules.map((mod, i) => {
                const Icon = mod.icon
                return (
                  <StaggerCard
                    key={mod.letter}
                    index={i}
                    visible={proReveal.visible}
                    className="bg-white rounded-xl p-6 border border-gray-100 hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 group"
                  >
                    <div className="flex items-center justify-between">
                      <div
                        className={cn(
                          'rounded-2xl p-3 w-11 h-11 flex items-center justify-center',
                          mod.iconBg
                        )}
                      >
                        <Icon className={cn('w-5 h-5', mod.iconColor)} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-widest text-gray-300">
                        {mod.letter}
                      </span>
                    </div>

                    <h3 className="text-base font-semibold text-primary mt-4 group-hover:text-accent transition-colors">
                      {mod.title}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed mt-1.5">{mod.desc}</p>

                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {mod.tags.map((tag) => (
                        <span
                          key={tag}
                          className="bg-gray-100 text-gray-500 text-[10px] font-medium px-2 py-0.5 rounded-full"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>

                    <Link
                      to={mod.href}
                      className="text-accent font-medium text-xs mt-4 inline-flex items-center gap-1 hover:gap-2 transition-all opacity-0 group-hover:opacity-100"
                    >
                      En savoir plus
                      <ArrowRight className="w-3 h-3" />
                    </Link>
                  </StaggerCard>
                )
              })}
            </div>
          </div>
        </RevealSection>

        {/* ═══ Section 4 — Avant/Après ═══ */}
        <RevealSection className="bg-white py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="text-center">
              <SectionBadge variant="primary">Le changement</SectionBadge>
              <h2 className="text-2xl md:text-3xl font-bold text-primary mt-4">
                Avant MEGGA vs Avec MEGGA
              </h2>
            </div>

            <div className="max-w-4xl mx-auto mt-14 rounded-2xl overflow-hidden border border-gray-200 shadow-sm">
              {/* Header — desktop */}
              <div className="hidden md:flex">
                <div className="w-1/2 bg-red-50 text-red-700 font-semibold text-sm py-3 px-6">
                  Sans MEGGA
                </div>
                <div className="w-1/2 bg-emerald-50 text-emerald-700 font-semibold text-sm py-3 px-6">
                  Avec MEGGA
                </div>
              </div>
              {/* Header — mobile */}
              <div className="md:hidden bg-gradient-to-r from-red-50 to-emerald-50 py-3 px-5 text-center text-xs font-semibold text-gray-600">
                Avant → Après MEGGA
              </div>
              {/* Rows */}
              {compareRows.map((row, i) => (
                <CompareRow
                  key={i}
                  before={row.before}
                  after={row.after}
                  even={i % 2 === 1}
                />
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ═══ Section 5 — Pricing ═══ */}
        <RevealSection className="bg-gray-50 py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="text-center">
              <SectionBadge>Tarification</SectionBadge>
              <h2 className="text-2xl md:text-3xl font-bold text-primary mt-4">
                Des tarifs transparents, enfin.
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto mt-3">
                30 à 50% moins cher que les portails traditionnels.
              </p>

              {/* Toggle */}
              <div className="flex items-center justify-center gap-3 mt-8">
                <div className="bg-gray-200 rounded-full p-1 inline-flex">
                  <button
                    onClick={() => setIsAnnual(false)}
                    className={cn(
                      'px-4 py-1.5 text-sm rounded-full transition-all',
                      !isAnnual
                        ? 'bg-white font-medium text-primary shadow-sm'
                        : 'text-gray-500 cursor-pointer'
                    )}
                  >
                    Mensuel
                  </button>
                  <button
                    onClick={() => setIsAnnual(true)}
                    className={cn(
                      'px-4 py-1.5 text-sm rounded-full transition-all',
                      isAnnual
                        ? 'bg-white font-medium text-primary shadow-sm'
                        : 'text-gray-500 cursor-pointer'
                    )}
                  >
                    Annuel
                  </button>
                </div>
                {isAnnual && (
                  <span className="text-accent text-xs font-medium">Économisez 20%</span>
                )}
              </div>
            </div>

            <div
              ref={pricingReveal.ref}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-12"
            >
              {/* eslint-disable-next-line react-hooks/refs */}
              {plans.map((plan, i) => {
                const price =
                  plan.monthly === null
                    ? null
                    : isAnnual
                      ? Math.round(plan.monthly * 0.8)
                      : plan.monthly
                return (
                  <StaggerCard
                    key={plan.name}
                    index={i}
                    visible={pricingReveal.visible}
                    className={cn(
                      'bg-white rounded-2xl border overflow-hidden transition-all duration-300 hover:shadow-lg relative',
                      plan.popular ? 'border-2 border-accent shadow-lg' : 'border-gray-100'
                    )}
                  >
                    {plan.popular && (
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-accent text-white text-xs font-medium px-3 py-1 rounded-full">
                        Populaire
                      </span>
                    )}

                    <div className="p-8 pb-6">
                      <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                        {plan.name}
                      </p>
                      {price !== null ? (
                        <div className="mt-2">
                          <span
                            className={cn(
                              'text-4xl font-bold',
                              plan.popular ? 'text-accent' : 'text-primary'
                            )}
                          >
                            CHF {price}
                          </span>
                          <span className="text-sm text-gray-400">/mois</span>
                        </div>
                      ) : (
                        <p className="text-2xl font-bold text-primary mt-2">Sur mesure</p>
                      )}
                      <p className="text-sm text-gray-400 mt-1">{plan.tagline}</p>
                    </div>

                    <div className="border-t border-gray-100" />

                    <div className="p-8 pt-6">
                      <div className="space-y-3">
                        {plan.features.map((f) => (
                          <div key={f} className="flex items-center gap-2">
                            <Check
                              className={cn(
                                'w-4 h-4 flex-shrink-0',
                                plan.popular
                                  ? 'text-accent'
                                  : plan.buttonVariant === 'primary'
                                    ? 'text-primary'
                                    : 'text-gray-300'
                              )}
                            />
                            <span className="text-sm text-gray-500">{f}</span>
                          </div>
                        ))}
                      </div>

                      {plan.name === 'Pro' && (
                        <p className="text-xs text-gray-400 italic mt-2">
                          Tout Starter inclus
                        </p>
                      )}
                      {plan.name === 'Enterprise' && (
                        <p className="text-xs text-gray-400 italic mt-2">
                          Tout Agency inclus
                        </p>
                      )}

                      {plan.monthly === null ? (
                        <button
                          onClick={() => setDemoOpen(true)}
                          className="rounded-full w-full h-11 text-sm font-medium mt-6 transition-all border border-gray-200 text-primary hover:bg-gray-50 cursor-pointer"
                        >
                          Nous contacter
                        </button>
                      ) : (
                        <Link
                          to={`/register?plan=${plan.slug}`}
                          className={cn(
                            'rounded-full w-full h-11 text-sm font-medium mt-6 transition-all flex items-center justify-center',
                            plan.buttonVariant === 'accent' &&
                              'bg-accent text-white hover:bg-accent/90 shadow-sm',
                            plan.buttonVariant === 'primary' &&
                              'bg-primary text-white hover:bg-primary/90',
                            plan.buttonVariant === 'outline' &&
                              'border border-gray-200 text-primary hover:bg-gray-50'
                          )}
                        >
                          Commencer
                        </Link>
                      )}
                    </div>
                  </StaggerCard>
                )
              })}
            </div>
          </div>
        </RevealSection>

        {/* ═══ Section 6 — Chiffres clés ═══ */}
        <RevealSection className="bg-white py-20">
          <div
            ref={counterRef}
            className="max-w-4xl mx-auto px-4 md:px-6 lg:px-8 grid grid-cols-2 md:grid-cols-4 gap-8 text-center"
          >
            {[
              {
                icon: Database,
                value: `${formatNumber(count47k)}+`,
                label: 'Transactions analysées',
              },
              { icon: MapPin, value: count26.toString(), label: 'Cantons couverts' },
              { icon: Zap, value: '< 2s', label: 'Temps de réponse IA', static: true },
              { icon: TrendingDown, value: '30-50%', label: 'Moins cher', static: true },
            ].map((stat) => {
              const Icon = stat.icon
              return (
                <div key={stat.label}>
                  <div className="bg-gray-100 rounded-full p-3 w-12 h-12 mx-auto flex items-center justify-center">
                    <Icon className="w-5 h-5 text-primary" />
                  </div>
                  <p className="text-4xl md:text-5xl font-bold text-primary mt-4">{stat.value}</p>
                  <p className="text-sm text-gray-500 mt-2">{stat.label}</p>
                </div>
              )
            })}
          </div>
        </RevealSection>

        {/* ═══ Section 7 — Témoignages ═══ */}
        <RevealSection className="bg-gray-50 py-20">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="text-center">
              <SectionBadge variant="primary">Témoignages</SectionBadge>
              <h2 className="text-2xl md:text-3xl font-bold text-primary mt-4">
                Ils font confiance à MEGGA
              </h2>
            </div>

            <div
              ref={testimonialsReveal.ref}
              className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12"
            >
              {/* eslint-disable-next-line react-hooks/refs */}
              {testimonials.map((t, i) => (
                <StaggerCard
                  key={t.name}
                  index={i}
                  visible={testimonialsReveal.visible}
                  className="bg-white rounded-2xl p-8 border border-gray-100 shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <Star key={j} className="w-4 h-4 text-amber-400 fill-amber-400" />
                    ))}
                  </div>

                  <p className="text-sm text-gray-600 leading-relaxed mt-4 italic">
                    &laquo;&nbsp;{t.quote}&nbsp;&raquo;
                  </p>

                  <div className="border-t border-gray-100 mt-6 pt-4 flex items-center gap-3">
                    <div
                      className={cn(
                        'w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-bold',
                        t.color
                      )}
                    >
                      {t.initials}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-primary">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.company}</p>
                    </div>
                  </div>
                </StaggerCard>
              ))}
            </div>
          </div>
        </RevealSection>

        {/* ═══ Section 8 — FAQ ═══ */}
        <RevealSection className="bg-white py-20 md:py-28">
          <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8">
            <div className="text-center">
              <SectionBadge variant="primary">Questions fréquentes</SectionBadge>
              <h2 className="text-2xl md:text-3xl font-bold text-primary mt-4">
                Vous avez des questions ?
              </h2>
              <p className="text-gray-500 max-w-2xl mx-auto mt-3">
                Les réponses aux questions les plus courantes sur MEGGA.
              </p>
            </div>
            <FaqAccordion />
          </div>
        </RevealSection>

        {/* ═══ Section 9 — CTA final ═══ */}
        <section className="py-20 md:py-24 px-4 lg:px-8 mb-16">
          <div
            className="max-w-7xl mx-auto bg-primary text-white rounded-3xl py-16 md:py-20 px-8 text-center relative overflow-hidden"
          >
            {/* Glow effect */}
            <div
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at center, rgba(37,99,235,0.15) 0%, transparent 70%)',
              }}
            />

            <h2 className="text-3xl md:text-4xl font-bold relative z-10">
              Prêt à transformer votre activité ?
            </h2>
            <p className="text-white/60 mt-3 relative z-10 max-w-xl mx-auto">
              Rejoignez les agences suisses qui accélèrent leurs transactions avec MEGGA.
            </p>

            <div className="flex flex-col sm:flex-row justify-center gap-4 mt-10 relative z-10">
              <Link
                to="/register"
                className="bg-white text-primary rounded-full px-8 h-12 font-medium hover:bg-gray-100 shadow-md transition-all inline-flex items-center justify-center"
              >
                Créer mon compte
              </Link>
              <button
                onClick={() => setDemoOpen(true)}
                className="border border-white/30 text-white rounded-full px-8 h-12 font-medium hover:bg-white/10 transition-all"
              >
                Voir une démo
              </button>
            </div>

            <p className="text-white/30 text-xs mt-5 relative z-10">
              Gratuit · Sans carte bancaire · Prêt en 2 minutes
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}
