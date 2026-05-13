// MEGGA Marketplace — Property X "Properties Section" / All properties.
// Source : Figma node 11756:28759 — code Figma exact.
//
// Structure fidèle :
//   <section pt-160 pb-80 flex gap-40 items-start justify-center>
//     <Left Content flex-col>
//       <Title Wrapper>
//         <Badge LIGHT "All properties">
//         <H2 48 Display/8 w-357 tracking-1.44>
//       </Title Wrapper>
//       <Paragraph pt-16, w-369, 16/1.5 neutral500 h-72>
//       <Button Link pb-16 pt-24 : "Browse all properties" + chevron-right 16>
//     </Left Content>
//     <Grid 1 Column flex-col gap-40>
//       <Card (3x) flex gap-24 items-center>
//         <Image w-382 h-320 rounded-24>
//           <bg image + Badge dark "For rent"/"For sale" top-left>
//         <Content w-378 flex-col>
//           <Text Wrapper gap-6>
//             <Wrapper gap-8 : icon location V37 + address 16/Medium>
//             <Title 24 Display/5/Medium tracking-0.72>
//           <Paragraph pt-16 pb-32, 16/1.5 neutral500>
//           <Amenities Wrapper gap-24 : 4 amenities (surface, beds, baths, garage)>
//             each : icon V31/V23/V33/V27 size-20 + value 16/Medium neutral400
//       </Card>
//     </Grid 1 Column>
//   </section>

import { Link } from 'react-router-dom'
import { PX, PxIcon } from '..'

interface PropertyItem {
  id: string
  badge: 'À louer' | 'À vendre'
  badgeIcon: 'key' | 'home'
  image: string
  address: string
  title: string
  description: string
  surface: string
  beds: number
  baths: number
  garage: number
}

const PROPERTIES: PropertyItem[] = [
  {
    id: 'p1', badge: 'À louer', badgeIcon: 'key',
    image: 'https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=1200&q=85',
    address: '2238 Stradella Rd, SF',
    title: 'Loft contemporain à Carouge',
    description: 'Lumineux 4.5 pièces avec balcon et finitions haut de gamme.',
    surface: '110 m²', beds: 3, baths: 2, garage: 1,
  },
  {
    id: 'p2', badge: 'À vendre', badgeIcon: 'home',
    image: 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?w=1200&q=85',
    address: '2596 El Segundo, Los Angeles',
    title: 'Maison moderne à Champel',
    description: 'Villa contemporaine avec jardin, vue dégagée et prestations soignées.',
    surface: '230 m²', beds: 5, baths: 3, garage: 2,
  },
  {
    id: 'p3', badge: 'À louer', badgeIcon: 'key',
    image: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&q=85',
    address: '3335 21 St, SF',
    title: 'Loft contemporain à Lausanne',
    description: 'Loft de 130 m² entièrement rénové, prestations haut de gamme.',
    surface: '130 m²', beds: 2, baths: 2, garage: 1,
  },
]

// Badge "All properties" — LIGHT (bg-neutral300 + cercle bg-neutral400)
function AllPropertiesBadge() {
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
        <PxIcon name="home" size={15} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
      }}>Tous les biens</span>
    </span>
  )
}

// Badge "For rent" / "For sale" sur card image — bg neutral700, icon + texte
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
      <PxIcon name={icon} size={20} color={PX.neutral400} />
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral400,
      }}>{value}</span>
    </span>
  )
}

function PropertyCard({ p }: { p: PropertyItem }) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 24,
    }}>
      {/* Image : w-382 h-320 rounded-24 */}
      <div style={{
        position: 'relative',
        width: 382,
        height: 320,
        flexShrink: 0,
        borderRadius: PX.radius.large,
        overflow: 'hidden',
        backgroundImage: `url("${p.image}")`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}>
        {/* Badge top-left (20, 20) */}
        <span style={{
          position: 'absolute',
          top: 20,
          left: 20,
        }}>
          <CardBadge label={p.badge} icon={p.badgeIcon} />
        </span>
      </div>

      {/* Content : w-378 flex-col */}
      <div style={{
        width: 378,
        flexShrink: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
      }}>
        {/* Text Wrapper gap-6 */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
        }}>
          {/* Address row : icon location V37 20px + text 16/Medium */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}>
            <PxIcon name="location" size={20} color={PX.neutral700} />
            <span style={{
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.48px',
              color: PX.neutral700,
            }}>{p.address}</span>
          </div>
          {/* Title : 24 Display/5/Medium tracking-0.72 */}
          <h3 style={{
            margin: 0,
            fontFamily: PX.font.display,
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
          }}>{p.title}</h3>
        </div>
        {/* Paragraph : pt-16 pb-32, 16/1.5/-0.48 neutral500 */}
        <p style={{
          margin: 0,
          paddingTop: 16,
          paddingBottom: 32,
          width: '100%',
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>{p.description}</p>
        {/* Amenities Wrapper : flex gap-24 — 4 items */}
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
      </div>
    </div>
  )
}

export default function PxAllProperties() {
  return (
    <section style={{
      paddingTop: 160,
      paddingBottom: 80,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.neutral100,
      display: 'flex',
      gap: 40,
      alignItems: 'flex-start',
      justifyContent: 'center',
    }}>
      {/* Left Content */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        flexShrink: 0,
        position: 'sticky',
        top: 100,
      }}>
        {/* Title Wrapper */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}>
          <AllPropertiesBadge />
          {/* Title : pt-16, 48 Display/8/Medium tracking-1.44, w-357.5 */}
          <h2 style={{
            margin: 0,
            paddingTop: 16,
            width: 357,
            fontFamily: PX.font.display,
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
          }}>
            Découvrez tous les biens disponibles
          </h2>
        </div>
        {/* Paragraph : pt-16, w-369, 16/1.5 neutral500 */}
        <p style={{
          margin: 0,
          paddingTop: 16,
          width: 369,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
        }}>
          33 000 biens à louer dans toute la Suisse romande. Notre algorithme
          de matching IA vous trouve les meilleures opportunités selon vos critères.
        </p>
        {/* Button Link : pb-16 pt-24 — "Parcourir tous les biens" + chevron-right */}
        <div style={{
          paddingTop: 24,
          paddingBottom: 16,
        }}>
          <Link
            to="/acheter"
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
            Parcourir tous les biens
            <PxIcon name="chevron-right" size={16} color={PX.neutral700} />
          </Link>
        </div>
      </div>

      {/* Grid 1 Column : flex-col gap-40, 3 cards */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 40,
      }}>
        {PROPERTIES.map(p => <PropertyCard key={p.id} p={p} />)}
      </div>
    </section>
  )
}
