// MEGGA CRM Sugar v3 — Wizard Step 2 : Contact picker
// Port 1:1 de crm-kyc-wizard.jsx lignes 266-401 (KwStepContact).
//
// Les contacts ayant déjà un dossier KYC en cours sont grisés et non-cliquables.

import { useMemo, useState } from 'react'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { useContacts } from '@/hooks/useContacts'
import { useKycDossiers } from '@/hooks/useKycDossier'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

export function KwStepContact({ data, set }: Props) {
  const { contacts = [] } = useContacts()
  const { data: dossiers = [] } = useKycDossiers()
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    if (!query) return contacts
    const q = query.toLowerCase()
    return contacts.filter((c) =>
      `${c.first_name} ${c.last_name} ${c.email ?? ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [contacts, query])

  /** Contacts qui ont déjà un dossier en cours (status ≠ 'none'). */
  const contactsWithActiveDossier = useMemo(() => {
    const set = new Set<string>()
    dossiers.forEach((d) => {
      if (d.dossier_status !== 'none' && d.contact?.id) {
        set.add(d.contact.id)
      }
    })
    return set
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
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Étape 2 sur 3 · Contact
        </div>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 38,
            fontWeight: 700,
            color: SugarV3.ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          Pour quel contact&nbsp;?
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: SugarV3.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Les contacts qui ont déjà un dossier KYC en cours apparaissent grisés
          — vous pouvez les rouvrir depuis la liste principale.
        </p>
      </div>

      {/* Search */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '0 22px',
          height: 56,
          background: SugarV3.card,
          borderRadius: 999,
          marginBottom: 18,
          boxShadow: SugarV3.shadow,
        }}
      >
        <SgIcon name="search" size={18} stroke={SugarV3.muted} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un contact, un e-mail…"
          style={{
            flex: 1,
            border: 0,
            outline: 'none',
            background: 'transparent',
            fontFamily: 'inherit',
            fontSize: 15,
            fontWeight: 500,
            color: SugarV3.ink,
          }}
        />
      </div>

      {/* List */}
      <div
        style={{
          background: SugarV3.card,
          borderRadius: 22,
          padding: 12,
          boxShadow: SugarV3.shadow,
          maxHeight: 460,
          overflowY: 'auto',
        }}
      >
        {filtered.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: SugarV3.muted,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Aucun contact ne correspond à cette recherche.
          </div>
        ) : (
          filtered.map((c) => {
            const has = contactsWithActiveDossier.has(c.id)
            const selected = data.contactId === c.id
            const typeLabel =
              c.type === 'buyer'
                ? 'Acheteur'
                : c.type === 'seller'
                  ? 'Vendeur'
                  : c.type === 'tenant'
                    ? 'Locataire'
                    : c.type === 'landlord'
                      ? 'Propriétaire'
                      : 'Mixte'
            const initials = `${c.first_name[0] ?? ''}${c.last_name[0] ?? ''}`.toUpperCase()
            return (
              <button
                key={c.id}
                onClick={() => set({ contactId: c.id })}
                disabled={has}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '44px 1fr auto auto',
                  gap: 14,
                  alignItems: 'center',
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 14,
                  border: 0,
                  background: selected ? SugarV3.black : 'transparent',
                  color: selected ? '#fff' : SugarV3.ink,
                  fontFamily: 'inherit',
                  textAlign: 'left',
                  cursor: has ? 'not-allowed' : 'pointer',
                  opacity: has ? 0.55 : 1,
                  marginBottom: 4,
                  transition: 'background .15s ease',
                }}
                onMouseEnter={(e) => {
                  if (has || selected) return
                  e.currentTarget.style.background = SugarV3.cardSubtle
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
                    borderRadius: 999,
                    background: SugarV3.black,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 13,
                    fontWeight: 700,
                  }}
                >
                  {initials}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      letterSpacing: -0.2,
                      marginBottom: 2,
                    }}
                  >
                    {c.first_name} {c.last_name}
                  </div>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 500,
                      color: selected ? 'rgba(255,255,255,0.7)' : SugarV3.muted,
                    }}
                  >
                    {typeLabel} · {c.email ?? '—'}
                  </div>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    borderRadius: 999,
                    background: selected
                      ? 'rgba(255,255,255,0.10)'
                      : SugarV3.cardSubtle,
                    color: selected ? '#fff' : SugarV3.inkSoft,
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: 0.1,
                  }}
                >
                  {typeLabel.slice(0, 4)}
                </span>
                {has ? (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 700,
                      color: SugarV3.muted,
                      padding: '4px 10px',
                      borderRadius: 999,
                      background: SugarV3.cardSubtle,
                      letterSpacing: 0.2,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Dossier existant
                  </span>
                ) : selected ? (
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background: 'rgba(255,255,255,0.18)',
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <SgIcon name="check" size={14} stroke="#fff" sw={2.2} />
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
  )
}
