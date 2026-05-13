// MEGGA Marketplace — Property X "Articles Section" / Blog teaser.
// Source : Figma node 9643:28571 — code Figma exact.
//
// Structure fidèle :
//   <section pt-80 pb-160 flex-col items-center>
//     <Top Content w-1200 pb-24 flex items-end justify-center>
//       <Badge LIGHT "Our blog">
//       <H2 48 Display/8 w-576 centered>
//     </Top Content>
//     <Cards Row flex gap-40>
//       <Blog Card (x2) bg-white rounded-24 shadow small w-580>
//         <Image h-340>
//         <Content Wrapper pb-44 pt-24 px-32 flex items-center justify-between>
//           <Content flex-col gap-8>
//             <Title 24 Display/5/Medium w-382>
//             <Wrapper gap-12 items-center>
//               <Badge gray "Resources" / "News" : bg-neutral400 + icon + text>
//               <Date : icon V49 calendar 22 + text 16/Medium neutral400>
//             </Wrapper>
//           </Content>
//           <Circle Button DARK chevron-right 16>
//         </Content Wrapper>
//       </Blog Card>
//     </Cards Row>
//     <Button Wrapper pt-48 pb-16>
//       <Link "Browse all articles" + chevron-right>
//     </Button Wrapper>
//   </section>

import { Link } from 'react-router-dom'
import { PX, PxIcon, PxFigmaIcon } from '..'

interface BlogPost {
  id: string
  category: 'Ressources' | 'Actualités'
  categoryIcon: 'edit' | 'bell'
  title: string
  date: string
  image: string
  href: string
}

const ARTICLES: BlogPost[] = [
  {
    id: 'a1',
    category: 'Ressources',
    categoryIcon: 'edit',
    title: 'Comment décorer votre nouveau chez-vous de A à Z',
    date: '28 mars 2026',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&q=85',
    href: '/blog/decorer-nouveau-chez-vous',
  },
  {
    id: 'a2',
    category: 'Actualités',
    categoryIcon: 'bell',
    title: 'Premier achat : combien de chambres et salles de bain pour votre famille ?',
    date: '28 mars 2026',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1600&q=85',
    href: '/blog/combien-de-chambres',
  },
]

// Badge "Our blog" — LIGHT (bg-neutral300 + cercle bg-neutral400)
function BlogBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral300,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral400,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-blog-edit" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
      }}>Notre blog</span>
    </span>
  )
}

// Badge catégorie de l'article — bg-neutral400 (LIGHT GRAY) avec icon + texte
function CategoryBadge({ icon, label }: { icon: 'edit' | 'bell'; label: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral400,
      borderRadius: PX.radius.pill,
    }}>
      <PxIcon name={icon} size={16} color={PX.neutral100} />
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral100,
      }}>{label}</span>
    </span>
  )
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={post.href}
      style={{
        textDecoration: 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: 580,
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.small,
        overflow: 'hidden',
      }}
    >
      {/* Image h-340 */}
      <div style={{
        width: '100%',
        height: 340,
        backgroundImage: `url("${post.image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }} />

      {/* Content Wrapper : flex items-center justify-between, pb-44 pt-24 px-32 */}
      <div style={{
        width: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingTop: 24,
        paddingBottom: 44,
        paddingLeft: 32,
        paddingRight: 32,
      }}>
        {/* Content : flex-col gap-8 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-start',
        }}>
          {/* Title : 24 Display/5/Medium tracking-0.72 w-382 */}
          <h3 style={{
            margin: 0,
            width: 382,
            fontFamily: PX.font.display,
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
          }}>{post.title}</h3>
          {/* Wrapper badge + date : flex gap-12 items-center */}
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
          }}>
            <CategoryBadge icon={post.categoryIcon} label={post.category} />
            {/* Date : flex gap-4 + icon V49 calendar 22 + text 16/Medium neutral400 */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
            }}>
              <PxIcon name="calendar" size={22} color={PX.neutral400} />
              <span style={{
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral400,
              }}>{post.date}</span>
            </span>
          </div>
        </div>
        {/* Circle Button DARK chevron-right 16 */}
        <span style={{
          width: 40,
          height: 40,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}>
          <PxIcon name="chevron-right" size={16} color={PX.neutral100} />
        </span>
      </div>
    </Link>
  )
}

export default function PxBlogTeaser() {
  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 160,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.neutral100,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
    }}>
      {/* Top Content : w-1200, flex items-end justify-center, pb-24 */}
      <div style={{
        width: 1200,
        maxWidth: '100%',
        paddingBottom: 24,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <BlogBadge />
          {/* H2 : pt-16, 48 Display/8/Medium tracking-1.44, w-576 centered */}
          <h2 style={{
            margin: 0,
            paddingTop: 16,
            width: 576,
            maxWidth: '100%',
            fontFamily: PX.font.display,
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
            textAlign: 'center',
          }}>
            Lisez nos derniers articles
          </h2>
        </div>
      </div>

      {/* Cards Row : flex gap-40 items-start */}
      <div style={{
        display: 'flex',
        gap: 40,
        alignItems: 'flex-start',
      }}>
        {ARTICLES.map(post => <BlogCard key={post.id} post={post} />)}
      </div>

      {/* Button Wrapper : pt-48 pb-16, Link "Browse all articles" */}
      <div style={{
        paddingTop: 48,
        paddingBottom: 16,
      }}>
        <Link
          to="/blog"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
          }}
        >
          Voir tous les articles
          <PxIcon name="chevron-right" size={16} color={PX.neutral700} />
        </Link>
      </div>
    </section>
  )
}
