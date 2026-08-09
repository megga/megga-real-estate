// Modale de connexion du provider de signature (Skribble) — Phase 1 e-signature.
// Réutilise les atoms Sugar (Modal / SetInput / SetBlackBtn), aucun composant
// recréé. Appelle l'edge `sign-document` action connect_provider, qui valide la
// clé par un login live et la chiffre dans Supabase Vault.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Modal, SetInput, SetBlackBtn, SetGhostBtn, SetIcon } from './atoms'
import { SET_PALETTE } from './data'
import { useEsignSignature, type SignatureQuality } from '@/hooks/useEsignSignature'

const SET = SET_PALETTE

// label = code de niveau (proper noun, non traduit) ; subKey = clé i18n du descriptif.
const QUALITIES: { id: SignatureQuality; label: string; subKey: string }[] = [
  { id: 'QES', label: 'QES', subKey: 'integrations.esign.qualities.QES' },
  { id: 'AES', label: 'AES', subKey: 'integrations.esign.qualities.AES' },
  { id: 'SES', label: 'SES', subKey: 'integrations.esign.qualities.SES' },
]

interface Props {
  onClose: () => void
  /** Appelé après connexion réussie (le parent ferme + affiche un toast). */
  onConnected: (displayName: string) => void
}

export function EsignConnectModal({ onClose, onConnected }: Props) {
  const { t } = useTranslation('settings')
  const { connect, isConnecting } = useEsignSignature()
  const [username, setUsername] = useState('')
  const [apiKey, setApiKey] = useState('')
  const [quality, setQuality] = useState<SignatureQuality>('QES')
  const [error, setError] = useState<string | null>(null)

  const canSubmit = username.trim().length > 0 && apiKey.trim().length > 0 && !isConnecting

  const submit = async () => {
    if (!canSubmit) return
    setError(null)
    try {
      await connect({
        provider: 'skribble',
        credentials: { username: username.trim(), api_key: apiKey.trim() },
        config: { hosting_region: 'com' },
        default_quality: quality,
        default_legislation: 'ZERTES',
      })
      onConnected(username.trim())
    } catch (e) {
      setError(e instanceof Error ? e.message : t('integrations.esign.connectFailed'))
    }
  }

  return (
    <Modal title={t('integrations.esign.title')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-4xl)' }}>
        <p style={{ margin: 0, fontSize: 'var(--crm-text-lg)', color: SET.inkSoft, lineHeight: 1.55 }}>
          {t('integrations.esign.intro')}
        </p>

        <SetInput
          label={t('integrations.esign.apiUser')}
          value={username}
          onChange={setUsername}
          placeholder="api-user@votre-agence.ch"
          autoFocus
        />
        <SetInput
          label={t('integrations.esign.apiKey')}
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder="••••••••••••••••"
          hint={t('integrations.esign.apiKeyHint')}
        />

        <div>
          <div
            style={{
              fontSize: 'var(--crm-text-sm)',
              fontWeight: 700,
              color: SET.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            {t('integrations.esign.defaultLevel')}
          </div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-md)' }}>
            {QUALITIES.map((q) => {
              const active = quality === q.id
              return (
                <button
                  key={q.id}
                  type="button"
                  onClick={() => setQuality(q.id)}
                  style={{
                    flex: 1,
                    height: 44,
                    borderRadius: 'var(--crm-radius-xl)',
                    border: 0,
                    background: active ? SET.black : SET.cardSubtle,
                    color: active ? SET.blackInk : SET.inkSoft,
                    fontFamily: 'inherit',
                    fontSize: 'var(--crm-text-lg)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    boxShadow: active ? 'none' : 'inset 0 0 0 1px rgba(15,23,42,0.04)',
                    transition: 'all .15s',
                  }}
                >
                  {q.label}
                </button>
              )
            })}
          </div>
          <div style={{ marginTop: 6, fontSize: 'var(--crm-text-md)', color: SET.muted, lineHeight: 1.5 }}>
            {t(QUALITIES.find((q) => q.id === quality)?.subKey ?? '')}
          </div>
        </div>

        {/* Signal de confiance — la clé n'est jamais stockée en clair. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--crm-space-lg)',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-xl)',
            background: SET.cardSubtle,
          }}
        >
          <SetIcon name="shield" size={15} stroke={SET.ok} sw={2} />
          <span style={{ fontSize: 'var(--crm-text-md)', color: SET.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
            {t('integrations.esign.trustNote')}
          </span>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 'var(--crm-space-md)',
              fontSize: 'var(--crm-text-lg)',
              color: SET.err,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            <SetIcon name="alert" size={15} stroke={SET.err} sw={2} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--crm-space-lg)', marginTop: 4 }}>
          <SetGhostBtn onClick={onClose}>{t('common:actions.cancel')}</SetGhostBtn>
          <SetBlackBtn
            onClick={submit}
            disabled={!canSubmit}
            loading={isConnecting}
            icon={<SetIcon name="shield" size={14} stroke={SET.blackInk} sw={2.2} />}
          >
            {t('integrations.esign.connectButton')}
          </SetBlackBtn>
        </div>
      </div>
    </Modal>
  )
}
