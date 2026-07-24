// MEGGA CRM Sugar v2 Wizard — Step 5 : Prix puis Description (concept « séquentiel épuré »)
// Port fidèle du handoff crm-wizard-sugar-step5.jsx (window.SgStepPriceDesc) :
//   • phase 0 (data.priceStep = 0) = LE PRIX — la page EST le prix (chiffre géant centré,
//     pas de carte, pas d'en-tête aligné à gauche).
//   • phase 1 (data.priceStep = 1) = LA DESCRIPTION — pilule rappel-prix, éditeur feuille,
//     MEGGA AI en étoile discrète dans la barre d'outils basse → barre de prompt inline.
//
// La navigation entre phases est pilotée par le FOOTER du shell (il fait varier
// data.priceStep 0↔1). Ce step ne rend aucun bouton Continuer/Précédent inter-phase.
//
// ⚠ WIRING RÉEL — la rédaction appelle l'edge `ai-copilot` (action draft_description,
// DeepSeek) au lieu du générateur factice du handoff. Le prompt libre de la barre inline
// (« Affiner/Créer ») est transmis comme consigne. Échec honnête (état d'erreur + retry),
// JAMAIS de repli silencieux vers un texte fabriqué. L'IA reste une assistance.

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { SugarV2, sgOn, fmtCHF, type WizardData } from '../tokens'
import { supabase } from '@/lib/supabase'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

// Quand le modèle ne produit rien (tour vide en HTTP 200), l'edge renvoie cette
// phrase-sentinelle NON vide comme result — on la traite comme un échec, au même
// titre qu'un résultat trop court pour être une description.
const AI_EMPTY_SENTINEL = 'Je n\'ai pas pu générer de réponse'

// Étoile MEGGA AI (2 branches) — même tracé que le handoff.
function AiStar({ size = 18, color }: { size?: number; color: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M11 2.5 12.7 8.3 18.5 10 12.7 11.7 11 17.5 9.3 11.7 3.5 10 9.3 8.3Z" />
      <path d="M18 13.5 18.8 16.2 21.5 17 18.8 17.8 18 20.5 17.2 17.8 14.5 17 17.2 16.2Z" />
    </svg>
  )
}

export function Step5PriceDesc({ data, set }: StepProps) {
  const { t: tr } = useTranslation('listings')
  const transaction = data.transaction || 'vente'
  const phase: 'price' | 'desc' = (data.priceStep || 0) >= 1 ? 'desc' : 'price'
  const setPhase = (p: 'price' | 'desc') => set({ priceStep: p === 'desc' ? 1 : 0 })

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
  const [aiMenuOpen, setAiMenuOpen] = useState(false)
  const [aiPrompt, setAiPrompt] = useState('')

  // Rédaction RÉELLE via l'edge ai-copilot (draft_description, DeepSeek). `refine`
  // = consigne libre saisie dans la barre inline ; s'il y a déjà une description,
  // on la fait réécrire selon la consigne, sinon on génère selon la consigne.
  const generate = async (refine?: string) => {
    if (aiPhase === 'thinking') return // garde in-flight (double-clic physique)
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
    const current = (data.description || '').trim()
    const tail = 'Réponds UNIQUEMENT avec la description (2-3 paragraphes), sans titre ni préambule.'
    let message: string
    if (refine && refine.trim() && current) {
      message = `Voici la description actuelle de l'annonce :\n\n${current}\n\nRéécris-la en tenant compte de cette consigne : ${refine.trim()}. ${tail}`
    } else if (refine && refine.trim()) {
      message = `Rédige la description de cette annonce immobilière selon cette consigne : ${refine.trim()}. ${tail}`
    } else {
      message = `Rédige la description de cette annonce immobilière. ${tail}`
    }
    try {
      const { data: res, error } = await supabase.functions.invoke<{ result?: string }>('ai-copilot', {
        body: { action: 'draft_description', message, context, language: 'fr', persist: false, stream: false },
      })
      if (error) throw error
      const text = (res?.result ?? '').trim()
      if (!text || text.length < 60 || text.startsWith(AI_EMPTY_SENTINEL)) throw new Error('degraded')
      set({ description: text, aiAssist: true })
      setAiPhase('done')
    } catch {
      setAiPhase('error')
    }
  }

  const onManualEdit = (v: string) => {
    set({ description: v, aiAssist: false })
    setAiPhase('idle')
  }
  const runPrompt = () => {
    const p = aiPrompt.trim()
    setAiMenuOpen(false)
    setAiPrompt('')
    void generate(p || undefined)
  }

  const visibleDesc = data.description || ''
  const charCount = visibleDesc.length
  const minChars = 200, idealChars = 600
  const busy = aiPhase === 'thinking'

  return (
    <div style={{ maxWidth: 820, margin: '0 auto', animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      {/* Progression — 7 segments (Prix/Description = 6ᵉ étape sur 7) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 44 }}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} style={{ flex: 1, height: 5, borderRadius: 999, background: i <= 5 ? SugarV2.black : SugarV2.line, transition: 'background .25s' }} />
        ))}
      </div>

      {/* ══ PHASE 0 — LE PRIX EST LA PAGE ══════════════════════════════ */}
      {phase === 'price' && (
        <div style={{ animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both' }}>
          {/* Toggle transaction (centré) */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 40 }}>
            <div style={{ display: 'inline-flex', padding: 5, borderRadius: 999, background: SugarV2.cardSubtle }}>
              {[
                { v: 'vente' as const, l: tr('wizard.step5.txSale') },
                { v: 'location' as const, l: tr('wizard.step5.txRent') },
              ].map(t => {
                const sel = transaction === t.v
                return (
                  <button key={t.v} onClick={() => setTx(t.v)} style={{
                    height: 38, padding: '0 24px', borderRadius: 999, border: 0,
                    background: sel ? SugarV2.black : 'transparent',
                    color: sel ? sgOn() : SugarV2.inkSoft,
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer',
                    boxShadow: sel ? SugarV2.pillShadow : 'none',
                  }}>{t.l}</button>
                )
              })}
            </div>
          </div>

          {/* Question (centrée) */}
          <div style={{
            textAlign: 'center', fontSize: 12, fontWeight: 700, color: SugarV2.muted,
            letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 10,
          }}>
            {transaction === 'vente' ? tr('wizard.step5.qSalePrice') : tr('wizard.step5.qMonthlyRent')}
          </div>

          {/* Chiffre géant éditable */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 14 }}>
            <input
              type="text" inputMode="numeric" autoFocus
              value={display} onChange={e => onPriceChange(e.target.value)} placeholder="0"
              style={{
                width: Math.max(200, Math.min(680, (display.length || 1) * 58 + 40)),
                maxWidth: '100%', height: 122, padding: 0,
                border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit',
                fontSize: 104, fontWeight: 800, color: SugarV2.ink, letterSpacing: -4, lineHeight: 1,
                textAlign: 'center', fontVariantNumeric: 'tabular-nums',
              }} />
          </div>
          <div style={{ textAlign: 'center', marginTop: 12, fontSize: 20, fontWeight: 700, color: SugarV2.muted }}>
            CHF{transaction === 'location' && <span style={{ fontSize: 15 }}>{tr('wizard.perMonth')}</span>}
          </div>

          {/* Charges (location) — éditable */}
          {transaction === 'location' && (
            <div style={{ display: 'flex', justifyContent: 'center', marginTop: 24 }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 20px', borderRadius: 999, background: SugarV2.cardSubtle }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: SugarV2.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>{tr('wizard.step5.chargesLabel')}</span>
                <input type="text" inputMode="numeric"
                  value={fmtCHF(data.charges)} onChange={e => onChargesChange(e.target.value)} placeholder="350"
                  style={{
                    width: 84, height: 36, border: 0, outline: 'none', background: SugarV2.card, borderRadius: 999,
                    textAlign: 'center', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, color: SugarV2.ink,
                    boxShadow: SugarV2.shadowSm, fontVariantNumeric: 'tabular-nums',
                  }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: SugarV2.inkSoft }}>CHF</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ PHASE 1 — LA DESCRIPTION ═══════════════════════════════════ */}
      {phase === 'desc' && (
        <div style={{ animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both' }}>
          {/* Rappel prix + retour (centré) */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
            <button onClick={() => setPhase('price')} style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              height: 42, padding: '0 18px 0 14px', borderRadius: 999, border: 0,
              background: SugarV2.card, boxShadow: SugarV2.shadowSm, cursor: 'pointer',
              fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, color: SugarV2.ink,
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={SugarV2.inkSoft} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
              {display || '0'} CHF{transaction === 'location' ? tr('wizard.perMonth') : ''}
              <span style={{ fontSize: 12, fontWeight: 600, color: SugarV2.muted }}>· {tr('wizard.step5.modify')}</span>
            </button>
          </div>

          <div style={{ textAlign: 'center', marginBottom: 26 }}>
            <h1 style={{ margin: 0, fontSize: 34, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.8 }}>{tr('wizard.step5.descTitle')}</h1>
          </div>

          {/* Éditeur — feuille + toolbar/compteur qualité en bas */}
          <div style={{ background: SugarV2.card, borderRadius: 22, boxShadow: SugarV2.shadow, overflow: 'hidden' }}>
            <textarea
              value={visibleDesc}
              onChange={e => onManualEdit(e.target.value)}
              readOnly={busy}
              placeholder={tr('wizard.step5.descPlaceholder')}
              style={{
                width: '100%', minHeight: 260, boxSizing: 'border-box', padding: 26,
                border: 0, outline: 'none', resize: 'vertical', fontFamily: 'inherit',
                fontSize: 15, lineHeight: 1.65, color: SugarV2.ink, fontWeight: 500,
                letterSpacing: -0.1, background: 'transparent',
              }} />
            <div style={{ padding: aiMenuOpen ? 8 : '10px 14px 10px 18px', background: SugarV2.cardSubtle, transition: 'padding .15s ease' }}>
              {!aiMenuOpen ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14 }}>
                  {/* compteur qualité — ou message d'échec honnête (état d'erreur) */}
                  {aiPhase === 'error' ? (
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: SugarV2.err }}>{tr('wizard.step5.ai.error')}</span>
                  ) : (
                    <span style={{
                      fontSize: 11.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums',
                      color: charCount >= idealChars ? SugarV2.ok : charCount >= minChars ? SugarV2.warn : SugarV2.muted,
                    }}>
                      {charCount === 0
                        ? tr('wizard.step5.counter.zero')
                        : <>{charCount}{charCount >= idealChars ? tr('wizard.step5.counter.ideal') : charCount >= minChars ? tr('wizard.step5.counter.target', { target: idealChars }) : tr('wizard.step5.counter.min', { count: minChars })}</>}
                    </span>
                  )}
                  {/* petite étoile MEGGA AI */}
                  <button onClick={() => !busy && setAiMenuOpen(true)} aria-label={tr('wizard.step5.ai.title')} title={tr('wizard.step5.ai.title')} style={{
                    width: 36, height: 36, borderRadius: 999, border: 0, flexShrink: 0,
                    background: SugarV2.card, color: SugarV2.ink, display: 'grid', placeItems: 'center',
                    cursor: busy ? 'wait' : 'pointer', boxShadow: SugarV2.shadowSm,
                  }}>
                    {busy ? (
                      <div style={{ width: 15, height: 15, borderRadius: 999, border: `2px solid ${SugarV2.line}`, borderTopColor: SugarV2.ink, animation: 'sgSpin .8s linear infinite' }} />
                    ) : (
                      <AiStar color={SugarV2.ink} />
                    )}
                  </button>
                </div>
              ) : (
                /* Barre de prompt MEGGA AI — étoile + saisie libre + Affiner/Créer */
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: SugarV2.card, borderRadius: 999, padding: '7px 8px 7px 16px', boxShadow: SugarV2.shadowSm }}>
                  <AiStar color={SugarV2.ink} />
                  <input autoFocus value={aiPrompt}
                    onChange={e => setAiPrompt(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') runPrompt(); if (e.key === 'Escape') { setAiMenuOpen(false); setAiPrompt('') } }}
                    placeholder={charCount > 0 ? tr('wizard.step5.ai.promptRefine') : tr('wizard.step5.ai.promptAsk')}
                    style={{ flex: 1, minWidth: 0, height: 30, border: 0, outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 14, fontWeight: 500, color: SugarV2.ink }} />
                  <button onClick={() => { setAiMenuOpen(false); setAiPrompt('') }} style={{
                    height: 34, padding: '0 12px', borderRadius: 999, border: 0, background: 'transparent',
                    color: SugarV2.inkSoft, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  }}>{tr('common:actions.cancel')}</button>
                  <button onClick={runPrompt} style={{
                    height: 38, padding: '0 20px', borderRadius: 999, border: 0, flexShrink: 0,
                    background: SugarV2.black, color: sgOn(), fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
                  }}>{charCount > 0 ? tr('wizard.step5.ai.refine') : tr('wizard.step5.ai.create')}</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
