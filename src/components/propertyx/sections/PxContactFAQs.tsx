// MEGGA Marketplace — Property X "Contact V1 — FAQs" section.
// Source : Figma node 11774:16850 — code Figma EXACT.
//
// Anatomie :
// - Section py-80 centered
// - Top Content : Badge "FAQs" + H2 "Frequently asked questions" + paragraph
// - Accordion 843×449 : bg-neutral100 rounded-20 shadow-small
//   - 4 items : title 24 medium + chevron/plus/minus circle button
//   - Item 1 expanded : title + paragraph + minus circle dark button
//   - Items 2-4 collapsed : title + plus icon

import { useState } from 'react'
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

function AccordionItem({ item, isOpen, onToggle, isLast }: {
  item: FAQItem
  isOpen: boolean
  onToggle: () => void
  isLast: boolean
}) {
  return (
    <div style={{
      padding: '24px 40px',
      borderBottom: isLast ? 'none' : `1px solid ${PX.neutral300}`,
    }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%',
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 24,
          textAlign: 'left',
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
          flex: 1,
        }}>
          {item.question}
        </h3>
        {isOpen ? (
          <span style={{
            width: 40,
            height: 40,
            borderRadius: PX.radius.pill,
            background: PX.neutral700,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}>
            {/* Minus icon */}
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8h10" stroke={PX.neutral100} strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </span>
        ) : (
          <span style={{
            width: 40,
            height: 40,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: PX.neutral700,
          }}>
            <PxFigmaIcon name="plus" size={18.385} color={PX.neutral700} />
          </span>
        )}
      </button>
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
        overflow: 'hidden',
      }}>
        {FAQS.map((item, idx) => (
          <AccordionItem
            key={item.question}
            item={item}
            isOpen={openIdx === idx}
            onToggle={() => setOpenIdx(openIdx === idx ? -1 : idx)}
            isLast={idx === FAQS.length - 1}
          />
        ))}
      </div>
    </section>
  )
}
