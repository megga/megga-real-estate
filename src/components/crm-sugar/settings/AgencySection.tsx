// MEGGA CRM Sugar v2 — Settings « Mon agence » (maquette « Sugar Pure », step 2).
//
// Câblage réel : agencies via useAgencySettings (name, address, city, canton,
// phone, email, website, logo_url, legal_name, ide, tva, founded_year,
// postal_code, country, about_short). Le logo est uploadé dans le bucket Storage
// `agency-logos` (path `${agencyId}/logo.png`) puis l'URL publique est persistée.
//
// Fidèle au handoff : crm-screen-settings-step2.jsx → SettingsAgencySection,
// AgencyHero, AgKV, LogoUploadModal, AddressAutocomplete. Réutilise les atoms
// gelés (SetInput, SetTextarea, SetRing, StickySaveBar, ConfirmModal, SetIcon,
// SetBlackBtn, SetGhostBtn) — aucune jauge ni primitive réécrite.

import { useEffect, useRef, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { useToast } from '@/components/ui/Toast'
import { useReducedMotion } from '@/hooks/useReducedMotion'
import { useAgencySettings, type AgencySettingsData } from '@/hooks/useAgencySettings'
import { useAgencyTargets } from '@/hooks/useAgencyTargets'
import { formatCHF } from '@/lib/utils'
import {
  ConfirmModal,
  SetBlackBtn,
  SetGhostBtn,
  SetIcon,
  SetInput,
  SetRing,
  SetTextarea,
  StickySaveBar,
} from './atoms'
import { SET_PALETTE } from './data'

const SET = SET_PALETTE

// ─── État local complet de la maquette ────────────────────────────────────
// Tous les champs sont désormais persistés vers agencies (le logo via le bucket
// Storage `agency-logos`). `web` ↔ website, `legal` ↔ legal_name,
// `foundedYear` ↔ founded_year, `postal` ↔ postal_code, `aboutShort` ↔ about_short.
interface AgencyForm {
  name: string
  address: string
  city: string
  canton: string
  phone: string
  email: string
  web: string // ↔ website
  legal: string // ↔ legal_name
  ide: string
  tva: string
  foundedYear: string // ↔ founded_year (int en DB)
  postal: string // ↔ postal_code
  country: string
  aboutShort: string // ↔ about_short
  branding: { logoBg: string; initials: string; logoUrl: string | null }
}

// Couleur FIXE (pas SET.black qui s'inverse avec le thème) : la tuile-logo est une
// surface de marque, pas un accent UI. Évite l'inversion off-white + le halo blanc
// en dark (et la capture HMR du mauvais token).
const LOGO_BG_DEFAULT = '#0B0C0E'

// Construit le state de formulaire à partir de la donnée serveur (tous les
// champs sont adossés à une colonne agencies).
function toForm(a: AgencySettingsData): AgencyForm {
  const initials = (a.name || '?')
    .split(/\s+/)
    .map(w => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
  return {
    name: a.name,
    address: a.address,
    city: a.city,
    canton: a.canton,
    phone: a.phone,
    email: a.email,
    web: a.website,
    legal: a.legal,
    ide: a.ide,
    tva: a.tva,
    foundedYear: a.foundedYear,
    postal: a.postal,
    // Défaut « Suisse » si la colonne est vide (agence vierge / canton suisse implicite).
    country: a.country || 'Suisse',
    aboutShort: a.aboutShort,
    branding: { logoBg: LOGO_BG_DEFAULT, initials: initials || 'AG', logoUrl: a.logoUrl || null },
  }
}

// Mappe le form vers la donnée serveur. Le logo a déjà été uploadé en amont
// (branding.logoUrl contient l'URL publique Storage ou null après suppression) ;
// on ne persiste un dataURL en fallback que si l'upload Storage a échoué.
function toServer(f: AgencyForm): AgencySettingsData {
  return {
    name: f.name,
    address: f.address,
    city: f.city,
    canton: f.canton,
    phone: f.phone,
    email: f.email,
    website: f.web,
    legal: f.legal,
    ide: f.ide,
    tva: f.tva,
    foundedYear: f.foundedYear,
    postal: f.postal,
    country: f.country,
    aboutShort: f.aboutShort,
    logoUrl: f.branding.logoUrl || '',
  }
}

// ─── Upload du logo vers le bucket Storage `agency-logos` ──────────────────
// La policy RLS EXIGE que le 1er segment du path = l'agency_id. On upsert le PNG
// puis renvoie l'URL publique (cache-bust pour forcer le rafraîchissement CDN).
// En cas d'échec → null : l'appelant garde le dataURL en preview locale.
async function uploadAgencyLogo(dataUrl: string, agencyId: string): Promise<string | null> {
  try {
    const blob = await (await fetch(dataUrl)).blob()
    const path = `${agencyId}/logo.png`
    const { error } = await supabase.storage
      .from('agency-logos')
      .upload(path, blob, { upsert: true, contentType: 'image/png', cacheControl: '3600' })
    if (error) {
      console.error('[AgencySection] logo upload failed', error)
      return null
    }
    const { data } = supabase.storage.from('agency-logos').getPublicUrl(path)
    if (!data?.publicUrl) return null
    // cache-bust (Date.now() au runtime, jamais au niveau module).
    return `${data.publicUrl}?v=${Date.now()}`
  } catch (err) {
    console.error('[AgencySection] logo upload threw', err)
    return null
  }
}

// Supprime le logo du bucket (best-effort : on n'échoue pas le flux si la
// suppression Storage rate, l'URL en base sera quand même remise à null).
async function removeAgencyLogo(agencyId: string): Promise<void> {
  try {
    await supabase.storage.from('agency-logos').remove([`${agencyId}/logo.png`])
  } catch (err) {
    console.error('[AgencySection] logo remove failed', err)
  }
}

// ─── Score de complétude agence (calcul local filled/total) ────────────────
function agScore(f: AgencyForm): number {
  const checks = [
    f.name, f.legal, f.ide, f.tva, f.address, f.postal, f.city,
    // logoUrl (vrai logo uploadé) et non branding.initials : les initiales ont un
    // fallback « AG » toujours présent → faisaient 8% à vide. logoUrl est vide par
    // défaut, donc agence vierge = 0%.
    f.phone, f.email, f.web, f.aboutShort, f.branding.logoUrl,
  ]
  return Math.round((checks.filter(Boolean).length / checks.length) * 100)
}

// ─── Glyphes absents du set d'icônes gelé (SetIcon) ────────────────────────
// SetIcon ne connaît pas phone / mapPin / badge / search / file. On les rend
// localement à l'identique du handoff (line, currentColor) sans toucher l'atome.
type LocalGlyph = 'phone' | 'mapPin' | 'badge' | 'search' | 'file' | 'target'
const LOCAL_PATHS: Record<LocalGlyph, ReactNode> = {
  target: (
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="1.5" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92Z" />
  ),
  mapPin: (
    <>
      <path d="M12 22s8-7 8-13a8 8 0 1 0-16 0c0 6 8 13 8 13Z" />
      <circle cx="12" cy="9" r="3" />
    </>
  ),
  badge: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M7 9h10M7 13h6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m21 21-4.3-4.3" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
    </>
  ),
}
function LocalIcon({ name, size = 16, stroke = 'currentColor', sw = 1.6 }: { name: LocalGlyph; size?: number; stroke?: string; sw?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {LOCAL_PATHS[name]}
    </svg>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  HERO SPLIT — panneau logo (320px) + panneau infos (read-outs AgKV + jauge)
// ═══════════════════════════════════════════════════════════════════════════
function AgKV({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0 }}>
      <div
        style={{
          width: 34,
          height: 34,
          borderRadius: 10,
          background: SET.cardSubtle,
          display: 'grid',
          placeItems: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            color: SET.muted,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: 13.5,
            fontWeight: 600,
            color: SET.ink,
            letterSpacing: -0.2,
            marginTop: 1,
            fontVariantNumeric: 'tabular-nums',
            fontFeatureSettings: '"tnum" 1',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value || '—'}
        </div>
      </div>
    </div>
  )
}

function AgencyHero({ form, score, onEditLogo }: { form: AgencyForm; score: number; onEditLogo: () => void }) {
  const b = form.branding
  return (
    <div
      style={{
        background: SET.card,
        borderRadius: 24,
        boxShadow: SET.shadow,
        overflow: 'hidden',
        display: 'flex',
        flexWrap: 'wrap',
      }}
    >
      {/* Panneau identité (logo) */}
      <div
        style={{
          position: 'relative',
          padding: '40px 32px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 18,
          width: 320,
          flexShrink: 0,
        }}
      >
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 168,
              height: 168,
              borderRadius: 32,
              background: b.logoBg,
              color: '#fff', // texte posé sur la tuile-logo (surface volontairement choisie par l'agence)
              display: 'grid',
              placeItems: 'center',
              overflow: 'hidden',
              fontSize: 62,
              fontWeight: 800,
              letterSpacing: '.04em',
              // Ombre neutre (pas teintée par logoBg) → aucun halo coloré, uniforme light/dark.
              boxShadow: SET.shadowLg,
            }}
          >
            {b.logoUrl ? (
              <img
                src={b.logoUrl}
                alt="Logo agence"
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              b.initials
            )}
          </div>
          <button
            onClick={onEditLogo}
            title="Modifier le logo"
            style={{
              position: 'absolute',
              bottom: -8,
              right: -8,
              width: 44,
              height: 44,
              borderRadius: 999,
              border: `4px solid ${SET.card}`,
              background: SET.black,
              color: SET.blackInk,
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              boxShadow: '0 8px 20px rgba(11,12,14,0.32)',
            }}
          >
            <SetIcon name="camera" size={18} stroke={SET.blackInk} />
          </button>
        </div>
      </div>

      {/* Panneau infos */}
      <div
        style={{
          flex: 1,
          minWidth: 380,
          padding: '30px 34px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 22,
            gap: 16,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: SET.muted,
                letterSpacing: 0.6,
                textTransform: 'uppercase',
              }}
            >
              Mon agence
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 800,
                color: SET.ink,
                letterSpacing: -0.5,
                marginTop: 3,
              }}
            >
              {form.name || 'Nom non défini'}
            </div>
          </div>
          <SetRing value={score} size={78} showPercent />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 28px' }}>
          <AgKV icon={<LocalIcon name="file" size={15} stroke={SET.ink} />} label="Numéro IDE" value={form.ide} />
          <AgKV icon={<LocalIcon name="badge" size={15} stroke={SET.ink} />} label="N° TVA" value={form.tva} />
          <AgKV
            icon={<LocalIcon name="mapPin" size={15} stroke={SET.ink} />}
            label="Siège"
            value={form.address ? `${form.address}, ${form.postal} ${form.city}`.replace(/,\s+$/, '') : ''}
          />
          <AgKV icon={<LocalIcon name="phone" size={15} stroke={SET.ink} />} label="Téléphone" value={form.phone} />
          <AgKV icon={<SetIcon name="globe" size={15} stroke={SET.ink} />} label="Site web" value={form.web} />
          <AgKV icon={<SetIcon name="mail" size={15} stroke={SET.ink} />} label="Email" value={form.email} />
        </div>
      </div>
    </div>
  )
}

// ─── Groupe interne d'une card bento (titre + corps) ───────────────────────
function AgGroup({
  glyph,
  setIcon,
  title,
  first,
  children,
}: {
  glyph?: LocalGlyph
  setIcon?: 'building' | 'globe'
  title: string
  first?: boolean
  children: ReactNode
}) {
  return (
    <div style={{ padding: '22px 26px', borderTop: first ? 'none' : `1px solid ${SET.line}` }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 16 }}>
        <div style={{ marginTop: 1, flexShrink: 0 }}>
          {setIcon ? (
            <SetIcon name={setIcon} size={16} stroke={SET.ink} />
          ) : glyph ? (
            <LocalIcon name={glyph} size={16} stroke={SET.ink} />
          ) : null}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 700, color: SET.ink, letterSpacing: -0.2 }}>
            {title}
          </h3>
        </div>
      </div>
      {children}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  OBJECTIFS COMMERCIAUX — saisie annuelle unique, dérivés /12 /4 affichés
// ═══════════════════════════════════════════════════════════════════════════
// Source de vérité : agencies.{monthly,quarterly,yearly}_target. L'écriture passe
// par le RPC analytics_set_target (UPDATE + audit activity_events atomiques), qui
// dérive le trimestriel /4 et le mensuel /12. On ne saisit QUE l'annuel : 3 champs
// libres se désynchronisent (chiffre muet contradictoire, banni).
function CommercialTargetsGroup() {
  const { targets, isLoading, saveYearly, isSaving } = useAgencyTargets()
  const toast = useToast()
  const [yearly, setYearly] = useState<string>('')

  // Re-sync depuis le serveur quand la donnée arrive / change.
  useEffect(() => {
    setYearly(targets.yearly > 0 ? String(Math.round(targets.yearly)) : '')
  }, [targets.yearly])

  const parsed = Math.max(0, Math.round(Number(yearly) || 0))
  const dirty = parsed !== Math.round(targets.yearly)

  const handleSave = async () => {
    try {
      await saveYearly(parsed)
      toast.success('Objectif commercial enregistré', { duration: 2400 })
    } catch (err) {
      console.error('[CommercialTargetsGroup] save failed', err)
      toast.error('Erreur lors de l’enregistrement de l’objectif')
    }
  }

  return (
    <AgGroup glyph="target" title="Objectifs commerciaux">
      <div style={{ display: 'grid', gap: 14 }}>
        <SetInput
          label="Objectif annuel (commissions, CHF)"
          type="number"
          value={yearly}
          onChange={setYearly}
          placeholder="1200000"
          prefix="CHF"
          disabled={isLoading}
        />
        <div style={{ fontSize: 12, fontWeight: 500, color: SET.muted, lineHeight: 1.5 }}>
          {parsed > 0
            ? `Réparti automatiquement : ${formatCHF(Math.round(parsed / 12))}/mois · ${formatCHF(Math.round(parsed / 4))}/trimestre`
            : 'Aucun objectif défini — le Dashboard masque le rythme et la projection tant qu’aucune cible n’est saisie.'}
        </div>
        <div>
          <SetBlackBtn onClick={handleSave} disabled={!dirty || isLoading} loading={isSaving} size="sm">
            Enregistrer l’objectif
          </SetBlackBtn>
        </div>
      </div>
    </AgGroup>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  AUTOCOMPLETE ADRESSE — API fédérale geo.admin.ch (swisstopo SearchServer)
//  Publique, sans clé, CORS. Remplace l'ancienne liste suisse mockée.
// ═══════════════════════════════════════════════════════════════════════════
interface AddrSuggestion {
  address: string
  postal: string
  city: string
  canton: string
}

interface GeoAttrs {
  label?: string
  detail?: string
}

const CH_CANTONS = new Set([
  'GE', 'VD', 'VS', 'NE', 'FR', 'BE', 'JU', 'BS', 'BL', 'AG', 'SO', 'ZH', 'LU', 'ZG',
  'SZ', 'NW', 'OW', 'UR', 'GL', 'SH', 'TG', 'AR', 'AI', 'SG', 'GR', 'TI',
])

// geo.admin renvoie un `label` HTML (« Rue X 14 <b>1204 Genève</b> ») + un
// `detail` minuscule qui se termine souvent par le code canton. On en extrait
// adresse / NPA / localité (+ canton en best-effort, sinon laissé au champ).
function parseGeoResult(attrs: GeoAttrs): AddrSuggestion | null {
  const label = (attrs.label ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  // Le NPA (4 chiffres) précède la localité ; les numéros de rue sont en tête.
  // On prend le DERNIER groupe de 4 chiffres pour ne pas confondre un numéro de
  // rue à 4 chiffres avec le code postal.
  const plzAll = label.match(/\b\d{4}\b/g)
  if (!plzAll || plzAll.length === 0) return null
  const plz = plzAll[plzAll.length - 1]
  const idx = label.lastIndexOf(plz)
  const address = label.slice(0, idx).trim()
  const city = label.slice(idx + plz.length).trim()
  if (!address || !city) return null
  let canton = ''
  const tokens = (attrs.detail ?? '').split(/\s+/)
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (CH_CANTONS.has(tokens[i].toUpperCase())) { canton = tokens[i].toUpperCase(); break }
  }
  return { address, postal: plz, city, canton }
}

function AddressAutocomplete({ form, set }: { form: AgencyForm; set: (patch: Partial<AgencyForm>) => void }) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [focus, setFocus] = useState(false)
  const [manual, setManual] = useState(false)
  const [matches, setMatches] = useState<AddrSuggestion[]>([])
  const abortRef = useRef<AbortController | null>(null)

  // Recherche d'adresses suisses via geo.admin.ch, débouncée (250ms).
  useEffect(() => {
    const q = query.trim()
    if (q.length < 3) { setMatches([]); return }
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const url =
          'https://api3.geo.admin.ch/rest/services/api/SearchServer' +
          `?type=locations&origins=address&limit=6&searchText=${encodeURIComponent(q)}`
        const res = await fetch(url, { signal: ctrl.signal })
        if (!res.ok) { setMatches([]); return }
        const json = (await res.json()) as { results?: { attrs?: GeoAttrs }[] }
        const out: AddrSuggestion[] = []
        for (const r of json.results ?? []) {
          const parsed = r.attrs ? parseGeoResult(r.attrs) : null
          if (parsed) out.push(parsed)
        }
        setMatches(out)
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          console.error('[AgencySection] swisstopo search failed:', (err as Error).message)
          setMatches([])
        }
      }
    }, 250)
    return () => clearTimeout(t)
  }, [query])

  const choose = (s: AddrSuggestion) => {
    set({ address: s.address, postal: s.postal, city: s.city, country: 'Suisse', ...(s.canton ? { canton: s.canton } : {}) })
    setQuery('')
    setOpen(false)
    setMatches([])
  }
  const hasAddress = !!(form.address && form.city)

  return (
    <div>
      {/* Champ de recherche */}
      <div style={{ position: 'relative' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            height: 48,
            padding: '0 16px',
            borderRadius: 14,
            background: focus ? SET.inputFocusBg : SET.cardSubtle,
            boxShadow: focus
              ? `0 0 0 2px ${SET.black}, 0 4px 12px rgba(15,23,42,0.05)`
              : 'inset 0 0 0 1px rgba(15,23,42,0.04)',
            transition: 'all .18s ease',
          }}
        >
          <LocalIcon name="search" size={17} stroke={SET.muted} />
          <input
            value={query}
            onChange={e => {
              setQuery(e.target.value)
              setOpen(true)
            }}
            onFocus={() => {
              setFocus(true)
              setOpen(true)
            }}
            onBlur={() => {
              setFocus(false)
              setTimeout(() => setOpen(false), 150)
            }}
            placeholder="Rechercher une adresse en Suisse…"
            style={{
              flex: 1,
              border: 0,
              outline: 'none',
              background: 'transparent',
              fontFamily: 'inherit',
              fontSize: 15,
              fontWeight: 500,
              color: SET.ink,
            }}
          />
        </div>
        {open && matches.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 'calc(100% + 6px)',
              left: 0,
              right: 0,
              zIndex: 40,
              background: SET.card,
              borderRadius: 16,
              padding: 6,
              boxShadow: SET.shadowLg,
              animation: 'setFadeUp .16s cubic-bezier(.2,.8,.2,1) both',
            }}
          >
            {matches.map((s) => (
              <button
                key={`${s.address}-${s.postal}-${s.city}`}
                onMouseDown={() => choose(s)}
                onMouseEnter={e => {
                  e.currentTarget.style.background = SET.cardSubtle
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'transparent'
                }}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 11,
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'inherit',
                  transition: 'background .12s',
                }}
              >
                <LocalIcon name="mapPin" size={16} stroke={SET.muted} />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: SET.ink, letterSpacing: -0.1 }}>
                    {s.address}
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: SET.muted, marginTop: 1 }}>
                    {s.postal} {s.city}{s.canton ? `, ${s.canton}` : ''}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Adresse résolue */}
      {hasAddress && (
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '14px 16px',
            borderRadius: 14,
            background: SET.cardSubtle,
          }}
        >
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 11,
              background: SET.card,
              display: 'grid',
              placeItems: 'center',
              flexShrink: 0,
              boxShadow: SET.shadowSm,
            }}
          >
            <LocalIcon name="mapPin" size={17} stroke={SET.ink} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: SET.ink, letterSpacing: -0.2 }}>
              {form.address}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: SET.muted, marginTop: 2 }}>
              {form.postal} {form.city}, {form.canton}, {form.country}
            </div>
          </div>
          <button
            onClick={() => setManual(m => !m)}
            style={{
              height: 32,
              padding: '0 14px',
              borderRadius: 999,
              border: 0,
              background: manual ? SET.black : SET.card,
              color: manual ? SET.blackInk : SET.inkSoft,
              fontFamily: 'inherit',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: manual ? 'none' : SET.shadowSm,
              whiteSpace: 'nowrap',
            }}
          >
            {manual ? 'Terminé' : 'Ajuster manuellement'}
          </button>
        </div>
      )}

      {/* Champs manuels */}
      {manual && (
        <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1 / -1' }}>
            <SetInput label="Rue et numéro" value={form.address} onChange={v => set({ address: v })} />
          </div>
          <SetInput label="NPA" value={form.postal} onChange={v => set({ postal: v })} />
          <SetInput label="Ville" value={form.city} onChange={v => set({ city: v })} />
          <SetInput
            label="Canton"
            value={form.canton}
            onChange={v => set({ canton: v.slice(0, 2).toUpperCase() })}
          />
          <SetInput label="Pays" value={form.country} onChange={v => set({ country: v })} />
        </div>
      )}
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  MODALE LOGO — dropzone → crop (zoom 1→3, grille tiers, cadrage auto) →
//  canvas 512×512 PNG → animation succès. La modale produit un dataURL et le
//  remonte via onApply ; l'upload Storage + la persistance se font côté parent.
// ═══════════════════════════════════════════════════════════════════════════
const LOGO_VIEW = 296 // côté de la fenêtre de recadrage

interface LoadedImg {
  el: HTMLImageElement
  w: number
  h: number
  name: string
}

function LogoUploadModal({
  open,
  currentUrl,
  initialBg,
  onClose,
  onApply,
}: {
  open: boolean
  currentUrl: string | null
  initialBg: string
  onClose: () => void
  onApply: (url: string | null) => void
}) {
  const [img, setImg] = useState<LoadedImg | null>(null)
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [bg, setBg] = useState(initialBg || LOGO_BG_DEFAULT)
  const [over, setOver] = useState(false)
  const [phase, setPhase] = useState<'edit' | 'success'>('edit')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement | null>(null)
  const dragRef = useRef<{ sx: number; sy: number; ox: number; oy: number } | null>(null)
  const reducedMotion = useReducedMotion()

  useEffect(() => {
    if (open) {
      setImg(null)
      setScale(1)
      setOffset({ x: 0, y: 0 })
      setBg(initialBg || LOGO_BG_DEFAULT)
      setOver(false)
      setPhase('edit')
      setResultUrl(null)
    }
  }, [open, initialBg])

  if (!open) return null

  const baseScale = img ? Math.max(LOGO_VIEW / img.w, LOGO_VIEW / img.h) : 1
  const dispW = img ? img.w * baseScale * scale : LOGO_VIEW
  const dispH = img ? img.h * baseScale * scale : LOGO_VIEW
  const clamp = (o: { x: number; y: number }) => {
    const mx = Math.max(0, (dispW - LOGO_VIEW) / 2)
    const my = Math.max(0, (dispH - LOGO_VIEW) / 2)
    return { x: Math.max(-mx, Math.min(mx, o.x)), y: Math.max(-my, Math.min(my, o.y)) }
  }

  const loadFile = (file: File | null | undefined) => {
    if (!file || !file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = e => {
      const el = new Image()
      el.onload = () => {
        setImg({ el, w: el.naturalWidth, h: el.naturalHeight, name: file.name })
        setScale(1)
        setOffset({ x: 0, y: 0 })
      }
      el.src = String(e.target?.result || '')
    }
    reader.readAsDataURL(file)
  }

  const autoFrame = () => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!img) return
    e.currentTarget.setPointerCapture(e.pointerId)
    dragRef.current = { sx: e.clientX, sy: e.clientY, ox: offset.x, oy: offset.y }
  }
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return
    setOffset(
      clamp({
        x: dragRef.current.ox + (e.clientX - dragRef.current.sx),
        y: dragRef.current.oy + (e.clientY - dragRef.current.sy),
      }),
    )
  }
  const onPointerUp = () => {
    dragRef.current = null
  }

  const apply = () => {
    if (!img) return
    const OUT = 512
    const f = OUT / LOGO_VIEW
    const c = document.createElement('canvas')
    c.width = OUT
    c.height = OUT
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, OUT, OUT)
    const left = ((LOGO_VIEW - dispW) / 2 + offset.x) * f
    const top = ((LOGO_VIEW - dispH) / 2 + offset.y) * f
    ctx.drawImage(img.el, left, top, dispW * f, dispH * f)
    const url = c.toDataURL('image/png')
    setResultUrl(url)
    setPhase('success')
    // On remonte le dataURL au parent (qui l'uploade vers Storage puis persiste).
    setTimeout(() => onApply(url), reducedMotion ? 0 : 1900)
  }

  const imgLeft = (LOGO_VIEW - dispW) / 2 + offset.x
  const imgTop = (LOGO_VIEW - dispH) / 2 + offset.y

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(11,12,14,0.40)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'grid',
        placeItems: 'center',
        animation: 'setFadeIn .2s ease both',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: SET.card,
          borderRadius: 24,
          padding: 30,
          width: '92%',
          maxWidth: 440,
          boxShadow: '0 40px 80px rgba(11,12,14,0.30)',
          animation: 'setScaleIn .25s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {phase === 'success' ? (
          <div
            style={{
              padding: '26px 8px 14px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
            }}
          >
            <div style={{ position: 'relative', width: 132, height: 132, marginBottom: 22 }}>
              {/* contour carré arrondi qui se trace (setRingSweep), épouse la tuile */}
              <svg width="132" height="132" viewBox="0 0 132 132" style={{ position: 'absolute', inset: 0 }}>
                <rect x="3" y="3" width="126" height="126" rx="30" fill="none" stroke={SET.line} strokeWidth="2" />
                <rect
                  x="3"
                  y="3"
                  width="126"
                  height="126"
                  rx="30"
                  fill="none"
                  stroke={SET.black}
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray="470"
                  style={{ ['--sweep-c' as string]: '470', animation: 'setRingSweep .65s cubic-bezier(.4,0,.2,1) both' }}
                />
              </svg>
              {/* logo recadré qui pop (setLogoPop) */}
              <div
                style={{
                  position: 'absolute',
                  inset: 12,
                  borderRadius: 26,
                  overflow: 'hidden',
                  background: bg,
                  boxShadow: SET.shadow,
                  animation: 'setLogoPop .5s cubic-bezier(.2,.8,.2,1) both',
                }}
              >
                {resultUrl && (
                  <img
                    src={resultUrl}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                )}
              </div>
            </div>
            <div style={{ fontSize: 18, fontWeight: 700, color: SET.ink, letterSpacing: -0.3 }}>Logo mis à jour</div>
            <div style={{ fontSize: 13, color: SET.muted, marginTop: 5 }}>
              Le nouveau logo a été enregistré pour votre agence.
            </div>
          </div>
        ) : (
          <>
            {/* En-tête */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 22 }}>
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: 14,
                  background: SET.cardSubtle,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                }}
              >
                <SetIcon name="camera" size={21} stroke={SET.ink} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: '2px 0 4px', fontSize: 19, fontWeight: 700, color: SET.ink, letterSpacing: -0.4 }}>
                  Logo de l'agence
                </h3>
                <p style={{ margin: 0, fontSize: 13, color: SET.inkSoft, lineHeight: 1.5 }}>
                  Importez une image, puis ajustez le cadrage.
                </p>
              </div>
              <button
                onClick={onClose}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 999,
                  border: 0,
                  background: SET.cardSubtle,
                  color: SET.muted,
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                <SetIcon name="x" size={16} stroke={SET.muted} />
              </button>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={e => loadFile(e.target.files && e.target.files[0])}
            />

            {!img ? (
              /* ─── Zone de dépôt ─── */
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => {
                  e.preventDefault()
                  setOver(true)
                }}
                onDragLeave={() => setOver(false)}
                onDrop={e => {
                  e.preventDefault()
                  setOver(false)
                  loadFile(e.dataTransfer.files && e.dataTransfer.files[0])
                }}
                style={{
                  height: 240,
                  borderRadius: 18,
                  cursor: 'pointer',
                  background: over ? SET.inputFocusBg : SET.cardSubtle,
                  boxShadow: over ? `0 0 0 2px ${SET.black}` : `inset 0 0 0 1.5px ${SET.line}`,
                  border: `1.5px dashed ${over ? SET.black : SET.ghost}`,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  transition: 'all .16s ease',
                  textAlign: 'center',
                  padding: 24,
                }}
              >
                <div
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 16,
                    background: SET.card,
                    display: 'grid',
                    placeItems: 'center',
                    boxShadow: SET.shadowSm,
                  }}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={SET.ink}
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 16V4M12 4 7 9M12 4l5 5" />
                    <path d="M4 16v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
                  </svg>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: SET.ink, letterSpacing: -0.2, lineHeight: 1.3 }}>
                    Glissez une image ici
                  </div>
                  <div style={{ fontSize: 12.5, color: SET.muted, lineHeight: 1.3, whiteSpace: 'nowrap' }}>
                    ou <span style={{ color: SET.ink, fontWeight: 600 }}>parcourez vos fichiers</span>
                  </div>
                </div>
              </div>
            ) : (
              /* ─── Recadrage ─── */
              <div>
                <div
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onPointerCancel={onPointerUp}
                  style={{
                    position: 'relative',
                    width: LOGO_VIEW,
                    height: LOGO_VIEW,
                    margin: '0 auto',
                    borderRadius: 28,
                    overflow: 'hidden',
                    background: bg,
                    cursor: dragRef.current ? 'grabbing' : 'grab',
                    touchAction: 'none',
                    userSelect: 'none',
                    boxShadow: `inset 0 0 0 1px ${SET.line}`,
                  }}
                >
                  <img
                    src={img.el.src}
                    alt=""
                    draggable={false}
                    style={{
                      position: 'absolute',
                      left: imgLeft,
                      top: imgTop,
                      width: dispW,
                      height: dispH,
                      maxWidth: 'none',
                      pointerEvents: 'none',
                      display: 'block',
                    }}
                  />
                  {/* Grille des tiers */}
                  <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', opacity: 0.5 }}>
                    <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.35)' }} />
                    <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,.35)' }} />
                    <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.35)' }} />
                    <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,.35)' }} />
                  </div>
                </div>

                {/* Zoom + cadrage auto */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 18 }}>
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={SET.muted}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5M8 11h6" />
                  </svg>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={scale}
                    onChange={e => {
                      const s = parseFloat(e.target.value)
                      setScale(s)
                      setOffset(o => clamp(o))
                    }}
                    style={{ flex: 1, accentColor: SET.black, height: 4 }}
                  />
                  <svg
                    width="17"
                    height="17"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={SET.muted}
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    style={{ flexShrink: 0 }}
                  >
                    <circle cx="11" cy="11" r="7" />
                    <path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
                  </svg>
                  <button
                    onClick={autoFrame}
                    title="Recentrer automatiquement"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      height: 34,
                      padding: '0 14px',
                      borderRadius: 999,
                      border: 0,
                      background: SET.cardSubtle,
                      color: SET.ink,
                      fontFamily: 'inherit',
                      fontSize: 12.5,
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke={SET.ink}
                      strokeWidth="1.7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 3v4h4M19 21v-4h-4" />
                      <path d="M3 13a9 9 0 0 0 15 6.7M21 11A9 9 0 0 0 6 4.3" />
                    </svg>
                    Cadrage auto
                  </button>
                </div>
              </div>
            )}

            {/* Pied */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 26 }}>
              <div>
                {currentUrl && (
                  <button
                    onClick={() => onApply(null)}
                    style={{
                      background: 'none',
                      border: 0,
                      color: SET.muted,
                      fontFamily: 'inherit',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '8px 4px',
                    }}
                  >
                    Retirer le logo
                  </button>
                )}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <SetGhostBtn onClick={onClose}>Annuler</SetGhostBtn>
                <SetBlackBtn
                  disabled={!img}
                  onClick={apply}
                  icon={<SetIcon name="check" size={14} stroke={SET.blackInk} sw={2.4} />}
                >
                  Appliquer
                </SetBlackBtn>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ═══════════════════════════════════════════════════════════════════════════
//  SECTION
// ═══════════════════════════════════════════════════════════════════════════
export function AgencySection() {
  const { agency: serverAgency, isLoading, isSaving, hasBackend, agencyId, save } = useAgencySettings()
  const [form, setForm] = useState<AgencyForm>(() => toForm(serverAgency))
  const [saved, setSaved] = useState<AgencyForm>(() => toForm(serverAgency))
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [logoModal, setLogoModal] = useState(false)
  const toast = useToast()

  // Re-sync depuis le serveur. Tous les champs sont persistés : on réinjecte
  // la donnée serveur telle quelle (la baseline `saved` repart du serveur).
  useEffect(() => {
    const next = toForm(serverAgency)
    setForm(next)
    setSaved(next)
  }, [serverAgency])

  const dirty = JSON.stringify(form) !== JSON.stringify(saved)
  const set = (patch: Partial<AgencyForm>) => setForm(d => ({ ...d, ...patch }))
  const setBranding = (patch: Partial<AgencyForm['branding']>) =>
    setForm(d => ({ ...d, branding: { ...d.branding, ...patch } }))

  const handleSave = async () => {
    if (!hasBackend) {
      toast.error('Aucune agence associée à votre profil')
      return
    }
    try {
      await save(toServer(form))
      setSaved(form)
      toast.success('Agence enregistrée', { duration: 2400 })
    } catch (err) {
      console.error('[AgencySection] save failed', err)
      toast.error('Erreur lors de l’enregistrement')
    }
  }

  const handleCancel = () => {
    if (!dirty) return
    setConfirmOpen(true)
  }

  // Logo : applique (dataURL ou null) → upload/suppression Storage → persiste.
  // - `url` non null = nouveau logo (dataURL PNG sorti de la modale).
  // - `url` null = « Retirer le logo ».
  // Sans agencyId chargé : preview locale seulement (pas de Storage/persistance).
  const handleLogoApply = async (url: string | null) => {
    setLogoModal(false)

    if (!agencyId) {
      // Pas d'agence rattachée : on garde l'aperçu en local sans persister.
      setBranding({ logoUrl: url })
      return
    }

    if (url === null) {
      // Suppression : on retire l'objet Storage puis on persiste logo_url = null.
      await removeAgencyLogo(agencyId)
      setBranding({ logoUrl: null })
      try {
        await save(toServer({ ...form, branding: { ...form.branding, logoUrl: null } }))
        setSaved(s => ({ ...s, branding: { ...s.branding, logoUrl: null } }))
        toast.success('Logo retiré', { duration: 2400 })
      } catch (err) {
        console.error('[AgencySection] logo remove persist failed', err)
        toast.error('Erreur lors de la suppression du logo')
      }
      return
    }

    // Nouveau logo : upload Storage → URL publique. Si l'upload échoue, on garde
    // le dataURL en aperçu local (fallback) sans persister une URL invalide.
    const publicUrl = await uploadAgencyLogo(url, agencyId)
    if (!publicUrl) {
      setBranding({ logoUrl: url })
      toast.error('Le logo n’a pas pu être téléversé, aperçu local seulement')
      return
    }

    setBranding({ logoUrl: publicUrl })
    try {
      await save(toServer({ ...form, branding: { ...form.branding, logoUrl: publicUrl } }))
      setSaved(s => ({ ...s, branding: { ...s.branding, logoUrl: publicUrl } }))
      toast.success('Logo mis à jour', { duration: 2400 })
    } catch (err) {
      console.error('[AgencySection] logo persist failed', err)
      toast.error('Erreur lors de l’enregistrement du logo')
    }
  }

  // Loading
  if (isLoading && !serverAgency.name) {
    return (
      <div style={{ padding: 40, color: SET.muted, fontSize: 13 }}>Chargement de l'agence…</div>
    )
  }

  // Empty state (pas d'agence rattachée au profil)
  if (!hasBackend) {
    return (
      <div
        style={{
          padding: 56,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          gap: 14,
        }}
      >
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: SET.cardSubtle,
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <SetIcon name="building" size={28} stroke={SET.muted} />
        </div>
        <div style={{ fontSize: 17, fontWeight: 700, color: SET.ink, letterSpacing: -0.3 }}>
          Aucune agence rattachée
        </div>
        <div style={{ fontSize: 13.5, color: SET.muted, maxWidth: 360, lineHeight: 1.55 }}>
          Votre profil n'est associé à aucune agence. Contactez votre administrateur pour rejoindre
          un cabinet.
        </div>
      </div>
    )
  }

  const score = agScore(form)

  return (
    <>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 20,
          paddingBottom: dirty ? 96 : 24,
          animation: 'setFadeUp .35s cubic-bezier(.2,.8,.2,1) both',
        }}
      >
        {/* HERO SPLIT — logo + read-outs + jauge de complétude */}
        <AgencyHero form={form} score={score} onEditLogo={() => setLogoModal(true)} />

        {/* BENTO 2 colonnes */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))',
            gap: 20,
            alignItems: 'stretch',
          }}
        >
          {/* Colonne gauche : Identité légale + Adresse du siège */}
          <div style={{ background: SET.card, borderRadius: 24, boxShadow: SET.shadow, overflow: 'hidden' }}>
            <AgGroup setIcon="building" title="Identité légale" first>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <SetInput label="Nom commercial" value={form.name} onChange={v => set({ name: v })} />
                <SetInput
                  label="Année de création"
                  value={form.foundedYear}
                  onChange={v => set({ foundedYear: v })}
                  type="number"
                />
                <div style={{ gridColumn: '1 / -1' }}>
                  <SetInput label="Raison sociale" value={form.legal} onChange={v => set({ legal: v })} />
                </div>
                <SetInput label="Numéro IDE" value={form.ide} onChange={v => set({ ide: v })} />
                <SetInput label="N° TVA" value={form.tva} onChange={v => set({ tva: v })} />
              </div>
            </AgGroup>
            <AgGroup glyph="mapPin" title="Adresse du siège">
              <AddressAutocomplete form={form} set={set} />
            </AgGroup>
          </div>

          {/* Colonne droite : Coordonnées publiques + Présentation publique */}
          <div style={{ background: SET.card, borderRadius: 24, boxShadow: SET.shadow, overflow: 'hidden' }}>
            <AgGroup glyph="phone" title="Coordonnées publiques" first>
              <div style={{ display: 'grid', gap: 16 }}>
                <SetInput label="Téléphone" type="tel" value={form.phone} onChange={v => set({ phone: v })} />
                <SetInput label="Email" type="email" value={form.email} onChange={v => set({ email: v })} />
                <SetInput label="Site web" value={form.web} onChange={v => set({ web: v })} prefix="https://" />
              </div>
            </AgGroup>
            <CommercialTargetsGroup />
            <AgGroup setIcon="globe" title="Présentation publique">
              <SetTextarea
                value={form.aboutShort}
                onChange={v => set({ aboutShort: v })}
                rows={3}
                placeholder="Cabinet boutique spécialisé sur…"
              />
            </AgGroup>
          </div>
        </div>
      </div>

      <StickySaveBar dirty={dirty} saving={isSaving} onSave={handleSave} onCancel={handleCancel} />

      {confirmOpen && (
        <ConfirmModal
          title="Annuler les modifications ?"
          desc="Vos changements seront perdus. Cette action est irréversible."
          danger="Annuler les modifs"
          onCancel={() => setConfirmOpen(false)}
          onConfirm={() => {
            setForm(saved)
            setConfirmOpen(false)
          }}
        />
      )}

      <LogoUploadModal
        open={logoModal}
        currentUrl={form.branding.logoUrl}
        initialBg={form.branding.logoBg}
        onClose={() => setLogoModal(false)}
        onApply={url => { void handleLogoApply(url) }}
      />
    </>
  )
}
