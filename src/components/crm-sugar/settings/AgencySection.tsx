// MEGGA CRM Sugar v2 — Settings Agency section (wired).
//
// Persiste sur agencies via useAgencySettings. Champs édités : nom, adresse,
// ville, canton, téléphone, email, site web, URL du logo. Les anciens champs
// purement locaux (raison sociale, IDE, année, description courte, charte
// graphique multi-couleurs, réseau d'affiliation) ont été retirés tant qu'il
// n'existe pas de colonnes ou d'agency_branding table — chips pour le retour.

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { useAgencySettings, type AgencySettingsData } from '@/hooks/useAgencySettings'
import {
  ConfirmModal,
  SectionHeader,
  SetCard,
  SetInput,
  StickySaveBar,
} from './atoms'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

const SWISS_CANTONS = [
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL', 'AG', 'SO',
  'ZH', 'LU', 'ZG', 'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG',
  'AR', 'AI', 'SG', 'GR', 'TI',
] as const

export function AgencySection() {
  const { agency: serverAgency, isLoading, isSaving, hasBackend, save } = useAgencySettings()
  const [data, setData] = useState<AgencySettingsData>(serverAgency)
  const [saved, setSaved] = useState<AgencySettingsData>(serverAgency)
  const [confirmOpen, setConfirmOpen] = useState(false)

  useEffect(() => {
    setData(serverAgency)
    setSaved(serverAgency)
  }, [serverAgency])

  const dirty = JSON.stringify(data) !== JSON.stringify(saved)
  const set = (patch: Partial<AgencySettingsData>) => setData(d => ({ ...d, ...patch }))

  const toast = useToast()

  const handleSave = async () => {
    if (!hasBackend) {
      toast.error('Aucune agence associée à votre profil')
      return
    }
    try {
      await save(data)
      setSaved(data)
      toast.success('Agence enregistrée', { duration: 2400 })
    } catch (err) {
       
      console.error('[AgencySection] save failed', err)
      toast.error('Erreur lors de l’enregistrement')
    }
  }

  const handleCancel = () => {
    if (!dirty) return
    setConfirmOpen(true)
  }

  if (isLoading && !serverAgency.name) {
    return (
      <div style={{ padding: 40, color: SET.muted, fontSize: 13 }}>
        Chargement de l'agence…
      </div>
    )
  }

  if (!hasBackend) {
    return (
      <div style={{ padding: 40, color: SET.muted, fontSize: 13 }}>
        Aucune agence associée à votre profil. Contactez votre administrateur.
      </div>
    )
  }

  // Initiales pour la prévisualisation du logo (fallback quand pas d'image)
  const initials = (data.name || '?')
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()

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
          title="L'identité publique de votre cabinet"
          sub="Apparaît sur les mandats, factures et toutes vos communications. Les modifications sont visibles immédiatement."
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
                minWidth: 220,
              }}
            >
              <div
                style={{
                  width: 120,
                  height: 120,
                  borderRadius: 24,
                  background: data.logoUrl ? `url(${data.logoUrl}) center/cover` : SET.black,
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  fontSize: 38,
                  fontWeight: 800,
                  letterSpacing: '.05em',
                  boxShadow: '0 12px 30px rgba(11,12,14,0.20)',
                }}
              >
                {!data.logoUrl && initials}
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
                  {data.name || 'Nom non défini'}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: SET.muted,
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {data.canton ? `Canton ${data.canton}` : 'Canton non défini'}
                </div>
              </div>
            </div>

            <div style={{ flex: 1, padding: '28px 32px' }}>
              <SetInput
                label="Nom commercial"
                value={data.name}
                onChange={v => set({ name: v })}
              />
              <div style={{ height: 16 }} />
              <SetInput
                label="URL du logo (https://…)"
                value={data.logoUrl}
                onChange={v => set({ logoUrl: v })}
                hint="Téléversement direct à venir — collez une URL publique pour l'instant"
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
              gridTemplateColumns: '2.4fr 1.4fr 0.8fr',
              gap: 16,
            }}
          >
            <SetInput
              label="Rue et numéro"
              value={data.address}
              onChange={v => set({ address: v })}
            />
            <SetInput
              label="Ville"
              value={data.city}
              onChange={v => set({ city: v })}
            />
            <div>
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
                Canton
              </div>
              <select
                value={data.canton}
                onChange={e => set({ canton: e.target.value })}
                style={{
                  width: '100%',
                  height: 48,
                  padding: '0 12px',
                  borderRadius: 14,
                  border: 0,
                  background: SET.cardSubtle,
                  fontFamily: 'inherit',
                  fontSize: 14,
                  fontWeight: 500,
                  color: SET.ink,
                  cursor: 'pointer',
                  boxShadow: 'inset 0 0 0 1px rgba(15,23,42,0.04)',
                }}
              >
                <option value="">—</option>
                {SWISS_CANTONS.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
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
              value={data.website}
              onChange={v => set({ website: v })}
              prefix="https://"
            />
          </div>
        </SetCard>
      </div>

      <StickySaveBar
        dirty={dirty}
        saving={isSaving}
        onSave={handleSave}
        onCancel={handleCancel}
      />
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
