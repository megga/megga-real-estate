// MEGGA CRM Sugar v2 Wizard — Step 5 : Prix puis Description (deux phases).
// Port du handoff « séquentiel épuré » (crm-wizard-sugar-step5.jsx —
// window.SgStepPriceDesc) :
//   • phase 0 (data.priceStep = 0) = LE PRIX — chiffre géant, la page EST le prix.
//   • phase 1 (data.priceStep = 1) = LA DESCRIPTION — éditeur + rédaction MEGGA AI.
//
// La navigation entre les deux phases (puis vers la publication) est pilotée par le
// FOOTER du shell : c'est lui qui incrémente/décrémente `data.priceStep`. Ce step ne
// rend donc AUCUN bouton Continuer/Précédent inter-phase — uniquement le contenu de
// la phase courante, lu depuis `data.priceStep`.
//
// ⚠ WIRING RÉEL — la rédaction appelle l'edge `ai-copilot` (action draft_description,
// DeepSeek), PAS le générateur de texte factice du handoff. `generate()` est conservé
// à l'identique : one-shot non persistant, échec honnête (état d'erreur + retry),
// JAMAIS de repli silencieux vers un texte fabriqué. L'IA reste une assistance, jamais
// automatique ni garantie.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, sgOn, fmtCHF, type WizardData } from '../tokens'
import { supabase } from '@/lib/supabase'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

// Indication de ton passée à MEGGA AI (draft_description). Chaîne d'API, pas du
// JSX → hors périmètre du garde i18n (jsx-text-only).
const TONE_HINT: Record<NonNullable<WizardData['descTone']>, string> = {
  neutre: 'neutre et factuel',
  premium: 'premium, prestige',
  famille: 'orienté vie de famille',
  invest: 'orienté investisseur (rendement locatif)',
}

// Quand le modèle ne produit rien (tour vide en HTTP 200), l'edge renvoie cette
// phrase-sentinelle NON vide comme result (ai-copilot/index.ts:1038). Elle ne
// doit JAMAIS atterrir dans la description comme un vrai brouillon → on la
// traite comme un échec, au même titre qu'un résultat trop court pour être une
// description (le prompt exige 150-250 mots).
const AI_EMPTY_SENTINEL = 'Je n\'ai pas pu générer de réponse'

export function Step5PriceDesc({ data, set }: StepProps) {
  const { t: tr } = useTranslation('listings')
  const transaction = data.transaction || 'vente'
  // Phase pilotée par le footer du shell (il fait varier data.priceStep 0↔1).
  const phase: 'price' | 'desc' = (data.priceStep || 0) >= 1 ? 'desc' : 'price'

  // ── Prix ──────────────────────────────────────────────────────────────
  const setTx = (v: 'vente' | 'location') => set({ transaction: v })

  const onPriceChange = (raw: string) => {
    const cleaned = String(raw).replace(/\D/g, '')
    const n = cleaned ? parseInt(cleaned, 10) : null
    if (transaction === 'vente') set({ price: n })
    else set({ rent: n })
  }

  const onChargesChange = (raw: string) => {
    const cleaned = String(raw).replace(/\D/g, '')
    set({ charges: cleaned ? parseInt(cleaned, 10) : null })
  }

  const value = transaction === 'vente' ? data.price : data.rent
  const display = fmtCHF(value)

  // ── Description ───────────────────────────────────────────────────────
  const [aiPhase, setAiPhase] = useState<'idle' | 'thinking' | 'done' | 'error'>('idle')
  const [tone, setTone] = useState<NonNullable<WizardData['descTone']>>(data.descTone || 'neutre')

  const TONES: { v: NonNullable<WizardData['descTone']>; l: string }[] = [
    { v: 'neutre',  l: tr('wizard.step5.tone.neutre') },
    { v: 'premium', l: tr('wizard.step5.tone.premium') },
    { v: 'famille', l: tr('wizard.step5.tone.famille') },
    { v: 'invest',  l: tr('wizard.step5.tone.invest') },
  ]

  // Rédaction RÉELLE via l'edge ai-copilot (action draft_description, DeepSeek) —
  // one-shot, non persistant (on ne crée pas de conversation copilote pour un
  // brouillon d'annonce). Le prompt d'action interdit d'inventer une
  // caractéristique absente des données. En cas d'échec : état d'erreur honnête
  // + retry, JAMAIS de repli silencieux vers un texte fabriqué.
  const generate = async () => {
    // Garde in-flight : le `disabled` du bouton ne s'applique qu'après le
    // re-render ; un double-clic physique rapide lancerait 2 appels DeepSeek.
    if (aiPhase === 'thinking') return
    setAiPhase('thinking')
    const price = transaction === 'location' ? data.rent : data.price
    const context: Record<string, unknown> = {
      type: data.type, transaction,
      address: data.addr || undefined,
      canton: data.canton || undefined, postal_code: data.postCode || undefined,
      surface_m2: data.area || undefined, rooms: data.rooms || undefined,
      bedrooms: data.bedrooms || undefined, bathrooms: data.bathrooms || undefined,
      features: data.features?.length ? data.features : undefined,
      year_built: data.year || undefined, energy_class: data.energy || undefined,
      price: price || undefined,
    }
    const message = `Rédige la description de cette annonce immobilière. Ton souhaité : ${TONE_HINT[tone]}. Réponds UNIQUEMENT avec la description (2-3 paragraphes), sans titre ni préambule.`
    try {
      const { data: res, error } = await supabase.functions.invoke<{ result?: string }>('ai-copilot', {
        body: { action: 'draft_description', message, context, language: 'fr', persist: false, stream: false },
      })
      if (error) throw error
      const text = (res?.result ?? '').trim()
      // Échec honnête si : vide, phrase-sentinelle d'excuse de l'edge (tour vide
      // en 200), ou trop court pour être une description. Jamais écrit comme
      // brouillon « MEGGA AI ».
      if (!text || text.length < 60 || text.startsWith(AI_EMPTY_SENTINEL)) throw new Error('degraded')
      set({ description: text, aiAssist: true, descTone: tone })
      setAiPhase('done')
    } catch {
      setAiPhase('error')
    }
  }

  const onManualEdit = (v: string) => {
    set({ description: v, aiAssist: false })
    setAiPhase('idle')
  }

  const visibleDesc = data.description || ''
  const charCount = (data.description || '').length
  const minChars = 200, idealChars = 600

  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>

      {/* ══ PHASE 0 — LE PRIX EST LA PAGE ══════════════════════════════ */}
      {phase === 'price' && (
        <div style={{ animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ marginBottom: 40, maxWidth: 760 }}>
            <div style={{
              fontSize: 12, fontWeight: 600, color: SugarV2.muted,
              letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
            }}>{tr('wizard.step5.eyebrow')}</div>
            <h1 style={{
              margin: '0 0 14px', fontSize: 38, fontWeight: 700,
              color: SugarV2.ink, letterSpacing: -0.8, lineHeight: 1.1,
            }}>{tr('wizard.step5.title')}</h1>
            <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
              {tr('wizard.step5.intro')}
            </p>
          </div>

          {/* Toggle transaction */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 36 }}>
            <div style={{
              display: 'inline-flex', padding: 5, borderRadius: 999,
              background: SugarV2.cardSubtle,
            }}>
              {[
                { v: 'vente' as const,    l: tr('form.transaction.buy') },
                { v: 'location' as const, l: tr('form.transaction.rent') },
              ].map(t => {
                const sel = transaction === t.v
                return (
                  <button key={t.v} onClick={() => setTx(t.v)} style={{
                    height: 38, padding: '0 24px', borderRadius: 999, border: 0,
                    background: sel ? SugarV2.black : 'transparent',
                    color: sel ? sgOn() : SugarV2.inkSoft,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0.1,
                    cursor: 'pointer',
                    boxShadow: sel ? SugarV2.pillShadow : 'none',
                  }}>{t.l}</button>
                )
              })}
            </div>
          </div>

          {/* Chiffre géant éditable — la page EST le prix */}
          <div style={{ textAlign: 'center' }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: SugarV2.muted,
              letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 14,
            }}>
              {transaction === 'vente' ? tr('form.fields.salePrice') : tr('form.fields.monthlyRent')}
            </div>

            <input
              type="text" inputMode="numeric" autoFocus
              value={display} onChange={e => onPriceChange(e.target.value)}
              placeholder="0"
              style={{
                width: Math.max(200, Math.min(680, (display.length || 1) * 58 + 40)),
                maxWidth: '100%', height: 122, padding: 0,
                border: 0, outline: 'none', background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 104, fontWeight: 800, color: SugarV2.ink,
                letterSpacing: -4, lineHeight: 1, textAlign: 'center',
                fontVariantNumeric: 'tabular-nums',
              }} />

            <div style={{
              marginTop: 12, fontSize: 20, fontWeight: 700, color: SugarV2.muted,
            }}>
              CHF{transaction === 'location' && (
                <span style={{ fontSize: 15 }}>{tr('wizard.perMonth')}</span>
              )}
            </div>
          </div>

          {/* Charges (location) — éditable */}
          {transaction === 'location' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 28 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 12,
                padding: '10px 12px 10px 20px', borderRadius: 999,
                background: SugarV2.cardSubtle,
              }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: SugarV2.muted,
                  letterSpacing: 0.5, textTransform: 'uppercase',
                }}>{tr('wizard.step5.chargesLabel')}</span>
                <input
                  type="text" inputMode="numeric"
                  value={fmtCHF(data.charges)} onChange={e => onChargesChange(e.target.value)}
                  placeholder="350"
                  style={{
                    width: 84, height: 36, border: 0, outline: 'none',
                    background: SugarV2.card, borderRadius: 999,
                    textAlign: 'center', fontFamily: 'inherit',
                    fontSize: 16, fontWeight: 700, color: SugarV2.ink,
                    boxShadow: SugarV2.shadowSm,
                    fontVariantNumeric: 'tabular-nums',
                  }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: SugarV2.inkSoft }}>CHF</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ PHASE 1 — LA DESCRIPTION ═══════════════════════════════════ */}
      {phase === 'desc' && (
        <div style={{ animation: 'sgFadeUp .4s cubic-bezier(.2,.8,.2,1) both' }}>
          <div style={{ marginBottom: 26, maxWidth: 760 }}>
            <h1 style={{
              margin: '0 0 8px', fontSize: 34, fontWeight: 700,
              color: SugarV2.ink, letterSpacing: -0.6, lineHeight: 1.1,
            }}>{tr('wizard.step5.descTitle')}</h1>
            <p style={{ margin: 0, fontSize: 15, color: SugarV2.inkSoft, fontWeight: 500, lineHeight: 1.55 }}>
              {tr('wizard.step5.descSubtitle')}
            </p>
          </div>

          {/* Panneau MEGGA AI — assistance, jamais automatique */}
          <div style={{
            background: SugarV2.card, borderRadius: 22, padding: 18,
            boxShadow: SugarV2.shadow, marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 12,
              background: SugarV2.black, color: sgOn(),
              display: 'grid', placeItems: 'center', flexShrink: 0,
              boxShadow: SugarV2.pillShadow,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2 8 12.7 4 8.8l5.5-.8L12 3Z"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.2 }}>
                  {tr('wizard.step5.ai.title')}
                </span>
                <span style={{
                  padding: '2px 7px', borderRadius: 999,
                  background: SugarV2.cardSubtle, color: SugarV2.inkSoft,
                  fontSize: 9.5, fontWeight: 700, letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>{tr(`wizard.step5.tone.${tone}`)}</span>
              </div>
              <div style={{ fontSize: 12.5, color: SugarV2.muted, fontWeight: 500 }}>
                {tr('wizard.step5.ai.hint')}
              </div>
            </div>

            <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: SugarV2.cardSubtle }}>
              {TONES.map(t => {
                const sel = tone === t.v
                return (
                  <button key={t.v} onClick={() => setTone(t.v)} style={{
                    height: 30, padding: '0 12px', borderRadius: 999, border: 0,
                    background: sel ? SugarV2.card : 'transparent',
                    color: sel ? SugarV2.ink : SugarV2.inkSoft,
                    fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700, letterSpacing: 0.1,
                    cursor: 'pointer',
                    boxShadow: sel ? SugarV2.shadowSm : 'none',
                  }}>{t.l}</button>
                )
              })}
            </div>

            <button onClick={generate}
              disabled={aiPhase === 'thinking'}
              style={{
                height: 40, padding: '0 18px', borderRadius: 999, border: 0,
                background: SugarV2.black, color: sgOn(),
                fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0.1,
                cursor: (aiPhase === 'thinking') ? 'wait' : 'pointer',
                display: 'inline-flex', alignItems: 'center', gap: 8,
                boxShadow: SugarV2.pillShadow,
                opacity: (aiPhase === 'thinking') ? 0.85 : 1,
              }}>
              {aiPhase === 'thinking' ? (
                <>
                  <span style={{
                    width: 14, height: 14, borderRadius: 999,
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: sgOn(),
                    animation: 'sgSpin .8s linear infinite', display: 'inline-block',
                  }} />
                  {tr('wizard.step5.ai.thinking')}
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
                  </svg>
                  {(data.description || '').length > 0 ? tr('wizard.step5.ai.regenerate') : tr('wizard.step5.ai.generate')}
                </>
              )}
            </button>
          </div>

          {aiPhase === 'error' && (
            <div style={{
              marginBottom: 14, padding: '10px 14px', borderRadius: 12,
              background: 'rgba(220,38,38,0.08)', color: '#DC2626',
              fontSize: 13, fontWeight: 600,
            }}>
              {tr('wizard.step5.ai.error')}
            </div>
          )}

          {/* Éditeur — feuille + toolbar/compteur qualité en bas */}
          <div style={{
            background: SugarV2.card, borderRadius: 22,
            boxShadow: SugarV2.shadow, overflow: 'hidden',
          }}>
            <textarea
              value={visibleDesc}
              onChange={e => onManualEdit(e.target.value)}
              readOnly={aiPhase === 'thinking'}
              placeholder={tr('wizard.step5.descPlaceholder')}
              style={{
                width: '100%', minHeight: 240, boxSizing: 'border-box',
                padding: 24, border: 0, outline: 'none', resize: 'vertical',
                fontFamily: 'inherit', fontSize: 15, lineHeight: 1.65,
                color: SugarV2.ink, fontWeight: 500, letterSpacing: -0.1,
                background: 'transparent',
              }}
            />
            <div style={{
              padding: '12px 20px',
              background: SugarV2.cardSubtle,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
              fontSize: 11.5, fontWeight: 600,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span style={{
                  fontVariantNumeric: 'tabular-nums',
                  color: charCount >= idealChars ? SugarV2.ok :
                         charCount >= minChars ? SugarV2.warn : SugarV2.muted,
                }}>
                  {tr('wizard.step5.counter.chars', { count: charCount })}
                  {charCount < minChars && tr('wizard.step5.counter.beforeMin', { count: minChars - charCount })}
                  {charCount >= minChars && charCount < idealChars && tr('wizard.step5.counter.target', { target: idealChars })}
                  {charCount >= idealChars && tr('wizard.step5.counter.ideal')}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: SugarV2.muted }}>
                {data.aiAssist && aiPhase === 'done' && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    padding: '3px 9px', borderRadius: 999,
                    background: SugarV2.cardSubtle, color: SugarV2.ink,
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: SugarV2.black }} />
                    {tr('wizard.step5.writtenByAi')}
                  </span>
                )}
                <span>{tr('wizard.step5.editHint')}</span>
              </div>
            </div>
          </div>

          {/* Jauge de longueur (min → idéal) */}
          <div style={{
            marginTop: 14, height: 4, borderRadius: 999,
            background: SugarV2.cardSubtle, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(100, (charCount / idealChars) * 100)}%`,
              background: charCount >= idealChars ? SugarV2.ok :
                          charCount >= minChars ? SugarV2.warn : SugarV2.black,
              borderRadius: 999,
              transition: 'width .4s cubic-bezier(.2,.8,.2,1)',
            }} />
          </div>
        </div>
      )}
    </div>
  )
}
