// MEGGA Contacts V3 — dispatcher fiche détail par audience.
// Port 1:1 de `refonte-contacts-detail-audience.jsx` (RcAudienceDetail).
// "À surveiller" cumule un bandeau-raison + le hero type.

import { useEffect, useState } from 'react'
import {
  RcHeroBuyer,
  RcHeroSeller,
  RcHeroTenant,
  RcHeroWatch,
} from './RcHero'
import {
  RcContactSections,
  type SectionTab,
} from './RcContactSections'
import type { RcPalette } from './palette'
import type { RcAudience, RcContactPatch } from './helpers'
import type { RcContact } from './helpers'

interface RcAudienceDetailProps {
  contact: RcContact
  audience: RcAudience
  onUpdate?: (
    patch: RcContactPatch,
  ) => void
  onNavigate?: (id: string) => void
  onOpenRdv?: () => void
  sp: RcPalette
}

export function RcAudienceDetail({
  contact,
  audience,
  onUpdate,
  onNavigate,
  onOpenRdv,
  sp,
}: RcAudienceDetailProps) {
  // L'onglet est lifté ici pour permettre aux CTA hero
  // (ex. "Revoir les critères" sur Watch) de switcher la sous-nav interne.
  const defaultTab: SectionTab =
    contact.type === 'seller' ? 'mandates' : 'criteria'
  const [tab, setTab] = useState<SectionTab>(defaultTab)
  useEffect(() => {
    setTab(defaultTab)
  }, [contact.id, contact.type, defaultTab])

  const nav = {
    onNavigate,
    onOpenRdv,
    setTab: (id: string) => setTab(id as SectionTab),
  }

  const typeHero =
    contact.type === 'seller' ? (
      <RcHeroSeller contact={contact} onUpdate={onUpdate} sp={sp} {...nav} />
    ) : contact.type === 'tenant' ? (
      <RcHeroTenant contact={contact} onUpdate={onUpdate} sp={sp} {...nav} />
    ) : (
      <RcHeroBuyer contact={contact} onUpdate={onUpdate} sp={sp} {...nav} />
    )

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      {audience === 'watch' && (
        <RcHeroWatch
          contact={contact}
          onUpdate={onUpdate}
          sp={sp}
          {...nav}
        />
      )}
      {typeHero}
      <RcContactSections
        contact={contact}
        onUpdate={onUpdate}
        tab={tab}
        onTab={setTab}
        sp={sp}
      />
    </div>
  )
}
