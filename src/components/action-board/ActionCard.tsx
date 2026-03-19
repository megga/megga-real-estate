import {
  Phone, Mail, MessageCircle, Send, MapPin,
  FileText, ExternalLink, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ActionType } from '@/hooks/useActionBoard'

const ACTION_ICONS: Record<ActionType, typeof Phone> = {
  call: Phone,
  email: Mail,
  whatsapp: MessageCircle,
  send_property: Send,
  plan_visit: MapPin,
  review_document: FileText,
  view_deal: ExternalLink,
}

const ACTION_COLORS: Record<ActionType, string> = {
  call: 'bg-purple-100 text-purple-600 hover:bg-purple-200',
  email: 'bg-blue-100 text-blue-600 hover:bg-blue-200',
  whatsapp: 'bg-green-100 text-green-600 hover:bg-green-200',
  send_property: 'bg-cyan-100 text-cyan-600 hover:bg-cyan-200',
  plan_visit: 'bg-orange-100 text-orange-600 hover:bg-orange-200',
  review_document: 'bg-gray-100 text-gray-600 hover:bg-gray-200',
  view_deal: 'bg-accent/10 text-accent hover:bg-accent/20',
}

interface ActionCardProps {
  title: string
  description: string
  actionLabel: string
  actionType: ActionType
  onAction: () => void
  onComplete: () => void
  className?: string
}

export default function ActionCard({
  title,
  description,
  actionLabel,
  actionType,
  onAction,
  onComplete,
  className,
}: ActionCardProps) {
  const Icon = ACTION_ICONS[actionType]
  const btnColor = ACTION_COLORS[actionType]

  return (
    <div className={cn('flex items-start gap-3 p-3 rounded-lg bg-white/60 hover:bg-white transition-colors', className)}>
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center flex-shrink-0', btnColor.split(' ').slice(0, 2).join(' '))}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-primary-900">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
        <div className="flex items-center gap-2 mt-2">
          <button
            onClick={onAction}
            className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-button transition-colors', btnColor)}
          >
            <Icon className="h-3 w-3" />
            {actionLabel}
          </button>
          <button
            onClick={onComplete}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-success px-2 py-1.5 rounded-button hover:bg-success/10 transition-colors"
            title="Marquer comme fait"
          >
            <Check className="h-3 w-3" />
            Fait
          </button>
        </div>
      </div>
    </div>
  )
}
