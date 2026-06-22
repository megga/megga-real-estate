// MEGGA CRM Sugar v2 — Contacts page (Tier 3 part 2.1)
// 1:1 port from the Claude Design bundle (crm-screen-contacts-sugar.jsx — `CRMScreenContactsSugar`).

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import type { CrmContact, CrmDeal } from '@/components/crm-sugar/mockData'
import { useContactsSugar } from '@/hooks/useContactsSugar'
import { useCreateContact } from '@/hooks/useContacts'
import { useTransactions } from '@/hooks/useTransactions'
import { transactionToCrmDeal } from '@/lib/sugarAdapters'
import type { TransactionStage } from '@/lib/constants'
import MEIcon from '@/components/propertyx/MEIcon'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { ContactsListPane } from '@/components/crm-sugar/contacts/ContactsListPane'
import {
  ModalNewContact, type NewContactPayload,
} from '@/components/crm-sugar/contacts/ModalNewContact'
import type {
  SegmentId, SortMode,
} from '@/components/crm-sugar/contacts/helpers'

const DARK_TONE: DarkTone = 'meggaAi'

// Slugs Sources Dashboard (sync avec SOURCE_SLUGS dans DBEntonnoir.tsx). Quand le
// modèle Contact aura un champ `source`, on filtrera réellement ici. En attendant,
// on affiche un banner informatif. Le libellé humain est traduit via i18n
// (`list.sourceLabel.<slug>`) au point d'affichage.
const SOURCE_SLUGS = ['marketplace', 'agency-site', 'referral', 'social', 'manual'] as const

export default function ContactsSugarV2Page() {
  const { t: tr } = useTranslation('contacts')
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Deep-link `?source=marketplace` depuis Dashboard Analytics — handoff Sprint 4.
  // Snapshot au mount pour ne pas re-déclencher au moindre setSearchParams.
  const [sourceFilter, setSourceFilter] = useState<string | null>(() => {
    const slug = searchParams.get('source')
    return slug && (SOURCE_SLUGS as readonly string[]).includes(slug) ? slug : null
  })

  // Consomme le param une fois (URL nettoyée pour ne pas que F5 le re-applique).
  useEffect(() => {
    if (searchParams.has('source')) {
      const next = new URLSearchParams(searchParams)
      next.delete('source')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Theme: dark/light, persisted (shared with Today + Pipeline) ─────
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('megga.sugar.dark', dark ? '1' : '0')
    }
  }, [dark])

  const t = dark ? CRM_TOKENS.dark : CRM_TOKENS.light
  const sp = crmSugarPalette(t, dark, DARK_TONE)

  // ── Data source: Supabase via adapter ───────────────────────────────
  const { contacts, isLoading, isError, refetch } = useContactsSugar()
  const { data: rawTransactions = [] } = useTransactions()

  // Index : un deal (le plus récent) par contactId — pour les badges de
  // ContactsListPane. useTransactions renvoie un Transaction enrichi
  // (`property` joint), mais le type Transaction de base ne l'expose pas.
  type TransactionWithJoin = (typeof rawTransactions)[number] & {
    property?: { title: string; address: string; city: string; price: number; photos: string[] } | null
  }
  const dealsByContactId = useMemo<Record<string, CrmDeal | undefined>>(() => {
    const map: Record<string, CrmDeal | undefined> = {}
    for (const t of rawTransactions as TransactionWithJoin[]) {
      const cId = t.contact_buyer_id ?? t.contact_seller_id
      if (!cId || map[cId]) continue
      map[cId] = transactionToCrmDeal(
        {
          id: t.id,
          stage: t.stage as TransactionStage,
          status: t.status,
          price_offered: t.price_offered ?? null,
          price_final: t.price_final ?? null,
          updated_at: t.updated_at,
          property: t.property ?? null,
        },
        cId,
        t.property_id ?? null,
      )
    }
    return map
  }, [rawTransactions])

  // ── Page state ──────────────────────────────────────────────────────
  const [segment, setSegment] = useState<SegmentId>('all')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortMode>('activity')
  const [newContactOpen, setNewContactOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

  // ── Filters / sort ──────────────────────────────────────────────────
  const filtered = useMemo<CrmContact[]>(() => {
    const cutoff = new Date()
    cutoff.setDate(cutoff.getDate() - 14)
    let list = contacts.slice()

    if (segment === 'buyer') list = list.filter(c => c.type === 'buyer')
    if (segment === 'seller') list = list.filter(c => c.type === 'seller')
    if (segment === 'tenant')
      list = list.filter(
        c => c.type === 'tenant' || c.criteria?.transaction === 'location',
      )
    if (segment === 'hot') list = list.filter(c => (c.score || 0) >= 75)
    if (segment === 'kyc')
      list = list.filter(
        c => !c.kyc || c.kyc.status === 'none' || c.kyc.status === 'stale',
      )
    if (segment === 'stale')
      list = list.filter(
        c => c.lastActivityAt && new Date(c.lastActivityAt) < cutoff,
      )

    if (search) {
      const q = search.toLowerCase()
      list = list.filter(
        c =>
          (c.firstName + ' ' + c.lastName).toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          (c.tags || []).some(tag => tag.toLowerCase().includes(q)),
      )
    }

    if (sort === 'activity')
      list.sort(
        (a, b) =>
          new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime(),
      )
    if (sort === 'score') list.sort((a, b) => (b.score || 0) - (a.score || 0))
    if (sort === 'name')
      list.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || ''))

    return list
  }, [segment, search, sort, contacts])

  // ── Cmd palette / navigation ────────────────────────────────────────
  const flashToast = (msg: string) => setToast(msg)
  // Command palette pas encore wired — pas de toast "à venir" qui fait illusion.
  const onCmd = () => { /* noop */ }

  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':    navigate('/dashboard'); break
      case 'pipeline': navigate('/dashboard/pipeline'); break
      case 'matching': navigate('/dashboard/matching'); break
      case 'contacts': break // already here
      case 'biens':    navigate('/dashboard/listings'); break
      case 'biens-new':navigate('/dashboard/listings/new'); break
      case 'calendar': navigate('/dashboard/calendar'); break
      case 'kyc':      navigate('/dashboard/kyc'); break
      case 'reseau':   navigate('/dashboard/network'); break
      case 'parcours': navigate('/dashboard/journey'); break
      case 'ai':
      case 'julien':   navigate('/dashboard/julien'); break
      case 'chat':
      case 'dashboard':navigate('/dashboard/analytics'); break
      case 'settings': navigate('/dashboard/settings'); break
      default:
        /* Pas de toast "à venir" — un bouton qui ne fait rien doit disparaître. */
    }
  }

  // Map modal source slugs → DB-allowed source enum.
  // DB enforces source IN ('onboarding','manual','import','website','referral').
  // Modal offers a richer UX list — collapse the extras into 'manual' or
  // 'import' so the constraint passes. The original slug is preserved in
  // form_data for analytics + future migration to a dedicated column.
  const SOURCE_DB_MAP: Record<string, string> = {
    website: 'website',
    referral: 'referral',
    portal: 'website',
    'walk-in': 'manual',
    csv: 'import',
    other: 'manual',
  }

  const createContact = useCreateContact()
  const [createError, setCreateError] = useState<string | null>(null)

  const handleNewContactSave = async (data: NewContactPayload) => {
    setCreateError(null)
    try {
      const fullName = `${data.firstName} ${data.lastName}`.trim()
      await createContact.mutateAsync({
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phone: data.phone || undefined,
        type: data.type,
        source: SOURCE_DB_MAP[data.source] ?? 'manual',
        tags: data.tags,
        notes: data.notes || undefined,
        search_criteria: data.criteria ?? null,
        // Catch-all for UI-only fields without dedicated columns yet —
        // preserved for analytics + future schema migration.
        form_data: {
          civility: data.civility,
          lang: data.lang,
          source_slug_ui: data.source,
          linked_bien: data.linkedBien ?? null,
        },
      })
      // Cache Helpers auto-invalidates the contacts list — UI refreshes itself.
      flashToast(tr('list.toast.created', { name: fullName }))
      setNewContactOpen(false)
    } catch (e) {
      const message = e instanceof Error ? e.message : tr('list.toast.unknownError')
      setCreateError(message)
      flashToast(tr('list.toast.error', { message }))
    }
  }

  return (
    <div
      style={{
        background: sp.pageBg,
        minHeight: '100vh',
        fontFamily: '"Inter Tight", system-ui, sans-serif',
        color: sp.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES}</style>
      <SugarTopNav active="contacts" t={t} sp={sp} onNavigate={onNavigate} onCmd={onCmd} />

      <div style={{ display: 'flex', alignItems: 'flex-start' }}>
        <SugarIconRail
          active="contacts"
          onNavigate={onNavigate}
          onCmd={onCmd}
          dark={dark}
          setDark={setDark}
          sp={sp}
        />
        <main
          style={{
            flex: 1,
            minWidth: 0,
            padding: '112px 40px 80px 0',
            maxWidth: 960,
          }}
        >
          {sourceFilter && (
            <div
              role="status"
              aria-live="polite"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 16,
                padding: '12px 16px',
                borderRadius: 14,
                background: '#FFFFFF',
                boxShadow: '0 4px 16px rgba(15,23,42,0.04)',
                fontFamily: '"Inter Tight", system-ui, sans-serif',
              }}
            >
              <span
                style={{
                  padding: '3px 9px',
                  borderRadius: 999,
                  background: '#0B0C0E',
                  color: '#fff',
                  fontSize: 10,
                  fontWeight: 800,
                  letterSpacing: 0.6,
                  textTransform: 'uppercase',
                }}
              >
                {tr('list.sourceFilter.badge')}
              </span>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: '#3A3D44' }}>
                {tr('list.sourceFilter.label')}{' '}
                <strong style={{ color: '#0B0C0E', fontWeight: 800 }}>
                  {tr(`list.sourceLabel.${sourceFilter}`)}
                </strong>{' '}
                {tr('list.sourceFilter.hint')}
              </span>
              <button
                onClick={() => setSourceFilter(null)}
                aria-label={tr('list.sourceFilter.removeAria')}
                style={{
                  marginLeft: 'auto',
                  border: 0,
                  background: 'transparent',
                  color: '#7A8088',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 700,
                  padding: '4px 10px',
                }}
              >
                {tr('list.sourceFilter.remove')}
              </button>
            </div>
          )}
          <ContactsListPane
            contacts={filtered}
            allContacts={contacts}
            isLoading={isLoading}
            isError={isError}
            onRetry={refetch}
            dealsByContactId={dealsByContactId}
            selectedId={null}
            onSelect={(id) => navigate(`/dashboard/contacts/${id}`)}
            segment={segment}
            setSegment={setSegment}
            search={search}
            setSearch={setSearch}
            sort={sort}
            setSort={setSort}
            sp={sp}
            dark={dark}
            onNewContact={() => setNewContactOpen(true)}
            onImportLead={() => navigate('/dashboard/import-lead?returnTo=/dashboard/contacts')}
          />
        </main>
      </div>

      {newContactOpen && (
        <ModalNewContact
          sp={sp}
          dark={dark}
          onClose={() => {
            setCreateError(null)
            setNewContactOpen(false)
          }}
          onSave={handleNewContactSave}
          isPending={createContact.isPending}
          error={createError}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: sp.ink,
            color: sp.pageBg,
            padding: '12px 18px',
            borderRadius: 999,
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'inherit',
            boxShadow: '0 12px 32px rgba(15,23,42,0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            zIndex: 1100,
            animation: 'sugar-toast 280ms cubic-bezier(.22,1,.36,1)',
          }}
        >
          <MEIcon name="check" size={13} color={sp.pageBg} />
          {toast}
        </div>
      )}
    </div>
  )
}
