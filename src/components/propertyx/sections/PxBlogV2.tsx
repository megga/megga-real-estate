// MEGGA Marketplace — Property X "Blog V2" section.
// Source : Figma node 9552:21472 — code Figma EXACT (texte, dimensions).
//
// Structure :
//   <section bg-neutral200 isolate>
//     <Header absolute top-0 z-4 (white logo/nav + inverse CTA — variant DARK page)>
//     <Hero Section : 1440x1018, container w-1394 bg-neutral700 rounded-24>
//       <Title "News & articles" 72/1.15/-2.16 white>
//       <Paragraph 16/1.5/-0.48 neutral400 w-562 centered>
//       <Cards Wrapper : 2 featured cards w-588 each gap-24>
//         (Badge + Date) / Image 588x340 rounded-24 / Title 30 + Paragraph
//     </Hero Section>
//     <Articles Section : py-120 w-1200 container, flex justify-between>
//       <Sidebar Wrapper 332 : Title "Latest posts" 48 + paragraph
//                              + Sidebar card 332 (search input + Categories list)
//       <Articles Wrapper 788 : 6 Blog Card V3 + Buttons Row (pagination)
//     </Articles Section>
//   </section>

import { Link } from 'react-router-dom'
import { PX, PxIcon, PxFigmaIcon } from '..'

// ─── MEGGA Logo (white pour fond dark) ────────────────────────────────
function MeggaLogoLight() {
  return (
    <img
      src="/megga-logo.svg"
      alt="MEGGA"
      style={{
        height: 22,
        width: 'auto',
        display: 'block',
        // brightness(0) → black, invert → white
        filter: 'brightness(0) invert(1)',
      }}
    />
  )
}

// ─── Primary Button "Light sur fond dark" — bg white, texte dark, circle dark, arrow white
function PrimaryButtonLight({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 16,
        paddingRight: 6,
        paddingTop: 6,
        paddingBottom: 6,
        background: PX.neutral100,
        borderRadius: PX.radius.pill,
        textDecoration: 'none',
        whiteSpace: 'nowrap',
      }}
    >
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        paddingTop: 2,
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        whiteSpace: 'nowrap',
      }}>{label}</span>
      <span style={{
        width: 28,
        height: 28,
        borderRadius: PX.radius.pill,
        background: PX.neutral700,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxIcon name="arrow-right" size={12} color={PX.neutral100} />
      </span>
    </Link>
  )
}

// Vrais liens MEGGA — alignés avec HomeStickyHeader.
const NAV_LINKS = [
  { label: 'Acheter', to: '/acheter' },
  { label: 'Louer', to: '/louer' },
  { label: 'Estimer', to: '/estimations' },
  { label: 'Services', to: '/services' },
  { label: 'Pour les pros', to: '/agences' },
] as const

// ─── Header (variant LIGHT pour fond dark : logo/nav blancs, CTA inverse) ─
function BlogHeader() {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: '50%',
      transform: 'translateX(-50%)',
      width: 1440,
      maxWidth: '100%',
      paddingTop: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      zIndex: 4,
    }}>
      <div style={{
        width: '100%',
        paddingTop: 24,
        paddingBottom: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 1200,
          maxWidth: '100%',
          paddingLeft: 24,
          paddingRight: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          {/* Left content : logo MEGGA blanc + nav FR blanche */}
          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <Link to="/" style={{ display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}>
              <MeggaLogoLight />
            </Link>
            <nav style={{ display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'center' }}>
              {NAV_LINKS.map(link => (
                <Link
                  key={link.to + link.label}
                  to={link.to}
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
                    color: PX.neutral300,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* CTA droite : "Compte" inverse — bg blanc / texte dark / cercle dark / arrow blanc */}
          <PrimaryButtonLight to="/login" label="Compte" />
        </div>
      </div>
    </div>
  )
}

// ─── Featured Card (Hero) ─────────────────────────────────────────────
interface FeaturedCard {
  badge: string
  date: string
  image: string
  title: string
  body: string
  href: string
}

function FeaturedCard({ card }: { card: FeaturedCard }) {
  return (
    <Link
      to={card.href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        alignItems: 'flex-start',
        textDecoration: 'none',
        flexShrink: 0,
      }}
    >
      {/* Details Wrapper : Badge + Date */}
      <div style={{
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Badge — bg neutral400, white text */}
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
          <PxFigmaIcon
            name={card.badge === 'News' ? 'badge-blog-news' : 'badge-blog-resources'}
            size={16}
            color={PX.neutral100}
          />
          <span style={{
            paddingTop: 2,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
            whiteSpace: 'nowrap',
          }}>{card.badge}</span>
        </span>

        {/* Date — calendar icon + date text */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 4,
        }}>
          <PxFigmaIcon name="blog-calendar" size={22} color={PX.neutral100} />
          <span style={{
            paddingTop: 4,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
            whiteSpace: 'nowrap',
          }}>{card.date}</span>
        </span>
      </div>

      {/* Wrapper : Image + bottom content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        alignItems: 'flex-start',
      }}>
        {/* Image 588x340 rounded-24 */}
        <div style={{
          width: 588,
          maxWidth: '100%',
          height: 340,
          overflow: 'hidden',
          borderRadius: PX.radius.large,
          flexShrink: 0,
        }}>
          <img
            src={card.image}
            alt=""
            aria-hidden="true"
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        </div>

        {/* Bottom content */}
        <div style={{
          width: 588,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          {/* Title — Display/6 30/1.25/-0.9 white */}
          <p style={{
            margin: 0,
            width: 540,
            maxWidth: '100%',
            fontFamily: PX.font.display,
            fontSize: 30,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.9px',
            color: PX.neutral100,
          }}>{card.title}</p>

          {/* Paragraph — 16/1.5/-0.48 neutral400 */}
          <div style={{ paddingTop: 16 }}>
            <p style={{
              margin: 0,
              width: 480,
              maxWidth: '100%',
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
            }}>{card.body}</p>
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── Hero Section (Figma node 11797:17416) ────────────────────────────
// Container w-1394, h-994, bg neutral700, rounded-24, py-120, items-center.
const FEATURED_CARDS: FeaturedCard[] = [
  {
    badge: 'Resources',
    date: 'Mar 30, 2026',
    image: '/images/sections/blog/hero-featured-1.jpg',
    title: "Here's how decorate your new home from scratch",
    body: 'Lorem ipsum dolor sit amet consectetur. Volutpat et lacinia sit aenean consequat. Id tellus eget libero eget non odio tristique.',
    href: '/blog/decorate-new-home',
  },
  {
    badge: 'News',
    date: 'Mar 28, 2026',
    image: '/images/sections/blog/hero-featured-2.jpg',
    title: 'Home buying basics: How many bedrooms and bathrooms?',
    body: 'Lorem ipsum dolor sit amet consectetur. Volutpat et lacinia sit aenean consequat. Id tellus eget libero eget non odio tristique.',
    href: '/blog/home-buying-basics',
  },
]

function HeroSection() {
  return (
    <div style={{
      width: '100%',
      padding: 24,
      display: 'flex',
      justifyContent: 'center',
      zIndex: 3,
      position: 'relative',
    }}>
      <div style={{
        width: 1394,
        maxWidth: '100%',
        height: 994,
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        paddingTop: 120,
        paddingBottom: 120,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Title — Display/10 72/1.10/-2.16 white */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 72,
            fontWeight: 500,
            lineHeight: 1.10,
            letterSpacing: '-2.16px',
            color: PX.neutral100,
            whiteSpace: 'nowrap',
          }}>News &amp; articles</h1>
        </div>

        {/* Paragraph — 16/1.5/-0.48 neutral400 w-562 centered, pt-16 pb-48 */}
        <div style={{
          paddingTop: 16,
          paddingBottom: 48,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          <p style={{
            margin: 0,
            width: 562,
            maxWidth: '100%',
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral400,
            textAlign: 'center',
          }}>
            Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
          </p>
        </div>

        {/* Cards Wrapper — 2 featured cards gap-24 */}
        <div style={{
          display: 'flex',
          gap: 24,
          alignItems: 'center',
          justifyContent: 'center',
          width: '100%',
        }}>
          {FEATURED_CARDS.map(c => (
            <FeaturedCard key={c.href} card={c} />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Categories badges ────────────────────────────────────────────────
interface CategoryBadge {
  label: string
  iconName: 'badge-blog-resources' | 'badge-blog-news' | 'badge-blog-articles' | 'badge-blog-all'
  active?: boolean
}

const CATEGORIES: CategoryBadge[] = [
  { label: 'All', iconName: 'badge-blog-all', active: true },
  { label: 'Resources', iconName: 'badge-blog-resources' },
  { label: 'News', iconName: 'badge-blog-news' },
  { label: 'Articles', iconName: 'badge-blog-articles' },
]

function CategoryBadgeRow({ cat }: { cat: CategoryBadge }) {
  const isActive = cat.active === true
  return (
    <button
      type="button"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        background: isActive ? PX.neutral700 : PX.neutral100,
        borderRadius: PX.radius.pill,
        width: '100%',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <PxFigmaIcon
        name={cat.iconName}
        size={16}
        color={isActive ? PX.neutral100 : PX.neutral400}
      />
      <span style={{
        paddingTop: 2,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: isActive ? PX.neutral100 : PX.neutral400,
        whiteSpace: 'nowrap',
      }}>{cat.label}</span>
    </button>
  )
}

// ─── Sidebar (332 wide) ───────────────────────────────────────────────
function Sidebar() {
  return (
    <div style={{
      width: 332,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      flexShrink: 0,
    }}>
      {/* Top Content : Title + paragraph */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
      }}>
        {/* Title "Latest posts" — Display/8 48/1.25/-1.44 neutral700 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
            whiteSpace: 'nowrap',
          }}>Latest posts</h2>
        </div>

        {/* Paragraph — 16/1.5/-0.48 neutral500, w-332 (Figma frame), pt-16 pb-24 */}
        <div style={{
          paddingTop: 16,
          paddingBottom: 24,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
          width: '100%',
        }}>
          <p style={{
            margin: 0,
            width: 332,
            maxWidth: '100%',
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
          }}>
            Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue.
          </p>
        </div>
      </div>

      {/* Sidebar card 332 — bg white, p-24, gap-24, rounded-24, shadow small */}
      <div style={{
        width: 332,
        padding: 24,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        alignItems: 'flex-start',
        background: PX.neutral100,
        borderRadius: PX.radius.large,
        boxShadow: PX.shadow.small,
      }}>
        {/* Search input — pill bg neutral200, min-h-52, pl-16 pr-6 py-6, w-full */}
        <div style={{
          width: '100%',
          minHeight: 52,
          paddingLeft: 16,
          paddingRight: 6,
          paddingTop: 6,
          paddingBottom: 6,
          background: PX.neutral200,
          borderRadius: PX.radius.pill,
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <input
            type="search"
            placeholder="Search for articles..."
            aria-label="Search for articles"
            style={{
              flex: 1,
              minWidth: 0,
              border: 'none',
              outline: 'none',
              background: 'transparent',
              paddingTop: 2,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
            }}
          />
          {/* Search circle button — 40x40, bg neutral700 */}
          <span
            aria-hidden="true"
            style={{
              width: 40,
              height: 40,
              borderRadius: PX.radius.pill,
              background: PX.neutral700,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
            }}
          >
            <PxFigmaIcon name="search" size={22} color={PX.neutral100} />
          </span>
        </div>

        {/* Categories wrapper */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
          alignItems: 'flex-start',
          width: '100%',
        }}>
          {/* Label "Categories" — Display/3 20/1.25/-0.6 neutral700 */}
          <p style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 20,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            color: PX.neutral700,
            whiteSpace: 'nowrap',
          }}>Categories</p>

          {/* Badges list */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            alignItems: 'flex-start',
            width: '100%',
          }}>
            {CATEGORIES.map(c => (
              <CategoryBadgeRow key={c.label} cat={c} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Blog Card V3 (788x284 — image left 382x284 + content right) ─────
interface BlogPost {
  badge: 'Resources' | 'News' | 'Articles'
  date: string
  image: string
  title: string
  body: string
  href: string
}

const BLOG_POSTS: BlogPost[] = [
  {
    badge: 'Resources',
    date: 'Mar 30, 2026',
    image: '/images/sections/blog/article-1.jpg',
    title: "Here's how decorate your new home from scratch",
    body: 'Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis.',
    href: '/blog/decorate-new-home',
  },
  {
    badge: 'News',
    date: 'Mar 28, 2026',
    image: '/images/sections/blog/article-2.jpg',
    title: 'Home buying basics: How many bedrooms and bathrooms?',
    body: 'Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis.',
    href: '/blog/home-buying-basics',
  },
  {
    badge: 'Articles',
    date: 'Mar 26, 2026',
    image: '/images/sections/blog/article-3.jpg',
    title: "First-time homebuyer's guide: Steps for beginners",
    body: 'Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis.',
    href: '/blog/first-time-homebuyer-guide',
  },
  {
    badge: 'News',
    date: 'Mar 24, 2026',
    image: '/images/sections/blog/article-4.jpg',
    title: 'How to negotiate a house price effectively: 101 guide',
    body: 'Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis.',
    href: '/blog/negotiate-house-price',
  },
  {
    badge: 'Articles',
    date: 'Mar 22, 2026',
    image: '/images/sections/blog/article-5.jpg',
    title: 'Ikea announces new furniture for modular homes',
    body: 'Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis.',
    href: '/blog/ikea-modular-homes',
  },
  {
    badge: 'Resources',
    date: 'Mar 20, 2026',
    image: '/images/sections/blog/article-6.jpg',
    title: 'The best art styles to decorate a space in your home',
    body: 'Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis.',
    href: '/blog/best-art-styles',
  },
]

function badgeIconName(b: BlogPost['badge']) {
  if (b === 'News') return 'badge-blog-news' as const
  if (b === 'Articles') return 'badge-blog-articles' as const
  return 'badge-blog-resources' as const
}

function BlogCardV3({ post }: { post: BlogPost }) {
  return (
    <Link
      to={post.href}
      style={{
        display: 'flex',
        gap: 24,
        alignItems: 'center',
        textDecoration: 'none',
        flexShrink: 0,
        width: '100%',
      }}
    >
      {/* Image 382x284 rounded-24, badge overlay top-21.5 left-20 */}
      <div style={{
        width: 382,
        height: 284,
        overflow: 'hidden',
        borderRadius: PX.radius.large,
        flexShrink: 0,
        position: 'relative',
      }}>
        <img
          src={post.image}
          alt=""
          aria-hidden="true"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
        {/* Badge — bg white, top-21.5 left-20, px-12 py-6, pill */}
        <span style={{
          position: 'absolute',
          top: 21.5,
          left: 20,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 6,
          paddingBottom: 6,
          background: PX.neutral100,
          borderRadius: PX.radius.pill,
        }}>
          <PxFigmaIcon name={badgeIconName(post.badge)} size={16} color={PX.neutral700} />
          <span style={{
            paddingTop: 2,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
            whiteSpace: 'nowrap',
          }}>{post.badge}</span>
        </span>
      </div>

      {/* Content right : Heading + Paragraph + Flex Horizontal (Date + Read more) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        flex: 1,
        minWidth: 0,
      }}>
        {/* Heading — Display/5 24/1.25/-0.72 neutral700 */}
        <p style={{
          margin: 0,
          width: 382,
          maxWidth: '100%',
          fontFamily: PX.font.display,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
        }}>{post.title}</p>

        {/* Paragraph — 16/1.5/-0.48 neutral500, pt-16 pb-32 */}
        <div style={{
          paddingTop: 16,
          paddingBottom: 32,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          <p style={{
            margin: 0,
            width: 377,
            maxWidth: '100%',
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
          }}>{post.body}</p>
        </div>

        {/* Flex Horizontal : Date left + Read more right, h-22 w-full justify-between */}
        <div style={{
          display: 'flex',
          height: 22,
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
        }}>
          {/* Date — calendar icon + date neutral400 */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <PxFigmaIcon name="blog-calendar" size={22} color={PX.neutral400} />
            <span style={{
              paddingTop: 4,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
              whiteSpace: 'nowrap',
            }}>{post.date}</span>
          </span>

          {/* "Read more →" — neutral700 + chevron-right */}
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
          }}>
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              whiteSpace: 'nowrap',
            }}>Read more</span>
            <PxIcon name="chevron-right" size={12} color={PX.neutral700} />
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Pagination Buttons Row (Figma node 11797:21199) ──────────────────
// Left circle button (bg white shadow), centered "1/6" text, right Primary
// Circle Button (bg neutral700, chevron-right white).
function ButtonsRow() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      width: '100%',
    }}>
      {/* Left : Primary Circle Button white — 48x48 bg neutral100 shadow */}
      <button
        type="button"
        aria-label="Previous page"
        style={{
          width: 48,
          height: 48,
          padding: 0,
          background: PX.neutral100,
          border: 'none',
          borderRadius: PX.radius.pill,
          boxShadow: PX.shadow.small,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        <PxIcon name="chevron-left" size={16} color={PX.neutral700} />
      </button>

      {/* Center "1/6" */}
      <p style={{
        margin: 0,
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        textAlign: 'center',
        whiteSpace: 'nowrap',
      }}>1/6</p>

      {/* Right : Primary Circle Button dark — 48x48 bg neutral700 */}
      <button
        type="button"
        aria-label="Next page"
        style={{
          width: 48,
          height: 48,
          padding: 0,
          background: PX.neutral700,
          border: 'none',
          borderRadius: PX.radius.pill,
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        <PxIcon name="chevron-right" size={16} color={PX.neutral100} />
      </button>
    </div>
  )
}

// ─── Articles Section (Figma node 11797:21143) ────────────────────────
// py-120, container w-1200 flex justify-between (Sidebar 332 + Articles 788).
function ArticlesSection() {
  return (
    <div style={{
      paddingTop: 120,
      paddingBottom: 120,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      width: '100%',
      zIndex: 2,
      position: 'relative',
    }}>
      <div style={{
        width: 1200,
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 80,
      }}>
        <Sidebar />

        {/* Articles Wrapper 788 — gap-40 (cards) + pagination row */}
        <div style={{
          width: 788,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 40,
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          {BLOG_POSTS.map(post => (
            <BlogCardV3 key={post.href} post={post} />
          ))}
          <ButtonsRow />
        </div>
      </div>
    </div>
  )
}

// ─── Section root ─────────────────────────────────────────────────────
export default function PxBlogV2() {
  return (
    <section style={{
      position: 'relative',
      width: '100%',
      background: PX.neutral200,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      isolation: 'isolate',
    }}>
      <BlogHeader />
      <HeroSection />
      <ArticlesSection />
    </section>
  )
}
