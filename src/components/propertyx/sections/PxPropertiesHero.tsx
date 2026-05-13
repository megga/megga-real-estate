// MEGGA Marketplace — Property X "Properties" page Hero section.
// Source : Figma node 9552:21438 (🏢 Properties) — Hero Section + Browser.
//
// Structure fidèle :
//   <section pt-24 px-24>
//     <Container bg-neutral700 rounded-24 pt-110 pb-90 flex-col items-center>
//       <Content flex-col items-center>
//         <Top Content>
//           <Badge dark "All properties" (cercle home V25 + texte)>
//           <Title H1 72/110% w-854.75 white tracking-2.16>
//             "Check on all properties we have available"
//           </Title>
//         </Top Content>
//         <Paragraph pt-16 pb-32 w-562 16/1.5 neutral400 center>
//       </Content>
//       <Browser absolute bottom-[-48] left-1/2 -translate-x-1/2
//                bg-white rounded-48 p-24 gap-2 shadow-small>
//         <Input "Search for properties" 400×52 bg-fafafb rounded-L-pill
//                + dark circle button right (search icon)>
//         <Select "Location" 220×52 bg-fafafb (no rounding)>
//         <Select "Property" 220×52 bg-fafafb (no rounding)>
//         <Select "Type"     220×52 bg-fafafb rounded-R-pill>
//       </Browser>
//     </Container>
//   </section>

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PX, PxFigmaIcon } from '..'

// Selects génériques — labels fidèles Figma (anglais : "Location", "Property", "Type")
// Valeurs adaptées au marché suisse (cantons + 8 types de biens MEGGA)
const LOCATIONS = [
  { value: '', label: 'Location' },
  { value: 'GE', label: 'Genève' },
  { value: 'VD', label: 'Vaud' },
  { value: 'VS', label: 'Valais' },
  { value: 'NE', label: 'Neuchâtel' },
  { value: 'FR', label: 'Fribourg' },
  { value: 'BE', label: 'Berne' },
  { value: 'JU', label: 'Jura' },
  { value: 'TI', label: 'Tessin' },
] as const

const PROPERTY_KINDS = [
  { value: '', label: 'Property' },
  { value: 'apartment', label: 'Appartement' },
  { value: 'house', label: 'Maison' },
  { value: 'villa', label: 'Villa' },
  { value: 'commercial', label: 'Commercial' },
  { value: 'office', label: 'Bureau' },
  { value: 'parking', label: 'Parking' },
  { value: 'storage', label: 'Dépôt' },
  { value: 'land', label: 'Terrain' },
] as const

const TX_TYPES = [
  { value: '', label: 'Type' },
  { value: 'rent', label: 'À louer' },
  { value: 'buy', label: 'À vendre' },
] as const

// Style commun aux selects : 220×52, bg #fafafb, padding 16/6/16/6
const selectFieldStyle = {
  background: PX.neutral200,
  width: 220,
  height: 52,
  minHeight: 48,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 6,
  paddingBottom: 6,
  position: 'relative' as const,
}

const placeholderStyle = {
  fontFamily: PX.font.display,
  fontSize: 16,
  fontWeight: 400,
  lineHeight: 1.25,
  letterSpacing: '-0.48px',
  color: PX.neutral500,
  background: 'transparent',
  border: 0,
  outline: 'none',
  appearance: 'none' as const,
  cursor: 'pointer',
  flex: 1,
  paddingRight: 8,
}

// Badge "All properties" dark — Figma 11774:19337 :
// bg neutral600, pl-6 pr-12 py-6, rounded-pill, cercle icône bg-neutral500 + texte blanc
function AllPropertiesBadgeDark() {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 6,
      paddingRight: 12,
      paddingTop: 6,
      paddingBottom: 6,
      background: PX.neutral600,
      borderRadius: PX.radius.pill,
    }}>
      <span style={{
        width: 26,
        height: 26,
        borderRadius: PX.radius.pill,
        background: PX.neutral500,
        display: 'grid',
        placeItems: 'center',
        flexShrink: 0,
      }}>
        <PxFigmaIcon name="badge-allprops-home" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral100,
      }}>All properties</span>
    </span>
  )
}

export default function PxPropertiesHero() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [location, setLocation] = useState('')
  const [kind, setKind] = useState('')
  const [tx, setTx] = useState('')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const params = new URLSearchParams()
    if (q) params.set('q', q)
    if (kind) params.set('type', kind)
    if (location) params.set('canton', location)
    const route = tx === 'buy' ? '/acheter' : '/louer'
    navigate(`${route}?${params.toString()}`)
  }

  return (
    <section style={{
      // Hero Section : pt-24 px-24, flex-col items-start, w-full
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'flex-start',
      width: '100%',
      position: 'relative',
      zIndex: 3,
    }}>
      {/* Container : bg-neutral700 (dark), rounded-24, pt-110 pb-90, flex-col items-center justify-center */}
      <div style={{
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        paddingTop: 110,
        paddingBottom: 90,
        position: 'relative',
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {/* Content : flex-col items-center justify-center */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          {/* Top Content : Badge + Title */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <AllPropertiesBadgeDark />
            {/* Title : pt-16, 72px / 110% / -2.16 / 500, w-854.75 white center */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: 16,
            }}>
              <h1 style={{
                margin: 0,
                fontFamily: PX.font.display,
                fontSize: 72,
                fontWeight: 500,
                lineHeight: 1.15,
                letterSpacing: '-2.16px',
                color: PX.neutral100,
                textAlign: 'center',
                width: 854.75,
              }}>
                Check on all properties we have available
              </h1>
            </div>
          </div>
          {/* Paragraph : pt-16 pb-32, w-562 16/1.5 -0.48 neutral400 center */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: 16,
            paddingBottom: 32,
          }}>
            <p style={{
              margin: 0,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
              textAlign: 'center',
              width: 562.047,
              height: 48,
            }}>
              Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
            </p>
          </div>
        </div>

        {/* Browser : absolute bottom-[-48], left-1/2 -translate-x-1/2, bg-white rounded-48 p-24 gap-2 shadow-small */}
        <form
          onSubmit={handleSubmit}
          style={{
            position: 'absolute',
            bottom: -48,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PX.neutral100,
            borderRadius: 48,
            padding: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            boxShadow: PX.shadow.small,
          }}
        >
          {/* Zone 1 : Input "Search for properties" — 400×52, bg #fafafb, rounded LEFT pill */}
          <div style={{
            background: PX.neutral200,
            width: 400,
            height: 52,
            minHeight: 52,
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 16,
            paddingRight: 6,
            paddingTop: 6,
            paddingBottom: 6,
            borderTopLeftRadius: PX.radius.pill,
            borderBottomLeftRadius: PX.radius.pill,
            position: 'relative',
          }}>
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search for properties"
              style={{
                ...placeholderStyle,
                color: q ? PX.neutral700 : PX.neutral500,
                paddingRight: 52,
                cursor: 'text',
              }}
            />
            <button
              type="submit"
              aria-label="Search"
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 40,
                height: 40,
                borderRadius: PX.radius.pill,
                border: 0,
                background: PX.neutral700,
                color: PX.neutral100,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
              }}
            >
              <PxFigmaIcon name="search" size={22} color={PX.neutral100} />
            </button>
          </div>

          {/* Zone 2 : Location — 220×52 */}
          <div style={selectFieldStyle}>
            <select
              value={location}
              onChange={e => setLocation(e.target.value)}
              aria-label="Location"
              style={{
                ...placeholderStyle,
                color: location ? PX.neutral700 : PX.neutral500,
              }}
            >
              {LOCATIONS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            <PxFigmaIcon name="chevron-down" size={16} color={PX.neutral500} />
          </div>

          {/* Zone 3 : Property — 220×52 */}
          <div style={selectFieldStyle}>
            <select
              value={kind}
              onChange={e => setKind(e.target.value)}
              aria-label="Property"
              style={{
                ...placeholderStyle,
                color: kind ? PX.neutral700 : PX.neutral500,
              }}
            >
              {PROPERTY_KINDS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
            <PxFigmaIcon name="chevron-down" size={16} color={PX.neutral500} />
          </div>

          {/* Zone 4 : Type — 220×52, rounded RIGHT pill */}
          <div style={{
            ...selectFieldStyle,
            borderTopRightRadius: PX.radius.pill,
            borderBottomRightRadius: PX.radius.pill,
          }}>
            <select
              value={tx}
              onChange={e => setTx(e.target.value)}
              aria-label="Type"
              style={{
                ...placeholderStyle,
                color: tx ? PX.neutral700 : PX.neutral500,
              }}
            >
              {TX_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
            <PxFigmaIcon name="chevron-down" size={16} color={PX.neutral500} />
          </div>
        </form>
      </div>
    </section>
  )
}
