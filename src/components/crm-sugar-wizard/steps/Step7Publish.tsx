// MEGGA CRM Sugar v2 Wizard — Step 7 : Publication (concept E — annonce complète)
// Port du handoff « complet » (crm-wizard-sugar-step7.jsx — `SgStepPublish`).
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
import { SugarV2, sgOn, fmtCHF, shade, type WizardData } from '../tokens'
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

// ─── Contrôle segmenté Sugar (statique, aucune animation de survol) ────────
function SgP7Seg<T extends string>({ options, value, onChange }: {
  options: { v: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div style={{ display: 'inline-flex', background: SugarV2.cardSubtle, borderRadius: 'var(--crm-radius-pill)', padding: 'var(--crm-space-xs)', gap: 'var(--crm-space-2xs)' }}>
      {options.map((o) => {
        const sel = value === o.v
        return (
          <button key={o.v} onClick={() => onChange(o.v)} style={{
            height: 38, padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer', fontFamily: 'inherit',
            fontSize: 'var(--crm-text-lg)', fontWeight: 600,
            background: sel ? SugarV2.black : 'transparent', color: sel ? sgOn() : SugarV2.muted,
          }}>{o.label}</button>
        )
      })}
    </div>
  )
}

export function Step7Publish({ data, set, onPublish, onGoStep, publishing }: StepProps) {
  const { t } = useTranslation('listings')
  const { profile } = useAuth()

  const tx = data.transaction || 'vente'
  const price = tx === 'vente' ? data.price : data.rent
  const photos = data.photos || []
  const perM2 = (price && data.area) ? Math.round(price / data.area) : null

  const visibility = data.visibility || 'public'
  const mode = data.publishMode || 'now'
  const today = new Date().toISOString().slice(0, 10)
  const schedDate = data.scheduledAt ? new Date(data.scheduledAt).toISOString().slice(0, 10) : ''
  const canPublishSched = mode !== 'schedule' || !!data.scheduledAt

  // ── Checklist « Prêt à publier » (miroir du contrôle backend) ──
  const checks: { ok: boolean; label: string; step: number }[] = [
    { ok: !!(data.addr && String(data.addr).trim()), label: t('wizard.step7.check.address'), step: 2 },
    { ok: !!(data.area || data.rooms), label: t('wizard.step7.check.surface'), step: 3 },
    { ok: photos.length >= 5, label: t('wizard.step7.check.photos', { count: photos.length }), step: 4 },
    { ok: !!price, label: tx === 'location' ? t('wizard.step7.check.rent') : t('wizard.step7.check.price'), step: 5 },
    { ok: (data.description || '').trim().length > 0, label: t('wizard.step7.check.description'), step: 5 },
  ]
  const missing = checks.filter(c => !c.ok)
  const publicPublish = visibility === 'public' && mode !== 'draft'
  const blocked = publicPublish && missing.length > 0
  const mandateSigned = !!(data.mandate && data.mandate.signed)
  const canPublish = canPublishSched && !blocked && !publishing
  const ctaLabel = publishing ? t('wizard.shell.publishing')
    : mode === 'schedule' ? t('wizard.step7.cta.schedule')
    : mode === 'draft' ? t('wizard.step7.cta.draft')
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
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 'var(--crm-radius-pill)', background: SugarV2.black }} />
        ))}
      </div>

      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <h1 style={{ margin: 0, fontSize: 'var(--crm-text-8xl)', fontWeight: 500, color: SugarV2.ink, letterSpacing: -0.8 }}>
          {t('wizard.step7.readyTitle')}
        </h1>
      </div>

      {/* ── CHECKLIST « PRÊT À PUBLIER » (publication publique uniquement) ── */}
      {publicPublish && missing.length > 0 && (
        <div style={{ background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: SugarV2.shadowLg, padding: '22px 26px', marginBottom: 22 }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: SugarV2.ink, letterSpacing: -0.3 }}>
            {t('wizard.step7.checklist.heading', { count: missing.length })}
          </div>
          <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SugarV2.muted, marginTop: 4, lineHeight: 1.45 }}>
            {t('wizard.step7.checklist.hint')}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', marginTop: 14 }}>
            {checks.map((c, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-md) 0',
                borderTop: i === 0 ? 'none' : `1px solid ${SugarV2.line}`,
              }}>
                <span style={{
                  width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)', flexShrink: 0, display: 'grid', placeItems: 'center',
                  background: c.ok ? SugarV2.black : (SugarV2.isDark ? 'rgba(224,115,140,0.18)' : 'rgba(142,31,61,0.10)'),
                }}>
                  {c.ok
                    ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke={sgOn()} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>
                    : <span style={{ width: 7, height: 7, borderRadius: 'var(--crm-radius-pill)', background: SugarV2.isDark ? '#E0738C' : '#8E1F3D' }} />}
                </span>
                <span style={{
                  flex: 1, fontSize: 'var(--crm-text-lg)', fontWeight: c.ok ? 500 : 600, color: c.ok ? SugarV2.muted : SugarV2.ink,
                  letterSpacing: -0.2, textDecoration: c.ok ? 'line-through' : 'none', fontVariantNumeric: 'tabular-nums',
                }}>{c.label}</span>
                {!c.ok && onGoStep && (
                  <button onClick={() => onGoStep(c.step)} style={{
                    height: 30, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, background: SugarV2.cardSubtle, color: SugarV2.ink,
                  }}>{t('wizard.step7.checklist.complete')}</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      {publicPublish && missing.length === 0 && !mandateSigned && (
        <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SugarV2.muted, textAlign: 'center', marginBottom: 18, lineHeight: 1.5 }}>
          {t('wizard.step7.mandateNote')}
        </div>
      )}

      {/* ── ANNONCE COMPLÈTE (aperçu) ── */}
      <div style={{ background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)', overflow: 'hidden', boxShadow: SugarV2.shadowLg }}>
        {/* Galerie — vraie photo de couverture si disponible, sinon placeholder */}
        <div style={{
          position: 'relative', aspectRatio: '16 / 8',
          background: coverSrc
            ? SugarV2.cardSubtle
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
          <div style={{ display: 'flex', gap: 'var(--crm-space-md)', padding: 'var(--crm-space-lg) var(--crm-space-2xl)', background: SugarV2.cardSubtle }}>
            {photos.slice(0, 4).map((p, i) => {
              const src = p.previewUrl || p.url || null
              return (
                <div key={i} style={{
                  width: 76, height: 54, borderRadius: 'var(--crm-radius-md)', overflow: 'hidden',
                  background: src ? SugarV2.card : `linear-gradient(135deg, ${p.tone || '#D4DDE3'}, ${shade(p.tone || '#D4DDE3', -0.05)})`,
                }}>
                  {src && <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </div>
              )
            })}
            {photos.length > 4 && (
              <div style={{
                width: 76, height: 54, borderRadius: 'var(--crm-radius-md)', background: SugarV2.card,
                display: 'grid', placeItems: 'center', color: SugarV2.muted, fontSize: 'var(--crm-text-md)', fontWeight: 600,
              }}>+{photos.length - 4}</div>
            )}
          </div>
        )}

        <div style={{ padding: 28 }}>
          {/* Titre + prix */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--crm-space-4xl)', marginBottom: 20 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted, marginBottom: 6 }}>
                {tx === 'vente' ? t('wizard.txBadge.sale') : t('wizard.txBadge.rent')} · {data.canton || t('wizard.country')}
              </div>
              <div style={{ fontSize: 'var(--crm-text-5xl)', fontWeight: 500, color: SugarV2.ink, letterSpacing: -0.5, lineHeight: 1.2 }}>
                {typeLabel(data.type, t)}{data.rooms ? ` ${data.rooms} ${t('wizard.step7.roomsWord')}` : ''}{data.addr ? ` — ${data.addr}` : ''}
              </div>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: SugarV2.muted, marginTop: 4 }}>
                {[data.addr, data.postCode, data.canton].filter(Boolean).join(' · ') || t('wizard.step7.addressPlaceholder')}
              </div>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-6xl)', fontWeight: 500, color: SugarV2.ink, letterSpacing: -1, fontVariantNumeric: 'tabular-nums' }}>{fmtCHF(price) || '—'}</div>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted, marginTop: 2 }}>
                CHF{tx === 'location' ? t('wizard.perMonth') : perM2 ? ` · ${fmtCHF(perM2)}.-/m²` : ''}
              </div>
            </div>
          </div>

          {/* Grille specs complète (8 cellules) */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-2xs)',
            background: SugarV2.line, borderRadius: 'var(--crm-radius-xl)', overflow: 'hidden', marginBottom: 22,
          }}>
            {specs.map((s, i) => (
              <div key={i} style={{ background: SugarV2.card, padding: 'var(--crm-space-2xl) var(--crm-space-3xl)' }}>
                <div style={{ fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: SugarV2.muted}}>{s.l}</div>
                <div style={{
                  fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: SugarV2.ink, marginTop: 4, fontVariantNumeric: 'tabular-nums',
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
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted, marginBottom: 8 }}>
                {t('wizard.step7.descriptionLabel')}
              </div>
              <p style={{ margin: '0 0 22px', fontSize: 'var(--crm-text-lg)', color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.65 }}>{data.description}</p>
            </>
          )}

          {/* Équipements */}
          {featLabels.length > 0 && (
            <>
              <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted, marginBottom: 10 }}>
                {t('wizard.step7.featuresLabel')}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)', marginBottom: 24 }}>
                {featLabels.map((f, i) => (
                  <span key={i} style={{ padding: 'var(--crm-space-xs) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-pill)', background: SugarV2.cardSubtle, color: SugarV2.ink, fontSize: 'var(--crm-text-sm)', fontWeight: 600 }}>{f}</span>
                ))}
              </div>
            </>
          )}

          {/* Agent (utilisateur connecté réel) */}
          <div style={{ padding: 'var(--crm-space-2xl) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-xl)', background: SugarV2.cardSubtle, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
            <div style={{ width: 40, height: 40, borderRadius: 'var(--crm-radius-pill)', background: SugarV2.black, color: sgOn(), display: 'grid', placeItems: 'center', fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{agentInitials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: SugarV2.ink }}>{agentName}</div>
              <div style={{ fontSize: 'var(--crm-text-sm)', color: SugarV2.muted, fontWeight: 500 }}>{t('wizard.step7.agentLine', { canton: data.canton || t('wizard.country') })}</div>
            </div>
            <button disabled style={{
              height: 34, padding: '0 var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: SugarV2.black, color: sgOn(), fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'default',
            }}>{t('wizard.step7.contact')}</button>
          </div>
        </div>
      </div>

      {/* ── OPTIONS DE PUBLICATION ── */}
      <div style={{ background: SugarV2.card, borderRadius: 'var(--crm-radius-5xl)', boxShadow: SugarV2.shadow, padding: 26, marginTop: 22 }}>
        <div style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, color: SugarV2.ink, letterSpacing: -0.3, marginBottom: 20 }}>{t('wizard.step7.optionsTitle')}</div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-6xl)', marginBottom: 20 }}>
          {/* Visibilité */}
          <div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted, marginBottom: 10 }}>{t('wizard.step7.visibility.eyebrow')}</div>
            <SgP7Seg
              value={visibility === 'private' ? 'private' : 'public'}
              onChange={(v) => set({ visibility: v })}
              options={[
                { v: 'public', label: t('wizard.step7.visibility.public') },
                { v: 'private', label: t('wizard.step7.visibility.private') },
              ]}
            />
            <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SugarV2.muted, marginTop: 10, lineHeight: 1.45 }}>
              {visibility === 'private' ? t('wizard.step7.visibility.privateDesc') : t('wizard.step7.visibility.publicDesc')}
            </div>
          </div>

          {/* Quand */}
          <div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: SugarV2.muted, marginBottom: 10 }}>{t('wizard.step7.whenPublish')}</div>
            <SgP7Seg
              value={mode}
              onChange={(v) => set({ publishMode: v })}
              options={[
                { v: 'now', label: t('wizard.step7.when.now') },
                { v: 'schedule', label: t('wizard.step7.when.schedule') },
                { v: 'draft', label: t('wizard.step7.when.draft') },
              ]}
            />
            {mode === 'schedule' && (
              <input type="date" min={today} value={schedDate}
                onChange={(e) => set({ scheduledAt: e.target.value ? new Date(`${e.target.value}T12:00:00`).toISOString() : undefined })}
                style={{
                  width: '100%', boxSizing: 'border-box', height: 44, marginTop: 12, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)',
                  border: 0, outline: 'none', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600,
                  colorScheme: SugarV2.isDark ? 'dark' : 'light', background: SugarV2.cardSubtle,
                  color: schedDate ? SugarV2.ink : SugarV2.muted, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.04)',
                }} />
            )}
            {mode === 'draft' && (
              <div style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SugarV2.muted, marginTop: 10, lineHeight: 1.45 }}>{t('wizard.step7.draftNote')}</div>
            )}
          </div>
        </div>
      </div>

      {/* Barre d'action — le bouton Publier vit DANS le step */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-3xl)', marginTop: 22 }}>
        <div style={{ flex: 1 }} />
        {blocked && (
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: SugarV2.muted }}>
            {t('wizard.step7.blockedHint', { count: missing.length })}
          </span>
        )}
        <button onClick={publish} disabled={!canPublish} style={{
          height: 52, padding: '0 28px', borderRadius: 'var(--crm-radius-pill)', border: 0,
          background: canPublish ? SugarV2.black : SugarV2.ghostSolid, color: sgOn(), fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600,
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
