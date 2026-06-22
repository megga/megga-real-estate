// MEGGA CRM Sugar v3 — Section documents joints du dossier
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 429-496 (KycDocsSection).

import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { fmtDateShort } from '../tokens'
import { KycCircleBtn, KycGhostPill } from './kycPrimitives'
import { useKycPalette } from './kycPalette'
import { SgIcon } from '../icons'
import type { KycDocument } from '@/types/kyc'

interface Props {
  docs: KycDocument[]
  onUpload?: () => void
  /** Open the document in a new tab via a signed URL. Optional — when
   * omitted the eye button is hidden. Compliance: nLPD art. 8 (right to
   * consult), LBA art. 7 (proof of due diligence). */
  onPreview?: (doc: KycDocument) => void
  /** Force-download via signed URL with Content-Disposition. Optional —
   * when omitted the download button is hidden. */
  onDownload?: (doc: KycDocument) => void
}

type ExpiryStatus = { kind: 'expired' | 'soon' | 'ok'; label: string }

const EXPIRY_SOON_DAYS = 30

function getExpiryStatus(expiresAt: string | null, t: TFunction): ExpiryStatus | null {
  if (!expiresAt) return null
  const ts = new Date(expiresAt).getTime()
  if (Number.isNaN(ts)) return null
  const now = Date.now()
  if (ts <= now) {
    return { kind: 'expired', label: t('dossier.docs.expired') }
  }
  const daysLeft = Math.ceil((ts - now) / (1000 * 60 * 60 * 24))
  if (daysLeft <= EXPIRY_SOON_DAYS) {
    return { kind: 'soon', label: t('dossier.docs.expiresInDays', { count: daysLeft }) }
  }
  return { kind: 'ok', label: t('dossier.docs.validUntil', { date: fmtDateShort(expiresAt) }) }
}

export function KycDocsSection({ docs, onUpload, onPreview, onDownload }: Props) {
  const sp = useKycPalette()
  const { t } = useTranslation('kyc')
  return (
    <div
      style={{
        background: sp.card,
        borderRadius: 22,
        padding: '26px 28px',
        border: `1px solid ${sp.cardBorder}`,
        boxShadow: sp.shadow,
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: docs.length ? 20 : 0,
        }}
      >
        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: sp.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            {t('dossier.docs.eyebrow')}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: sp.ink,
              letterSpacing: -0.3,
            }}
          >
            {t('dossier.docs.title')}
          </h3>
        </div>
        <KycGhostPill
          onClick={onUpload}
          icon={<SgIcon name="upload" size={14} stroke={sp.inkSoft} />}
        >
          {t('dossier.docs.upload')}
        </KycGhostPill>
      </div>

      {docs.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: sp.cardSubtle,
            borderRadius: 16,
            color: sp.muted,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          {t('dossier.docs.emptyTitle')}
          <br />
          {t('dossier.docs.emptySubtitle')}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((d) => {
            const expiry = getExpiryStatus(d.expires_at, t)
            const expiredBg = expiry?.kind === 'expired'
            return (
              <div
                key={d.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                  padding: '12px 14px',
                  borderRadius: 14,
                  background: expiredBg ? sp.errSoft : sp.cardSubtle,
                  border: expiredBg ? `1px solid ${sp.err}33` : 'none',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: sp.card,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SgIcon name="file" size={18} stroke={sp.inkSoft} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13.5,
                        fontWeight: 700,
                        color: sp.ink,
                        letterSpacing: -0.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        maxWidth: '100%',
                      }}
                    >
                      {d.name}
                    </span>
                    {expiry && expiry.kind !== 'ok' && (
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 700,
                          letterSpacing: 0.4,
                          textTransform: 'uppercase',
                          color:
                            expiry.kind === 'expired'
                              ? sp.errDarker
                              : sp.warn,
                        }}
                      >
                        {expiry.label}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: sp.muted,
                      fontWeight: 500,
                      marginTop: 1,
                    }}
                  >
                    {d.size_bytes
                      ? t('dossier.docs.fileSize', {
                          size: (d.size_bytes / (1024 * 1024)).toFixed(1),
                        })
                      : '—'}{' '}
                    · {t('dossier.docs.addedOn', { date: fmtDateShort(d.created_at) })}
                    {expiry?.kind === 'ok' && ` · ${expiry.label}`}
                    {d.sha256_hash && (
                      <span
                        title={t('dossier.docs.shaFull', { hash: d.sha256_hash })}
                        style={{ marginLeft: 6 }}
                      >
                        · {t('dossier.docs.shaPrefix', { hash: d.sha256_hash.slice(0, 8) })}
                      </span>
                    )}
                  </div>
                </div>
                {onPreview && (
                  <KycCircleBtn
                    size={36}
                    title={t('dossier.docs.preview')}
                    onClick={() => onPreview(d)}
                    icon={<SgIcon name="eye" size={14} stroke={sp.inkSoft} />}
                  />
                )}
                {onDownload && (
                  <KycCircleBtn
                    size={36}
                    title={t('dossier.docs.download')}
                    onClick={() => onDownload(d)}
                    icon={
                      <SgIcon name="download" size={14} stroke={sp.inkSoft} />
                    }
                  />
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
