// Variant EN du PostProperty Cards — utilisé uniquement sur /about pour
// fidélité Figma maximale.
// Source : Figma node 9613:23660 (Footer/V1) — composant "Cards Wrapper"
// avant le container dark (anglais Property X template).
//
// Différences vs PxPostProperty :
// - Texte EN : "Post a free property" / "Post a paid property"
// - Paragraphes Lorem ipsum (identique Figma)

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
    title: 'Post a free property',
    description: 'Lorem ipsum dolor sit amet consectetur vitae aenean amet in eros neque nulla mattis sit.',
    href: '/publier?type=free',
  },
  {
    id: 'paid',
    title: 'Post a paid property',
    description: 'Lorem ipsum dolor sit amet consectetur vitae aenean amet in eros neque nulla mattis sit.',
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
      {/* Primary Circle Button : top 20, right 20, bg-neutral700, plus icon */}
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

export default function PxPostPropertyEN() {
  return (
    <section style={{
      paddingTop: 0,
      paddingBottom: 24,
      paddingLeft: 24,
      paddingRight: 24,
      background: 'transparent',
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
