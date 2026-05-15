// MEGGA Marketplace — Property X "Submit Property" form (3 cards).
// Source : Figma node 9552:21463 sous-frame "Form" (11781:18235).
//
// Layout fidèle :
//   <Form section : bg white, py-0>
//     <Forms Wrapper : w-676 mx-auto margin-top: -205 (overlap hero)>
//       <Form Wrapper 1 : white card 676×352, header "1. Client information"
//                         + form (Full name + Email | Phone)>
//       <Form Wrapper 2 : white card 676×454, header "2. Property information"
//                         + form (Listing title | Property type + Listing type
//                         | Location + Address)>
//       <Form Wrapper 3 : white card 676×1092, pas de header — form complet
//                         (Listing price + Bedrooms | Bathrooms + Parking |
//                         Construction sqft + Land sqft | Short desc |
//                         Long desc | Amenities checkboxes | Listing images
//                         | Submit button)>
//     </Forms Wrapper>
//   </Form section>

import { useState, type ReactNode } from 'react'
import { PX, PxFigmaIcon, PxButton } from '..'

// ─── Sub-component : FormCard (676 wide, rounded-24, border, shadow) ────
function FormCard({
  headerIcon,
  headerTitle,
  hasHeader = true,
  children,
}: {
  headerIcon?: ReactNode
  headerTitle?: string
  hasHeader?: boolean
  children: ReactNode
}) {
  return (
    <div style={{
      width: 676,
      background: PX.neutral100,
      borderRadius: PX.radius.large,
      // Pas de border : le shadow + le contraste suffisent. Figma metadata
      // donne 352/454/1092 sans border (sinon +2px sur W et H).
      boxShadow: PX.shadow.small,
      overflow: 'hidden',
    }}>
      {hasHeader && (
        <>
          {/* Header : 676×76, flex items-center, pl-48 gap-10.
              Le divider Figma est un vector line à y=0 du divider frame
              (height 0.0000591 → 0 px de layout). On le rend via
              border-bottom 1px du header, box-sizing: border-box, pour ne
              PAS ajouter 1px à la hauteur totale du card. */}
          <div style={{
            height: 76,
            boxSizing: 'border-box',
            borderBottom: `1px solid ${PX.neutral300}`,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingLeft: 48,
            paddingRight: 48,
          }}>
            {/* Icon V1 : circle 28×28, bg neutral400 (Figma : neutrals-400 #A4A6B0), icon 16 blanc */}
            <div style={{
              width: 28,
              height: 28,
              borderRadius: PX.radius.pill,
              background: PX.neutral400,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}>
              {headerIcon}
            </div>
            {/* Button Text : 192×25 — Display/4/Medium 20/500/1.25/-0.6 neutral700 */}
            <span style={{
              fontFamily: PX.font.display,
              fontSize: 20,
              fontWeight: 500,
              lineHeight: 1.25,
              letterSpacing: '-0.6px',
              color: PX.neutral700,
            }}>
              {headerTitle}
            </span>
          </div>
        </>
      )}
      {/* Form content : padding 48 */}
      <div style={{
        padding: 48,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}>
        {children}
      </div>
    </div>
  )
}

// ─── Sub-component : FormField (Text label + Input/Select/TextArea) ─────
function FormField({
  label,
  width,
  children,
}: {
  label: string
  width?: number | string
  children: ReactNode
}) {
  return (
    <div style={{
      width,
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      flexShrink: 0,
    }}>
      {/* Label : 16/Medium neutral700 lh-1.25 ls-0.48 */}
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 500,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: PX.neutral700,
      }}>
        {label}
      </span>
      {children}
    </div>
  )
}

// ─── Sub-component : Input pill ─────────────────────────────────────────
function FormInput({
  icon,
  placeholder,
  type = 'text',
}: {
  icon?: ReactNode
  placeholder: string
  type?: string
}) {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: PX.neutral200,
      borderRadius: PX.radius.pill,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 6,
      paddingBottom: 6,
      minHeight: 48,
      width: '100%',
    }}>
      {icon && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: PX.neutral400,
          flexShrink: 0,
          width: 16,
          height: 16,
        }}>
          {icon}
        </span>
      )}
      <input
        type={type}
        placeholder={placeholder}
        className="px-sp-input"
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: PX.neutral700,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          paddingTop: 2,
        }}
      />
    </div>
  )
}

// ─── Sub-component : Select pill ─────────────────────────────────────────
function FormSelect({
  icon,
  placeholder,
  options,
}: {
  icon?: ReactNode
  placeholder: string
  options: string[]
}) {
  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: 6,
      background: PX.neutral200,
      borderRadius: PX.radius.pill,
      paddingLeft: 16,
      paddingRight: 14,
      paddingTop: 6,
      paddingBottom: 6,
      minHeight: 48,
      width: '100%',
    }}>
      {icon && (
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: PX.neutral400,
          flexShrink: 0,
          width: 16,
          height: 16,
        }}>
          {icon}
        </span>
      )}
      <select
        defaultValue=""
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          border: 0,
          outline: 'none',
          color: PX.neutral500,
          fontFamily: PX.font.display,
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.25,
          letterSpacing: '-0.48px',
          paddingTop: 2,
          paddingRight: 20,
          cursor: 'pointer',
          appearance: 'none',
          WebkitAppearance: 'none',
        }}>
        <option value="" disabled>{placeholder}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {/* Chevron down absolu à droite */}
      <span style={{
        position: 'absolute',
        right: 14,
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
        display: 'flex',
      }}>
        <PxFigmaIcon name="chevron-down" size={14} color={PX.neutral400} />
      </span>
    </div>
  )
}

// ─── Sub-component : TextArea (radius 8, bg neutral200, p-16) ──────────
// Figma : icône pencil (V30) 14px en haut à gauche, puis placeholder à côté.
function FormTextArea({ placeholder }: { placeholder: string }) {
  return (
    <div style={{
      position: 'relative',
      width: '100%',
      background: PX.neutral200,
      borderRadius: PX.radius.tiny,
    }}>
      {/* Icon : pencil 14px, top 18 left 16 */}
      <span style={{
        position: 'absolute',
        top: 18,
        left: 16,
        display: 'inline-flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        color: PX.neutral400,
        width: 14,
        height: 14,
        pointerEvents: 'none',
      }}>
        <PxFigmaIcon name="form-edit" size={14} color={PX.neutral400} />
      </span>
      <textarea
        placeholder={placeholder}
        className="px-sp-textarea"
        style={{
          width: '100%',
          height: 104,
          background: 'transparent',
          borderRadius: PX.radius.tiny,
          paddingTop: 16,
          paddingBottom: 16,
          paddingLeft: 38, // 16 (gauche) + 14 (icon) + 8 (gap)
          paddingRight: 16,
          border: 0,
          outline: 'none',
          resize: 'vertical',
          color: PX.neutral700,
          fontFamily: PX.font.display,
          fontSize: 14,
          fontWeight: 400,
          lineHeight: 1.5,
          letterSpacing: '-0.42px',
          display: 'block',
        }}
      />
    </div>
  )
}

// ─── Sub-component : Checkbox (Figma : 18×18 circle + label 16/Regular) ─
// Source Figma : node 11781:18073..18081.
// - Box : 18×18, rounded-pill (cercle), bg-neutral300 unchecked / bg-neutral700 checked
// - Label : 16px Objectivity Regular, color neutral500 unchecked / neutral700 checked
// - Gap entre box et label : 6px
function FormCheckbox({ label, defaultChecked = false }: { label: string; defaultChecked?: boolean }) {
  const [checked, setChecked] = useState(defaultChecked)
  return (
    <label style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 6,
      cursor: 'pointer',
      whiteSpace: 'nowrap',
    }}>
      <span style={{
        position: 'relative',
        width: 18,
        height: 18,
        borderRadius: PX.radius.pill,
        background: checked ? PX.neutral700 : PX.neutral300,
        boxShadow: checked ? 'none' : '0 1px 1.5px rgba(25,33,61,0.10)',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {checked && (
          <svg width="10" height="9" viewBox="0 0 14.6135 12.4382" fill="none" style={{ display: 'block' }}>
            <path
              d="M3.5 5.76294L5.67529 7.93823L11.1135 2.5"
              stroke={PX.neutral100}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
        <input
          type="checkbox"
          checked={checked}
          onChange={e => setChecked(e.target.checked)}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer', margin: 0 }}
        />
      </span>
      <span style={{
        fontFamily: PX.font.display,
        fontSize: 16,
        fontWeight: 400,
        lineHeight: 1.25,
        letterSpacing: '-0.48px',
        color: checked ? PX.neutral700 : PX.neutral500,
      }}>
        {label}
      </span>
    </label>
  )
}

// ─── Amenities : 3 colonnes × 3 rows (lecture row-major) ────────────────
// Visuel Figma : Garden|Security cameras|Laundry / Pool|Garage|Jacuzzi /
// Elevator|Dish washer|Internet
// Default checked dans Figma : Garden, Garage, Dish washer, Laundry, Internet
type Amenity = { name: string; defaultChecked: boolean }
const AMENITIES_COL_1: Amenity[] = [
  { name: 'Garden', defaultChecked: true },
  { name: 'Pool', defaultChecked: false },
  { name: 'Elevator', defaultChecked: false },
]
const AMENITIES_COL_2: Amenity[] = [
  { name: 'Security cameras', defaultChecked: false },
  { name: 'Garage', defaultChecked: true },
  { name: 'Dish washer', defaultChecked: true },
]
const AMENITIES_COL_3: Amenity[] = [
  { name: 'Laundry', defaultChecked: true },
  { name: 'Jacuzzi', defaultChecked: false },
  { name: 'Internet', defaultChecked: true },
]

// ─── Main component ─────────────────────────────────────────────────────
export default function PxSubmitPropertyForm() {
  return (
    <section style={{
      width: '100%',
      // Pas de bg : la section est transparente pour laisser le hero
      // dark visible dans la zone d'overlap (205px). Le page bg (white)
      // gère la suite.
      position: 'relative',
      zIndex: 2,
    }}>
      {/* Placeholder color fidèle Figma : neutral500 #464851
          + Submit button width 240 (PxButton uses style={} qu'on override via class) */}
      <style>{`
        .px-sp-input::placeholder,
        .px-sp-textarea::placeholder { color: ${PX.neutral500}; opacity: 1; }
        .px-sp-submit-button { width: 240px !important; justify-content: center; }
      `}</style>

      {/* Forms Wrapper : w-676, centré, margin-top: -205 (overlap hero).
          padding-bottom: 160 pour matcher l'espace vide entre Forms Wrapper
          et Footer V1 dans la maquette Figma (Form Section h=1901, Forms
          Wrapper h=1946 à y=-205 → 1901 - (1946-205) = 160). */}
      <div style={{
        width: 676,
        maxWidth: '100%',
        margin: '0 auto',
        marginTop: -205,
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
        paddingBottom: 160,
      }}>
        {/* ─── Form Wrapper 1 : Client information ──────────────────── */}
        <FormCard
          headerTitle="1. Client information"
          headerIcon={<PxFigmaIcon name="form-person" size={14} color={PX.neutral100} />}
        >
          {/* Grid Form : 2 cols of 278×78, gap 24 */}
          <div style={{
            display: 'flex',
            gap: 24,
            width: 580,
          }}>
            <FormField label="Full name" width={278}>
              <FormInput
                icon={<PxFigmaIcon name="form-person" size={16} color={PX.neutral400} />}
                placeholder="Full name"
              />
            </FormField>
            <FormField label="Email address" width={278}>
              <FormInput
                icon={<PxFigmaIcon name="form-mail" size={16} color={PX.neutral400} />}
                placeholder="example@yourmeail.com"
                type="email"
              />
            </FormField>
          </div>
          {/* Phone number : w-282 */}
          <FormField label="Phone number" width={282}>
            <FormInput
              icon={<PxFigmaIcon name="form-phone" size={16} color={PX.neutral400} />}
              placeholder="(123) 456 - 7890"
              type="tel"
            />
          </FormField>
        </FormCard>

        {/* ─── Form Wrapper 2 : Property information ────────────────── */}
        <FormCard
          headerTitle="2. Property information"
          headerIcon={<PxFigmaIcon name="home-poi" size={14} color={PX.neutral100} />}
        >
          {/* Listing title : 1 col w-580 — Figma : icône house (V36) */}
          <FormField label="Listing title" width={580}>
            <FormInput
              icon={<PxFigmaIcon name="home-poi" size={16} color={PX.neutral400} />}
              placeholder="Full name"
            />
          </FormField>
          {/* Grid Form : Property type + Listing type */}
          <div style={{ display: 'flex', gap: 24, width: 580 }}>
            <FormField label="Property type" width={278}>
              <FormSelect
                icon={<PxFigmaIcon name="tag" size={16} color={PX.neutral400} />}
                placeholder="Select"
                options={['Apartment', 'House', 'Villa', 'Commercial', 'Office', 'Parking', 'Storage', 'Land']}
              />
            </FormField>
            {/* Listing type : Figma utilise pencil (V30), pas key */}
            <FormField label="Listing type" width={278}>
              <FormSelect
                icon={<PxFigmaIcon name="form-edit" size={14} color={PX.neutral400} />}
                placeholder="Select"
                options={['For sale', 'For rent']}
              />
            </FormField>
          </div>
          {/* Grid Form : Location + Address */}
          <div style={{ display: 'flex', gap: 24, width: 580 }}>
            <FormField label="Location" width={278}>
              <FormInput
                icon={<PxFigmaIcon name="location" size={16} color={PX.neutral400} />}
                placeholder="ex. Los Angeles"
              />
            </FormField>
            <FormField label="Address" width={278}>
              <FormInput
                icon={<PxFigmaIcon name="location" size={16} color={PX.neutral400} />}
                placeholder="8706 Herrick Ave, Valley..."
              />
            </FormField>
          </div>
        </FormCard>

        {/* ─── Form Wrapper 3 : property details (pas de header) ───── */}
        <FormCard hasHeader={false}>
          {/* Grid Form : Listing price + Bedrooms — Figma : icône currency (V55) */}
          <div style={{ display: 'flex', gap: 24, width: 580 }}>
            <FormField label="Listing price" width={278}>
              <FormInput
                icon={<PxFigmaIcon name="currency" size={16} color={PX.neutral400} />}
                placeholder="ex. $10,000"
              />
            </FormField>
            <FormField label="Bedrooms" width={278}>
              <FormSelect
                icon={<PxFigmaIcon name="bed" size={16} color={PX.neutral400} />}
                placeholder="Select"
                options={['1', '2', '3', '4', '5', '6+']}
              />
            </FormField>
          </div>
          {/* Grid Form : Bathrooms + Parking lots */}
          <div style={{ display: 'flex', gap: 24, width: 580 }}>
            <FormField label="Bathrooms" width={278}>
              <FormSelect
                icon={<PxFigmaIcon name="bath" size={16} color={PX.neutral400} />}
                placeholder="Select"
                options={['1', '2', '3', '4', '5+']}
              />
            </FormField>
            <FormField label="Parking lots" width={278}>
              <FormSelect
                icon={<PxFigmaIcon name="parking" size={16} color={PX.neutral400} />}
                placeholder="Select"
                options={['0', '1', '2', '3', '4+']}
              />
            </FormField>
          </div>
          {/* Grid Form : Construction sqft + Land sqft */}
          <div style={{ display: 'flex', gap: 24, width: 580 }}>
            <FormField label="Construction sqft" width={278}>
              <FormInput
                icon={<PxFigmaIcon name="surface" size={16} color={PX.neutral400} />}
                placeholder="ex. 4,795 sqtf"
              />
            </FormField>
            <FormField label="Land sqft" width={278}>
              <FormInput
                icon={<PxFigmaIcon name="surface" size={16} color={PX.neutral400} />}
                placeholder="ex. 8,213 sqtf"
              />
            </FormField>
          </div>
          {/* Listing short description */}
          <FormField label="Listing short description" width={580}>
            <FormTextArea placeholder="Please ensure up than 240 characters" />
          </FormField>
          {/* Listing long description */}
          <FormField label="Listing long description" width={580}>
            <FormTextArea placeholder="Please ensure up than 4000 characters" />
          </FormField>

          {/* Bottom Content : Property amenities + Listing images + Submit */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 32,
            width: 580,
          }}>
            {/* Property amenities : Message + 3-cols Checkbox Grid.
                Figma : gap-16 entre label et grid, py-8 sur le wrapper. */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              paddingTop: 8,
              paddingBottom: 8,
            }}>
              {/* Message : "Property amenities" 16/Medium neutral700 */}
              <span style={{
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral700,
              }}>
                Property amenities
              </span>
              {/* Checkbox Grid : 3 cols content-sized, justify-between, gap-16 vertical.
                  Figma : pas de largeur fixe sur les colonnes — elles ont une
                  largeur dictée par le contenu (le texte le plus long de chaque col). */}
              <div style={{
                display: 'flex',
                width: '100%',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
              }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
                  {AMENITIES_COL_1.map(a => (
                    <FormCheckbox key={a.name} label={a.name} defaultChecked={a.defaultChecked} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
                  {AMENITIES_COL_2.map(a => (
                    <FormCheckbox key={a.name} label={a.name} defaultChecked={a.defaultChecked} />
                  ))}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flexShrink: 0 }}>
                  {AMENITIES_COL_3.map(a => (
                    <FormCheckbox key={a.name} label={a.name} defaultChecked={a.defaultChecked} />
                  ))}
                </div>
              </div>
            </div>

            {/* Listing images wrapper : Text 113 + Paragraph 480 + Input 580 */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              {/* Text : "Listing images" 16/Medium */}
              <span style={{
                fontFamily: PX.font.display,
                fontSize: 16,
                fontWeight: 500,
                lineHeight: 1.25,
                letterSpacing: '-0.48px',
                color: PX.neutral700,
              }}>
                Listing images
              </span>
              {/* Paragraph Default : "Please share..." 14/Regular neutral500 lh-1.25 ls-0.42 */}
              <span style={{
                fontFamily: PX.font.display,
                fontSize: 14,
                fontWeight: 400,
                lineHeight: 1.25,
                letterSpacing: '-0.42px',
                color: PX.neutral500,
              }}>
                Please share a Google Drive or Imgur link of your listing images
              </span>
              {/* Input Text 580×48 — Figma : icône link (V55) */}
              <FormInput
                icon={<PxFigmaIcon name="link" size={16} color={PX.neutral400} />}
                placeholder="ex. drive.google.com/..."
              />
            </div>

            {/* Submit button : Primary Button 240×48 dark, aligné start */}
            <div style={{ alignSelf: 'flex-start' }}>
              <PxButton variant="primary" size="lg" type="submit" className="px-sp-submit-button">
                Submit for approval
              </PxButton>
            </div>
          </div>
        </FormCard>
      </div>
    </section>
  )
}
