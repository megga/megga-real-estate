// MEGGA CRM Sugar v2 — Settings Profile section (full fidelity)
// 1:1 port from `crm-screen-settings-sugar.jsx` (ProfileSectionWithStickyActions).

import { useEffect, useState } from 'react'
import { useToast } from '@/components/ui/Toast'
import { SetBlackBtn, SetCard, SetGhostBtn, SetIcon, SetInput, SetTextarea } from './atoms'
import {
  profileCompletionScore,
  SET_PALETTE,
  type ProfileData,
} from './data'
import { useAgentProfileSugar } from '@/hooks/useAgentProfileSugar'

const SET = SET_PALETTE

export function ProfileSection() {
  // Source de vérité : Supabase via useAgentProfileSugar.
  // Champs persistés : firstName/lastName/phone/bio/languages/specialties.
  // Champs en local-only (TODO migration) : title/rcc/mobile/signature.
  const { profile: serverProfile, isLoading, isSaving, hasBackend, save } = useAgentProfileSugar()

  const [data, setData] = useState<ProfileData>(serverProfile)
  const [saved, setSaved] = useState<ProfileData>(serverProfile)

  // Sync depuis le serveur quand le profil charge (ou s'invalide après save)
  useEffect(() => {
    setData(serverProfile)
    setSaved(serverProfile)
  }, [serverProfile])

  const dirty = JSON.stringify(data) !== JSON.stringify(saved)

  const set = (patch: Partial<ProfileData>) => setData(d => ({ ...d, ...patch }))
  const reset = () => setData(saved)

  const toast = useToast()
  const [confirmOpen, setConfirmOpen] = useState(false)

  const score = profileCompletionScore(data)

  const handleSave = async () => {
    if (!hasBackend) {
      // Plus de faux succès quand l'utilisateur n'est pas authentifié —
      // on remonte l'état réel (session expirée / non connecté).
      toast.error('Session expirée — reconnectez-vous pour enregistrer')
      return
    }
    try {
      await save(data)
      setSaved(data)
      toast.success('Profil enregistré', { duration: 2400 })
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[ProfileSection] save failed', err)
      toast.error('Erreur lors de l’enregistrement')
    }
  }

  const handleCancel = () => {
    if (!dirty) return
    setConfirmOpen(true)
  }

  // Pendant le chargement initial Supabase, on évite de rendre des champs
  // vides (qui apparaîtraient dirty immédiatement contre serverProfile)
  if (isLoading && !serverProfile.firstName && !serverProfile.email) {
    return (
      <div style={{ padding: 40, color: SET.muted, fontSize: 13 }}>
        Chargement du profil…
      </div>
    )
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
        {/* Header */}
        <div style={{ marginBottom: 4, maxWidth: 720 }}>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: SET.muted,
              letterSpacing: 1.2,
              textTransform: 'uppercase',
              marginBottom: 12,
            }}
          >
            Mon profil agent
          </div>
          <h1
            style={{
              margin: '0 0 12px',
              fontSize: 32,
              fontWeight: 700,
              color: SET.ink,
              letterSpacing: -0.6,
              lineHeight: 1.1,
            }}
          >
            Votre identité visible aux clients
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: 14.5,
              color: SET.inkSoft,
              fontWeight: 500,
              lineHeight: 1.55,
            }}
          >
            Ces informations apparaissent sur les annonces, mandats et communications.
            Soignez-les.
          </p>
        </div>

        {/* Card identité */}
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
                    borderRadius: 999,
                    background: data.avatarBg,
                    color: '#fff',
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 40,
                    fontWeight: 700,
                    boxShadow: '0 12px 30px rgba(0,65,217,0.30)',
                  }}
                >
                  {data.initials}
                </div>
                <button
                  title="Changer la photo"
                  style={{
                    position: 'absolute',
                    bottom: 4,
                    right: 4,
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
                  {data.firstName} {data.lastName}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: SET.muted,
                    fontWeight: 500,
                    marginTop: 2,
                  }}
                >
                  {data.title} · {data.agency}
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
                Téléverser une photo
              </button>
            </div>

            <div style={{ flex: 1, padding: '28px 32px' }}>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 16,
                  marginBottom: 16,
                }}
              >
                <SetInput
                  label="Prénom"
                  value={data.firstName}
                  onChange={v => set({ firstName: v })}
                />
                <SetInput
                  label="Nom"
                  value={data.lastName}
                  onChange={v => set({ lastName: v })}
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
                  label="Fonction"
                  value={data.title}
                  onChange={v => set({ title: v })}
                  hint="Ex. Agent principal, Courtière senior, Directeur"
                />
                <SetInput
                  label="Numéro RCC"
                  value={data.rcc}
                  onChange={v => set({ rcc: v })}
                  hint="Registre des courtiers"
                />
              </div>

              <div
                style={{
                  marginTop: 6,
                  padding: '14px 18px',
                  borderRadius: 14,
                  background: SET.cardSubtle,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      fontWeight: 700,
                      color: SET.muted,
                      letterSpacing: 0.6,
                      textTransform: 'uppercase',
                      marginBottom: 8,
                    }}
                  >
                    <span>Complétude du profil</span>
                    <span style={{ color: score === 100 ? SET.ok : SET.ink }}>
                      {score}%
                    </span>
                  </div>
                  <div
                    style={{
                      height: 6,
                      borderRadius: 999,
                      background: 'rgba(15,23,42,0.08)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${score}%`,
                        background: score === 100 ? SET.ok : SET.black,
                        borderRadius: 999,
                        transition: 'width .4s cubic-bezier(.2,.8,.2,1)',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </SetCard>

        {/* Coordonnées */}
        <SetCard
          title="Coordonnées"
          sub="Comment vos clients vous joignent. Apparaît sur les annonces et mandats."
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <SetInput
              label="Email professionnel"
              type="email"
              value={data.email}
              onChange={v => set({ email: v })}
            />
            <SetInput
              label="Téléphone fixe"
              type="tel"
              value={data.phone}
              onChange={v => set({ phone: v })}
            />
            <SetInput
              label="Téléphone mobile"
              type="tel"
              value={data.mobile}
              onChange={v => set({ mobile: v })}
            />
            <SetInput
              label="Agence"
              value={data.agency}
              onChange={v => set({ agency: v })}
              disabled
              hint="Modifiable depuis l'onglet Mon agence"
            />
          </div>
        </SetCard>

        {/* Bio */}
        <SetCard
          title="Présentation publique"
          sub="Ce texte apparaît sur votre profil agent visible aux acheteurs/vendeurs."
        >
          <SetTextarea
            value={data.bio}
            onChange={v => set({ bio: v })}
            placeholder="Présentez-vous en quelques phrases…"
            rows={5}
            max={500}
          />
        </SetCard>

        {/* Signature */}
        <SetCard
          title="Signature email"
          sub="Ajoutée automatiquement à vos emails sortants depuis le CRM."
        >
          <SetTextarea
            value={data.signature}
            onChange={v => set({ signature: v })}
            placeholder={'Cordialement,\nVotre nom\nAgence · Téléphone'}
            rows={4}
          />
          <div
            style={{
              marginTop: 14,
              padding: '14px 16px',
              borderRadius: 14,
              background: SET.cardSubtle,
            }}
          >
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                color: SET.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              Aperçu
            </div>
            <div
              style={{
                fontSize: 13,
                color: SET.inkSoft,
                lineHeight: 1.55,
                whiteSpace: 'pre-line',
                fontFamily: 'inherit',
              }}
            >
              {data.signature}
            </div>
          </div>
        </SetCard>
      </div>

      {/* Sticky save bar */}
      {dirty && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 100,
            background: SET.card,
            borderRadius: 999,
            padding: '8px 8px 8px 24px',
            boxShadow: '0 24px 60px rgba(11,12,14,0.20), 0 6px 20px rgba(11,12,14,0.10)',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            animation: 'setSlideUp .3s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: SET.inkSoft,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: 999,
                background: SET.warn,
              }}
            />
            Modifications non enregistrées
          </span>
          <SetGhostBtn onClick={handleCancel}>Annuler</SetGhostBtn>
          <SetBlackBtn
            onClick={handleSave}
            loading={isSaving}
            icon={!isSaving && <SetIcon name="check" size={14} stroke="#fff" sw={2.4} />}
          >
            {isSaving ? 'Enregistrement…' : 'Enregistrer'}
          </SetBlackBtn>
        </div>
      )}

      {/* Toast handled by global useToast() — top-right spring stack. */}

      {/* Confirm cancel modal */}
      {confirmOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 200,
            background: 'rgba(11,12,14,0.40)',
            backdropFilter: 'blur(8px)',
            display: 'grid',
            placeItems: 'center',
            animation: 'setFadeIn .2s ease both',
          }}
          onClick={() => setConfirmOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: SET.card,
              borderRadius: 24,
              padding: 32,
              maxWidth: 440,
              width: '90%',
              boxShadow: '0 40px 80px rgba(11,12,14,0.30)',
              animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
            }}
          >
            <h3
              style={{
                margin: '0 0 8px',
                fontSize: 20,
                fontWeight: 700,
                color: SET.ink,
                letterSpacing: -0.3,
              }}
            >
              Annuler les modifications ?
            </h3>
            <p
              style={{
                margin: '0 0 24px',
                fontSize: 14,
                color: SET.inkSoft,
                lineHeight: 1.55,
              }}
            >
              Vos changements seront perdus. Cette action est irréversible.
            </p>
            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                gap: 10,
              }}
            >
              <SetGhostBtn onClick={() => setConfirmOpen(false)}>
                Continuer l'édition
              </SetGhostBtn>
              <SetBlackBtn
                onClick={() => {
                  reset()
                  setConfirmOpen(false)
                }}
              >
                Annuler les modifs
              </SetBlackBtn>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
