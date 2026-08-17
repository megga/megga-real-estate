/**
 * Page publique — retour de visite pour l'acheteur (sans login).
 *
 * Route : `/visit/:id/feedback` ; l'auth se fait via le `?token=` du lien
 * (le `:id` n'est qu'affichage). Formulaire note étoiles + points forts /
 * objections + intérêt d'offre ; le retour est anonymisé côté vendeur.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CSSProperties, ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Star, Check, Loader2, MapPin } from 'lucide-react'
import { usePublicVisit, useSubmitFeedback, estRefus } from '@/hooks/useVisits'
import { MLK, MLK_STATUT } from '@/components/kyc-magic-link/mlkTokens'
import { MlkBackground, MlkShell, MlkWordmark, MlkFooter } from '@/components/kyc-magic-link/MlkPrimitives'

/**
 * Les quatre formes que cette page répète — écrites une fois pour qu'elles ne
 * divergent pas, comme `MlkPrimitives` le fait pour le parcours KYC.
 *
 * ⚠ LE FILET EST UNE OMBRE INTERNE, PAS UNE BORDURE. Une bordure occupe de la
 * place et décale la mise en page dès qu'elle change d'épaisseur au survol ou à
 * la sélection ; `inset 0 0 0 1px` se pose PAR-DESSUS. C'est ce que la face
 * publique déjà portée emploie.
 *
 * ⚠ SA TEINTE VIENT DE `MLK.line` DEPUIS LE 16 AOÛT — voir la page jumelle
 * (`VisitManagePage`) : `${MLK.ghost}33` posait un suffixe d'opacité à la main.
 */
const FILET = `inset 0 0 0 1px ${MLK.line}`
const CARTE = { boxShadow: FILET }
const LABEL = { fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: MLK.inkSoft }

/**
 * La coquille commune aux quatre vues — identique à celle de la page jumelle.
 *
 * ⛔ ELLE REMPLACE `PublicPageHeader`, qui était peint en jetons du CRM
 * (`bg-theme-page`, `border-theme-border`) et portait un `dark:invert` : une
 * branche de thème SOMBRE sur une face que deux gardes déclarent mono-thème.
 * Elles balaient les pages et `kyc-magic-link/`, pas `components/layout/`.
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

/**
 * La pastille sélectionnable, en trois tons.
 *
 * ⛔ ET LE TON N'EST PAS DÉCORATIF : `ok` et `err` disent une POLARITÉ (point
 * fort / point à améliorer) — c'est une DONNÉE, elle garde son ton même
 * sélectionnée. `accent` dit « vous avez choisi ceci » sur un choix qui n'a pas
 * de polarité (oui / peut-être / non) : là, la règle du 10 août s'applique et
 * l'élément actif porte l'accent. L'accent marque ce qu'on a FAIT ; le ton dit
 * ce que la chose EST.
 */
function pastille(actif: boolean, ton: 'ok' | 'err' | 'accent'): CSSProperties {
  const base: CSSProperties = {
    fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', border: 0, cursor: 'pointer',
  }
  if (!actif) return { ...base, color: MLK.inkSoft, background: 'transparent', boxShadow: FILET }
  if (ton === 'accent') {
    return { ...base, fontWeight: 500, color: MLK.accent, background: `${MLK.accent}0D`, boxShadow: `inset 0 0 0 1px ${MLK.accent}` }
  }
  const [encre, aplat, filet] = ton === 'ok'
    ? [MLK_STATUT.okInk, MLK_STATUT.okFill, MLK_STATUT.okLine]
    : [MLK_STATUT.errInk, MLK_STATUT.errFill, MLK_STATUT.errLine]
  return { ...base, fontWeight: 500, color: encre, background: aplat, boxShadow: `inset 0 0 0 1px ${filet}` }
}

/**
 * ⛔ LA CLÉ EST STOCKÉE, LE LIBELLÉ EST TRADUIT — et l'ordre des deux compte.
 *
 * Ces tableaux portaient des chaînes FRANÇAISES, et ce ne sont pas des libellés :
 * ils partent tels quels dans `submit_visit_feedback_by_token`, qui les range
 * dans `visits.ai_objections`. Les traduire aurait fait stocker « Helligkeit »
 * pour un client alémanique et « Luminosité » pour un romand — la même donnée
 * sous deux formes, illisible pour l'agent comme pour toute agrégation.
 *
 * ⚠ Le changement de format est SANS MIGRATION parce que la table est vide :
 * `select count(*) from visits` rendait 0 le 17 août 2026. C'était donc le
 * dernier moment où ce défaut se corrigeait gratuitement.
 */
const STRENGTHS = ['light', 'layout', 'neighbourhood', 'condition', 'view', 'quiet', 'size', 'storage'] as const

const OBJECTIONS = ['price', 'too_small', 'noise', 'works', 'floor', 'no_parking', 'low_light', 'other'] as const

export default function VisitFeedbackPage() {
  // Visit ID from URL (used for display, token used for auth)
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || undefined

  const { data: visit, isLoading } = usePublicVisit(token)
  const submitFeedback = useSubmitFeedback()

  const { t } = useTranslation('kyc')
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [strengths, setStrengths] = useState<string[]>([])
  const [objections, setObjections] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [offerInterest, setOfferInterest] = useState<'yes' | 'maybe' | 'no' | ''>('')
  const [submitted, setSubmitted] = useState(false)

  function toggleItem(list: string[], setList: (v: string[]) => void, item: string) {
    setList(list.includes(item) ? list.filter(x => x !== item) : [...list, item])
  }

  if (isLoading) {
    return (
      <Coquille>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          {/* ⚠ LE ROULEAU GARDE UNE VRAIE BORDURE, contrairement au reste : c'est
              elle QUI EST le dessin — un anneau dont un quart porte l'accent.
              Une ombre interne ne peut pas rendre ça. */}
          <div
            className="h-8 w-8 rounded-full animate-spin mb-4"
            style={{ border: `2px solid ${MLK.line}`, borderTopColor: MLK.accent }}
          />
        </div>
      </Coquille>
    )
  }

  if (!visit || !token) {
    return (
      <Coquille>
        <div className="flex flex-col items-center justify-center h-[60vh]">
          <p style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink, marginBottom: 'var(--crm-space-sm)' }}>{t('client.visit_feedback.invalid_title')}</p>
          <p style={{ fontSize: 'var(--crm-text-lg)', color: MLK.muted }}>{t('client.visit_feedback.invalid_body')}</p>
        </div>
      </Coquille>
    )
  }

  if (submitted) {
    return (
      <Coquille>
        <div className="text-center">
          {/* ⚠ DISQUE DE CONFIRMATION — une DONNÉE, pas une affordance : rien ne
              s'y actionne. Il garde donc son ton de succès au lieu de l'accent,
              même arbitrage qu'au parcours KYC. */}
          <div
            className="h-12 w-12 rounded-full flex items-center justify-center mx-auto mb-4"
            style={{ background: MLK_STATUT.okFill }}
          >
            <Check className="h-6 w-6" style={{ color: MLK_STATUT.okInk }} />
          </div>
          <h2 style={{ fontSize: 'var(--crm-text-3xl)', fontWeight: 600, color: MLK.ink, margin: 0 }}>
            {t('client.visit_feedback.thanks_title')}
          </h2>
          <p style={{ fontSize: 'var(--crm-text-lg)', color: MLK.muted, marginTop: 'var(--crm-space-sm)' }}>
            {t('client.visit_feedback.thanks_body')}
          </p>
        </div>
      </Coquille>
    )
  }

  const property = visit.property

  // Le refus (avis déjà déposé, visite annulée) est rendu sous le bouton ; on
  // avale le rejet pour ne pas laisser `mutateAsync` le repropager, l'état
  // d'erreur de la mutation portant déjà l'information.
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!rating || !offerInterest || !token) return
    try {
      await submitFeedback.mutateAsync({
        token,
        rating,
        strengths,
        objections,
        comment,
        offerInterest: offerInterest as 'yes' | 'maybe' | 'no',
      })
      setSubmitted(true)
    } catch { /* état porté par submitFeedback.isError */ }
  }

  return (
    <Coquille>
      <div>
        {/* Property card */}
        <div className="rounded-xl overflow-hidden mb-8" style={CARTE}>
          {property?.photos?.[0] && (
            <div className="aspect-[16/9]">
              {/* no-referrer : le token de retour est dans la query de CETTE page,
                  et un Referer l'emporterait vers l'hôte des photos. */}
              <img src={property.photos[0]} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" decoding="async" />
            </div>
          )}
          <div className="p-4">
            <h2 style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: MLK.ink, margin: 0 }}>
              {property?.title || t('client.visit_feedback.property_fallback')}
            </h2>
            {property?.address && (
              <div
                className="flex items-center gap-1.5 mt-1"
                style={{ fontSize: 'var(--crm-text-lg)', color: MLK.muted }}
              >
                <MapPin className="h-3.5 w-3.5" />
                {property.address}, {property.city}
              </div>
            )}
          </div>
        </div>

        <h1 style={{ fontSize: 'var(--crm-text-4xl)', fontWeight: 600, color: MLK.ink, marginBottom: 'var(--crm-space-6xl)' }}>
          {t('client.visit_feedback.title')}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Star rating */}
          <div>
            <label className="mb-3 block" style={LABEL}>{t('client.visit_feedback.rating_label')}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map(n => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  onMouseEnter={() => setHoverRating(n)}
                  onMouseLeave={() => setHoverRating(0)}
                  className="p-0.5 transition-transform hover:scale-110"
                  aria-label={t('client.visit_feedback.star_aria', { count: n })}
                >
                  <Star
                    className="h-8 w-8 transition-colors"
                    style={(hoverRating || rating) >= n
                      ? { fill: MLK_STATUT.starOn, color: MLK_STATUT.starOn }
                      : { color: MLK_STATUT.starOff }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Strengths */}
          <div>
            <label className="mb-2 block" style={LABEL}>{t('client.visit_feedback.strengths_label')}</label>
            <div className="flex flex-wrap gap-1.5">
              {STRENGTHS.map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => toggleItem(strengths, setStrengths, s)}
                  className="px-3 py-1.5 rounded-lg transition-colors"
                  style={pastille(strengths.includes(s), 'ok')}
                >
                  {t(`client.visit_feedback.strengths.${s}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Objections */}
          <div>
            <label className="mb-2 block" style={LABEL}>{t('client.visit_feedback.objections_label')}</label>
            <div className="flex flex-wrap gap-1.5">
              {OBJECTIONS.map(o => (
                <button
                  key={o}
                  type="button"
                  onClick={() => toggleItem(objections, setObjections, o)}
                  className="px-3 py-1.5 rounded-lg transition-colors"
                  style={pastille(objections.includes(o), 'err')}
                >
                  {t(`client.visit_feedback.objections.${o}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="mb-2 block" style={LABEL}>{t('client.visit_feedback.comment_label')}</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              placeholder={t('client.visit_feedback.comment_placeholder')}
              rows={3}
              className="w-full px-3 py-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/20 resize-none"
              style={{
                fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', color: MLK.ink,
                background: MLK.card, boxShadow: FILET, border: 0,
              }}
            />
          </div>

          {/* Offer interest */}
          <div>
            <label className="mb-2 block" style={LABEL}>{t('client.visit_feedback.offer_label')}</label>
            <div className="flex gap-2">
              {[
                { key: 'yes', label: t('client.visit_feedback.offer_yes') },
                { key: 'maybe', label: t('client.visit_feedback.offer_maybe') },
                { key: 'no', label: t('client.visit_feedback.offer_no') },
              ].map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setOfferInterest(key as typeof offerInterest)}
                  className="flex-1 h-10 rounded-lg transition-colors"
                  // ⚠ CELUI-CI PREND L'ACCENT, les deux familles au-dessus non :
                  // « oui / peut-être / non » est un CHOIX qu'on actionne, quand
                  // « point fort » et « point à améliorer » disent une POLARITÉ.
                  // L'accent marque ce qu'on a fait ; le ton dit ce que c'est.
                  style={pastille(offerInterest === key, 'accent')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Refus : avis déjà déposé pour cette visite, ou visite annulée.
              Sans ce bloc l'écran de remerciement s'afficherait sur un envoi
              que la base a refusé. */}
          {submitFeedback.isError && (
            <div
              className="rounded-xl px-4 py-3"
              style={{ background: MLK_STATUT.warnFill, boxShadow: `inset 0 0 0 1px ${MLK_STATUT.warnLine}` }}
            >
              <p style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: MLK_STATUT.warnInk, margin: 0 }}>
                {t('client.visit_feedback.error_title')}
              </p>
              <p style={{ fontSize: 'var(--crm-text-sm)', color: MLK_STATUT.warnInk, marginTop: 'var(--crm-space-xs)' }}>
                {estRefus(submitFeedback.error)
                  ? t('client.visit_feedback.error_refused')
                  : t('client.visit_feedback.error_network')}
              </p>
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={!rating || !offerInterest || submitFeedback.isPending}
            className="w-full h-11 rounded-lg transition-colors flex items-center justify-center gap-2"
            style={{
              fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500, border: 0,
              ...(rating && offerInterest && !submitFeedback.isPending
                ? { background: MLK.accent, color: '#FFFFFF', cursor: 'pointer' }
                : { background: MLK.cardSubtle, color: MLK.ghost, cursor: 'not-allowed' }),
            }}
          >
            {submitFeedback.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitFeedback.isPending ? t('client.visit_feedback.submitting') : t('client.visit_feedback.submit')}
          </button>

          <p className="text-center" style={{ fontSize: 'var(--crm-text-sm)', color: MLK.muted }}>
            {t('client.visit_feedback.anonymised')}
          </p>
        </form>
      </div>
    </Coquille>
  )
}
