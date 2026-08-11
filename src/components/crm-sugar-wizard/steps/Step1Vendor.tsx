// MEGGA CRM Sugar v2 Wizard — Step 1a : Vendeur (recherche + création)
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step1.jsx — `SgStepVendor`).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, sgOn, type WizardData } from '../tokens'
import { SgAvatar, SgKycChip, SgInput } from '../primitives'
import { type CrmContact } from '@/components/crm-sugar/mockData'
import { useContactsSugar } from '@/hooks/useContactsSugar'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

export function Step1Vendor({ data, set }: StepProps) {
  const { t } = useTranslation('listings')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', phone: '' })

  // Vrais contacts de l'agence (Supabase, RLS agency-scoped, ids = UUID réels
  // via contactToCrm). Sélectionner un vendeur pose ownerContactId = UUID →
  // transactions.contact_seller_id valide. Auparavant le mock CRM_CONTACTS
  // posait un id 'c-001' → 22P02 avalé dans WizardShell, lien vendeur perdu en
  // silence même dans une agence vierge (elle listait 9 vendeurs fictifs).
  const { contacts: allContacts } = useContactsSugar()
  const sellers = allContacts.filter(c => c.type === 'seller')
  const others = allContacts.filter(c => c.type !== 'seller')

  const matches = q.trim().length === 0
    ? sellers
    : [...sellers, ...others].filter(c => {
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase()
        return hay.includes(q.trim().toLowerCase())
      })

  const selected = data.ownerContactId ? allContacts.find(c => c.id === data.ownerContactId) : null

  // Vendeur EXISTANT : on fige un snapshot d'affichage (les étapes aval ne
  // peuvent pas re-résoudre par id — registry vidé au démontage) et on efface
  // tout brouillon éventuel (l'agent a finalement choisi un contact réel).
  const selectContact = (c: CrmContact) => set({
    ownerContactId: c.id,
    _ownerContact: {
      id: c.id, firstName: c.firstName, lastName: c.lastName,
      email: c.email, phone: c.phone, type: c.type,
      kyc: { status: c.kyc?.status ?? 'none' }, avatarBg: c.avatarBg,
    },
    _newContact: null,
  })

  const startCreate = () => {
    setCreating(true)
    const parts = q.trim().split(/\s+/)
    if (parts.length >= 2) {
      setNewContact({ firstName: parts[0], lastName: parts.slice(1).join(' '), email: '', phone: '' })
    } else if (parts.length === 1 && q.includes('@')) {
      setNewContact({ firstName: '', lastName: '', email: q, phone: '' })
    } else {
      setNewContact({ firstName: q, lastName: '', email: '', phone: '' })
    }
  }

  const saveNew = () => {
    const id = `c-new-${Date.now()}`
    set({
      ownerContactId: id,
      _newContact: { ...newContact, id, type: 'seller', kyc: { status: 'none' }, avatarBg: SugarV2.pop1 },
      _ownerContact: null,
    })
    setCreating(false)
  }

  return (
    <div style={{
      maxWidth: 920, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
        <div style={{
          fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{t('wizard.step1.vendor.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 'var(--crm-text-9xl)', fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{t('wizard.step1.vendor.title')}</h1>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-xl)', color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {t('wizard.step1.vendor.subtitle')}
        </p>
      </div>

      {/* Sélectionné */}
      {selected && !creating && (
        <div style={{
          background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: SugarV2.shadowLg, padding: 'var(--crm-space-5xl)',
          marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4xl)',
          animation: 'sgScaleIn .4s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <SgAvatar contact={selected} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3 }}>
                {selected.firstName} {selected.lastName}
              </span>
              <SgKycChip status={selected.kyc?.status} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-lg)', color: SugarV2.inkSoft, fontWeight: 500 }}>
              {selected.email} · {selected.phone}
            </div>
          </div>
          <button onClick={() => set({ ownerContactId: null, _ownerContact: null, _newContact: null })} style={{
            height: 36, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
            background: SugarV2.cardSubtle, color: SugarV2.inkSoft,
            fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
          }}>{t('wizard.step1.vendor.change')}</button>
        </div>
      )}

      {/* Recherche / Création */}
      {!selected && !creating && (
        <>
          <div style={{
            background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)', padding: 'var(--crm-space-md) var(--crm-space-md) var(--crm-space-md) var(--crm-space-6xl)',
            boxShadow: SugarV2.shadow,
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)',
            marginBottom: 18,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={SugarV2.muted} strokeWidth="1.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder={t('wizard.step1.vendor.searchPlaceholder')}
              style={{
                flex: 1, height: 56, border: 0, background: 'transparent',
                outline: 'none', fontFamily: 'inherit',
                fontSize: 'var(--crm-text-2xl)', color: SugarV2.ink, fontWeight: 500,
              }} />
            {q.length > 0 && (
              <button onClick={startCreate} style={{
                height: 44, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                background: SugarV2.black, color: sgOn(),
                fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
                boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
              }}>{t('wizard.step1.vendor.newButton')}</button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            {q.length === 0 && sellers.length > 0 && (
              <div style={{
                fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted,
                letterSpacing: 1, textTransform: 'uppercase',
                padding: 'var(--crm-space-sm) var(--crm-space-xs)',
              }}>{t('wizard.step1.vendor.recentSellers')}</div>
            )}
            {q.trim().length > 0 && matches.length === 0 ? (
              <div style={{
                background: SugarV2.card, borderRadius: 'var(--crm-radius-4xl)', padding: 28,
                boxShadow: SugarV2.shadowSm, textAlign: 'center',
              }}>
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: SugarV2.ink, marginBottom: 6 }}>
                  {t('wizard.step1.vendor.noMatchTitle', { query: q })}
                </div>
                <div style={{ fontSize: 'var(--crm-text-lg)', color: SugarV2.muted, marginBottom: 16 }}>
                  {t('wizard.step1.vendor.noMatchBody')}
                </div>
                <button onClick={startCreate} style={{
                  height: 42, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                  background: SugarV2.black, color: sgOn(),
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
                }}>{t('wizard.step1.vendor.createNamed', { query: q })}</button>
              </div>
            ) : (
              matches.slice(0, 6).map(c => (
                <button key={c.id} onClick={() => selectContact(c)} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)',
                  background: SugarV2.card, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-3xl) var(--crm-space-5xl)',
                  border: 0, boxShadow: SugarV2.shadowSm, textAlign: 'left',
                  fontFamily: 'inherit', cursor: 'pointer',
                  transition: 'all .2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = SugarV2.shadow; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = SugarV2.shadowSm; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <SgAvatar contact={c} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: SugarV2.ink }}>
                        {c.firstName} {c.lastName}
                      </span>
                      {c.type === 'seller' && (
                        <span style={{
                          fontSize: 'var(--crm-text-xs)', fontWeight: 700, color: SugarV2.inkSoft,
                          padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', background: SugarV2.cardSubtle,
                          letterSpacing: 0.4, textTransform: 'uppercase',
                        }}>{t('wizard.step1.vendor.sellerTag')}</span>
                      )}
                      <SgKycChip status={c.kyc?.status} />
                    </div>
                    <div style={{ fontSize: 'var(--crm-text-md)', color: SugarV2.muted, fontWeight: 500 }}>
                      {c.email} · {c.phone}
                    </div>
                  </div>
                  <span style={{ color: SugarV2.muted, fontSize: 'var(--crm-text-3xl)' }}>→</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* Création */}
      {creating && (
        <div style={{
          background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)', padding: 32,
          boxShadow: SugarV2.shadow,
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
            }}>{t('wizard.step1.vendor.newSeller')}</div>
            <h3 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3 }}>
              {t('wizard.step1.vendor.quickInfo')}
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)', marginBottom: 14 }}>
            <SgInput label={t('wizard.step1.vendor.firstName')} value={newContact.firstName}
              onChange={v => setNewContact(p => ({ ...p, firstName: v }))} autoFocus />
            <SgInput label={t('wizard.step1.vendor.lastName')} value={newContact.lastName}
              onChange={v => setNewContact(p => ({ ...p, lastName: v }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)' }}>
            <SgInput label={t('wizard.step1.vendor.email')} type="email" value={newContact.email}
              onChange={v => setNewContact(p => ({ ...p, email: v }))} />
            <SgInput label={t('wizard.step1.vendor.phone')} type="tel" value={newContact.phone}
              onChange={v => setNewContact(p => ({ ...p, phone: v }))} placeholder={t('wizard.step1.vendor.phonePlaceholder')} />
          </div>

          <div style={{
            marginTop: 20, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-xl)',
            background: SugarV2.cardSubtle,
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
          }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', color: SugarV2.inkSoft, fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
              {t('wizard.step1.vendor.kycNote')}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 'var(--crm-space-lg)', justifyContent: 'flex-end' }}>
            <button onClick={() => setCreating(false)} style={{
              height: 40, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: 'transparent', color: SugarV2.inkSoft,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
            }}>{t('common:actions.cancel')}</button>
            <button onClick={saveNew}
              disabled={!newContact.firstName || !newContact.lastName}
              style={{
                height: 40, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                background: (!newContact.firstName || !newContact.lastName) ? SugarV2.ghostSolid : SugarV2.black,
                color: sgOn(), fontFamily: 'inherit',
                fontSize: 'var(--crm-text-lg)', fontWeight: 600,
                cursor: (!newContact.firstName || !newContact.lastName) ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
              }}>{t('wizard.step1.vendor.createContact')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
