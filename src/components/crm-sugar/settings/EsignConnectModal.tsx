// Modale de connexion du provider de signature (Skribble) — Phase 1 e-signature.
// Réutilise les atoms Sugar (Modal / SetInput / SetBlackBtn), aucun composant
// recréé. Appelle l'edge `sign-document` action connect_provider, qui valide la
// clé par un login live et la chiffre dans Supabase Vault.

import { useState } from 'react'
import { Modal, SetInput, SetBlackBtn, SetGhostBtn, SetIcon } from './atoms'
import { SET_PALETTE } from './data'
import { useEsignSignature, type SignatureQuality } from '@/hooks/useEsignSignature'

const SET = SET_PALETTE

const QUALITIES: { id: SignatureQuality; label: string; sub: string }[] = [
  { id: 'QES', label: 'QES', sub: "Qualifiée — même valeur qu'une signature manuscrite (ZertES/eIDAS)." },
  { id: 'AES', label: 'AES', sub: 'Avancée — identité du signataire vérifiée.' },
  { id: 'SES', label: 'SES', sub: 'Simple — accord rapide, sans identification forte.' },
]

interface Props {
  onClose: () => void
  /** Appelé après connexion réussie (le parent ferme + affiche un toast). */
  onConnected: (displayName: string) => void
}

export function EsignConnectModal({ onClose, onConnected }: Props) {
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
      setError(e instanceof Error ? e.message : 'Connexion impossible')
    }
  }

  return (
    <Modal title="Connecter Skribble" onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: SET.inkSoft, lineHeight: 1.55 }}>
          Signature électronique qualifiée suisse (QES/AES), conforme ZertES et eIDAS. Connectez le
          compte API de votre agence pour signer vos mandats et contrats en un clic.
        </p>

        <SetInput
          label="Identifiant API"
          value={username}
          onChange={setUsername}
          placeholder="api-user@votre-agence.ch"
          autoFocus
        />
        <SetInput
          label="Clé API"
          type="password"
          value={apiKey}
          onChange={setApiKey}
          placeholder="••••••••••••••••"
          hint="Skribble → Administration → Clés API."
        />

        <div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SET.muted,
              letterSpacing: 0.6,
              textTransform: 'uppercase',
              marginBottom: 8,
            }}
          >
            Niveau de signature par défaut
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
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
                    borderRadius: 14,
                    border: 0,
                    background: active ? SET.black : SET.cardSubtle,
                    color: active ? SET.blackInk : SET.inkSoft,
                    fontFamily: 'inherit',
                    fontSize: 13.5,
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
          <div style={{ marginTop: 6, fontSize: 12, color: SET.muted, lineHeight: 1.5 }}>
            {QUALITIES.find((q) => q.id === quality)?.sub}
          </div>
        </div>

        {/* Signal de confiance — la clé n'est jamais stockée en clair. */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 14,
            background: SET.cardSubtle,
          }}
        >
          <SetIcon name="shield" size={15} stroke={SET.ok} sw={2} />
          <span style={{ fontSize: 12.5, color: SET.inkSoft, fontWeight: 500, lineHeight: 1.5 }}>
            Votre clé est chiffrée (Supabase Vault), jamais exposée, et validée à la connexion.
          </span>
        </div>

        {error && (
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 13,
              color: SET.err,
              fontWeight: 600,
              lineHeight: 1.5,
            }}
          >
            <SetIcon name="alert" size={15} stroke={SET.err} sw={2} />
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
          <SetGhostBtn onClick={onClose}>Annuler</SetGhostBtn>
          <SetBlackBtn
            onClick={submit}
            disabled={!canSubmit}
            loading={isConnecting}
            icon={<SetIcon name="shield" size={14} stroke={SET.blackInk} sw={2.2} />}
          >
            Connecter Skribble
          </SetBlackBtn>
        </div>
      </div>
    </Modal>
  )
}
