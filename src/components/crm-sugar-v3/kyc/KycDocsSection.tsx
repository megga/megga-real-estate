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
          {docs.map((d) => (
            <div
              key={d.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '12px 14px',
                borderRadius: 14,
                background: SugarV3.cardSubtle,
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
                    fontSize: 13.5,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {d.name}
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
          ))}
        </div>
      )}
    </div>
  )
}
