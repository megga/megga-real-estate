// MEGGA CRM Sprint 2 — Modal Planifier une visite Sugar Pure
// Port pixel-près de crm-visit-modal-sugar.jsx (handoff Sprint 2).
//
// 3 étapes :
//   1. Bien & visiteur (sélection split-view + recherche)
//   2. Date, heure, durée + suggestions MEGGA AI
//   3. Détails & confirmation (récap noir + 3 toggles automatisations)
//
// Route : /dashboard/visites/nouveau?bienId=X&contactId=Y
// Au submit : useCreateAgentVisit → redirect /dashboard/visites/:newId

import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { SugarV3, SUGAR_V3_KEYFRAMES } from '@/components/crm-sugar-v3/tokens'
import { SgIcon } from '@/components/crm-sugar-v3/icons'
import { useAgencyProperties } from '@/hooks/useProperties'
import { useContacts } from '@/hooks/useContacts'
import { useCreateAgentVisit } from '@/hooks/useVisitDetail'
import { useGoogleCalendar } from '@/hooks/useGoogleCalendar'
import { useOutlookCalendar } from '@/hooks/useOutlookCalendar'

const STEPS = ['Bien & visiteur', 'Date & heure', 'Confirmation'] as const

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 50,
  padding: '0 18px',
  background: SugarV3.cardSubtle,
  border: 0,
  borderRadius: 14,
  fontFamily: 'inherit',
  fontSize: 15,
  fontWeight: 600,
  color: SugarV3.ink,
  outline: 'none',
  boxSizing: 'border-box',
}

function Field({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label
        style={{
          display: 'block',
          fontSize: 11.5,
          fontWeight: 600,
          color: SugarV3.muted,
          textTransform: 'uppercase',
          letterSpacing: 0.6,
          marginBottom: 8,
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <div
          style={{
            marginTop: 6,
            fontSize: 11.5,
            color: SugarV3.muted,
            fontWeight: 500,
          }}
        >
          {hint}
        </div>
      )}
    </div>
  )
}

export default function VisitModalSugarV3Page() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const defaultBienId = params.get('bienId') ?? null
  const defaultContactId = params.get('contactId') ?? null
  const dealId = params.get('dealId') ?? null

  const [step, setStep] = useState(0)
  const [bienId, setBienId] = useState<string | null>(defaultBienId)
  const [contactId, setContactId] = useState<string | null>(defaultContactId)
  const [bienQuery, setBienQuery] = useState('')
  const [contactQuery, setContactQuery] = useState('')

  const today = new Date()
  const defaultDate = new Date(today.getTime() + 2 * 86_400_000)
    .toISOString()
    .split('T')[0]
  const [date, setDate] = useState(defaultDate)
  const [time, setTime] = useState('14:00')
  const [duration, setDuration] = useState(45)

  const [emailVisitor, setEmailVisitor] = useState(true)
  const [genBon, setGenBon] = useState(true)
  const [askSignature, setAskSignature] = useState(true)

  const { data: allBiens } = useAgencyProperties()
  const { contacts: allContacts } = useContacts()
  const {
    mutate: createVisit,
    isPending: isSaving,
    error: saveError,
  } = useCreateAgentVisit()
  // Auto-sync vers les calendriers connectés après création de la visite.
  // Le hook n'expose pas de range ici (pas besoin d'events pour ce flow).
  const {
    isConnected: gcalConnected,
    syncVisitToGoogle,
  } = useGoogleCalendar()
  const {
    isConnected: ocalConnected,
    syncVisitToOutlook,
  } = useOutlookCalendar()

  const activeBiens = useMemo(
    () => (allBiens ?? []).filter((b) => b.status === 'active'),
    [allBiens],
  )
  const allBuyers = useMemo(
    () => (allContacts ?? []).filter((c) => c.type !== 'seller'),
    [allContacts],
  )

  const bien = bienId ? activeBiens.find((b) => b.id === bienId) : null
  const contact = contactId
    ? allBuyers.find((c) => c.id === contactId)
    : null

  const filteredBiens = activeBiens
    .filter(
      (b) =>
        !bienQuery ||
        `${b.title} ${b.address} ${b.city}`
          .toLowerCase()
          .includes(bienQuery.toLowerCase()),
    )
    .slice(0, 6)
  const filteredContacts = allBuyers
    .filter(
      (c) =>
        !contactQuery ||
        `${c.first_name} ${c.last_name} ${c.email}`
          .toLowerCase()
          .includes(contactQuery.toLowerCase()),
    )
    .slice(0, 6)

  const canContinue = step === 0 ? !!(bienId && contactId) : true

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const close = () => {
    if (bienId) navigate(`/dashboard/listings/${bienId}`)
    else navigate('/dashboard/calendar')
  }

  const submit = () => {
    if (!bienId || !contactId) return
    const scheduledAt = new Date(`${date}T${time}:00`).toISOString()
    createVisit(
      {
        bienId,
        contactId,
        dealId,
        scheduledAt,
        durationMinutes: duration,
        generateBon: genBon,
        visitorNames: contact
          ? [`${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim()]
          : [],
        visitorIds: [contactId],
        automations: { emailVisitor, askSignature },
      },
      {
        onSuccess: (newVisit) => {
          // Push silencieux vers les calendriers connectés (best effort).
          // Échec non bloquant : le user voit la visite créée même si Google
          // est down, puis peut re-synchroniser manuellement depuis la fiche.
          if (gcalConnected && newVisit?.id) {
            syncVisitToGoogle(newVisit.id).catch(() => {})
          }
          if (ocalConnected && newVisit?.id) {
            syncVisitToOutlook(newVisit.id).catch(() => {})
          }
          navigate(`/dashboard/visites/${newVisit.id}`)
        },
      },
    )
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: SugarV3.bgGradient,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: SugarV3.font,
      }}
    >
      <style>{SUGAR_V3_KEYFRAMES}</style>

      <header
        style={{
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 20,
          flexShrink: 0,
        }}
      >
        <button
          onClick={close}
          title="Fermer"
          style={{
            width: 44,
            height: 44,
            borderRadius: 999,
            border: 0,
            background: SugarV3.cardSubtle,
            color: SugarV3.inkSoft,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            boxShadow: SugarV3.shadowSm,
          }}
        >
          <SgIcon name="close" size={18} stroke={SugarV3.inkSoft} />
        </button>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 11.5,
              fontWeight: 600,
              color: SugarV3.muted,
              textTransform: 'uppercase',
              letterSpacing: 0.6,
            }}
          >
            Planifier une visite
          </div>
        </div>
        {/* Stepper compact */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
          {STEPS.map((s, i) => {
            const done = i < step
            const active = i === step
            return (
              <span
                key={s}
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 999,
                      background:
                        active || done ? SugarV3.ink : SugarV3.cardSubtle,
                      color: active || done ? '#fff' : SugarV3.muted,
                      fontSize: 11,
                      fontWeight: 700,
                      display: 'grid',
                      placeItems: 'center',
                      boxShadow: active
                        ? '0 0 0 5px rgba(11,12,14,0.10), 0 4px 12px rgba(11,12,14,0.18)'
                        : 'none',
                    }}
                  >
                    {done ? (
                      <SgIcon name="check" size={13} stroke="#fff" sw={2.5} />
                    ) : (
                      i + 1
                    )}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: active || done ? 700 : 500,
                      color: active
                        ? SugarV3.ink
                        : done
                          ? SugarV3.inkSoft
                          : SugarV3.muted,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {s}
                  </div>
                </div>
                {i < STEPS.length - 1 && (
                  <div
                    style={{
                      width: 48,
                      height: 2,
                      margin: '0 14px',
                      background: i < step ? SugarV3.ink : SugarV3.cardSubtle,
                    }}
                  />
                )}
              </span>
            )
          })}
        </div>
      </header>

      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '20px 40px 40px',
        }}
      >
        <div
          key={step}
          style={{
            maxWidth: 920,
            margin: '0 auto',
            animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both',
          }}
        >
          {/* STEP 0 — BIEN & VISITEUR */}
          {step === 0 && (
            <>
              <div style={{ marginBottom: 36, maxWidth: 720 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: SugarV3.muted,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    marginBottom: 14,
                  }}
                >
                  Étape 1 sur 3 · Quoi & qui
                </div>
                <h1
                  style={{
                    margin: '0 0 14px',
                    fontSize: 38,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.8,
                    lineHeight: 1.1,
                  }}
                >
                  Quel bien fait-on visiter, et à qui&nbsp;?
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: SugarV3.inkSoft,
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  Lisez la liste — vous pouvez aussi rechercher par nom,
                  adresse ou ville.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 24,
                }}
              >
                {/* Bien */}
                <div>
                  <Field label="Bien à visiter">
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      <input
                        type="text"
                        value={bienQuery}
                        onChange={(e) => setBienQuery(e.target.value)}
                        placeholder="Titre, adresse, ville…"
                        style={{ ...inputStyle, paddingLeft: 44 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          left: 16,
                          top: 17,
                          pointerEvents: 'none',
                        }}
                      >
                        <SgIcon name="search" size={15} stroke={SugarV3.muted} sw={1.8} />
                      </span>
                    </div>
                  </Field>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: 360,
                      overflowY: 'auto',
                    }}
                  >
                    {filteredBiens.map((b) => {
                      const sel = b.id === bienId
                      return (
                        <button
                          key={b.id}
                          onClick={() => setBienId(b.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '14px 16px',
                            background: sel ? SugarV3.card : SugarV3.cardSubtle,
                            border: 0,
                            borderRadius: 16,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            boxShadow: sel
                              ? `0 0 0 2px ${SugarV3.ink} inset, ${SugarV3.shadow}`
                              : 'none',
                            transition: 'all .15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 12,
                              flexShrink: 0,
                              background: SugarV3.ink,
                              color: '#fff',
                              display: 'grid',
                              placeItems: 'center',
                            }}
                          >
                            <SgIcon name="home" size={15} stroke="#fff" sw={1.8} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: SugarV3.ink,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {b.title}
                            </div>
                            <div
                              style={{
                                fontSize: 11.5,
                                color: SugarV3.muted,
                                fontWeight: 500,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {b.address} · {b.city}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                    {filteredBiens.length === 0 && (
                      <div
                        style={{
                          padding: 14,
                          borderRadius: 14,
                          background: SugarV3.cardSubtle,
                          fontSize: 12.5,
                          color: SugarV3.muted,
                          fontWeight: 500,
                          textAlign: 'center',
                        }}
                      >
                        Aucun bien actif ne correspond.
                      </div>
                    )}
                  </div>
                </div>

                {/* Contact */}
                <div>
                  <Field label="Visiteur">
                    <div style={{ position: 'relative', marginBottom: 14 }}>
                      <input
                        type="text"
                        value={contactQuery}
                        onChange={(e) => setContactQuery(e.target.value)}
                        placeholder="Nom, email, téléphone…"
                        style={{ ...inputStyle, paddingLeft: 44 }}
                      />
                      <span
                        style={{
                          position: 'absolute',
                          left: 16,
                          top: 17,
                          pointerEvents: 'none',
                        }}
                      >
                        <SgIcon name="search" size={15} stroke={SugarV3.muted} sw={1.8} />
                      </span>
                    </div>
                  </Field>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      maxHeight: 360,
                      overflowY: 'auto',
                    }}
                  >
                    {filteredContacts.map((c) => {
                      const sel = c.id === contactId
                      const initials =
                        `${c.first_name?.[0] ?? ''}${c.last_name?.[0] ?? ''}`.toUpperCase()
                      return (
                        <button
                          key={c.id}
                          onClick={() => setContactId(c.id)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '14px 16px',
                            background: sel ? SugarV3.card : SugarV3.cardSubtle,
                            border: 0,
                            borderRadius: 16,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            boxShadow: sel
                              ? `0 0 0 2px ${SugarV3.ink} inset, ${SugarV3.shadow}`
                              : 'none',
                            transition: 'all .15s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                          }}
                        >
                          <div
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 999,
                              flexShrink: 0,
                              background: SugarV3.ink,
                              color: '#fff',
                              display: 'grid',
                              placeItems: 'center',
                              fontWeight: 700,
                              fontSize: 12,
                            }}
                          >
                            {initials}
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 13.5,
                                fontWeight: 700,
                                color: SugarV3.ink,
                              }}
                            >
                              {c.first_name} {c.last_name}
                            </div>
                            <div
                              style={{
                                fontSize: 11.5,
                                color: SugarV3.muted,
                                fontWeight: 500,
                              }}
                            >
                              {c.email ?? '—'}
                            </div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STEP 1 — DATE / HEURE / DURÉE */}
          {step === 1 && (
            <>
              <div style={{ marginBottom: 36, maxWidth: 720 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: SugarV3.muted,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    marginBottom: 14,
                  }}
                >
                  Étape 2 sur 3 · Quand
                </div>
                <h1
                  style={{
                    margin: '0 0 14px',
                    fontSize: 38,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.8,
                    lineHeight: 1.1,
                  }}
                >
                  Quel jour, quelle heure&nbsp;?
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: SugarV3.inkSoft,
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  Le bon de visite sera prêt à signer dès la confirmation.
                </p>
              </div>

              <div
                style={{
                  background: SugarV3.card,
                  borderRadius: 24,
                  boxShadow: SugarV3.shadowLg,
                  padding: 36,
                  maxWidth: 720,
                }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.4fr 1fr 1fr',
                    gap: 22,
                  }}
                >
                  <Field label="Date">
                    <input
                      type="date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Heure">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      style={inputStyle}
                    />
                  </Field>
                  <Field label="Durée">
                    <select
                      value={duration}
                      onChange={(e) => setDuration(+e.target.value)}
                      style={{ ...inputStyle, appearance: 'none', paddingRight: 36 }}
                    >
                      <option value={30}>30 minutes</option>
                      <option value={45}>45 minutes</option>
                      <option value={60}>1 heure</option>
                      <option value={90}>1h30</option>
                    </select>
                  </Field>
                </div>

                {/* Suggestions IA */}
                <div style={{ marginTop: 26 }}>
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: SugarV3.muted,
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginBottom: 10,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <SgIcon name="sparkle" size={12} stroke={SugarV3.muted} sw={1.8} />
                    Créneaux conseillés par MEGGA AI
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {['Demain · 10:00', 'Demain · 17:00', 'Sam. · 11:00', 'Mar. · 18:30'].map(
                      (s) => (
                        <button
                          key={s}
                          style={{
                            height: 38,
                            padding: '0 16px',
                            borderRadius: 999,
                            border: 0,
                            background: SugarV3.cardSubtle,
                            color: SugarV3.inkSoft,
                            fontFamily: 'inherit',
                            fontSize: 12.5,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          {s}
                        </button>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* STEP 2 — CONFIRMATION */}
          {step === 2 && (
            <>
              <div style={{ marginBottom: 36, maxWidth: 720 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: SugarV3.muted,
                    letterSpacing: 1.2,
                    textTransform: 'uppercase',
                    marginBottom: 14,
                  }}
                >
                  Étape 3 sur 3 · Détails & confirmation
                </div>
                <h1
                  style={{
                    margin: '0 0 14px',
                    fontSize: 38,
                    fontWeight: 700,
                    color: SugarV3.ink,
                    letterSpacing: -0.8,
                    lineHeight: 1.1,
                  }}
                >
                  Tout est prêt&nbsp;?
                </h1>
                <p
                  style={{
                    margin: 0,
                    fontSize: 15,
                    color: SugarV3.inkSoft,
                    fontWeight: 500,
                    lineHeight: 1.55,
                  }}
                >
                  Choisissez ce qu'on automatise pour vous.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 20,
                  maxWidth: 920,
                }}
              >
                {/* Récap noir */}
                <div
                  style={{
                    background: SugarV3.ink,
                    color: '#fff',
                    borderRadius: 24,
                    padding: 32,
                    boxShadow: SugarV3.shadow,
                  }}
                >
                  <div
                    style={{
                      fontSize: 11.5,
                      fontWeight: 600,
                      color: 'rgba(255,255,255,0.6)',
                      textTransform: 'uppercase',
                      letterSpacing: 0.6,
                      marginBottom: 22,
                    }}
                  >
                    Récapitulatif
                  </div>
                  {(
                    [
                      {
                        l: 'Bien',
                        icon: 'home',
                        v: bien?.title ?? '—',
                        sub: bien?.address,
                      },
                      {
                        l: 'Visiteur',
                        icon: 'user',
                        v: contact
                          ? `${contact.first_name} ${contact.last_name}`
                          : '—',
                        sub: contact?.email ?? undefined,
                      },
                      {
                        l: 'Date',
                        icon: 'cal',
                        v: new Date(date).toLocaleDateString('fr-CH', {
                          weekday: 'long',
                          day: '2-digit',
                          month: 'long',
                        }),
                        sub: `${time} (${duration} min)`,
                      },
                    ] as Array<{
                      l: string
                      icon: string
                      v: string
                      sub?: string | null
                    }>
                  ).map((r) => (
                    <div
                      key={r.l}
                      style={{
                        marginBottom: 18,
                        display: 'flex',
                        gap: 12,
                        alignItems: 'flex-start',
                      }}
                    >
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          borderRadius: 999,
                          flexShrink: 0,
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        <SgIcon name={r.icon} size={14} stroke="#fff" sw={1.8} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'rgba(255,255,255,0.6)',
                            fontWeight: 600,
                            textTransform: 'uppercase',
                            letterSpacing: 0.5,
                            marginBottom: 2,
                          }}
                        >
                          {r.l}
                        </div>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: '#fff',
                          }}
                        >
                          {r.v}
                        </div>
                        {r.sub && (
                          <div
                            style={{
                              fontSize: 12,
                              color: 'rgba(255,255,255,0.6)',
                              fontWeight: 500,
                              marginTop: 2,
                            }}
                          >
                            {r.sub}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Toggles automatisations */}
                <div
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {[
                    {
                      l: 'Email au visiteur',
                      sub: 'Confirmation avec adresse + accès + photo du bien.',
                      v: emailVisitor,
                      set: setEmailVisitor,
                    },
                    {
                      l: 'Générer le bon de visite',
                      sub: "PDF MEGGA pré-rempli avec engagement du visiteur.",
                      v: genBon,
                      set: setGenBon,
                    },
                    {
                      l: 'Demander signature avant',
                      sub: 'Lien sécurisé envoyé au visiteur 24h avant.',
                      v: askSignature,
                      set: setAskSignature,
                    },
                  ].map((opt) => (
                    <button
                      key={opt.l}
                      onClick={() => opt.set(!opt.v)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: 22,
                        background: opt.v ? SugarV3.card : SugarV3.cardSubtle,
                        border: 0,
                        borderRadius: 20,
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        boxShadow: opt.v
                          ? `0 0 0 2px ${SugarV3.ink} inset, ${SugarV3.shadow}`
                          : 'none',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 14,
                        transition: 'all .15s ease',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: SugarV3.ink,
                            marginBottom: 3,
                          }}
                        >
                          {opt.l}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: SugarV3.muted,
                            fontWeight: 500,
                            lineHeight: 1.5,
                          }}
                        >
                          {opt.sub}
                        </div>
                      </div>
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          flexShrink: 0,
                          background: opt.v ? SugarV3.ink : SugarV3.card,
                          boxShadow: opt.v
                            ? 'none'
                            : `0 0 0 2px ${SugarV3.cardSubtle} inset`,
                          display: 'grid',
                          placeItems: 'center',
                        }}
                      >
                        {opt.v && (
                          <SgIcon name="check" size={13} stroke="#fff" sw={3} />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <footer
        style={{
          padding: '20px 40px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          flexShrink: 0,
          background: SugarV3.card,
          boxShadow: '0 -8px 24px rgba(15,23,42,0.04)',
        }}
      >
        <button
          onClick={() => (step > 0 ? setStep(step - 1) : close())}
          style={{
            height: 50,
            padding: '0 24px',
            borderRadius: 999,
            border: 0,
            background: 'transparent',
            color: SugarV3.inkSoft,
            fontFamily: 'inherit',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 9,
          }}
        >
          <SgIcon name="arrowL" size={15} stroke={SugarV3.inkSoft} />
          {step === 0 ? 'Annuler' : 'Retour'}
        </button>
        <div style={{ flex: 1 }} />
        {saveError && (
          <div
            role="alert"
            style={{
              fontSize: 12.5,
              color: SugarV3.err,
              fontWeight: 600,
              marginRight: 12,
            }}
          >
            {saveError.message}
          </div>
        )}
        <div
          style={{ fontSize: 12.5, color: SugarV3.muted, fontWeight: 600 }}
        >
          Étape {step + 1} / {STEPS.length}
        </div>
        {step < STEPS.length - 1 ? (
          <button
            disabled={!canContinue}
            onClick={() => canContinue && setStep(step + 1)}
            style={{
              height: 50,
              padding: '0 28px',
              borderRadius: 999,
              border: 0,
              background: canContinue ? SugarV3.black : SugarV3.ghost,
              color: '#fff',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 14.5,
              cursor: canContinue ? 'pointer' : 'not-allowed',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              boxShadow: canContinue
                ? '0 6px 16px rgba(11,12,14,0.18)'
                : 'none',
            }}
          >
            Continuer
            <SgIcon name="arrowR" size={14} stroke="#fff" />
          </button>
        ) : (
          <button
            onClick={submit}
            disabled={isSaving}
            style={{
              height: 50,
              padding: '0 28px',
              borderRadius: 999,
              border: 0,
              background: isSaving ? SugarV3.ghost : SugarV3.black,
              color: '#fff',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 14.5,
              cursor: isSaving ? 'not-allowed' : 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 9,
              boxShadow: '0 6px 16px rgba(11,12,14,0.18)',
            }}
          >
            <SgIcon name="check" size={14} stroke="#fff" sw={2.5} />
            {isSaving ? 'Planification…' : 'Planifier la visite'}
          </button>
        )}
      </footer>
    </div>
  )
}
