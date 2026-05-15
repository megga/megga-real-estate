// MEGGA Marketplace — Property X "Blog Post — Rich Text body" section.
// Source : Figma node 9636:19127 — code Figma EXACT.
//
// Anatomie :
// - Section py-120, Rich Text 689 wide centered
// - Structure article :
//   1. H1 48 medium 1.15 (Display 8 — note Figma uses Display/8 for H1 of article, 60 for hero)
//   2. pt-16 + Paragraph 16/1.5 neutral500
//   3. pt-16 + H2 36 medium 1.25 (Display 7)
//   4. pt-16 + Paragraph
//   5. pt-16 + List 4 bullets (ml-32)
//   6. pt-16 + Paragraph
//   7. py-32 + Image 689×345 rounded-24
//   8. pt-16 + Paragraph
//   9. pt-16 + H3 24 medium (Display 5)
//   10. pt-16 + Paragraph
//   11. py-32 + Testimonial : bento dark p-48 rounded-24 + quote 24 white center italic
//   12. pt-16 + Paragraph
//   13. pt-16 + H4 20 (Display 4)
//   14. pt-16 + Paragraph 14/1.5 (Paragraph/Small)
//   15. pt-16 + List 4 bullets
//   16. pt-32 + H5 18 (Display 3)
//   17. pt-16 + Paragraph 14
//   18. pt-16 + H5 14 (Display 1/Medium)
//   19. pt-16 + Paragraph 14

import { PX } from '..'

function Bullet() {
  return <span style={{
    width: 5, height: 5,
    borderRadius: '50%',
    background: PX.neutral700,
    display: 'inline-block',
    flexShrink: 0,
  }} />
}

function BulletItem({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <Bullet />
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
      }}>
        {children}
      </span>
    </div>
  )
}

const para = (size = 16, color = PX.neutral500): React.CSSProperties => ({
  margin: 0,
  fontFamily: PX.font.sans,
  fontWeight: 400,
  fontSize: size,
  lineHeight: 1.5,
  letterSpacing: size === 14 ? '-0.42px' : '-0.48px',
  color,
})

export default function PxBlogPostBody() {
  return (
    <section style={{
      paddingTop: 120,
      paddingBottom: 120,
      paddingLeft: 24,
      paddingRight: 24,
      minHeight: 2677,  // Figma exact (rich text section height)
      display: 'flex',
      justifyContent: 'center',
      background: PX.pageBg,
      boxSizing: 'border-box',
    }}>
      <article style={{
        width: 689,
        maxWidth: '100%',
        minHeight: 2437,  // Figma exact (rich text inner content height)
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
      }}>
        {/* 1. H1 article */}
        <div style={{ paddingBottom: 6, width: '100%' }}>
          <h1 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 48,
            lineHeight: 1.15,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
          }}>
            Home inspections 101: Ensuring a wise investment
          </h1>
        </div>

        {/* 2. Paragraph */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <p style={para()}>
            Venenatis sollicitudin posuere elit consequat et enim. Neque tortor amet dictum tempor. Leo facilisis aliquet viverra scelerisque eleifend viverra est. At massa erat vel amet enim laoreet dictum pellentesque. Urna cursus quam pulvinar tellus. Duis fermentum nibh volutpat morbi. Et ac sed ultricies ut nunc sodales lectus. Ultricies pharetra mauris eget pellentesque accumsan tincidunt. Orci hendrerit cursus est.
          </p>
        </div>

        {/* 3. H2 */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 36,
            lineHeight: 1.25,
            letterSpacing: '-1.08px',
            color: PX.neutral700,
          }}>
            Negotiating like a pro: strategies for first-time buyers
          </h2>
        </div>

        {/* 4. Paragraph */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <p style={para()}>
            Et urna ac et maecenas fusce amet. Nibh nec commodo massa sed. Tincidunt porttitor in pharetra egestas sit neque ac lacus. Amet a nunc et cum. Odio at volutpat volutpat in leo eget ipsum diam elementum. Erat magna arcu orci lorem senectus orci fringilla. Tincidunt metus nisl vitae maecenas pretium aliquet. At id pharetra in vestibulum lectus pellentesque venenatis molestie. Nibh ut facilisis.
          </p>
        </div>

        {/* 5. List 4 bullets */}
        <div style={{ paddingTop: 16, paddingLeft: 32, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BulletItem>Morbi fringilla molestie magna sed dictum. Praesent pharetra turpis augue.</BulletItem>
          <BulletItem>Cras mi purus, viverra vitae felis sit amet, tincidunt fringilla lorem.</BulletItem>
          <BulletItem>Non mattis urna ex nec sem. Donec varius diam et suscipit venenati proin tincidunt.</BulletItem>
          <BulletItem>Quisque euismod posuere lacus sit amet volutpat. Praesent vel imperdiet.</BulletItem>
        </div>

        {/* 6. Paragraph */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <p style={para()}>
            Quis faucibus massa sit egestas. Sit fermentum est ac pulvinar et sagittis sed sit ut. Quis faucibus aenean nibh vestibulum enim mi sit. Sollicitudin ultrices ultrices in ipsum urna fringilla massa leo. Sapien ultricies vitae rhoncus molestie purus. Urna urna dolor euismod porttitor et. Magna adipiscing dictum et adipiscing mollis feugiat. Est ac ultrices varius volutpat nibh purus placerat. Sapien morbi sed sit non habitant turpis dignissim. Facilisis vitae massa justo neque.
          </p>
        </div>

        {/* 7. Image */}
        <div style={{ paddingTop: 32, paddingBottom: 32, width: '100%' }}>
          <div style={{
            width: '100%',
            height: 345,
            borderRadius: PX.radius.large,
            overflow: 'hidden',
          }}>
            <img
              src="/images/sections/blog-post/body-bathroom.jpg"
              alt="Bathroom inspection"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          </div>
        </div>

        {/* 8. Paragraph */}
        <div style={{ width: '100%' }}>
          <p style={para()}>
            Quis faucibus massa sit egestas. Sit fermentum est ac pulvinar et sagittis sed sit ut. Quis faucibus aenean nibh vestibulum enim mi sit. Sollicitudin ultrices ultrices in ipsum urna fringilla massa leo. Sapien ultricies vitae rhoncus molestie purus. Urna urna dolor euismod porttitor et. Magna adipiscing dictum et adipiscing mollis feugiat. Est ac ultrices varius volutpat nibh purus placerat. Sapien morbi sed sit non habitant turpis dignissim. Facilisis vitae massa justo neque.
          </p>
        </div>

        {/* 9. H3 */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <h3 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 24,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
          }}>
            Mortgage matters: Demystifying the loan process
          </h3>
        </div>

        {/* 10. Paragraph */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <p style={para()}>
            Cursus curabitur euismod vel fermentum sapien non dolor odio vel. Tortor lectus mauris in praesent a tincidunt nam. In aenean odio aliquet pretium viverra elit quis magna. Eget ut risus posuere velit purus nisi nec sollicitudin. Tellus enim interdum neque sit vestibulum lacus. Nam pulvinar a lectus justo aliquet integer amet.
          </p>
        </div>

        {/* 11. Testimonial blockquote */}
        <div style={{
          paddingTop: 32,
          paddingBottom: 32,
          width: '100%',
        }}>
          <blockquote style={{
            margin: 0,
            background: PX.neutral700,
            borderRadius: PX.radius.large,
            padding: 48,
            boxShadow: PX.shadow.regular,
          }}>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 24,
              lineHeight: 1.25,
              letterSpacing: '-0.72px',
              color: PX.neutral100,
              textAlign: 'center',
            }}>
              &ldquo;Sed id mi eget urna facilisis pharetra. Nunc viverra est at magna maximus consectetur. Sed nec maximus augue. Aliquam commodo sem eu.&rdquo;
            </p>
          </blockquote>
        </div>

        {/* 12. Paragraph */}
        <div style={{ width: '100%' }}>
          <p style={para()}>
            Cursus curabitur euismod vel fermentum sapien non dolor odio vel. Tortor lectus mauris in praesent a tincidunt nam. In aenean odio aliquet pretium viverra elit quis magna. Eget ut risus posuere velit purus nisi nec sollicitudin. Tellus enim interdum neque sit vestibulum lacus. Nam pulvinar a lectus justo aliquet integer amet.
          </p>
        </div>

        {/* 13. H4 */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <h4 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 20,
            lineHeight: 1.25,
            letterSpacing: '-0.6px',
            color: PX.neutral700,
          }}>
            Post-purchase success: Settling into your new home
          </h4>
        </div>

        {/* 14. Paragraph 14 */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <p style={para(14)}>
            Sed non quis tellus velit orci. Quam sed mauris elementum tempor viverra. Luctus semper risus ipsum id diam praesent. Pretium eget mauris ultrices curabitur sed sem amet. Erat nulla habitant in mattis massa mi adipiscing ullamcorper condimentum. Erat quisque integer tincidunt ac amet tempor vulputate tristique. Venenatis neque odio a nulla iaculis euismod etiam.
          </p>
        </div>

        {/* 15. List 4 bullets */}
        <div style={{ paddingTop: 16, paddingLeft: 32, width: '100%', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <BulletItem>Morbi fringilla molestie magna sed dictum. Praesent pharetra turpis augue.</BulletItem>
          <BulletItem>Cras mi purus, viverra vitae felis sit amet, tincidunt fringilla lorem.</BulletItem>
          <BulletItem>Non mattis urna ex nec sem. Donec varius diam et suscipit venenati proin tincidunt.</BulletItem>
          <BulletItem>Quisque euismod posuere lacus sit amet volutpat. Praesent vel imperdiet.</BulletItem>
        </div>

        {/* 16. H5 (18) */}
        <div style={{ paddingTop: 32, width: '100%' }}>
          <h5 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 18,
            lineHeight: 1.25,
            letterSpacing: '-0.54px',
            color: PX.neutral700,
          }}>
            Closing the deal: Final steps in your homebuying journey
          </h5>
        </div>

        {/* 17. Paragraph 14 */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <p style={para(14)}>
            Sed non quis tellus velit orci. Quam sed mauris elementum tempor viverra. Luctus semper risus ipsum id diam praesent. Pretium eget mauris ultrices curabitur sed sem amet. Erat nulla habitant in mattis massa mi adipiscing ullamcorper condimentum. Erat quisque integer tincidunt ac amet tempor vulputate tristique. Venenatis neque odio a nulla iaculis euismod etiam.
          </p>
        </div>

        {/* 18. H5 (14) */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <h5 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 14,
            lineHeight: 1.25,
            letterSpacing: '-0.42px',
            color: PX.neutral700,
          }}>
            Understanding the basics: A primer for first-time homebuyers
          </h5>
        </div>

        {/* 19. Paragraph 14 */}
        <div style={{ paddingTop: 16, width: '100%' }}>
          <p style={para(14)}>
            Sed non quis tellus velit orci. Quam sed mauris elementum tempor viverra. Luctus semper risus ipsum id diam praesent. Pretium eget mauris ultrices curabitur sed sem amet. Erat nulla habitant in mattis massa mi adipiscing ullamcorper condimentum. Erat quisque integer tincidunt ac amet tempor vulputate tristique. Venenatis neque odio a nulla iaculis euismod etiam.
          </p>
        </div>
      </article>
    </section>
  )
}
