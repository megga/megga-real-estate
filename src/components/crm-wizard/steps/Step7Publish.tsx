// MEGGA CRM Sugar v2 Wizard — Step 7 : Publication (concept E — annonce complète)
// Port du handoff « complet » (crm-wizard-sugar-step7.jsx — `WzStepPublish`).
//
// Checklist « Prêt à publier » (miroir UI du contrôle backend — l'API reste la
// source de vérité) + aperçu exhaustif de l'annonce + options de publication +
// barre d'action à libellé dynamique. Le bouton « Publier » vit DANS ce step
// (la coquille masque le CTA du footer sur la dernière étape) et appelle le vrai
// handlePublish via `onPublish`.
//
// Règles de gating (AUDIT-WIZARD-PUBLICATION) : seuls 5 critères bloquent une
// publication PUBLIQUE (adresse, surface|pièces, ≥5 photos, prix, description) ;
// KYC/C2PA/DPE/staging ne bloquent JAMAIS ; mandat non signé ne bloque pas non plus
// — il rétrograde juste le CTA en « Publier sur MEGGA ». Brouillon & « Privé » ne
// sont jamais bloqués. Aucun persona fictif : l'agent affiché = l'utilisateur connecté.

import { useTranslation } from 'react-i18next'
import type { TFunction } from 'i18next'
import { WizardTokens, crmOn, crmAcc, fmtCHF, shade, type WizardData } from '../tokens'
import { MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { useAuth } from '@/hooks/useAuth'

interface StepProps {
  data: WizardData
  set: (patch: Partial<WizardData>) => void
  /** Publie réellement (handlePublish de la coquille). */
  onPublish?: () => void
  /** Saute à l'étape indiquée (« Compléter » de la checklist). */
  onGoStep?: (step: number) => void
  /** Publication en cours (désactive le bouton, bascule le libellé). */
  publishing?: boolean
}

export function Step7Publish({ data, set, onPublish, onGoStep, publishing }: StepProps) {
  const { t } = useTranslation('listings')
  const { profile } = useAuth()

  const tx = data.transaction || 'vente'
  const price = tx === 'vente' ? data.price : data.rent
  const photos = data.photos || []
  const perM2 = (price && data.area) ? Math.round(price / data.area) : null

  const visibility = data.visibility || 'public'

  // ── Checklist « Prêt à publier » (miroir du contrôle backend) ──
  const checks: { ok: boolean; label: string; step: number }[] = [
    { ok: !!(data.addr && String(data.addr).trim()), label: t('wizard.step7.check.address'), step: 2 },
    { ok: !!(data.area || data.rooms), label: t('wizard.step7.check.surface'), step: 3 },
    { ok: photos.length >= 5, label: t('wizard.step7.check.photos', { count: photos.length }), step: 4 },
    { ok: !!price, label: tx === 'location' ? t('wizard.step7.check.rent') : t('wizard.step7.check.price'), step: 5 },
    { ok: (data.description || '').trim().length > 0, label: t('wizard.step7.check.description'), step: 5 },
  ]
  const missing = checks.filter(c => !c.ok)
  const publicPublish = visibility === 'public'
  const blocked = publicPublish && missing.length > 0
  const mandateSigned = !!(data.mandate && data.mandate.signed)
  const canPublish = !blocked && !publishing
  const ctaLabel = publishing ? t('wizard.shell.publishing')
    : visibility === 'private' ? t('wizard.step7.cta.private')
    : mandateSigned ? t('wizard.step7.cta.publishIdx') : t('wizard.step7.cta.publishMegga')

  // Équipements → libellés i18n (clés partagées avec le Step 3 guidé).
  const featLabels = (data.features || []).map(f =>
    f.startsWith('custom:') ? f.slice(7) : t(`wizard.step3.feature.${f}`),
  )

  const specs: { l: string; v: string; dpe?: boolean }[] = [
    { l: t('wizard.step7.spec.surface'), v: data.area ? `${data.area} m²` : '—' },
    { l: t('wizard.step7.spec.rooms'), v: data.rooms != null ? String(data.rooms) : '—' },
    { l: t('wizard.step7.spec.bedrooms'), v: data.bedrooms != null ? String(data.bedrooms) : '—' },
    { l: t('wizard.step7.spec.bathrooms'), v: data.bathrooms != null ? String(data.bathrooms) : '—' },
    { l: t('wizard.step7.spec.floor'), v: (data.floor != null) ? String(data.floor) : '—' },
    { l: t('wizard.step7.spec.year'), v: data.year != null ? String(data.year) : '—' },
    { l: t('wizard.step7.spec.charges'), v: data.charges ? `${fmtCHF(data.charges)}.-${t('wizard.perMonth')}` : '—' },
    { l: t('wizard.step7.spec.epc'), v: data.energy || '—', dpe: !!data.energy },
  ]

  const agentName = profile?.full_name?.trim() || t('wizard.step7.agentFallback')
  const agentInitials = agentName.split(/\s+/).filter(Boolean).map(p => p[0]).join('').substring(0, 2).toUpperCase() || 'ME'

  const cover = photos[0]
  const coverSrc = cover?.previewUrl || cover?.url || null
  const publish = () => { if (canPublish) onPublish?.() }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      {/* Progression 7 étapes (toutes remplies à la publication) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 32 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 'var(--crm-radius-pill)', background: WizardTokens.black }} />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-8xl)', fontWeight: 500, color: WizardTokens.ink, letterSpacing: -0.8 }}>
          {t('wizard.step7.readyTitle')}
        </h1>
      </div>

      {/* ── CHECKLIST « PRÊT À PUBLIER » (publication publique uniquement) ── */}
      {publicPublish && missing.length > 0 && (
        <div style={{ background: WizardTokens.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: WizardTokens.shadowLg, padding: '22px 26px', marginBottom: 22 }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: WizardTokens.ink, letterSpacing: -0.3 }}>
            {t('wizard.step7.checklist.heading', { count: missing.length })}
          </div>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: WizardTokens.muted, marginTop: 4, lineHeight: 1.45 }}>
            {t('wizard.step7.checklist.hint')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {checks.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-md) 0',
                borderTop: i === 0 ? 'none' : `1px solid ${WizardTokens.line}`,
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: c.ok ? WizardTokens.black : (WizardTokens.isDark ? 'rgba(224,115,140,0.18)' : 'rgba(142,31,61,0.10)'),
                }}>
                  {c.ok
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={crmOn()} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    : <span style={{ width: 7, height: 7, borderRadius: 'var(--crm-radius-pill)', background: WizardTokens.isDark ? '#E0738C' : '#8E1F3D' }} />}
                </span>
                <span style={{
                  flex: 1, fontSize: 'var(--crm-text-lg)', fontWeight: c.ok ? 500 : 600, color: c.ok ? WizardTokens.muted : WizardTokens.ink,
                  letterSpacing: -0.2, textDecoration: c.ok ? 'line-through' : 'none', fontVariantNumeric: 'tabular-nums',
                }}>{c.label}</span>
                {!c.ok && onGoStep && (
                  <button onClick={() => onGoStep(c.step)} style={{
                    height: 30, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, background: WizardTokens.cardSubtle, color: WizardTokens.ink,
                  }}>{t('wizard.step7.checklist.complete')}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {publicPublish && missing.length === 0 && !mandateSigned && (
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: WizardTokens.muted, textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
          {t('wizard.step7.mandateNote')}
        </div>
      )}

      {/* ── ANNONCE COMPLÈTE (aperçu) ── */}
      <div style={{ background: WizardTokens.card, borderRadius: 'var(--crm-radius-5xl)', overflow: 'hidden', boxShadow: WizardTokens.shadowLg }}>
        {/* Galerie — vraie photo de couverture si disponible, sinon placeholder */}
        <div style={{
          position: 'relative', aspectRatio: '16 / 8',
          background: coverSrc
            ? WizardTokens.cardSubtle
            : `repeating-linear-gradient(135deg, ${(cover?.tone) || '#D4DDE3'} 0 14px, ${shade((cover?.tone) || '#D4DDE3', -0.04)} 14px 28px)`,
          display: 'grid', placeItems: 'center', color: 'rgba(0,0,0,0.18)',
        }}>
          {coverSrc
            ? <img src={coverSrc} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1"><path d="M3 21V11l9-7 9 7v10" /><path d="M9 21v-7h6v7" /></svg>}
          {photos.length > 1 && (
            <span style={{
              position: 'absolute', bottom: 14, right: 14, padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)',
              background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 'var(--crm-text-xs)', fontWeight: 600,
            }}>1 / {photos.length}</span>
          )}
        </div>
        {/* Bande miniatures */}
        {photos.length > 1 && (
          <div style={{ display: 'flex', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', background: WizardTokens.cardSubtle }}>
            {photos.slice(0, 4).map((p, i) => {
              const src = p.previewUrl || p.url || null
              return (
                <div key={i} style={{
                  width: 76, height: 54, borderRadius: 'var(--crm-radius-md)', overflow: 'hidden',
                  background: src ? WizardTokens.card : `linear-gradient(135deg, ${p.tone || '#D4DDE3'}, ${shade(p.tone || '#D4DDE3', -0.05)})`,
                }}>
                  {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              )
            })}
            {photos.length > 4 && (
              <div style={{
                width: 76, height: 54, borderRadius: 'var(--crm-radius-md)', background: WizardTokens.card,
                display: 'grid', placeItems: 'center', color: WizardTokens.muted, fontSize: 'var(--crm-text-md)', fontWeight: 600,
              }}>+{photos.length - 4}</div>
            )}
          </div>
        )}

        <div style={{ padding: 28 }}>
          {/* Titre + prix */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--crm-space-4xl)', marginBottom: 20 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: WizardTokens.muted, marginBottom: 6 }}>
                {tx === 'vente' ? t('wizard.txBadge.sale') : t('wizard.txBadge.rent')} · {data.canton || t('wizard.country')}
              </div>
              <div style={{ fontSize: 'var(--crm-text-5xl)', fontWeight: 500, color: WizardTokens.ink, letterSpacing: -0.5, lineHeight: 1.2 }}>
                {typeLabel(data.type, t)}{data.rooms ? ` ${data.rooms} ${t('wizard.step7.roomsWord')}` : ''}{data.addr ? ` — ${data.addr}` : ''}
              </div>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: WizardTokens.muted, marginTop: 4 }}>
                {[data.addr, data.postCode, data.canton].filter(Boolean).join(' · ') || t('wizard.step7.addressPlaceholder')}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-6xl)', fontWeight: 500, color: WizardTokens.ink, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{fmtCHF(price) || '—'}</div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: WizardTokens.muted, marginTop: 2 }}>
                CHF{tx === 'location' ? t('wizard.perMonth') : perM2 ? ` · ${fmtCHF(perM2)}.-/m²` : ''}
              </div>
            </div>
          </div>

          {/* Grille specs complète (8 cellules) */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-2xs)',
            background: WizardTokens.line, borderRadius: 'var(--crm-radius-xl)', overflow: 'hidden', marginBottom: 22,
          }}>
            {specs.map((s, i) => (
              <div key={i} style={{ background: WizardTokens.card, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: WizardTokens.muted}}>{s.l}</div>
                <div style={{
                  fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: WizardTokens.ink, marginTop: 4, fontVariantNumeric: 'tabular-nums',
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)',
                }}>
                  {s.dpe && <span style={{ width: 8, height: 8, borderRadius: 'var(--crm-radius-pill)', background: '#5AA469' }} />}
                  {s.v}
                </div>
              </div>
            ))}
          </div>

          {/* Description */}
          {data.description && (
            <>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: WizardTokens.muted, marginBottom: 8 }}>
                {t('wizard.step7.descriptionLabel')}
              </div>
              <p style={{ margin: '0 0 22px', fontSize: 'var(--crm-text-lg)', color: WizardTokens.inkSoft, fontWeight: 500, lineHeight: 1.65 }}>{data.description}</p>
            </>
          )}

          {/* Équipements */}
          {featLabels.length > 0 && (
            <>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: WizardTokens.muted, marginBottom: 10 }}>
                {t('wizard.step7.featuresLabel')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginBottom: 24 }}>
                {featLabels.map((f, i) => (
                  <span key={i} style={{ padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: WizardTokens.cardSubtle, color: WizardTokens.ink, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>{f}</span>
                ))}
              </div>
            </>
          )}

          {/* Agent (utilisateur connecté réel) */}
          <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-xl)', background: WizardTokens.cardSubtle, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', background: WizardTokens.black, color: crmOn(), display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{agentInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: WizardTokens.ink }}>{agentName}</div>
              <div style={{ fontSize: 'var(--crm-text-sm)', color: WizardTokens.muted, fontWeight: 500 }}>{t('wizard.step7.agentLine', { canton: data.canton || t('wizard.country') })}</div>
            </div>
            <button disabled style={{
              height: 34, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: WizardTokens.black, color: crmOn(), fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'default',
            }}>{t('wizard.step7.contact')}</button>
          </div>
        </div>
      </div>

      {/* ── OPTIONS DE PUBLICATION ── */}
      <div style={{ background: WizardTokens.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: WizardTokens.shadow, padding: 26, marginTop: 22 }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: WizardTokens.ink, letterSpacing: -0.3, marginBottom: 20 }}>{t('wizard.step7.optionsTitle')}</div>

        {/* Une seule décision reste à prendre ici : qui verra l'annonce.
            La colonne « Quand publier » a été retirée le 11 août 2026 — ses
            trois modes n'écrivaient que deux états, et « Programmer » promettait
            une mise en ligne différée qu'aucun cron n'assure. La visibilité
            prend donc toute la largeur, en cartes de choix : sa conséquence se
            lit au lieu de tenir dans une pilule. */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-2xl)' }}>
          {(['public', 'private'] as const).map((v) => {
            const sel = (visibility === 'private' ? 'private' : 'public') === v
            return (
              <button key={v} type="button" onClick={() => set({ visibility: v })}
                aria-pressed={sel}
                style={{
                  textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                  padding: 'var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-2xl)',
                  background: sel ? crmAcc(0.08) : WizardTokens.cardSubtle,
                  border: `1.5px solid ${sel ? WizardTokens.black : 'transparent'}`,
                  display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)',
                  transition: 'background .15s ease, border-color .15s ease',
                }}>
                {/* ⛔ L'accent #424bfb ne passe PAS l'AA en TEXTE sur sombre
                    (3,3:1 sur le fond de carte sélectionnée). `blue300` est le
                    barreau de la vitrine qui répond — 10,6:1 — et n'existe que
                    pour ça. En clair l'accent tient (8,6:1 sur blanc). */}
                <span style={{
                  fontSize: 'var(--crm-text-2xl)', fontWeight: 600,
                  color: sel ? (WizardTokens.isDark ? MXC_SYSTEM.blue300 : WizardTokens.black) : WizardTokens.ink,
                }}>
                  {v === 'public' ? t('wizard.step7.visibility.public') : t('wizard.step7.visibility.private')}
                </span>
                <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: WizardTokens.muted, lineHeight: 1.45 }}>
                  {v === 'public' ? t('wizard.step7.visibility.publicDesc') : t('wizard.step7.visibility.privateDesc')}
                </span>
              </button>
            )
          })}
        </div>

        {/* Remplace l'ancienne note du mode « Brouillon ». Elle est vraie
            désormais : la ligne existe en base depuis la première adresse. */}
        <div style={{
          marginTop: 'var(--crm-space-3xl)', fontSize: 'var(--crm-text-md)',
          fontWeight: 500, color: WizardTokens.muted, lineHeight: 1.45,
        }}>{t('wizard.step7.savedNote')}</div>
      </div>

      {/* Barre d'action — le bouton Publier vit DANS le step */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', marginTop: 22 }}>
        <div style={{ flex: 1 }} />
        {blocked && (
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: WizardTokens.muted }}>
            {t('wizard.step7.blockedHint', { count: missing.length })}
          </span>
        )}
        <button onClick={publish} disabled={!canPublish} style={{
          height: 52, padding: '0 28px', borderRadius: 'var(--crm-radius-pill)', border: 0,
          background: canPublish ? WizardTokens.black : WizardTokens.ghostSolid, color: crmOn(), fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600,
          cursor: canPublish ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
          boxShadow: canPublish ? '0 12px 30px rgba(0,0,0,0.28)' : 'none',
        }}>
          {ctaLabel}
        </button>
      </div>
    </div>
  )
}

const typeLabel = (type: WizardData['type'], t: TFunction): string => ({
  appartement: t('type.apartment'), attique: t('type.attic'), duplex: t('type.duplex'),
  triplex: t('type.triplex'), loft: t('type.loft'), maison: t('type.house'),
  villa: t('type.villa'), chalet: t('type.chalet'), terrain: t('type.land'), commerce: t('type.commercial'),
}[type] || String(type))
