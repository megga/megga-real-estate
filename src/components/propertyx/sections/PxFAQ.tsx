// MEGGA Marketplace — Property X "FAQs" section.
// Source : Figma node 9552:21493 (❓ FAQs page) — sous-frame
// "FAQs Section" (node 11783:16416). Texte EN fidèle au design Figma.
//
// Structure :
//   <section pt-64 pb-160 items-center>
//     <Top Content>
//       <Title pt-16 : 72px Medium neutral700 ls-2.16 — w-686>
//       <Paragraph pt-16 pb-32 : 16/1.5 neutral500 — w-562 h-48 centré>
//     </Top Content>
//     <Accordion Card : w-843 rounded-20 py-44 bg-white shadow-small gap-28>
//       <AccordionItem px-40 open=true>  ← 1re question ouverte
//       <Divider neutral300 1px>
//       <AccordionItem px-40>
//       <Divider />
//       <AccordionItem px-40>
//       <Divider />
//       <AccordionItem px-40>
//     </Accordion Card>
//   </section>

import { useState } from 'react'
import { PX, PxIcon } from '..'

interface Question {
  id: string
  title: string
  paragraph: string
}

// Textes EN fidèles au design Figma (4 questions, paragraphe Lorem ipsum
// uniquement sur la première — celle initialement ouverte).
const QUESTIONS: Question[] = [
  {
    id: 'post-house',
    title: 'How can I post my house for sale?',
    paragraph:
      'Lorem ipsum dolor sit amet consectetur et ullamcorper morbi lectus fermentum viverra malesuada consequat.',
  },
  {
    id: 'commission',
    title: 'What is your realtor sale commission?',
    paragraph:
      'Lorem ipsum dolor sit amet consectetur et ullamcorper morbi lectus fermentum viverra malesuada consequat.',
  },
  {
    id: 'house-type',
    title: 'Which type of house do you take for promoting?',
    paragraph:
      'Lorem ipsum dolor sit amet consectetur et ullamcorper morbi lectus fermentum viverra malesuada consequat.',
  },
  {
    id: 'time-to-sell',
    title: 'What’s the average time to sale a house?',
    paragraph:
      'Lorem ipsum dolor sit amet consectetur et ullamcorper morbi lectus fermentum viverra malesuada consequat.',
  },
]

function AccordionItem({
  q,
  open,
  onToggle,
}: {
  q: Question
  open: boolean
  onToggle: () => void
}) {
  return (
    <div
      style={{
        width: '100%',
        paddingLeft: 40,
        paddingRight: 40,
        display: 'flex',
        alignItems: open ? 'flex-start' : 'center',
        justifyContent: 'space-between',
        gap: 24,
      }}
    >
      {/* Content : title + (optional paragraph).
          Figma open  → w-580 gap-12 flex-col items-start (node 11805:13537)
          Figma closed → flex-1 max-w-580 min-w-px (node 11805:13545, juste le titre) */}
      <div
        style={
          open
            ? {
                width: 580,
                maxWidth: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                alignItems: 'flex-start',
              }
            : {
                flex: '1 0 0',
                maxWidth: 580,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
              }
        }
      >
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          style={{
            margin: 0,
            padding: 0,
            background: 'transparent',
            border: 0,
            cursor: 'pointer',
            textAlign: 'left',
            width: '100%',
            fontFamily: PX.font.display,
            fontSize: 24,
            fontWeight: 500,
            lineHeight: 1.25,
            letterSpacing: '-0.72px',
            color: PX.neutral700,
          }}
        >
          {q.title}
        </button>
        {open && (
          <p
            style={{
              margin: 0,
              width: '100%',
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
            }}
          >
            {q.paragraph}
          </p>
        )}
      </div>

      {/* Primary Circle Button 40px : Figma open (11805:13540) bg-neutral700
          + icon minus blanc / Figma closed (11805:13547) pas de bg + shadow-small
          + icon plus noir. Le bouton fermé est "transparent" : il hérite
          visuellement du fond blanc de la card parent. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? 'Réduire' : 'Développer'}
        style={{
          width: 40,
          height: 40,
          flexShrink: 0,
          borderRadius: PX.radius.pill,
          background: open ? PX.neutral700 : 'transparent',
          border: 0,
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          boxShadow: open ? 'none' : PX.shadow.small,
        }}
      >
        <PxIcon
          name={open ? 'minus' : 'plus'}
          size={16}
          color={open ? PX.neutral100 : PX.neutral700}
          strokeWidth={2}
        />
      </button>
    </div>
  )
}

export default function PxFAQ() {
  // Première question ouverte par défaut (fidèle Figma : open={true}
  // sur l'item "How can I post my house for sale?").
  const [openId, setOpenId] = useState<string>(QUESTIONS[0]!.id)

  return (
    <section
      style={{
        width: '100%',
        paddingTop: 64,
        paddingBottom: 160,
        background: PX.neutral200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
      }}
    >
      {/* Top Content : titre + paragraphe, centrés */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {/* Title : pt-16 → 72/Medium tracking-2.16 neutral700 w-686 */}
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
              width: 686.25,
              maxWidth: '100%',
              fontFamily: PX.font.display,
              fontSize: 72,
              fontWeight: 500,
              lineHeight: 1.15,
              letterSpacing: '-2.16px',
              color: PX.neutral700,
              textAlign: 'center',
            }}
          >
            Frequently asked questions
          </h1>
        </div>

        {/* Paragraph : pt-16 pb-32, 16/1.5 neutral500 tracking-0.48 w-562 */}
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
              fontFamily: PX.font.display,
              fontSize: 16,
              fontWeight: 400,
              lineHeight: 1.5,
              letterSpacing: '-0.48px',
              color: PX.neutral500,
              textAlign: 'center',
            }}
          >
            Lorem ipsum dolor sit amet consectetur. Id eu mi ac ac aliquam etiam ultrices augue convallis nunc ultrices amet consequat adipiscing.
          </p>
        </div>
      </div>

      {/* Accordion Card : w-843, white bg, rounded-20, py-44, shadow-small,
          flex-col gap-28 items-start. Children flat (4 accordéons + 3 dividers
          alternés) — fidèle Figma node 11805:13718. */}
      <div
        style={{
          width: 843,
          maxWidth: 'calc(100% - 48px)',
          paddingTop: 44,
          paddingBottom: 44,
          background: PX.neutral100,
          borderRadius: 20,
          boxShadow: PX.shadow.small,
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
          alignItems: 'flex-start',
        }}
      >
        {QUESTIONS.flatMap((q, idx) => {
          const item = (
            <AccordionItem
              key={q.id}
              q={q}
              open={openId === q.id}
              onToggle={() => setOpenId(openId === q.id ? '' : q.id)}
            />
          )
          if (idx === QUESTIONS.length - 1) return [item]
          return [
            item,
            <div
              key={`${q.id}-divider`}
              style={{
                height: 1,
                width: '100%',
                background: PX.neutral300,
                flexShrink: 0,
              }}
            />,
          ]
        })}
      </div>
    </section>
  )
}
