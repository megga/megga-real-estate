// MEGGA Marketplace — Property X "Properties" page Grid section.
// Source : Figma node 9552:21438 (🏢 Properties) — Articles Section + Grid Wrapper.
//
// Structure fidèle :
//   <section pt-64 pb-160 flex items-start justify-center>
//     <Grid Wrapper w-1200 flex-wrap gap-x-24 gap-y-48 items-start>
//       <Properties Card/V2 w-588 x6>
//         <Card h-364 rounded-24 overflow-clip bg-cover>
//           <Image absolute fill object-cover>
//           <Flex Horizontal absolute top-0 left/right p-24 justify-between>
//             <Badge bg-neutral700 px-12 py-6 rounded-pill : icon + "For rent"/"For sale">
//             <Primary Circle Button bg-white size-40 shadow-small : plus icon>
//           </Flex Horizontal>
//         </Card>
//         <Bottom Content gap-6 flex-col>
//           <Title 24/Medium tracking-0.72 neutral700>
//           <Details Wrapper gap-8 : icon location V37 size-20 + address 16/Medium>
//         </Bottom Content>
//         <Divider h-0 w-full (border-top neutral300)>
//         <Flex Horizontal w-full justify-between items-center>
//           <Amenities Wrapper gap-24 : 4 amenities (icon 20 + value 16/Medium neutral400)>
//             V31 surface / V23 beds / V33 baths / V27 garage
//           <Link "Contact agent" gap-6 16/Medium neutral700 + chevron-right>
//         </Flex Horizontal>
//       </Properties Card/V2>
//     </Grid Wrapper>
//   </section>

import { PX, PxIcon, PxFigmaIcon } from '..'

interface PropertyItem {
  id: string
  badge: 'For rent' | 'For sale'
  badgeIcon: 'key' | 'home'
  image: string
  title: string
  address: string
  surface: string
  beds: number
  baths: number
  garage: number
}

// Données fidèles Figma (node 9552:21438 — 6 Properties Card/V2)
// Images : Unsplash visuels équivalents (le template Figma utilise des assets
// génériques, on garde la même direction art : intérieurs lumineux modernes).
const PROPERTIES: PropertyItem[] = [
  {
    id: 'p1',
    badge: 'For rent',
    badgeIcon: 'key',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=85',
    title: 'Luxury Loft in San Francisco',
    address: '2238 Stradella Rd, SF',
    surface: '2,553 sqtf',
    beds: 3,
    baths: 2,
    garage: 3,
  },
  {
    id: 'p2',
    badge: 'For sale',
    badgeIcon: 'home',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=85',
    title: 'Home in Los Angeles Heart',
    address: '2596 El Segundo, Los Angeles',
    surface: '4,821 sqtf',
    beds: 5,
    baths: 6,
    garage: 5,
  },
  {
    id: 'p3',
    badge: 'For rent',
    badgeIcon: 'key',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=85',
    title: 'Modern Loft in San Francisco',
    address: '3335 21 St, SF',
    surface: '1,334 sqtf',
    beds: 1,
    baths: 2,
    garage: 1,
  },
  {
    id: 'p4',
    badge: 'For rent',
    badgeIcon: 'key',
    image: 'https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&q=85',
    title: 'Executive Office, San Diego',
    address: '90071, South Grand Avenue, San Diego',
    surface: '8,392 sqtf',
    beds: 4,
    baths: 6,
    garage: 4,
  },
  {
    id: 'p5',
    badge: 'For sale',
    badgeIcon: 'home',
    image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=1200&q=85',
    title: 'Apartment in Downtown, San Diego',
    address: '90071, South Grand Avenue, SD',
    surface: '1,334 sqtf',
    beds: 2,
    baths: 2,
    garage: 1,
  },
  {
    id: 'p6',
    badge: 'For rent',
    badgeIcon: 'key',
    image: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1200&q=85',
    title: 'Home in Downtown, Los Angeles',
    address: '2238 Stradella Rd, LA',
    surface: '8,392 sqtf',
    beds: 3,
    baths: 3,
    garage: 2,
  },
]

// Badge sur card image — bg neutral700, icon + texte (For rent / For sale)
// On utilise PxIcon (line-drawings) qui contient 'key' ET 'home' — PxFigmaIcon
// n'a que 'key', donc on aligne avec le pattern de PxAllProperties.
function CardBadge({ label, icon }: { label: string; icon: 'key' | 'home' }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 12,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral700,
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

// Amenity item — icon 20px + value 16/Medium neutral400
function Amenity({ icon, value }: { icon: 'surface' | 'bed' | 'bath' | 'parking'; value: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <PxFigmaIcon name={icon} size={20} color={PX.neutral400} />
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral400,
        whiteSpace: 'nowrap',
      }}>{value}</span>
    </span>
  )
}

function PropertyCardV2({ p }: { p: PropertyItem }) {
  return (
    <div style={{
      // Card V2 : w-588, flex-col gap-24
      width: 588,
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      gap: 24,
    }}>
      {/* Image card : bg-neutral500, h-364, rounded-24, overflow-clip */}
      <div style={{
        position: 'relative',
        background: PX.neutral500,
        height: 364,
        width: '100%',
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        backgroundImage: `url("${p.image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Flex Horizontal absolute top, p-24, justify-between */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <CardBadge label={p.badge} icon={p.badgeIcon} />
          {/* Primary Circle Button — bg-white size-40 shadow-small : plus icon */}
          <button
            type="button"
            aria-label="Ajouter à la sélection"
            style={{
              width: 40,
              height: 40,
              borderRadius: PX.radius.pill,
              border: 0,
              background: PX.neutral100,
              boxShadow: PX.shadow.small,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <PxIcon name="plus" size={16} color={PX.neutral700} />
          </button>
        </div>
      </div>

      {/* Bottom Content : gap-6 flex-col items-start, w-full */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        width: '100%',
      }}>
        {/* Title : 24/Medium tracking-0.72 neutral700 */}
        <p style={{
          margin: 0,
          fontFamily: PX.font.display,
          fontSize: 24,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: '100%',
        }}>{p.title}</p>
        {/* Details Wrapper : gap-8, icon location V37 size-20 + address */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}>
          <PxFigmaIcon name="location" size={20} color={PX.neutral700} />
          {/* Wrapper : pt-6 */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            paddingTop: 6,
          }}>
            <span style={{
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
              whiteSpace: 'nowrap',
            }}>{p.address}</span>
          </div>
        </div>
      </div>

      {/* Divider : 1px border-top neutral300 (h-0 w-full + border-top) */}
      <div style={{
        height: 0,
        width: '100%',
        borderTop: `1px solid ${PX.neutral300}`,
      }} />

      {/* Flex Horizontal w-full : Amenities | Contact agent link */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
      }}>
        {/* Amenities Wrapper : gap-24 */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
        }}>
          <Amenity icon="surface" value={p.surface} />
          <Amenity icon="bed" value={String(p.beds)} />
          <Amenity icon="bath" value={String(p.baths)} />
          <Amenity icon="parking" value={String(p.garage)} />
        </div>

        {/* Link "Contact agent" : gap-6 16/Medium neutral700 + chevron-right 16 */}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
        }}>
          <span style={{
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral700,
            whiteSpace: 'nowrap',
          }}>Contact agent</span>
          <PxFigmaIcon name="chevron-right" size={16} color={PX.neutral700} />
        </span>
      </div>
    </div>
  )
}

export default function PxPropertiesGrid() {
  return (
    <section style={{
      // Articles Section : pt-64 pb-160, flex items-start justify-center, w-full
      paddingTop: 64,
      paddingBottom: 160,
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      width: '100%',
      position: 'relative',
      zIndex: 2,
    }}>
      {/* Grid Wrapper : w-1200, flex-wrap, content-start, gap row-48 col-24, items-start */}
      <div style={{
        width: 1200,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        alignContent: 'flex-start',
        columnGap: 24,
        rowGap: 48,
      }}>
        {PROPERTIES.map(p => <PropertyCardV2 key={p.id} p={p} />)}
      </div>
    </section>
  )
}
