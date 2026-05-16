// MEGGA Pro — landing B2B « Pour les pros ».
// Page majeure : conversion agents/agences vers le CRM MEGGA.
// Architecture 100% Property X — tokens PX.*, atoms Px*, sections Px*Pro*.
//
// Ordre des sections (alignement marketing conversion) :
//   1. TopNotificationBar (beta annoncée)
//   2. Nav glass (réutilisé)
//   3. Hero dark + mockup Action Board (waouh #1)
//   4. Promises (3 chiffres ROI)
//   5. Features (6 cartes — capacités produit)
//   6. How it works (3 étapes accordion + mockups live — waouh #2)
//   7. Pricing (3 plans, Pro mis en avant)
//   8. Testimonial Gregory + 10 agences pilotes (waouh #3)
//   9. FAQ (objections handling)
//  10. Final CTA bento dark (waouh #4)
//  11. Footer PropertyX (réutilisé)

import { PX } from '@/components/propertyx/tokens'
import PxTopNotificationBar from '@/components/propertyx/sections/PxTopNotificationBar'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'
import { usePageMeta } from '@/hooks/usePageMeta'

import PxProHero from '@/components/propertyx/sections/pro/PxProHero'
import PxProPromises from '@/components/propertyx/sections/pro/PxProPromises'
import PxProTrustLogos from '@/components/propertyx/sections/pro/PxProTrustLogos'
import PxProFeatures from '@/components/propertyx/sections/pro/PxProFeatures'
import PxProHowItWorks from '@/components/propertyx/sections/pro/PxProHowItWorks'
import PxProPricing from '@/components/propertyx/sections/pro/PxProPricing'
import PxProTestimonial from '@/components/propertyx/sections/pro/PxProTestimonial'
import PxProFAQ from '@/components/propertyx/sections/pro/PxProFAQ'
import PxProFinalCTA from '@/components/propertyx/sections/pro/PxProFinalCTA'

export default function ServicesPage() {
  usePageMeta({
    title: 'MEGGA Pro — Le CRM immobilier suisse, pensé par un agent',
    description:
      'CRM compliance-first pour agences immobilières suisses : pipeline 14 colonnes, KYC dilisense intégré, copilote Claude Sonnet 4, portail vendeur. 10 agences pilotes. Essai gratuit.',
  })

  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxTopNotificationBar
        variant="button"
        message="MEGGA est gratuit. Créez votre compte, le CRM est ouvert."
        buttonText="Commencer"
        buttonHref="/register"
        dismissKey="pro-open"
      />
      <PxNav glass />
      <PxProHero />
      <PxProPromises />
      <PxProTrustLogos />
      <PxProFeatures />
      <PxProHowItWorks />
      <PxProPricing />
      <PxProTestimonial />
      <PxProFAQ />
      <PxProFinalCTA />
      <PxFooterPropertyX />
    </div>
  )
}
