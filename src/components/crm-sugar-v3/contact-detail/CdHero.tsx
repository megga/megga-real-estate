// MEGGA CRM Sugar v3 — Hero fiche contact
// Port 1:1 de crm-screen-contact-detail-sugar.jsx lignes 216-305 (CdHero).

import { useTranslation } from 'react-i18next'
import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycAvatar, KycBlackPill, KycCircleBtn, KycNeutralPill } from '../primitives'
import type { Contact } from '@/types/contact'
import { useContactScores } from '@/hooks/useContactScores'
import { CtScoreBadge } from '@/components/crm-sugar/contacts/CtScoreBadge'

interface Props {
  contact: Contact
  onBack: () => void
  /** Nom de l'agent qui suit ce contact (agent connecté). Défaut : « Non assigné ». */
  agentName?: string
  /** Ouvre la planification (calendrier). */
  onSchedule?: () => void
  /** Crée une nouvelle action (visite/RDV) pour ce contact. */
  onNewAction?: () => void
}

export function CdHero({ contact, onBack, agentName, onSchedule, onNewAction }: Props) {
  const { t } = useTranslation('contacts')
  const phoneDigits = (contact.phone ?? '').replace(/[^\d]/g, '')
  const { scores: contactScores } = useContactScores()
  const contactHealth = contactScores.get(contact.id)
  // Libellé type de contact via la famille contactType.* (clés partagées avec
  // ctTypeLabel). `both` → clé `mixed` (Mixte). Fallback = type brut.
  const typeKey = contact.type === 'both' ? 'mixed' : contact.type
  const typeLabel = t(`contactType.${typeKey}`, { defaultValue: contact.type })

  const score = contact.score
  const scoreTone =
    score === 'hot'
      ? SugarV3.ok
      : score === 'warm'
        ? SugarV3.black
        : score === 'cold'
          ? SugarV3.warn
          : SugarV3.muted

  const langLabel =
    { fr: 'Français', en: 'English', de: 'Deutsch', it: 'Italiano' }[
      contact.language
    ] ?? contact.language

  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 28,
        padding: '32px 36px',
        boxShadow: SugarV3.shadowLg,
        marginBottom: 24,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <button
        onClick={onBack}
        style={{
          border: 0,
          background: 'transparent',
          color: SugarV3.muted,
          fontFamily: 'inherit',
          fontSize: 12,
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          marginBottom: 24,
          padding: 0,
          letterSpacing: 0.2,
        }}
      >
        <SgIcon name="arrowL" size={14} stroke={SugarV3.muted} />
        {t('cd.backToContacts')}
      </button>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto',
          gap: 24,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <KycAvatar
            firstName={contact.first_name}
            lastName={contact.last_name}
            size={96}
          />

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: SugarV3.muted,
                letterSpacing: 1.2,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              {typeLabel}
            </div>
            <h1
              style={{
                margin: '0 0 12px',
                fontSize: 36,
                fontWeight: 700,
                color: SugarV3.ink,
                letterSpacing: -0.7,
                lineHeight: 1.05,
              }}
            >
              {contact.first_name} {contact.last_name}
            </h1>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                flexWrap: 'wrap',
              }}
            >
              {score && (
                <KycNeutralPill
                  tone={scoreTone}
                  label={
                    score === 'hot'
                      ? t('cd.scoreHot')
                      : score === 'warm'
                        ? t('cd.scoreWarm')
                        : t('cd.scoreCold')
                  }
                />
              )}
              {contactHealth && <CtScoreBadge health={contactHealth} size="md" />}
              {contact.source && (
                <KycNeutralPill label={t('cd.sourceLabel', { source: contact.source })} />
              )}
              {contact.tags?.slice(0, 3).map((tg) => (
                <KycNeutralPill key={tg} label={tg} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <KycCircleBtn
            title={contact.phone ? t('cd.callTitle', { phone: contact.phone }) : t('cd.noPhone')}
            onClick={() => {
              if (contact.phone) window.location.href = `tel:${contact.phone}`
            }}
            icon={<SgIcon name="phone" size={17} stroke={SugarV3.inkSoft} />}
          />
          <KycCircleBtn
            title={contact.email ? t('cd.emailTitle', { email: contact.email }) : t('cd.noEmail')}
            onClick={() => {
              if (contact.email) window.location.href = `mailto:${contact.email}`
            }}
            icon={<SgIcon name="mail" size={17} stroke={SugarV3.inkSoft} />}
          />
          <KycCircleBtn
            title={phoneDigits ? t('cd.whatsappTitle') : t('cd.noPhone')}
            onClick={() => {
              if (phoneDigits)
                window.open(`https://wa.me/${phoneDigits}`, '_blank', 'noopener,noreferrer')
            }}
            icon={<SgIcon name="msg" size={17} stroke={SugarV3.inkSoft} />}
          />
          <KycCircleBtn
            title={t('cd.scheduleTitle')}
            onClick={onSchedule}
            icon={<SgIcon name="cal" size={17} stroke={SugarV3.inkSoft} />}
          />
          <KycBlackPill
            size="md"
            onClick={onNewAction}
            icon={<SgIcon name="plus" size={14} stroke="#fff" sw={2} />}
          >
            {t('cd.newAction')}
          </KycBlackPill>
        </div>
      </div>

      {/* Coordonnées en bas */}
      <div
        className="sg-grid-coords"
        style={{
          marginTop: 28,
          paddingTop: 22,
          borderTop: `1px solid ${SugarV3.cardSubtle}`,
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 24,
        }}
      >
        <KvBlock label={t('cd.kvEmail')} value={contact.email ?? '—'} />
        <KvBlock label={t('cd.kvPhone')} value={contact.phone ?? '—'} mono />
        <KvBlock label={t('cd.kvLanguage')} value={langLabel} />
        <KvBlock label={t('cd.kvAgent')} value={agentName || t('cd.unassigned')} />
      </div>
    </div>
  )
}

function KvBlock({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <div>
      <div
        style={{
          fontSize: 11,
          color: SugarV3.muted,
          fontWeight: 600,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 6,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 13.5,
          color: SugarV3.ink,
          fontWeight: 600,
          fontVariantNumeric: mono ? 'tabular-nums' : undefined,
        }}
      >
        {value}
      </div>
    </div>
  )
}
