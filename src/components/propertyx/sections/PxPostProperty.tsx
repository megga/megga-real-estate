// MEGGA Marketplace — Property X "Cards Wrapper / Post property".
// Source : Figma node 9643:27743 — sous-composant "Cards Wrapper" (I9643:27743;9548:20026).
// Le node 9643:27743 (Footer/V1) regroupe deux blocs :
//   1. Cards Wrapper (Post a free / paid property) → CE FICHIER
//   2. Container Footer (dark, links, copyright) → PxFooter.tsx
//
// Structure fidèle Figma :
//   <Cards Wrapper : flex items-center justify-between w-full>
//     <Card x2 : bg-neutral100, h-160, w-685, p-20, rounded-24, shadow soft>
//       <Content : w-360, h-90, flex-col gap-12 items-start justify-center>
//         <Title 24 Display/5/Medium tracking-0.72 neutral700>
//         <Paragraph 16/1.5/-0.48 neutral500>
//       </Content>
//       <Primary Circle Button : absolute inset-[12.5%_2.92%_62.5%_91.24%]
//                                bg-neutral700, rounded-pill, plus icon 16>
//     </Card>
//   </Cards Wrapper>

import { Link } from 'react-router-dom'
import { PX, PxFigmaIcon } from '..'

interface PostCard {
  id: string
  title: string
  description: string
  href: string
}

// Texte EXACT Figma (anglais), titres adaptés au routing MEGGA.
const CARDS: PostCard[] = [
  {
    id: 'free',
    title: 'Post a free property',
    description: 'Lorem ipsum dolor sit amet consectetur vitae aenean amet in eros neque nulla mattis sit.',
    href: '/publish?type=free',
  },
  {
    id: 'paid',
    title: 'Post a paid property',
    description: 'Lorem ipsum dolor sit amet consectetur vitae aenean amet in eros neque nulla mattis sit.',
    href: '/publish?type=premium',
  },
]

function PostCard({ c }: { c: PostCard }) {
  return (
    <Link
      to={c.href}
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        width: 685,
        height: 160,
        padding: 20,
        background: PX.neutral100,
        // Sections/PD Small : 24
        borderRadius: PX.sectionPadding.small,
        // Neutral/BS Small : 0 1 1 0 rgba(14,14,14,.04) + 0 4 4 0 rgba(211,211,211,.06)
        boxShadow: PX.shadow.small,
        textDecoration: 'none',
      }}
    >
      {/* Content : w-360, h-90, flex-col gap-12 items-start justify-center */}
      <div style={{
        width: 360,
        height: 90,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        alignItems: 'flex-start',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {/* Title : 24 Display/5/Medium tracking-0.72 neutral700, leading 1.25 */}
        <p style={{
          margin: 0,
          width: '100%',
          fontFamily: PX.font.display,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
        }}>{c.title}</p>
        {/* Paragraph : 16 Paragraph/Default/Regular leading 1.5 neutral500 ls -0.48 */}
        <p style={{
          margin: 0,
          width: '100%',
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>{c.description}</p>
      </div>

      {/* Primary Circle Button — Figma : absolute inset-[12.5% 2.92% 62.5% 91.24%]
          Calc : carte 685×160 → top 20, right 20, bottom 100, left 625
          → width = 685 - 625 - 20 = 40; height = 160 - 20 - 100 = 40
          bg-neutral700, rounded-pill, content = plus icon 16 centered */}
      <span style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: PX.radius.pill,
        background: PX.neutral700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="plus" size={16} color={PX.neutral100} />
      </span>
    </Link>
  )
}

export default function PxPostProperty() {
  // Wrapper page-level : padding horizontal 24 (correspond au pl/pr-24 du node Footer/V1)
  return (
    <section style={{
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Cards Wrapper : flex items-center justify-between w-full */}
      <div style={{
        width: '100%',
        maxWidth: 1392,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 22, // Calcul Figma : 1392 - 2×685 = 22
      }}>
        {CARDS.map(c => <PostCard key={c.id} c={c} />)}
      </div>
    </section>
  )
}
