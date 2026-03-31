import { useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Loader2, ArrowRight, Check } from 'lucide-react'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import { useCreateTicket } from '@/hooks/useTickets'

const CATEGORIES = [
  { value: 'bug', label: 'Signaler un bug' },
  { value: 'feature_request', label: 'Demande de fonctionnalité' },
  { value: 'billing', label: 'Facturation et abonnement' },
  { value: 'account', label: 'Mon compte' },
  { value: 'onboarding', label: 'Aide au démarrage' },
  { value: 'kyc', label: 'KYC et conformité' },
  { value: 'general', label: 'Question générale' },
]

export default function HelpContactPage() {
  const createTicket = useCreateTicket()
  const [form, setForm] = useState({ category: '', name: '', email: '', subject: '', message: '' })
  const [result, setResult] = useState<{ ticketNumber: string; accessToken: string } | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.category || !form.name || !form.email || !form.subject || !form.message) return
    const res = await createTicket.mutateAsync(form)
    setResult(res)
  }

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

  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <div className="max-w-xl mx-auto px-4 py-12">
        <div className="flex items-center gap-1.5 text-sm text-gray-400 mb-8">
          <Link to="/aide" className="hover:text-gray-600 transition-colors">Centre d'aide</Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-gray-700">Contact</span>
        </div>

        <h1 className="text-2xl font-semibold text-gray-900 mb-2">Envoyer une demande</h1>

        <div className="rounded-lg bg-gray-50 border border-gray-100 p-4 mb-8">
          <p className="text-sm text-gray-600">Avant de nous écrire, avez-vous consulté notre centre d'aide ?</p>
          <Link to="/aide" className="text-sm text-gray-900 font-medium hover:text-accent transition-colors inline-flex items-center gap-1 mt-1">
            Parcourir les guides <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

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
              {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
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

        <p className="text-xs text-gray-400 text-center mt-4">Nous répondons sous 24h en jours ouvrés.</p>
      </div>
      <Footer />
    </div>
  )
}
