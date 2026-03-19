import { useState, useRef, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Search,
  X,
  ChevronRight,
  UserPlus,
  Brain,
  PlusCircle,
  Shield,
  Rocket,
  Home,
  Lock,
  Briefcase,
  CreditCard,
  ShieldCheck,
  Mail,
  Clock,
  Zap,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'

/* ──────────────────────────── DATA ──────────────────────────── */

const CATEGORIES = [
  { id: 'premiers-pas', label: 'Premiers pas', icon: Rocket, bgClass: 'bg-accent/10', iconClass: 'text-accent', count: 8 },
  { id: 'recherche', label: 'Recherche & Carte', icon: Search, bgClass: 'bg-sky-50', iconClass: 'text-sky-600', count: 6 },
  { id: 'estimation', label: 'Estimation', icon: Brain, bgClass: 'bg-emerald-50', iconClass: 'text-emerald-600', count: 5 },
  { id: 'vendre', label: 'Vendre un bien', icon: Home, bgClass: 'bg-amber-50', iconClass: 'text-amber-600', count: 7 },
  { id: 'compte', label: 'Compte & Sécurité', icon: Lock, bgClass: 'bg-slate-100', iconClass: 'text-slate-600', count: 5 },
  { id: 'agents', label: 'Pour les agents', icon: Briefcase, bgClass: 'bg-purple-50', iconClass: 'text-purple-600', count: 9 },
  { id: 'facturation', label: 'Facturation', icon: CreditCard, bgClass: 'bg-pink-50', iconClass: 'text-pink-600', count: 4 },
  { id: 'kyc', label: 'Conformité LAB/KYC', icon: ShieldCheck, bgClass: 'bg-red-50', iconClass: 'text-red-600', count: 6 },
] as const

type CategoryId = (typeof CATEGORIES)[number]['id']

interface FaqItem {
  q: string
  a: string
  category: CategoryId
}

const FAQ_DATA: FaqItem[] = [
  // Premiers pas (8)
  { category: 'premiers-pas', q: "Comment créer un compte sur MEGGA ?", a: "Cliquez sur 'Se connecter' en haut à droite, puis 'Créer un compte'. Inscription avec email ou Google. Gratuit, moins de 30 secondes." },
  { category: 'premiers-pas', q: "MEGGA est-il disponible dans toute la Suisse ?", a: "Oui, les 26 cantons sont couverts : Genève, Lausanne, Zurich, Berne, Bâle, Lugano et toutes les communes suisses." },
  { category: 'premiers-pas', q: "MEGGA est-il gratuit ?", a: "Pour les particuliers, 100% gratuit. Pour les agents, plan Starter gratuit (5 listings). Plans Pro et Agency pour les fonctionnalités avancées." },
  { category: 'premiers-pas', q: "Comment fonctionne la recherche IA ?", a: "Tapez en langage naturel, ex: 'Appartement 3 pièces lumineux à Champel, max CHF 800'000'. L'IA comprend et affiche les résultats pertinents sur la carte." },
  { category: 'premiers-pas', q: "Quelles langues sont supportées ?", a: "Interface en français. Recherche IA en FR/DE/EN/IT. Interface multilingue complète en Phase 2." },
  { category: 'premiers-pas', q: "Comment contacter le support ?", a: "Email à support@megga.ch ou formulaire de contact en bas de cette page. Support prioritaire pour Pro et Agency." },
  { category: 'premiers-pas', q: "Puis-je utiliser MEGGA sur mobile ?", a: "Oui, entièrement responsive sur tous les appareils. App mobile native prévue ultérieurement." },
  { category: 'premiers-pas', q: "Comment supprimer mon compte ?", a: "Paramètres → Profil → 'Supprimer mon compte'. Action irréversible. Contactez le support si besoin." },
  // Recherche & Carte (6)
  { category: 'recherche', q: "Comment utiliser la carte interactive ?", a: "La carte affiche les biens avec des pins indiquant le prix. Zoomez, cliquez sur un pin pour les détails. Survolez une annonce pour animer le pin correspondant." },
  { category: 'recherche', q: "Puis-je dessiner une zone de recherche ?", a: "Fonctionnalité prochainement disponible. En attendant, utilisez le filtre Localisation pour un canton ou une ville." },
  { category: 'recherche', q: "Comment sauvegarder une recherche ?", a: "Bouton 'Sauvegarder' dans la barre de résultats. Retrouvez vos recherches dans votre espace personnel. Activez les alertes pour les nouveaux biens." },
  { category: 'recherche', q: "Comment fonctionne le chat IA ?", a: "Le bouton 'Affiner ma recherche' en bas à droite ouvre le chat IA. Décrivez ce que vous cherchez, l'IA affine les résultats en temps réel." },
  { category: 'recherche', q: "Différence entre Acheter et Louer ?", a: "Le tab 'Acheter' affiche les biens en vente (prix CHF), 'Louer' les locations (CHF/mois). Les filtres s'adaptent." },
  { category: 'recherche', q: "Les résultats sont-ils à jour ?", a: "Annonces mises à jour quotidiennement. 'Nouveau' = publié dans les 7 derniers jours." },
  // Estimation (5)
  { category: 'estimation', q: "Comment est calculée l'estimation ?", a: "70 critères analysés : surface, pièces, année, état + 50 critères d'emplacement. Croisés avec 47'000+ transactions suisses." },
  { category: 'estimation', q: "L'estimation est-elle fiable ?", a: "Fourchette fiable pour les biens standards. Pour les biens atypiques, évaluation sur place recommandée." },
  { category: 'estimation', q: "Combien coûte une estimation ?", a: "100% gratuite, sans engagement, sans limite." },
  { category: 'estimation', q: "Estimer un bien à acheter ?", a: "Oui, utilisé par vendeurs ET acheteurs pour vérifier la cohérence des prix." },
  { category: 'estimation', q: "Estimation plus précise ?", a: "Demandez une évaluation gratuite sur place par un agent MEGGA certifié." },
  // Vendre un bien (7)
  { category: 'vendre', q: "Comment mettre en vente ?", a: "Estimez sur /estimations puis contactez un agent, ou remplissez le formulaire sur /vendre. Réponse sous 24h." },
  { category: 'vendre', q: "Combien coûte la mise en vente ?", a: "Gratuite. Commission uniquement en cas de vente, 30-50% moins chère que les portails traditionnels." },
  { category: 'vendre', q: "Le portail vendeur ?", a: "Espace personnel 24/7 : visites, retours visiteurs, offres, messages agent, documents du mandat." },
  { category: 'vendre', q: "Quels portails de diffusion ?", a: "MEGGA + ImmoScout24 + Homegate + immobilier.ch via publication multicanal." },
  { category: 'vendre', q: "Délai de vente ?", a: "Variable selon marché et bien. À Genève, 4-8 semaines en moyenne pour un bien bien positionné." },
  { category: 'vendre', q: "Changer d'agent ?", a: "Selon les termes du mandat. Contactez le support MEGGA." },
  { category: 'vendre', q: "Virtual staging inclus ?", a: "Disponible pour agents Pro et Agency. Demandez à votre agent." },
  // Compte & Sécurité (5)
  { category: 'compte', q: "Modifier mes infos ?", a: "Paramètres → Profil. Modifiez nom, téléphone, photo, notifications." },
  { category: 'compte', q: "Changer mon mot de passe ?", a: "Paramètres → Profil → Sécurité, ou 'Mot de passe oublié' sur la page connexion." },
  { category: 'compte', q: "Mes données protégées ?", a: "Hébergement Suisse/EU, conforme LPD. Données jamais vendues à des tiers." },
  { category: 'compte', q: "Connexion Google ?", a: "Page connexion → 'Continuer avec Google'. Compte lié automatiquement." },
  { category: 'compte', q: "Plusieurs comptes ?", a: "Non, un seul par email. Vendeur + agent : contactez le support pour configurer les accès." },
  // Pour les agents (9)
  { category: 'agents', q: "Devenir agent partenaire ?", a: "Créez un compte agent sur /register. Plan Starter = CRM + messagerie + 5 listings immédiatement." },
  { category: 'agents', q: "CRM gratuit : quoi d'inclus ?", a: "Starter : 50 contacts, pipeline Kanban, messagerie, analytics, 5 listings. Pro : illimité." },
  { category: 'agents', q: "Publier une annonce ?", a: "Dashboard → Mes biens → 'Nouvelle annonce'. Infos + photos + description IA. Moins de 5 min." },
  { category: 'agents', q: "Scoring des leads ?", a: "IA analyse comportement (biens consultés, fréquence, budget) → score Chaud/Tiède/Froid, mis à jour automatiquement." },
  { category: 'agents', q: "Importer mes contacts ?", a: "Dashboard → Contacts → 'Importer'. CSV et vCard acceptés. Détection doublons automatique." },
  { category: 'agents', q: "Publication multicanal ?", a: "Plan Agency : publication MEGGA → ImmoScout24 + Homegate + immobilier.ch. Config dans Paramètres → Intégrations." },
  { category: 'agents', q: "Le copilote IA ?", a: "Assistant intégré : résumé échanges, next action, rédaction emails/descriptions, détection dossiers urgents." },
  { category: 'agents', q: "Gérer mon équipe ?", a: "Plan Agency : Paramètres → Équipe → 'Inviter'. Rôles : Admin, Manager, Agent, Assistant." },
  { category: 'agents', q: "Passer de Starter à Pro ?", a: "Paramètres → Abonnement → 'Changer de plan'. Essai Pro 14 jours gratuit sans engagement." },
  // Facturation (4)
  { category: 'facturation', q: "Plans disponibles ?", a: "Starter (gratuit), Pro (CHF 89/mois), Agency (CHF 249/mois), Enterprise (sur devis). Détails sur /services." },
  { category: 'facturation', q: "Essai gratuit ?", a: "Pro et Agency : 14 jours gratuits, sans carte bancaire. Retour auto à Starter après." },
  { category: 'facturation', q: "Moyens de paiement ?", a: "Visa, Mastercard, débit, TWINT. Facturation mensuelle ou annuelle. Paiement sécurisé Stripe." },
  { category: 'facturation', q: "Annuler l'abonnement ?", a: "Paramètres → Abonnement → 'Annuler'. Accès maintenu jusqu'à fin de période. Données conservées." },
  // Conformité LAB/KYC (6)
  { category: 'kyc', q: "Qu'est-ce que LAB/KYC ?", a: "La LAB impose aux intermédiaires immobiliers de vérifier identité et provenance des fonds. MEGGA structure ce processus avec des dossiers digitaux auditables." },
  { category: 'kyc', q: "MEGGA remplace un compliance officer ?", a: "Non. MEGGA assiste et orchestre — l'agent valide. Human-in-the-loop obligatoire. L'outil standardise, trace et alerte." },
  { category: 'kyc', q: "Documents requis ?", a: "Selon le profil : pièce d'identité, justificatif domicile, origine des fonds, extrait RC (personnes morales). Checklist dynamique." },
  { category: 'kyc', q: "Classification de risque ?", a: "IA pré-évalue (bas/moyen/élevé) selon profil, montant et critères réglementaires. L'agent valide." },
  { category: 'kyc', q: "Export pour audit ?", a: "Chaque dossier a un journal d'audit complet exportable PDF. Toutes les actions tracées." },
  { category: 'kyc', q: "Inclus dans quel plan ?", a: "KYC basique dans Pro. KYC complet + reporting + multi-agents dans Agency." },
]

const CATEGORY_LABELS: Record<CategoryId, string> = {
  'premiers-pas': 'Premiers pas',
  'recherche': 'Recherche',
  'estimation': 'Estimation',
  'vendre': 'Vendre',
  'compte': 'Compte',
  'agents': 'Agents',
  'facturation': 'Facturation',
  'kyc': 'KYC',
}

const TABS: { id: 'all' | CategoryId; label: string }[] = [
  { id: 'all', label: 'Tout' },
  { id: 'premiers-pas', label: 'Premiers pas' },
  { id: 'recherche', label: 'Recherche' },
  { id: 'estimation', label: 'Estimation' },
  { id: 'vendre', label: 'Vendre' },
  { id: 'compte', label: 'Compte' },
  { id: 'agents', label: 'Agents' },
  { id: 'facturation', label: 'Facturation' },
  { id: 'kyc', label: 'KYC' },
]

const QUICK_SEARCHES = [
  { label: 'Créer un compte', icon: UserPlus, keyword: 'créer un compte' },
  { label: 'Estimer mon bien', icon: Brain, keyword: 'estimation' },
  { label: 'Publier une annonce', icon: PlusCircle, keyword: 'publier annonce' },
  { label: 'Conformité KYC', icon: Shield, keyword: 'KYC' },
]

const GUIDES = [
  {
    color: 'bg-accent',
    title: 'Trouver votre bien idéal',
    desc: 'Maîtrisez la recherche IA, la carte et les alertes.',
    steps: [
      'Recherche en langage naturel',
      'Filtrez ou utilisez le chat IA',
      'Sauvegardez vos favoris',
      'Activez les alertes',
    ],
  },
  {
    color: 'bg-emerald-500',
    title: 'Vendez au meilleur prix',
    desc: "De l'estimation gratuite à la signature chez le notaire.",
    steps: [
      'Estimez gratuitement',
      'Choisissez votre agent',
      'Suivez sur le portail vendeur',
      'Signez chez le notaire',
    ],
  },
  {
    color: 'bg-purple-500',
    title: 'Maîtrisez la plateforme agent',
    desc: 'CRM, publication, pipeline et copilote IA.',
    steps: [
      'Configurez votre agence',
      'Importez vos contacts',
      'Publiez votre 1ère annonce',
      'Lancez votre pipeline',
    ],
  },
]

/* ──────────────────────── HIGHLIGHT HELPER ──────────────────── */

function highlightText(text: string, query: string) {
  if (!query.trim()) return text
  const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escapedQuery})`, 'gi')
  const parts = text.split(regex)
  return parts.map((part, i) =>
    regex.test(part) ? (
      <mark key={i} className="bg-accent/10 text-accent rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  )
}

/* ───────────────────────── TOAST HELPER ──────────────────────── */

function showToast(message: string) {
  const el = document.createElement('div')
  el.className =
    'fixed bottom-6 left-1/2 -translate-x-1/2 bg-primary text-white text-sm px-5 py-3 rounded-full shadow-lg z-[100] animate-fade-in'
  el.textContent = message
  document.body.appendChild(el)
  setTimeout(() => {
    el.style.opacity = '0'
    el.style.transition = 'opacity 300ms'
    setTimeout(() => el.remove(), 300)
  }, 2500)
}

/* ──────────────────────── MAIN COMPONENT ────────────────────── */

export default function HelpCenterPage() {
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | CategoryId>('all')
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(null)
  const faqRef = useRef<HTMLDivElement>(null)
  const guidesRef = useRef<HTMLDivElement>(null)
  const [guidesVisible, setGuidesVisible] = useState(false)

  // Fade-in for guides section
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setGuidesVisible(true)
      },
      { threshold: 0.15 }
    )
    if (guidesRef.current) observer.observe(guidesRef.current)
    return () => observer.disconnect()
  }, [])

  // Filter FAQ
  const filteredFaq = useMemo(() => {
    let items = FAQ_DATA
    if (activeTab !== 'all') {
      items = items.filter((f) => f.category === activeTab)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      items = items.filter(
        (f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)
      )
    }
    return items
  }, [activeTab, searchQuery])

  function handleCategoryClick(id: CategoryId) {
    setActiveTab(id)
    setSearchQuery('')
    setOpenFaqIndex(null)
    faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  function handleQuickSearch(keyword: string) {
    setSearchQuery(keyword)
    setActiveTab('all')
    setOpenFaqIndex(null)
    faqRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <Navbar />

      {/* ─── Section 1: Hero + Search ─── */}
      <section
        className="relative py-16 md:py-24"
        style={{
          background: 'linear-gradient(to bottom, rgba(239,246,255,0.4), #fff)',
        }}
      >
        {/* Dot pattern */}
        <div
          className="absolute inset-0 h-1/2 pointer-events-none"
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(0,0,0,0.03) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="relative z-10 max-w-4xl mx-auto px-4 md:px-6 text-center">
          <h1 className="text-2xl md:text-3xl font-bold text-primary">
            Comment pouvons-nous vous aider ?
          </h1>
          <p className="text-gray-400 text-sm mt-2">
            Guides, tutoriels et réponses à vos questions.
          </p>

          {/* Search bar */}
          <div className="max-w-2xl mx-auto mt-10">
            <div
              className={cn(
                'bg-white rounded-2xl border border-gray-200 shadow-xl px-6 py-4 flex items-center gap-4 transition-all duration-300',
                'focus-within:shadow-2xl focus-within:border-accent/30'
              )}
            >
              <Search className="w-5 h-5 text-gray-300 flex-shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tapez votre question..."
                className="bg-transparent border-0 outline-none text-base placeholder:text-gray-400 flex-1 min-w-0"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="w-4 h-4 text-gray-300 hover:text-gray-500 cursor-pointer flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Quick search pills */}
          <div className="flex justify-center flex-wrap gap-2 mt-6">
            {QUICK_SEARCHES.map((qs) => {
              const Icon = qs.icon
              return (
                <button
                  key={qs.label}
                  onClick={() => handleQuickSearch(qs.keyword)}
                  className="bg-white border border-gray-200 rounded-full px-3.5 py-2 text-xs text-gray-500 hover:border-accent hover:text-accent hover:bg-accent/5 transition-all cursor-pointer inline-flex items-center"
                >
                  <Icon className="w-3 h-3 mr-1.5" />
                  {qs.label}
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Section 2: Categories ─── */}
      <section className="bg-white py-12 md:py-16">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon
              return (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryClick(cat.id)}
                  className="bg-white rounded-xl p-5 border border-gray-100 hover:shadow-md hover:-translate-y-0.5 hover:border-accent/20 transition-all duration-200 cursor-pointer group text-left flex items-start gap-3.5"
                >
                  <div
                    className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
                      cat.bgClass
                    )}
                  >
                    <Icon className={cn('w-5 h-5', cat.iconClass)} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-primary group-hover:text-accent transition-colors">
                      {cat.label}
                    </div>
                    <div className="text-[11px] text-gray-300 mt-0.5">
                      {cat.count} articles
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      </section>

      {/* ─── Section 3: Guides ─── */}
      <section className="bg-gray-50/70 py-14 md:py-[72px]">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-widest text-center">
            Guides populaires
          </p>
          <h2 className="text-xl font-semibold text-center mt-2">
            Démarrez en quelques minutes
          </h2>

          <div
            ref={guidesRef}
            className={cn(
              'grid grid-cols-1 md:grid-cols-3 gap-5 mt-10 transition-all duration-700',
              guidesVisible
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4'
            )}
          >
            {GUIDES.map((guide) => (
              <button
                key={guide.title}
                onClick={() =>
                  showToast('Guide complet bientôt disponible')
                }
                className="bg-white rounded-xl overflow-hidden border border-gray-100 shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group flex text-left"
              >
                <div className={cn('w-1 flex-shrink-0', guide.color)} />
                <div className="p-6 flex-1">
                  <span className="text-[10px] text-gray-300 uppercase tracking-widest font-medium">
                    GUIDE · 5 min
                  </span>
                  <h3 className="text-base font-semibold text-primary mt-2 group-hover:text-accent transition-colors">
                    {guide.title}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1.5 leading-relaxed">
                    {guide.desc}
                  </p>
                  <ol className="mt-4 space-y-1.5">
                    {guide.steps.map((step, i) => (
                      <li key={i} className="flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-gray-100 text-[10px] font-bold text-gray-400 flex items-center justify-center flex-shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-xs text-gray-400">{step}</span>
                      </li>
                    ))}
                  </ol>
                  <span className="text-accent text-sm font-medium mt-4 inline-flex items-center gap-1 group-hover:gap-2 transition-all">
                    Lire le guide
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Section 4: FAQ ─── */}
      <section ref={faqRef} className="bg-white py-14 md:py-[72px] scroll-mt-20">
        <div className="max-w-3xl mx-auto px-4 md:px-6">
          {/* Tabs */}
          <div className="flex gap-1.5 flex-wrap mb-10">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  setActiveTab(tab.id)
                  setOpenFaqIndex(null)
                }}
                className={cn(
                  'rounded-full px-3.5 py-1.5 text-xs font-medium transition-all cursor-pointer',
                  activeTab === tab.id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                )}
              >
                {tab.label}
              </button>
            ))}
            <span className="text-sm text-gray-300 ml-2 self-center">
              {filteredFaq.length} résultat{filteredFaq.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Accordions */}
          <div className="transition-opacity duration-200">
            {filteredFaq.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-8">
                Aucun résultat pour cette recherche.
              </p>
            ) : (
              filteredFaq.map((faq, idx) => {
                const isOpen = openFaqIndex === idx
                return (
                  <div
                    key={`${faq.category}-${idx}`}
                    className="py-3.5 border-b border-gray-100 last:border-b-0"
                  >
                    <button
                      onClick={() =>
                        setOpenFaqIndex(isOpen ? null : idx)
                      }
                      className="flex items-center justify-between w-full text-left cursor-pointer group py-1"
                    >
                      <span className="text-[15px] font-medium text-primary group-hover:text-accent transition-colors pr-8">
                        {highlightText(faq.q, searchQuery)}
                      </span>
                      <ChevronRight
                        className={cn(
                          'w-4 h-4 text-gray-300 flex-shrink-0 transition-transform duration-200',
                          isOpen && 'rotate-90'
                        )}
                      />
                    </button>
                    {isOpen && (
                      <div className="bg-gray-50/50 rounded-lg -mx-3 px-3 py-3 mt-2 mb-1">
                        <p className="text-sm text-gray-500 leading-relaxed">
                          {faq.a}
                        </p>
                        <span className="text-[10px] text-gray-300 uppercase tracking-wider mt-3 inline-block">
                          {CATEGORY_LABELS[faq.category]}
                        </span>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </section>

      {/* ─── Section 5: Contact ─── */}
      <section className="bg-gray-50/70 py-14 md:py-[72px]">
        <div className="max-w-4xl mx-auto px-4 md:px-6">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {/* Form */}
            <div className="md:col-span-3">
              <h2 className="text-lg font-semibold text-primary">
                Vous ne trouvez pas la réponse ?
              </h2>
              <p className="text-sm text-gray-400 mt-1">
                Écrivez-nous, on répond sous 24h.
              </p>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mt-6 space-y-4">
                <div>
                  <label className="text-sm font-medium text-primary block mb-1.5">
                    Sujet
                  </label>
                  <select className="w-full h-10 rounded-lg border border-gray-200 text-sm px-3 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none bg-white">
                    <option>Question générale</option>
                    <option>Problème technique</option>
                    <option>Facturation</option>
                    <option>Estimation</option>
                    <option>Conformité</option>
                    <option>Partenariat</option>
                    <option>Autre</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-primary block mb-1.5">
                    Email
                  </label>
                  <input
                    type="email"
                    placeholder="votre@email.ch"
                    className="w-full h-10 rounded-lg border border-gray-200 text-sm px-3 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-primary block mb-1.5">
                    Message
                  </label>
                  <textarea
                    placeholder="Décrivez votre question..."
                    className="w-full min-h-[100px] rounded-lg border border-gray-200 text-sm px-3 py-2.5 focus:border-accent focus:ring-2 focus:ring-accent/20 outline-none resize-none"
                  />
                </div>
                <button
                  onClick={() =>
                    showToast('Message envoyé ! Réponse sous 24h.')
                  }
                  className="bg-accent text-white rounded-full w-full h-10 text-sm font-medium hover:bg-accent/90 transition-colors mt-3"
                >
                  Envoyer
                </button>
              </div>
            </div>

            {/* Info cards */}
            <div className="md:col-span-2 space-y-4 mt-0 md:mt-12">
              <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center flex-shrink-0">
                  <Mail className="w-4 h-4 text-accent" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">
                    support@megga.ch
                  </p>
                  <p className="text-xs text-gray-400">Réponse sous 24h</p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center flex-shrink-0">
                  <Clock className="w-4 h-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">
                    Lun–Ven, 9h–18h
                  </p>
                  <p className="text-xs text-gray-400">
                    Heure de Genève (CET)
                  </p>
                </div>
              </div>
              <div className="bg-white rounded-xl p-5 border border-gray-100 flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0">
                  <Zap className="w-4 h-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-primary">
                    Plans Pro & Agency
                  </p>
                  <p className="text-xs text-gray-400">
                    Temps de réponse &lt; 4h
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Section 6: CTA ─── */}
      <section className="py-14 px-4 lg:px-8 mb-12">
        <div
          className="max-w-4xl mx-auto bg-primary text-white rounded-2xl py-12 px-8 text-center relative overflow-hidden"
          style={{
            background:
              '#1A1A1A radial-gradient(ellipse at bottom right, rgba(37,99,235,0.15) 0%, transparent 60%)',
          }}
        >
          <h2 className="text-xl md:text-2xl font-bold relative z-10">
            Vous êtes agent immobilier ?
          </h2>
          <p className="text-white/50 text-sm mt-2 relative z-10">
            Créez votre compte gratuitement et accédez à tous nos outils.
          </p>
          <Link
            to="/register"
            className="inline-block bg-white text-primary rounded-full px-6 h-10 text-sm font-medium hover:bg-gray-100 mt-6 relative z-10 leading-10"
          >
            Créer mon compte agent
          </Link>
          <p className="text-white/25 text-xs mt-3 relative z-10">
            Gratuit · Sans engagement · 2 minutes
          </p>
        </div>
      </section>

      <Footer />
    </div>
  )
}
