// MEGGA Marketplace — Property X "Articles Section" / Blog teaser.
// Source : Figma node 9643:28571 — code Figma EXACT (texte EN, dimensions, position).
//
// Structure fidèle :
//   <section pt-80 pb-160 flex-col items-center>
//     <Top Content w-1200 pb-24 flex items-end justify-center>
//       <Wrapper flex-col items-center justify-center>
//         <Badge "Our blog" : bg-neutral300 + cercle bg-neutral400 (size 26)
//                + edit icon (14.857) + texte 16/Medium neutral700>
//         <Title pt-16 : H2 48 Display/8/Medium tracking-1.44 w-576 centered>
//       </Wrapper>
//     </Top Content>
//     <Cards Row flex gap-40 items-start>
//       <Blog Card x2 bg-white rounded-24 shadow small w-580>
//         <Image h-340>
//         <Content Wrapper pb-44 pt-24 px-32 flex items-center justify-between>
//           <Content flex-col gap-8>
//             <Title 24 Display/5/Medium tracking-0.72 w-382>
//             <Wrapper gap-12 items-center>
//               <CategoryBadge bg-neutral400 : icon (16) + texte 16/Medium white>
//               <Date : icon V49 calendar (22) + texte 16/Medium neutral400>
//             </Wrapper>
//           </Content>
//           <PrimaryCircleButton DARK 40 + chevron-right 16>
//         </Content Wrapper>
//       </Blog Card>
//     </Cards Row>
//     <Button Wrapper pt-48 pb-16>
//       <Link "Browse all articles" + chevron-right (16)>
//     </Button Wrapper>
//   </section>
//
// Assets :
// - Images Figma > 1MB → équivalents Unsplash (living-room cosy / chambre design)
// - Icônes Figma exportées dans /public/icons/figma/ :
//     badge-blog-resources.svg (Resources badge — bouclier/shield, viewBox 17.3×16)
//     badge-blog-news.svg      (News badge — mégaphone, viewBox 15.7×14.9)
//     blog-calendar.svg        (date — calendrier V49, viewBox 22×20.2)

import { Link } from 'react-router-dom'
import { PX, PxFigmaIcon } from '..'

interface BlogPost {
  id: string
  category: 'Resources' | 'News'
  categoryIcon: 'badge-blog-resources' | 'badge-blog-news'
  title: string
  date: string
  image: string
  href: string
}

const ARTICLES: BlogPost[] = [
  {
    id: 'a1',
    category: 'Resources',
    categoryIcon: 'badge-blog-resources',
    title: 'Here’s how decorate your new home from scratch',
    date: 'Mar 28, 2026',
    image: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1600&q=85',
    href: '/blog/decorate-new-home',
  },
  {
    id: 'a2',
    category: 'News',
    categoryIcon: 'badge-blog-news',
    title: 'Home buying basics: How many bedrooms and bathrooms?',
    date: 'Mar 28, 2026',
    image: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=1600&q=85',
    href: '/blog/bedrooms-bathrooms',
  },
]

// ─── Badge "Our blog" — LIGHT (bg-neutral300 + cercle bg-neutral400) ────
// Figma node 11756:32558 — radius pill, gap 6, padding 6/6/6/12
function BlogBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral300,
      borderRadius: PX.radius.pill,
    }}>
      {/* Icon container : bg-neutral400, rounded 46.6 (≈ pill), size 26 */}
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral400,
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-blog-edit" size={14.857} color={PX.neutral100} />
      </span>
      {/* Wrapper texte : pt-2 (xx-small) */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 2,
      }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral700,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>Our blog</span>
      </span>
    </span>
  )
}

// ─── Category badge interne carte — bg-neutral400 (gris) + icon + texte blanc ──
function CategoryBadge({
  icon,
  label,
}: {
  icon: 'badge-blog-resources' | 'badge-blog-news'
  label: string
}) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral400,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 16,
        height: 16,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name={icon} size={16} color={PX.neutral100} />
      </span>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 2,
      }}>
        <span style={{
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}>{label}</span>
      </span>
    </span>
  )
}

// ─── Blog Card V1 — w-580, bg white, rounded-24, shadow small ────────────
function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link
      to={post.href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: 580,
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.small,
        overflow: 'hidden',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      {/* Image : h-340, full width, cover */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 340,
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        <img
          src={post.image}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            pointerEvents: 'none',
            display: 'block',
          }}
        />
      </div>

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
        flexShrink: 0,
      }}>
        {/* Content : flex-col gap-8 items-start */}
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
          {/* Wrapper badge + date : flex gap-12 items-center justify-center */}
          <div style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <CategoryBadge icon={post.categoryIcon} label={post.category} />
            {/* Date : flex gap-4 items-center + icon (22) + texte (pt-4) */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 4,
            }}>
              <span style={{
                width: 22,
                height: 22,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <PxFigmaIcon name="blog-calendar" size={22} color={PX.neutral400} />
              </span>
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 4,
              }}>
                <span style={{
                  fontFamily: PX.font.display,
                  fontSize: 16,
                  fontWeight: 500,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  color: PX.neutral400,
                  whiteSpace: 'nowrap',
                }}>{post.date}</span>
              </span>
            </span>
          </div>
        </div>
        {/* Primary Circle Button DARK : 40px, bg neutral700, chevron-right 16 */}
        <span style={{
          width: 40,
          height: 40,
          borderRadius: PX.radius.pill,
          background: PX.neutral700,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral100} />
        </span>
      </div>
    </Link>
  )
}

export default function PxBlogTeaser() {
  return (
    <section
      data-node-id="9643:28571"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 80,
        paddingBottom: 160,
        background: PX.neutral100,
        width: '100%',
      }}
    >
      {/* Top Content : w-1200, flex items-end justify-center, pb-24 */}
      <div style={{
        width: 1200,
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        paddingBottom: 24,
        flexShrink: 0,
      }}>
        {/* Wrapper : flex-col items-center justify-center */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <BlogBadge />
          {/* Title : pt-16, H2 48 Display/8/Medium tracking-1.44 w-576 centered */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 16,
          }}>
            <h2 style={{
              margin: 0,
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
              Read our latest articles
            </h2>
          </div>
        </div>
      </div>

      {/* Cards Row : flex gap-40 items-start */}
      <div style={{
        display: 'flex',
        gap: 40,
        alignItems: 'flex-start',
        flexShrink: 0,
      }}>
        {ARTICLES.map(post => (
          <BlogCard key={post.id} post={post} />
        ))}
      </div>

      {/* Button Wrapper : pt-48 pb-16 flex items-center */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        paddingTop: 48,
        paddingBottom: 16,
        flexShrink: 0,
      }}>
        {/* Link : flex gap-6 items-center justify-center */}
        <Link
          to="/blog"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            textDecoration: 'none',
          }}
        >
          {/* Wrapper texte : pt-2 (xx-small) */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 2,
          }}>
            <span style={{
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              whiteSpace: 'nowrap',
            }}>Browse all articles</span>
          </span>
          <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral700} />
        </Link>
      </div>
    </section>
  )
}
