// MEGGA CRM Sugar v3 — Card Notes internes
// Port 1:1 de crm-screen-contact-detail-sugar.jsx lignes 614-622 (CdNotesCard).

import { SugarV3 } from '../tokens'
import { SgIcon } from '../icons'
import { KycGhostPill, KycSection } from '../primitives'

interface Props {
  notes: string | null
}

export function CdNotesCard({ notes }: Props) {
  return (
    <KycSection
      title="Notes internes"
      eyebrow="Privé · équipe MEGGA"
      action={
        <KycGhostPill
          size="sm"
          icon={<SgIcon name="pencil" size={13} stroke={SugarV3.inkSoft} />}
        >
          Modifier
        </KycGhostPill>
      }
    >
      <div
        style={{
          padding: '18px 20px',
          borderRadius: 16,
          background: SugarV3.cardSubtle,
          fontSize: 14,
          color: SugarV3.inkSoft,
          fontWeight: 500,
          lineHeight: 1.6,
          letterSpacing: -0.1,
        }}
      >
        {notes || 'Aucune note pour ce contact.'}
      </div>
    </KycSection>
  )
}
