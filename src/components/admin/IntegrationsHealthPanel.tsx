// P7 — Santé des intégrations critiques : Resend, webhooks Stripe, calendriers
// OAuth, Realtime. 4 bentos Sugar (`AdminCard`) avec une pastille de statut au
// ton fonctionnel — les fonds `bg-emerald-500` / `bg-amber-500` / `bg-red-500`
// de la version précédente sont remplacés par `tones.ok/warn/err`.

import { useTranslation } from 'react-i18next'
import { Mail, CreditCard, Calendar, Radio } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { useAdminIntegrationsHealth } from '@/hooks/useAdminIntegrationsHealth'
import { useRealtimeHealth } from '@/hooks/useRealtimeHealth'
import { AdminCard, AdminGroupTitle, AdminIc, AdminSkeleton } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import type { LucideIcon } from 'lucide-react'

type Level = 'ok' | 'warn' | 'down' | 'idle'

function HealthCard({ icon: Icon, title, level, lines }: {
  icon: LucideIcon; title: string; level: Level; lines: string[]
}) {
  const { sp, tones } = useAdminSugar()
  // `idle` n'est pas un signal : la pastille reste encre douce, pas un ton vif.
  const dot: Record<Level, string> = {
    ok: tones.ok,
    warn: tones.warn,
    down: tones.err,
    idle: sp.soft,
  }

  return (
    <AdminCard padding="15px 17px">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--crm-space-lg)', marginBottom: 9 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)', minWidth: 0 }}>
          <AdminIc icon={Icon} size={16} color={sp.sub} />
          <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 700, letterSpacing: -0.2, color: sp.ink }}>{title}</span>
        </span>
        <span style={{ width: 8, height: 8, borderRadius: ADMIN_RADII.pill, background: dot[level], flexShrink: 0 }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
        {lines.map((l, i) => (
          <p key={i} style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>{l}</p>
        ))}
      </div>
    </AdminCard>
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
          <AdminSkeleton key={i} height={92} radius={ADMIN_RADII.card} />
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
      <AdminGroupTitle label={t('integrations.title')} tone="cyan" />
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
