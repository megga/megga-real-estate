import {
  Home, Eye, FileText, MessageSquare, Calendar, TrendingUp,
} from 'lucide-react'
import { cn, formatCHF, formatRelativeDate } from '@/lib/utils'
import {
  SELLER_PROPERTY, SELLER_KPIS, SELLER_TIMELINE,
  type SellerTimelineEvent,
} from './sellerMockData'

const KPI_STYLES = {
  success: { bg: 'bg-success/10', text: 'text-success', border: 'border-success/20' },
  accent:  { bg: 'bg-accent/10',  text: 'text-accent',  border: 'border-accent/20' },
  warning: { bg: 'bg-warning/10', text: 'text-warning', border: 'border-warning/20' },
  primary: { bg: 'bg-primary-50', text: 'text-primary-700', border: 'border-primary-100' },
}

function timelineIcon(type: SellerTimelineEvent['type']) {
  switch (type) {
    case 'visit_planned': return <Calendar className="h-4 w-4 text-accent" />
    case 'visit_done':    return <Eye className="h-4 w-4 text-success" />
    case 'offer':         return <TrendingUp className="h-4 w-4 text-warning" />
    case 'document':      return <FileText className="h-4 w-4 text-primary-500" />
    case 'message':       return <MessageSquare className="h-4 w-4 text-accent" />
  }
}

export default function SellerDashboard() {
  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-semibold text-primary-900">
          Bonjour Marie, votre bien est entre de bonnes mains
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {SELLER_PROPERTY.title} — {SELLER_PROPERTY.address}, {SELLER_PROPERTY.city}
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {SELLER_KPIS.map((kpi) => {
          const style = KPI_STYLES[kpi.color]
          return (
            <div
              key={kpi.label}
              className={cn('rounded-card border p-5', style.border, style.bg)}
            >
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
              <p className={cn('text-2xl font-bold mt-1', style.text)}>
                {kpi.value}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Timeline */}
        <div className="lg:col-span-2 bg-white rounded-card border border-border">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-primary-900">Activité récente</h2>
          </div>
          <div className="p-6">
            <div className="relative">
              <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
              <div className="space-y-5">
                {SELLER_TIMELINE.map((event) => (
                  <div key={event.id} className="relative flex gap-4 pl-8">
                    <div className="absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white border-2 border-border flex items-center justify-center">
                      {timelineIcon(event.type)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-primary-900">{event.title}</p>
                        <span className="text-[11px] text-muted-foreground whitespace-nowrap flex-shrink-0">
                          {formatRelativeDate(event.timestamp)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Property card */}
        <div className="bg-white rounded-card border border-border overflow-hidden">
          <img
            src={SELLER_PROPERTY.photo_url}
            alt={SELLER_PROPERTY.title}
            className="w-full h-48 object-cover"
          />
          <div className="p-5 space-y-3">
            <div>
              <h3 className="text-base font-semibold text-primary-900">{SELLER_PROPERTY.title}</h3>
              <p className="text-sm text-muted-foreground">{SELLER_PROPERTY.address}, {SELLER_PROPERTY.city}</p>
            </div>
            <p className="text-xl font-bold text-primary-900">{formatCHF(SELLER_PROPERTY.price)}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{SELLER_PROPERTY.rooms} pièces</span>
              <span>·</span>
              <span>{SELLER_PROPERTY.surface_m2} m²</span>
              <span>·</span>
              <span>{SELLER_PROPERTY.type}</span>
            </div>
            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Home className="h-4 w-4 text-primary-400" />
              <span className="text-xs text-muted-foreground">Mandat</span>
              <span className="text-xs font-medium text-primary-700">{SELLER_PROPERTY.mandate_type}</span>
              <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-success bg-success/10 px-2 py-0.5 rounded-badge">
                <span className="h-1.5 w-1.5 rounded-full bg-success" />
                Actif
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
