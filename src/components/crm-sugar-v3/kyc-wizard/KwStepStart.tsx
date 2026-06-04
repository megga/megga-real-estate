// MEGGA CRM Sugar v3 — Wizard Step 1 : Démarrer (3 portes)
// Port 1:1 de crm-kyc-wizard.jsx lignes 200-263 (KwStepStart).

import { useKycPalette } from '../kyc/kycPalette'
import { SgIcon } from '../icons'
import { KwGateCard } from './KwGateCard'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

export function KwStepStart({ data, set }: Props) {
  const sp = useKycPalette()
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 48, maxWidth: 720 }}>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 38,
            fontWeight: 700,
            color: sp.ink,
            letterSpacing: -0.8,
            lineHeight: 1.1,
          }}
        >
          Comment voulez-vous ouvrir ce dossier&nbsp;?
        </h1>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            color: sp.inkSoft,
            fontWeight: 500,
            lineHeight: 1.55,
          }}
        >
          Trois chemins pour respecter l'obligation LBA. Le plus rapide reste de
          lier le dossier à un contact déjà connu de votre CRM.
        </p>
      </div>

      <div
        className="sg-grid-gates"
        style={{
          display: 'grid',
          gridTemplateColumns: '1.15fr 1fr 1fr',
          gap: 22,
        }}
      >
        <KwGateCard
          recommended
          selected={data.source === 'existing'}
          icon={
            <SgIcon
              name="user"
              size={26}
              stroke={data.source === 'existing' ? sp.onAccent : sp.black}
            />
          }
          title="Lier à un contact existant"
          sub="Le plus courant : vous sélectionnez un acheteur, vendeur ou locataire déjà présent dans le CRM."
          onClick={() => set({ source: 'existing' })}
        />
        <KwGateCard
          selected={data.source === 'import'}
          icon={
            <SgIcon
              name="upload"
              size={26}
              stroke={data.source === 'import' ? sp.onAccent : sp.black}
            />
          }
          title="Importer un dossier externe (bientôt)"
          sub="L'import + parsing automatique (PDF Persona, ComplyAdvantage, rapport agence partenaire) arrive dans une prochaine release. Utilisez « Lier à un contact existant » en attendant."
          // Disabled — the wizard's `finish()` treats 'import' identically
          // to 'existing'; advertising AI-parsing without delivering it
          // breaks CLAUDE.md's "IA présentée comme automatique" rule.
          onClick={() => { /* intentionally disabled */ }}
        />
        <KwGateCard
          selected={data.source === 'magic'}
          icon={
            <SgIcon
              name="send"
              size={26}
              stroke={data.source === 'magic' ? sp.onAccent : sp.black}
            />
          }
          title="Demander les pièces"
          sub="Lien magique envoyé au contact pour qu'il dépose lui-même ses justificatifs en toute sécurité."
          onClick={() => set({ source: 'magic' })}
        />
      </div>
    </div>
  )
}
