import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Loader2, ArrowRight, Check, ArrowLeft } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import AgentIllustration from '@/components/illustrations/AgentIllustration'
import SellerIllustration from '@/components/illustrations/SellerIllustration'
import BuyerIllustration from '@/components/illustrations/BuyerIllustration'
import { useCreateTicket } from '@/hooks/useTickets'

const PERSONAS = [
  {
    id: 'agent',
    label: 'Je suis agent immobilier',
    Illustration: AgentIllustration,
    border: 'hover:border-blue-300 focus:border-blue-400',
    categories: [
      { value: 'bug', label: 'Signaler un bug' },
      { value: 'feature_request', label: 'Demande de fonctionnalité' },
      { value: 'account', label: 'Mon compte' },
      { value: 'billing', label: 'Facturation et abonnement' },
      { value: 'onboarding', label: 'Aide au démarrage' },
      { value: 'kyc', label: 'KYC et conformité' },
      { value: 'general', label: 'Question générale' },
    ],
  },
  {
    id: 'seller',
    label: 'Je suis propriétaire ou vendeur',
    Illustration: SellerIllustration,
    border: 'hover:border-emerald-300 focus:border-emerald-400',
    categories: [
      { value: 'account', label: 'Mon compte' },
      { value: 'portal', label: 'Portail vendeur' },
      { value: 'estimation', label: 'Mon estimation' },
      { value: 'mandate', label: 'Mandat et documents' },
      { value: 'general', label: 'Question générale' },
    ],
  },
  {
    id: 'buyer',
    label: 'Je suis acheteur ou locataire',
    Illustration: BuyerIllustration,
    border: 'hover:border-purple-300 focus:border-purple-400',
    categories: [
      { value: 'search', label: 'Recherche de biens' },
      { value: 'visit', label: 'Visites' },
      { value: 'financing', label: 'Accessibilité et financement' },
      { value: 'account', label: 'Mon compte' },
      { value: 'general', label: 'Question générale' },
    ],
  },
]

export default function HelpContactPage() {
  const createTicket = useCreateTicket()
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [form, setForm] = useState({ category: '', name: '', email: '', subject: '', message: '' })
  const [result, setResult] = useState<{ ticketNumber: string; accessToken: string } | null>(null)

  const persona = PERSONAS.find(p => p.id === selectedPersona)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category || !form.name || !form.email || !form.subject || !form.message) return
    const res = await createTicket.mutateAsync(form)
    setResult(res)
  }

  // ── Success screen ──
  if (result) {
    const trackingUrl = `/support/${result.ticketNumber}?token=${result.accessToken}`
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-20 text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
            <Check className="w-7 h-7 text-emerald-600" />
          </div>
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Votre demande a été envoyée</h1>
          <p className="text-sm text-gray-500 mb-1">Numéro de ticket : <strong>{result.ticketNumber}</strong></p>
          <p className="text-sm text-gray-500 mb-6">Nous vous répondrons à <strong>{form.email}</strong> sous 24h en jours ouvrés.</p>
          <div className="flex items-center justify-center gap-3">
            <Link to={trackingUrl} className="h-9 px-4 rounded-lg text-sm font-medium border border-gray-200 text-gray-600 hover:border-gray-400 transition-colors inline-flex items-center gap-1.5">
              Suivre mon ticket <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link to="/aide" className="h-9 px-4 rounded-lg text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors inline-flex items-center">
              Retour au centre d'aide
            </Link>
          </div>
        </div>
        <Footer />
      </div>
    )
  }

  // ── Form screen (after persona selected) ──
  if (selectedPersona && persona) {
    return (
      <div className="min-h-screen bg-white">
        <Navbar />
        <div className="max-w-xl mx-auto px-4 py-12">
          <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-8">
            <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
            <ChevronRight className="h-3.5 w-3.5" />
            <button onClick={() => setSelectedPersona(null)} className="hover:text-gray-600 transition-colors">Contact</button>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-gray-700">{persona.label}</span>
          </div>

          <button
            onClick={() => setSelectedPersona(null)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Changer de profil
          </button>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Envoyer une demande</h1>
          <p className="text-sm text-gray-500 mb-8">
            Décrivez votre demande, nous vous répondons sous 24h ouvrées.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Catégorie *</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                required
                className="w-full h-11 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 bg-white"
              >
                <option value="">Choisir une catégorie</option>
                {persona.categories.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre nom *</label>
              <input
                type="text"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                required
                className="w-full h-11 px-3.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Votre email *</label>
              <input
                type="email"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                required
                className="w-full h-11 px-3.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Sujet *</label>
              <input
                type="text"
                value={form.subject}
                onChange={e => setForm(f => ({ ...f, subject: e.target.value }))}
                required
                className="w-full h-11 px-3.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Décrivez votre demande *</label>
              <textarea
                value={form.message}
                onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
                required
                rows={5}
                className="w-full text-sm border border-gray-200 rounded-lg px-3.5 py-2.5 focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/20 resize-none"
              />
            </div>

            {createTicket.isError && (
              <p className="text-xs text-red-600">Une erreur est survenue. Veuillez réessayer.</p>
            )}

            <button
              type="submit"
              disabled={createTicket.isPending || !form.category || !form.name || !form.email || !form.subject || !form.message}
              className="w-full h-11 rounded-lg bg-gray-900 text-white text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 flex items-center justify-center"
            >
              {createTicket.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Envoyer ma demande'}
            </button>
          </form>

          </div>
        <Footer />
      </div>
    )
  }

  // ── Persona selection screen (Zillow-style) ──
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-5xl mx-auto px-4 py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-10">
          <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">Contact</span>
        </div>

        {/* Header — Zillow style */}
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">Contacter le support</h1>
        <p className="text-base text-gray-500 mb-14 max-w-xl">
          Quelques questions pour vous orienter au bon endroit.
        </p>

        {/* 3 persona cards — Zillow layout */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8">
          {PERSONAS.map(p => (
            <button
              key={p.id}
              onClick={() => setSelectedPersona(p.id)}
              className={`group flex flex-col items-center text-center rounded-2xl border-2 border-gray-100 bg-white transition-all duration-200 cursor-pointer ${p.border} focus:outline-none focus:ring-2 focus:ring-accent/20`}
            >
              {/* Illustration container — fixed aspect ratio like Zillow */}
              <div className="w-full aspect-[4/3] flex items-center justify-center p-6 pt-8">
                <p.Illustration className="w-full h-full max-w-[260px]" />
              </div>

              {/* Label */}
              <p className="text-base font-bold text-gray-900 px-4 pb-6 leading-snug">
                {p.label}
              </p>
            </button>
          ))}
        </div>
      </div>
      <Footer />
    </div>
  )
}
