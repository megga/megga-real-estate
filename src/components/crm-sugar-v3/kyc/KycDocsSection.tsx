// MEGGA CRM Sugar v3 — Section documents joints du dossier
// Port 1:1 de crm-screen-kyc-sugar.jsx lignes 429-496 (KycDocsSection).

import { SugarV3, fmtDateShort } from '../tokens'
import { KycCircleBtn, KycGhostPill } from '../primitives'
import { SgIcon } from '../icons'
import type { KycDocument } from '@/types/kyc'

interface Props {
  docs: KycDocument[]
  onUpload?: () => void
}

type ExpiryStatus = { kind: 'expired' | 'soon' | 'ok'; label: string }

const EXPIRY_SOON_DAYS = 30

function getExpiryStatus(expiresAt: string | null): ExpiryStatus | null {
  if (!expiresAt) return null
  const ts = new Date(expiresAt).getTime()
  if (Number.isNaN(ts)) return null
  const now = Date.now()
  if (ts <= now) {
    return { kind: 'expired', label: 'Expiré' }
  }
  const daysLeft = Math.ceil((ts - now) / (1000 * 60 * 60 * 24))
  if (daysLeft <= EXPIRY_SOON_DAYS) {
    return { kind: 'soon', label: `Expire dans ${daysLeft}j` }
  }
  return { kind: 'ok', label: `Valide jusqu’au ${fmtDateShort(expiresAt)}` }
}

export function KycDocsSection({ docs, onUpload }: Props) {
  return (
    <div
      style={{
        background: SugarV3.card,
        borderRadius: 22,
        padding: '26px 28px',
        boxShadow: SugarV3.shadow,
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
              color: SugarV3.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 4,
            }}
          >
            Pièces du dossier
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: 20,
              fontWeight: 700,
              color: SugarV3.ink,
              letterSpacing: -0.3,
            }}
          >
            Documents joints
          </h3>
        </div>
        <KycGhostPill
          onClick={onUpload}
          icon={<SgIcon name="upload" size={14} stroke={SugarV3.inkSoft} />}
        >
          Téléverser
        </KycGhostPill>
      </div>

      {docs.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            textAlign: 'center',
            background: SugarV3.cardSubtle,
            borderRadius: 16,
            color: SugarV3.muted,
            fontSize: 13,
            fontWeight: 500,
          }}
        >
          Aucun document joint pour l'instant.
          <br />
          Demandez les pièces au contact pour démarrer la vérification.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {docs.map((d) => {
            const expiry = getExpiryStatus(d.expires_at)
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
                  background: expiredBg ? SugarV3.errSoft : SugarV3.cardSubtle,
                  border: expiredBg ? `1px solid ${SugarV3.err}33` : 'none',
                }}
              >
                <div
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: 12,
                    background: SugarV3.card,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <SgIcon name="file" size={18} stroke={SugarV3.inkSoft} />
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
                        color: SugarV3.ink,
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
                              ? SugarV3.errDarker
                              : SugarV3.warn,
                        }}
                      >
                        {expiry.label}
                      </span>
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: SugarV3.muted,
                      fontWeight: 500,
                      marginTop: 1,
                    }}
                  >
                    {d.size_bytes
                      ? `${(d.size_bytes / (1024 * 1024)).toFixed(1)} Mo`
                      : '—'}{' '}
                    · Ajouté le {fmtDateShort(d.created_at)}
                    {expiry?.kind === 'ok' && ` · ${expiry.label}`}
                    {d.sha256_hash && (
                      <span
                        title={`SHA-256 : ${d.sha256_hash}`}
                        style={{ marginLeft: 6 }}
                      >
                        · sha {d.sha256_hash.slice(0, 8)}…
                      </span>
                    )}
                  </div>
                </div>
                <KycCircleBtn
                  size={36}
                  title="Aperçu"
                  icon={<SgIcon name="eye" size={14} stroke={SugarV3.inkSoft} />}
                />
                <KycCircleBtn
                  size={36}
                  title="Télécharger"
                  icon={
                    <SgIcon name="download" size={14} stroke={SugarV3.inkSoft} />
                  }
                />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
