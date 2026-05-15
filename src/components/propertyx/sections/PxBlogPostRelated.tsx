// MEGGA Marketplace — Property X "Blog Post — Related posts" section.
// Source : Figma node 11800:17196 — code Figma EXACT.
//
// Anatomie :
// - Section py-120 centered, gap-40
// - Top Content 1200w : H2 "Related posts" 48 + Link "Browse all articles" + chevron
// - Grid 3 cards 382×531 gap-26 :
//   - Image 382×401 rounded-24 with badge overlay (top-left bg white pill + icon + label)
//   - Content gap-24 :
//     - Title 24 medium 1.25
//     - Flex row : Date with calendar icon (V49) + "Read more" link with chevron right

import { PX, PxFigmaIcon, PxIcon } from '..'

type BlogCategory = 'resources' | 'news' | 'articles'

interface BlogCardData {
  image: string
  badge: { kind: BlogCategory; label: string }
  title: string
  date: string
}

const POSTS: BlogCardData[] = [
  {
    image: '/images/sections/blog-post/related-1.jpg',
    badge: { kind: 'resources', label: 'Resources' },
    title: 'Here’s how decorate your new home from scratch',
    date: 'Mar 30, 2026',
  },
  {
    image: '/images/sections/blog-post/related-2.jpg',
    badge: { kind: 'news', label: 'News' },
    title: 'Home buying basics: How many bedrooms and bathrooms?',
    date: 'Mar 28, 2026',
  },
  {
    image: '/images/sections/blog-post/related-3.jpg',
    badge: { kind: 'articles', label: 'Articles' },
    title: 'First-time homebuyer’s guide: Steps for beginners',
    date: 'Mar 26, 2026',
  },
]

function CategoryBadge({ kind, label }: { kind: BlogCategory; label: string }) {
  const iconName = kind === 'resources' ? 'blog-resource' : kind === 'news' ? 'blog-news' : 'blog-article'
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral100,
      borderRadius: PX.radius.pill,
      color: PX.neutral700,
    }}>
      <PxFigmaIcon name={iconName} size={16} color={PX.neutral700} />
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        paddingTop: 2,
      }}>
        {label}
      </span>
    </span>
  )
}

function BlogCard({ data }: { data: BlogCardData }) {
  return (
    <div style={{
      width: '100%',
      minWidth: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    }}>
      {/* Image with badge overlay */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 401,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
      }}>
        <img
          src={data.image}
          alt={data.title}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute',
          top: 21,
          left: 20,
        }}>
          <CategoryBadge kind={data.badge.kind} label={data.badge.label} />
        </div>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, alignItems: 'flex-start', width: '100%' }}>
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
        }}>
          {data.title}
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          height: 22,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <PxFigmaIcon name="blog-calendar" size={22} color={PX.neutral400} />
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
              paddingTop: 4,
              whiteSpace: 'nowrap',
            }}>
              {data.date}
            </span>
          </div>
          <a href="#" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            textDecoration: 'none',
          }}>
            <span style={{
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              paddingTop: 2,
            }}>
              Read more
            </span>
            <PxIcon name="chevron-right" size={16} color={PX.neutral700} />
          </a>
        </div>
      </div>
    </div>
  )
}

export default function PxBlogPostRelated() {
  return (
    <section style={{
      paddingTop: 120,
      paddingBottom: 120,
      paddingLeft: 24,
      paddingRight: 24,
      minHeight: 897,  // Figma exact (Articles section height)
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 40,
      background: PX.pageBg,
      boxSizing: 'border-box',
    }}>
      {/* Top Content */}
      <div style={{
        width: 1200,
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 24,
      }}>
        <h2 style={{
          margin: 0,
          paddingTop: 16,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 48,
          lineHeight: 1.25,
          letterSpacing: '-1.44px',
          color: PX.neutral700,
        }}>
          Related posts
        </h2>
        <a href="#" style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          paddingBottom: 16,
          textDecoration: 'none',
        }}>
          <span style={{
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
            paddingTop: 2,
          }}>
            Browse all articles
          </span>
          <PxIcon name="chevron-right" size={16} color={PX.neutral700} />
        </a>
      </div>

      {/* Grid 3 cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: 26,
        width: 1200,
        maxWidth: '100%',
      }}>
        {POSTS.map((p) => (
          <BlogCard key={p.title} data={p} />
        ))}
      </div>
    </section>
  )
}
