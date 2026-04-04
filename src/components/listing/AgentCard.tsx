import { Phone, Mail, User, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentCardProps {
  agent: {
    name: string
    agency: string
    phone: string
    email: string
    photo: string
  }
  variant?: 'default' | 'compact'
  onClick?: () => void
  className?: string
}

export default function AgentCard({ agent, variant = 'default', onClick, className }: AgentCardProps) {
  if (variant === 'compact') {
    const Wrapper = onClick ? 'button' : 'div'
    return (
      <Wrapper
        onClick={onClick}
        className={cn(
          'w-full flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-100 hover:border-gray-200 hover:bg-gray-100 transition-colors p-3 text-left',
          onClick && 'cursor-pointer',
          className
        )}
      >
        <div className="w-10 h-10 rounded-full overflow-hidden bg-accent/10 flex-shrink-0">
          {agent.photo && agent.photo !== '/megga-gg.svg' ? (
            <img src={agent.photo} alt={agent.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-[10px] font-bold text-accent">
              {agent.agency
                ? agent.agency.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
                : <User className="h-4 w-4 text-accent" />}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold text-gray-900 truncate">{agent.name || agent.agency}</p>
        </div>
        <span className="text-xs text-accent font-medium flex-shrink-0 flex items-center gap-0.5">
          Contacter
          <ChevronRight className="h-3 w-3" />
        </span>
      </Wrapper>
    )
  }

  // variant === 'default'
  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full overflow-hidden bg-gray-100 flex-shrink-0">
          {agent.photo && agent.photo !== '/megga-gg.svg' ? (
            <img src={agent.photo} alt={agent.name} className="h-full w-full object-cover" />
          ) : (
            <div className="h-full w-full flex items-center justify-center bg-accent/10">
              <User className="h-5 w-5 text-accent" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{agent.name}</p>
          <p className="text-xs text-gray-500 truncate">{agent.agency}</p>
        </div>
      </div>

      <div className="space-y-2">
        {agent.phone && (
          <a
            href={`tel:${agent.phone}`}
            className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-accent transition-colors group"
          >
            <div className="h-7 w-7 rounded-lg bg-gray-50 group-hover:bg-accent/10 flex items-center justify-center transition-colors flex-shrink-0">
              <Phone className="h-3.5 w-3.5 text-gray-400 group-hover:text-accent" />
            </div>
            {agent.phone}
          </a>
        )}
        {agent.email && (
          <a
            href={`mailto:${agent.email}`}
            className="flex items-center gap-2.5 text-sm text-gray-600 hover:text-accent transition-colors group"
          >
            <div className="h-7 w-7 rounded-lg bg-gray-50 group-hover:bg-accent/10 flex items-center justify-center transition-colors flex-shrink-0">
              <Mail className="h-3.5 w-3.5 text-gray-400 group-hover:text-accent" />
            </div>
            <span className="truncate">{agent.email}</span>
          </a>
        )}
      </div>
    </div>
  )
}
