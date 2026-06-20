// MEGGA CRM Sugar v3 — Card Documents
// Port 1:1 de crm-screen-contact-detail-sugar.jsx lignes 625-662 (CdDocsCard).

import { useTranslation } from 'react-i18next'
import { SugarV3, fmtDateShort } from '../tokens'
import { SgIcon } from '../icons'
import { KycCircleBtn, KycGhostPill, KycSection } from '../primitives'

interface DocItem {
  id: string
  name: string
  // Nullable: aligns with the Supabase column (DEFAULT now() but NULL allowed).
  // fmtDateShort below already handles null/undefined defensively.
  created_at: string | null
}

interface Props {
  docs: DocItem[]
}

export function CdDocsCard({ docs }: Props) {
  const { t } = useTranslation('contacts')
  return (
    <KycSection
      title={t('detail.docs.title')}
      eyebrow={t('detail.docs.count', { count: docs.length })}
      action={
        <KycGhostPill
          size="sm"
          icon={<SgIcon name="upload" size={13} stroke={SugarV3.inkSoft} />}
        >
          {t('detail.docs.upload')}
        </KycGhostPill>
      }
    >
      {docs.length === 0 ? (
        <div
          style={{
            padding: '28px 20px',
            textAlign: 'center',
            background: SugarV3.cardSubtle,
            borderRadius: 14,
            color: SugarV3.muted,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {t('detail.docs.empty')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '12px 14px',
                borderRadius: 14,
                background: SugarV3.cardSubtle,
              }}
            >
              <div
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 11,
                  background: SugarV3.card,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <SgIcon name="file" size={15} stroke={SugarV3.inkSoft} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.1,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    marginBottom: 1,
                  }}
                >
                  {d.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: SugarV3.muted,
                    fontWeight: 500,
                  }}
                >
                  {t('detail.docs.addedOn', { date: fmtDateShort(d.created_at) })}
                </div>
              </div>
              <KycCircleBtn
                size={32}
                icon={
                  <SgIcon name="download" size={13} stroke={SugarV3.inkSoft} />
                }
              />
            </div>
          ))}
        </div>
      )}
    </KycSection>
  )
}
