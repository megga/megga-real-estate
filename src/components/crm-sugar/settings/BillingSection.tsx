// MEGGA CRM Sugar v2 — Settings Billing section (Tier 3.k stub)
// 1:1 port from `crm-screen-settings-step4.jsx` (SettingsBillingSection + helpers).

import { useState } from 'react'
import {
  Modal,
  SectionHeader,
  SetBlackBtn,
  SetCard,
  SetGhostBtn,
  SetIcon,
} from './atoms'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

interface Plan {
  id: string
  name: string
  price: number | null
  currency: string
  period: string
  desc: string
  color: string
  features: string[]
  current?: boolean
}

const PLANS: Plan[] = [
  {
    id: 'solo',
    name: 'Solo',
    price: 89,
    currency: 'CHF',
    period: 'mois',
    desc: "Pour l'agent indépendant",
    color: '#6B7280',
    features: [
      '1 utilisateur',
      '100 contacts actifs',
      '5 mandats simultanés',
      'Julien IA — équilibré',
      'Email & SMS',
    ],
  },
  {
    id: 'agency',
    name: 'Agence',
    price: 249,
    currency: 'CHF',
    period: 'mois',
    desc: 'Pour les petites équipes',
    color: '#0B0C0E',
    features: [
      "Jusqu'à 5 utilisateurs",
      'Contacts illimités',
      'Mandats illimités',
      'Julien IA — proactif',
      'Pige automatique IAZI',
      'Page agence publique',
    ],
    current: true,
  },
  {
    id: 'enterprise',
    name: 'Maison',
    price: null,
    currency: 'CHF',
    period: 'sur devis',
    desc: 'Réseaux et grandes agences',
    color: '#7F1D2F',
    features: [
      'Utilisateurs illimités',
      'SSO & SCIM',
      'API & webhooks',
      'Support dédié 24/7',
      'Audit ISO 27001 client',
      'Customisation visuelle',
    ],
  },
]

interface Invoice {
  id: string
  date: string
  amount: string
  period: string
  status: 'paid' | 'refund' | 'failed'
}

const INVOICES: Invoice[] = [
  { id: 'INV-2025-04', date: '3 nov. 2025', amount: 'CHF 249.00', period: 'Nov 2025', status: 'paid' },
  { id: 'INV-2025-03', date: '3 oct. 2025', amount: 'CHF 249.00', period: 'Oct 2025', status: 'paid' },
  { id: 'INV-2025-02', date: '3 sep. 2025', amount: 'CHF 249.00', period: 'Sep 2025', status: 'paid' },
  { id: 'INV-2025-01', date: '3 aoû. 2025', amount: 'CHF 249.00', period: 'Aoû 2025', status: 'paid' },
  { id: 'INV-2024-12', date: '3 jul. 2025', amount: 'CHF 249.00', period: 'Jul 2025', status: 'paid' },
  { id: 'INV-2024-11', date: '3 jun. 2025', amount: 'CHF 199.00', period: 'Jun 2025', status: 'refund' },
]

interface UsageEntry {
  used: number
  total: number | null
  label: string
}

const USAGE: Record<string, UsageEntry> = {
  users: { used: 4, total: 5, label: 'Utilisateurs' },
  contacts: { used: 1240, total: null, label: 'Contacts actifs' },
  mandates: { used: 12, total: null, label: 'Mandats simultanés' },
  sms: { used: 287, total: 500, label: 'SMS ce mois' },
  ai: { used: 412, total: 1000, label: 'Crédits Julien IA' },
}

function UsageBar({ used, total, label }: UsageEntry) {
  const ratio = total ? Math.min(used / total, 1) : 0
  const ratioColor = total
    ? ratio < 0.7
      ? SET.ok
      : ratio < 0.9
        ? SET.warn
        : SET.bad
    : SET.muted
  return (
    <div
      style={{
        padding: '14px 16px',
        borderRadius: 14,
        background: SET.cardSubtle,
        boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SET.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: 6,
          marginBottom: 8,
        }}
      >
        <span
          style={{
            fontSize: 22,
            fontWeight: 700,
            color: SET.ink,
            letterSpacing: -0.4,
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {used.toLocaleString('fr-CH')}
        </span>
        {total && (
          <span style={{ fontSize: 13, fontWeight: 600, color: SET.muted }}>
            / {total.toLocaleString('fr-CH')}
          </span>
        )}
        {!total && (
          <span
            style={{
              fontSize: 11.5,
              fontWeight: 700,
              color: SET.ok,
              letterSpacing: 0.4,
              textTransform: 'uppercase',
            }}
          >
            illimité
          </span>
        )}
      </div>
      <div
        style={{
          height: 5,
          borderRadius: 999,
          background: `${SET.muted}20`,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: total ? `${ratio * 100}%` : '100%',
            background: ratioColor,
            borderRadius: 999,
            transition: 'width .4s ease',
          }}
        />
      </div>
    </div>
  )
}

interface BillFieldProps {
  label: string
  value: string
  placeholder?: string
  mono?: boolean
  full?: boolean
}

function BillField({ label, value, placeholder, mono, full }: BillFieldProps) {
  return (
    <label
      style={{
        display: 'block',
        gridColumn: full ? '1 / -1' : 'auto',
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: SET.muted,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {label}
      </div>
      <input
        defaultValue={value}
        placeholder={placeholder}
        style={{
          width: '100%',
          height: 48,
          padding: '0 16px',
          borderRadius: 14,
          border: 0,
          outline: 'none',
          background: SET.cardSubtle,
          fontFamily: mono
            ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
            : 'inherit',
          fontSize: mono ? 13.5 : 14,
          fontWeight: 600,
          color: SET.ink,
          boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
          letterSpacing: mono ? 0.3 : -0.1,
        }}
      />
    </label>
  )
}

interface PlanCardProps {
  plan: Plan
  period: 'monthly' | 'yearly'
}

function PlanCard({ plan, period }: PlanCardProps) {
  const isYearly = period === 'yearly' && plan.price !== null
  const displayPrice = isYearly && plan.price ? Math.round(plan.price * 0.8) : plan.price
  return (
    <div
      style={{
        padding: '22px 22px 24px',
        borderRadius: 18,
        background: SET.card,
        boxShadow: plan.current
          ? `inset 0 0 0 2px ${SET.ink}, 0 14px 32px rgba(11,12,14,0.10)`
          : 'inset 0 0 0 1px rgba(15,23,42,0.06)',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {plan.current && (
        <span
          style={{
            position: 'absolute',
            top: -10,
            right: 18,
            padding: '4px 10px',
            borderRadius: 999,
            background: SET.ink,
            color: '#fff',
            fontSize: 10.5,
            fontWeight: 700,
            letterSpacing: 0.4,
            textTransform: 'uppercase',
            boxShadow: '0 4px 12px rgba(11,12,14,0.20)',
          }}
        >
          Plan actuel
        </span>
      )}
      <div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: plan.color,
            letterSpacing: 1.4,
            textTransform: 'uppercase',
          }}
        >
          {plan.name}
        </div>
        <div
          style={{
            fontSize: 12.5,
            color: SET.muted,
            fontWeight: 500,
            marginTop: 4,
          }}
        >
          {plan.desc}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        {plan.price !== null ? (
          <>
            <span style={{ fontSize: 13, fontWeight: 600, color: SET.muted }}>
              {plan.currency}
            </span>
            <span
              style={{
                fontSize: 34,
                fontWeight: 700,
                color: SET.ink,
                letterSpacing: -0.6,
                fontFamily: "Georgia, 'Times New Roman', serif",
              }}
            >
              {displayPrice}
            </span>
            <span style={{ fontSize: 12.5, fontWeight: 500, color: SET.muted }}>
              /{plan.period}
            </span>
          </>
        ) : (
          <span
            style={{
              fontSize: 24,
              fontWeight: 700,
              color: SET.ink,
              letterSpacing: -0.4,
              fontFamily: "Georgia, 'Times New Roman', serif",
            }}
          >
            Sur devis
          </span>
        )}
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          marginTop: 4,
        }}
      >
        {plan.features.map(f => (
          <div
            key={f}
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
              fontSize: 12.5,
              color: SET.inkSoft,
              fontWeight: 500,
              lineHeight: 1.5,
            }}
          >
            <span
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: `${SET.ok}18`,
                color: SET.ok,
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                marginTop: 1,
              }}
            >
              <SetIcon name="check" size={9} stroke={SET.ok} sw={3} />
            </span>
            {f}
          </div>
        ))}
      </div>
      <button
        disabled={plan.current}
        style={{
          height: 42,
          marginTop: 8,
          border: 0,
          borderRadius: 999,
          background: plan.current ? SET.cardSubtle : SET.black,
          color: plan.current ? SET.muted : '#fff',
          fontFamily: 'inherit',
          fontSize: 13,
          fontWeight: 700,
          cursor: plan.current ? 'default' : 'pointer',
          boxShadow: plan.current ? 'none' : '0 6px 16px rgba(11,12,14,0.18)',
          letterSpacing: -0.1,
        }}
      >
        {plan.current
          ? 'Plan actuel'
          : plan.price !== null
            ? 'Passer à ce plan'
            : 'Contacter les ventes'}
      </button>
    </div>
  )
}

interface PlanChooserModalProps {
  onClose: () => void
}

function PlanChooserModal({ onClose }: PlanChooserModalProps) {
  const [period, setPeriod] = useState<'monthly' | 'yearly'>('monthly')
  return (
    <Modal title="Choisir votre plan" onClose={onClose} wide>
      <div
        style={{
          display: 'inline-flex',
          padding: 4,
          borderRadius: 999,
          background: SET.cardSubtle,
          marginBottom: 18,
        }}
      >
        {(
          [
            { id: 'monthly', label: 'Mensuel' },
            { id: 'yearly', label: 'Annuel · -20%' },
          ] as { id: 'monthly' | 'yearly'; label: string }[]
        ).map(t => {
          const active = period === t.id
          return (
            <button
              key={t.id}
              onClick={() => setPeriod(t.id)}
              style={{
                height: 34,
                padding: '0 16px',
                border: 0,
                borderRadius: 999,
                background: active ? '#fff' : 'transparent',
                color: active ? SET.ink : SET.inkSoft,
                fontFamily: 'inherit',
                fontSize: 12.5,
                fontWeight: active ? 700 : 600,
                cursor: 'pointer',
                letterSpacing: -0.1,
                boxShadow: active ? '0 4px 12px rgba(11,12,14,0.10)' : 'none',
                transition: 'all .15s',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
        {PLANS.map(p => (
          <PlanCard key={p.id} plan={p} period={period} />
        ))}
      </div>
    </Modal>
  )
}

export function BillingSection() {
  const [planModalOpen, setPlanModalOpen] = useState(false)
  const [cardModalOpen, setCardModalOpen] = useState(false)
  const currentPlan = PLANS.find(p => p.current)!

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker="Facturation"
          title="Votre plan et vos paiements"
          sub="Plan Agence, facturé mensuellement. Vous pouvez changer ou annuler à tout moment, sans frais."
        />

        {/* Plan actuel — bloc hero */}
        <div
          style={{
            background: 'linear-gradient(135deg, #0B0C0E 0%, #1F2937 100%)',
            color: '#fff',
            borderRadius: 24,
            padding: 28,
            position: 'relative',
            overflow: 'hidden',
            boxShadow: '0 20px 60px rgba(11,12,14,0.20)',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: -60,
              right: -60,
              width: 240,
              height: 240,
              borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
            }}
          />
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 24,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ flex: '1 1 280px' }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: 1.2,
                  textTransform: 'uppercase',
                  color: 'rgba(255,255,255,0.65)',
                  marginBottom: 10,
                }}
              >
                Plan actuel
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  gap: 14,
                  flexWrap: 'wrap',
                }}
              >
                <h2
                  style={{
                    margin: 0,
                    fontSize: 36,
                    fontWeight: 700,
                    letterSpacing: -0.6,
                    fontFamily: "Georgia, 'Times New Roman', serif",
                  }}
                >
                  {currentPlan.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.65)',
                    }}
                  >
                    CHF
                  </span>
                  <span
                    style={{
                      fontSize: 34,
                      fontWeight: 700,
                      letterSpacing: -0.6,
                    }}
                  >
                    {currentPlan.price}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 500,
                      color: 'rgba(255,255,255,0.65)',
                    }}
                  >
                    /{currentPlan.period}
                  </span>
                </div>
              </div>
              <div
                style={{
                  marginTop: 14,
                  padding: '8px 14px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.10)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: 999,
                    background: '#22C55E',
                  }}
                />
                Actif · prochain prélèvement le 3 décembre
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                alignItems: 'flex-end',
              }}
            >
              <button
                onClick={() => setPlanModalOpen(true)}
                style={{
                  height: 44,
                  padding: '0 22px',
                  border: 0,
                  borderRadius: 999,
                  background: '#fff',
                  color: '#0B0C0E',
                  fontFamily: 'inherit',
                  fontSize: 13.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.20)',
                }}
              >
                Changer de plan
              </button>
              <button
                style={{
                  height: 36,
                  padding: '0 16px',
                  border: 0,
                  borderRadius: 999,
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.85)',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                  textDecorationColor: 'rgba(255,255,255,0.4)',
                }}
              >
                Annuler l'abonnement
              </button>
            </div>
          </div>
        </div>

        {/* Utilisation */}
        <SetCard title="Utilisation ce mois" sub="Période en cours : 3 nov. — 2 déc. 2025">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: 16,
            }}
          >
            {Object.entries(USAGE).map(([k, m]) => (
              <UsageBar key={k} {...m} />
            ))}
          </div>
        </SetCard>

        {/* Moyen de paiement */}
        <SetCard
          title="Moyen de paiement"
          sub="Vos prélèvements automatiques. Le QR-bill suisse est aussi disponible sur demande."
        >
          <div
            style={{
              padding: '20px 22px',
              borderRadius: 16,
              background: SET.cardSubtle,
              boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
              display: 'flex',
              alignItems: 'center',
              gap: 18,
            }}
          >
            <div
              style={{
                width: 52,
                height: 36,
                borderRadius: 8,
                background: 'linear-gradient(135deg, #1A1F71 0%, #4F45A1 100%)',
                display: 'grid',
                placeItems: 'center',
                fontFamily: "Georgia, 'Times New Roman', serif",
                fontSize: 13,
                fontWeight: 700,
                color: '#fff',
                letterSpacing: 0.5,
                boxShadow: '0 4px 12px rgba(26,31,113,0.25)',
              }}
            >
              VISA
            </div>
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontSize: 13.5,
                  fontWeight: 700,
                  color: SET.ink,
                  letterSpacing: -0.1,
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              >
                •••• •••• •••• 4242
              </div>
              <div
                style={{
                  fontSize: 12,
                  color: SET.muted,
                  fontWeight: 500,
                  marginTop: 3,
                }}
              >
                Diane Weiss · Expire 09/2027
              </div>
            </div>
            <SetGhostBtn size="sm" onClick={() => setCardModalOpen(true)}>
              Modifier
            </SetGhostBtn>
          </div>

          <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <SetGhostBtn
              size="sm"
              icon={<SetIcon name="plus" size={13} stroke={SET.inkSoft} sw={2.2} />}
            >
              Ajouter une carte de secours
            </SetGhostBtn>
            <SetGhostBtn
              size="sm"
              icon={<SetIcon name="receipt" size={13} stroke={SET.inkSoft} />}
            >
              Activer la QR-bill suisse
            </SetGhostBtn>
          </div>
        </SetCard>

        {/* Coordonnées de facturation */}
        <SetCard
          title="Coordonnées de facturation"
          sub="Apparaissent sur les factures officielles."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <BillField label="Raison sociale" value="MEGGA College SA" />
            <BillField label="N° TVA" value="CHE-114.221.305 TVA" mono />
            <BillField label="Adresse" value="12 rue du Mont-Blanc, 1201 Genève" full />
            <BillField label="Email de facturation" value="finance@meggacollege.ch" />
            <BillField label="Référence interne" value="MEGGA-DW-001" mono />
          </div>
        </SetCard>

        {/* Historique factures */}
        <SetCard
          title="Historique des factures"
          sub="Toutes vos factures sont disponibles en PDF, conservées 10 ans."
          action={
            <SetGhostBtn
              size="sm"
              icon={<SetIcon name="download" size={13} stroke={SET.inkSoft} />}
            >
              Tout exporter
            </SetGhostBtn>
          }
          padding={0}
        >
          <div>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '110px 1fr 110px 130px 100px 80px',
                gap: 14,
                padding: '14px 28px',
                fontSize: 11,
                fontWeight: 700,
                color: SET.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                borderBottom: `1px solid ${SET.line}`,
              }}
            >
              <span>Date</span>
              <span>Référence</span>
              <span>Période</span>
              <span style={{ textAlign: 'right' }}>Montant</span>
              <span style={{ textAlign: 'center' }}>État</span>
              <span></span>
            </div>
            {INVOICES.map((inv, i) => {
              const status =
                inv.status === 'paid'
                  ? { label: 'Payée', bg: `${SET.ok}18`, color: SET.ok }
                  : inv.status === 'refund'
                    ? { label: 'Remboursée', bg: `${SET.muted}18`, color: SET.muted }
                    : { label: 'Échec', bg: `${SET.bad}18`, color: SET.bad }
              return (
                <div
                  key={inv.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '110px 1fr 110px 130px 100px 80px',
                    gap: 14,
                    padding: '14px 28px',
                    borderTop: i > 0 ? `1px solid ${SET.line}` : 'none',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12.5,
                      color: SET.muted,
                      fontWeight: 500,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {inv.date}
                  </span>
                  <span
                    style={{
                      fontSize: 13,
                      color: SET.ink,
                      fontWeight: 700,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      letterSpacing: -0.2,
                    }}
                  >
                    {inv.id}
                  </span>
                  <span style={{ fontSize: 12.5, color: SET.inkSoft, fontWeight: 500 }}>
                    {inv.period}
                  </span>
                  <span
                    style={{
                      fontSize: 13.5,
                      color: SET.ink,
                      fontWeight: 700,
                      textAlign: 'right',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {inv.amount}
                  </span>
                  <span style={{ textAlign: 'center' }}>
                    <span
                      style={{
                        padding: '4px 10px',
                        borderRadius: 999,
                        background: status.bg,
                        color: status.color,
                        fontSize: 10.5,
                        fontWeight: 700,
                        letterSpacing: 0.4,
                        textTransform: 'uppercase',
                      }}
                    >
                      {status.label}
                    </span>
                  </span>
                  <span style={{ textAlign: 'right' }}>
                    <button
                      style={{
                        width: 30,
                        height: 30,
                        border: 0,
                        borderRadius: 8,
                        background: 'transparent',
                        color: SET.inkSoft,
                        cursor: 'pointer',
                        display: 'inline-grid',
                        placeItems: 'center',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = SET.cardSubtle
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      <SetIcon name="download" size={14} stroke={SET.inkSoft} />
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
        </SetCard>
      </div>

      {planModalOpen && <PlanChooserModal onClose={() => setPlanModalOpen(false)} />}
      {cardModalOpen && (
        <Modal
          title="Modifier la carte de paiement"
          onClose={() => setCardModalOpen(false)}
          wide
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <BillField
              label="Numéro de carte"
              value=""
              placeholder="0000 0000 0000 0000"
              mono
            />
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: 12,
              }}
            >
              <BillField label="Expiration" value="" placeholder="MM/AA" mono />
              <BillField label="CVC" value="" placeholder="123" mono />
              <BillField label="Code postal" value="" placeholder="1201" mono />
            </div>
            <BillField label="Nom sur la carte" value="" placeholder="Diane Weiss" />
          </div>
          <div
            style={{
              marginTop: 14,
              padding: '12px 14px',
              borderRadius: 12,
              background: SET.cardSubtle,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              fontSize: 12,
              color: SET.muted,
              fontWeight: 500,
            }}
          >
            <SetIcon name="lock" size={13} stroke={SET.muted} />
            Paiement sécurisé Stripe · Vos données ne transitent jamais par MEGGA
          </div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 10,
              marginTop: 18,
            }}
          >
            <SetGhostBtn onClick={() => setCardModalOpen(false)}>Annuler</SetGhostBtn>
            <SetBlackBtn onClick={() => setCardModalOpen(false)}>
              Enregistrer
            </SetBlackBtn>
          </div>
        </Modal>
      )}
    </>
  )
}
