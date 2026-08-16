// MEGGA CRM Sugar v2 Wizard — Step 2 : Adresse
// 1:1 port from the Claude Design bundle (crm-wizard-sugar-step2.jsx).
// Mapbox Light + geocoding live, autocomplete, accordion "Affiner".

import { useState, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { WizardTokens, crmOn, crmVeil, cantonShortFromName, type WizardData } from '../tokens'
import { CrmInput } from '../primitives'
import { crmContactById } from '@/components/crm/mockData'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || ''
const MAPBOX_STYLE = 'mapbox/light-v11'

interface StepProps { data: WizardData; set: (patch: Partial<WizardData>) => void }

interface MapboxFeature {
  id: string
  place_name: string
  text: string
  center: [number, number]
  context: { id?: string; text?: string }[]
  properties: { address?: string }
  address?: string
}

declare global {
  interface Window {
    mapboxgl?: {
      accessToken: string
      Map: new (opts: object) => {
        on: (event: string, cb: (e: { error?: { status?: number } }) => void) => void
        flyTo: (opts: { center: [number, number]; zoom: number; duration: number; essential: boolean }) => void
        remove: () => void
      }
      Marker: new (el: HTMLElement) => { setLngLat: (c: [number, number]) => { addTo: (m: object) => unknown }; remove: () => void }
    }
  }
}

export function Step2Address({ data, set }: StepProps) {
  const { t } = useTranslation('listings')
  // Brouillon inline → snapshot du vendeur existant (figé) → fallback registry.
  const linkedOwner = data.ownerContactId
    ? (data._newContact ?? data._ownerContact ?? crmContactById(data.ownerContactId))
    : null

  const [query, setQuery] = useState(data.addr || '')
  const [suggestions, setSuggestions] = useState<MapboxFeature[]>([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [confirmed, setConfirmed] = useState(!!data.addrConfirmed)
  const [loading, setLoading] = useState(false)
  const [showRefine, setShowRefine] = useState(false)
  const [coords, setCoords] = useState<[number, number] | null>(data.coords || null)
  const debounceRef = useRef<number | null>(null)

  const geocode = async (q: string, autoConfirm = false) => {
    if (!q || q.length < 3) { setSuggestions([]); return }
    setLoading(true)
    try {
      if (!MAPBOX_TOKEN) throw new Error('No Mapbox token')
      // ⛔ GEOCODING v6, ET NON v5. Mapbox a classé `geocoding/v5/mapbox.places` LEGACY :
      // elle n'est plus servie qu'aux comptes qui l'utilisaient déjà. Mesuré le
      // 16.08.2026 avec un jeton neuf, valide et sans restriction : HTTP 403,
      // `{"message":"Forbidden"}` — l'autocomplétion retombait donc SILENCIEUSEMENT sur
      // `mockSuggestions`, c'est-à-dire sur des adresses inventées, sans que rien à
      // l'écran ne le dise. Le `catch` qui rend ce repli si commode est aussi ce qui
      // rendait la panne invisible.
      const url = `https://api.mapbox.com/search/geocode/v6/forward`
        + `?q=${encodeURIComponent(q)}&access_token=${MAPBOX_TOKEN}&country=ch&limit=5&language=fr&types=address`
      const res = await fetch(url)
      if (!res.ok) throw new Error(`geocode ${res.status}`)
      const json = await res.json()
      // v6 rend un contexte NOMMÉ là où v5 rendait un tableau. On le ramène ici à la
      // forme locale, pour que `chooseSuggestion` et le repli de démonstration
      // continuent de parler la même langue.
      const feats: MapboxFeature[] = (json.features || []).map((f: {
        properties?: {
          mapbox_id?: string
          full_address?: string
          name?: string
          context?: {
            street?: { name?: string }
            address?: { address_number?: string }
            postcode?: { name?: string }
            place?: { name?: string }
            region?: { name?: string }
          }
        }
        geometry?: { coordinates?: [number, number] }
      }) => {
        const ctx = f.properties?.context ?? {}
        return {
          id: f.properties?.mapbox_id ?? '',
          place_name: f.properties?.full_address ?? f.properties?.name ?? '',
          text: ctx.street?.name ?? f.properties?.name ?? '',
          center: (f.geometry?.coordinates ?? [0, 0]) as [number, number],
          context: [
            { id: 'postcode', text: ctx.postcode?.name },
            { id: 'place', text: ctx.place?.name },
            { id: 'region', text: ctx.region?.name },
          ].filter((c) => !!c.text),
          properties: { address: ctx.address?.address_number },
          address: ctx.address?.address_number,
        }
      })
      setSuggestions(feats)
      setShowSuggestions(!autoConfirm)
      if (autoConfirm && feats[0]) chooseSuggestion(feats[0])
    } catch {
      const fake = mockSuggestions(q)
      setSuggestions(fake)
      setShowSuggestions(!autoConfirm)
      if (autoConfirm && fake[0]) chooseSuggestion(fake[0])
    } finally {
      setLoading(false)
    }
  }

  // Pré-fill : si data.addr présente (depuis soumission), tenter un geocode auto
  useEffect(() => {
    if (data.addr && !confirmed && !coords) {
      geocode(data.addr, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onChangeQuery = (v: string) => {
    setQuery(v)
    setConfirmed(false)
    set({ addr: v, addrConfirmed: false })
    if (debounceRef.current) window.clearTimeout(debounceRef.current)
    debounceRef.current = window.setTimeout(() => geocode(v), 250)
  }

  const chooseSuggestion = (s: MapboxFeature) => {
    const ctx = s.context || []
    const postcode = (ctx.find(c => c.id?.startsWith('postcode')) || {}).text || ''
    const place = (ctx.find(c => c.id?.startsWith('place')) || {}).text || ''
    const region = (ctx.find(c => c.id?.startsWith('region')) || {}).text || ''
    const cantonShort = cantonShortFromName(region)
    const houseNum = s.address || s.properties?.address || ''
    const street = s.text || ''

    setQuery(s.place_name)
    setSuggestions([])
    setShowSuggestions(false)
    setConfirmed(true)
    setCoords(s.center)
    set({
      addr: s.place_name, addrConfirmed: true,
      addrStreet: street, addrHouseNumber: houseNum,
      postCode: postcode, city: place,
      canton: region, cantonShort,
      coords: s.center,
    })
  }

  const reset = () => {
    setConfirmed(false)
    setQuery('')
    setSuggestions([])
    setCoords(null)
    set({ addr: '', addrConfirmed: false, coords: null })
  }

  return (
    <div style={{ maxWidth: 980, margin: '0 auto',
      animation: 'sgFadeUp .5s cubic-bezier(.2,.8,.2,1) both' }}>

      <div style={{ marginBottom: 32, maxWidth: 720 }}>
        <h1 style={{
          margin: 0, fontSize: 'var(--crm-text-9xl)', fontWeight: 500,
          color: WizardTokens.ink, letterSpacing: -0.8, lineHeight: 1.1,
        }}>{t('wizard.step2.title')}</h1>

        {linkedOwner && (
          <div style={{
            marginTop: 18,
            display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-lg)',
            padding: 'var(--crm-space-md) var(--crm-space-2xl) var(--crm-space-md) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
            background: WizardTokens.card, boxShadow: WizardTokens.shadowSm,
          }}>
            <div style={{
              width: 26, height: 26, borderRadius: 'var(--crm-radius-pill)',
              background: linkedOwner.avatarBg || '#3B82F6',
              color: crmOn(), display: 'grid', placeItems: 'center',
              fontSize: 'var(--crm-text-xs)', fontWeight: 600, flexShrink: 0,
            }}>{(linkedOwner.firstName?.[0] || '') + (linkedOwner.lastName?.[0] || '')}</div>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: WizardTokens.ink }}>
              {t('wizard.forOwner', { name: `${linkedOwner.firstName} ${linkedOwner.lastName}` })}
            </span>
          </div>
        )}
      </div>

      {/* Recherche centrale */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <div style={{
          background: WizardTokens.card, borderRadius: 'var(--crm-radius-5xl)',
          padding: 'var(--crm-space-md) var(--crm-space-md) var(--crm-space-md) var(--crm-space-6xl)',
          boxShadow: confirmed ? WizardTokens.shadowSm : WizardTokens.shadow,
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)',
          transition: 'all .25s ease',
        }}>
          {confirmed ? (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={WizardTokens.ok} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={WizardTokens.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 10c0 7-8 13-8 13S4 17 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
            </svg>
          )}
          <input autoFocus={!confirmed}
            value={query}
            onChange={e => onChangeQuery(e.target.value)}
            onFocus={() => setShowSuggestions(suggestions.length > 0)}
            placeholder={t('wizard.step2.searchPlaceholder')}
            style={{
              flex: 1, height: 56, border: 0, background: 'transparent',
              outline: 'none', fontFamily: 'inherit',
              fontSize: 'var(--crm-text-2xl)', color: WizardTokens.ink, fontWeight: 500, letterSpacing: -0.2,
            }} />
          {loading && (
            <div style={{
              width: 16, height: 16, borderRadius: 'var(--crm-radius-pill)',
              border: `2px solid ${WizardTokens.ghost}`, borderTopColor: WizardTokens.ink,
              animation: 'sgSpin .8s linear infinite', marginRight: 8,
            }} />
          )}
          {confirmed && (
            <button onClick={reset} style={{
              height: 36, padding: '0 var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-pill)', border: 0,
              background: WizardTokens.cardSubtle, color: WizardTokens.inkSoft,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer',
              marginRight: 6,
            }}>{t('common:actions.edit')}</button>
          )}
        </div>

        {showSuggestions && suggestions.length > 0 && !confirmed && (
          <div style={{
            position: 'absolute', top: '100%', left: 0, right: 0,
            marginTop: 8, background: WizardTokens.card, borderRadius: 'var(--crm-radius-3xl)',
            boxShadow: WizardTokens.shadowLg, padding: 'var(--crm-space-sm)', zIndex: 20,
            animation: 'sgFadeUp .25s cubic-bezier(.2,.8,.2,1) both',
          }}>
            {suggestions.map(s => (
              <button key={s.id} onClick={() => chooseSuggestion(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', width: '100%',
                  padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)', border: 0,
                  background: 'transparent', color: WizardTokens.ink, fontFamily: 'inherit',
                  textAlign: 'left', cursor: 'pointer',
                  transition: 'background .15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = WizardTokens.cardSubtle}
                onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={WizardTokens.muted} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <path d="M20 10c0 7-8 13-8 13S4 17 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
                </svg>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: WizardTokens.ink,
                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>{s.place_name}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Carte */}
      <div style={{
        position: 'relative', marginTop: 22, marginBottom: 22,
        borderRadius: 'var(--crm-radius-5xl)', overflow: 'hidden',
        boxShadow: WizardTokens.shadow,
        background: WizardTokens.cardSubtle,
        height: 380,
      }}>
        <CrmMapbox coords={coords} confirmed={confirmed} />
      </div>

      {/* Card "Données extraites" + Affiner */}
      {confirmed && (
        <div style={{
          background: WizardTokens.card, borderRadius: 'var(--crm-radius-5xl)', padding: 'var(--crm-space-7xl)',
          boxShadow: WizardTokens.shadow,
          animation: 'sgScaleIn .35s cubic-bezier(.2,.8,.2,1) both',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xl)', marginBottom: 18 }}>
            <div style={{
              width: 38, height: 38, borderRadius: 'var(--crm-radius-md)',
              background: 'rgba(16,185,129,0.12)',
              display: 'grid', placeItems: 'center', flexShrink: 0,
            }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={WizardTokens.ok} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6 9 17l-5-5"/>
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', marginBottom: 2 }}>
                <span style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: WizardTokens.ink, letterSpacing: -0.2 }}>
                  {t('wizard.step2.confirmedTitle')}
                </span>
                <span style={{
                  padding: 'var(--crm-space-2xs) var(--crm-space-md)', borderRadius: 'var(--crm-radius-pill)',
                  background: WizardTokens.black, color: crmOn(),
                  fontSize: 'var(--crm-text-xs)', fontWeight: 600,
                }}>MEGGA AI</span>
              </div>
              <div style={{ fontSize: 'var(--crm-text-md)', color: WizardTokens.muted, fontWeight: 500 }}>
                {t('wizard.step2.confirmedSubtitle')}
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 'var(--crm-space-xl)' }}>
            {[
              { label: t('form.fields.postalCodeFull'), value: data.postCode || '—' },
              { label: t('form.fields.city'), value: data.city || '—' },
              { label: t('form.fields.canton'), value: data.canton ? `${data.canton} (${data.cantonShort || '—'})` : '—' },
              { label: t('wizard.step2.coordinates'), value: coords ? `${coords[1].toFixed(4)}, ${coords[0].toFixed(4)}` : '—' },
            ].map((f, i) => (
              <div key={i} style={{
                padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)',
                background: WizardTokens.cardSubtle,
              }}>
                <div style={{
                  fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: WizardTokens.muted,
                  marginBottom: 4,
                }}>{f.label}</div>
                <div style={{
                  fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: WizardTokens.ink, letterSpacing: -0.2,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{f.value}</div>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <button onClick={() => setShowRefine(s => !s)} style={{
              display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
              padding: 'var(--crm-space-lg) var(--crm-space-2xl)', borderRadius: 'var(--crm-radius-lg)', border: 0,
              background: 'transparent', color: WizardTokens.ink,
              fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, cursor: 'pointer',
            }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={WizardTokens.ink} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ transform: showRefine ? 'rotate(90deg)' : 'rotate(0)', transition: 'transform .2s ease' }}>
                <path d="m9 18 6-6-6-6"/>
              </svg>
              {t('wizard.step2.refineToggle')}
            </button>

            {showRefine && (
              <div style={{
                marginTop: 8, padding: 'var(--crm-space-4xl)',
                borderRadius: 'var(--crm-radius-2xl)', background: WizardTokens.cardSubtle,
                animation: 'sgFadeUp .3s cubic-bezier(.2,.8,.2,1) both',
              }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--crm-space-2xl)', marginBottom: 14 }}>
                  <CrmInput label={t('wizard.step2.refine.unit')} value={data.unit || ''} onChange={v => set({ unit: v })} placeholder={t('wizard.step2.refine.unitPlaceholder')} />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-md)' }}>
                    <CrmInput label={t('form.fields.floor')} value={data.floor != null ? String(data.floor) : ''} onChange={v => set({ floor: v ? parseInt(v) : null })} placeholder="3" />
                    <CrmInput label={t('wizard.step2.refine.outOf')} value={data.floorsTotal != null ? String(data.floorsTotal) : ''} onChange={v => set({ floorsTotal: v ? parseInt(v) : null })} placeholder="5" />
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 'var(--crm-space-2xl)' }}>
                  <CrmInput label={t('wizard.step2.refine.cadastral')} value={data.cadastralId || ''} onChange={v => set({ cadastralId: v })} placeholder={t('wizard.step2.refine.cadastralPlaceholder')} />
                  <CrmInput label={t('wizard.step2.refine.postalAdjust')} value={data.postCode || ''} onChange={v => set({ postCode: v })} />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Composant Mapbox (avec fallback élégant) ────────────────────────
function CrmMapbox({ coords, confirmed }: { coords: [number, number] | null; confirmed: boolean }) {
  const { t } = useTranslation('listings')
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<ReturnType<NonNullable<Window['mapboxgl']>['Map']['prototype']['constructor']> | null>(null)
  const markerRef = useRef<{ setLngLat: (c: [number, number]) => { addTo: (m: object) => unknown }; remove: () => void } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Charger la lib Mapbox une seule fois
  useEffect(() => {
    if (window.mapboxgl) return
    if (!MAPBOX_TOKEN) { setError('Token Mapbox absent'); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://api.mapbox.com/mapbox-gl-js/v3.6.0/mapbox-gl.js'
    script.onload = () => setError(null)
    script.onerror = () => setError('Mapbox script failed to load')
    document.head.appendChild(script)
  }, [])

  // Init map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return
    const tryInit = () => {
      if (!window.mapboxgl) { setTimeout(tryInit, 200); return }
      try {
        window.mapboxgl.accessToken = MAPBOX_TOKEN
        const map = new window.mapboxgl.Map({
          container: containerRef.current!,
          style: `mapbox://styles/${MAPBOX_STYLE}`,
          center: coords || [6.6323, 46.5197],
          zoom: coords ? 16 : 8,
          attributionControl: false,
          interactive: false,
        })
        map.on('error', (e: { error?: { status?: number } }) => {
          if (e.error?.status === 401) setError('Token Mapbox invalide')
          else setError('Erreur carte')
        })
        mapRef.current = map
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur carte')
      }
    }
    tryInit()
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Move map when coords change
  useEffect(() => {
    if (!mapRef.current || !coords || !window.mapboxgl) return
    mapRef.current.flyTo({ center: coords, zoom: 16, duration: 1400, essential: true })
    if (markerRef.current) markerRef.current.remove()
    const el = document.createElement('div')
    el.style.cssText = `
      width: 22px; height: 22px; border-radius: 999px;
      background: ${WizardTokens.black}; border: 4px solid ${WizardTokens.onBlack};
      box-shadow: 0 8px 24px rgba(0,0,0,0.4);
      animation: sgPinPulse 2s ease-in-out infinite;
    `
    markerRef.current = new window.mapboxgl.Marker(el).setLngLat(coords).addTo(mapRef.current) as unknown as typeof markerRef.current
  }, [coords])

  return (
    <div ref={containerRef} style={{
      width: '100%', height: '100%', position: 'relative',
      background: WizardTokens.cardSubtle,
    }}>
      {error && <CrmMapFallback error={error} confirmed={confirmed} />}
      {!confirmed && !error && (
        <div style={{
          position: 'absolute', inset: 0,
          display: 'grid', placeItems: 'center',
          background: WizardTokens.isDark
            ? 'linear-gradient(180deg, rgba(8,8,12,0) 0%, rgba(8,8,12,0.7) 100%)'
            : 'linear-gradient(180deg, rgba(237,239,243,0) 0%, rgba(237,239,243,0.6) 100%)',
          pointerEvents: 'none',
        }}>
          <div style={{
            background: crmVeil(0.85), backdropFilter: 'blur(8px)',
            padding: 'var(--crm-space-lg) var(--crm-space-3xl)', borderRadius: 'var(--crm-radius-pill)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
            fontSize: 'var(--crm-text-md)', fontWeight: 600, color: WizardTokens.muted,
          }}>{t('wizard.step2.mapPrompt')}</div>
        </div>
      )}
    </div>
  )
}

function CrmMapFallback({ error, confirmed }: { error: string; confirmed: boolean }) {
  const { t } = useTranslation('listings')
  const grid1 = WizardTokens.isDark ? 'rgba(255,255,255,0.07)' : '#c5cdd9'
  const grid2 = WizardTokens.isDark ? 'rgba(255,255,255,0.04)' : '#dbe1ea'
  return (
    <div style={{
      position: 'absolute', inset: 0,
      background: WizardTokens.isDark ? `
        radial-gradient(circle at 30% 40%, rgba(255,255,255,0.03) 0%, transparent 50%),
        radial-gradient(circle at 70% 60%, rgba(255,255,255,0.03) 0%, transparent 50%),
        linear-gradient(135deg, #15161F 0%, #0E0F16 100%)
      ` : `
        radial-gradient(circle at 30% 40%, rgba(0,0,0,0.04) 0%, transparent 50%),
        radial-gradient(circle at 70% 60%, rgba(0,0,0,0.04) 0%, transparent 50%),
        linear-gradient(135deg, #f0f3f8 0%, #e6ebf3 100%)
      `,
      overflow: 'hidden',
    }}>
      <svg width="100%" height="100%" viewBox="0 0 800 380" preserveAspectRatio="none"
        style={{ position: 'absolute', inset: 0, opacity: 0.5 }}>
        <line x1="0" y1="120" x2="800" y2="100" stroke={grid1} strokeWidth="2"/>
        <line x1="0" y1="220" x2="800" y2="240" stroke={grid1} strokeWidth="2"/>
        <line x1="120" y1="0" x2="100" y2="380" stroke={grid1} strokeWidth="2"/>
        <line x1="350" y1="0" x2="380" y2="380" stroke={grid1} strokeWidth="2"/>
        <line x1="620" y1="0" x2="640" y2="380" stroke={grid1} strokeWidth="2"/>
        <line x1="0" y1="60" x2="800" y2="50" stroke={grid2} strokeWidth="1.5"/>
        <line x1="0" y1="320" x2="800" y2="310" stroke={grid2} strokeWidth="1.5"/>
      </svg>

      {confirmed && (
        <div style={{
          position: 'absolute', left: '50%', top: '50%',
          transform: 'translate(-50%, -50%)',
        }}>
          <div style={{
            width: 22, height: 22, borderRadius: 'var(--crm-radius-pill)',
            background: WizardTokens.black, border: `4px solid ${WizardTokens.onBlack}`,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            animation: 'sgPinPulse 2s ease-in-out infinite',
          }} />
        </div>
      )}

      {error && (
        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          padding: 'var(--crm-space-sm) var(--crm-space-xl)', borderRadius: 'var(--crm-radius-md)',
          background: crmVeil(0.9), backdropFilter: 'blur(6px)',
          fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: WizardTokens.muted,
          boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {t('wizard.step2.mapUnavailable')}
        </div>
      )}
    </div>
  )
}

function mockSuggestions(q: string): MapboxFeature[] {
  const seed: Omit<MapboxFeature, 'id'>[] = [
    { place_name: `${q}, 1227 Carouge, Genève, Suisse`, text: q, address: '22',
      center: [6.1336, 46.1839], context: [
        { id: 'postcode.1', text: '1227' }, { id: 'place.1', text: 'Carouge' }, { id: 'region.1', text: 'Genève' },
      ], properties: {} },
    { place_name: `${q}, 1206 Genève, Genève, Suisse`, text: q, address: '15',
      center: [6.1432, 46.1958], context: [
        { id: 'postcode.2', text: '1206' }, { id: 'place.2', text: 'Genève' }, { id: 'region.2', text: 'Genève' },
      ], properties: {} },
  ]
  return seed.slice(0, q.length > 5 ? 2 : 1).map((s, i) => ({ id: 'mock-' + i, ...s }))
}
