// P8a — Bannière d'annonces plateforme (agent). Discrète (tokens thème, pas de
// fond plein), pastille de sévérité, CTA optionnel, fermeture = dismissal.
// Montée sous ImpersonateBanner dans AgentLayout.

import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { X, Info, AlertTriangle, AlertOctagon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useActiveAnnouncements } from '@/hooks/useActiveAnnouncements'

const SEVERITY = {
  info: { icon: Info, color: 'text-blue-500' },
  warning: { icon: AlertTriangle, color: 'text-amber-500' },
  critical: { icon: AlertOctagon, color: 'text-red-500' },
} as const

export default function AnnouncementsBanner() {
  const { t } = useTranslation('common')
  const { announcements, dismiss } = useActiveAnnouncements()

  if (announcements.length === 0) return null

  // Une seule à la fois (la plus récente) pour ne pas noyer l'agent.
  const a = announcements[0]
  const meta = SEVERITY[a.severity] ?? SEVERITY.info
  const Icon = meta.icon

  return (
    <div className="border-b border-theme-border bg-theme-card">
      <div className="flex items-start gap-3 px-4 md:px-6 py-2.5">
        <Icon className={cn('h-4 w-4 flex-shrink-0 mt-0.5', meta.color)} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-theme-primary">{a.title}</p>
          <p className="text-xs text-theme-secondary mt-0.5 whitespace-pre-line">{a.body}</p>
          {a.cta_label && a.cta_href && (
            <Link
              to={a.cta_href}
              className="inline-block mt-1 text-xs font-medium text-admin-accent hover:underline"
            >
              {a.cta_label}
            </Link>
          )}
        </div>
        <button
          onClick={() => dismiss.mutate(a.id)}
          aria-label={t('announcements.dismiss', { defaultValue: 'Fermer' })}
          className="flex-shrink-0 p-1 rounded text-theme-muted hover:text-theme-primary transition-colors"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
