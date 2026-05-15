// MEGGA Marketplace — Property X "Blog Post" page.
// Source : Figma node 16810:12482 (📑 Blog Post symbol, 1440×6112).
//
// Composition (top → bottom) :
//   1. PxNav (glass)
//   2. PxBlogPostHero — Badge + Date + H1 60 + author card + image 1200×490
//   3. PxBlogPostBody — article rich text (H1/H2/H3/H4/H5 + paragraphs + lists + image + quote)
//   4. PxBlogPostNewsletterCTA — bento dark + laptop + Subscribe form
//   5. PxBlogPostRelated — 3 blog cards
//   6. PxPostPropertyEN (réutilisé)
//   7. PxFooterPropertyX (réutilisé)

import { PX } from '@/components/propertyx/tokens'
import PxNav from '@/components/propertyx/sections/PxNav'
import PxBlogPostHero from '@/components/propertyx/sections/PxBlogPostHero'
import PxBlogPostBody from '@/components/propertyx/sections/PxBlogPostBody'
import PxBlogPostNewsletterCTA from '@/components/propertyx/sections/PxBlogPostNewsletterCTA'
import PxBlogPostRelated from '@/components/propertyx/sections/PxBlogPostRelated'
import PxPostPropertyEN from '@/components/propertyx/sections/PxPostPropertyEN'
import PxFooterPropertyX from '@/components/propertyx/sections/PxFooterPropertyX'

export default function PropertyXBlogPostPage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: PX.pageBg,
      fontFamily: PX.font.sans,
      color: PX.ink,
    }}>
      <PxNav glass />
      <PxBlogPostHero />
      <PxBlogPostBody />
      <PxBlogPostNewsletterCTA />
      <PxBlogPostRelated />
      <div>
        <PxPostPropertyEN />
        <PxFooterPropertyX />
      </div>
    </div>
  )
}
