// MEGGA Marketplace — Property X "👤 Agent Single" content (hero + properties + articles).
// Source : Figma node 9552:21460 — code Figma EXACT (texte EN, dimensions, position).
//
// Composition (top → bottom dans le frame 1440×3784) :
//   1. Hero Section  (gap 57, pt 64, pb 120, w 1440)
//      • Profile Card 486×692 (white, rounded 24, shadow small)
//        — Decoration dark band 485.72×140.5 (haut)
//        — Avatar 100×100 (overlap, ml 41.27 mt 100.35)
//        — Profile Info : Position badge / John Carter / @johncarter
//        — Contact me PrimaryButton (top-right ml 297 mt 161)
//        — Contact Wrapper : Email, Phone, Location, Position (4 rows)
//        — Input Text "property.com/@johncarter" + Copy (pill bg neutral200)
//      • Rich Text (657w right) : About me + paragraphs + My experience + bullet list
//   2. Properties Section (w 1440)
//      • Container bg neutral700, rounded 24, py 120
//        — Top Content w 1195 : Badge "All properties" (dark) + H2 + "Browse all properties"
//        — Bottom Content : 2 Properties Cards/V2 (588×~520) side by side
//   3. Articles Section (w 1440, pt 80 pb 160)
//      • Top Content w 1200 : Badge "Our blog" (light) + H2 + "Browse all articles"
//      • Grid Wrapper : 3 Blog Cards (382×~480)

import { PX, PxFigmaIcon } from '..'

// ─── Icons "Small Icon/V*" déjà dans /public/icons/figma/ ──────────────
// V37 location, V38 mail, V39 phone, V46 briefcase, V49 calendar (blog-calendar)
// V34 key (For rent), V35 tag (For sale)
// V31 surface (sqft)
// V30 sparkle (Articles eyebrow icon)
// V24 blog-resource, V41 blog-news, V50 blog-article

// ─── Hero : Profile Card 486×692 ─────────────────────────────────────────
function ProfileCard() {
  return (
    <div style={{
      position: 'relative',
      width: 486,
      height: 692,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      boxShadow: PX.shadow.small,
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Decoration dark band haut */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: 486,
        height: 140.5,
        overflow: 'hidden',
      }}>
        <img
          src="/images/sections/agent-profile/profile-decoration.jpg"
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

      {/* Contact me PrimaryButton — top right (ml=297, mt=161) */}
      <button
        type="button"
        style={{
          position: 'absolute',
          top: 161,
          left: 297,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: PX.neutral700,
          paddingLeft: 16,
          paddingRight: 6,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: PX.radius.pill,
          border: 0,
          cursor: 'pointer',
          fontFamily: PX.font.sans,
        }}
      >
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          whiteSpace: 'nowrap',
        }}>
          Contact me
        </span>
        <span style={{
          width: 28,
          height: 28,
          background: PX.neutral100,
          borderRadius: PX.radius.pill,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral700} />
        </span>
      </button>

      {/* Avatar 100×100 — overlap on decoration (ml 41.27 mt 100.35) */}
      <div style={{
        position: 'absolute',
        top: 100,
        left: 41,
        width: 100,
        height: 100,
        borderRadius: '50%',
        overflow: 'hidden',
        background: PX.neutral300,
        border: `4px solid ${PX.neutral100}`,
        boxSizing: 'content-box',
        marginLeft: -4,
        marginTop: -4,
      }}>
        <img
          src="/images/sections/agent-profile/avatar-john-carter.jpg"
          alt="John Carter"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </div>

      {/* Profile Info — sous l'avatar (just name + handle, pas d'eyebrow)
          Figma : x=41.27 y=216.35 width=138 height=58 */}
      <div style={{
        position: 'absolute',
        top: 216,
        left: 41,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 4,
      }}>
        {/* Name */}
        <h2 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 36,
          lineHeight: 1.25,
          letterSpacing: '-1.08px',
          color: PX.neutral700,
        }}>
          John Carter
        </h2>
        {/* Handle */}
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          @johncarter
        </span>
      </div>

      {/* Contact Wrapper — 4 info rows
          Figma : x=41.27 y=298.35 width=223.73 height=264, gap entre rows = 20 */}
      <div style={{
        position: 'absolute',
        top: 298,
        left: 41,
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <ContactRow icon="agent-mail" label="Email address" value="property@johncarter.com" />
        <ContactRow icon="agent-phone" label="Phone number" value="(414) 325 - 427" />
        <ContactRow icon="location" label="Location" value="San Francisco, CA" />
        <ContactRow icon="agent-briefcase" label="Position" value="Inmobiliary Agent" />
      </div>

      {/* Input Text pill avec copy — bottom (ml 43 mt 594) */}
      <div style={{
        position: 'absolute',
        top: 594,
        left: 43,
        width: 403,
        minHeight: 52,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 6,
        background: PX.neutral200,
        paddingLeft: 16,
        paddingRight: 6,
        paddingTop: 6,
        paddingBottom: 6,
        borderRadius: PX.radius.pill,
        boxSizing: 'border-box',
      }}>
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral400,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          property.com/@johncarter
        </span>
        <button
          type="button"
          aria-label="Copy link"
          style={{
            width: 40,
            height: 40,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: PX.neutral100,
            borderRadius: PX.radius.pill,
            border: 0,
            cursor: 'pointer',
            flexShrink: 0,
            boxShadow: PX.shadow.small,
          }}
        >
          <CopyIcon />
        </button>
      </div>
    </div>
  )
}

function ContactRow({ icon, label, value }: { icon: 'agent-mail' | 'agent-phone' | 'location' | 'agent-briefcase'; label: string; value: string }) {
  // Figma : Info Wrapper = icon 16×16 + gap 6 + wrapper(label y=2 h=20 + value y=28)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 16,
        height: 16,
        flexShrink: 0,
        marginTop: 2,
      }}>
        <PxFigmaIcon name={icon} size={16} color={PX.neutral500} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 14,
          lineHeight: 1.25,
          letterSpacing: '-0.42px',
          color: PX.neutral400,
        }}>
          {label}
        </span>
        <span style={{
          paddingTop: 2,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral700,
        }}>
          {value}
        </span>
      </div>
    </div>
  )
}

// Copy icon SVG inline (Line Rounded/Copy — Figma)
function CopyIcon() {
  return (
    <svg width={16} height={16} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="5" y="5" width="9" height="9" rx="1.5" stroke={PX.neutral700} strokeWidth="1.4" />
      <path d="M11 5V3.5C11 2.67 10.33 2 9.5 2H3.5C2.67 2 2 2.67 2 3.5V9.5C2 10.33 2.67 11 3.5 11H5" stroke={PX.neutral700} strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

// ─── Hero : Rich Text (About me + My experience) ────────────────────────
const EXPERIENCE_ITEMS = [
  'Morbi fringilla molestie magna sed dictum. Praesent.',
  'Cras mi purus, viverra vitae felis sit amet.',
  'Non mattis urna ex nec sem. Donec varius diam et suscipit venenati.',
  'Quisque euismod posuere lacus sit amet volutpat.',
]

function RichText() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: 657,
      flexShrink: 0,
    }}>
      {/* About me */}
      <div style={{ paddingBottom: 16 }}>
        <h2 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 36,
          lineHeight: 1.25,
          letterSpacing: '-1.08px',
          color: PX.neutral700,
          width: 657,
        }}>
          About me
        </h2>
      </div>
      <div style={{ paddingBottom: 24 }}>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
          width: 653,
        }}>
          Lorem ipsum dolor sit amet consectetur. Gravida elementum dolor semper felis pulvinar feugiat risus adipiscing dictum. Ultricies nec elementum nisi ut. Cras diam odio sed auctor pellentesque. Sit nisl ipsum id convallis tristique. Malesuada.
        </p>
      </div>
      <div>
        <p style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          Quis faucibus massa sit egestas. Sit fermentum est ac pulvinar et sagittis sed sit ut. Quis faucibus aenean nibh vestibulum enim mi sit. Sollicitudin ultrices ultrices in ipsum urna fringilla massa leo. Sapien ultricies vitae rhoncus molestie purus. Urna urna dolor euismod porttitor et. Magna adipiscing dictum et adipiscing mollis feugiat.
        </p>
      </div>

      {/* My experience */}
      <div style={{ paddingTop: 64, paddingBottom: 4 }}>
        <div style={{ paddingTop: 16, paddingBottom: 16 }}>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 36,
            lineHeight: 1.25,
            letterSpacing: '-1.08px',
            color: PX.neutral700,
            width: 657,
          }}>
            My experience
          </h2>
        </div>
        <div>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
            width: 653,
            paddingBottom: 24,
          }}>
            Lorem ipsum dolor sit amet consectetur. Gravida elementum dolor semper felis pulvinar feugiat risus adipiscing dictum. Ultricies nec elementum nisi ut. Cras diam odio sed auctor pellentesque. Sit nisl ipsum id convallis tristique. Malesuada.
          </p>
          {/* Bullet list */}
          <ul style={{
            margin: 0,
            paddingLeft: 32,
            paddingTop: 16,
            paddingBottom: 24,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            listStyle: 'none',
          }}>
            {EXPERIENCE_ITEMS.map((item, i) => (
              <li key={i} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
              }}>
                <span style={{
                  width: 5,
                  height: 5,
                  background: PX.neutral500,
                  borderRadius: '50%',
                  flexShrink: 0,
                }} />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

// ─── Properties Section (dark) ──────────────────────────────────────────
interface PropertyCardData {
  id: string
  type: 'rent' | 'sale'
  title: string
  address: string
  surface: string
  image: string
}

const PROPERTIES: PropertyCardData[] = [
  {
    id: 'p1',
    type: 'rent',
    title: 'Luxury Loft in San Francisco',
    address: '2238 Stradella Rd, SF',
    surface: '2,553 sqtf',
    image: '/images/sections/agent-profile/property-1-rent.jpg',
  },
  {
    id: 'p2',
    type: 'sale',
    title: 'Luxury Loft in San Francisco',
    address: '2238 Stradella Rd, SF',
    surface: '4,821 sqtf',
    image: '/images/sections/agent-profile/property-2-sale.jpg',
  },
]

function PropertyCardV2({ data }: { data: PropertyCardData }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      width: 588,
      flexShrink: 0,
    }}>
      {/* Card image */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: 364,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        background: PX.neutral500,
      }}>
        <img
          src={data.image}
          alt={data.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        {/* Top overlay : Badge + Plus circle button */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 24,
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: PX.neutral700,
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 6,
            paddingBottom: 6,
            borderRadius: PX.radius.pill,
          }}>
            {/* V34 (key) Figma : wrapper -rotate-45 → clé diagonale. V35 (tag) : pas de rotation */}
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 16,
              height: 16,
              transform: data.type === 'rent' ? 'rotate(-45deg)' : 'none',
            }}>
              <PxFigmaIcon name={data.type === 'rent' ? 'key' : 'tag'} size={16} color={PX.neutral100} />
            </span>
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
              whiteSpace: 'nowrap',
            }}>
              {data.type === 'rent' ? 'For rent' : 'For sale'}
            </span>
          </span>
          <button
            type="button"
            aria-label="Add to favorites"
            style={{
              width: 40,
              height: 40,
              background: PX.neutral100,
              borderRadius: PX.radius.pill,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 0,
              cursor: 'pointer',
              boxShadow: PX.shadow.small,
            }}
          >
            <PxFigmaIcon name="plus" size={16} color={PX.neutral700} />
          </button>
        </div>
      </div>

      {/* Bottom content : Title + Address */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral100,
        }}>
          {data.title}
        </h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <PxFigmaIcon name="location" size={20} color={PX.neutral100} />
          <span style={{
            paddingTop: 6,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
            whiteSpace: 'nowrap',
          }}>
            {data.address}
          </span>
        </div>
      </div>

      {/* Divider */}
      <div style={{
        width: '100%',
        height: 1,
        background: PX.borderInverse,
      }} />

      {/* Amenities + Contact agent button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PxFigmaIcon name="surface" size={20} color={PX.neutral100} />
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
              whiteSpace: 'nowrap',
            }}>
              {data.surface}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PxFigmaIcon name="bed" size={20} color={PX.neutral100} />
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
            }}>3</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PxFigmaIcon name="bath" size={20} color={PX.neutral100} />
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
            }}>2</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PxFigmaIcon name="parking" size={20} color={PX.neutral100} />
            <span style={{
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral100,
            }}>1</span>
          </div>
        </div>
        <button
          type="button"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            background: 'transparent',
            border: 0,
            padding: 0,
            cursor: 'pointer',
            fontFamily: PX.font.sans,
          }}
        >
          <span style={{
            paddingTop: 2,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral100,
            whiteSpace: 'nowrap',
          }}>
            Contact agent
          </span>
          <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral100} />
        </button>
      </div>
    </div>
  )
}

// ─── Articles Section ────────────────────────────────────────────────────
interface BlogCardData {
  id: string
  category: 'Resources' | 'News' | 'Articles'
  categoryIcon: 'blog-resource' | 'blog-news' | 'blog-article'
  title: string
  date: string
  image: string
}

const ARTICLES: BlogCardData[] = [
  {
    id: 'b1',
    category: 'Resources',
    categoryIcon: 'blog-resource',
    title: 'Here’s how decorate your new home from scratch',
    date: 'Mar 30, 2026',
    image: '/images/sections/agent-profile/blog-1-decorate.jpg',
  },
  {
    id: 'b2',
    category: 'News',
    categoryIcon: 'blog-news',
    title: 'Home buying basics: How many bedrooms and bathrooms?',
    date: 'Mar 28, 2026',
    image: '/images/sections/agent-profile/blog-2-bedrooms.jpg',
  },
  {
    id: 'b3',
    category: 'Articles',
    categoryIcon: 'blog-article',
    title: 'First-time homebuyer’s guide: Steps for beginners',
    date: 'Mar 26, 2026',
    image: '/images/sections/agent-profile/blog-3-firsttime.jpg',
  },
]

function BlogCardV2({ data }: { data: BlogCardData }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
      width: 382,
      flexShrink: 0,
    }}>
      {/* Image with category badge top-left */}
      <div style={{
        position: 'relative',
        width: 382,
        height: 401,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        background: PX.neutral300,
      }}>
        <img
          src={data.image}
          alt={data.title}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
        <span style={{
          position: 'absolute',
          top: 21,
          left: 20,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          background: PX.neutral100,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 6,
          paddingBottom: 6,
          borderRadius: PX.radius.pill,
        }}>
          <PxFigmaIcon name={data.categoryIcon} size={16} color={PX.neutral700} />
          <span style={{
            paddingTop: 2,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
            whiteSpace: 'nowrap',
          }}>
            {data.category}
          </span>
        </span>
      </div>

      {/* Content : Title + Date row */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
          width: 382,
        }}>
          {data.title}
        </h3>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: 22,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <PxFigmaIcon name="blog-calendar" size={22} color={PX.neutral400} />
            <span style={{
              paddingTop: 4,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
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
              paddingTop: 2,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 16,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              whiteSpace: 'nowrap',
            }}>
              Read more
            </span>
            <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral700} />
          </a>
        </div>
      </div>
    </div>
  )
}

// ─── Properties Section eyebrow Badge (dark variant) ─────────────────────
function PropertiesBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 8,
      background: PX.neutral600,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        background: PX.neutral500,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-allprops-home" size={14} color={PX.neutral100} />
      </span>
      <span style={{
        paddingTop: 2,
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 14,
        lineHeight: 1.25,
        letterSpacing: '-0.42px',
        color: PX.neutral100,
        whiteSpace: 'nowrap',
      }}>
        All properties
      </span>
    </span>
  )
}

function ArticlesBadge() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      background: PX.neutral300,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        background: PX.neutral400,
        borderRadius: '50%',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        <span style={{
          display: 'inline-flex',
          transform: 'rotate(45deg)',
        }}>
          <PxFigmaIcon name="agent-sparkle" size={14} color={PX.neutral100} />
        </span>
      </span>
      <span style={{
        paddingTop: 2,
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        whiteSpace: 'nowrap',
      }}>
        Our blog
      </span>
    </span>
  )
}

// ─── Composant principal ──────────────────────────────────────────────────
export default function PxAgentProfile() {
  return (
    <>
      {/* ============== HERO SECTION ============== */}
      <section style={{
        width: '100%',
        background: PX.surfaceBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 64,
        paddingBottom: 120,
      }}>
        <div style={{
          width: 'min(1200px, calc(100% - 48px))',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
          gap: 57,
        }}>
          <ProfileCard />
          <RichText />
        </div>
      </section>

      {/* ============== PROPERTIES SECTION ============== */}
      {/* Figma : Section 898 tall, dark Container 898 tall (touches) — pas de padding bas */}
      <section style={{
        width: '100%',
        background: PX.surfaceBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}>
        <div style={{
          width: 'min(1392px, calc(100% - 48px))',
          background: PX.neutral700,
          borderRadius: PX.radius.large,
          paddingTop: 120,
          paddingBottom: 120,
          paddingLeft: 96,
          paddingRight: 96,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          boxSizing: 'border-box',
        }}>
          {/* Top Content */}
          <div style={{
            width: '100%',
            maxWidth: 1195,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingBottom: 24,
            gap: 24,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <PropertiesBadge />
              <div style={{ paddingTop: 16 }}>
                <h2 style={{
                  margin: 0,
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 48,
                  lineHeight: 1.25,
                  letterSpacing: '-1.44px',
                  color: PX.neutral100,
                  whiteSpace: 'nowrap',
                }}>
                  Properties in charge of John Carter
                </h2>
              </div>
            </div>
            <a href="/properties" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              paddingBottom: 8,
              textDecoration: 'none',
            }}>
              <span style={{
                paddingTop: 2,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 16,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral100,
                whiteSpace: 'nowrap',
              }}>
                Browse all properties
              </span>
              <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral100} />
            </a>
          </div>

          {/* Bottom Content - cards row (Figma : touche directement le Top Content à y=258) */}
          <div style={{
            width: '100%',
            maxWidth: 1200,
            display: 'flex',
            gap: 24,
          }}>
            {PROPERTIES.map(p => <PropertyCardV2 key={p.id} data={p} />)}
          </div>
        </div>
      </section>

      {/* ============== ARTICLES SECTION ============== */}
      <section style={{
        width: '100%',
        background: PX.surfaceBg,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 120,
        paddingBottom: 120,
      }}>
        <div style={{
          width: 'min(1200px, calc(100% - 48px))',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* Top Content — Figma : Top Content height 114, Grid Wrapper starts at y=274 (gap 40 from Top Content end at y=234) */}
          <div style={{
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            paddingBottom: 40,
            gap: 24,
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
              <ArticlesBadge />
              <div style={{ paddingTop: 16 }}>
                <h2 style={{
                  margin: 0,
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 48,
                  lineHeight: 1.25,
                  letterSpacing: '-1.44px',
                  color: PX.neutral700,
                  maxWidth: 576,
                }}>
                  Articles by John Carter
                </h2>
              </div>
            </div>
            <a href="/blog" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              paddingBottom: 16,
              textDecoration: 'none',
            }}>
              <span style={{
                paddingTop: 2,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 16,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral700,
                whiteSpace: 'nowrap',
              }}>
                Browse all articles
              </span>
              <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral700} />
            </a>
          </div>
          {/* Grid Wrapper : 3 cards (Figma gap 26 entre cards = 408-382) */}
          <div style={{
            display: 'flex',
            gap: 26,
            justifyContent: 'space-between',
          }}>
            {ARTICLES.map(a => <BlogCardV2 key={a.id} data={a} />)}
          </div>
        </div>
      </section>
    </>
  )
}
