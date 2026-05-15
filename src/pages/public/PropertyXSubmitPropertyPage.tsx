// MEGGA Marketplace — Property X "Submit Property" page.
// Source : Figma node 9552:21463 — frame "💌 Submit Property" (1440×3578.7).
//
// Composition fidèle Figma :
//   1. Header V1 (PxNav)
//   2. PxSubmitPropertyHero : hero dark rounded avec badge + title + paragraph
//   3. PxSubmitPropertyForm : 3 form cards qui overlap le hero (margin-top -205)
//   4. PxPostPropertyEN : 2 cards "Post a free property" + "Post a paid property"
//   5. PxFooterPropertyX : footer V1 dark
//
// Route : /publier-bien (lien depuis Footer V1 colonne Props "Post a free/paid")

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxSubmitPropertyHero from '@/components/propertyx/sections/PxSubmitPropertyHero'
import PxSubmitPropertyForm from '@/components/propertyx/sections/PxSubmitPropertyForm'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function PropertyXSubmitPropertyPage() {
  return (
    <div style={{
      minHeight: '100vh',
      // Figma : page bg = neutrals-200 (#FAFAFB), pas neutral100 (#FFFFFF).
      background: PX.neutral200,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      {/* bg='transparent' : la nav se fond dans le page bg #FAFAFB.
          Sinon par défaut PxNav force un fond blanc qui casse l'unification. */}
      <PxNav bg="transparent" />
      <PxSubmitPropertyHero />
      <PxSubmitPropertyForm />
      <PxPostPropertyEN />
      <PxFooterPropertyX />
    </div>
  )
}
