// P7 — Santé des intégrations critiques : Resend, webhooks Stripe, calendriers
// OAuth, Realtime. 4 cartes avec pastille de statut (texte coloré, pas de fond).

import { useTranslation } from 'react-i18next'
import { Mail, CreditCard, Calendar, Radio } from 'lucide-react'
import { cn, formatRelativeDate } from '@/lib/utils'
import { useAdminIntegrationsHealth } from '@/hooks/useAdminIntegrationsHealth'
import { useRealtimeHealth } from '@/hooks/useRealtimeHealth'
import type { LucideIcon } from 'lucide-react'

type Level = 'ok' | 'warn' | 'down' | 'idle'

const DOT: Record<Level, string> = {
  ok: 'bg-emerald-500',
  warn: 'bg-amber-500',
  down: 'bg-red-500',
  idle: 'bg-theme-muted',
}

function HealthCard({ icon: Icon, title, level, lines }: {
  icon: LucideIcon; title: string; level: Level; lines: string[]
}) {
  return (
    <div className="rounded-xl border border-theme-border p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="flex items-center gap-2 text-sm font-medium text-theme-primary">
          <Icon className="h-4 w-4 text-theme-tertiary" />
          {title}
        </span>
        <span className={cn('h-2 w-2 rounded-full', DOT[level])} />
      </div>
      <div className="space-y-0.5">
        {lines.map((l, i) => (
          <p key={i} className="text-xs text-theme-secondary">{l}</p>
        ))}
      </div>
    </div>
  )
}

export default function IntegrationsHealthPanel() {
  const { t } = useTranslation('admin')
  const { data, isLoading } = useAdminIntegrationsHealth()
  const rt = useRealtimeHealth()

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-theme-border p-4 animate-pulse">
            <div className="h-4 bg-theme-hover rounded w-24 mb-3" />
            <div className="h-3 bg-theme-hover rounded w-32" />
          </div>
        ))}
      </div>
    )
  }

  const emails = data?.emails
  const wh = data?.stripe_webhook
  const cal = data?.calendar

  const emailLevel: Level = !emails ? 'idle' : emails.errors_7d > 0 ? 'warn' : 'ok'
  const whLevel: Level = !wh ? 'idle'
    : (wh.active_subscriptions >= 1 && wh.age_hours != null && wh.age_hours > 72) ? 'down'
    : wh.payment_failed_7d > 0 ? 'warn' : 'ok'
  const calLevel: Level = !cal ? 'idle' : cal.stale_total > 0 ? 'warn' : 'ok'
  const rtLevel: Level = rt.status === 'checking' ? 'idle' : rt.status === 'ok' ? 'ok' : rt.status === 'slow' ? 'warn' : 'down'

  return (
    <div>
      <h2 className="text-lg font-semibold text-theme-primary mb-3">{t('integrations.title')}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <HealthCard
          icon={Mail}
          title={t('integrations.emails.title')}
          level={emailLevel}
          lines={[
            t('integrations.emails.sent', { count24: emails?.sent_24h ?? 0, count7: emails?.sent_7d ?? 0 }),
            t('integrations.emails.errors', { count: emails?.errors_7d ?? 0 }),
          ]}
        />
        <HealthCard
          icon={CreditCard}
          title={t('integrations.stripe.title')}
          level={whLevel}
          lines={[
            wh?.last_event_at ? t('integrations.stripe.last', { when: formatRelativeDate(wh.last_event_at) }) : t('integrations.stripe.none'),
            t('integrations.stripe.events', { count: wh?.events_7d ?? 0, failed: wh?.payment_failed_7d ?? 0 }),
          ]}
        />
        <HealthCard
          icon={Calendar}
          title={t('integrations.calendar.title')}
          level={calLevel}
          lines={[
            t('integrations.calendar.connected', { google: cal?.google.connected ?? 0, outlook: cal?.outlook.connected ?? 0 }),
            t('integrations.calendar.stale', { count: cal?.stale_total ?? 0 }),
          ]}
        />
        <HealthCard
          icon={Radio}
          title={t('integrations.realtime.title')}
          level={rtLevel}
          lines={[
            t(`integrations.realtime.status_${rt.status}`),
            rt.latencyMs != null ? t('integrations.realtime.latency', { ms: rt.latencyMs }) : ' ',
          ]}
        />
      </div>
    </div>
  )
}
