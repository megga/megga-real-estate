// MEGGA CRM Sugar v3 — Wizard Step 1 : Démarrer (3 portes)
// Port 1:1 de crm-kyc-wizard.jsx lignes 200-263 (KwStepStart).

import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KwGateCard } from './KwGateCard'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

export function KwStepStart({ data, set }: Props) {
  return (
    <div
      style={{
        maxWidth: 1100,
        margin: '0 auto',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 48, maxWidth: 720 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: SugarV3.muted,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 14,
          }}
        >
          Étape 1 sur 3 · Démarrer
        </div>
        <h1
          style={{
            margin: '0 0 14px',
            fontSize: 38,
            fontWeight: 700,
            color: SugarV3.ink,
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
            color: SugarV3.inkSoft,
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
              stroke={data.source === 'existing' ? '#fff' : SugarV3.black}
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
              stroke={data.source === 'import' ? '#fff' : SugarV3.black}
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
              stroke={data.source === 'magic' ? '#fff' : SugarV3.black}
            />
          }
          title="Demander les pièces"
          sub="Lien magique envoyé au contact pour qu'il dépose lui-même ses justificatifs en toute sécurité."
          onClick={() => set({ source: 'magic' })}
        />
      </div>

      <div
        style={{
          marginTop: 56,
          padding: '20px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          color: SugarV3.muted,
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: 999,
            background: SugarV3.cardSubtle,
            display: 'grid',
            placeItems: 'center',
            flexShrink: 0,
          }}
        >
          <SgIcon name="shield" size={16} stroke={SugarV3.inkSoft} />
        </div>
        <div>
          <div
            style={{
              color: SugarV3.ink,
              fontWeight: 600,
              marginBottom: 2,
            }}
          >
            Cinq contrôles obligatoires
          </div>
          Identité · domicile · PEP · sanctions · source des fonds (LBA art. 3-7).
        </div>
      </div>
    </div>
  )
}
