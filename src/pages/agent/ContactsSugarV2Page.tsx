// MEGGA CRM Sugar v2 — Contacts page (Tier 3 part 2.1)
// 1:1 port from the Claude Design bundle (crm-screen-contacts-sugar.jsx — `CRMScreenContactsSugar`).

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  CRM_TOKENS, crmSugarPalette, type DarkTone,
} from '@/components/crm-sugar/tokens'
import {
  CRM_CONTACTS, crmContactById, type CrmContact,
} from '@/components/crm-sugar/mockData'
import CRMIcon from '@/components/crm-sugar/CRMIcon'
import {
  SugarTopNav, SugarIconRail, SUGAR_KEYFRAMES, type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { ContactsListPane } from '@/components/crm-sugar/contacts/ContactsListPane'
import { ContactsDetailPane } from '@/components/crm-sugar/contacts/ContactsDetailPane'
import {
  ModalNewContact, type NewContactPayload,
} from '@/components/crm-sugar/contacts/ModalNewContact'
import type {
  SegmentId, SortMode,
} from '@/components/crm-sugar/contacts/helpers'

const DARK_TONE: DarkTone = 'meggaAi'

export default function ContactsSugarV2Page() {
  const navigate = useNavigate()

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

  // ── Page state ──────────────────────────────────────────────────────
  const [selectedId, setSelectedId] = useState<string>('c-001')
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
    let list = CRM_CONTACTS.slice()

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
  }, [segment, search, sort])

  // Auto-select first if current isn't in filtered
  useEffect(() => {
    if (filtered.length > 0 && !filtered.find(c => c.id === selectedId)) {
      setSelectedId(filtered[0].id)
    }
  }, [filtered, selectedId])

  const selected = crmContactById(selectedId)

  // ── Cmd palette / navigation ────────────────────────────────────────
  const flashToast = (msg: string) => setToast(msg)
  const onCmd = () => flashToast('Recherche — ⌘K (à venir)')

  const onNavigate = (id: SugarScreenId | string) => {
    switch (id) {
      case 'today':
        navigate('/dashboard'); break
      case 'pipeline':
        navigate('/dashboard/pipeline'); break
      case 'matching':
        navigate('/dashboard/matching'); break
      case 'contacts':
        break // already here
      case 'biens':
        navigate('/dashboard/listings'); break
      case 'biens-new':
        navigate('/dashboard/listings/new'); break
      case 'calendar':
        navigate('/dashboard/calendar'); break
      case 'docs':
        navigate('/dashboard/documents'); break
      case 'kyc':
        navigate('/dashboard/kyc'); break
      case 'reseau':
        navigate('/dashboard/reseau'); break
      case 'ai':
      case 'julien':
        navigate('/dashboard/julien'); break
      case 'auto':
        navigate('/dashboard/automation'); break
      case 'chat':
        navigate('/dashboard/messages'); break
      case 'dashboard':
        navigate('/dashboard/analytics'); break
      case 'settings':
        navigate('/dashboard/settings'); break
      case 'parcours':
      case 'julien':
      case 'ai':
      case 'add':
      case 'search':
        flashToast(`${id} — à venir dans Tier 3`); break
      default:
        flashToast(`${id} — à venir`)
    }
  }

  const handleNewContactSave = (data: NewContactPayload) => {
    const fullName = `${data.firstName} ${data.lastName}`.trim()
    flashToast(`Contact créé — ${fullName}`)
  }

  return (
    <div
      style={{
        background: sp.pageBg,
        minHeight: '100vh',
        fontFamily: 'Manrope, system-ui, sans-serif',
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
            display: 'grid',
            gridTemplateColumns: '360px 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <ContactsListPane
            contacts={filtered}
            selectedId={selectedId}
            onSelect={setSelectedId}
            segment={segment}
            setSegment={setSegment}
            search={search}
            setSearch={setSearch}
            sort={sort}
            setSort={setSort}
            sp={sp}
            dark={dark}
            onNewContact={() => setNewContactOpen(true)}
          />
          <ContactsDetailPane
            contact={selected}
            sp={sp}
            dark={dark}
            onPlanRdv={flashToast}
          />
        </main>
      </div>

      {newContactOpen && (
        <ModalNewContact
          sp={sp}
          dark={dark}
          onClose={() => setNewContactOpen(false)}
          onSave={handleNewContactSave}
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
          <CRMIcon name="check" size={13} stroke={sp.pageBg} />
          {toast}
        </div>
      )}
    </div>
  )
}
