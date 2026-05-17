// MEGGA CRM Sugar v2 — Contacts detail pane (right column)
// 1:1 port from `crm-screen-contacts-sugar.jsx` (CtEmptyDetail, CtDetail).

import { useEffect, useState } from 'react'
import CRMIcon from '../CRMIcon'
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
import { ctRelativeTime, ctScoreColor, ctTypeLabel } from './helpers'
import { ModalPlanRdv, type RdvPayload } from './ModalPlanRdv'

function CtEmptyDetail({ sp }: { sp: SugarPalette }) {
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
          <CRMIcon name="contacts" size={22} stroke={sp.sub} />
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: sp.ink,
            marginBottom: 6,
          }}
        >
          Aucun contact sélectionné
        </div>
        <div style={{ lineHeight: 1.5 }}>
          Choisissez un contact dans la liste pour voir sa fiche détaillée.
        </div>
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
  const [rdvOpen, setRdvOpen] = useState(false)

  // Reset RDV modal when contact changes
  useEffect(() => {
    setRdvOpen(false)
  }, [contact?.id])

  // Relations Supabase : matches / deals / activity / biensOwned du contact
  // courant (hooks call inconditionnel — `undefined` désactive les queries).
  const { matches, deals, activity, biensOwned } = useContactSugarRelations(contact?.id)

  if (!contact) return <CtEmptyDetail sp={sp} />

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
    const labels: Record<RdvPayload['type'], string> = {
      visit: 'Visite',
      phone: 'Téléphone',
      video: 'Visio',
      notary: 'Signature notaire',
      other: 'RDV',
    }
    const dt = new Date(data.date + 'T' + data.time)
    const fmt =
      dt.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) +
      ' à ' +
      data.time
    onPlanRdv(`${labels[data.type]} planifié — ${fmt}`)
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
                {ctTypeLabel(contact.type)}
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
                Score {score}
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
              Source : {contact.source} · Créé le{' '}
              {(contact.createdAt || '').slice(0, 10)} · Dernière activité{' '}
              {ctRelativeTime(contact.lastActivityAt)}
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
                  + Tag
                </button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <button
              onClick={() => setRdvOpen(true)}
              title="Planifier un rendez-vous"
              aria-label="Planifier un rendez-vous"
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
              <CRMIcon name="cal" size={13} stroke={dark ? '#0A0A0F' : sp.pageBg} />
              Planifier
            </button>
            <button
              title="Plus d'actions"
              aria-label="Plus d'actions"
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
          title="Activité récente"
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
              Tout voir
            </button>
          }
        >
          <CtActivity contact={contact} activity={activity} sp={sp} fill />
        </CtBento>

        <CtBento sp={sp} title="Saisie rapide">
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
            title="Critères de recherche"
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
                Modifier
              </button>
            }
          >
            <CtCriteria contact={contact} sp={sp} dark={dark} />
          </CtBento>
        )}
        {isSeller && (
          <CtBento sp={sp} title="Mandats & diffusion" style={{ height: '100%' }}>
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
          <CtBento sp={sp} title="Conformité KYC / LBA" style={{ flex: 1 }}>
            <CtKyc contact={contact} sp={sp} fill />
          </CtBento>
          <CtBento
            sp={sp}
            title="Notes internes"
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
                Modifier
              </button>
            }
          >
            <div style={{ fontSize: 13, color: sp.soft, lineHeight: 1.65 }}>
              {contact.notes || (
                <span style={{ color: sp.sub, fontStyle: 'italic' }}>
                  Aucune note pour ce contact.
                </span>
              )}
            </div>
          </CtBento>
        </div>

        {/* Row 2 : Deals (G) | Préférences (D) */}
        <CtBento
          sp={sp}
          title={`Deals · ${dealCount}`}
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
              + Nouveau
            </button>
          }
        >
          <CtDeals contact={contact} deals={deals} sp={sp} fill />
        </CtBento>

        <CtBento sp={sp} title="Préférences" padding="14px 20px">
          <CtKv sp={sp} label="Langue" value={contact.lang?.toUpperCase()} />
          <CtKv sp={sp} label="Canal" value="Email + Tél." />
          <CtKv sp={sp} label="Moment" value="9h–12h sem." />
          <CtKv sp={sp} label="Agent" value="Gregory Lyonnet" />
        </CtBento>

        {/* Row 3 : Matchs span 2 */}
        {isBuyer && (
          <CtBento
            sp={sp}
            span={2}
            title={`Matchs · ${matchCount}`}
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
                Tout voir →
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
