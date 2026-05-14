// MEGGA Marketplace — Property X "Contact V1 — Hero" section.
// Source : Figma node 11756:33917 — code Figma EXACT.
//
// Anatomie :
// - Section padding-top 24, padding-x 24 (page bg blanc)
// - Container DARK : bg-neutral700 #14161C, rounded 24, py-120, h-994
//   - Top Content centered (562 wide) : Title H1 72px "Contact us" white + paragraph 16/1.5 neutral400
//   - Content row (gap 64) :
//     - LEFT Form (660 wide) : white card rounded-24 p-48 avec form 3 lignes
//       Grid Form 1 : Full name | Email address (2 cols 270×78)
//       Grid Form 2 : Phone number | Subject
//       Message : textarea 564×104 rounded-8
//       Button "Send message" pill dark + arrow circle
//     - RIGHT Content (422 wide) :
//       - "Reach us directly" 30px white medium
//       - Paragraph 16/1.5 neutral400
//       - Contact Wrapper : Email + Phone (Info Wrapper × 2)
//       - Divider
//       - "Follow us on social media" 20 medium + paragraph
//       - 4 social media icons (Facebook, Twitter, Instagram, LinkedIn)

import { PX, PxFigmaIcon, PxSocialIcon } from '..'

function FormInput({ iconName, placeholder }: { iconName: 'form-person' | 'form-mail' | 'form-phone' | 'badge-featured-star'; placeholder: string }) {
  return (
    <div style={{
      background: PX.neutral200,
      borderRadius: PX.radius.pill,
      minHeight: 48,
      width: '100%',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      paddingLeft: 16,
      paddingRight: 6,
      paddingTop: 6,
      paddingBottom: 6,
      boxSizing: 'border-box',
    }}>
      <PxFigmaIcon name={iconName} size={16} color={PX.neutral500} />
      <input
        type="text"
        placeholder={placeholder}
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 0,
          outline: 'none',
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral700,
          paddingTop: 2,
        }}
      />
    </div>
  )
}

function FormLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{
      margin: 0,
      fontFamily: PX.font.sans,
      fontWeight: 500,
      fontSize: 16,
      lineHeight: 1.25,
      letterSpacing: '-0.48px',
      color: PX.neutral700,
      whiteSpace: 'nowrap',
    }}>{children}</p>
  )
}

function ContactInfo({ icon, label, value }: { icon: 'form-mail' | 'form-phone'; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
      <span style={{ paddingTop: 2, flexShrink: 0, color: PX.neutral100 }}>
        <PxFigmaIcon name={icon} size={16} color={PX.neutral100} />
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 2 }}>
        <span style={{
          fontFamily: PX.font.sans,
          fontWeight: 400,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral100,
          whiteSpace: 'nowrap',
        }}>
          {label}
        </span>
        <span style={{
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 16,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          color: PX.neutral400,
          whiteSpace: 'nowrap',
        }}>
          {value}
        </span>
      </div>
    </div>
  )
}

export default function PxContactHero() {
  return (
    <section style={{
      paddingTop: 24,
      paddingLeft: 24,
      paddingRight: 24,
      paddingBottom: 0,
      background: PX.pageBg,
    }}>
      <div style={{
        background: PX.neutral700,
        borderRadius: PX.radius.large,
        paddingTop: 120,
        paddingBottom: 120,
        paddingLeft: 24,
        paddingRight: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        boxSizing: 'border-box',
      }}>
        {/* Top Content */}
        <div style={{
          width: 562,
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}>
          <h1 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 72,
            lineHeight: 1.15,
            letterSpacing: '-2.16px',
            color: PX.neutral100,
            whiteSpace: 'nowrap',
          }}>
            Contact us
          </h1>
          <div style={{ paddingTop: 16, paddingBottom: 48 }}>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral400,
              textAlign: 'center',
            }}>
              Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
            </p>
          </div>
        </div>

        {/* Content row : Form + Right Content */}
        <div style={{ display: 'flex', gap: 64, alignItems: 'center', maxWidth: '100%' }}>
          {/* LEFT : Form Card */}
          <form
            onSubmit={(e) => e.preventDefault()}
            style={{
              width: 660,
              background: PX.neutral100,
              borderRadius: PX.radius.large,
              boxShadow: PX.shadow.small,
              padding: 48,
              display: 'flex',
              flexDirection: 'column',
              gap: 24,
              boxSizing: 'border-box',
              alignItems: 'flex-start',
              flexShrink: 0,
            }}
          >
            {/* Grid Form 1 : Full name | Email address */}
            <div style={{ display: 'flex', gap: 24, width: '100%' }}>
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FormLabel>Full name</FormLabel>
                <FormInput iconName="form-person" placeholder="Full name" />
              </div>
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FormLabel>Email address</FormLabel>
                <FormInput iconName="form-mail" placeholder="example@yourmeail.com" />
              </div>
            </div>

            {/* Grid Form 2 : Phone number | Subject */}
            <div style={{ display: 'flex', gap: 24, width: '100%' }}>
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FormLabel>Phone number</FormLabel>
                <FormInput iconName="form-phone" placeholder="(123) 456 - 7890" />
              </div>
              <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FormLabel>Subject</FormLabel>
                <FormInput iconName="badge-featured-star" placeholder="ex. Support" />
              </div>
            </div>

            {/* Message Textarea */}
            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <FormLabel>Listing short description</FormLabel>
              <div style={{
                background: PX.neutral200,
                borderRadius: PX.radius.tiny,
                padding: 16,
                height: 104,
                display: 'flex',
                alignItems: 'flex-start',
                gap: 6,
                boxSizing: 'border-box',
              }}>
                <span style={{ paddingTop: 2, color: PX.neutral500, flexShrink: 0 }}>
                  <PxFigmaIcon name="form-edit" size={14} color={PX.neutral500} />
                </span>
                <textarea
                  placeholder="Write your message here..."
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: 'transparent',
                    border: 0,
                    outline: 'none',
                    resize: 'none',
                    width: '100%',
                    height: '100%',
                    fontFamily: PX.font.sans,
                    fontWeight: 400,
                    fontSize: 14,
                    lineHeight: 1.25,
                    letterSpacing: '-0.42px',
                    color: PX.neutral700,
                    paddingTop: 2,
                  }}
                />
              </div>
            </div>

            {/* Submit button */}
            <button
              type="submit"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                paddingLeft: 16,
                paddingRight: 10,
                paddingTop: 10,
                paddingBottom: 10,
                background: PX.neutral700,
                color: PX.neutral100,
                border: 0,
                borderRadius: PX.radius.pill,
                cursor: 'pointer',
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 16,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
              }}
            >
              <span style={{ paddingTop: 2 }}>Send message</span>
              <span style={{
                width: 28,
                height: 28,
                borderRadius: PX.radius.pill,
                background: PX.neutral100,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <PxFigmaIcon name="arrow-right" size={12} color={PX.neutral700} />
              </span>
            </button>
          </form>

          {/* RIGHT : Reach us directly */}
          <div style={{
            width: 422,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            flexShrink: 0,
          }}>
            <h2 style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 500,
              fontSize: 30,
              lineHeight: 1.25,
              letterSpacing: '-0.9px',
              color: PX.neutral100,
              whiteSpace: 'nowrap',
            }}>
              Reach us directly
            </h2>
            <div style={{ paddingTop: 16, paddingBottom: 24 }}>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral400,
                width: 422,
                maxWidth: '100%',
              }}>
                Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc tellus. Non a massa maecenas massa.
              </p>
            </div>

            {/* Contact Wrapper */}
            <div style={{ display: 'flex', gap: 20, paddingBottom: 24 }}>
              <ContactInfo icon="form-mail" label="Email address" value="contact@property.com" />
              <ContactInfo icon="form-phone" label="Phone number" value="(414) 325 - 427" />
            </div>

            {/* Divider */}
            <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.10)' }} />

            {/* Follow us */}
            <div style={{ paddingTop: 24, paddingBottom: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 20,
                lineHeight: 1.25,
                letterSpacing: '-0.6px',
                color: PX.neutral100,
                whiteSpace: 'nowrap',
              }}>
                Follow us on social media
              </p>
              <div style={{ paddingTop: 16 }}>
                <p style={{
                  margin: 0,
                  fontFamily: PX.font.sans,
                  fontWeight: 400,
                  fontSize: 16,
                  lineHeight: 1.5,
                  letterSpacing: '-0.48px',
                  color: PX.neutral400,
                  width: 422,
                  maxWidth: '100%',
                }}>
                  Lorem ipsum dolor sit amet consectetur. Sit ut gravida aenean potenti. Metus in eu vel morbi dui nunc.
                </p>
              </div>
            </div>

            {/* Social Media icons row — gap 16, all white via currentColor */}
            <div style={{ display: 'flex', gap: 16, color: PX.neutral100 }}>
              <PxSocialIcon name="facebook" size={16} color="mono" />
              <PxSocialIcon name="twitter" size={16} color="mono" />
              <PxSocialIcon name="instagram" size={16} color="mono" />
              <PxSocialIcon name="linkedin" size={16} color="mono" />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
