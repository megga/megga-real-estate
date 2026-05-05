import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ACCOUNT_TOKENS as T } from '@/lib/account-tokens'
import SectionShell, { EmptyInline } from './SectionShell'
import { relativeTime } from './relativeTime'

export interface Signature {
  id: string
  bienId: string
  thumb: string | null
  styleLabel: string
  signedAt: string
  manifestId: string
  share: 'public' | 'private'
  listingTitle: string
  photoIdx: number
}

function C2PAMark({ size = 16, color = 'currentColor' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size * 1.15} viewBox="0 0 33 38" fill="none" aria-hidden>
      <path
        d="M16.5 4C9 4 2.5 9.5 2 17c0 1 0.4 1.8 1.2 2.2C6.5 21 11.4 22 16.5 22s10-1 13.3-2.8c0.8-0.4 1.2-1.2 1.2-2.2C30.5 9.5 24 4 16.5 4z"
        stroke={color}
        strokeWidth="1.6"
        fill="none"
      />
      <path d="M2 19v8c0 5 6.5 9 14.5 9S31 32 31 27v-8" stroke={color} strokeWidth="1.6" fill="none" />
      <circle cx="16.5" cy="14" r="2" stroke={color} strokeWidth="1.4" fill="none" />
    </svg>
  )
}

function SignatureThumb({ sig, onClick }: { sig: Signature; onClick: () => void }) {
  const ago = relativeTime(new Date(sig.signedAt))
  return (
    <button
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 180,
        border: `1px solid ${T.border}`,
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        textAlign: 'left',
        padding: 0,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        transition: 'transform 0.15s ease, box-shadow 0.15s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = '0 6px 18px rgba(14,20,16,0.10)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'translateY(0)'
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 130,
          background: sig.thumb
            ? `center/cover no-repeat url(${sig.thumb})`
            : 'linear-gradient(135deg,#d8d8d0,#b8b8ae)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,200,140,0.12)',
            mixBlendMode: 'soft-light',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            padding: '4px 8px',
            borderRadius: 999,
            background: 'rgba(255,255,255,0.95)',
            fontFamily: T.fontStack,
            fontSize: 9,
            fontWeight: 800,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: T.ink,
          }}
        >
          <C2PAMark size={9} color={T.ink} /> C2PA
        </div>
        {sig.share === 'private' && (
          <div
            style={{
              position: 'absolute',
              top: 8,
              right: 8,
              padding: '3px 7px',
              borderRadius: 999,
              background: 'rgba(14,20,16,0.78)',
              color: '#fff',
              fontFamily: T.fontStack,
              fontSize: 9,
              fontWeight: 700,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            Privée
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 12,
            fontWeight: 700,
            color: T.ink,
            letterSpacing: -0.1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {sig.styleLabel}
        </div>
        <div
          style={{
            fontFamily: T.fontStack,
            fontSize: 10.5,
            color: T.muted,
            marginTop: 2,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {ago}
        </div>
      </div>
    </button>
  )
}

function ManifestListModal({
  signatures,
  onClose,
}: {
  signatures: Signature[]
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(14,20,16,0.55)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        fontFamily: T.fontStack,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(840px, 100%)',
          maxHeight: '90vh',
          overflow: 'hidden',
          background: '#fff',
          borderRadius: 18,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div
          style={{
            padding: '20px 26px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <C2PAMark size={20} color={T.ink} />
            <div>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 16,
                  fontWeight: 700,
                  color: T.ink,
                  letterSpacing: -0.2,
                }}
              >
                Tous mes manifestes C2PA
              </div>
              <div
                style={{
                  fontFamily: T.fontStack,
                  fontSize: 12,
                  color: T.muted,
                  marginTop: 2,
                }}
              >
                {signatures.length} signatures · ordre chronologique
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 34,
              height: 34,
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: T.ink,
            }}
            title="Fermer"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <path d="M3 3l10 10M13 3L3 13" />
            </svg>
          </button>
        </div>

        <div style={{ overflowY: 'auto', padding: '0 26px 24px' }}>
          {signatures.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '72px 1fr auto',
                gap: 14,
                alignItems: 'center',
                padding: '14px 0',
                borderBottom: i < signatures.length - 1 ? `1px solid ${T.border}` : 'none',
              }}
            >
              <div
                style={{
                  width: 72,
                  height: 56,
                  borderRadius: 8,
                  flexShrink: 0,
                  background: s.thumb
                    ? `center/cover no-repeat url(${s.thumb})`
                    : 'linear-gradient(135deg,#d8d8d0,#b8b8ae)',
                }}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontFamily: T.fontStack,
                    fontSize: 13,
                    fontWeight: 700,
                    color: T.ink,
                    marginBottom: 2,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {s.listingTitle} · photo n°{s.photoIdx + 1}
                </div>
                <div
                  style={{
                    fontFamily: T.fontStack,
                    fontSize: 11,
                    color: T.soft,
                    marginBottom: 4,
                  }}
                >
                  Style « {s.styleLabel} » · {s.share === 'public' ? 'Publique' : 'Privée'} ·{' '}
                  {new Date(s.signedAt).toLocaleString('fr-CH', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </div>
                <div
                  style={{
                    fontFamily: T.fontMono,
                    fontSize: 10,
                    color: T.muted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {s.manifestId}
                </div>
              </div>
              <button
                style={{
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: `1px solid ${T.border}`,
                  background: '#fff',
                  color: T.ink,
                  fontFamily: T.fontStack,
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: 'pointer',
                  letterSpacing: 0.2,
                }}
              >
                Inspecter
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>,
    document.body
  )
}

interface Props {
  signatures: Signature[]
}

export default function C2PASignatureGallery({ signatures }: Props) {
  const [modalOpen, setModalOpen] = useState(false)

  const total = signatures.length
  const pub = signatures.filter((s) => s.share === 'public').length
  const priv = total - pub

  if (total === 0) {
    return (
      <SectionShell
        id="profile-c2pa"
        title="Signatures C2PA"
        subtitle="Vos photos signées apparaissent ici dès que vous générez du staging IA."
      >
        <EmptyInline text="Aucune signature pour le moment. Quand vous générez une photo IA pour l'une de vos annonces, MEGGA la signe à votre nom dans un manifeste C2PA — visible et vérifiable par les acheteurs." />
      </SectionShell>
    )
  }

  return (
    <>
      <SectionShell
        id="profile-c2pa"
        title="Mes signatures C2PA"
        subtitle={`${total} photos · ${pub} publiques · ${priv} privées`}
        action={
          <button
            onClick={() => setModalOpen(true)}
            style={{
              height: 30,
              padding: '0 12px',
              borderRadius: 999,
              border: `1px solid ${T.border}`,
              background: '#fff',
              color: T.ink,
              cursor: 'pointer',
              fontFamily: T.fontStack,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 0.2,
            }}
          >
            Tous les manifestes →
          </button>
        }
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: '12px 14px',
            background: '#F2F4F8',
            borderRadius: 10,
            marginBottom: 16,
          }}
        >
          <C2PAMark size={18} color={T.accent} />
          <div style={{ fontFamily: T.fontStack, fontSize: 12, color: T.soft, lineHeight: 1.5 }}>
            <strong style={{ color: T.ink, fontWeight: 700 }}>Votre identité signe.</strong> Chaque photo
            IA générée pour vos annonces est signée par MEGGA + votre compte vérifié. Les acheteurs
            peuvent inspecter la chaîne de provenance.
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 4,
          }}
        >
          {signatures.map((s) => (
            <SignatureThumb key={s.id} sig={s} onClick={() => setModalOpen(true)} />
          ))}
        </div>
      </SectionShell>
      {modalOpen && <ManifestListModal signatures={signatures} onClose={() => setModalOpen(false)} />}
    </>
  )
}
