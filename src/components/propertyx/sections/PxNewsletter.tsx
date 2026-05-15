// MEGGA Marketplace — Property X "Newsletter / Suscribe" section.
// Source : Figma node 9552:21500 — code Figma EXACT (texte, dimensions, position).
//
// Structure fidèle :
//   <section bg-neutral100 pt-80 pb-224>
//     <Container w-1200, flex items-start justify-between>
//       <Images Wrapper w-549.605 h-635.803>
//         [lifestyle photo + iPhone mockup composite — rendu Figma 1 PNG]
//       <Right Content pt-120>
//         <Badge "Newsletter" : bg-neutral300 + cercle neutral400 + pencil icon>
//         <Title "Subscribe to our newsletter today" 48 Display/8 w-412>
//         <Paragraph 16/1.5 neutral500 w-422>
//         <Button Row : email input pill w-380 avec Subscribe button nested>
//
// L'iPhone et la photo lifestyle sont rendus en un seul PNG (composite Figma)
// — même approche que PxExploreCTA pour l'iPad : fidélité pixel-perfect garantie
// sans recréer le contenu mobile en React.

import { useState, type FormEvent } from 'react'
import { PX, PxFigmaIcon } from '..'

// Badge "Newsletter" — LIGHT : bg-neutral300 + cercle bg-neutral400 + icône pencil
function NewsletterBadge() {
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
      }}>Newsletter</span>
    </span>
  )
}

// Arrow icon (chevron right rotated to point right — match PxButton DefaultArrow)
function ArrowRight({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6h7M6.5 2.5L10 6l-3.5 3.5"
        stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function PxNewsletter() {
  const [email, setEmail] = useState('')

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    // TODO : brancher sur la table newsletter_subscribers (Supabase)
  }

  return (
    <section id="newsletter" style={{
      paddingTop: 80,
      paddingBottom: 224,
      paddingLeft: 24,
      paddingRight: 24,
      background: PX.neutral100,
    }}>
      <div style={{
        maxWidth: 1200,
        margin: '0 auto',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 40,
      }}>
        {/* Images Wrapper : Figma w-549.605 h-635.803, iPhone overflows to the right.
            Composite PNG (lifestyle photo + iPhone bezel + screen content) rendu
            depuis Figma 9552:21500 → 1 image = pixel-perfect maquette. */}
        <div style={{
          position: 'relative',
          width: 549.605,
          height: 635.803,
          flexShrink: 0,
        }}>
          <img
            src="/images/sections/newsletter/person-iphone.png"
            alt="MEGGA mobile app preview"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              // L'iPhone déborde de la box wrapper sur la droite (+163px env)
              // — le PNG capture la box totale 713×785, on l'aligne sur left:0
              // et on autorise l'overflow.
              width: 713,
              height: 785,
              maxWidth: 'none',
              objectFit: 'contain',
              pointerEvents: 'none',
            }}
          />
          {/* Overlay : remplace le logo "Property X" du mockup iPhone par
              le wordmark MEGGA. Position trouvée par scan pixel du PNG :
              "Property X" (icon + texte) se trouve à (388, 132), taille ~80×15. */}
          <div style={{
            position: 'absolute',
            left: 386,
            top: 130,
            width: 86,
            height: 17,
            background: '#FFFFFF',
            display: 'flex',
            alignItems: 'center',
            paddingLeft: 1,
          }}>
            <svg
              viewBox="0 0 1920 419"
              height={13}
              width={Math.round(13 * (1920 / 419))}
              aria-label="MEGGA"
              style={{ display: 'block' }}
            >
              <polygon fill={PX.neutral700} points="92 0 237.62 219.08 384 0 475 0 475.31 63.04 363.87 229.77 237.7 418.79 104.93 220.12 104.62 419 0 419 0 0 92 0"/>
              <polygon fill={PX.neutral700} points="826 0 826.06 94.73 622.1 94.74 621.94 167.65 791.33 167.66 791.33 251.37 622.01 251.37 621.99 324.3 826.05 324.29 825.97 419 517.35 419 517 0 826 0"/>
              <path fill={PX.neutral700} d="M1052,0c46.64,5.38,88.55,22.94,122.21,59.67-22.79,28.12-37.71,60.3-47.08,96.28-7.89-14.68-16.56-27.02-28.35-37.25-40.39-35.04-99.55-30.53-134.81,9.66-40.25,45.89-40.1,117.16.48,162.82,35.48,39.93,94.73,44.05,134.83,8.67,14.5-12.89,25.12-28.95,32.24-48.42l-95.26-.1-.03-83.65,192.78-.02c8.8,28.23,5.09,73.7-2.86,101.4-22.71,79.15-85.98,140.1-169.06,149-2.17.23-4.11.34-5.1.93h-31c-42.03-4.33-81.34-20.79-113.04-49.92-96.69-88.85-90.73-249.43,12.42-329.58,29.62-23.01,64.08-35.58,100.62-39.5h31Z"/>
              <path fill={PX.neutral700} d="M1732,0l188,418.23v.77h-104.98l-42.28-94.7h-124.31s-42.38,94.7-42.38,94.7h-104.22c.24-1.34.57-2.95,1.41-4.82L1690,0h42ZM1739.67,250.92l-29.06-64.46-29.15,64.86,58.21-.39Z"/>
              <path fill={PX.neutral700} d="M1351,419h-29c-47.56,0-91.35-24.53-123.87-60,24.65-30.5,36.53-57.89,47.2-96.18,7.43,14.3,16.5,27.51,28.71,37.93,36.96,31.55,90.34,30.86,126.22-1.89,13.97-12.75,24.27-28.48,31.18-47.43l-94.84-.08-.05-83.65,192.4-.03c2.59,9.14,3.94,17.82,4.5,27.2,4.34,72.2-25.1,142.48-83.13,186.34-29.43,22.24-63.45,34.03-99.32,37.8Z"/>
              <path fill={PX.neutral700} d="M1351,0c43.2,4.34,82.78,21.02,114.61,50.52,6.43,5.96,12.05,11.43,17.39,19.2l-56.72,84.95c-7.57-14.34-16.16-25.96-27.71-36.03-33.9-29.56-83.44-31.58-119.35-4.39-12.97,9.71-22.64,21.92-30.74,35.77l-101.14-.14c10.87-40.77,32.85-75.32,63.12-102.25,31.59-28.19,70.35-43.46,111.55-47.62h29Z"/>
              <polygon fill={PX.neutral700} points="475.11 419 370.91 419 370.69 251.26 475.21 95.29 475.11 419"/>
            </svg>
          </div>
        </div>

        {/* Right Content : Figma w-422 pt-120 (sections/pd-extra-large) */}
        <div style={{
          width: 422,
          flexShrink: 0,
          paddingTop: 120,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
        }}>
          {/* Top Content : Badge + Title */}
          <NewsletterBadge />

          {/* Title : pt-16, 48 Display/8/Medium tracking-1.44, w-412 */}
          <h2 style={{
            margin: 0,
            marginTop: 16,
            width: 412,
            fontFamily: PX.font.display,
            fontSize: 48,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
          }}>
            Subscribe to our newsletter today
          </h2>

          {/* Bottom Content : Paragraph + Form (pt-16 / pt-24) */}
          <p style={{
            margin: 0,
            marginTop: 16,
            width: 422,
            fontFamily: PX.font.display,
            fontSize: 16,
            fontWeight: 400,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
          }}>
            Lorem ipsum dolor sit amet consectetur. Gravida elementum dolor semper
            felis pulvinar feugiat risus adipiscing dictum. Ultricies nec elementum
            nisi ut. Cras diam odio sed auctor pellentesque. Sit nisl ipsum.
          </p>

          {/* Buttom Row : pt-24 — email input pill avec Subscribe button nested */}
          <form
            onSubmit={handleSubmit}
            style={{
              marginTop: 24,
              width: 380,
            }}>
            <div style={{
              background: PX.neutral300,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              minHeight: 52,
              paddingLeft: 16,
              paddingRight: 6,
              paddingTop: 6,
              paddingBottom: 6,
              borderRadius: PX.radius.pill,
              width: '100%',
              boxSizing: 'border-box',
            }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email address"
                required
                style={{
                  flex: '1 0 0',
                  minWidth: 0,
                  background: 'transparent',
                  border: 0,
                  outline: 'none',
                  fontFamily: PX.font.display,
                  fontSize: 16,
                  fontWeight: 400,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  color: PX.neutral700,
                  paddingTop: 2,
                }}
              />
              <button
                type="submit"
                style={{
                  background: PX.neutral700,
                  color: PX.neutral100,
                  border: 0,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  paddingLeft: 16,
                  paddingRight: 6,
                  paddingTop: 6,
                  paddingBottom: 6,
                  borderRadius: PX.radius.pill,
                  flexShrink: 0,
                  fontFamily: PX.font.display,
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  whiteSpace: 'nowrap',
                  transition: `transform ${PX.duration.fast} ${PX.ease}`,
                }}>
                <span style={{ paddingTop: 2, display: 'inline-block' }}>Subscribe</span>
                <span style={{
                  width: 28,
                  height: 28,
                  borderRadius: PX.radius.pill,
                  background: PX.neutral100,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <ArrowRight color={PX.neutral700} />
                </span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
