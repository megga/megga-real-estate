// MEGGA — Dark footer (port 1:1 du proto megga-footer.jsx).
// Newsletter strip + 5-col grid (brand + Product + Pro + Company + Contact)
// + bottom legal bar avec Swiss Made Software badge.

import { type ReactNode, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'

const FT_BG = '#0A0F1A'
const FT_PANEL = '#141B2A'
const FT_BORDER = 'rgba(255,255,255,0.10)'
const FT_BORDER_STRONG = 'rgba(255,255,255,0.18)'
const FT_TEXT = '#F0F2F8'
const FT_DIM = 'rgba(240,242,248,0.55)'
const FT_DIMMER = 'rgba(240,242,248,0.35)'
const FT_GREEN = '#0041D9' // MEGGA blue brand
const FT_INK = '#0E1410'
const FONT = '"Manrope", system-ui, -apple-system, sans-serif'

function StarIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none" style={{ flexShrink: 0 }}>
      <path
        d="M6 0.5 L7.4 4.3 L11.5 4.6 L8.3 7.1 L9.3 11 L6 8.9 L2.7 11 L3.7 7.1 L0.5 4.6 L4.6 4.3 Z"
        fill={FT_GREEN}
        stroke={FT_GREEN}
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
    </svg>
  )
}

interface FooterLinkProps {
  to?: string
  children: ReactNode
  badge?: string
}

function FooterLink({ to = '#', children, badge }: FooterLinkProps) {
  return (
    <Link
      to={to}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        fontFamily: FONT,
        fontSize: 13,
        fontWeight: 500,
        color: FT_DIM,
        textDecoration: 'none',
        transition: 'color 0.15s ease',
        lineHeight: 1.6,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = FT_TEXT
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = FT_DIM
      }}
    >
      {children}
      {badge && (
        <span
          style={{
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: 0.6,
            textTransform: 'uppercase',
            color: FT_GREEN,
            padding: '2px 6px',
            borderRadius: 4,
            background: 'rgba(0, 65, 217, 0.15)',
          }}
        >
          {badge}
        </span>
      )}
    </Link>
  )
}

interface FooterColumnProps {
  title: string
  children: ReactNode
}

function FooterColumn({ title, children }: FooterColumnProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <h4
        style={{
          margin: 0,
          fontFamily: FONT,
          fontSize: 11,
          fontWeight: 600,
          color: FT_TEXT,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
        }}
      >
        {title}
      </h4>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

interface SocialLinkProps {
  children: ReactNode
  label: string
  href?: string
}

function SocialLink({ children, label, href = '#' }: SocialLinkProps) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: 999,
        border: `1px solid ${FT_BORDER_STRONG}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: FT_DIM,
        transition: 'all 0.15s ease',
        textDecoration: 'none',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.color = FT_INK
        e.currentTarget.style.background = FT_GREEN
        e.currentTarget.style.borderColor = FT_GREEN
      }}
      onMouseLeave={e => {
        e.currentTarget.style.color = FT_DIM
        e.currentTarget.style.background = 'transparent'
        e.currentTarget.style.borderColor = FT_BORDER_STRONG
      }}
    >
      {children}
    </a>
  )
}

function NewsletterPanel() {
  const [email, setEmail] = useState('')
  return (
    <div
      style={{
        background: FT_PANEL,
        border: `1px solid ${FT_BORDER}`,
        borderRadius: 20,
        padding: '32px 36px',
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)',
        gap: 40,
        alignItems: 'center',
      }}
    >
      <div>
        <h3
          style={{
            margin: 0,
            fontFamily: FONT,
            fontSize: 'clamp(20px, 2.5vw, 26px)',
            fontWeight: 700,
            color: FT_TEXT,
            lineHeight: 1.15,
            letterSpacing: -0.6,
          }}
        >
          Restez informé du marché suisse.
        </h3>
        <p
          style={{
            margin: '10px 0 0',
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 400,
            color: FT_DIM,
            lineHeight: 1.55,
            maxWidth: 420,
          }}
        >
          Tendances mensuelles, alertes prix par canton, nouvelles règles
          juridiques · 2 emails par mois, jamais de spam.
        </p>
      </div>
      <div>
        <form
          onSubmit={e => {
            e.preventDefault()
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 0,
            background: FT_BG,
            border: `1px solid ${FT_BORDER_STRONG}`,
            borderRadius: 999,
            padding: 6,
          }}
        >
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="vous@exemple.ch"
            style={{
              flex: 1,
              minWidth: 0,
              height: 40,
              padding: '0 18px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontFamily: FONT,
              fontSize: 14,
              color: FT_TEXT,
            }}
          />
          <button
            type="submit"
            style={{
              height: 40,
              padding: '0 22px',
              borderRadius: 999,
              border: 'none',
              background: FT_GREEN,
              color: '#fff',
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              whiteSpace: 'nowrap',
            }}
          >
            S’abonner
            <span>→</span>
          </button>
        </form>
        <div
          style={{
            marginTop: 12,
            fontFamily: FONT,
            fontSize: 11,
            color: FT_DIMMER,
          }}
        >
          En vous abonnant, vous acceptez la politique de confidentialité.
        </div>
      </div>
    </div>
  )
}

export default function FooterMega() {
  const { i18n } = useTranslation()
  const lang = i18n.language?.slice(0, 2) || 'fr'

  return (
    <footer
      style={{
        background: FT_BG,
        color: FT_TEXT,
        padding: '80px clamp(20px, 5vw, 80px) 32px',
      }}
    >
      <NewsletterPanel />

      <div
        style={{
          marginTop: 64,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr)',
          gap: 60,
        }}
      >
        {/* Brand */}
        <div>
          <div
            style={{
              fontFamily: FONT,
              fontSize: 24,
              fontWeight: 800,
              letterSpacing: -0.8,
              color: FT_TEXT,
              marginBottom: 22,
            }}
          >
            MEGGA
          </div>
          <p
            style={{
              margin: 0,
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 400,
              color: FT_DIM,
              lineHeight: 1.6,
              maxWidth: 340,
            }}
          >
            La plateforme immobilière compliance-first des agents et particuliers
            suisses · 33’000+ biens · 26 cantons · Suisse-hosted · ISO 27001.
          </p>

          <div style={{ display: 'flex', gap: 8, marginTop: 26 }}>
            <SocialLink label="LinkedIn" href="https://www.linkedin.com/company/megga">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
              </svg>
            </SocialLink>
            <SocialLink label="Instagram" href="https://www.instagram.com/megga">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </SocialLink>
            <SocialLink label="X (Twitter)" href="https://x.com/megga">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
              </svg>
            </SocialLink>
            <SocialLink label="Facebook" href="https://www.facebook.com/megga">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M9 8h-3v4h3v12h5v-12h3.642l.358-4h-4v-1.667c0-.955.192-1.333 1.115-1.333h2.885v-5h-3.808c-3.596 0-5.192 1.583-5.192 4.615v3.385z" />
              </svg>
            </SocialLink>
          </div>
        </div>

        {/* Product */}
        <FooterColumn title="Produit">
          <FooterLink to="/acheter">Acheter</FooterLink>
          <FooterLink to="/louer">Louer</FooterLink>
          <FooterLink to="/louer">Carte</FooterLink>
          <FooterLink to="/compte">Alertes</FooterLink>
        </FooterColumn>

        {/* For pros */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <h4
            style={{
              margin: 0,
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              color: FT_TEXT,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <StarIcon />
            Professionnels
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <FooterLink to="/agences">Pour les agences</FooterLink>
            <FooterLink to="/agents">Pour les agents</FooterLink>
            <FooterLink to="/dashboard" badge="Nouveau">CRM MEGGA</FooterLink>
          </div>
        </div>

        {/* Company */}
        <FooterColumn title="MEGGA">
          <FooterLink to="/about">À propos</FooterLink>
          <FooterLink to="/careers">Carrières</FooterLink>
          <FooterLink to="/press">Presse</FooterLink>
          <FooterLink to="/blog">Blog</FooterLink>
        </FooterColumn>

        {/* Contact + lang switch */}
        <FooterColumn title="Contact">
          <FooterLink to="/help">Aide</FooterLink>
          <FooterLink to="/contact">Nous contacter</FooterLink>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {[
              { c: 'fr', l: 'FR' },
              { c: 'de', l: 'DE' },
              { c: 'it', l: 'IT' },
              { c: 'en', l: 'EN' },
            ].map(it => {
              const active = lang === it.c
              return (
                <button
                  key={it.c}
                  onClick={() => i18n.changeLanguage(it.c)}
                  style={{
                    height: 26,
                    padding: '0 10px',
                    borderRadius: 999,
                    border: `1px solid ${active ? FT_GREEN : FT_BORDER_STRONG}`,
                    background: active ? FT_GREEN : 'transparent',
                    color: active ? '#fff' : FT_DIM,
                    fontFamily: FONT,
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {it.l}
                </button>
              )
            })}
          </div>
        </FooterColumn>
      </div>

      {/* Legal bar */}
      <div
        style={{
          marginTop: 64,
          paddingTop: 24,
          borderTop: `1px solid ${FT_BORDER}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
          <span
            style={{
              fontFamily: FONT,
              fontSize: 12,
              color: FT_DIMMER,
            }}
          >
            © {new Date().getFullYear()} MEGGA SA · Tous droits réservés
          </span>
          <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
            {[
              { to: '/cgu', label: 'CGU' },
              { to: '/privacy', label: 'Confidentialité' },
              { to: '/cookies', label: 'Cookies' },
              { to: '/mentions-legales', label: 'Mentions légales' },
            ].map(it => (
              <Link
                key={it.label}
                to={it.to}
                style={{
                  fontFamily: FONT,
                  fontSize: 12,
                  color: FT_DIM,
                  textDecoration: 'none',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = FT_TEXT)}
                onMouseLeave={e => (e.currentTarget.style.color = FT_DIM)}
              >
                {it.label}
              </Link>
            ))}
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            opacity: 0.85,
          }}
        >
          <span
            style={{
              fontFamily: FONT,
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 1,
              textTransform: 'uppercase',
              color: FT_DIM,
            }}
          >
            Swiss Made Software
          </span>
        </div>
      </div>
    </footer>
  )
}
