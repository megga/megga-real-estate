// MEGGA Marketplace — Property X "Post a property" cards.
// Source : Figma node 9643:27743 (Footer/V1) — composant "Cards Wrapper".
// Note : dans Figma, ces cards font partie du composant Footer (avant le
// container dark). En React on les garde dans PxPostProperty pour modularité.
//
// Structure fidèle :
//   <section px-24 flex items-center justify-between>
//     <Card x2 : bg-white, h-160, w-685, p-20, rounded-24, shadow small>
//       <Content w-360 h-90 flex-col gap-12 items-start justify-center>
//         <Title 24 Display/5/Medium tracking-0.72>
//         <Paragraph 16/1.5/-0.48 neutral500>
//       </Content>
//       <Primary Circle Button absolute top-20 right-20 : bg-neutral700, plus icon>
//     </Card>
//   </section>

import { Link } from 'react-router-dom'
import { PX, PxIcon } from '..'

interface PostCard {
  id: string
  title: string
  description: string
  href: string
}

const CARDS: PostCard[] = [
  {
    id: 'free',
    title: 'Publier une annonce gratuite',
    description: 'Mettez votre bien en ligne en quelques minutes. Idéal pour les particuliers qui souhaitent toucher la communauté MEGGA.',
    href: '/publier?type=free',
  },
  {
    id: 'paid',
    title: 'Publier une annonce premium',
    description: 'Visibilité accrue, mise en avant sur la page d\'accueil, photos pro et accompagnement par un agent dédié.',
    href: '/publier?type=premium',
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
        width: 685,
        height: 160,
        padding: 20,
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.small,
        textDecoration: 'none',
        flexShrink: 0,
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
      }}>
        {/* Title : 24 Display/5/Medium tracking-0.72 */}
        <h3 style={{
          margin: 0,
          width: '100%',
          fontFamily: PX.font.display,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
        }}>{c.title}</h3>
        {/* Paragraph : 16/1.5/-0.48 neutral500 */}
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

      {/* Primary Circle Button : absolute top 12.5% right 2.92% (h=160 → top 20, right 20)
          bg-neutral700, plus icon, size dérivée des proportions */}
      <span style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 40,
        height: 40,
        borderRadius: PX.radius.pill,
        background: PX.neutral700,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxIcon name="plus" size={16} color={PX.neutral100} />
      </span>
    </Link>
  )
}

export default function PxPostProperty() {
  return (
    <section style={{
      paddingTop: 0,
      paddingBottom: 24,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      <div style={{
        maxWidth: 1392,
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        {CARDS.map(c => <PostCard key={c.id} c={c} />)}
      </div>
    </section>
  )
}
