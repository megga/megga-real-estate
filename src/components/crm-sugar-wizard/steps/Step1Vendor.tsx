// MEGGA CRM Sugar v2 Wizard — Step 1a : Vendeur (recherche + création)
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step1.jsx — `SgStepVendor`).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, sgOn, type WizardData } from '../tokens'
import { SgAvatar, SgKycChip, SgInput } from '../primitives'
import { CRM_CONTACTS, type CrmContact } from '@/components/crm-sugar/mockData'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

export function Step1Vendor({ data, set }: StepProps) {
  const { t } = useTranslation('listings')
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', phone: '' })

  const allContacts = CRM_CONTACTS as CrmContact[]
  const sellers = allContacts.filter(c => c.type === 'seller')
  const others = allContacts.filter(c => c.type !== 'seller')

  const matches = q.trim().length === 0
    ? sellers
    : [...sellers, ...others].filter(c => {
        const hay = `${c.firstName} ${c.lastName} ${c.email} ${c.phone}`.toLowerCase()
        return hay.includes(q.trim().toLowerCase())
      })

  const selected = data.ownerContactId ? allContacts.find(c => c.id === data.ownerContactId) : null

  const selectContact = (c: CrmContact) => set({ ownerContactId: c.id })

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
          fontSize: 12, fontWeight: 600, color: SugarV2.muted,
          letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
        }}>{t('wizard.step1.vendor.eyebrow')}</div>
        <h1 style={{
          margin: '0 0 14px', fontSize: 38, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{t('wizard.step1.vendor.title')}</h1>
        <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
          {t('wizard.step1.vendor.subtitle')}
        </p>
      </div>

      {/* Sélectionné */}
      {selected && !creating && (
        <div style={{
          background: SugarV2.card, borderRadius: 24,
          boxShadow: SugarV2.shadowLg, padding: 20,
          marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 18,
          animation: 'sgScaleIn .4s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <SgAvatar contact={selected} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3 }}>
                {selected.firstName} {selected.lastName}
              </span>
              <SgKycChip status={selected.kyc?.status} />
            </div>
            <div style={{ fontSize: 13, color: SugarV2.inkSoft, fontWeight: 500 }}>
              {selected.email} · {selected.phone}
            </div>
          </div>
          <button onClick={() => set({ ownerContactId: null })} style={{
            height: 36, padding: '0 16px', borderRadius: 999, border: 0,
            background: SugarV2.cardSubtle, color: SugarV2.inkSoft,
            fontFamily: 'inherit', fontSize: 12.5, fontWeight: 600, cursor: 'pointer',
          }}>{t('wizard.step1.vendor.change')}</button>
        </div>
      )}

      {/* Recherche / Création */}
      {!selected && !creating && (
        <>
          <div style={{
            background: SugarV2.card, borderRadius: 24, padding: '8px 8px 8px 22px',
            boxShadow: SugarV2.shadow,
            display: 'flex', alignItems: 'center', gap: 14,
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
                fontSize: 16, color: SugarV2.ink, fontWeight: 500,
              }} />
            {q.length > 0 && (
              <button onClick={startCreate} style={{
                height: 44, padding: '0 18px', borderRadius: 999, border: 0,
                background: SugarV2.black, color: sgOn(),
                fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
              }}>{t('wizard.step1.vendor.newButton')}</button>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {q.length === 0 && (
              <div style={{
                fontSize: 11.5, fontWeight: 600, color: SugarV2.muted,
                letterSpacing: 1, textTransform: 'uppercase',
                padding: '6px 4px',
              }}>{t('wizard.step1.vendor.recentSellers')}</div>
            )}
            {matches.length === 0 ? (
              <div style={{
                background: SugarV2.card, borderRadius: 20, padding: 28,
                boxShadow: SugarV2.shadowSm, textAlign: 'center',
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: SugarV2.ink, marginBottom: 6 }}>
                  {t('wizard.step1.vendor.noMatchTitle', { query: q })}
                </div>
                <div style={{ fontSize: 13, color: SugarV2.muted, marginBottom: 16 }}>
                  {t('wizard.step1.vendor.noMatchBody')}
                </div>
                <button onClick={startCreate} style={{
                  height: 42, padding: '0 22px', borderRadius: 999, border: 0,
                  background: SugarV2.black, color: sgOn(),
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
                }}>{t('wizard.step1.vendor.createNamed', { query: q })}</button>
              </div>
            ) : (
              matches.slice(0, 6).map(c => (
                <button key={c.id} onClick={() => selectContact(c)} style={{
                  display: 'flex', alignItems: 'center', gap: 16,
                  background: SugarV2.card, borderRadius: 20, padding: '16px 20px',
                  border: 0, boxShadow: SugarV2.shadowSm, textAlign: 'left',
                  fontFamily: 'inherit', cursor: 'pointer',
                  transition: 'all .2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = SugarV2.shadow; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = SugarV2.shadowSm; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <SgAvatar contact={c} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: SugarV2.ink }}>
                        {c.firstName} {c.lastName}
                      </span>
                      {c.type === 'seller' && (
                        <span style={{
                          fontSize: 9.5, fontWeight: 700, color: SugarV2.inkSoft,
                          padding: '2px 7px', borderRadius: 999, background: SugarV2.cardSubtle,
                          letterSpacing: 0.4, textTransform: 'uppercase',
                        }}>{t('wizard.step1.vendor.sellerTag')}</span>
                      )}
                      <SgKycChip status={c.kyc?.status} />
                    </div>
                    <div style={{ fontSize: 12.5, color: SugarV2.muted, fontWeight: 500 }}>
                      {c.email} · {c.phone}
                    </div>
                  </div>
                  <span style={{ color: SugarV2.muted, fontSize: 18 }}>→</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* Création */}
      {creating && (
        <div style={{
          background: SugarV2.card, borderRadius: 24, padding: 32,
          boxShadow: SugarV2.shadow,
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 11, fontWeight: 600, color: SugarV2.muted,
              letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6,
            }}>{t('wizard.step1.vendor.newSeller')}</div>
            <h3 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3 }}>
              {t('wizard.step1.vendor.quickInfo')}
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
            <SgInput label={t('wizard.step1.vendor.firstName')} value={newContact.firstName}
              onChange={v => setNewContact(p => ({ ...p, firstName: v }))} autoFocus />
            <SgInput label={t('wizard.step1.vendor.lastName')} value={newContact.lastName}
              onChange={v => setNewContact(p => ({ ...p, lastName: v }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <SgInput label={t('wizard.step1.vendor.email')} type="email" value={newContact.email}
              onChange={v => setNewContact(p => ({ ...p, email: v }))} />
            <SgInput label={t('wizard.step1.vendor.phone')} type="tel" value={newContact.phone}
              onChange={v => setNewContact(p => ({ ...p, phone: v }))} placeholder={t('wizard.step1.vendor.phonePlaceholder')} />
          </div>

          <div style={{
            marginTop: 20, padding: '14px 16px', borderRadius: 14,
            background: SugarV2.cardSubtle,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{ fontSize: 13, color: SugarV2.inkSoft, fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
              {t('wizard.step1.vendor.kycNote')}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button onClick={() => setCreating(false)} style={{
              height: 40, padding: '0 18px', borderRadius: 999, border: 0,
              background: 'transparent', color: SugarV2.inkSoft,
              fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>{t('common:actions.cancel')}</button>
            <button onClick={saveNew}
              disabled={!newContact.firstName || !newContact.lastName}
              style={{
                height: 40, padding: '0 22px', borderRadius: 999, border: 0,
                background: (!newContact.firstName || !newContact.lastName) ? SugarV2.ghost : SugarV2.black,
                color: sgOn(), fontFamily: 'inherit',
                fontSize: 13, fontWeight: 600,
                cursor: (!newContact.firstName || !newContact.lastName) ? 'not-allowed' : 'pointer',
                boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
              }}>{t('wizard.step1.vendor.createContact')}</button>
          </div>
        </div>
      )}
    </div>
  )
}
