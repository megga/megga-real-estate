/**
 * MEGGA CRM — Pipeline v2 « Sugar Pure » : modale « Nouveau deal » plein cadre.
 * Port 1:1 du handoff crm-new-deal-modal.jsx (NewDealModal, qui remplace le
 * drawer : `window.NewDealDrawer = NewDealModal`). Création 100 % manuelle :
 * contact (existant / nouveau) · bien (optionnel, valeur reprise du prix) ·
 * étape (pilules SG_STAGE_HUE) · valeur. Aucune extraction IA (« Importer un
 * lead » vit ailleurs). Rendue en ABSOLU dans le cadre bento : le proto posait
 * un `position:fixed` contenu par le transform du pager — ici le cadre
 * (position:relative + overflow:hidden) joue ce rôle, la nav reste visible
 * comme sur les captures du handoff.
 *
 * Câblage prod : useCreateContact → useCreateTransaction (price_offered) →
 * reminder « Premier suivi » à J+2 (usePipelineNextActions).
 */

import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import {
  CRM_STAGE_ORDER, SG_STAGE_HUE, crmFmtCHF,
  type StageId, type SugarPalette,
} from '../tokens'
import { encreSur } from '@/components/megga-x-crm/tokens'
import { ndPalette } from './ndTokens'
import type { CrmContact, CrmBien } from '../mockData'
import { useAuth } from '@/hooks/useAuth'
import { useContactsSugar } from '@/hooks/useContactsSugar'
import { useBiensSugar } from '@/hooks/useBiensSugar'
import { useCreateContact } from '@/hooks/useContacts'
import { useCreateTransaction } from '@/hooks/useTransactions'
import { usePipelineReminderCreators } from '@/hooks/usePipelineNextActions'
import { stageIdToTransactionStage } from '@/lib/sugarAdapters'

/** Préremplissage depuis la création inline (« Plus d'options ») ou l'état vide. */
export interface NewDealPrefill {
  stage?: StageId
  contactId?: string | null
  contactQuery?: string
  value?: number | null
}

/**
 * Substitution d'aperçu (`/dev/pipeline`). Cette modale porte ses PROPRES
 * sources — `useContactsSugar` et `useBiensSugar`, gatées sur la session — donc
 * sans banc elle ne rend que ses deux états vides : on ne pouvait voir ni la
 * liste de contacts, ni celle des biens, ni la sélection. C'est la moitié la
 * plus lourde du dossier (576 lignes) et elle porte une police en dur assumée.
 */
export interface NewDealBanc {
  contacts: CrmContact[]
  biens: CrmBien[]
}

interface Props {
  open: boolean
  onClose: () => void
  sp: SugarPalette
  dark: boolean
  prefill: NewDealPrefill | null
  banc?: NewDealBanc
}

export function NewDealModal({ open, onClose, sp, dark, prefill, banc }: Props) {
  const { t } = useTranslation('pipeline')
  const { profile } = useAuth()
  const nd = ndPalette(dark, sp)

  // ⚠ Les deux hooks sont appelés DANS TOUS LES CAS (règle des hooks) ; en banc
  // leur résultat est écarté. Sans session ils ne partent de toute façon pas.
  const { contacts: liveContacts } = useContactsSugar()
  const { biens: liveBiens } = useBiensSugar()
  const allContacts = banc ? banc.contacts : liveContacts
  const biens = banc ? banc.biens : liveBiens
  const allBiens = useMemo(() => biens.filter(b => b.status === 'active'), [biens])
  const createContact = useCreateContact()
  const createTransaction = useCreateTransaction()
  const { createFirstFollowUp } = usePipelineReminderCreators()

  const [contactMode, setContactMode] = useState<'existing' | 'new'>('existing')
  const [contactId, setContactId] = useState<string | null>(null)
  const [contactQuery, setContactQuery] = useState('')
  const [newContact, setNewContact] = useState({ firstName: '', lastName: '', email: '', phone: '' })
  const [bienId, setBienId] = useState<string | null>(null)
  const [bienQuery, setBienQuery] = useState('')
  const [stage, setStage] = useState<StageId>('to-qualify')
  const [value, setValue] = useState('')
  const [created, setCreated] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset / préremplissage à l'ouverture
  useEffect(() => {
    if (!open) return
    setCreated(false); setCreating(false); setError(null)
    setContactMode('existing'); setContactId(prefill?.contactId || null)
    setNewContact({ firstName: '', lastName: '', email: '', phone: '' })
    setBienId(null); setBienQuery('')
    setContactQuery(prefill?.contactQuery || '')
    setStage(prefill?.stage || 'to-qualify'); setValue(prefill?.value ? String(prefill.value) : '')
  }, [open, prefill])

  // Valeur auto depuis le prix du bien choisi (reste modifiable)
  useEffect(() => {
    if (!bienId) return
    const b = allBiens.find(x => x.id === bienId)
    if (b?.price) setValue(String(b.price))
    else if (b?.rent) setValue(String(b.rent * 12))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bienId])

  if (!open) return null

  const matchingContacts = allContacts.filter(c => {
    if (!contactQuery) return true
    const q = contactQuery.toLowerCase()
    return `${c.firstName} ${c.lastName} ${c.email}`.toLowerCase().includes(q)
  })
  const filteredContacts = matchingContacts.slice(0, 5)
  const moreContacts = matchingContacts.length - filteredContacts.length

  const matchingBiens = allBiens.filter(b => {
    if (!bienQuery) return true
    const q = bienQuery.toLowerCase()
    return `${b.title} ${b.ref} ${b.addr}`.toLowerCase().includes(q)
  })
  const filteredBiens = matchingBiens.slice(0, 5)
  const moreBiens = matchingBiens.length - filteredBiens.length

  const selectedContact = contactId ? allContacts.find(c => c.id === contactId) ?? null : null
  const selectedBien = bienId ? allBiens.find(b => b.id === bienId) ?? null : null

  const canCreate = contactMode === 'existing'
    ? !!contactId
    : !!(newContact.firstName.trim() && newContact.lastName.trim())

  const handleCreate = async () => {
    if (!canCreate || creating) return
    const agencyId = profile?.agency_id
    if (!agencyId) { setError(t('modal.error.noAgency')); return }
    setCreating(true); setError(null)
    try {
      let cid = contactId
      if (contactMode === 'new') {
        const row = await createContact.mutateAsync({
          firstName: newContact.firstName.trim(),
          lastName: newContact.lastName.trim(),
          email: newContact.email.trim(),
          phone: newContact.phone.trim() || undefined,
          type: 'buyer',
          source: 'manual',
          agency_id: agencyId,
        })
        cid = row.id
      }
      const tx = await createTransaction.mutateAsync({
        agency_id: agencyId,
        contact_buyer_id: cid ?? undefined,
        property_id: bienId ?? undefined,
        stage: stageIdToTransactionStage(stage),
        price_offered: Number(value) || selectedBien?.price || undefined,
      })
      const txId = (tx as { id?: string } | null)?.id
      // Le deal naît avec une échéance réelle (« Premier suivi » à J+2) — la
      // carte kanban affiche cette prochaine action dès son apparition.
      if (txId) await createFirstFollowUp({ transactionId: txId, contactId: cid ?? null })
      setCreated(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('modal.error.unknown'))
    } finally {
      setCreating(false)
    }
  }

  const overlayStyle: React.CSSProperties = {
    position: 'absolute', inset: 0, zIndex: 60,
    background: nd.bg,
    display: 'flex', flexDirection: 'column',
    fontFamily: '"Inter Tight", system-ui, sans-serif',
    animation: 'sugar-overlay-fade .25s ease both',
  }

  // ─── Vue de confirmation ───────────────────────────────────────────
  if (created) {
    return (
      <div style={{ ...overlayStyle, justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          maxWidth: 560, padding: '0 var(--crm-space-7xl)', width: '100%', boxSizing: 'border-box',
          animation: 'sugar-fade-up .45s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 72, height: 72, borderRadius: 'var(--crm-radius-pill)', background: nd.green,
              margin: '0 auto 22px', display: 'grid', placeItems: 'center',
            }}>
              <MEIcon name="check" size={30} color={nd.onGreen} />
            </div>
            <h1 style={{
              margin: '0 0 10px', fontSize: 'var(--crm-text-6xl)', fontWeight: 700, color: nd.ink,
              letterSpacing: -0.6, lineHeight: 1.15,
            }}>{t('modal.created')}</h1>
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 'var(--crm-space-lg)' }}>
            <button onClick={onClose} style={{
              height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: nd.accent, color: nd.accentInk, fontFamily: 'inherit',
              fontWeight: 700, fontSize: 'var(--crm-text-xl)', cursor: 'pointer', boxShadow: nd.shadow,
            }}>{t('modal.seePipeline')}</button>
          </div>
        </div>
      </div>
    )
  }

  const hair = `1px solid ${nd.line}`
  const colPad: React.CSSProperties = {
    padding: '24px 26px', display: 'flex', flexDirection: 'column',
    minWidth: 0, minHeight: 0, overflowY: 'auto',
  }
  const colLabel = (txt: string, extra?: React.ReactNode) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 14, flexShrink: 0 }}>
      <span style={{
        fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: nd.muted,
      }}>{txt}</span>
      {extra}
    </div>
  )
  const searchInputStyle: React.CSSProperties = {
    width: '100%', height: 44, padding: '0 16px 0 42px',
    background: nd.cardSubtle, border: 0, borderRadius: 'var(--crm-radius-lg)',
    fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: nd.ink,
    outline: 'none', boxSizing: 'border-box',
  }
  const ghostLinkStyle: React.CSSProperties = {
    height: 40, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
    background: 'transparent', color: nd.muted, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 700,
  }
  const moreLineStyle: React.CSSProperties = {
    padding: 'var(--crm-space-lg) var(--crm-space-xl)', fontSize: 'var(--crm-text-md)', color: nd.muted, fontWeight: 600,
    fontVariantNumeric: 'tabular-nums',
  }

  // ⛔ L'aplat vient du HACHAGE DE L'ID (`AVATAR_PALETTE`) : personne ne le relit
  // avant qu'il s'affiche, donc l'encre ne peut pas être choisie une fois pour
  // toutes. Mesuré sur les huit teintes sous blanc : 2,15:1 à 4,47:1, cinq sous
  // l'AA. `encreSur` la DÉRIVE de l'aplat réellement employé.
  const avatar = (c: CrmContact, size = 38) => {
    const av = c.avatarBg || nd.ink
    return (
      <div style={{
        width: size, height: size, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0,
        background: av, color: encreSur(av),
        display: 'grid', placeItems: 'center',
        fontSize: size * 0.36, fontWeight: 700, letterSpacing: -0.3,
      }}>{((c.firstName || '?')[0] + (c.lastName || '')[0]).toUpperCase()}</div>
    )
  }

  const pickRow = (opts: {
    key?: string
    selected?: boolean
    onClick: () => void
    left: React.ReactNode
    title: string
    right?: React.ReactNode
  }) => (
    <button key={opts.key} onClick={opts.onClick} style={{
      width: '100%', display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)',
      padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-xl)', border: 0, cursor: 'pointer',
      background: opts.selected ? nd.cardSubtle : 'transparent',
      boxShadow: opts.selected ? `inset 0 0 0 2px ${nd.ink}` : 'none',
      fontFamily: 'inherit', textAlign: 'left',
      transition: 'all .14s ease',
    }}>
      {opts.left}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 'var(--crm-text-xl)', fontWeight: 700, color: nd.ink, letterSpacing: -0.2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{opts.title}</div>
      </div>
      {opts.right}
      {opts.selected && (
        <span style={{
          width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', background: nd.ink,
          display: 'grid', placeItems: 'center', flexShrink: 0,
        }}>
          <MEIcon name="check" size={13} color={nd.accentInk} />
        </span>
      )}
    </button>
  )

  const field = (label: string, val: string, onChange: (v: string) => void, opts?: { type?: string; prefix?: string; span2?: boolean }) => (
    <label style={{ display: 'block', gridColumn: opts?.span2 ? 'span 2' : undefined }}>
      <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 700, color: nd.muted, marginBottom: 7, letterSpacing: 0.2 }}>{label}</div>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {opts?.prefix && (
          <span style={{
            position: 'absolute', left: 14, fontSize: 'var(--crm-text-xl)', fontWeight: 600,
            color: nd.muted, pointerEvents: 'none',
          }}>{opts.prefix}</span>
        )}
        <input value={val} onChange={e => onChange(e.target.value)} type={opts?.type ?? 'text'}
          style={{
            width: '100%', height: 46, padding: opts?.prefix ? '0 16px 0 48px' : '0 16px',
            background: nd.cardSubtle, border: 0, borderRadius: 'var(--crm-radius-lg)',
            fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: nd.ink,
            outline: 'none', boxSizing: 'border-box',
            boxShadow: `inset 0 0 0 1.5px ${nd.line}`,
            fontVariantNumeric: 'tabular-nums',
            transition: 'box-shadow .15s ease',
          }}
          onFocus={e => { e.target.style.boxShadow = `inset 0 0 0 2px ${nd.ink}` }}
          onBlur={e => { e.target.style.boxShadow = `inset 0 0 0 1.5px ${nd.line}` }} />
      </div>
    </label>
  )

  const bienIcon = (
    <span style={{ width: 38, height: 38, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
      <MEIcon name="building" size={26} color={nd.ink} />
    </span>
  )

  return (
    <div style={overlayStyle}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', width: '100%', boxSizing: 'border-box' }}>
        <div style={{
          width: '100%', background: nd.card,
          display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: 0,
        }}>
          {/* En-tête intégré à la surface */}
          <div style={{
            flexShrink: 0, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)',
            padding: '20px 26px', borderBottom: hair,
          }}>
            <h1 style={{
              margin: 0, fontSize: 'var(--crm-text-5xl)', fontWeight: 800, letterSpacing: -0.7,
              color: nd.ink, lineHeight: 1,
            }}>{t('new_deal')}</h1>
            <div style={{ flex: 1 }} />
            <button onClick={onClose} title={t('modal.close')} style={{
              width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
              background: nd.cardSubtle,
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <MEIcon name="close" size={17} color={nd.inkSoft} />
            </button>
          </div>

          <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.15fr 1.15fr 0.95fr' }}>
            {/* Colonne 1 — Contact */}
            <div style={colPad}>
              {colLabel(t('modal.contact'), (
                <span style={{ marginLeft: 'auto' }}>
                  <div style={{ display: 'inline-flex', padding: 'var(--crm-space-xs)', gap: 'var(--crm-space-xs)', borderRadius: 'var(--crm-radius-pill)', background: nd.cardSubtle }}>
                    {([
                      { v: 'existing' as const, label: t('modal.existing') },
                      { v: 'new' as const, label: t('modal.new') },
                    ]).map(o => (
                      <button key={o.v} onClick={() => setContactMode(o.v)} style={{
                        height: 36, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                        background: contactMode === o.v ? nd.ink : 'transparent',
                        color: contactMode === o.v ? nd.accentInk : nd.inkSoft,
                        fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--crm-text-lg)', cursor: 'pointer',
                        transition: 'all .16s ease',
                      }}>{o.label}</button>
                    ))}
                  </div>
                </span>
              ))}
              {contactMode === 'existing' ? (
                <div>
                  {selectedContact ? (
                    pickRow({
                      selected: true,
                      onClick: () => setContactId(null),
                      left: avatar(selectedContact),
                      title: `${selectedContact.firstName} ${selectedContact.lastName}`,
                    })
                  ) : (
                    <>
                      <div style={{ position: 'relative', marginBottom: 6 }}>
                        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
                          <MEIcon name="search" size={16} color={nd.muted} />
                        </span>
                        <input value={contactQuery} onChange={e => setContactQuery(e.target.value)}
                          placeholder={t('modal.searchContact')} autoFocus
                          style={searchInputStyle} />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
                        {filteredContacts.length === 0 ? (
                          <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-xl)' }}>
                            <div style={{ fontSize: 'var(--crm-text-lg)', color: nd.muted, fontWeight: 500 }}>
                              {allContacts.length === 0 ? t('modal.noContactsYet') : t('modal.noContactFound')}
                            </div>
                            <button
                              onClick={() => {
                                setContactMode('new')
                                if (contactQuery) {
                                  const parts = contactQuery.trim().split(/\s+/)
                                  setNewContact(p => ({ ...p, firstName: parts[0] || '', lastName: parts.slice(1).join(' ') }))
                                }
                              }}
                              style={{
                                marginTop: 10, height: 38, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
                                cursor: 'pointer', background: nd.cardSubtle, color: nd.ink,
                                fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--crm-text-md)',
                              }}>
                              {allContacts.length === 0 || !contactQuery
                                ? t('modal.createContact')
                                : t('modal.createNamed', { name: contactQuery })}
                            </button>
                          </div>
                        ) : (
                          filteredContacts.map(c => pickRow({
                            key: c.id,
                            onClick: () => setContactId(c.id),
                            left: avatar(c),
                            title: `${c.firstName} ${c.lastName}`,
                          }))
                        )}
                        {moreContacts > 0 && (
                          <div style={moreLineStyle}>{t('modal.moreContacts', { count: moreContacts })}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
                  {field(t('modal.firstName'), newContact.firstName, v => setNewContact(p => ({ ...p, firstName: v })))}
                  {field(t('modal.lastName'), newContact.lastName, v => setNewContact(p => ({ ...p, lastName: v })))}
                  {field(t('modal.email'), newContact.email, v => setNewContact(p => ({ ...p, email: v })), { type: 'email', span2: true })}
                  {field(t('modal.phone'), newContact.phone, v => setNewContact(p => ({ ...p, phone: v })), { span2: true })}
                </div>
              )}
            </div>

            {/* Colonne 2 — Bien (optionnel) */}
            <div style={{ ...colPad, borderLeft: hair }}>
              {colLabel(t('modal.bien'), selectedBien ? (
                <span style={{ marginLeft: 'auto' }}>
                  <button onClick={() => setBienId(null)} style={ghostLinkStyle}>{t('modal.removeBien')}</button>
                </span>
              ) : undefined)}
              {selectedBien ? (
                pickRow({
                  selected: true,
                  onClick: () => setBienId(null),
                  left: bienIcon,
                  title: selectedBien.title,
                  right: (
                    <span style={{
                      fontSize: 'var(--crm-text-lg)', fontWeight: 700, color: nd.inkSoft,
                      fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                    }}>{crmFmtCHF(selectedBien.price || selectedBien.rent || 0)}</span>
                  ),
                })
              ) : (
                <>
                  <div style={{ position: 'relative', marginBottom: 6 }}>
                    <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }}>
                      <MEIcon name="search" size={16} color={nd.muted} />
                    </span>
                    <input value={bienQuery} onChange={e => setBienQuery(e.target.value)}
                      placeholder={t('modal.searchBien')}
                      style={searchInputStyle} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)' }}>
                    {filteredBiens.length === 0 && (
                      <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-xl)', fontSize: 'var(--crm-text-lg)', color: nd.muted, fontWeight: 500 }}>
                        {allBiens.length === 0 ? t('modal.noActiveBiens') : t('modal.noBienFound')}
                      </div>
                    )}
                    {filteredBiens.map(b => pickRow({
                      key: b.id,
                      onClick: () => setBienId(b.id),
                      left: bienIcon,
                      title: b.title,
                      right: (
                        <span style={{
                          fontSize: 'var(--crm-text-lg)', fontWeight: 700, color: nd.inkSoft,
                          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap',
                        }}>{crmFmtCHF(b.price || b.rent || 0)}</span>
                      ),
                    }))}
                    {moreBiens > 0 && (
                      <div style={moreLineStyle}>{t('modal.moreBiens', { count: moreBiens })}</div>
                    )}
                  </div>
                  <div style={{ flex: 1 }} />
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: nd.muted, marginTop: 12, flexShrink: 0 }}>
                    {t('modal.valueFromBien')}
                  </div>
                </>
              )}
            </div>

            {/* Colonne 3 — Étape + Valeur */}
            <div style={{ ...colPad, borderLeft: hair }}>
              {colLabel(t('filter.stage'))}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
                {CRM_STAGE_ORDER.map(sk => {
                  const col = SG_STAGE_HUE[sk]
                  const active = stage === sk
                  return (
                    <button key={sk} onClick={() => setStage(sk)} style={{
                      height: 36, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
                      background: active ? col : nd.cardSubtle,
                      color: active ? '#fff' : nd.inkSoft,
                      fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--crm-text-md)',
                      whiteSpace: 'nowrap', letterSpacing: -0.1,
                    }}>
                      {t(`stages.${sk}`)}
                    </button>
                  )
                })}
              </div>
              <div style={{ marginTop: 26 }}>{colLabel(t('modal.value'))}</div>
              {field(t('modal.value'), value, v => setValue(v.replace(/[^\d]/g, '')), { prefix: 'CHF' })}
            </div>
          </div>

          {/* Pied de surface */}
          <div style={{
            flexShrink: 0, borderTop: hair, padding: '16px 26px',
            display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)',
          }}>
            {error && (
              <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: dark ? '#F26B65' : '#B91C1C', minWidth: 0 }}>
                {error}
              </div>
            )}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={ghostLinkStyle}>{t('modal.cancel')}</button>
            <button onClick={handleCreate} disabled={!canCreate || creating} style={{
              height: 44, padding: '0 var(--crm-space-6xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              // ⛔ L'état DÉSACTIVÉ pose une encre secondaire sur un aplat
              // `ghost` : 2,86:1 en clair et 3,69:1 en sombre — sous l'AA dans
              // les DEUX thèmes. Un bouton désactivé reste lu (c'est lui qui dit
              // ce qui manque) ; son encre se dérive de son propre fond.
              background: (!canCreate || creating) ? nd.ghost : nd.accent,
              color: (!canCreate || creating) ? encreSur(nd.ghost) : nd.accentInk,
              fontFamily: 'inherit', fontWeight: 700, fontSize: 'var(--crm-text-xl)',
              cursor: (!canCreate || creating) ? 'not-allowed' : 'pointer',
              boxShadow: (!canCreate || creating) ? 'none' : nd.shadow,
              display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-md)',
              transition: 'all .18s cubic-bezier(.2,.8,.2,1)',
            }}>
              {creating ? t('modal.creating') : t('modal.create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
