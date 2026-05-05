// MEGGA CRM Sugar v2 — Settings Agency section (Tier 3.k stub)
// 1:1 port from `crm-screen-settings-step2.jsx` (SettingsAgencySection).

import { useState } from 'react'
import {
  ConfirmModal,
  SectionHeader,
  SetCard,
  SetIcon,
  SetInput,
  SetTextarea,
  StickySaveBar,
  Toast,
} from './atoms'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

interface AgencyBranding {
  logoBg: string
  primary: string
  accent: string
  initials: string
}

interface AgencyData {
  name: string
  legal: string
  ide: string
  foundedYear: number
  address: string
  postal: string
  city: string
  country: string
  phone: string
  email: string
  web: string
  aboutShort: string
  branding: AgencyBranding
  network: string
}

const DEFAULT_AGENCY: AgencyData = {
  name: 'MEGGA Genève',
  legal: 'MEGGA Real Estate SA',
  ide: 'CHE-100.000.001',
  foundedYear: 2018,
  address: '14 rue du Rhône',
  postal: '1204',
  city: 'Genève',
  country: 'Suisse',
  phone: '+41 22 555 00 00',
  email: 'geneve@megga.ch',
  web: 'megga.ch',
  aboutShort:
    'Cabinet boutique spécialisé sur Genève rive droite et rive gauche, mandats exclusifs et conseil patrimonial.',
  branding: {
    logoBg: '#0B0C0E',
    primary: '#0B0C0E',
    accent: '#0B0C0E',
    initials: 'MG',
  },
  network: 'megga',
}

const NETWORK_OPTIONS = [
  {
    id: 'megga',
    label: 'Réseau MEGGA',
    sub: 'Conformité C2PA, partage portefeuille opt-in',
  },
  { id: 'naef', label: 'Naef Immobilier', sub: 'Affilié partenaire' },
  { id: 'bory', label: 'Bory & Cie', sub: 'Affilié partenaire' },
  { id: 'independant', label: 'Indépendant', sub: 'Aucun réseau, gestion solo' },
]

interface ColorFieldProps {
  label: string
  value: string
  onChange: (v: string) => void
}

function ColorField({ label, value, onChange }: ColorFieldProps) {
  const [open, setOpen] = useState(false)
  const PRESET = [
    '#0B0C0E', '#1E3A5F', '#2C2416', '#5C2C16',
    '#0041D9', '#0F766E', '#9F1239', '#7C3AED',
  ]
  return (
    <div style={{ position: 'relative' }}>
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
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          height: 48,
          width: '100%',
          padding: '0 12px',
          borderRadius: 14,
          border: 0,
          background: SET.cardSubtle,
          fontFamily: 'inherit',
          fontSize: 14,
          fontWeight: 500,
          color: SET.ink,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: value,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.10)',
            flexShrink: 0,
          }}
        />
        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 13 }}>
          {value.toUpperCase()}
        </span>
      </button>
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: 'fixed', inset: 0, zIndex: 30 }}
          />
          <div
            style={{
              position: 'absolute',
              marginTop: 6,
              zIndex: 31,
              background: SET.card,
              borderRadius: 16,
              padding: 12,
              boxShadow: SET.shadowLg,
              display: 'grid',
              gridTemplateColumns: 'repeat(8, 28px)',
              gap: 8,
              animation: 'setFadeUp .18s cubic-bezier(.2,.8,.2,1) both',
            }}
          >
            {PRESET.map(c => (
              <button
                key={c}
                onClick={() => {
                  onChange(c)
                  setOpen(false)
                }}
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  border: 0,
                  background: c,
                  cursor: 'pointer',
                  boxShadow:
                    c === value
                      ? `0 0 0 2px #fff, 0 0 0 4px ${SET.black}`
                      : 'inset 0 0 0 1px rgba(0,0,0,0.10)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function AgencySection() {
  const [data, setData] = useState<AgencyData>(DEFAULT_AGENCY)
  const [saved, setSaved] = useState<AgencyData>(DEFAULT_AGENCY)
  const dirty = JSON.stringify(data) !== JSON.stringify(saved)
  const set = (patch: Partial<AgencyData>) => setData(d => ({ ...d, ...patch }))
  const setBranding = (patch: Partial<AgencyBranding>) =>
    set({ branding: { ...data.branding, ...patch } })

  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const handleSave = () => {
    setSaving(true)
    setTimeout(() => {
      setSaved(data)
      setSaving(false)
      setToast(true)
      setTimeout(() => setToast(false), 2400)
    }, 700)
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: dirty ? 96 : 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        <SectionHeader
          kicker="Mon agence"
          title="L'identité légale et publique de votre cabinet"
          sub="Apparaît sur les mandats, factures, courriers officiels et le pied de toutes vos communications."
        />

        {/* Card identité visuelle + nom */}
        <SetCard padding={0}>
          <div style={{ display: 'flex', gap: 0 }}>
            <div
              style={{
                padding: '32px 28px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 14,
                borderRight: `1px solid ${SET.line}`,
                minWidth: 240,
              }}
            >
              <div style={{ position: 'relative' }}>
                <div
                  style={{
                    width: 120,
                    height: 120,
                    borderRadius: 24,
                    background: data.branding.logoBg,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 38,
                    fontWeight: 800,
                    letterSpacing: '.05em',
                    boxShadow: `0 12px 30px ${data.branding.logoBg}55`,
                  }}
                >
                  {data.branding.initials}
                </div>
                <button
                  title="Téléverser un logo"
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    right: -6,
                    width: 36,
                    height: 36,
                    borderRadius: 999,
                    border: 0,
                    background: SET.black,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 6px 16px rgba(11,12,14,0.30)',
                  }}
                >
                  <SetIcon name="camera" size={16} stroke="#fff" />
                </button>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div
                  style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: SET.ink,
                    letterSpacing: -0.2,
                  }}
                >
                  {data.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: SET.muted,
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {data.legal}
                </div>
              </div>
              <button
                style={{
                  height: 32,
                  padding: '0 14px',
                  borderRadius: 999,
                  border: 0,
                  background: SET.cardSubtle,
                  color: SET.inkSoft,
                  fontFamily: 'inherit',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Téléverser un logo
              </button>
            </div>

            <div style={{ flex: 1, padding: '28px 32px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <SetInput
                  label="Nom commercial"
                  value={data.name}
                  onChange={v => set({ name: v })}
                />
                <SetInput
                  label="Année de création"
                  value={data.foundedYear}
                  onChange={v => set({ foundedYear: Number(v) || 0 })}
                  type="number"
                />
              </div>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 1fr',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <SetInput
                  label="Raison sociale"
                  value={data.legal}
                  onChange={v => set({ legal: v })}
                  hint="Nom légal complet (SA, Sàrl, etc.)"
                />
                <SetInput
                  label="Numéro IDE"
                  value={data.ide}
                  onChange={v => set({ ide: v })}
                  hint="Identifiant d'entreprise suisse"
                />
              </div>
              <SetTextarea
                label="Description courte"
                value={data.aboutShort}
                onChange={v => set({ aboutShort: v })}
                rows={3}
                placeholder="2 phrases qui résument votre positionnement…"
              />
            </div>
          </div>
        </SetCard>

        {/* Card adresse */}
        <SetCard
          title="Adresse du siège"
          sub="L'adresse principale de votre agence — utilisée sur les mandats et la facturation."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '2fr 1fr 1.5fr 1fr',
              gap: 16,
            }}
          >
            <SetInput
              label="Rue et numéro"
              value={data.address}
              onChange={v => set({ address: v })}
            />
            <SetInput
              label="NPA"
              value={data.postal}
              onChange={v => set({ postal: v })}
            />
            <SetInput
              label="Ville"
              value={data.city}
              onChange={v => set({ city: v })}
            />
            <SetInput
              label="Pays"
              value={data.country}
              onChange={v => set({ country: v })}
            />
          </div>
        </SetCard>

        {/* Card coordonnées publiques */}
        <SetCard
          title="Coordonnées publiques"
          sub="Visibles dans le pied de page de vos annonces et documents."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 16,
            }}
          >
            <SetInput
              label="Téléphone"
              type="tel"
              value={data.phone}
              onChange={v => set({ phone: v })}
            />
            <SetInput
              label="Email"
              type="email"
              value={data.email}
              onChange={v => set({ email: v })}
            />
            <SetInput
              label="Site web"
              value={data.web}
              onChange={v => set({ web: v })}
              prefix="https://"
            />
          </div>
        </SetCard>

        {/* Card branding */}
        <SetCard
          title="Charte de marque"
          sub="Couleurs et initiales reprises dans les exports, signatures et la première de couverture des dossiers."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              gap: 16,
            }}
          >
            <ColorField
              label="Fond logo"
              value={data.branding.logoBg}
              onChange={v => setBranding({ logoBg: v })}
            />
            <ColorField
              label="Couleur primaire"
              value={data.branding.primary}
              onChange={v => setBranding({ primary: v })}
            />
            <ColorField
              label="Accent"
              value={data.branding.accent}
              onChange={v => setBranding({ accent: v })}
            />
            <SetInput
              label="Initiales"
              value={data.branding.initials}
              onChange={v => setBranding({ initials: v.slice(0, 3).toUpperCase() })}
              hint="Affichées si pas de logo"
            />
          </div>
          <div
            style={{
              marginTop: 18,
              padding: '14px 16px',
              borderRadius: 14,
              background: SET.cardSubtle,
              display: 'flex',
              alignItems: 'center',
              gap: 14,
            }}
          >
            <SetIcon name="info" size={16} stroke={SET.muted} />
            <span
              style={{
                fontSize: 12.5,
                color: SET.inkSoft,
                fontWeight: 500,
                lineHeight: 1.5,
              }}
            >
              Pour la charte complète (typographies, gabarits, signatures), rendez-vous sur la
              section <b>Marque & présentation</b>.
            </span>
          </div>
        </SetCard>

        {/* Card réseau */}
        <SetCard
          title="Réseau d'affiliation"
          sub="Sélectionnez votre réseau partenaire. Les annonces porteront sa charte si configurée."
        >
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 12,
            }}
          >
            {NETWORK_OPTIONS.map(opt => {
              const active = data.network === opt.id
              return (
                <button
                  key={opt.id}
                  onClick={() => set({ network: opt.id })}
                  style={{
                    padding: '16px 18px',
                    borderRadius: 16,
                    border: 0,
                    textAlign: 'left',
                    background: active ? SET.black : SET.cardSubtle,
                    color: active ? '#fff' : SET.ink,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    boxShadow: active ? '0 8px 22px rgba(11,12,14,0.22)' : 'none',
                    transition: 'all .18s',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                  }}
                >
                  <span
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 999,
                      border: `2px solid ${active ? '#fff' : SET.ghost}`,
                      display: 'grid',
                      placeItems: 'center',
                      flexShrink: 0,
                      marginTop: 2,
                    }}
                  >
                    {active && (
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: 999,
                          background: '#fff',
                        }}
                      />
                    )}
                  </span>
                  <div>
                    <div
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        letterSpacing: -0.1,
                      }}
                    >
                      {opt.label}
                    </div>
                    <div
                      style={{
                        fontSize: 12.5,
                        fontWeight: 500,
                        marginTop: 3,
                        color: active ? 'rgba(255,255,255,0.72)' : SET.muted,
                      }}
                    >
                      {opt.sub}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </SetCard>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={saving}
        onSave={handleSave}
        onCancel={() => dirty && setConfirmOpen(true)}
      />
      <Toast open={toast} label="Agence enregistrée" />
      {confirmOpen && (
        <ConfirmModal
          title="Annuler les modifications ?"
          desc="Vos changements seront perdus. Cette action est irréversible."
          danger="Annuler les modifs"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setData(saved)
            setConfirmOpen(false)
          }}
        />
      )}
    </>
  )
}
