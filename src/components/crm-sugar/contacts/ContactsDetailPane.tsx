// MEGGA CRM Sugar v2 — Contacts detail pane (right column)
// 1:1 port from `crm-screen-contacts-sugar.jsx` (CtEmptyDetail, CtDetail).

import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { CRM_AI_SUGGESTIONS, type CrmContact } from '../mockData'
import { useContactSugarRelations } from '@/hooks/useContactSugarRelations'
import { crmInitials, type SugarPalette } from '../tokens'
import { CtAiBubble, CtBento, CtChip, CtKv } from './ContactsBentos'
import {
  CtActivity,
  CtComposer,
  CtCriteria,
  CtDeals,
  CtKyc,
  CtMatches,
  CtSellerStats,
} from './ContactsDetailWidgets'
import { ctRelativeTime, ctScoreColor, ctTypeLabel, type CtT } from './helpers'
import { ModalPlanRdv, type RdvPayload } from './ModalPlanRdv'

function CtEmptyDetail({ sp, t }: { sp: SugarPalette; t: CtT }) {
  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        placeItems: 'center',
        padding: 40,
        color: sp.sub,
        fontSize: 13,
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 320 }}>
        <div
          style={{
            width: 56,
            height: 56,
            borderRadius: 999,
            margin: '0 auto 14px',
            background: sp.cardSubBg,
            display: 'grid',
            placeItems: 'center',
            border: `1px solid ${sp.cardBorder}`,
          }}
        >
          <MEIcon name="users" size={22} color={sp.sub} />
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: sp.ink,
            marginBottom: 6,
          }}
        >
          {t('detail.noneSelectedTitle')}
        </div>
        <div style={{ lineHeight: 1.5 }}>{t('detail.noneSelectedDesc')}</div>
      </div>
    </div>
  )
}

interface ContactsDetailPaneProps {
  contact: CrmContact | undefined
  sp: SugarPalette
  dark: boolean
  onPlanRdv: (msg: string) => void
}

export function ContactsDetailPane({
  contact,
  sp,
  dark,
  onPlanRdv,
}: ContactsDetailPaneProps) {
  const { t, i18n } = useTranslation('contacts')
  const [rdvOpen, setRdvOpen] = useState(false)

  // Reset RDV modal when contact changes
  useEffect(() => {
    setRdvOpen(false)
  }, [contact?.id])

  // Relations Supabase : matches / deals / activity / biensOwned du contact
  // courant (hooks call inconditionnel — `undefined` désactive les queries).
  const { matches, deals, activity, biensOwned } = useContactSugarRelations(contact?.id)

  if (!contact) return <CtEmptyDetail sp={sp} t={t} />

  const fullName = contact.firstName + ' ' + contact.lastName
  const initials = crmInitials(fullName)
  const score = contact.score || 0
  const scoreColor = ctScoreColor(score)
  const isBuyer = contact.type === 'buyer' || contact.type === 'tenant'
  const isSeller = contact.type === 'seller' || contact.type === 'landlord'

  // Suggestion IA : pas encore en DB, on conserve la lookup mock (sera vide
  // pour les contacts réels — c'est OK, le widget est masqué quand absent).
  const aiSugForContact = CRM_AI_SUGGESTIONS.find(s => s.contactId === contact.id)
  const matchCount = matches.length
  const dealCount = deals.length

  const handleSaveRdv = (data: RdvPayload) => {
    const dt = new Date(data.date + 'T' + data.time)
    const when = t('detail.rdvWhen', {
      date: dt.toLocaleDateString(i18n.language, { day: 'numeric', month: 'short' }),
      time: data.time,
    })
    onPlanRdv(
      t('detail.rdvPlanned', { type: t(`detail.rdvType.${data.type}`), when }),
    )
  }

  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      {/* Header bento */}
      <CtBento sp={sp} noTitle padding="22px 24px">
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
          <div
            style={{
              width: 60,
              height: 60,
              borderRadius: 999,
              background: contact.avatarBg || '#0041D9',
              color: '#fff',
              fontSize: 18,
              fontWeight: 800,
              display: 'grid',
              placeItems: 'center',
              border: `2px solid ${sp.avatarBorder}`,
              boxShadow: `0 6px 18px ${(contact.avatarBg || '#0041D9') + '55'}`,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                marginBottom: 6,
                flexWrap: 'wrap',
              }}
            >
              <h1
                style={{
                  margin: 0,
                  fontSize: 26,
                  fontWeight: 800,
                  color: sp.ink,
                  letterSpacing: -0.7,
                  lineHeight: 1.05,
                }}
              >
                {fullName}
              </h1>
              <CtChip
                sp={sp}
                dark={dark}
                color={
                  contact.type === 'buyer'
                    ? '#0041D9'
                    : contact.type === 'seller'
                      ? '#B45309'
                      : '#06B6D4'
                }
              >
                {ctTypeLabel(contact.type, t)}
              </CtChip>
              <CtChip sp={sp} dark={dark}>
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: 999,
                    background: scoreColor,
                  }}
                />
                {t('detail.scoreChip', { score })}
              </CtChip>
            </div>
            <div style={{ fontSize: 12.5, color: sp.soft, fontWeight: 500 }}>
              <a
                href={`mailto:${contact.email}`}
                style={{ color: sp.soft, textDecoration: 'none' }}
                onMouseEnter={e => (e.currentTarget.style.color = sp.ink)}
                onMouseLeave={e => (e.currentTarget.style.color = sp.soft)}
              >
                {contact.email}
              </a>
              {' · '}
              <a
                href={`tel:${(contact.phone || '').replace(/\s/g, '')}`}
                style={{
                  color: sp.soft,
                  textDecoration: 'none',
                  fontFamily: 'JetBrains Mono, monospace',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = sp.ink)}
                onMouseLeave={e => (e.currentTarget.style.color = sp.soft)}
              >
                {contact.phone}
              </a>
              {' · '}
              {contact.lang?.toUpperCase()}
            </div>
            <div style={{ fontSize: 11.5, color: sp.sub, marginTop: 4 }}>
              {t('detail.metaLine', {
                source: contact.source,
                date: (contact.createdAt || '').slice(0, 10),
                activity: ctRelativeTime(contact.lastActivityAt, t),
              })}
            </div>
            {(contact.tags?.length ?? 0) > 0 && (
              <div
                style={{
                  display: 'flex',
                  gap: 6,
                  flexWrap: 'wrap',
                  marginTop: 10,
                }}
              >
                {contact.tags!.map(tag => (
                  <CtChip key={tag} sp={sp} dark={dark}>
                    #{tag}
                  </CtChip>
                ))}
                <button
                  style={{
                    padding: '3px 10px',
                    borderRadius: 999,
                    background: 'transparent',
                    border: `1px dashed ${sp.cardBorder}`,
                    color: sp.sub,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >
                  {t('detail.addTag')}
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setRdvOpen(true)}
              title={t('detail.planRdvTitle')}
              aria-label={t('detail.planRdvTitle')}
              style={{
                height: 36,
                padding: '0 14px',
                borderRadius: 999,
                background: dark ? '#FFFFFF' : sp.ink,
                border: 0,
                color: dark ? '#0A0A0F' : sp.pageBg,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                boxShadow: sp.focusShadow,
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: 700,
              }}
            >
              <MEIcon name="calendar" size={13} color={dark ? '#0A0A0F' : sp.pageBg} />
              {t('detail.plan')}
            </button>
            <button
              title={t('detail.moreActions')}
              aria-label={t('detail.moreActions')}
              style={{
                width: 36,
                height: 36,
                borderRadius: 999,
                background: dark ? 'rgba(255,255,255,0.06)' : sp.pageBg,
                border: `1px solid ${sp.cardBorder}`,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                boxShadow: sp.shadowSm,
                fontFamily: 'inherit',
                color: sp.soft,
                fontSize: 18,
                lineHeight: 0,
              }}
            >
              ···
            </button>
          </div>
        </div>
      </CtBento>

      {/* AI suggestion */}
      {aiSugForContact && (
        <CtAiBubble
          sp={sp}
          dark={dark}
          title={aiSugForContact.title}
          body={aiSugForContact.body}
          cta={aiSugForContact.cta}
        />
      )}

      {/* Première rangée : Activité + Saisie — même hauteur */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          alignItems: 'stretch',
        }}
      >
        <CtBento
          sp={sp}
          title={t('detail.recentActivity')}
          action={
            <button
              style={{
                background: 'transparent',
                border: 0,
                color: sp.sub,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('detail.seeAll')}
            </button>
          }
        >
          <CtActivity contact={contact} activity={activity} sp={sp} fill />
        </CtBento>

        <CtBento sp={sp} title={t('detail.quickEntry')}>
          <CtComposer sp={sp} dark={dark} fill />
        </CtBento>
      </div>

      {/* Grille 2 colonnes — bentos denses */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 24,
          alignItems: 'start',
        }}
      >
        {/* Row 1 : Critères (G) | KYC + Notes (D, empilés) */}
        {isBuyer && contact.criteria && (
          <CtBento
            sp={sp}
            title={t('detail.searchCriteria')}
            style={{ height: '100%' }}
            action={
              <button
                style={{
                  background: 'transparent',
                  border: 0,
                  color: sp.sub,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('detail.modify')}
              </button>
            }
          >
            <CtCriteria contact={contact} sp={sp} dark={dark} />
          </CtBento>
        )}
        {isSeller && (
          <CtBento sp={sp} title={t('detail.mandatesDistribution')} style={{ height: '100%' }}>
            <CtSellerStats contact={contact} biensOwned={biensOwned} sp={sp} />
          </CtBento>
        )}

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 24,
            height: '100%',
          }}
        >
          <CtBento sp={sp} title={t('detail.kycCompliance')} style={{ flex: 1 }}>
            <CtKyc contact={contact} sp={sp} fill />
          </CtBento>
          <CtBento
            sp={sp}
            title={t('detail.internalNotes')}
            style={{ flex: 1 }}
            action={
              <button
                style={{
                  background: 'transparent',
                  border: 0,
                  color: sp.sub,
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('detail.modify')}
              </button>
            }
          >
            <div style={{ fontSize: 13, color: sp.soft, lineHeight: 1.65 }}>
              {contact.notes || (
                <span style={{ color: sp.sub, fontStyle: 'italic' }}>
                  {t('detail.noNotes')}
                </span>
              )}
            </div>
          </CtBento>
        </div>

        {/* Row 2 : Deals (G) | Préférences (D) */}
        <CtBento
          sp={sp}
          title={t('detail.dealsTitle', { count: dealCount })}
          action={
            <button
              style={{
                background: 'transparent',
                border: 0,
                color: sp.sub,
                fontSize: 11,
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('detail.newShort')}
            </button>
          }
        >
          <CtDeals contact={contact} deals={deals} sp={sp} fill />
        </CtBento>

        <CtBento sp={sp} title={t('detail.preferences')} padding="14px 20px">
          <CtKv sp={sp} label={t('detail.prefLanguage')} value={contact.lang?.toUpperCase() || '—'} />
          <CtKv
            sp={sp}
            label={t('detail.prefChannel')}
            value={
              [contact.email && t('detail.channelEmail'), contact.phone && t('detail.channelPhone')]
                .filter(Boolean)
                .join(' · ') || '—'
            }
          />
          <CtKv sp={sp} label={t('detail.prefMoment')} value={t('detail.notProvided')} />
          <CtKv sp={sp} label={t('detail.prefAgent')} value={contact.assignedTo || t('detail.unassigned')} />
        </CtBento>

        {/* Row 3 : Matchs span 2 */}
        {isBuyer && (
          <CtBento
            sp={sp}
            span={2}
            title={t('detail.matchesTitle', { count: matchCount })}
            action={
              <button
                style={{
                  background: 'transparent',
                  border: 0,
                  color: '#0041D9',
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {t('detail.seeAllArrow')}
              </button>
            }
          >
            <CtMatches contact={contact} matches={matches} sp={sp} />
          </CtBento>
        )}
      </div>

      {rdvOpen && (
        <ModalPlanRdv
          contact={contact}
          sp={sp}
          dark={dark}
          onClose={() => setRdvOpen(false)}
          onSave={handleSaveRdv}
        />
      )}
    </div>
  )
}
