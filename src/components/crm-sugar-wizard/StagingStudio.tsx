// MEGGA CRM Sugar v2 — Staging Studio (modal plein-écran).
// 1:1 port from the Claude Design bundle (crm-staging-studio.jsx).
//
// Ouvert depuis l'étape Photos quand l'agent clique le bouton « spark » d'une photo.
// Génère 4 variantes virtuellement meublées via « Nano Banana 2 » (Gemini 2.5 Flash Image).
// Chaque variante est signée C2PA et S'AJOUTE comme variante (l'original reste).

import { useState, useEffect, type ReactNode } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import { SugarV2, shade, sgOn, type WizardPhoto } from './tokens'

interface StyleVariant {
  id: string
  tone: string
  accent: string
  label: string
  seed: string
}

export interface SavedVariant {
  id: string
  label: string
  tone: string
  accent: string
  seed: string
  sourcePhotoId: string
  style: string
  prompt: string
  model: string
  provenance: string
  signedAt: string
}

interface StagingStudioProps {
  photo: WizardPhoto
  onClose: () => void
  onSaveVariant?: (variants: SavedVariant[]) => void
}

const PRESETS = [
  { v: 'scandinave', label: 'Scandinave',  tone: '#E8E4DD', accent: '#A8B5BF', desc: 'Bois clair, lin, lumière douce, plantes vertes.' },
  { v: 'moderne',    label: 'Moderne',     tone: '#D4D8DC', accent: '#3C4148', desc: 'Lignes épurées, métal noir, gris ardoise, design contemporain.' },
  { v: 'chaleureux', label: 'Chaleureux',  tone: '#E8D6C2', accent: '#8B6F4E', desc: 'Bois foncé, textiles épais, tons terracotta, ambiance cocooning.' },
  { v: 'minimal',    label: 'Minimaliste', tone: '#EFEFEF', accent: '#0B0C0E', desc: 'Très peu de mobilier, blanc cassé, japandi, vide structuré.' },
  { v: 'luxe',       label: 'Luxe',        tone: '#D9C9A0', accent: '#7A632E', desc: 'Marbre, laiton, velours profond, finitions soignées.' },
  { v: 'familial',   label: 'Familial',    tone: '#D6E1D8', accent: '#5A7A60', desc: 'Convivial, robuste, multifonctionnel, tons verts naturels.' },
]

const QUICK_PROMPTS = [
  "Style chalet vaudois bois clair, fin d'après-midi doré",
  'Loft urbain industriel, béton ciré et noir mat',
  'Bord du lac Léman, rotin, lin écru, lumière du matin',
]

const ROOMS = ['salon', 'chambre', 'cuisine', 'salle de bain', 'bureau', 'entrée'] as const
type RoomType = typeof ROOMS[number]

// Les valeurs `RoomType` portent espaces/accents (logique/détection inchangée) ;
// on les mappe vers des clés i18n camelCase pour l'affichage.
const ROOM_KEY: Record<RoomType, string> = {
  'salon': 'salon',
  'chambre': 'chambre',
  'cuisine': 'cuisine',
  'salle de bain': 'salleDeBain',
  'bureau': 'bureau',
  'entrée': 'entree',
}

const sleep = (ms: number) => new Promise<void>(r => window.setTimeout(r, ms))

function detectRoom(label: string | undefined): RoomType {
  if (!label) return 'salon'
  const l = label.toLowerCase()
  if (l.includes('chambre')) return 'chambre'
  if (l.includes('cuisine')) return 'cuisine'
  if (l.includes('bain') || l.includes('douche')) return 'salle de bain'
  if (l.includes('bureau')) return 'bureau'
  if (l.includes('entrée') || l.includes('entree') || l.includes('hall')) return 'entrée'
  return 'salon'
}

function shadesAround(hex: string, n: number): string[] {
  const out: string[] = []
  const steps = [-0.04, 0.02, -0.02, 0.05]
  for (let i = 0; i < n; i++) out.push(shade(hex, steps[i % steps.length]))
  return out
}

export default function StagingStudio({ photo, onClose, onSaveVariant }: StagingStudioProps) {
  const { t } = useTranslation('listings')
  // ── Studio state ─────────────────────────────────────────────────────
  const [roomType, setRoomType] = useState<RoomType>(detectRoom(photo?.label))
  const [styleMode, setStyleMode] = useState<'preset' | 'custom'>('preset')
  const [preset, setPreset] = useState<typeof PRESETS[number]['v']>('scandinave')
  const [customPrompt, setCustomPrompt] = useState('')
  const [density, setDensity] = useState<'leger' | 'moyen' | 'dense'>('moyen')
  const [budget, setBudget] = useState<'economique' | 'standard' | 'premium'>('standard')

  const [advOpen, setAdvOpen] = useState(false)

  // ── Generation state ────────────────────────────────────────────────
  const [phase, setPhase] = useState<'idle' | 'generating' | 'signing' | 'done'>('idle')
  const [progress, setProgress] = useState(0)
  const [variants, setVariants] = useState<StyleVariant[]>([])
  const [activeVariant, setActiveVariant] = useState<string | null>(null)
  const [sliderPos, setSliderPos] = useState(50)
  const [picked, setPicked] = useState<Record<string, boolean>>({})

  const activeStyle = PRESETS.find(p => p.v === preset) || PRESETS[0]

  // ── Generate (simulated streaming) ──────────────────────────────────
  const generate = async () => {
    setPhase('generating')
    setProgress(0)
    setVariants([])
    setActiveVariant(null)

    const baseTones = styleMode === 'preset'
      ? shadesAround(activeStyle.tone, 4)
      : ['#D4DDE3', '#E2D8C8', '#D8DCE3', '#DCD8E0']

    for (let i = 0; i < 4; i++) {
      for (let p = 0; p <= 100; p += 8) {
        await sleep(28)
        setProgress(((i * 100) + p) / 4)
      }
      const v: StyleVariant = {
        id: `v${Date.now()}-${i}`,
        tone: baseTones[i],
        accent: activeStyle.accent,
        label: t('wizard.staging.variant', { letter: ['A', 'B', 'C', 'D'][i] }),
        seed: Math.random().toString(36).slice(2, 8).toUpperCase(),
      }
      setVariants(curr => {
        const next = [...curr, v]
        if (next.length === 1) setActiveVariant(v.id)
        return next
      })
    }

    setPhase('signing')
    await sleep(900)
    setPhase('done')
  }

  const reset = () => {
    setPhase('idle'); setVariants([]); setActiveVariant(null)
    setProgress(0); setPicked({})
  }

  const togglePick = (id: string) => setPicked(p => ({ ...p, [id]: !p[id] }))

  const saveSelection = () => {
    const chosen = variants.filter(v => picked[v.id])
    if (chosen.length === 0) return
    onSaveVariant?.(chosen.map(v => ({
      ...v,
      sourcePhotoId: photo.id,
      style: styleMode === 'preset' ? activeStyle.v : 'custom',
      prompt: styleMode === 'preset'
        ? `${activeStyle.label} · ${activeStyle.desc} · densité ${density} · gamme ${budget}`
        : customPrompt,
      model: 'Nano Banana 2',
      provenance: 'C2PA',
      signedAt: new Date().toISOString(),
    })))
    onClose?.()
  }

  // ── ESC pour fermer ─────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!photo) return null

  const active = variants.find(v => v.id === activeVariant)
  const pickedCount = Object.values(picked).filter(Boolean).length

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 200,
      background: 'rgba(0,0,0,0.78)',
      backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      animation: 'sgFadeUp .25s ease both',
      fontFamily: '"Inter Tight", system-ui, sans-serif',
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 1480, height: '100%',
        maxHeight: 'min(940px, calc(100vh - 48px))',
        background: SugarV2.bg, borderRadius: 28, overflow: 'hidden',
        boxShadow: '0 40px 100px rgba(0,0,0,0.50)',
        display: 'grid',
        gridTemplateColumns: '1.55fr 1fr',
        gridTemplateRows: 'auto minmax(0, 1fr) auto',
        gridTemplateAreas: `"head head" "canvas studio" "thumbs studio"`,
      }}>

        {/* HEADER */}
        <header style={{
          gridArea: 'head',
          padding: '18px 26px',
          display: 'flex', alignItems: 'center', gap: 16,
          borderBottom: `1px solid ${SugarV2.line}`,
          background: SugarV2.card,
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: SugarV2.black, color: sgOn(),
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 21V11l9-7 9 7v10"/><rect x="9" y="13" width="6" height="8"/>
            </svg>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: SugarV2.muted,
              letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2,
            }}>{t('wizard.staging.eyebrow', { room: photo.label })}</div>
            <div style={{
              fontSize: 16, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3,
            }}>{t('wizard.staging.title')}</div>
          </div>

          {/* C2PA badge */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', borderRadius: 999,
            background: SugarV2.cardSubtle,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke={SugarV2.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2 4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4Z"/>
              <path d="m9 12 2 2 4-4"/>
            </svg>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.1 }}>
              {t('wizard.staging.c2paSigned')}
            </span>
          </div>

          <button onClick={onClose} title={t('common:actions.close')} style={{
            width: 36, height: 36, borderRadius: 999, border: 0,
            background: SugarV2.cardSubtle, cursor: 'pointer',
            display: 'grid', placeItems: 'center',
            transition: 'background .15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = SugarV2.isDark ? '#2B2D40' : '#E0E2E6' }}
          onMouseLeave={e => { e.currentTarget.style.background = SugarV2.cardSubtle }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={SugarV2.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12"/>
            </svg>
          </button>
        </header>

        {/* CANVAS */}
        <div style={{
          gridArea: 'canvas',
          background: SugarV2.bg, padding: 24,
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div
            onMouseMove={e => {
              if (!active) return
              const r = e.currentTarget.getBoundingClientRect()
              const x = ((e.clientX - r.left) / r.width) * 100
              setSliderPos(Math.max(0, Math.min(100, x)))
            }}
            style={{
              position: 'relative', flex: 1,
              borderRadius: 20, overflow: 'hidden',
              background: SugarV2.cardSubtle,
              boxShadow: SugarV2.shadow,
            }}>

            {/* AVANT (photo originale stripée) */}
            <div style={{
              position: 'absolute', inset: 0,
              background: `repeating-linear-gradient(135deg, ${photo.tone || '#D4DDE3'} 0 14px, ${shade(photo.tone || '#D4DDE3', -0.04)} 14px 28px)`,
            }}>
              <div style={{
                position: 'absolute', inset: 0,
                display: 'grid', placeItems: 'center', color: 'rgba(11,12,14,0.18)',
              }}>
                <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1">
                  <path d="M3 21V11l9-7 9 7v10"/><path d="M9 21v-7h6v7"/>
                </svg>
              </div>
              <div style={{
                position: 'absolute', top: 14, left: 14,
                padding: '6px 12px', borderRadius: 999,
                background: 'rgba(255,255,255,0.92)', color: '#0B0C0E',
                fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
              }}>{t('wizard.staging.originalEmpty')}</div>
            </div>

            {/* APRÈS (variante active) — clipped */}
            {active && (
              <div style={{
                position: 'absolute', inset: 0,
                clipPath: phase === 'done' ? `inset(0 0 0 ${sliderPos}%)` : 'inset(0 0 0 0)',
                background: `repeating-linear-gradient(135deg, ${active.tone} 0 14px, ${shade(active.tone, -0.05)} 14px 28px)`,
                transition: 'clip-path .35s ease',
              }}>
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'grid', placeItems: 'center',
                  color: active.accent, opacity: 0.55,
                }}>
                  <svg width="120" height="120" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="13" width="18" height="6" rx="2"/>
                    <path d="M5 13V9a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v4"/>
                    <rect x="8" y="3" width="8" height="4" rx="1"/>
                    <circle cx="20" cy="9" r="1.5"/>
                  </svg>
                </div>
                <div style={{
                  position: 'absolute', top: 14, right: 14,
                  display: 'flex', gap: 6, alignItems: 'center',
                }}>
                  <div style={{
                    padding: '6px 12px', borderRadius: 999,
                    background: '#0B0C0E', color: '#fff',
                    fontSize: 10.5, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase',
                  }}>{t('wizard.staging.furnished')} · {active.label}</div>
                  <div style={{
                    padding: '6px 12px', borderRadius: 999,
                    background: 'rgba(255,255,255,0.95)', color: '#0B0C0E',
                    fontSize: 10, fontWeight: 700, letterSpacing: 0.4,
                    fontFamily: 'ui-monospace, Menlo, monospace',
                  }}>{t('wizard.staging.seed', { seed: active.seed })}</div>
                </div>
              </div>
            )}

            {/* Slider divider */}
            {active && phase === 'done' && (
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: `${sliderPos}%`,
                width: 2, background: '#fff',
                boxShadow: '0 0 24px rgba(0,0,0,0.4)',
                pointerEvents: 'none',
              }}>
                <div style={{
                  position: 'absolute', top: '50%', left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: 44, height: 44, borderRadius: 999,
                  background: '#fff',
                  boxShadow: '0 6px 20px rgba(0,0,0,0.30)',
                  display: 'grid', placeItems: 'center', color: '#0B0C0E',
                }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 18l-6-6 6-6M15 6l6 6-6 6"/>
                  </svg>
                </div>
              </div>
            )}

            {/* Phase IDLE — overlay grand prompt */}
            {phase === 'idle' && (
              <div style={{
                position: 'absolute', inset: 0,
                display: 'grid', placeItems: 'center',
                background: SugarV2.isDark ? 'rgba(8,8,12,0.55)' : 'rgba(237,239,243,0.55)',
                backdropFilter: 'blur(2px)',
              }}>
                <div style={{
                  background: SugarV2.card, borderRadius: 20, padding: 28,
                  boxShadow: SugarV2.shadow, maxWidth: 380, textAlign: 'center',
                }}>
                  <div style={{
                    width: 56, height: 56, borderRadius: 16,
                    background: SugarV2.black, color: sgOn(),
                    margin: '0 auto 14px',
                    display: 'grid', placeItems: 'center',
                  }}>
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m12 3 1.9 5.8L20 11l-5.8 1.9L12 19l-1.9-5.8L4 11l5.8-2L12 3Z"/>
                    </svg>
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 17, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.3 }}>
                    {t('wizard.staging.idleTitle')}
                  </h3>
                  <p style={{ margin: 0, fontSize: 13, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.5 }}>
                    {t('wizard.staging.idleBody')}
                  </p>
                </div>
              </div>
            )}

            {/* Phase GENERATING — barre de progression */}
            {(phase === 'generating' || phase === 'signing') && (
              <div style={{
                position: 'absolute', left: 0, right: 0, bottom: 0,
                padding: '18px 22px',
                background: 'linear-gradient(180deg, transparent 0%, rgba(11,12,14,0.55) 100%)',
                color: '#fff',
              }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  fontSize: 11.5, fontWeight: 700, letterSpacing: 0.5, marginBottom: 10,
                }}>
                  <span>
                    {phase === 'generating' && t('wizard.staging.generatingCount', { count: variants.length, total: 4 })}
                    {phase === 'signing' && t('wizard.staging.signingProgress')}
                  </span>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>
                    {phase === 'generating' ? `${Math.round(progress)} %` : '100 %'}
                  </span>
                </div>
                <div style={{
                  height: 4, borderRadius: 999,
                  background: 'rgba(255,255,255,0.20)', overflow: 'hidden',
                }}>
                  <div style={{
                    height: '100%', width: `${phase === 'signing' ? 100 : progress}%`,
                    background: '#fff', borderRadius: 999,
                    transition: 'width .15s ease',
                  }} />
                </div>
              </div>
            )}

            {/* Phase DONE — pill instruction */}
            {phase === 'done' && (
              <div style={{
                position: 'absolute', bottom: 14, left: '50%', transform: 'translateX(-50%)',
                padding: '6px 12px', borderRadius: 999,
                background: 'rgba(11,12,14,0.65)', color: '#fff',
                fontSize: 10.5, fontWeight: 600, letterSpacing: 0.4,
                backdropFilter: 'blur(6px)',
              }}>{t('wizard.staging.dragToCompare')}</div>
            )}
          </div>
        </div>

        {/* THUMBS — variantes générées */}
        <div style={{
          gridArea: 'thumbs',
          padding: '0 24px 18px',
          display: 'flex', alignItems: 'center', gap: 10, minHeight: 92,
        }}>
          {phase === 'idle' ? (
            <div style={{ fontSize: 12.5, color: SugarV2.muted, fontWeight: 500, paddingLeft: 4 }}>
              {t('wizard.staging.thumbsEmpty')}
            </div>
          ) : (
            <>
              {[0, 1, 2, 3].map(i => {
                const v = variants[i]
                if (!v) {
                  return (
                    <div key={i} style={{
                      flex: 1, aspectRatio: '4 / 3', borderRadius: 14,
                      background: SugarV2.cardSubtle,
                      display: 'grid', placeItems: 'center',
                      animation: phase === 'generating' ? 'sgPulse 1.4s ease-in-out infinite' : 'none',
                    }}>
                      {phase === 'generating' && (
                        <div style={{
                          width: 18, height: 18, borderRadius: 999,
                          border: `2px solid ${SugarV2.line}`,
                          borderTopColor: SugarV2.ink,
                          animation: 'sgSpin 0.8s linear infinite',
                        }} />
                      )}
                    </div>
                  )
                }
                const sel = activeVariant === v.id
                const isPicked = !!picked[v.id]
                return (
                  <button key={v.id}
                    onClick={() => setActiveVariant(v.id)}
                    style={{
                      flex: 1, aspectRatio: '4 / 3', borderRadius: 14, border: 0,
                      background: `repeating-linear-gradient(135deg, ${v.tone} 0 8px, ${shade(v.tone, -0.05)} 8px 16px)`,
                      cursor: 'pointer', padding: 0, position: 'relative',
                      outline: sel ? `3px solid ${SugarV2.black}` : 'none', outlineOffset: -3,
                      boxShadow: sel ? '0 12px 24px rgba(0,0,0,0.20)' : 'none',
                      transition: 'all .15s ease',
                      overflow: 'hidden',
                    }}>
                    {/* Pick checkbox */}
                    <div onClick={e => { e.stopPropagation(); togglePick(v.id) }} style={{
                      position: 'absolute', top: 8, left: 8,
                      width: 22, height: 22, borderRadius: 999,
                      background: isPicked ? '#0B0C0E' : 'rgba(255,255,255,0.92)',
                      display: 'grid', placeItems: 'center',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.20)',
                    }}>
                      {isPicked && (
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                          stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5"/>
                        </svg>
                      )}
                    </div>
                    {/* Label */}
                    <div style={{
                      position: 'absolute', bottom: 6, left: 6, right: 6,
                      padding: '4px 8px', borderRadius: 8,
                      background: 'rgba(255,255,255,0.92)', color: '#0B0C0E',
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    }}>
                      <span>{v.label}</span>
                      <span style={{
                        fontSize: 8.5, color: SugarV2.muted,
                        fontFamily: 'ui-monospace, Menlo, monospace',
                      }}>{v.seed}</span>
                    </div>
                  </button>
                )
              })}
            </>
          )}
        </div>

        {/* STUDIO panel */}
        <aside style={{
          gridArea: 'studio',
          background: SugarV2.card,
          borderLeft: `1px solid ${SugarV2.line}`,
          display: 'flex', flexDirection: 'column', minHeight: 0,
        }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: 24 }}>
            {/* Type de pièce */}
            <Section label={t('wizard.staging.roomTypeLabel')} hint={t('wizard.staging.roomTypeHint')}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ROOMS.map(r => {
                  const sel = roomType === r
                  return (
                    <button key={r} onClick={() => setRoomType(r)} style={{
                      height: 32, padding: '0 13px', borderRadius: 999, border: 0,
                      background: sel ? SugarV2.black : SugarV2.cardSubtle,
                      color: sel ? sgOn() : SugarV2.ink,
                      fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
                      cursor: 'pointer', textTransform: 'capitalize',
                      transition: 'all .15s ease',
                    }}>{t(`wizard.staging.rooms.${ROOM_KEY[r]}`)}</button>
                  )
                })}
              </div>
            </Section>

            {/* Style — toggle Presets / Custom */}
            <Section label={t('wizard.staging.styleLabel')} hint={styleMode === 'custom' ? t('wizard.staging.styleHintCustom') : t('wizard.staging.styleHintPreset')}>
              <div style={{
                display: 'flex', padding: 4, borderRadius: 999,
                background: SugarV2.cardSubtle, marginBottom: 12,
              }}>
                {([
                  { v: 'preset' as const, l: t('wizard.staging.tabPreset') },
                  { v: 'custom' as const, l: t('wizard.staging.tabCustom') },
                ]).map(o => {
                  const sel = styleMode === o.v
                  return (
                    <button key={o.v} onClick={() => setStyleMode(o.v)} style={{
                      flex: 1, height: 32, borderRadius: 999, border: 0,
                      background: sel ? SugarV2.card : 'transparent',
                      color: sel ? SugarV2.ink : SugarV2.inkSoft,
                      fontFamily: 'inherit', fontSize: 11.5, fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: sel ? SugarV2.shadowSm : 'none',
                      transition: 'all .15s ease',
                    }}>{o.l}</button>
                  )
                })}
              </div>

              {styleMode === 'preset' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                  {PRESETS.map(p => {
                    const sel = preset === p.v
                    return (
                      <button key={p.v} onClick={() => setPreset(p.v)} style={{
                        padding: 0, borderRadius: 12, border: 0,
                        background: SugarV2.cardSubtle,
                        cursor: 'pointer', overflow: 'hidden', fontFamily: 'inherit',
                        outline: sel ? `2.5px solid ${SugarV2.black}` : 'none', outlineOffset: -2.5,
                        transition: 'all .15s ease',
                      }}>
                        <div style={{
                          height: 38,
                          background: `linear-gradient(135deg, ${p.tone} 0%, ${shade(p.tone, -0.06)} 100%)`,
                        }} />
                        <div style={{ padding: '7px 10px', textAlign: 'left' }}>
                          <div style={{
                            fontSize: 11.5, fontWeight: 700, color: SugarV2.ink, letterSpacing: -0.1,
                          }}>{t(`wizard.staging.presets.${p.v}.label`)}</div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              {styleMode === 'custom' && (
                <div>
                  <textarea
                    value={customPrompt}
                    onChange={e => setCustomPrompt(e.target.value)}
                    placeholder={t('wizard.staging.customPlaceholder')}
                    rows={4}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '12px 14px', borderRadius: 12,
                      border: 0, background: SugarV2.cardSubtle,
                      fontFamily: 'inherit', fontSize: 13, color: SugarV2.ink,
                      fontWeight: 500, lineHeight: 1.55,
                      resize: 'vertical', outline: 'none',
                    }}
                  />
                  <div style={{ marginTop: 10 }}>
                    <div style={{
                      fontSize: 10, fontWeight: 700, color: SugarV2.muted,
                      letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
                    }}>{t('wizard.staging.quickInspirations')}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                      {QUICK_PROMPTS.map((_, i) => {
                        const q = t(`wizard.staging.quickPrompts.${i}`)
                        return (
                        <button key={i} onClick={() => setCustomPrompt(q)} style={{
                          padding: '8px 12px', borderRadius: 10, border: 0,
                          background: SugarV2.cardSubtle, color: SugarV2.ink,
                          fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
                          cursor: 'pointer', textAlign: 'left',
                          transition: 'background .15s ease',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = SugarV2.isDark ? '#2B2D40' : '#E0E2E6' }}
                        onMouseLeave={e => { e.currentTarget.style.background = SugarV2.cardSubtle }}>
                          {q}
                        </button>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </Section>

            {/* Précisions avancées */}
            <button onClick={() => setAdvOpen(o => !o)} style={{
              width: '100%', padding: '12px 0', border: 0, background: 'transparent',
              fontFamily: 'inherit', fontSize: 12, fontWeight: 700, color: SugarV2.muted,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              borderTop: `1px solid ${SugarV2.line}`, marginBottom: 4,
              letterSpacing: 0.6, textTransform: 'uppercase',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: advOpen ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .15s ease' }}>
                <path d="m9 6 6 6-6 6"/>
              </svg>
              {t('wizard.staging.advancedToggle')}
            </button>

            {advOpen && (
              <div style={{
                paddingBottom: 12,
                animation: 'sgFadeUp .2s ease both',
              }}>
                <Mini label={t('wizard.staging.densityLabel')}>
                  <Pills options={[
                    ['leger', t('wizard.staging.density.leger')],
                    ['moyen', t('wizard.staging.density.moyen')],
                    ['dense', t('wizard.staging.density.dense')],
                  ]}
                    value={density} onChange={v => setDensity(v as typeof density)} />
                </Mini>
                <Mini label={t('wizard.staging.budgetLabel')}>
                  <Pills options={[
                    ['economique', t('wizard.staging.budget.economique')],
                    ['standard', t('wizard.staging.budget.standard')],
                    ['premium', t('wizard.staging.budget.premium')],
                  ]}
                    value={budget} onChange={v => setBudget(v as typeof budget)} />
                </Mini>
              </div>
            )}

            {/* Récap prompt */}
            <div style={{
              marginTop: 12, padding: '10px 12px', borderRadius: 10,
              background: SugarV2.cardSubtle,
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: 10.5, lineHeight: 1.5, color: SugarV2.muted,
            }}>
              {/* « prompt » = terme technique identique FR/EN — hors catalogue i18n. */}
              <span style={{ color: SugarV2.ink, fontWeight: 700 }}>{'prompt'}&nbsp;›</span>{' '}
              {styleMode === 'preset'
                ? t('wizard.staging.promptRecap', {
                    style: t(`wizard.staging.presets.${activeStyle.v}.label`).toLowerCase(),
                    room: t(`wizard.staging.rooms.${ROOM_KEY[roomType]}`).toLowerCase(),
                    density: t(`wizard.staging.density.${density}`).toLowerCase(),
                    budget: t(`wizard.staging.budget.${budget}`).toLowerCase(),
                  })
                : (customPrompt || t('wizard.staging.promptRecapEmpty'))}
            </div>
          </div>

          {/* CTA footer */}
          <div style={{
            padding: '16px 24px',
            borderTop: `1px solid ${SugarV2.line}`,
            background: SugarV2.card,
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {phase === 'idle' && (
              <button onClick={generate} style={{
                height: 50, borderRadius: 999, border: 0,
                background: SugarV2.black, color: sgOn(),
                fontFamily: 'inherit', fontSize: 14, fontWeight: 700, letterSpacing: 0.1,
                cursor: 'pointer',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                boxShadow: '0 10px 24px rgba(0,0,0,0.22)',
                transition: 'all .2s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 14px 30px rgba(0,0,0,0.30)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.22)' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m12 3 1.9 5.8L20 11l-5.8 1.9L12 19l-1.9-5.8L4 11l5.8-2L12 3Z"/>
                </svg>
                {t('wizard.staging.generateCta', { count: 4 })}
              </button>
            )}

            {(phase === 'generating' || phase === 'signing') && (
              <button disabled style={{
                height: 50, borderRadius: 999, border: 0,
                background: SugarV2.cardSubtle, color: SugarV2.muted,
                fontFamily: 'inherit', fontSize: 13.5, fontWeight: 700,
                cursor: 'not-allowed',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
              }}>
                <span style={{
                  width: 14, height: 14, borderRadius: 999,
                  border: `2px solid ${SugarV2.line}`,
                  borderTopColor: SugarV2.ink,
                  animation: 'sgSpin 0.8s linear infinite', display: 'inline-block',
                }} />
                {phase === 'generating' ? t('wizard.staging.generatingShort') : t('wizard.staging.signingShort')}
              </button>
            )}

            {phase === 'done' && (
              <>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={reset} style={{
                    flex: '0 0 auto', height: 44, padding: '0 16px',
                    borderRadius: 999, border: 0,
                    background: SugarV2.cardSubtle, color: SugarV2.ink,
                    fontFamily: 'inherit', fontSize: 12.5, fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 7,
                  }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                      stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
                    </svg>
                    {t('wizard.staging.regenerate')}
                  </button>
                  <button onClick={saveSelection}
                    disabled={pickedCount === 0}
                    style={{
                      flex: 1, height: 44, borderRadius: 999, border: 0,
                      background: pickedCount === 0 ? SugarV2.cardSubtle : SugarV2.black,
                      color: pickedCount === 0 ? SugarV2.muted : sgOn(),
                      fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                      cursor: pickedCount === 0 ? 'not-allowed' : 'pointer',
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      boxShadow: pickedCount > 0 ? '0 8px 20px rgba(0,0,0,0.22)' : 'none',
                      transition: 'all .15s ease',
                    }}>
                    {pickedCount === 0
                      ? t('wizard.staging.pickPrompt')
                      : t('wizard.staging.addSigned', { count: pickedCount })}
                    {pickedCount > 0 && (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                        stroke={sgOn()} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    )}
                  </button>
                </div>
                <div style={{
                  fontSize: 10.5, color: SugarV2.muted, fontWeight: 500, lineHeight: 1.45, textAlign: 'center',
                }}>
                  <Trans i18nKey="wizard.staging.saveFootnote" ns="listings"
                    components={{ strong: <strong style={{ color: SugarV2.ink }} /> }} />
                </div>
              </>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

// ─── Sub-components ────────────────────────────────────────────────────
function Section({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        marginBottom: 9,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: SugarV2.ink,
          letterSpacing: 0.6, textTransform: 'uppercase',
        }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: SugarV2.muted, fontWeight: 500 }}>{hint}</div>}
      </div>
      {children}
    </div>
  )
}

function Mini({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: SugarV2.muted,
        letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</div>
      {children}
    </div>
  )
}

function Pills({
  options, value, onChange,
}: { options: [string, string][]; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{
      display: 'flex', padding: 3, borderRadius: 999, background: SugarV2.cardSubtle,
    }}>
      {options.map(([v, l]) => {
        const sel = value === v
        return (
          <button key={v} onClick={() => onChange(v)} style={{
            flex: 1, height: 28, borderRadius: 999, border: 0,
            background: sel ? SugarV2.card : 'transparent',
            color: sel ? SugarV2.ink : SugarV2.inkSoft,
            fontFamily: 'inherit', fontSize: 11, fontWeight: 700,
            cursor: 'pointer',
            boxShadow: sel ? SugarV2.shadowSm : 'none',
          }}>{l}</button>
        )
      })}
    </div>
  )
}
