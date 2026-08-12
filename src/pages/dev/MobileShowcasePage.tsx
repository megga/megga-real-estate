/**
 * Écran vitrine DEV — route `/dev/mobile` (non destiné à la prod).
 * Empile tous les écrans et primitives du CRM mobile Sugar Pure avec des données
 * fictives (DEMO_OFFER / DEMO_DEAL / DEMO_LISTING) pour vérifier leur fidélité sans auth.
 */
import { useState, type CSSProperties } from 'react'
import { ThemeProvider } from '@/hooks/useTheme'
import { MOBILE_FONT } from '@/components/crm-mobile/tokens'
import { useMobileTokens } from '@/components/crm-mobile/useMobileTokens'
import SgActionMenu from '@/components/crm-mobile/primitives/SgActionMenu'
import SgConfirmDestructive from '@/components/crm-mobile/primitives/SgConfirmDestructive'
import SgSheet from '@/components/crm-mobile/primitives/SgSheet'
import SgToast from '@/components/crm-mobile/primitives/SgToast'
import { useSgToast } from '@/components/crm-mobile/primitives/useSgToast'
import MobileMoreScreen from '@/components/crm-mobile/more/MobileMoreScreen'
import { MobileTodayScreen } from '@/components/crm-mobile/today/MobileTodayScreen'
import { MobilePipelineScreen } from '@/components/crm-mobile/pipeline/MobilePipelineScreen'
import { MobileMatchingScreen } from '@/components/crm-mobile/matching/MmMatchingScreen'
import { MobileAgendaScreen } from '@/components/crm-mobile/agenda/MobileAgendaScreen'
import { MobileBiensScreen } from '@/components/crm-mobile/biens/MobileBiensScreen'
import { MobileBienVitrineScreen } from '@/components/crm-mobile/bien/MobileBienVitrineScreen'
import { MobileWizardScreen } from '@/components/crm-mobile/wizard/MobileWizardScreen'
import { MobileContactsListScreen } from '@/components/crm-mobile/contacts/MobileContactsListScreen'
import { MobileNewContactScreen } from '@/components/crm-mobile/contacts/MobileNewContactScreen'
import { MobileContactDetailScreen } from '@/components/crm-mobile/contacts/MobileContactDetailScreen'
import { MobileAnalyticsScreen } from '@/components/crm-mobile/analytics/MobileAnalyticsScreen'
import { MobileJourneyScreen } from '@/components/crm-mobile/journey/MobileJourneyScreen'
import { MobileKycListScreen } from '@/components/crm-mobile/kyc/MobileKycListScreen'
import { MobileKycDetailScreen } from '@/components/crm-mobile/kyc/MobileKycDetailScreen'
import { MobileSettingsScreen } from '@/components/crm-mobile/settings/MobileSettingsScreen'
import { MobileDealDetailScreen, type DealData } from '@/components/crm-mobile/deal/MobileDealDetailScreen'
import { EMPTY_OFFER_CONDITIONS, type Offer } from '@/types/offer'
import { DEMO_LISTING } from './demoFixtures'

const DEMO_OFFER: Offer = {
  id: 'o1', deal_id: 'd5', agency_id: 'ag', parent_offer_id: null,
  kind: 'offer', from_party: 'buyer', by_id: 'bx', by_label: 'Antoine Picard',
  amount: 3700000, currency: 'CHF', conditions: EMPTY_OFFER_CONDITIONS,
  deposit: 370000, closing_date: null, expires_at: '2026-07-02T00:00:00.000Z',
  status: 'pending', created_at: '2026-06-24T10:00:00.000Z', responded_at: null,
  attachments: [], notes: '',
}
const DEMO_DEAL: DealData = {
  id: 'd5', stage: 'offer', value: 3850000,
  buyerName: 'Antoine Picard', buyerInitials: 'AP', buyerId: 'bx',
  buyerBudgetMin: 3000000, buyerBudgetMax: 4200000, buyerProb: 70,
  propertyTitle: 'Villa contemporaine · Cologny', propertyAddr: 'Route de la Capite · Genève',
  propertyPrice: 3850000, propertySurface: 240, propertyRooms: 7, propertyId: 'px',
  photo: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=1000&q=80',
  kycStatus: 'pending', offers: [DEMO_OFFER], notes: 'Vendeur attend la réponse sous 48 h.',
  createdAt: '2026-06-20T09:00:00.000Z',
}

/**
 * Harnais de prévisualisation no-auth des écrans + primitives mobiles —
 * vérification de fidélité Sugar Pure sans passer par l'auth /dashboard. Le
 * ThemeProvider est par-layout (pas global), on l'enveloppe donc ici.
 * Route : /dev/mobile. Les écrans des phases suivantes viendront s'y ajouter.
 */
export default function MobileShowcasePage() {
  return (
    <ThemeProvider>
      <ShowcaseInner />
    </ThemeProvider>
  )
}

/** Contenu du harnais : empile chaque écran mobile (mode `demo`) puis les démos des primitives (menu, confirm, sheet, toast). */
function ShowcaseInner() {
  const { tk } = useMobileTokens()
  const [menuOpen, setMenuOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { toast, showToast } = useSgToast()

  const cta: CSSProperties = {
    height: 46,
    borderRadius: 999,
    border: 0,
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 14.5,
    fontWeight: 600,
    background: tk.accent,
    color: tk.accentInk,
    boxShadow: tk.shadow,
  }

  return (
    <div style={{ minHeight: '100dvh', background: tk.canvas, color: tk.ink, fontFamily: MOBILE_FONT }}>
      <MobileMatchingScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileAgendaScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileBiensScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileWizardScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileBienVitrineScreen demoData={DEMO_LISTING} />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileContactsListScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileNewContactScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileContactDetailScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileAnalyticsScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileJourneyScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileKycListScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileKycDetailScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileSettingsScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileDealDetailScreen demoData={DEMO_DEAL} />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobilePipelineScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <MobileTodayScreen demo />
      <div style={{ height: 1, background: tk.hair, margin: '12px 16px' }} />
      <div style={{ padding: '24px 16px 8px' }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 600, letterSpacing: -0.5, color: tk.ink }}>
          Mobile — Primitives (P1)
        </h1>
        <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
          <button style={cta} onClick={() => setMenuOpen(true)}>Menu d'actions •••</button>
          <button style={cta} onClick={() => setConfirmOpen(true)}>Confirmation destructive</button>
          <button style={cta} onClick={() => setSheetOpen(true)}>Feuille de détail</button>
          <button style={cta} onClick={() => showToast('Bien dupliqué (brouillon)')}>Toast</button>
        </div>
      </div>

      <MobileMoreScreen />

      <SgActionMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Bien · Réf MG-2026-101"
        items={[
          { id: 'duplicate', icon: 'copy', label: 'Dupliquer le bien' },
          { id: 'status', icon: 'refresh', label: 'Changer le statut' },
          { id: 'unpublish', icon: 'eye', label: 'Retirer de la diffusion', divider: true },
          { id: 'delete', icon: 'trash', label: 'Supprimer le bien', danger: true },
        ]}
        onAction={(id) => {
          setMenuOpen(false)
          if (id === 'delete') setConfirmOpen(true)
          else showToast(`Action : ${id}`)
        }}
      />

      <SgConfirmDestructive
        open={confirmOpen}
        title="Supprimer le bien ?"
        message="Cette action est définitive. L'annonce et ses statistiques de diffusion seront retirées."
        confirmLabel="Supprimer"
        onConfirm={() => {
          setConfirmOpen(false)
          showToast('Bien supprimé')
        }}
        onCancel={() => setConfirmOpen(false)}
      />

      <SgSheet open={sheetOpen} onClose={() => setSheetOpen(false)} ariaLabel="Détail" bottomGap={24}>
        <div style={{ padding: '4px 18px 22px' }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 600, letterSpacing: -0.3, color: tk.ink }}>
            Filtrer les biens
          </h2>
          {['Tous les statuts', 'Actifs', 'Réservés', 'Brouillons'].map((label, i) => (
            <div
              key={label}
              style={{
                marginTop: 12,
                padding: '14px 16px',
                borderRadius: 14,
                background: tk.cardSubtle,
                fontSize: 14.5,
                fontWeight: 600,
                color: tk.ink,
                boxShadow: i === 1 ? `0 0 0 2px ${tk.accent} inset` : undefined,
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </SgSheet>

      <SgToast toast={toast} />
    </div>
  )
}
