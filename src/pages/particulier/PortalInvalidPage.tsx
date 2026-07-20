/**
 * Écran d'accès refusé au portail vendeur (rendu par PortalGateway, pas de route propre).
 * Trois motifs — introuvable / expiré / révoqué — chacun avec icône, titre et texte i18n.
 */
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ShieldX, Ban } from 'lucide-react'
import { TimeCircle as Clock } from '@/components/icons'

interface PortalInvalidPageProps {
  reason: 'not_found' | 'expired' | 'revoked'
}

/** Message d'accès invalide paramétré par `reason` (not_found | expired | revoked). */
export default function PortalInvalidPage({ reason }: PortalInvalidPageProps) {
  const { t } = useTranslation('common')
  const config = {
    not_found: {
      icon: ShieldX,
      title: t('portal.invalid.notFound.title'),
      description: t('portal.invalid.notFound.description'),
    },
    expired: {
      icon: Clock,
      title: t('portal.invalid.expired.title'),
      description: t('portal.invalid.expired.description'),
    },
    revoked: {
      icon: Ban,
      title: t('portal.invalid.revoked.title'),
      description: t('portal.invalid.revoked.description'),
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
          {t('portal.invalid.backHome')}
        </Link>
      </div>
    </div>
  )
}
