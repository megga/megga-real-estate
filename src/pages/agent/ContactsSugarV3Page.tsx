// MEGGA CRM Sugar V3 — Contacts (refonte intégrée).
// Stratégie « Par audience » : sous-nav primaire par type, hero détail personnalisé,
// CTA primaire calculé par priorité métier, inline edit persistant.
//
// Port 1:1 de la maquette `refonte/crm-screen-contacts-v2.jsx` (Claude Design).
// Spec : `handoff-contacts-refonte/HANDOFF_CONTACTS_REFONTE_CLAUDE_CODE.md`.

import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CRM_TOKENS, crmSugarPalette, type DarkTone } from '@/components/crm-sugar/tokens'
import { CRM_CONTACTS } from '@/components/crm-sugar/mockData'
import {
  SugarTopNav,
  SugarIconRail,
  SUGAR_KEYFRAMES,
  type SugarScreenId,
} from '@/components/crm-sugar/SugarShell'
import { ModalPlanRdv } from '@/components/crm-sugar/contacts/ModalPlanRdv'
import {
  ModalNewContact,
  type NewContactPayload,
} from '@/components/crm-sugar/contacts/ModalNewContact'

import RcIcon from '@/components/crm-sugar/contacts-v3/RcIcon'
import { rcPalette } from '@/components/crm-sugar/contacts-v3/palette'
import {
  RC_AUDIENCE_LABELS,
  RC_FILTERS_BY_AUDIENCE,
  rcAdaptContact,
  rcInWatch,
  type RcAudience,
  type RcContact,
  type RcContactPatch,
} from '@/components/crm-sugar/contacts-v3/helpers'
import {
  RcContactRow,
  RcSubNav,
  type RcSubNavItem,
} from '@/components/crm-sugar/contacts-v3/RcPrimitives'
import { RcAudienceDetail } from '@/components/crm-sugar/contacts-v3/RcAudienceDetail'
import { crmUpdateContact } from '@/components/crm-sugar/contacts-v3/overridesStore'

const DARK_TONE: DarkTone = 'meggaAi'

// Animation Sugar Pure pour les heros / cartes
const RC_KEYFRAMES = `
@keyframes sgFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
`

export default function ContactsSugarV3Page() {
  const navigate = useNavigate()

  // ── Theme: dark/light persisté (partagé avec les autres pages Sugar) ──
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
  // Palette Sugar Pure dédiée au contenu refonte
  const SPv = useMemo(() => rcPalette(dark), [dark])

  // ── Adapter + re-render après inline edits ─────────────────────────────
  const [version, setVersion] = useState(0)
  const adapted = useMemo<RcContact[]>(
    () => CRM_CONTACTS.map(rcAdaptContact),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [version],
  )

  const handleUpdate = (
    id: string,
    patch: RcContactPatch,
  ) => {
    // Cast vers la signature de crmUpdateContact (CrmContact patch).
    crmUpdateContact(id, patch as unknown as Partial<(typeof CRM_CONTACTS)[number]>)
    setVersion(v => v + 1)
  }

  // ── State : audience / filtre secondaire / recherche / sélection ──────
  const [audience, setAudience] = useState<RcAudience>('buyer')
  const [filter, setFilter] = useState<string>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [rdvOpen, setRdvOpen] = useState(false)
  const [newOpen, setNewOpen] = useState(false)

  const popOf = (a: RcAudience): RcContact[] =>
    a === 'watch'
      ? adapted.filter(rcInWatch)
      : adapted.filter(c => c.type === a)

  const counts: Record<RcAudience, number> = {
    buyer: popOf('buyer').length,
    seller: popOf('seller').length,
    tenant: popOf('tenant').length,
    watch: popOf('watch').length,
  }

  const base = popOf(audience)
  const filterDefs = RC_FILTERS_BY_AUDIENCE[audience]
  const activeFilter =
    filterDefs.find(f => f.id === filter) || filterDefs[0]

  const filtered = base
    .filter(activeFilter.match)
    .filter(c => {
      if (!query.trim()) return true
      const q = query.toLowerCase()
      return (
        c.firstName +
        ' ' +
        c.lastName +
        ' ' +
        (c.email || '') +
        ' ' +
        (c.tags || []).join(' ')
      )
        .toLowerCase()
        .includes(q)
    })

  // Reset du filtre secondaire au changement d'audience
  useEffect(() => {
    setFilter('all')
  }, [audience])

  // Auto-select premier élément du filtre courant
  useEffect(() => {
    if (filtered.length > 0) {
      if (!filtered.find(c => c.id === selectedId)) {
        setSelectedId(filtered[0].id)
      }
    } else {
      setSelectedId(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audience, filter, query, version])

  const selected = filtered.find(c => c.id === selectedId)

  const AUDIENCE_ITEMS: RcSubNavItem[] = [
    { id: 'buyer', label: 'Acheteurs', icon: 'bag', count: counts.buyer },
    { id: 'seller', label: 'Vendeurs', icon: 'home', count: counts.seller },
    { id: 'tenant', label: 'Locataires', icon: 'key', count: counts.tenant },
    { id: 'watch', label: 'À surveiller', icon: 'flame', count: counts.watch },
  ]
  const FILTER_ITEMS: RcSubNavItem[] = filterDefs.map(f => ({
    id: f.id,
    label: f.label,
    count: base.filter(f.match).length,
  }))

  // ── Cmd palette / navigation ──────────────────────────────────────────
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    if (!toast) return
    const id = window.setTimeout(() => setToast(null), 2400)
    return () => window.clearTimeout(id)
  }, [toast])

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
      case 'bien-detail':
        navigate('/dashboard/listings'); break
      case 'deal-detail':
        navigate('/dashboard/pipeline'); break
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
      case 'chat':
      case 'dashboard':
        navigate('/dashboard/analytics'); break
      case 'settings':
        navigate('/dashboard/settings'); break
      case 'parcours':
      case 'add':
      case 'search':
        flashToast(`${id} — à venir`); break
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
        background: SPv.bgGradient,
        minHeight: '100vh',
        fontFamily: 'Manrope, system-ui, sans-serif',
        color: SPv.ink,
      }}
    >
      <style>{SUGAR_KEYFRAMES + RC_KEYFRAMES}</style>
      <SugarTopNav
        active="contacts"
        t={t}
        sp={sp}
        onNavigate={onNavigate}
        onCmd={onCmd}
        dark={dark}
      />
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
          }}
        >
          {/* ─── Toolbar unifiée (pattern Documents / Calendrier) ─── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              background: SPv.card,
              borderRadius: 18,
              padding: '12px 16px',
              boxShadow: SPv.shadow,
              animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
            }}
          >
            <div style={{ flexShrink: 0, minWidth: 160 }}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  color: SPv.muted,
                  letterSpacing: 1.4,
                  textTransform: 'uppercase',
                  lineHeight: 1,
                }}
              >
                Contacts
              </div>
              <div
                style={{
                  fontSize: 18,
                  fontWeight: 700,
                  color: SPv.ink,
                  letterSpacing: -0.3,
                  marginTop: 4,
                  lineHeight: 1.1,
                }}
              >
                {filtered.length}{' '}
                {filtered.length > 1 ? 'contacts' : 'contact'}
                <span style={{ color: SPv.muted, fontWeight: 500 }}>
                  {' · '}
                  {RC_AUDIENCE_LABELS[audience].toLowerCase()}
                </span>
              </div>
            </div>

            <div
              style={{
                width: 1,
                height: 36,
                background: SPv.line,
                flexShrink: 0,
              }}
            />

            <div
              style={{
                flex: 1,
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              <RcSubNav
                items={AUDIENCE_ITEMS}
                value={audience}
                onChange={id => setAudience(id as RcAudience)}
                sp={SPv}
              />
            </div>

            <button
              type="button"
              onClick={() =>
                navigate('/dashboard/import-lead?returnTo=/dashboard/contacts')
              }
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                border: 0,
                background: SPv.cardSubtle,
                color: SPv.inkSoft,
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                flexShrink: 0,
              }}
            >
              <RcIcon name="sparkle" size={13} stroke={SPv.inkSoft} />
              Importer un lead
            </button>
            <button
              type="button"
              onClick={() => setNewOpen(true)}
              style={{
                height: 38,
                padding: '0 18px',
                borderRadius: 999,
                border: 0,
                background: SPv.black,
                color: SPv.inkInverse,
                fontFamily: 'inherit',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                flexShrink: 0,
                boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
              }}
            >
              <RcIcon name="plus" size={13} stroke={SPv.inkInverse} sw={2.2} />
              Nouveau contact
            </button>
          </div>

          {/* ─── Filtres secondaires + recherche ─── */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexWrap: 'wrap',
              padding: '10px 2px 22px',
            }}
          >
            <RcSubNav
              items={FILTER_ITEMS}
              value={filter}
              onChange={setFilter}
              sp={SPv}
            />
            <div style={{ flex: 1 }} />
            <div
              style={{
                height: 38,
                padding: '0 16px',
                borderRadius: 999,
                background: SPv.card,
                boxShadow: SPv.shadowSm,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                minWidth: 260,
              }}
            >
              <RcIcon name="search" size={13} stroke={SPv.muted} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder={`Rechercher dans ${RC_AUDIENCE_LABELS[
                  audience
                ].toLowerCase()}…`}
                style={{
                  flex: 1,
                  border: 0,
                  outline: 'none',
                  background: 'transparent',
                  fontFamily: 'inherit',
                  fontSize: 13,
                  color: SPv.ink,
                  fontWeight: 500,
                }}
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: SPv.muted,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 14,
                  }}
                >
                  ×
                </button>
              )}
            </div>
          </div>

          {/* ─── Split list / detail ─── */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '380px 1fr',
              gap: 22,
              alignItems: 'start',
            }}
          >
            <aside
              style={{
                background: SPv.card,
                borderRadius: 24,
                padding: '10px 8px',
                boxShadow: SPv.shadow,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
                minHeight: 520,
              }}
            >
              {filtered.length === 0 ? (
                <div
                  style={{
                    padding: 40,
                    textAlign: 'center',
                    color: SPv.muted,
                    fontSize: 13,
                  }}
                >
                  Aucun contact ne correspond à ce filtre.
                </div>
              ) : (
                filtered.map(c => (
                  <RcContactRow
                    key={c.id}
                    contact={c}
                    selected={c.id === selectedId}
                    onClick={() => setSelectedId(c.id)}
                    sp={SPv}
                  />
                ))
              )}
            </aside>

            {selected && (
              <RcAudienceDetail
                contact={selected}
                audience={audience}
                onUpdate={patch => handleUpdate(selected.id, patch)}
                onNavigate={onNavigate}
                onOpenRdv={() => setRdvOpen(true)}
                sp={SPv}
              />
            )}
          </div>
        </main>
      </div>

      {/* Modals réutilisés tels quels (CtModalPlanRdv + CtModalNewContact) */}
      {rdvOpen && selected && (
        <ModalPlanRdv
          // Cast : ModalPlanRdv attend la forme CrmContact d'origine.
          // RcContact étend CrmContact (sauf `kyc` mapé en string + `type` élargi).
          contact={CRM_CONTACTS.find(c => c.id === selected.id)!}
          sp={sp}
          dark={dark}
          onClose={() => setRdvOpen(false)}
          onSave={() => {
            setRdvOpen(false)
            flashToast('RDV planifié')
          }}
        />
      )}
      {newOpen && (
        <ModalNewContact
          sp={sp}
          dark={dark}
          onClose={() => setNewOpen(false)}
          onSave={data => {
            setNewOpen(false)
            handleNewContactSave(data)
          }}
        />
      )}

      {toast && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: SPv.black,
            color: SPv.inkInverse,
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
            animation: 'sgFadeUp .28s cubic-bezier(.22,1,.36,1)',
          }}
        >
          <RcIcon name="check" size={13} stroke={SPv.inkInverse} />
          {toast}
        </div>
      )}
    </div>
  )
}
