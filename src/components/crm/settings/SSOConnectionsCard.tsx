// MEGGA CRM Sugar v2 — Sécurité — Carte « Méthodes de connexion » (SSO).
//
// Câblage RÉEL via useSsoIdentities (supabase.auth getUserIdentities /
// linkIdentity / unlinkIdentity). Le faux OAuth simulé (chrome de navigateur
// + comptes mock) a été RETIRÉ — il était théâtral et trompeur.
//
// Layout « Sugar Pure » (carte blanche/dark, atoms gelés). En haut, une ligne
// « Email + mot de passe · Méthode principale · Active » non supprimable, puis
// Google + Microsoft avec état réel (lié / non lié), Connecter → link (redirect
// OAuth), Déconnecter → confirmation puis unlink.

import { crmVoileEncre } from '@/components/crm/tokens'
import { useState } from 'react'
import type { JSX } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/components/ui/Toast'
import { ConfirmModal, SetBlackBtn, SetGhostBtn, SetIcon } from './atoms'
import { SET_PALETTE } from './data'
import { useSsoIdentities, type SsoProvider } from '@/hooks/useSsoIdentities'

const SET = SET_PALETTE

// ─── Logos officiels (couleurs de marque tierces — exception assumée) ─────
function GoogleG({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  )
}

function MsLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  )
}

interface ProviderDef {
  id: SsoProvider
  name: string
  logo: (props: { size?: number }) => JSX.Element
}

const PROVIDERS: ProviderDef[] = [
  { id: 'google', name: 'Google', logo: GoogleG },
  { id: 'microsoft', name: 'Microsoft', logo: MsLogo },
]

export function SSOConnectionsCard() {
  const { t } = useTranslation('settings')
  const toast = useToast()
  const { isLinked, emailFor, link, unlink, isLoading, error } = useSsoIdentities()
  const [confirmDisc, setConfirmDisc] = useState<SsoProvider | null>(null)
  const [busy, setBusy] = useState<SsoProvider | null>(null)

  const handleConnect = async (id: SsoProvider) => {
    setBusy(id)
    await link(id)
    // link() redirige le navigateur en cas de succès ; si on est encore là,
    // c'est qu'une erreur a été posée dans le hook.
    setBusy(null)
  }

  const handleDisconnect = async (id: SsoProvider) => {
    setConfirmDisc(null)
    setBusy(id)
    const ok = await unlink(id)
    setBusy(null)
    if (ok) toast.success(t('security.sso.disconnected', { name: PROVIDERS.find(p => p.id === id)?.name }))
    else if (error) toast.error(error)
  }

  return (
    <>
      <div
        style={{
          background: SET.card,
          borderRadius: 'var(--crm-radius-5xl)',
          boxShadow: SET.shadow,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
        }}
      >
        {/* En-tête */}
        <div style={{ padding: '28px 28px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', marginBottom: 20 }}>
            {/* Même traitement que la carte « Mot de passe » : le glyphe seul,
                agrandi et teinté. Les deux cartes sont côte à côte — en habiller
                une et pas l'autre se lit comme un défaut d'alignement. */}
            <SetIcon name="link" size={30} stroke={SET.black} sw={1.7} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: 'var(--crm-text-2xl)',
                  fontWeight: 500,
                  color: SET.ink,
                  letterSpacing: -0.3,
                }}
              >
                {t('security.sso.title')}
              </h3>
            </div>
          </div>
        </div>

        <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
          {/* Providers SSO — état réel */}
          {PROVIDERS.map(p => {
            const Logo = p.logo
            const linked = isLinked(p.id)
            const email = emailFor(p.id)
            const pending = busy === p.id
            return (
              <div
                key={p.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--crm-space-xl)',
                  padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
                  borderRadius: 'var(--crm-radius-xl)',
                  background: SET.cardSubtle,
                  boxShadow: `inset 0 0 0 1px ${SET.line}`,
                  opacity: isLoading ? 0.6 : 1,
                  transition: 'opacity .2s',
                }}
              >
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 'var(--crm-radius-md)',
                    background: '#fff',
                    boxShadow: `inset 0 0 0 1px ${crmVoileEncre(false, 0.10)}`,
                    display: 'grid',
                    placeItems: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Logo size={20} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: SET.ink, letterSpacing: -0.1 }}>
                    {p.name}
                  </div>
                  {linked && (
                    <div
                      style={{
                        fontSize: 'var(--crm-text-sm)',
                        color: SET.muted,
                        fontWeight: 400,
                        marginTop: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {t('security.sso.linkedDetail', { account: email ?? t('security.sso.linkedAccount') })}
                    </div>
                  )}
                </div>
                {linked ? (
                  <SetGhostBtn size="sm" onClick={() => setConfirmDisc(p.id)} disabled={pending}>
                    {t('security.sso.disconnect')}
                  </SetGhostBtn>
                ) : (
                  <SetBlackBtn size="sm" onClick={() => handleConnect(p.id)} disabled={pending} loading={pending}>
                    {t('security.sso.connect')}
                  </SetBlackBtn>
                )}
              </div>
            )
          })}

          {/* Erreur honnête (manual linking désactivé, etc.) */}
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 'var(--crm-space-md)',
                padding: 'var(--crm-space-lg) var(--crm-space-xl)',
                borderRadius: 'var(--crm-radius-lg)',
                background: `${SET.warn}12`,
                boxShadow: `inset 0 0 0 1px ${SET.warn}28`,
              }}
            >
              <SetIcon name="info" size={14} stroke={SET.warn} sw={2} />
              <div style={{ fontSize: 'var(--crm-text-sm)', color: SET.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
                {error}
              </div>
            </div>
          )}

        </div>
      </div>

      {confirmDisc && (
        <ConfirmModal
          icon="link"
          tone="warn"
          title={t('security.sso.disconnectConfirmTitle', {
            name: PROVIDERS.find(p => p.id === confirmDisc)?.name,
          })}
          desc={t('security.sso.disconnectConfirmDesc', {
            name: PROVIDERS.find(p => p.id === confirmDisc)?.name,
          })}
          danger={t('security.sso.disconnect')}
          onCancel={() => setConfirmDisc(null)}
          onConfirm={() => handleDisconnect(confirmDisc)}
        />
      )}
    </>
  )
}
