import { Link } from 'react-router-dom'
import { ShieldX, Clock, Ban } from 'lucide-react'

interface PortalInvalidPageProps {
  reason: 'not_found' | 'expired' | 'revoked'
}

export default function PortalInvalidPage({ reason }: PortalInvalidPageProps) {
  const config = {
    not_found: {
      icon: ShieldX,
      title: 'Portail introuvable',
      description: 'Ce lien ne correspond à aucun portail vendeur. Vérifiez le lien reçu de votre agent immobilier.',
    },
    expired: {
      icon: Clock,
      title: 'Portail expiré',
      description: 'Ce portail vendeur a expiré. Contactez votre agent immobilier pour obtenir un nouveau lien.',
    },
    revoked: {
      icon: Ban,
      title: 'Accès révoqué',
      description: 'L\'accès à ce portail a été désactivé. Contactez votre agent immobilier pour plus d\'informations.',
    },
  }

  const { icon: Icon, title, description } = config[reason]

  return (
    <div className="min-h-screen bg-[#1C1C1C] flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="mx-auto w-16 h-16 rounded-full bg-[#2A2A2A] flex items-center justify-center mb-6">
          <Icon className="w-8 h-8 text-[#8E8E96]" />
        </div>
        <h1 className="text-xl font-semibold text-[#ECECEF] mb-2">{title}</h1>
        <p className="text-sm text-[#8E8E96] leading-relaxed mb-8">{description}</p>
        <Link
          to="/"
          className="inline-flex items-center h-10 px-6 rounded-lg text-sm font-medium border border-[#383838] text-[#8E8E96] hover:text-[#ECECEF] hover:border-[#555] transition-colors"
        >
          Retour à l'accueil
        </Link>
      </div>
    </div>
  )
}
