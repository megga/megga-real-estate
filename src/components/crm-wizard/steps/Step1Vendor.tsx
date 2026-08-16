// MEGGA CRM Sugar v2 Wizard — Step 1a : Vendeur (recherche + création)
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step1.jsx — `SgStepVendor`).

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { WizardTokens, crmOn, type WizardData } from '../tokens'
import { CrmAvatar, CrmKycChip, CrmInput } from '../primitives'
import { type CrmContact } from '@/components/crm/mockData'
import { useContactsScreen } from '@/hooks/useContactsScreen'
import { useSellerLeads, type SellerLeadRow } from '@/hooks/useSellerLeads'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

/** Type libre d'une soumission publique → type du wizard. */
function typeDeSoumission(brut: string): WizardData['type'] {
  const t = (brut || '').toLowerCase()
  if (t.includes('villa')) return 'villa'
  if (t.includes('house') || t.includes('maison')) return 'maison'
  if (t.includes('land') || t.includes('terrain')) return 'terrain'
  return 'appartement'
}

/** Cinq au plus, les plus récentes — le reste se traite depuis « Aujourd'hui ». */
const PLAFOND_SOUMISSIONS = 5

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
  const { contacts: allContacts } = useContactsScreen()
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
      _newContact: { ...newContact, id, type: 'seller', kyc: { status: 'none' }, avatarBg: WizardTokens.pop1 },
      _ownerContact: null,
    })
    setCreating(false)
  }

  /**
   * Reprendre une soumission — l'entrée qui a survécu au retrait de l'étape
   * « Démarrer » (12 août 2026).
   *
   * ⚠ ELLE NE S'AFFICHE QUE S'IL Y EN A. C'est tout l'intérêt : là-bas elle
   * occupait un tiers d'un écran pour dire « aucune soumission » — `seller_leads`
   * n'a qu'une ligne, du 29 mars, et plus d'écrivain depuis que `/sell` redirige
   * vers la vitrine. Ici elle est invisible tant que la table est vide, et se
   * rallume seule le jour où un formulaire public la remplit à nouveau.
   */
  const { data: leads = [] } = useSellerLeads('new', PLAFOND_SOUMISSIONS)
  const [soumissionsOuvertes, setSoumissionsOuvertes] = useState(false)

  const reprendre = (lead: SellerLeadRow) => {
    const morceaux = lead.contact_name.trim().split(/\s+/)
    const identite = {
      firstName: morceaux[0] || '',
      lastName: morceaux.slice(1).join(' ') || '',
      email: lead.contact_email,
      phone: lead.contact_phone ?? '',
    }
    // Un lead sans `contact_id` n'a pas encore de contact en base : on pose un
    // brouillon `c-from-…` que `handlePublish` persistera. Avec `contact_id`, on
    // lie l'UUID réel et on fige le snapshot d'affichage — les étapes aval ne
    // savent pas re-résoudre un contact par id.
    const brouillon = !lead.contact_id
    const id = lead.contact_id ?? `c-from-${lead.id}`
    const pd = lead.property_data
    set({
      ownerContactId: id,
      _newContact: brouillon ? { ...identite, id, type: 'seller', kyc: { status: 'none' }, avatarBg: WizardTokens.pop1 } : null,
      _ownerContact: brouillon ? null : { ...identite, id, type: 'seller', kyc: { status: 'none' }, avatarBg: WizardTokens.pop1 },
      type: typeDeSoumission(pd.type),
      transaction: 'vente',
      addr: pd.address, canton: pd.canton, postCode: pd.postalCode, city: pd.city,
      area: pd.surface,
      rooms: Math.floor(Number.parseFloat(pd.rooms) || 0),
      description: lead.motivation || '',
      // ⚠ L'estimation est une ESTIMATION, pas un prix décidé. Elle pré-remplit
      // le champ que l'agent verra et pourra corriger à l'étape Prix ; elle ne
      // publie rien toute seule.
      price: lead.estimation_median ?? lead.estimation_max ?? lead.estimation_min ?? null,
    })
    setSoumissionsOuvertes(false)
  }

  return (
    <div style={{
      maxWidth: 920, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
        <h1 style={{
          margin: 0, fontSize: 'var(--crm-text-9xl)', fontWeight: 500,
          color: WizardTokens.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{t('wizard.step1.vendor.title')}</h1>
      </div>

      {/* Sélectionné */}
      {selected && !creating && (
        <div style={{
          background: WizardTokens.card, borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: WizardTokens.shadowLg, padding: 'var(--crm-space-5xl)',
          marginBottom: 24,
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-4xl)',
          animation: 'sgScaleIn .4s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <CrmAvatar contact={selected} size={56} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: WizardTokens.ink, letterSpacing: -0.3 }}>
                {selected.firstName} {selected.lastName}
              </span>
              <CrmKycChip status={selected.kyc?.status} />
            </div>
            <div style={{ fontSize: 'var(--crm-text-lg)', color: WizardTokens.inkSoft, fontWeight: 500 }}>
              {selected.email} · {selected.phone}
            </div>
          </div>
          <button onClick={() => set({ ownerContactId: null, _ownerContact: null, _newContact: null })} style={{
            height: 36, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
            background: WizardTokens.cardSubtle, color: WizardTokens.inkSoft,
            fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
          }}>{t('wizard.step1.vendor.change')}</button>
        </div>
      )}

      {/* Recherche / Création */}
      {!selected && !creating && (
        <>
          <div style={{
            background: WizardTokens.card, borderRadius: 'var(--crm-radius-5xl)', padding: 'var(--crm-space-md) var(--crm-space-md) var(--crm-space-md) var(--crm-space-6xl)',
            boxShadow: WizardTokens.shadow,
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)',
            marginBottom: 18,
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={WizardTokens.muted} strokeWidth="1.6" strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
            <input autoFocus value={q} onChange={e => setQ(e.target.value)}
              placeholder={t('wizard.step1.vendor.searchPlaceholder')}
              style={{
                flex: 1, height: 56, border: 0, background: 'transparent',
                outline: 'none', fontFamily: 'inherit',
                fontSize: 'var(--crm-text-2xl)', color: WizardTokens.ink, fontWeight: 500,
              }} />
            {q.length > 0 && (
              <button onClick={startCreate} style={{
                height: 44, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                background: WizardTokens.black, color: crmOn(),
                fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
                boxShadow: '0 6px 16px rgba(0,0,0,0.18)',
              }}>{t('wizard.step1.vendor.newButton')}</button>
            )}
          </div>

          {/* Soumissions en attente — masqué tant qu'il n'y en a pas. */}
          {q.trim().length === 0 && leads.length > 0 && (
            <div style={{ marginBottom: 'var(--crm-space-2xl)' }}>
              <button
                type="button"
                onClick={() => setSoumissionsOuvertes(o => !o)}
                aria-expanded={soumissionsOuvertes}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)',
                  height: 38, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)',
                  border: `1px solid ${WizardTokens.line}`, background: WizardTokens.card,
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600,
                  color: WizardTokens.ink, cursor: 'pointer',
                }}
              >
                {t('wizard.step1.vendor.submissions', { count: leads.length })}
              </button>

              {soumissionsOuvertes && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-md)', marginTop: 'var(--crm-space-xl)' }}>
                  {leads.map(lead => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() => reprendre(lead)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)',
                        padding: 'var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-3xl)',
                        border: `1px solid ${WizardTokens.line}`, background: WizardTokens.card,
                        fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer', width: '100%',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: WizardTokens.ink }}>
                          {lead.contact_name || t('wizard.step1.vendor.unknownVendor')}
                        </div>
                        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: WizardTokens.muted }}>
                          {lead.property_data.type} · {lead.property_data.city}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
            {q.length === 0 && sellers.length > 0 && (
              <div style={{
                fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: WizardTokens.muted,
                padding: 'var(--crm-space-sm) var(--crm-space-xs)',
              }}>{t('wizard.step1.vendor.recentSellers')}</div>
            )}
            {q.trim().length > 0 && matches.length === 0 ? (
              <div style={{
                background: WizardTokens.card, borderRadius: 'var(--crm-radius-4xl)', padding: 28,
                boxShadow: WizardTokens.shadowSm, textAlign: 'center',
              }}>
                {/* 16 et non 6 : le sous-titre retiré portait cet écart, le
                    titre le reprend pour ne pas coller au bouton. */}
                <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: WizardTokens.ink, marginBottom: 16 }}>
                  {t('wizard.step1.vendor.noMatchTitle', { query: q })}
                </div>
                {/* « Créez un nouveau contact vendeur. » disait le verbe du
                    bouton juste dessous. */}
                <button onClick={startCreate} style={{
                  height: 42, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                  background: WizardTokens.black, color: crmOn(),
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
                }}>{t('wizard.step1.vendor.createNamed', { query: q })}</button>
              </div>
            ) : (
              matches.slice(0, 6).map(c => (
                <button key={c.id} onClick={() => selectContact(c)} style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)',
                  background: WizardTokens.card, borderRadius: 'var(--crm-radius-4xl)', padding: 'var(--crm-space-3xl) var(--crm-space-5xl)',
                  border: 0, boxShadow: WizardTokens.shadowSm, textAlign: 'left',
                  fontFamily: 'inherit', cursor: 'pointer',
                  transition: 'all .2s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = WizardTokens.shadow; e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = WizardTokens.shadowSm; e.currentTarget.style.transform = 'translateY(0)' }}
                >
                  <CrmAvatar contact={c} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 2, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: WizardTokens.ink }}>
                        {c.firstName} {c.lastName}
                      </span>
                      {c.type === 'seller' && (
                        <span style={{
                          fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: WizardTokens.inkSoft,
                          padding: 'var(--crm-space-2xs) var(--crm-space-sm)', borderRadius: 'var(--crm-radius-pill)', background: WizardTokens.cardSubtle,
                        }}>{t('wizard.step1.vendor.sellerTag')}</span>
                      )}
                      <CrmKycChip status={c.kyc?.status} />
                    </div>
                    <div style={{ fontSize: 'var(--crm-text-md)', color: WizardTokens.muted, fontWeight: 500 }}>
                      {c.email} · {c.phone}
                    </div>
                  </div>
                  <span style={{ color: WizardTokens.muted, fontSize: 'var(--crm-text-3xl)' }}>→</span>
                </button>
              ))
            )}
          </div>
        </>
      )}

      {/* Création */}
      {creating && (
        <div style={{
          background: WizardTokens.card, borderRadius: 'var(--crm-radius-5xl)', padding: 32,
          boxShadow: WizardTokens.shadow,
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ marginBottom: 20 }}>
            <div style={{
              fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: WizardTokens.muted,
              marginBottom: 6,
            }}>{t('wizard.step1.vendor.newSeller')}</div>
            <h3 style={{ margin: 0, fontSize: 'var(--crm-text-4xl)', fontWeight: 500, color: WizardTokens.ink, letterSpacing: -0.3 }}>
              {t('wizard.step1.vendor.quickInfo')}
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)', marginBottom: 14 }}>
            <CrmInput label={t('wizard.step1.vendor.firstName')} value={newContact.firstName}
              onChange={v => setNewContact(p => ({ ...p, firstName: v }))} autoFocus />
            <CrmInput label={t('wizard.step1.vendor.lastName')} value={newContact.lastName}
              onChange={v => setNewContact(p => ({ ...p, lastName: v }))} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)' }}>
            <CrmInput label={t('wizard.step1.vendor.email')} type="email" value={newContact.email}
              onChange={v => setNewContact(p => ({ ...p, email: v }))} />
            <CrmInput label={t('wizard.step1.vendor.phone')} type="tel" value={newContact.phone}
              onChange={v => setNewContact(p => ({ ...p, phone: v }))} placeholder={t('wizard.step1.vendor.phonePlaceholder')} />
          </div>

          <div style={{
            marginTop: 20, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-xl)',
            background: WizardTokens.cardSubtle,
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
          }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', color: WizardTokens.inkSoft, fontWeight: 500, flex: 1, lineHeight: 1.4 }}>
              {t('wizard.step1.vendor.kycNote')}
            </div>
          </div>

          <div style={{ marginTop: 24, display: 'flex', gap: 'var(--crm-space-lg)', justifyContent: 'flex-end' }}>
            <button onClick={() => setCreating(false)} style={{
              height: 40, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: 'transparent', color: WizardTokens.inkSoft,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
            }}>{t('common:actions.cancel')}</button>
            <button onClick={saveNew}
              disabled={!newContact.firstName || !newContact.lastName}
              style={{
                height: 40, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                background: (!newContact.firstName || !newContact.lastName) ? WizardTokens.ghostSolid : WizardTokens.black,
                color: crmOn(), fontFamily: 'inherit',
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
