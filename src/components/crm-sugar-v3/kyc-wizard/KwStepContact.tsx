// MEGGA CRM Sugar v3 — Wizard Step 2 : Contact picker
// Refonte visuelle (handoff §1.6/§1.9) : palette-aware, scrollbar intégrée au
// bento (.kw-scroll), méta contact = email seul, eyebrow retirée, focus neutralisé.
//
// Les contacts ayant déjà un dossier KYC en cours sont grisés et non-cliquables.

import EtatVide from '@/components/crm-sugar/EtatVide'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SgIcon } from '../icons'
import { useKycPalette, useKycDark } from '../kyc/kycPalette'
import { useContacts } from '@/hooks/useContacts'
import { useKycDossiers } from '@/hooks/useKycDossier'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

export function KwStepContact({ data, set }: Props) {
  const { t } = useTranslation('kyc')
  const sp = useKycPalette()
  const dark = useKycDark()
  const { contacts = [] } = useContacts()
  const { data: dossiers = [] } = useKycDossiers()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query) return contacts
    const q = query.toLowerCase()
    return contacts.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email ?? ''}`.toLowerCase().includes(q),
    )
  }, [contacts, query])

  /** Contacts qui ont déjà un dossier en cours (status ≠ 'none'). */
  const contactsWithActiveDossier = useMemo(() => {
    const s = new Set<string>()
    dossiers.forEach((d) => {
      if (d.dossier_status !== 'none' && d.contact?.id) {
        s.add(d.contact.id)
      }
    })
    return s
  }, [dossiers])

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 'var(--crm-text-9xl)',
            fontWeight: 600,
            color: sp.ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          {t('wizard.contact.title')}
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 'var(--crm-text-xl)',
            color: sp.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          {t('wizard.contact.subtitle')}
        </p>
      </div>

      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--crm-space-xl)',
          padding: '0 var(--crm-space-6xl)',
          height: 56,
          background: sp.card,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 'var(--crm-radius-pill)',
          marginBottom: 18,
          boxShadow: sp.shadow,
        }}
      >
        <SgIcon name="search" size={18} stroke={sp.muted} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('wizard.contact.searchPlaceholder')}
          style={{
            flex: 1,
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 'var(--crm-text-xl)',
            fontWeight: 500,
            color: sp.ink,
          }}
        />
      </div>

      {/* List — carte externe clippe les coins (§1.9), scroll interne .kw-scroll */}
      <div
        style={{
          background: sp.card,
          border: `1px solid ${sp.cardBorder}`,
          borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: sp.shadow,
          maxHeight: 460,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          className="kw-scroll"
          style={{ flex: 1, overflowY: 'auto', padding: 'var(--crm-space-xl) var(--crm-space-md) var(--crm-space-xl) var(--crm-space-xl)' }}
        >
          {filtered.length === 0 ? (
            <EtatVide dark={dark} titre={t('wizard.contact.empty')} />
          ) : (
            filtered.map((c) => {
              const has = contactsWithActiveDossier.has(c.id)
              const selected = data.contactId === c.id
              const typeShort =
                c.type === 'buyer'
                  ? t('wizard.contact.typeShort.buyer')
                  : c.type === 'seller'
                    ? t('wizard.contact.typeShort.seller')
                    : c.type === 'tenant'
                      ? t('wizard.contact.typeShort.tenant')
                      : c.type === 'landlord'
                        ? t('wizard.contact.typeShort.landlord')
                        : t('wizard.contact.typeShort.mixed')
              const initials = `${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`.toUpperCase()
              return (
                <button
                  key={c.id}
                  onClick={() => set({ contactId: c.id })}
                  disabled={has}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '44px 1fr auto auto',
                    gap: 'var(--crm-space-2xl)',
                    alignItems: 'center',
                    width: '100%',
                    padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
                    borderRadius: 'var(--crm-radius-xl)',
                    border: 0,
                    outline: 'none',
                    background: selected ? sp.black : 'transparent',
                    color: selected ? sp.onAccent : sp.ink,
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    cursor: has ? 'not-allowed' : 'pointer',
                    opacity: has ? 0.55 : 1,
                    marginBottom: 4,
                    transition: 'background .15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (has || selected) return
                    e.currentTarget.style.background = sp.cardSubtle
                  }}
                  onMouseLeave={(e) => {
                    if (has || selected) return
                    e.currentTarget.style.background = 'transparent'
                  }}
                >
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 'var(--crm-radius-pill)',
                      background: sp.black,
                      color: sp.onAccent,
                      display: 'grid',
                      placeItems: 'center',
                      fontSize: 'var(--crm-text-lg)',
                      fontWeight: 600,
                    }}
                  >
                    {initials}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 'var(--crm-text-xl)',
                        fontWeight: 600,
                        letterSpacing: -0.2,
                        marginBottom: 2,
                      }}
                    >
                      {c.first_name} {c.last_name}
                    </div>
                    <div
                      style={{
                        fontSize: 'var(--crm-text-sm)',
                        fontWeight: 500,
                        color: selected ? sp.onAccentSoft : sp.muted,
                      }}
                    >
                      {c.email ?? '—'}
                    </div>
                  </div>
                  <span
                    style={{
                      padding: 'var(--crm-space-xs) var(--crm-space-lg)',
                      borderRadius: 'var(--crm-radius-pill)',
                      background: selected ? sp.onAccentFaint : sp.cardSubtle,
                      color: selected ? sp.onAccent : sp.inkSoft,
                      fontSize: 'var(--crm-text-sm)',
                      fontWeight: 600,
                      letterSpacing: 0.1,
                    }}
                  >
                    {typeShort}
                  </span>
                  {has ? (
                    <span
                      style={{
                        fontSize: 'var(--crm-text-xs)',
                        fontWeight: 600,
                        color: sp.muted,
                        padding: 'var(--crm-space-xs) var(--crm-space-lg)',
                        borderRadius: 'var(--crm-radius-pill)',
                        background: sp.cardSubtle,
                        letterSpacing: 0.2,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {t('wizard.contact.existingDossier')}
                    </span>
                  ) : selected ? (
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 'var(--crm-radius-pill)',
                        background: sp.onAccentMid,
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <SgIcon name="check" size={14} stroke={sp.onAccent} sw={2.2} />
                    </span>
                  ) : (
                    <span style={{ width: 28 }} />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </div>
  )
}
