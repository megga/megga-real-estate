// MEGGA CRM Sugar v3 — Wizard Step Success
// Port 1:1 de crm-kyc-wizard.jsx lignes 470-507 (KwStepSuccess).

import { SgIcon } from '../icons'
import { KycBlackPill, KycGhostPill } from '../kyc/kycPrimitives'
import { useKycPalette } from '../kyc/kycPalette'
import { useContacts } from '@/hooks/useContacts'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  onOpen: () => void
  onClose: () => void
}

export function KwStepSuccess({ data, onOpen, onClose }: Props) {
  const sp = useKycPalette()
  const { contacts = [] } = useContacts()
  const c = data.contactId ? contacts.find((x) => x.id === data.contactId) : null

  return (
    <div
      style={{
        maxWidth: 720,
        margin: '60px auto 0',
        textAlign: 'center',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div
        style={{
          width: 88,
          height: 88,
          borderRadius: 999,
          background: '#10B981',
          display: 'grid',
          placeItems: 'center',
          margin: '0 auto 28px',
          boxShadow: '0 16px 40px rgba(16,185,129,0.30)',
        }}
      >
        <SgIcon name="check" size={36} stroke="#fff" sw={2.2} />
      </div>
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: sp.muted,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          marginBottom: 12,
        }}
      >
        Dossier ouvert
      </div>
      <h1
        style={{
          margin: '0 0 14px',
          fontSize: 36,
          fontWeight: 700,
          color: sp.ink,
          letterSpacing: -0.7,
          lineHeight: 1.1,
        }}
      >
        {c ? `${c.first_name} ${c.last_name}` : 'Dossier KYC'}
      </h1>
      <p
        style={{
          margin: '0 0 36px',
          fontSize: 15,
          color: sp.inkSoft,
          fontWeight: 500,
          lineHeight: 1.55,
          maxWidth: 520,
          marginLeft: 'auto',
          marginRight: 'auto',
        }}
      >
        Cinq contrôles sont en attente. Démarrez par téléverser les pièces
        d'identité ou envoyez la demande de pièces au contact.
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
        <KycGhostPill onClick={onClose} size="md">
          Fermer
        </KycGhostPill>
        <KycBlackPill
          onClick={onOpen}
          size="lg"
          icon={<SgIcon name="arrowR" size={16} stroke={sp.onAccent} />}
        >
          Ouvrir le dossier
        </KycBlackPill>
      </div>
    </div>
  )
}
