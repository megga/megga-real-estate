// MEGGA CRM Sugar v3 — Wizard Step 3 : Vigilance
// Port 1:1 de crm-kyc-wizard.jsx lignes 404-467 (KwStepVigilance).
//
// 2 cartes : Standard (LBA art. 3-4) / Renforcée (LBA art. 6)
// + Card IA reco quand un contact est sélectionné.

import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KwGateCard } from './KwGateCard'
import { useContacts } from '@/hooks/useContacts'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

export function KwStepVigilance({ data, set }: Props) {
  const { contacts = [] } = useContacts()
  const contact = data.contactId
    ? contacts.find((c) => c.id === data.contactId)
    : null

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
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
          Étape 3 sur 3 · Vigilance
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
          Quel niveau de vigilance&nbsp;?
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
          La vigilance renforcée est requise pour les transactions supérieures
          à CHF 100'000, les contacts PEP et les opérations internationales.
        </p>
      </div>

      <div className="sg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <KwGateCard
          selected={data.vigilance === 'standard'}
          icon={
            <SgIcon
              name="shield"
              size={26}
              stroke={data.vigilance === 'standard' ? '#fff' : SugarV3.black}
            />
          }
          title="Vigilance standard"
          sub="Cinq contrôles classiques · LBA art. 3-4. Suffit pour la majorité des transactions résidentielles courantes."
          onClick={() => set({ vigilance: 'standard', riskLevel: 'low' })}
        />
        <KwGateCard
          recommended={data.smartReco === 'renforced'}
          selected={data.vigilance === 'renforced'}
          icon={
            <SgIcon
              name="shieldStar"
              size={26}
              stroke={data.vigilance === 'renforced' ? '#fff' : SugarV3.black}
            />
          }
          title="Vigilance renforcée"
          sub="Contrôles approfondis sur l'origine des fonds, bénéficiaires effectifs et arrière-plan économique · LBA art. 6."
          onClick={() => set({ vigilance: 'renforced', riskLevel: 'medium' })}
        />
      </div>

      {contact && (
        <div
          style={{
            marginTop: 32,
            padding: '20px 24px',
            background: SugarV3.card,
            borderRadius: 22,
            boxShadow: SugarV3.shadow,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
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
            <SgIcon name="sparkle" size={16} stroke={SugarV3.inkSoft} />
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                color: SugarV3.ink,
                fontWeight: 700,
                fontSize: 13.5,
                marginBottom: 2,
              }}
            >
              MEGGA AI recommande :{' '}
              <span style={{ color: SugarV3.black }}>
                vigilance {data.smartReco === 'renforced' ? 'renforcée' : 'standard'}
              </span>
            </div>
            <div
              style={{
                fontSize: 12,
                color: SugarV3.muted,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              {contact.first_name} {contact.last_name} ·{' '}
              {contact.type === 'buyer'
                ? 'acheteur'
                : contact.type === 'seller'
                  ? 'vendeur'
                  : 'locataire'}{' '}
              · profil{' '}
              {data.smartReco === 'renforced'
                ? 'avec indicateurs de risque détectés'
                : 'sans indicateur de risque détecté'}.
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
