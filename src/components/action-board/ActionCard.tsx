import { useState } from 'react'
import {
  Phone, Mail, Send, MapPin, FileText,
  ExternalLink, Sparkles,
  RotateCcw, List, Circle, CheckCircle2,
} from 'lucide-react'
import { motion } from 'motion/react'
import { cn } from '@/lib/utils'
import type { ActionType } from '@/hooks/useActionBoard'

// ── Icon + color mapping by action type ─────────────────────────────────────

interface ActionStyle {
  icon: typeof Phone
  iconBg: string
  iconText: string
  btnBg: string
  btnText: string
  btnBorder: string
  btnHover: string
}

const ACTION_STYLES: Record<ActionType, ActionStyle> = {
  call: {
    icon: Phone,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-purple-500/20',
    btnText: 'text-purple-300',
    btnBorder: 'border-purple-500/30',
    btnHover: 'hover:bg-purple-500/30',
  },
  email: {
    icon: Mail,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-blue-500/20',
    btnText: 'text-blue-300',
    btnBorder: 'border-blue-500/30',
    btnHover: 'hover:bg-blue-500/30',
  },
  send_property: {
    icon: Send,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-blue-500/20',
    btnText: 'text-blue-300',
    btnBorder: 'border-blue-500/30',
    btnHover: 'hover:bg-blue-500/30',
  },
  plan_visit: {
    icon: MapPin,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-amber-500/20',
    btnText: 'text-amber-300',
    btnBorder: 'border-amber-500/30',
    btnHover: 'hover:bg-amber-500/30',
  },
  review_document: {
    icon: FileText,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-gray-500/20',
    btnText: 'text-gray-300',
    btnBorder: 'border-gray-500/30',
    btnHover: 'hover:bg-gray-500/30',
  },
  view_deal: {
    icon: ExternalLink,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-gray-500/20',
    btnText: 'text-gray-300',
    btnBorder: 'border-gray-500/30',
    btnHover: 'hover:bg-gray-500/30',
  },
  view_list: {
    icon: List,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-gray-500/20',
    btnText: 'text-gray-300',
    btnBorder: 'border-gray-500/30',
    btnHover: 'hover:bg-gray-500/30',
  },
  view_analysis: {
    icon: Sparkles,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-emerald-500/20',
    btnText: 'text-emerald-300',
    btnBorder: 'border-emerald-500/30',
    btnHover: 'hover:bg-emerald-500/30',
  },
  relancer: {
    icon: RotateCcw,
    iconBg: 'bg-theme-active',
    iconText: 'text-theme-secondary',
    btnBg: 'bg-amber-500/20',
    btnText: 'text-amber-300',
    btnBorder: 'border-amber-500/30',
    btnHover: 'hover:bg-amber-500/30',
  },
}

// ── Component ───────────────────────────────────────────────────────────────

interface ActionCardProps {
  title: string
  description: string
  actionLabel: string
  actionType: ActionType
  timestamp: string
  isOverdue?: boolean

  onAction: () => void
  onComplete: () => void
  className?: string
}

export default function ActionCard({
  title,
  description,
  actionLabel,
  actionType,
  timestamp,
  isOverdue,
  onAction,
  onComplete,
  className,
}: ActionCardProps) {
  const style = ACTION_STYLES[actionType] || ACTION_STYLES.view_deal
  const Icon = style.icon

  const [completing, setCompleting] = useState(false)
  const [checkHovered, setCheckHovered] = useState(false)

  function handleComplete(e: React.MouseEvent) {
    e.stopPropagation()
    setCompleting(true)
    setTimeout(() => {
      onComplete()
      showToast()
    }, 280)
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 1, x: 0, scale: 1 }}
      animate={completing
        ? { opacity: 0, x: 20, scale: 0.98 }
        : { opacity: 1, x: 0, scale: 1 }
      }
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={cn(
        'border border-theme-border rounded-xl',
        'hover:border-theme-active hover:bg-theme-hover',
        'transition-all duration-200 cursor-pointer group',
        'px-4 py-3',
        className
      )}
    >
      <div className="flex items-start gap-3">
        {/* Left: Checkbox */}
        <button
          onClick={handleComplete}
          onMouseEnter={() => setCheckHovered(true)}
          onMouseLeave={() => setCheckHovered(false)}
          className="mt-0.5 shrink-0 transition-all duration-200"
          title="Marquer comme fait"
        >
          {checkHovered ? (
            <CheckCircle2 className="w-[20px] h-[20px] text-emerald-500" />
          ) : (
            <Circle className="w-[20px] h-[20px] stroke-[1.5] text-theme-border" />
          )}
        </button>

        {/* Center: Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {/* Icon pill */}
            <div className={cn(
              'w-6 h-6 rounded-md flex items-center justify-center shrink-0',
              style.iconBg,
            )}>
              <Icon className={cn('w-3.5 h-3.5', style.iconText)} />
            </div>
            <p className="text-sm font-medium text-theme-primary leading-snug truncate">{title}</p>
          </div>
          <div className="flex items-baseline gap-2 mt-0.5 pl-8">
            <p className="text-xs text-theme-secondary line-clamp-1 leading-relaxed">{description}</p>
            <span className={cn(
              'text-xs shrink-0',
              isOverdue ? 'text-red-500' : 'text-theme-secondary'
            )}>
              · {timestamp}
            </span>
          </div>
        </div>

        {/* Right: CTA — always visible on mobile, slide-in on hover on desktop */}
        <div className="flex items-center gap-1.5 shrink-0 ml-1 md:opacity-0 md:translate-x-2 md:group-hover:opacity-100 md:group-hover:translate-x-0 transition-all duration-200">
          <button
            onClick={(e) => { e.stopPropagation(); onAction() }}
            className="h-7 min-h-[44px] md:min-h-0 px-3 rounded-lg text-xs font-medium text-theme-secondary hover:text-theme-primary bg-theme-hover hover:bg-theme-active border border-theme-border transition-all duration-150"
          >
            <span>{actionLabel}</span>
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ── Toast helper ────────────────────────────────────────────────────────────

function showToast() {
  const existing = document.getElementById('action-toast')
  if (existing) existing.remove()

  const toast = document.createElement('div')
  toast.id = 'action-toast'
  toast.className = [
    'fixed bottom-6 right-6 z-[100]',
    'bg-theme-card border border-theme-active text-theme-primary',
    'text-sm px-4 py-2.5 rounded-lg shadow-lg',
    'flex items-center gap-2',
    'animate-in slide-in-from-bottom-4 fade-in duration-200',
  ].join(' ')
  toast.innerHTML = `<svg class="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/></svg> Action complétée`

  document.body.appendChild(toast)
  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 200ms'
    setTimeout(() => toast.remove(), 200)
  }, 2000)
}
