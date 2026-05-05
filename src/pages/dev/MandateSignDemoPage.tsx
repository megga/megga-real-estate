// MEGGA — Demo route pour visualiser MandateSignModal en isolation.
// Accessible à /dev/mandate-sign — pas de garde auth, route dev uniquement.

import { useState } from 'react'
import { MandateSignModal, type MandateListing } from '@/components/seller-portal/MandateSignModal'

const DEMO_LISTING: MandateListing = {
  id: 'demo-listing-1',
  dossier: {
    firstName: 'Catherine',
    lastName: 'Loreau',
    email: 'c.loreau@hotmail.fr',
    phone: '+41 79 605 11 03',
    address: 'Rue du Marché 12',
    city: 'Carouge',
    npa: '1227',
    canton: 'Genève',
    surface: 145,
  },
  estimation: {
    low: 1450000,
    mid: 1620000,
    high: 1780000,
    isRent: false,
  },
  agent: {
    name: 'Sophie Martin',
    agency: 'MEGGA Genève',
  },
}

export default function MandateSignDemoPage() {
  const [open, setOpen] = useState(true)
  const [signedAt, setSignedAt] = useState<string | null>(null)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'radial-gradient(ellipse 120% 90% at 50% 110%, #C8D5E0 0%, #DDE2E9 40%, #EAEDF3 100%)',
        fontFamily: '"Inter", system-ui, sans-serif',
        padding: 60,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div
          style={{
            fontSize: 11, fontWeight: 800, letterSpacing: '.09em',
            textTransform: 'uppercase', color: '#7A8088', marginBottom: 8,
          }}
        >
          Demo · Modale signature mandat
        </div>
        <h1 style={{ margin: '0 0 12px', fontSize: 32, fontWeight: 700, color: '#0E1410', letterSpacing: -0.8 }}>
          MandateSignModal
        </h1>
        <p style={{ margin: '0 0 24px', fontSize: 14, color: '#3F4640', lineHeight: 1.6 }}>
          Modale de signature du mandat de courtage en 3 étapes (Réviser → SMS OTP → QES). Port 1:1 du proto
          <code style={{ background: '#F6F8F4', padding: '2px 6px', borderRadius: 4, marginLeft: 4 }}>
            megga-mandate-modal.jsx
          </code>.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setOpen(true)}
            style={{
              height: 44, padding: '0 22px', borderRadius: 999,
              background: '#0041D9', color: '#fff', border: 'none',
              fontSize: 13, fontWeight: 700, cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(0,65,217,0.25)',
            }}
          >
            Ouvrir la modale
          </button>
          {signedAt && (
            <div
              style={{
                padding: '12px 18px', borderRadius: 12,
                background: '#E8FCEC', color: '#0E9F6E',
                fontSize: 13, fontWeight: 700,
              }}
            >
              ✓ Mandat signé · listing {DEMO_LISTING.id} · {signedAt}
            </div>
          )}
        </div>
      </div>

      <MandateSignModal
        listing={DEMO_LISTING}
        open={open}
        onClose={() => setOpen(false)}
        onSigned={id => setSignedAt(`${id} (${new Date().toLocaleTimeString('fr-CH')})`)}
      />
    </div>
  )
}
