/**
 * Page publique — gestion d'une visite par l'acheteur (sans login).
 *
 * Route : `/visit/:id/edit` ; l'auth se fait via le `?token=` du lien (le `:id`
 * n'est qu'affichage). Permet de reporter (choix date + créneau) ou d'annuler
 * la visite ; l'agent est notifié. Machine à 4 états : view / reschedule /
 * cancelled / rescheduled.
 */
import { useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CalendarDays, MapPin, Check, X, Loader2 } from 'lucide-react'
import { usePublicVisit, useRescheduleVisit, useCancelVisit, estRefus } from '@/hooks/useVisits'
import { MLK, MLK_STATUT } from '@/components/kyc-magic-link/mlkTokens'
import { MlkBackground, MlkShell, MlkWordmark, MlkFooter } from '@/components/kyc-magic-link/MlkPrimitives'

const TIME_SLOTS = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00']

/**
 * Les formes répétées de cette page — mêmes que celles de l'avis de visite, et
 * pour la même raison : écrites une fois, elles ne divergent pas.
 *
 * ⚠ LE FILET EST UNE OMBRE INTERNE, PAS UNE BORDURE. Une bordure occupe de la
 * place et décale la mise en page dès qu'elle change au survol ou à la
 * sélection ; `inset 0 0 0 1px` se pose PAR-DESSUS.
 *
 * ⚠ SA TEINTE VIENT DE `MLK.line` DEPUIS LE 16 AOÛT. Elle s'écrivait
 * `${MLK.ghost}33` — un jeton neutre suivi d'un suffixe d'opacité posé à la
 * main, la porte par laquelle une teinte entre sans qu'on la relise. Le filet
 * est un RÔLE, et il a un nom depuis la fusion des deux familles publiques.
 */
const FILET = `inset 0 0 0 1px ${MLK.line}`
const TITRE = { fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, margin: 0 }
const SOUS = { fontSize: 'var(--crm-text-lg)', color: MLK.muted }

/**
 * La coquille commune aux six vues de cette page.
 *
 * ⛔ ELLE REMPLACE `PublicPageHeader`, ET CE N'EST PAS QU'UNE QUESTION DE MARQUE.
 * Cet en-tête était peint en jetons du CRM (`bg-theme-page`, `border-theme-border`)
 * et portait un `dark:invert` — donc une BRANCHE DE THÈME SOMBRE sur une face
 * que deux gardes déclarent mono-thème. Elles ne le voyaient pas : elles
 * balaient les pages et `kyc-magic-link/`, pas `components/layout/`.
 *
 * ⚠ Le fond passe du BLANC au dégradé. Ces deux pages étaient les seules
 * surfaces clientes posées sur `MLK.card` en pleine page ; les six autres
 * vivent sur `MLK.bgGradient`, contenu dans une carte.
 */
function Coquille({ children }: { children: ReactNode }) {
  return (
    <MlkBackground>
      <MlkShell width={448} pad={32}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 'var(--crm-space-6xl)' }}>
          <MlkWordmark size={18} />
        </div>
        {children}
        <MlkFooter />
      </MlkShell>
    </MlkBackground>
  )
}

/** Le disque d'un écran de fin — une DONNÉE : rien ne s'y actionne. */
const disque = (ton: 'ok' | 'err'): CSSProperties => ({
  background: ton === 'ok' ? MLK_STATUT.okFill : MLK_STATUT.errFill,
})

/**
 * La pastille sélectionnable — jour, créneau.
 *
 * ⛔ ICI TOUT PREND L'ACCENT quand c'est actif, contrairement à l'avis de visite
 * où deux familles gardent un ton : un jour et une heure n'ont pas de POLARITÉ,
 * ils disent seulement « vous avez choisi ceci ». C'est la règle du 10 août dans
 * son cas le plus simple.
 */
function pastille(actif: boolean): CSSProperties {
  const base: CSSProperties = { fontFamily: 'inherit', border: 0, cursor: 'pointer' }
  return actif
    ? { ...base, fontWeight: 500, color: MLK.accent, background: `${MLK.accent}0D`, boxShadow: `inset 0 0 0 1px ${MLK.accent}` }
    : { ...base, color: MLK.inkSoft, background: 'transparent', boxShadow: FILET }
}

export default function VisitManagePage() {
  // Visit ID from URL (used for display, token used for auth)
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || undefined

  const { data: visit, isLoading } = usePublicVisit(token)
  const reschedule = useRescheduleVisit()
  const cancel = useCancelVisit()

  const [mode, setMode] = useState<'view' | 'reschedule' | 'cancelled' | 'rescheduled'>('view')
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('')

  if (isLoading) {
    return (
      <Coquille>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <div
            className="h-8 w-8 rounded-full animate-spin mb-4"
            style={{ border: `2px solid ${MLK.line}`, borderTopColor: MLK.accent }}
          />
          <p style={SOUS}>Chargement...</p>
        </div>
      </Coquille>
    )
  }

  if (!visit || !token) {
    return (
      <Coquille>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink, marginBottom: 8 }}>Lien invalide</p>
          <p style={SOUS}>Ce lien de gestion de visite est expiré ou invalide.</p>
        </div>
      </Coquille>
    )
  }

  const visitDate = new Date(visit.scheduled_at)
  const dateFR = visitDate.toLocaleDateString('fr-CH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  const timeFR = visitDate.toLocaleTimeString('fr-CH', { hour: '2-digit', minute: '2-digit' })
  const property = visit.property
  const photo = property?.photos?.[0]

  const dates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() + i + 1)
    return d
  })

  // Le refus est rendu par le bloc « lien plus valable » ; on avale donc le rejet
  // ici, sinon `mutateAsync` le repropage en rejet non capturé alors que l'état
  // d'erreur de la mutation porte déjà l'information.
  async function handleReschedule() {
    if (!newDate || !token) return
    const scheduledAt = newTime
      ? new Date(`${newDate}T${newTime}:00`).toISOString()
      : new Date(`${newDate}T10:00:00`).toISOString()
    try {
      await reschedule.mutateAsync({ token, newDate: scheduledAt })
      setMode('rescheduled')
    } catch { /* état porté par reschedule.isError */ }
  }

  async function handleCancel() {
    if (!token) return
    try {
      await cancel.mutateAsync(token)
      setMode('cancelled')
    } catch { /* état porté par cancel.isError */ }
  }

  if (mode === 'cancelled') {
    return (
      <Coquille>
        <div className="text-center">
          <div className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4" style={disque('err')}>
            <X className="h-6 w-6" style={{ color: MLK_STATUT.errInk }} />
          </div>
          <h2 style={TITRE}>Visite annulée</h2>
          <p style={{ ...SOUS, marginTop: 8 }}>L'agent a été notifié de l'annulation.</p>
        </div>
      </Coquille>
    )
  }

  if (mode === 'rescheduled') {
    return (
      <Coquille>
        <div className="text-center">
          <div className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4" style={disque('ok')}>
            <Check className="h-6 w-6" style={{ color: MLK_STATUT.okInk }} />
          </div>
          <h2 style={TITRE}>Visite reportée</h2>
          <p style={{ ...SOUS, marginTop: 8 }}>L'agent a été notifié du nouveau créneau.</p>
        </div>
      </Coquille>
    )
  }

  if (visit.status === 'cancelled') {
    return (
      <Coquille>
        <div className="text-center">
          <p style={TITRE}>Cette visite a été annulée</p>
        </div>
      </Coquille>
    )
  }

  return (
    <Coquille>
      <div>
        {/* Visit summary card */}
        <div className="rounded-xl overflow-hidden mb-8" style={{ boxShadow: FILET }}>
          {photo && (
            <div className="aspect-[16/9]">
              {/* no-referrer : le token de gestion est dans la query de CETTE page,
                  et un Referer l'emporterait vers l'hôte des photos. */}
              <img src={photo} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" decoding="async" />
            </div>
          )}
          <div className="p-5 space-y-3">
            <h2 style={TITRE}>{property?.title || 'Visite planifiée'}</h2>
            {property?.address && (
              <div className="flex items-center gap-2" style={SOUS}>
                <MapPin className="h-4 w-4 flex-shrink-0" />
                {property.address}, {property.city}
              </div>
            )}
            <div className="flex items-center gap-2" style={{ fontSize: 'var(--crm-text-lg)', color: MLK.inkSoft }}>
              <CalendarDays className="h-4 w-4 flex-shrink-0" style={{ color: MLK.accent }} />
              <span className="font-medium capitalize">{dateFR}</span> à <span className="font-medium">{timeFR}</span>
            </div>
          </div>
        </div>

        {/* Refus du geste : le lien est lisible mais n'ouvre plus ce droit
            (visite déjà annulée ou close par l'agent, fenêtre du lien passée).
            Sans ce bloc, l'écran de succès s'afficherait sur un geste qui n'a
            rien écrit et l'acheteur repartirait convaincu du contraire. */}
        {(cancel.isError || reschedule.isError) && (
          <div
            className="mb-4 rounded-xl px-4 py-3"
            style={{ background: MLK_STATUT.warnFill, boxShadow: `inset 0 0 0 1px ${MLK_STATUT.warnLine}` }}
          >
            {estRefus(cancel.error) || estRefus(reschedule.error) ? (
              <>
                <p style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: MLK_STATUT.warnInk, margin: 0 }}>Ce lien ne permet plus cette action</p>
                <p style={{ fontSize: 'var(--crm-text-sm)', color: MLK_STATUT.warnInk, marginTop: 4 }}>
                  La visite a peut-être déjà été annulée ou clôturée. Contactez votre agent pour la modifier.
                </p>
              </>
            ) : (
              <>
                <p style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: MLK_STATUT.warnInk, margin: 0 }}>L'action n'a pas abouti</p>
                <p style={{ fontSize: 'var(--crm-text-sm)', color: MLK_STATUT.warnInk, marginTop: 4 }}>
                  Vérifiez votre connexion et réessayez.
                </p>
              </>
            )}
          </div>
        )}

        {/* Actions */}
        {mode === 'view' && (
          <div className="space-y-3">
            <button
              onClick={() => setMode('reschedule')}
              className="w-full h-11 rounded-xl transition-colors"
              style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, border: 0, cursor: 'pointer', background: MLK.accent, color: '#FFFFFF' }}
            >
              Reporter la visite
            </button>
            <button
              onClick={handleCancel}
              disabled={cancel.isPending}
              className="w-full h-11 rounded-xl transition-colors flex items-center justify-center gap-2"
              style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, border: 0, cursor: 'pointer', background: 'transparent', color: MLK_STATUT.errInk, boxShadow: `inset 0 0 0 1px ${MLK_STATUT.errLine}` }}
            >
              {cancel.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Annuler la visite
            </button>
          </div>
        )}

        {/* Reschedule form */}
        {mode === 'reschedule' && (
          <div className="space-y-4">
            <h3 style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: MLK.ink, margin: 0 }}>Choisir une nouvelle date</h3>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
              {dates.map((d) => {
                const key = d.toISOString().split('T')[0]
                const dayName = d.toLocaleDateString('fr-CH', { weekday: 'short' })
                const dayNum = d.getDate()
                return (
                  <button
                    key={key}
                    onClick={() => setNewDate(key)}
                    className="flex flex-col items-center min-w-[56px] px-2 py-2 rounded-lg transition-colors"
                    style={{ ...pastille(newDate === key), fontSize: 'var(--crm-text-sm)' }}
                  >
                    <span className="capitalize">{dayName}</span>
                    <span className="mt-0.5" style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600 }}>{dayNum}</span>
                  </button>
                )
              })}
            </div>

            {newDate && (
              <div className="flex flex-wrap gap-1.5">
                {TIME_SLOTS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setNewTime(t)}
                    className="px-3 py-1.5 rounded-lg transition-colors"
                    style={{ ...pastille(newTime === t), fontSize: 'var(--crm-text-sm)', fontWeight: 500 }}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setMode('view')}
                className="flex-1 h-10 rounded-lg transition-colors"
                style={{ fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', border: 0, cursor: 'pointer', background: 'transparent', color: MLK.inkSoft, boxShadow: FILET }}
              >
                Retour
              </button>
              <button
                onClick={handleReschedule}
                disabled={!newDate || reschedule.isPending}
                className="flex-1 h-10 rounded-lg transition-colors flex items-center justify-center gap-2"
                style={{
                  fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, border: 0,
                  ...(newDate && !reschedule.isPending
                    ? { background: MLK.accent, color: '#FFFFFF', cursor: 'pointer' }
                    : { background: MLK.cardSubtle, color: MLK.ghost, cursor: 'not-allowed' }),
                }}
              >
                {reschedule.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirmer
              </button>
            </div>
          </div>
        )}
      </div>
    </Coquille>
  )
}
