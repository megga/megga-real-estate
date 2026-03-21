import { useAuth } from '@/hooks/useAuth'
import { FileText, Phone, Mail } from 'lucide-react'

export default function MonDossierPage() {
  const { profile } = useAuth()
  const firstName = profile?.full_name?.split(' ')[0] || 'là'

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Bienvenue, {firstName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Suivez l'avancement de votre dossier immobilier
        </p>
      </div>

      {/* Transaction status — empty state for now */}
      <div className="bg-white rounded-card border border-border shadow-card p-8 text-center">
        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
          <FileText className="h-6 w-6 text-gray-400" />
        </div>
        <h2 className="text-lg font-medium text-primary-900 mb-2">
          Aucun dossier en cours
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Vous n'avez pas encore de transaction en cours. Contactez votre agent immobilier pour démarrer votre projet.
        </p>
      </div>

      {/* Contact agent card */}
      <div className="bg-section rounded-card border border-border p-6">
        <h3 className="text-sm font-semibold text-primary-900 mb-3">
          Besoin d'aide ?
        </h3>
        <p className="text-sm text-muted-foreground mb-4">
          Notre équipe est disponible pour vous accompagner dans votre projet immobilier.
        </p>
        <div className="flex flex-wrap gap-3">
          <a
            href="tel:+41227001234"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-primary-900 bg-white rounded-button border border-border hover:bg-gray-50 transition-colors"
          >
            <Phone className="h-4 w-4" />
            Appeler
          </a>
          <a
            href="mailto:contact@megga.ch"
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-accent rounded-button hover:bg-accent/90 transition-colors"
          >
            <Mail className="h-4 w-4" />
            Envoyer un e-mail
          </a>
        </div>
      </div>
    </div>
  )
}
