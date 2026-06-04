// MEGGA CRM Sugar v3 — Wizard Step 3 : Vigilance
//
// 2 cartes : Standard (LBA art. 3-4) / Renforcée (LBA art. 6).

import { useKycPalette } from '../kyc/kycPalette'
import { SgIcon } from '../icons'
import { KwGateCard } from './KwGateCard'
import type { WizardData } from './types'

interface Props {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
}

export function KwStepVigilance({ data, set }: Props) {
  const sp = useKycPalette()

  return (
    <div
      style={{
        maxWidth: 900,
        margin: '0 auto',
        animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both',
      }}
    >
      <div style={{ marginBottom: 36, maxWidth: 720 }}>
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
          Quel niveau de vigilance&nbsp;?
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
          La vigilance renforcée est requise pour les transactions supérieures
          à CHF 100'000, les contacts PEP et les opérations internationales.
        </p>
      </div>

      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: sp.muted,
            letterSpacing: 1,
            textTransform: 'uppercase',
            marginBottom: 12,
          }}
        >
          Type d&apos;entité LBA
        </div>
        <div
          role="radiogroup"
          aria-label="Type d'entité"
          style={{ display: 'inline-flex', gap: 8, background: sp.cardSubtle, padding: 6, borderRadius: 999 }}
        >
          {([
            { value: 'pp', label: 'Personne physique', icon: 'user' },
            { value: 'pm', label: 'Personne morale', icon: 'building' },
          ] as const).map((opt) => {
            const isSelected = data.entityType === opt.value
            return (
              <button
                key={opt.value}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => set({ entityType: opt.value })}
                style={{
                  border: 0,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  padding: '8px 18px',
                  borderRadius: 999,
                  fontSize: 13.5,
                  fontWeight: 600,
                  background: isSelected ? sp.black : 'transparent',
                  color: isSelected ? sp.onAccent : sp.inkSoft,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'all .2s ease',
                }}
              >
                <SgIcon
                  name={opt.icon}
                  size={14}
                  stroke={isSelected ? sp.onAccent : sp.inkSoft}
                />
                {opt.label}
              </button>
            )
          })}
        </div>
        {data.entityType === 'pm' && (
          <div
            style={{
              marginTop: 10,
              fontSize: 12,
              color: sp.muted,
              fontWeight: 500,
            }}
          >
            Les personnes morales déclenchent l&apos;identification des ayants
            droit économiques (LBA art. 4).
          </div>
        )}
      </div>

      <div className="sg-grid-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <KwGateCard
          selected={data.vigilance === 'standard'}
          icon={
            <SgIcon
              name="shield"
              size={26}
              stroke={data.vigilance === 'standard' ? sp.onAccent : sp.black}
            />
          }
          title="Vigilance standard"
          sub="Cinq contrôles classiques · LBA art. 3-4. Suffit pour la majorité des transactions résidentielles courantes."
          onClick={() => set({ vigilance: 'standard', riskLevel: 'low' })}
        />
        <KwGateCard
          selected={data.vigilance === 'renforced'}
          icon={
            <SgIcon
              name="shieldStar"
              size={26}
              stroke={data.vigilance === 'renforced' ? sp.onAccent : sp.black}
            />
          }
          title="Vigilance renforcée"
          sub="Contrôles approfondis sur l'origine des fonds, bénéficiaires effectifs et arrière-plan économique · LBA art. 6."
          onClick={() => set({ vigilance: 'renforced', riskLevel: 'medium' })}
        />
      </div>
    </div>
  )
}
