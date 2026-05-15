// MEGGA Marketplace — Property X "Properties for sale" hero.
// Source : Figma node 9552:21447 — sous-frame "Hero Section" (node 11781:16155)
// + Container dark 9613:28017 + Browser search 9613:28455.
//
// Structure :
//   <section pt-24 px-24>
//     <Container bg-neutral700 rounded-24 pt-120 pb-80 flex-col items-center>
//       <TitleWrapper flex-col items-center>
//         <Badge "For sale" — pill bg-neutral600 + circle 26 bg-neutral500 + star icon>
//         <Title pt-16 — 72/medium tracking-2.16 white w-854.75 center>
//       </TitleWrapper>
//       <Paragraph pt-16 pb-32 — 16/1.5 neutral400 w-562 h-48 center>
//       <Browser absolute -tx-1/2 left-50% top-383 — bg-white p-24 rounded-48 shadow-small>
//         <Input pill 400x52 rounded-l-pill — bg-neutral200 + search button right>
//         <Select 220x52 — bg-neutral200 + chevron-down>×3 (Location / Property / Type)
//       </Browser>
//     </Container>
//   </section>

import { PX, PxFigmaIcon } from '..'

function ForSaleBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        paddingLeft: 6,
        paddingRight: 12,
        paddingTop: 6,
        paddingBottom: 6,
        background: PX.neutral600,
        borderRadius: PX.radius.pill,
      }}
    >
      {/* Circle icon 26px bg neutral500 + star size-14.857 white */}
      <span
        style={{
          width: 26,
          height: 26,
          borderRadius: PX.radius.pill,
          background: PX.neutral500,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {/* Figma V35 — Small Icon "tag" (For sale badge, filled diamant) */}
        <PxFigmaIcon name="tag" size={14.857} color={PX.neutral100} />
      </span>
      {/* Text 16/Medium white tracking -0.48 */}
      <span
        style={{
          paddingTop: 2,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 500,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          textAlign: 'center',
          whiteSpace: 'nowrap',
        }}
      >
        For sale
      </span>
    </span>
  )
}

function BrowserSelect({ label }: { label: string }) {
  return (
    <div
      style={{
        width: 220,
        height: 52,
        minHeight: 48,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 6,
        paddingBottom: 6,
        background: PX.neutral200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          paddingTop: 2,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral500,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <PxFigmaIcon name="chevron-down" size={16} color={PX.neutral500} />
    </div>
  )
}

export default function PxListingsHero() {
  return (
    <section
      style={{
        paddingTop: 24,
        paddingLeft: 24,
        paddingRight: 24,
        background: PX.neutral200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        width: '100%',
        position: 'relative',
        zIndex: 3,
      }}
    >
      {/* Container dark : bg-neutral700, rounded-24, pt-120 pb-80, flex-col items-center.
          width 100% pour matcher la maquette w-1440 - 24*2 = 1392. */}
      <div
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 1392,
          margin: '0 auto',
          background: PX.neutral700,
          borderRadius: PX.radius.large,
          paddingTop: 120,
          paddingBottom: 80,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Title Wrapper : flex-col items-center justify-center */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ForSaleBadge />
          {/* Title wrap : pt-16 (Sections/PD Extra Small) */}
          <div
            style={{
              paddingTop: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <h1
              style={{
                margin: 0,
                width: 854.75,
                maxWidth: '100%',
                fontFamily: PX.font.display,
                fontSize: 72,
                fontWeight: 500,
                lineHeight: 1.15,
                letterSpacing: '-2.16px',
                color: PX.neutral100,
                textAlign: 'center',
              }}
            >
              Properties for sale
            </h1>
          </div>
        </div>

        {/* Paragraph wrap : pt-16 pb-32 (Sections/PD Extra Small + Sizes/Size 6),
            paragraphe 16/1.5 neutral400 w-562 h-48 tracking-0.48 center */}
        <div
          style={{
            paddingTop: 16,
            paddingBottom: 32,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
          }}
        >
          <p
            style={{
              margin: 0,
              width: 562.047,
              maxWidth: '100%',
              height: 48,
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
              textAlign: 'center',
            }}
          >
            Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
          </p>
        </div>

        {/* Browser : absolute -tx-1/2 left-50% top-383, bg-white p-24 rounded-48
            shadow-small, gap-2, items-center. Contient input pill + 3 selects.
            Source Figma node 9613:28455. */}
        <div
          style={{
            position: 'absolute',
            top: 383,
            left: '50%',
            transform: 'translateX(-50%)',
            background: PX.neutral100,
            padding: 24,
            borderRadius: 48,
            boxShadow: PX.shadow.small,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
          }}
        >
          {/* Input Text : w-400 h-52, bg-neutral200, rounded-l-pill (gauche
              arrondie), placeholder "Search for properties", search button 40px
              dark à droite (absolute right-6 top-50% size-40 bg-neutral700). */}
          <div
            style={{
              position: 'relative',
              width: 400,
              minHeight: 52,
              paddingLeft: 16,
              paddingRight: 6,
              paddingTop: 6,
              paddingBottom: 6,
              background: PX.neutral200,
              borderTopLeftRadius: PX.radius.pill,
              borderBottomLeftRadius: PX.radius.pill,
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                flex: '1 0 0',
                paddingTop: 2,
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
                whiteSpace: 'nowrap',
              }}
            >
              Search for properties
            </span>
            {/* Search button : absolute right-6 top-50% translate-y-50%, size-40
                bg-neutral700, rounded-pill, search icon size-22 white */}
            <button
              type="button"
              aria-label="Search"
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 40,
                height: 40,
                borderRadius: PX.radius.pill,
                background: PX.neutral700,
                border: 0,
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <PxFigmaIcon name="search" size={22} color={PX.neutral100} />
            </button>
          </div>
          <BrowserSelect label="Location" />
          <BrowserSelect label="Property" />
          {/* Dernier select : rounded-r-pill */}
          <div
            style={{
              width: 220,
              height: 52,
              minHeight: 48,
              paddingLeft: 16,
              paddingRight: 16,
              paddingTop: 6,
              paddingBottom: 6,
              background: PX.neutral200,
              borderTopRightRadius: PX.radius.pill,
              borderBottomRightRadius: PX.radius.pill,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                paddingTop: 2,
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
                whiteSpace: 'nowrap',
              }}
            >
              Type
            </span>
            <PxFigmaIcon name="chevron-down" size={16} color={PX.neutral500} />
          </div>
        </div>
      </div>
    </section>
  )
}
