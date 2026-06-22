// MEGGA CRM Sugar v2 Wizard — Step 5 : Prix puis Description
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step5.jsx).

import { useState, useRef } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { SugarV2, sgOn, fmtCHF, type WizardData } from '../tokens'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

export function Step5PriceDesc({ data, set }: StepProps) {
  const { t: tr } = useTranslation('listings')
  const transaction = data.transaction || 'vente'

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
  const estim = computeEstimation(data)

  const descRef = useRef<HTMLTextAreaElement>(null)
  const [, setAiOn] = useState(!!data.aiAssist)
  const [aiPhase, setAiPhase] = useState<'idle' | 'thinking' | 'streaming' | 'done'>('idle')
  const [streamText, setStreamText] = useState('')
  const [tone, setTone] = useState<NonNullable<WizardData['descTone']>>(data.descTone || 'neutre')

  const TONES: { v: NonNullable<WizardData['descTone']>; l: string }[] = [
    { v: 'neutre',  l: tr('wizard.step5.tone.neutre') },
    { v: 'premium', l: tr('wizard.step5.tone.premium') },
    { v: 'famille', l: tr('wizard.step5.tone.famille') },
    { v: 'invest',  l: tr('wizard.step5.tone.invest') },
  ]

  const generate = () => {
    setAiOn(true)
    setAiPhase('thinking')
    setStreamText('')
    const text = buildAITemplate(data, tone)
    setTimeout(() => {
      setAiPhase('streaming')
      let i = 0
      const id = window.setInterval(() => {
        i += Math.max(2, Math.round(Math.random() * 5))
        setStreamText(text.slice(0, i))
        if (i >= text.length) {
          window.clearInterval(id)
          setAiPhase('done')
          set({ description: text, aiAssist: true, descTone: tone })
        }
      }, 18)
    }, 700)
  }

  const onManualEdit = (v: string) => {
    set({ description: v, aiAssist: false })
    setAiOn(false)
    setAiPhase('idle')
  }

  const visibleDesc = aiPhase === 'streaming' ? streamText : (data.description || '')
  const charCount = (data.description || '').length
  const minChars = 200, idealChars = 600

  return (
    <div style={{ maxWidth: 1100, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      <div style={{ marginBottom: 36, maxWidth: 760 }}>
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

      {/* HÉRO PRIX */}
      <div style={{
        background: SugarV2.card, borderRadius: 28, padding: '40px 40px 36px',
        boxShadow: SugarV2.shadowLg, marginBottom: 36,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
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
                  boxShadow: sel ? '0 6px 14px rgba(0,0,0,0.22)' : 'none',
                  transition: 'all .2s ease',
                }}>{t.l}</button>
              )
            })}
          </div>
        </div>

        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: SugarV2.muted,
            letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 16,
          }}>
            {transaction === 'vente' ? tr('form.fields.salePrice') : tr('form.fields.monthlyRent')}
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 14 }}>
            <input
              type="text" inputMode="numeric"
              value={display} onChange={e => onPriceChange(e.target.value)}
              placeholder="0"
              style={{
                width: Math.max(280, Math.min(720, (display.length || 1) * 56 + 80)),
                maxWidth: '100%',
                height: 110, padding: 0,
                border: 0, outline: 'none', background: 'transparent',
                fontFamily: 'inherit',
                fontSize: 96, fontWeight: 800, color: SugarV2.ink,
                letterSpacing: -3.5, lineHeight: 1,
                textAlign: 'right',
              }} />
            <span style={{
              fontSize: 32, fontWeight: 700, color: SugarV2.muted,
              letterSpacing: -0.5,
            }}>CHF{transaction === 'location' && <span style={{ fontSize: 18, color: SugarV2.muted, fontWeight: 600 }}>{tr('wizard.perMonth')}</span>}</span>
          </div>

          {transaction === 'location' && (
            <div style={{
              marginTop: 28, display: 'inline-flex', alignItems: 'center', gap: 14,
              padding: '12px 20px', borderRadius: 999,
              background: SugarV2.cardSubtle,
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: SugarV2.muted, letterSpacing: 0.5, textTransform: 'uppercase' }}>
                {tr('wizard.step5.chargesLabel')}
              </span>
              <input
                type="text" inputMode="numeric"
                value={fmtCHF(data.charges)} onChange={e => onChargesChange(e.target.value)}
                placeholder="350"
                style={{
                  width: 110, height: 32,
                  border: 0, outline: 'none', background: sgOn(),
                  borderRadius: 8, padding: '0 10px',
                  fontFamily: 'inherit',
                  fontSize: 16, fontWeight: 700, color: SugarV2.ink,
                  textAlign: 'center',
                }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: SugarV2.inkSoft }}>CHF</span>
            </div>
          )}
        </div>

        {/* Estimation */}
        {estim && (
          <div style={{
            marginTop: 36, padding: '18px 22px', borderRadius: 18,
            background: SugarV2.cardSubtle,
            display: 'flex', alignItems: 'center', gap: 16,
          }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: SugarV2.black, color: sgOn(),
              display: 'grid', placeItems: 'center', flexShrink: 0,
              boxShadow: '0 6px 14px rgba(0,0,0,0.22)',
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12c0-5 4-9 9-9s9 4 9 9"/><path d="M21 12c0 5-4 9-9 9s-9-4-9-9"/><path d="M12 7v5l3 2"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: SugarV2.muted,
                letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4,
              }}>{tr('wizard.step5.estimation.eyebrow')}</div>
              <div style={{ fontSize: 14, color: SugarV2.ink, fontWeight: 600, letterSpacing: -0.2 }}>
                <Trans
                  t={tr}
                  i18nKey={transaction === 'location' ? 'wizard.step5.estimation.rangeRent' : 'wizard.step5.estimation.range'}
                  values={{ label: estim.label, low: `${fmtCHF(estim.low)} CHF`, high: `${fmtCHF(estim.high)} CHF` }}
                  components={{ b: <span style={{ fontWeight: 800 }} /> }}
                />
              </div>
            </div>
            <button
              onClick={() => transaction === 'vente' ? set({ price: estim.mid }) : set({ rent: estim.mid })}
              style={{
                height: 36, padding: '0 14px', borderRadius: 999, border: 0,
                background: SugarV2.card, color: SugarV2.ink,
                fontFamily: 'inherit', fontSize: 12, fontWeight: 700, cursor: 'pointer',
                boxShadow: SugarV2.shadowSm, flexShrink: 0,
              }}>
              {tr('wizard.step5.estimation.use', { amount: `${fmtCHF(estim.mid)} CHF` })}
            </button>
          </div>
        )}

        {value != null && estim && (
          <div style={{
            marginTop: 18, padding: '0 6px',
            animation: 'sgFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
          }}>
            <PriceBar value={value} low={estim.low} high={estim.high} />
          </div>
        )}
      </div>

      {/* DESCRIPTION */}
      <div style={{ marginBottom: 18 }}>
        <h2 style={{
          margin: '0 0 6px', fontSize: 26, fontWeight: 700,
          color: SugarV2.ink, letterSpacing: -0.5,
        }}>{tr('wizard.step5.descTitle')}</h2>
        <p style={{ margin: 0, fontSize: 14, color: SugarV2.inkSoft, fontWeight: 500 }}>
          {tr('wizard.step5.descSubtitle')}
        </p>
      </div>

      {/* AI panel */}
      <div style={{
        background: SugarV2.card, borderRadius: 22, padding: 18,
        boxShadow: SugarV2.shadow, marginBottom: 14,
        display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{
          width: 38, height: 38, borderRadius: 12,
          background: SugarV2.black, color: sgOn(),
          display: 'grid', placeItems: 'center', flexShrink: 0,
          boxShadow: '0 6px 14px rgba(0,0,0,0.22)',
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
                transition: 'all .15s ease',
              }}>{t.l}</button>
            )
          })}
        </div>

        <button onClick={generate}
          disabled={aiPhase === 'thinking' || aiPhase === 'streaming'}
          style={{
            height: 40, padding: '0 18px', borderRadius: 999, border: 0,
            background: SugarV2.black, color: sgOn(),
            fontFamily: 'inherit', fontSize: 13, fontWeight: 700, letterSpacing: 0.1,
            cursor: (aiPhase === 'thinking' || aiPhase === 'streaming') ? 'wait' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            boxShadow: '0 6px 16px rgba(0,0,0,0.20)',
            opacity: (aiPhase === 'thinking' || aiPhase === 'streaming') ? 0.85 : 1,
          }}>
          {aiPhase === 'thinking' || aiPhase === 'streaming' ? (
            <>
              <span style={{
                width: 14, height: 14, borderRadius: 999,
                border: '2px solid rgba(255,255,255,0.3)',
                borderTopColor: sgOn(),
                animation: 'sgSpin .8s linear infinite', display: 'inline-block',
              }} />
              {aiPhase === 'thinking' ? tr('wizard.step5.ai.thinking') : tr('wizard.step5.ai.writing')}
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

      <div style={{
        background: SugarV2.card, borderRadius: 22,
        boxShadow: SugarV2.shadow, overflow: 'hidden',
      }}>
        <textarea
          ref={descRef}
          value={visibleDesc}
          onChange={e => onManualEdit(e.target.value)}
          readOnly={aiPhase === 'streaming' || aiPhase === 'thinking'}
          placeholder={tr('wizard.step5.descPlaceholder')}
          style={{
            width: '100%', minHeight: 220, boxSizing: 'border-box',
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
                background: 'rgba(0,0,0,0.06)', color: SugarV2.ink,
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
  )
}

function PriceBar({ value, low, high }: { value: number; low: number; high: number }) {
  const { t: tr } = useTranslation('listings')
  const range = high - low
  const padding = range * 0.4
  const min = low - padding
  const max = high + padding
  const pct = Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))

  let label: string, color: string
  if (value < low * 0.92)        { label = tr('wizard.step5.position.farBelow');  color = '#3B82F6' }
  else if (value < low)          { label = tr('wizard.step5.position.below');       color = '#10B981' }
  else if (value <= high)        { label = tr('wizard.step5.position.inRange'); color = SugarV2.ok }
  else if (value <= high * 1.08) { label = tr('wizard.step5.position.above');        color = SugarV2.warn }
  else                            { label = tr('wizard.step5.position.farAbove');   color = SugarV2.err }

  return (
    <div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 8, fontSize: 11, fontWeight: 700, letterSpacing: 0.4,
      }}>
        <span style={{ color: SugarV2.muted, textTransform: 'uppercase' }}>{tr('wizard.step5.position.eyebrow')}</span>
        <span style={{ color }}>{label}</span>
      </div>
      <div style={{
        position: 'relative', height: 10, borderRadius: 999,
        background: `linear-gradient(to right,
          rgba(59,130,246,0.15) 0%,
          rgba(16,185,129,0.18) ${((low - min) / (max - min)) * 100}%,
          rgba(16,185,129,0.18) ${((high - min) / (max - min)) * 100}%,
          rgba(245,158,11,0.18) 100%)`,
      }}>
        <div style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${((low - min) / (max - min)) * 100}%`,
          width: `${((high - low) / (max - min)) * 100}%`,
          borderRadius: 0,
          boxShadow: 'inset 0 0 0 1px rgba(16,185,129,0.35)',
        }} />
        <div style={{
          position: 'absolute', top: -5, left: `${pct}%`,
          width: 20, height: 20, borderRadius: 999,
          background: SugarV2.black, transform: 'translateX(-50%)',
          boxShadow: `0 4px 12px rgba(0,0,0,0.40), 0 0 0 4px ${SugarV2.card}`,
        }} />
      </div>
    </div>
  )
}

function computeEstimation(data: WizardData): { low: number; mid: number; high: number; label: string } | null {
  const tx = data.transaction || 'vente'
  const area = data.area || 80
  const type = data.type || 'appartement'
  const canton = data.canton || 'Vaud'

  const baseM2Vente: Record<string, Record<string, number>> = {
    appartement: { Vaud: 11500, Genève: 13800, Valais: 6800, Fribourg: 6500, Neuchâtel: 6200 },
    maison:      { Vaud: 9500,  Genève: 12500, Valais: 6000, Fribourg: 5800, Neuchâtel: 5600 },
    villa:       { Vaud: 12500, Genève: 15500, Valais: 7800, Fribourg: 7200, Neuchâtel: 7000 },
    terrain:     { Vaud: 1200,  Genève: 2800,  Valais: 600,  Fribourg: 500,  Neuchâtel: 480 },
  }
  const baseM2Loc: Record<string, Record<string, number>> = {
    appartement: { Vaud: 32, Genève: 42, Valais: 22, Fribourg: 24, Neuchâtel: 22 },
    maison:      { Vaud: 28, Genève: 38, Valais: 20, Fribourg: 22, Neuchâtel: 20 },
    villa:       { Vaud: 35, Genève: 48, Valais: 24, Fribourg: 26, Neuchâtel: 24 },
    terrain:     { Vaud: 0,  Genève: 0,  Valais: 0,  Fribourg: 0,  Neuchâtel: 0 },
  }
  const table = tx === 'vente' ? baseM2Vente : baseM2Loc
  const cantonPrice = (table[type] && table[type][canton]) || (table[type]?.Vaud ?? 10000)
  if (!cantonPrice) return null

  const mid = Math.round(cantonPrice * area / 100) * 100
  const low = Math.round(mid * 0.88 / 100) * 100
  const high = Math.round(mid * 1.15 / 100) * 100

  const labelMap: Record<string, string> = {
    appartement: 'appartement', maison: 'maison', villa: 'villa', terrain: 'terrain',
  }
  const label = `${labelMap[type] || type} de ${area} m² ${canton ? `dans le canton de ${canton}` : ''}`.trim()
  return { low, mid, high, label }
}

function buildAITemplate(data: WizardData, tone: NonNullable<WizardData['descTone']>): string {
  const type = data.type || 'bien'
  const area = data.area || '—'
  const rooms = data.rooms
  const bedrooms = data.bedrooms
  const baths = data.bathrooms
  const features = data.features || []
  const canton = data.canton || ''
  const addr = data.addr || ''
  const tx = data.transaction || 'vente'
  const energy = data.energy

  const featureClause = features.length > 0
    ? `Le bien est complété par : ${features.slice(0, 5).map(prettyFeature).join(', ')}.`
    : ''
  const energyClause = energy
    ? ` Sa classe énergétique ${energy} ${['A', 'B', 'C'].includes(energy) ? 'garantit une excellente performance' : 'permet une consommation maîtrisée'}.`
    : ''

  const intros: Record<string, string> = {
    neutre:  `Bel ${typeLabel(type)} de ${area} m²${rooms ? `, ${rooms} pièces` : ''}${bedrooms ? `, ${bedrooms} chambre${bedrooms > 1 ? 's' : ''}` : ''}${baths ? `, ${baths} salle${baths > 1 ? 's' : ''} de bain` : ''}${addr || canton ? `, situé ${addr ? `${addr}` : `dans le canton de ${canton}`}` : ''}.`,
    premium: `Exception architecturale : cet ${typeLabel(type)} de ${area} m² incarne un art de vivre raffiné${addr || canton ? `, au cœur ${canton ? `du canton de ${canton}` : `de ${addr}`}` : ''}. ${rooms ? `Ses ${rooms} pièces` : 'Ses volumes'} offrent un cadre rare.`,
    famille: `Pensé pour la vie de famille : ${typeLabel(type)} de ${area} m² qui combine confort et fonctionnalité${addr || canton ? `, idéalement situé ${addr ? `à ${addr}` : `dans le canton de ${canton}`}` : ''}. ${bedrooms ? `Avec ${bedrooms} chambres et` : 'Avec'} ${baths ? `${baths} salle${baths > 1 ? 's' : ''} de bain,` : ''} l'espace est généreux pour tous.`,
    invest:  `Opportunité d'investissement solide : ${typeLabel(type)} de ${area} m²${addr || canton ? `, ${canton ? `canton de ${canton}` : addr}` : ''}, dans une zone à fort potentiel locatif. Rendement estimé conforme aux standards du marché.`,
  }
  const middles: Record<string, string> = {
    neutre:  ' Les espaces sont lumineux, bien agencés et propices à la vie au quotidien.',
    premium: ' Finitions haut de gamme, matériaux nobles et prestations sur mesure caractérisent ce bien rare.',
    famille: " Les pièces de jour s'ouvrent sur l'extérieur ; chaque chambre a été pensée pour offrir intimité et tranquillité.",
    invest:  ` Bien actuellement ${tx === 'location' ? 'loué avec un bail en cours' : 'en parfait état, prêt à être loué ou revendu'}.`,
  }
  const closings: Record<string, string> = {
    neutre:  ' Un coup de cœur à découvrir lors d\'une visite.',
    premium: " Une visite s'impose pour saisir toute la dimension de ce bien d'exception.",
    famille: ' À découvrir sans tarder, idéal pour s\'installer durablement.',
    invest:  ' Dossier complet disponible sur demande. À étudier sans délai.',
  }

  return [
    intros[tone],
    middles[tone],
    featureClause,
    energyClause.trim(),
    closings[tone],
  ].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
}

const typeLabel = (t: string) => ({
  appartement: 'appartement', maison: 'maison', villa: 'villa', terrain: 'terrain',
} as Record<string, string>)[t] || 'bien'

const prettyFeature = (v: string) => ({
  balcon: 'balcon', terrasse: 'terrasse', jardin: 'jardin', garage: 'garage',
  parking: 'place de parc', cave: 'cave', ascenseur: 'ascenseur', piscine: 'piscine',
  cheminée: 'cheminée', clim: 'climatisation', buanderie: 'buanderie', vue: 'vue dégagée',
} as Record<string, string>)[v] || v
