import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '@/hooks/useAuth'
import { formatTodayHeader } from '@/lib/utils'
import { useFocusQueue } from '@/components/crm/today/useFocusQueue'
import { selectFocusQueue } from '@/components/crm/today/focusQueue'
import { RelanceSession } from '@/components/crm/today/RelanceSession'
import { openCrmSearch } from '@/components/crm/search/openSearch'
import MEIcon from '@/components/propertyx/MEIcon'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import MeggaWordmark from '../shell/MeggaWordmark'
import { MobileFocusHero } from './MobileFocusHero'
import { MobileStatCards } from './MobileStatCards'
import { MobileAgenda } from './MobileAgenda'
import { MobileWhatsAppFollowups } from './MobileWhatsAppFollowups'
import { MobileRelancesIA } from './MobileRelancesIA'

/**
 * Cockpit « Aujourd'hui » mobile — port condensé du desktop (PageAujourdhui) :
 * en-tête (wordmark + recherche/MEGGA AI) + salutation réelle, héros file de
 * priorités, stats Pipeline + Objectif, agenda du jour, bloc Relances IA. Tout
 * est branché sur les MÊMES hooks que le desktop (useFocusQueue, usePipelineScreen,
 * useCalendarScreen, useRelanceLeads, useAxDashboardData) — gestes HITL préservés,
 * empty-states honnêtes, seeds derrière `demo`. La recherche réutilise la palette
 * existante (openCrmSearch), pas un faux moteur.
 */
export function MobileTodayScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('dashboard')
  const { tk } = useMobileTokens()
  const { profile } = useAuth()
  const { items: focusItems, isLive, isLoading, completeItem, snoozeItem } = useFocusQueue()
  const [relanceOpen, setRelanceOpen] = useState(false)

  const firstName = profile?.full_name?.trim().split(/\s+/)[0] ?? ''
  const greeting = firstName ? t('today.cockpit.greeting', { name: firstName }) : t('today.cockpit.greetingNoName')
  const headerDate = formatTodayHeader()
  const baseQueue = selectFocusQueue({ live: isLive, items: focusItems, isDemo: demo })

  return (
    <div style={{ padding: '0 var(--crm-space-4xl)', fontFamily: MOBILE_FONT }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 14px) 2px 6px' }}>
        <MeggaWordmark color={tk.ink} height={22} />
        <button
          type="button"
          onClick={() => openCrmSearch()}
          aria-label={t('common:nav.search')}
          style={{
            width: 38,
            height: 38,
            borderRadius: 'var(--crm-radius-pill)',
            border: `1px solid ${tk.cardBorder}`,
            cursor: 'pointer',
            background: tk.card,
            boxShadow: tk.shadowSm,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <MEIcon name="search" size={18} color={tk.ink} />
        </button>
      </header>

      <div style={{ padding: 'var(--crm-space-md) var(--crm-space-2xs) 0' }}>
        <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted}}>{headerDate}</div>
        <h1 style={{ margin: '4px 0 0', fontSize: 'var(--crm-text-5xl)', fontWeight: 500, letterSpacing: -0.8, color: tk.ink, lineHeight: 1.1 }}>{greeting}</h1>
      </div>

      <MobileFocusHero
        key={isLive ? 'live' : 'seed'}
        baseQueue={baseQueue}
        isLoading={isLoading && !demo}
        onDone={completeItem}
        onSnooze={snoozeItem}
      />
      <MobileStatCards demo={demo} />
      <MobileAgenda demo={demo} onSeeAll={() => navigate('/dashboard/calendar')} />
      {!demo && <MobileWhatsAppFollowups />}
      <MobileRelancesIA demo={demo} onStart={() => setRelanceOpen(true)} />

      {relanceOpen ? <RelanceSession onClose={() => setRelanceOpen(false)} /> : null}
    </div>
  )
}
