// MEGGA CRM Sugar v3 — Hero fiche contact
// Port 1:1 de crm-screen-contact-detail-sugar.jsx lignes 216-305 (CdHero).

import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycAvatar, KycBlackPill, KycCircleBtn, KycNeutralPill } from '../primitives'
import type { Contact } from '@/types/contact'

interface Props {
  contact: Contact
  onBack: () => void
}

export function CdHero({ contact, onBack }: Props) {
  const typeLabel =
    {
      buyer: 'Acheteur',
      seller: 'Vendeur',
      tenant: 'Locataire',
      landlord: 'Propriétaire',
      investor: 'Investisseur',
      both: 'Mixte',
      lead: 'Lead',
    }[contact.type] ?? contact.type

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
        Retour aux contacts
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
                  label={`Score ${score === 'hot' ? 'Chaud' : score === 'warm' ? 'Tiède' : 'Froid'}`}
                />
              )}
              {contact.source && (
                <KycNeutralPill label={`Source : ${contact.source}`} />
              )}
              {contact.tags?.slice(0, 3).map((tg) => (
                <KycNeutralPill key={tg} label={tg} />
              ))}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <KycCircleBtn
            title="Appeler"
            icon={<SgIcon name="phone" size={17} stroke={SugarV3.inkSoft} />}
          />
          <KycCircleBtn
            title="E-mail"
            icon={<SgIcon name="mail" size={17} stroke={SugarV3.inkSoft} />}
          />
          <KycCircleBtn
            title="Message"
            icon={<SgIcon name="msg" size={17} stroke={SugarV3.inkSoft} />}
          />
          <KycCircleBtn
            title="Planifier"
            icon={<SgIcon name="cal" size={17} stroke={SugarV3.inkSoft} />}
          />
          <KycBlackPill
            size="md"
            icon={<SgIcon name="plus" size={14} stroke="#fff" sw={2} />}
          >
            Nouvelle action
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
        <KvBlock label="E-mail" value={contact.email ?? '—'} />
        <KvBlock label="Téléphone" value={contact.phone ?? '—'} mono />
        <KvBlock label="Langue" value={langLabel} />
        <KvBlock label="Agent référent" value="Gregory Lyonnet" />
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
