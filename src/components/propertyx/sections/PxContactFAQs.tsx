// MEGGA Marketplace — Property X "Contact V1 — FAQs" section.
// Source : Figma node 11774:16850 — code Figma EXACT.
//
// Anatomie :
// - Section py-80 centered, h=819
// - Top Content : Badge "FAQs" + H2 "Frequently asked questions" 48 + paragraph
// - Accordion 843×449 : bg-neutral100 rounded-20 shadow-small
//   - paddingTop 44 / paddingBottom 38 (Figma exact : wrapper at y=44 within accordion)
//   - 4 items, items have NO vertical padding (only paddingX 40)
//     - Item collapsed : title 30h + plus icon abs right (18.385 size)
//     - Item expanded : title 30 + 16 gap + answer 48 = 94h + minus dark button abs right (40×40)
//   - Spacing inter-items : 30+1+30 = 61 avec divider 1px neutral300 au centre
//
// Total accordion : 44 + 94 + 60 + 30 + 60 + 30 + 60 + 30 + 38 = 446 (≈ Figma 449)

import { Fragment, useState } from 'react'
import { PX, PxFigmaIcon } from '..'

interface FAQItem {
  question: string
  answer: string
}

const FAQS: FAQItem[] = [
  {
    question: 'How can I post my house for sale?',
    answer: 'Lorem ipsum dolor sit amet consectetur et ullamcorper morbi lectus fermentum viverra malesuada consequat.',
  },
  {
    question: 'What is your realtor sale commission?',
    answer: 'Lorem ipsum dolor sit amet consectetur et ullamcorper morbi lectus fermentum viverra malesuada consequat.',
  },
  {
    question: 'Which type of house do you take for promoting?',
    answer: 'Lorem ipsum dolor sit amet consectetur et ullamcorper morbi lectus fermentum viverra malesuada consequat.',
  },
  {
    question: "What's the average time to sale a house?",
    answer: 'Lorem ipsum dolor sit amet consectetur et ullamcorper morbi lectus fermentum viverra malesuada consequat.',
  },
]

function FaqsBadge() {
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
        <PxFigmaIcon name="badge-faq" size={14.857} color={PX.neutral100} />
      </span>
      <span style={{
        fontFamily: PX.font.sans,
        fontWeight: 500,
        fontSize: 16,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
        paddingTop: 2,
      }}>
        FAQs
      </span>
    </span>
  )
}

function AccordionItem({ item, isOpen, onToggle }: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
}) {
  return (
    <div style={{
      paddingLeft: 40,
      paddingRight: 40,
      position: 'relative',
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: 'block',
          width: '100%',
          textAlign: 'left',
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
        }}
      >
        <h3 style={{
          margin: 0,
          fontFamily: PX.font.sans,
          fontWeight: 500,
          fontSize: 24,
          lineHeight: 1.25,
          letterSpacing: '-0.72px',
          color: PX.neutral700,
          paddingRight: 60,
        }}>
          {item.question}
        </h3>
        {isOpen && (
          <div style={{ paddingTop: 16 }}>
            <p style={{
              margin: 0,
              fontFamily: PX.font.sans,
              fontWeight: 400,
              fontSize: 16,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              maxWidth: 470,
            }}>
              {item.answer}
            </p>
          </div>
        )}
      </button>

      {/* Right-side icon/button — absolutely positioned so it doesn't add to item height */}
      <div style={{
        position: 'absolute',
        top: isOpen ? -5 : 6,  // Figma : minus button is 40h centered with title 30, so -5 ; plus icon 18 → roughly 6 to center on title
        right: 40,
        pointerEvents: 'none',
      }}>
        {isOpen ? (
          <span style={{
            width: 40,
            height: 40,
            borderRadius: PX.radius.pill,
            background: PX.neutral700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10" stroke={PX.neutral100} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          <span style={{
            display: 'inline-flex',
            color: PX.neutral700,
          }}>
            <PxFigmaIcon name="plus" size={18.385} color={PX.neutral700} />
          </span>
        )}
      </div>
    </div>
  )
}

export default function PxContactFAQs() {
  const [openIdx, setOpenIdx] = useState<number>(0)

  return (
    <section style={{
      paddingTop: 80,
      paddingBottom: 80,
      paddingLeft: 24,
      paddingRight: 24,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      background: PX.pageBg,
    }}>
      {/* Top Content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <FaqsBadge />
        <div style={{ paddingTop: 16 }}>
          <h2 style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 48,
            lineHeight: 1.25,
            letterSpacing: '-1.44px',
            color: PX.neutral700,
            textAlign: 'center',
            maxWidth: 686,
          }}>
            Frequently asked questions
          </h2>
        </div>
        <div style={{ paddingTop: 16, paddingBottom: 32 }}>
          <p style={{
            margin: 0,
            fontFamily: PX.font.sans,
            fontWeight: 400,
            fontSize: 16,
            lineHeight: 1.5,
            letterSpacing: '-0.48px',
            color: PX.neutral500,
            textAlign: 'center',
            maxWidth: 562,
          }}>
            Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis nunc ultrices amet consequat adipiscing.
          </p>
        </div>
      </div>

      {/* Accordion */}
      <div style={{
        background: PX.neutral100,
        width: 843,
        maxWidth: '100%',
        borderRadius: 20,
        boxShadow: PX.shadow.small,
        paddingTop: 44,
        paddingBottom: 38,
        boxSizing: 'border-box',
      }}>
        {FAQS.map((item, idx) => (
          <Fragment key={item.question}>
            <AccordionItem
              item={item}
              isOpen={openIdx === idx}
              onToggle={() => setOpenIdx(openIdx === idx ? -1 : idx)}
            />
            {idx < FAQS.length - 1 && (
              <div style={{ paddingTop: 30, paddingBottom: 30 }}>
                <hr style={{
                  height: 1,
                  width: '100%',
                  background: PX.neutral300,
                  border: 0,
                  margin: 0,
                }} />
              </div>
            )}
          </Fragment>
        ))}
      </div>
    </section>
  )
}
