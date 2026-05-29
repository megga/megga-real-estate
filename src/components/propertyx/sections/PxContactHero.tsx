// MEGGA Marketplace — Property X "Contact V1 — Hero" section.
// Source visuelle : Figma node 11756:33917.
//
// Anatomie :
// - Section padding-top 24, padding-x 24 (page bg blanc)
// - Container DARK : bg-neutral700 #14161C, rounded 24, py-120, h-994
//   - Top Content centered (562 wide) : Title H1 72px + paragraph 16/1.5 neutral400
//   - Content row (gap 64) :
//     - LEFT Form (660 wide) : white card rounded-24 p-48 avec form 3 lignes
//       Grid Form 1 : Full name | Email address (2 cols 270×78)
//       Grid Form 2 : Phone number | Subject
//       Message : textarea 564×104 rounded-8
//       Consent LPD + Button "Send message" pill dark + arrow circle
//     - RIGHT Content (422 wide) :
//       - "Reach us directly" 30px white medium
//       - Email + Phone (Info Wrapper × 2)
//       - Divider + Follow us (4 social icons)
//
// Différences avec le Figma de base :
//   - Contenu en français + données MEGGA réelles (configurables via props)
//   - Form contrôlé + soumis au hook useCreateContactMessage
//   - Champ "Sujet" optionnel, label "Votre message" pour le textarea
//   - Consent LPD obligatoire (art. 6 LPD CH)
//   - Honeypot anti-bot (champ caché "website")
//   - État succès in-place (remplace le form)

import { useState, type FormEvent } from 'react'
import { PX, PxFigmaIcon, PxSocialIcon, PxWhatsAppButton } from '..'
import { useCreateContactMessage } from '@/hooks/useContactMessage'

interface PxContactHeroProps {
  /** Texte principal H1 — défaut FR. */
  title?: string
  /** Sous-titre sous le H1 — défaut FR. */
  subtitle?: string
  /** Email visible côté "Reach us directly". */
  contactEmail?: string
  /** Téléphone visible côté "Reach us directly". Ignoré si `whatsapp` est fourni. */
  contactPhone?: string
  /** Bouton WhatsApp (remplace le téléphone). `phone` au format international. */
  whatsapp?: { phone: string; message?: string } | null
  /** Liens sociaux (passe `null` pour cacher la section entière). */
  socials?: {
    facebook?: string
    twitter?: string
    instagram?: string
    linkedin?: string
  } | null
  /** Texte d'intro du bloc "Reach us directly". */
  contactIntro?: string
  /** Origine du form pour l'analytique (par défaut : 'contact_page'). */
  source?: string
}

const DEFAULTS = {
  title: 'Parlons de votre projet',
  subtitle:
    'Acheter, louer, vendre ou faire estimer : notre équipe MEGGA vous répond personnellement sous 24 heures ouvrées.',
  contactEmail: 'contact@megga.ch',
  contactPhone: '+41 22 000 00 00',
  contactIntro:
    'Une question rapide, un dossier complexe, ou simplement envie d’échanger ? Vous pouvez aussi nous joindre directement.',
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

function FormInput({
  iconName,
  placeholder,
  value,
  onChange,
  type = 'text',
  required,
  autoComplete,
  ariaLabel,
}: {
  iconName: 'form-person' | 'form-mail' | 'form-phone' | 'badge-featured-star'
  placeholder: string
  value: string
  onChange: (v: string) => void
  type?: 'text' | 'email' | 'tel'
  required?: boolean
  autoComplete?: string
  ariaLabel: string
}) {
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
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        aria-label={ariaLabel}
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

function ContactInfo({ icon, label, value, href }: {
  icon: 'form-mail' | 'form-phone'
  label: string
  value: string
  href: string
}) {
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
        <a
          href={href}
          style={{
            fontFamily: PX.font.sans,
            fontWeight: 500,
            fontSize: 16,
            lineHeight: 1.25,
            letterSpacing: '-0.48px',
            color: PX.neutral400,
            whiteSpace: 'nowrap',
            textDecoration: 'none',
          }}
          onMouseEnter={(e) => { (e.target as HTMLAnchorElement).style.color = PX.neutral100 }}
          onMouseLeave={(e) => { (e.target as HTMLAnchorElement).style.color = PX.neutral400 }}
        >
          {value}
        </a>
      </div>
    </div>
  )
}

export default function PxContactHero(props: PxContactHeroProps = {}) {
  const {
    title = DEFAULTS.title,
    subtitle = DEFAULTS.subtitle,
    contactEmail = DEFAULTS.contactEmail,
    contactPhone = DEFAULTS.contactPhone,
    contactIntro = DEFAULTS.contactIntro,
    socials = {} as PxContactHeroProps['socials'],
    source = 'contact_page',
    whatsapp = null,
  } = props

  const create = useCreateContactMessage()

  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: '',
    subject: '',
    message: '',
    consent: false,
    /** Honeypot : un bot va remplir ça, on rejette si non-vide. */
    website: '',
  })
  const [sent, setSent] = useState(false)

  const canSubmit =
    form.name.trim().length >= 2 &&
    /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email.trim()) &&
    form.message.trim().length >= 10 &&
    form.consent &&
    !create.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    // Honeypot — silently drop
    if (form.website.trim().length > 0) {
      setSent(true)
      return
    }
    try {
      await create.mutateAsync({
        name: form.name,
        email: form.email,
        phone: form.phone || undefined,
        subject: form.subject || undefined,
        message: form.message,
        consentPrivacy: form.consent,
        source,
      })
      setSent(true)
    } catch {
      // L'erreur est rendue plus bas via create.isError
    }
  }

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
        minHeight: 994,
        paddingTop: 120,
        paddingBottom: 120,
        paddingLeft: 24,
        paddingRight: 24,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        boxSizing: 'border-box',
      }}>
        {/* Top Content */}
        <div style={{
          width: 720,
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
            lineHeight: 1.05,
            letterSpacing: '-2.16px',
            color: PX.neutral100,
            textAlign: 'center',
          }}>
            {title}
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
              maxWidth: 562,
            }}>
              {subtitle}
            </p>
          </div>
        </div>

        {/* Content row : Form + Right Content */}
        <div style={{ display: 'flex', gap: 64, alignItems: 'flex-start', maxWidth: '100%' }}>
          {/* LEFT : Form Card */}
          {sent ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                width: 660,
                background: PX.neutral100,
                borderRadius: PX.radius.large,
                boxShadow: PX.shadow.small,
                padding: 48,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxSizing: 'border-box',
                alignItems: 'flex-start',
                flexShrink: 0,
              }}
            >
              <div style={{
                width: 48,
                height: 48,
                borderRadius: PX.radius.pill,
                background: '#E6F4EC',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F8A4A" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <h2 style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 500,
                fontSize: 30,
                lineHeight: 1.2,
                letterSpacing: '-0.9px',
                color: PX.neutral700,
              }}>
                Message bien reçu.
              </h2>
              <p style={{
                margin: 0,
                fontFamily: PX.font.sans,
                fontWeight: 400,
                fontSize: 16,
                lineHeight: 1.5,
                letterSpacing: '-0.48px',
                color: PX.neutral500,
              }}>
                Un membre de l’équipe MEGGA vous répondra par email sous 24&nbsp;heures ouvrées.
                Une copie vient d’être envoyée à <strong style={{ color: PX.neutral700 }}>{form.email}</strong>.
              </p>
            </div>
          ) : (
            <form
              onSubmit={handleSubmit}
              noValidate
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
              {/* Honeypot — invisible aux humains, visible aux bots. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm(f => ({ ...f, website: e.target.value }))}
                aria-hidden="true"
                style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
              />

              {/* Grid Form 1 : Nom complet | Email */}
              <div style={{ display: 'flex', gap: 24, width: '100%' }}>
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FormLabel>Nom complet</FormLabel>
                  <FormInput
                    iconName="form-person"
                    placeholder="Prénom Nom"
                    value={form.name}
                    onChange={(v) => setForm(f => ({ ...f, name: v }))}
                    required
                    autoComplete="name"
                    ariaLabel="Nom complet"
                  />
                </div>
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FormLabel>Email</FormLabel>
                  <FormInput
                    iconName="form-mail"
                    placeholder="vous@exemple.ch"
                    value={form.email}
                    onChange={(v) => setForm(f => ({ ...f, email: v }))}
                    type="email"
                    required
                    autoComplete="email"
                    ariaLabel="Adresse email"
                  />
                </div>
              </div>

              {/* Grid Form 2 : Téléphone (optionnel) | Sujet (optionnel) */}
              <div style={{ display: 'flex', gap: 24, width: '100%' }}>
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FormLabel>Téléphone (optionnel)</FormLabel>
                  <FormInput
                    iconName="form-phone"
                    placeholder="+41 79 000 00 00"
                    value={form.phone}
                    onChange={(v) => setForm(f => ({ ...f, phone: v }))}
                    type="tel"
                    autoComplete="tel"
                    ariaLabel="Téléphone"
                  />
                </div>
                <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <FormLabel>Sujet (optionnel)</FormLabel>
                  <FormInput
                    iconName="badge-featured-star"
                    placeholder="ex. Vente d’un appartement à Genève"
                    value={form.subject}
                    onChange={(v) => setForm(f => ({ ...f, subject: v }))}
                    ariaLabel="Sujet"
                  />
                </div>
              </div>

              {/* Message Textarea */}
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
                <FormLabel>Votre message</FormLabel>
                <div style={{
                  background: PX.neutral200,
                  borderRadius: PX.radius.tiny,
                  padding: 16,
                  height: 120,
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 6,
                  boxSizing: 'border-box',
                }}>
                  <span style={{ paddingTop: 2, color: PX.neutral500, flexShrink: 0 }}>
                    <PxFigmaIcon name="form-edit" size={14} color={PX.neutral500} />
                  </span>
                  <textarea
                    value={form.message}
                    onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))}
                    placeholder="Dites-nous ce que nous pouvons faire pour vous…"
                    required
                    aria-label="Votre message"
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
                      lineHeight: 1.5,
                      letterSpacing: '-0.42px',
                      color: PX.neutral700,
                      paddingTop: 2,
                    }}
                  />
                </div>
              </div>

              {/* Consent LPD art. 6 */}
              <label style={{
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
                cursor: 'pointer',
                fontFamily: PX.font.sans,
                fontSize: 13,
                lineHeight: 1.5,
                letterSpacing: '-0.39px',
                color: PX.neutral500,
              }}>
                <input
                  type="checkbox"
                  checked={form.consent}
                  onChange={(e) => setForm(f => ({ ...f, consent: e.target.checked }))}
                  required
                  aria-label="Consentement au traitement des données"
                  style={{ marginTop: 3, width: 16, height: 16, accentColor: PX.neutral700, flexShrink: 0 }}
                />
                <span>
                  J’accepte que MEGGA traite mes données pour répondre à ma demande, conformément à la{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: PX.neutral700, textDecoration: 'underline' }}>
                    politique de confidentialité
                  </a>.
                </span>
              </label>

              {/* Error inline */}
              {create.isError && (
                <p style={{
                  margin: 0,
                  color: '#C42121',
                  fontSize: 13,
                  fontFamily: PX.font.sans,
                }}>
                  L’envoi a échoué. Réessayez ou écrivez-nous directement à{' '}
                  <a href={`mailto:${contactEmail}`} style={{ color: '#C42121' }}>{contactEmail}</a>.
                </p>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={!canSubmit}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  paddingLeft: 16,
                  paddingRight: 10,
                  paddingTop: 10,
                  paddingBottom: 10,
                  background: canSubmit ? PX.neutral700 : PX.neutral500,
                  color: PX.neutral100,
                  border: 0,
                  borderRadius: PX.radius.pill,
                  cursor: canSubmit ? 'pointer' : 'not-allowed',
                  fontFamily: PX.font.sans,
                  fontWeight: 500,
                  fontSize: 16,
                  lineHeight: 1.25,
                  letterSpacing: '-0.48px',
                  transition: 'background 120ms',
                }}
              >
                <span style={{ paddingTop: 2 }}>
                  {create.isPending ? 'Envoi…' : 'Envoyer mon message'}
                </span>
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
          )}

          {/* RIGHT : Reach us directly */}
          <div style={{
            width: 422,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            flexShrink: 0,
            paddingTop: 16,
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
              Nous joindre directement
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
                {contactIntro}
              </p>
            </div>

            <div style={{ display: 'flex', gap: 32, paddingBottom: 24, flexWrap: 'wrap' }}>
              <ContactInfo icon="form-mail" label="Email" value={contactEmail} href={`mailto:${contactEmail}`} />
              {!whatsapp && contactPhone && (
                <ContactInfo icon="form-phone" label="Téléphone" value={contactPhone} href={`tel:${contactPhone.replace(/\s+/g, '')}`} />
              )}
            </div>

            {/* Bouton WhatsApp — amorce de conversation côté visiteur (lien wa.me). */}
            {whatsapp && (
              <div style={{ paddingBottom: 24 }}>
                <PxWhatsAppButton
                  phone={whatsapp.phone}
                  message={whatsapp.message ?? 'Bonjour MEGGA, '}
                  variant="brand"
                />
                <p style={{
                  margin: '10px 0 0',
                  fontFamily: PX.font.sans,
                  fontWeight: 400,
                  fontSize: 13,
                  lineHeight: 1.4,
                  letterSpacing: '-0.39px',
                  color: PX.neutral400,
                }}>
                  Réponse sous 24&nbsp;heures ouvrées.
                </p>
              </div>
            )}

            {socials !== null && (
              <>
                <div style={{ height: 1, width: '100%', background: 'rgba(255,255,255,0.10)' }} />

                <div style={{ paddingTop: 24, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', width: '100%' }}>
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
                    Suivez-nous
                  </p>
                  <div style={{ paddingTop: 12 }}>
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
                      Marché immobilier suisse, nouvelles annonces et conseils LAB/KYC.
                    </p>
                  </div>

                  <div style={{ display: 'flex', gap: 16, color: PX.neutral100, paddingTop: 16 }}>
                    {socials?.facebook && (
                      <a href={socials.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" style={{ color: 'inherit', display: 'inline-flex' }}>
                        <PxSocialIcon name="facebook" size={16} color="mono" />
                      </a>
                    )}
                    {socials?.twitter && (
                      <a href={socials.twitter} target="_blank" rel="noopener noreferrer" aria-label="X (Twitter)" style={{ color: 'inherit', display: 'inline-flex' }}>
                        <PxSocialIcon name="twitter" size={16} color="mono" />
                      </a>
                    )}
                    {socials?.instagram && (
                      <a href={socials.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" style={{ color: 'inherit', display: 'inline-flex' }}>
                        <PxSocialIcon name="instagram" size={16} color="mono" />
                      </a>
                    )}
                    {socials?.linkedin && (
                      <a href={socials.linkedin} target="_blank" rel="noopener noreferrer" aria-label="LinkedIn" style={{ color: 'inherit', display: 'inline-flex' }}>
                        <PxSocialIcon name="linkedin" size={16} color="mono" />
                      </a>
                    )}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
