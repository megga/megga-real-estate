/**
 * Contenu de la liste contacts mobile, rendu par `MobileContactsListPage`
 * sur `/dashboard/contacts` (onglet « Plus »). Recherche + segments +
 * lignes cliquables + FAB de création + menu d'actions. Détail du câblage réel
 * sur le docstring de `MobileContactsListScreen`.
 */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useContactsSugar } from '@/hooks/useContactsSugar'
import type { CrmContact } from '@/components/crm-sugar/mockData'
import { openSugarSearch } from '@/components/crm-sugar/search/openSearch'
import { MOBILE_FONT } from '../tokens'
import { useMobileTokens } from '../useMobileTokens'
import MeggaWordmark from '../shell/MeggaWordmark'
import SgActionMenu from '../primitives/SgActionMenu'
import ContactSeal from './ContactSeal'
import { CONTACT_SEGS, SEG_KEY, typeKey, type ContactSeg } from './shared'

const AV = ['#0041D9', '#C45A00', '#0891B2', '#6366F1', '#0E9F6E', '#9333EA']
/** Couleur d'avatar déterministe dérivée de l'id (repli si le contact n'a pas d'`avatarBg`). */
function avatarColor(id: string): string {
  let h = 0
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0
  return AV[Math.abs(h) % AV.length]
}

const DEMO: CrmContact[] = [
  { id: 'c1', type: 'buyer', firstName: 'Marie', lastName: 'Bertrand', email: 'm.bertrand@bluewin.ch', phone: '+41 79 412 88 02', lang: 'fr', status: 'active', score: 84, source: 'website', assignedTo: 'a', createdAt: '2026-04-02', lastActivityAt: '2026-06-20', kyc: { status: 'verified' }, tags: ['famille'], avatarBg: '#0041D9' },
  { id: 'c2', type: 'seller', firstName: 'Jean-Marc', lastName: 'Aebischer', email: 'jm.aeb@gmail.com', phone: '+41 78 220 11 33', lang: 'fr', status: 'qualified', score: 72, source: 'referral', assignedTo: 'a', createdAt: '2026-03-15', lastActivityAt: '2026-06-18', kyc: { status: 'pending' }, avatarBg: '#C45A00' },
  { id: 'c3', type: 'buyer', firstName: 'Nadia', lastName: 'Berset', email: 'nadia.berset@proton.me', phone: '+41 76 555 00 99', lang: 'fr', status: 'lead', score: 58, source: 'call', assignedTo: 'a', createdAt: '2026-05-01', lastActivityAt: '2026-06-10', kyc: { status: 'none' }, avatarBg: '#0891B2' },
]

/**
 * « Contacts » mobile (sous l'onglet « Plus ») — liste câblée `useContactsSugar`
 * (RÉEL, RLS agence). Recherche + segments (tous/acheteurs/vendeurs). Ligne →
 * fiche (/dashboard/contacts/:id). FAB → création. Seeds derrière `demo`.
 * v1 : ••• = appeler/e-mail/voir ; suppression différée (mutation). Segment
 * « À relancer » écarté (pas de signal réel, ne pas fabriquer).
 */
export function MobileContactsListScreen({ demo = false }: { demo?: boolean }) {
  const navigate = useNavigate()
  const { t } = useTranslation('contacts')
  const { tk } = useMobileTokens()
  const { contacts, isLoading, isError, refetch } = useContactsSugar()

  const all = demo ? DEMO : contacts
  const [query, setQuery] = useState('')
  const [seg, setSeg] = useState<ContactSeg>('all')
  const [menu, setMenu] = useState<CrmContact | null>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return all.filter((c) => {
      if (seg !== 'all' && c.type !== seg) return false
      if (!q) return true
      return [c.firstName, c.lastName, c.email, c.phone].some((s) => s?.toLowerCase().includes(q))
    })
  }, [all, seg, query])

  const showLoading = !demo && isLoading && all.length === 0
  const showError = !demo && isError

  return (
    <div style={{ fontFamily: MOBILE_FONT, color: tk.ink, position: 'relative', minHeight: '70vh' }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 'calc(env(safe-area-inset-top) + 14px) 18px 6px' }}>
        <MeggaWordmark color={tk.ink} height={22} />
        <button type="button" onClick={() => openSugarSearch()} aria-label={t('common:nav.search')} style={{ width: 38, height: 38, borderRadius: 'var(--crm-radius-pill)', border: `1px solid ${tk.cardBorder}`, cursor: 'pointer', background: tk.card, boxShadow: tk.shadowSm, display: 'grid', placeItems: 'center' }}>
          <MEIcon name="search" size={18} color={tk.ink} />
        </button>
      </header>

      <div style={{ padding: 'var(--crm-space-xs) var(--crm-space-4xl) 0' }}>
        <h1 style={{ margin: '4px 0 0', fontSize: 'var(--crm-text-6xl)', fontWeight: 800, letterSpacing: -1, color: tk.ink, lineHeight: 1.05 }}>{t('mobile.title')}</h1>
        <div style={{ marginTop: 7 }}>
          <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: tk.inkSoft }}>{t('mobile.subtitle', { count: filtered.length, total: all.length })}</span>
        </div>
      </div>

      {/* Recherche */}
      <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-4xl) 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', height: 46, padding: '0 var(--crm-space-2xl)', background: tk.card, border: `1px solid ${tk.cardBorder}`, borderRadius: 'var(--crm-radius-xl)', boxShadow: tk.shadowSm }}>
          <MEIcon name="search" size={16} color={tk.muted} strokeWidth={1.9} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t('mobile.searchPlaceholder')} style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: tk.ink }} />
          {query ? (
            <button type="button" onClick={() => setQuery('')} aria-label={t('common:actions.cancel')} style={{ border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
              <MEIcon name="close" size={16} color={tk.muted} strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      {/* Segments */}
      <div style={{ display: 'flex', gap: 'var(--crm-space-md)', overflowX: 'auto', margin: '12px 0 0', padding: 'var(--crm-space-2xs) var(--crm-space-4xl) var(--crm-space-xs)', scrollbarWidth: 'none' }}>
        {CONTACT_SEGS.map((s) => {
          const on = s === seg
          return (
            <button key={s} type="button" onClick={() => setSeg(s)} style={{ flexShrink: 0, height: 34, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: on ? 800 : 700, letterSpacing: -0.2, background: on ? tk.accent : tk.card, color: on ? tk.accentInk : tk.inkSoft, boxShadow: on ? tk.shadow : tk.shadowSm, whiteSpace: 'nowrap' }}>
              {t(SEG_KEY[s])}
            </button>
          )
        })}
      </div>

      {/* Contenu */}
      <div style={{ padding: 'var(--crm-space-3xl) var(--crm-space-4xl) 0' }}>
        {showLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            {[0, 1, 2, 3].map((i) => <div key={i} style={{ height: 66, borderRadius: 'var(--crm-radius-2xl)', background: tk.cardSubtle, boxShadow: tk.shadowSm }} />)}
          </div>
        ) : showError ? (
          <div style={{ textAlign: 'center', padding: '48px 12px' }}>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, color: tk.ink }}>{t('mobile.errorTitle')}</div>
            <button type="button" onClick={refetch} style={{ marginTop: 16, height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 800, background: tk.accent, color: tk.accentInk }}>{t('mobile.retry')}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 24px', background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadowSm, border: `1px solid ${tk.cardBorder}` }}>
            <div style={{ width: 52, height: 52, borderRadius: 'var(--crm-radius-pill)', background: tk.cardSubtle, display: 'grid', placeItems: 'center', margin: '0 auto' }}>
              <MEIcon name="users" size={24} color={tk.muted} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 800, letterSpacing: -0.4, color: tk.ink, marginTop: 14 }}>{t('mobile.emptyTitle')}</div>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: tk.muted, marginTop: 5, maxWidth: 240, marginInline: 'auto', lineHeight: 1.45 }}>{t('mobile.emptyDesc')}</div>
          </div>
        ) : (
          <div style={{ background: tk.card, borderRadius: 'var(--crm-radius-4xl)', boxShadow: tk.shadow, overflow: 'hidden' }}>
            {filtered.map((c, i) => (
              <Row key={c.id} c={c} t={t} last={i === filtered.length - 1} onOpen={() => { if (!demo) navigate(`/dashboard/contacts/${c.id}`) }} onMenu={() => setMenu(c)} />
            ))}
          </div>
        )}
      </div>

      {/* FAB */}
      {!showError ? (
        <button type="button" onClick={() => navigate('/dashboard/contacts/new')} aria-label={t('mobile.add')} style={{ position: 'fixed', right: 18, bottom: 'calc(100px + env(safe-area-inset-bottom))', zIndex: 54, width: 56, height: 56, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', background: tk.accent, color: tk.accentInk, boxShadow: tk.shadowLg, display: 'grid', placeItems: 'center' }}>
          <MEIcon name="plus" size={24} color={tk.accentInk} strokeWidth={2.2} />
        </button>
      ) : null}

      <SgActionMenu
        open={menu !== null}
        onClose={() => setMenu(null)}
        title={menu ? `${menu.firstName} ${menu.lastName}` : undefined}
        items={[
          { id: 'open', icon: 'user', label: t('mobile.act.open') },
          { id: 'call', icon: 'phone', label: t('mobile.act.call'), disabled: !menu?.phone },
          { id: 'mail', icon: 'mail', label: t('mobile.act.email'), disabled: !menu?.email },
        ]}
        onAction={(id) => {
          const c = menu
          setMenu(null)
          if (!c) return
          if (id === 'open') { if (!demo) navigate(`/dashboard/contacts/${c.id}`) }
          else if (id === 'call' && c.phone) window.location.href = `tel:${c.phone}`
          else if (id === 'mail' && c.email) window.location.href = `mailto:${c.email}`
        }}
      />
    </div>
  )
}

/** Ligne de contact : avatar + nom (+ sceau KYC si vérifié) + type/score ; corps → fiche, bouton ••• → menu. */
function Row({ c, t, last, onOpen, onMenu }: { c: CrmContact; t: TFunction; last: boolean; onOpen: () => void; onMenu: () => void }) {
  const { tk } = useMobileTokens()
  const initials = `${(c.firstName || ' ')[0]}${(c.lastName || ' ')[0]}`.toUpperCase()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', paddingRight: 'var(--crm-space-sm)', boxShadow: last ? 'none' : `inset 0 -1px 0 ${tk.hair}` }}>
      <button type="button" onClick={onOpen} style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg) var(--crm-space-xl)', border: 0, background: 'transparent', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
        <span style={{ width: 44, height: 44, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, background: c.avatarBg || avatarColor(c.id), color: '#fff', display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-xl)', fontWeight: 800 }}>{initials}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', minWidth: 0 }}>
            <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, letterSpacing: -0.3, color: tk.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.firstName} {c.lastName}</span>
            {c.kyc?.status === 'verified' ? <ContactSeal size={15} /> : null}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginTop: 2 }}>
            <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: tk.muted }}>{t(typeKey(c.type))}</span>
            {typeof c.score === 'number' ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 800, color: tk.muted, fontVariantNumeric: 'tabular-nums' }}>
                <MEIcon name="sparkle" size={11} color={tk.muted} />{c.score}
              </span>
            ) : null}
          </div>
        </div>
      </button>
      <button type="button" onClick={onMenu} aria-label={t('common:actions.options')} style={{ width: 34, height: 34, borderRadius: 'var(--crm-radius-pill)', border: 0, background: 'transparent', cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0, color: tk.ghost }}>
        <MEIcon name="more-horizontal" size={18} color={tk.ghost} />
      </button>
    </div>
  )
}
