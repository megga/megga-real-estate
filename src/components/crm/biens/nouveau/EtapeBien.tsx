/**
 * « Nouveau bien » · étape 1 — Le bien : transaction, type, adresse, chiffres, prix.
 *
 * ⚖ TOUT SUR UN ÉCRAN. L'ancien wizard posait une question par écran (sept pour les
 * seules caractéristiques) : confortable pour un particulier, lent pour un agent qui
 * connaît ses chiffres. Ici la grille se remplit d'un trait, Tab après Tab.
 *
 * 📍 ADRESSE : le registre fédéral (geo.admin.ch, `useSwissAddress`), la MÊME source que
 * les contacts et l'onboarding — service public sans clé, qui répond là où Mapbox n'a pas
 * de jeton. Mapbox ne sert plus qu'à la vignette de carte de l'adresse retenue.
 *
 * ⛔ AUCUNE ADRESSE INVENTÉE. L'ancien écran retombait en silence sur des suggestions
 * fabriquées quand le géocodage échouait. Ici une panne le DIT, et la saisie à la main
 * (rue, NPA, localité, canton) reste à un clic — un immeuble neuf peut manquer au registre.
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon, { type MEIconName } from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { WizardData } from '@/components/crm-wizard/tokens'
import { buildStaticMapUrl } from '@/lib/mapbox'
import { useSwissAddress, type SwissAddressSuggestion } from '@/hooks/useSwissAddress'
import { CANTONS } from '@/lib/constants'
import { galFmtCHF } from '@/components/crm/biens/gallery/galHelpers'
import { NbBloc, NbChamp, NbPuce, NbSegment } from './atomes'
import { lireNombre } from './completude'
import { grouperMilliers, lireMontant } from '@/lib/montantSaisi'

const MAPBOX_TOKEN = (import.meta.env.VITE_MAPBOX_TOKEN as string | undefined) || ''

/** Les dix types de l'agence, dans l'ordre de fréquence — avec leur icône. */
const TYPES: { v: WizardData['type']; icon: MEIconName }[] = [
  { v: 'appartement', icon: 'building' }, { v: 'maison', icon: 'home' }, { v: 'villa', icon: 'villa' },
  { v: 'attique', icon: 'penthouse' }, { v: 'duplex', icon: 'duplex' }, { v: 'triplex', icon: 'triplex' },
  { v: 'loft', icon: 'sofa' }, { v: 'chalet', icon: 'chalet' }, { v: 'terrain', icon: 'plot' }, { v: 'commerce', icon: 'shop' },
]
const CLASSES: NonNullable<WizardData['energy']>[] = ['A', 'B', 'C', 'D', 'E', 'F', 'G']

function Adresse({ data, set, sp }: { data: WizardData; set: (p: Partial<WizardData>) => void; sp: CrmPalette }) {
  const { t } = useTranslation('listings')
  const { query, setQuery, suggestions, isLoading, error } = useSwissAddress(data.addr)
  const [ouvert, setOuvert] = useState(false)
  const [hi, setHi] = useState(0)
  const [manuelle, setManuelle] = useState(!data.addrConfirmed && !!data.addr)
  const visible = ouvert && suggestions.length > 0

  const saisir = (v: string) => {
    setQuery(v); setOuvert(true); setHi(0)
    set({ addr: v, addrConfirmed: false })
  }
  const choisir = (s?: SwissAddressSuggestion) => {
    if (!s) return
    const complete = `${s.street}, ${s.postalCode} ${s.city}`
    // La liste reste FERMÉE : sans `ouvert` à faux, l'adresse retenue relancerait sa propre suggestion.
    setQuery(complete); setOuvert(false); setHi(0)
    set({
      addr: complete, addrConfirmed: true, addrStreet: s.streetName, addrHouseNumber: s.streetNumber,
      postCode: s.postalCode, city: s.city, canton: s.canton, cantonShort: s.canton, coords: [s.lng, s.lat],
    })
  }
  const clavier = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!visible) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHi((h) => Math.min(h + 1, suggestions.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); choisir(suggestions[hi]) }
    // Marqué seulement liste ouverte : sinon Échap appartient à l'écran.
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setOuvert(false) }
  }
  const modifier = () => {
    set({ addrConfirmed: false, coords: null })
    setQuery(data.addr); setOuvert(false)
  }
  // Saisie à la main : l'adresse complète se RECOMPOSE des champs, comme la recherche l'aurait rendue.
  const poserManuel = (patch: Partial<WizardData>) => {
    const d = { ...data, ...patch }
    const rue = [d.addrStreet, d.addrHouseNumber].filter(Boolean).join(' ')
    const lieu = [d.postCode, d.city].filter(Boolean).join(' ')
    set({ ...patch, addr: [rue, lieu].filter(Boolean).join(', '), addrConfirmed: false })
  }

  if (data.addrConfirmed) {
    const [lng, lat] = data.coords ?? [0, 0]
    const carte = MAPBOX_TOKEN && data.coords ? buildStaticMapUrl(lng, lat, MAPBOX_TOKEN) : null
    return (
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg)', borderRadius: 'var(--crm-radius-xl)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg }}>
        {carte && <img src={carte} alt="" style={{ width: 132, height: 92, objectFit: 'cover', borderRadius: 'var(--crm-radius-lg)', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 'var(--crm-space-2xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xs)', fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.accent }}>
            <MEIcon name="check-circle" size={13} />{t('nouveauBien.bien.adresseTrouvee')}
          </div>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>{[data.addrStreet, data.addrHouseNumber].filter(Boolean).join(' ') || data.addr}</div>
          <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>{[data.postCode, data.city, data.cantonShort].filter(Boolean).join(' · ')}</div>
        </div>
        <NbPuce sp={sp} on={false} onClick={modifier}>{t('nouveauBien.modifier')}</NbPuce>
      </div>
    )
  }

  if (manuelle) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
        <div className="nb-grille" style={{ gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 1fr)' }}>
          <NbChamp sp={sp} label={t('nouveauBien.bien.rue')} value={data.addrStreet ?? ''} onChange={(v) => poserManuel({ addrStreet: v })} />
          <NbChamp sp={sp} label={t('nouveauBien.bien.numero')} value={data.addrHouseNumber ?? ''} onChange={(v) => poserManuel({ addrHouseNumber: v })} />
        </div>
        <div className="nb-grille" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)' }}>
          <NbChamp sp={sp} label={t('nouveauBien.bien.npa')} inputMode="numeric" value={data.postCode} onChange={(v) => poserManuel({ postCode: v.replace(/\D/g, '').slice(0, 4) })} />
          <NbChamp sp={sp} label={t('nouveauBien.bien.localite')} value={data.city ?? ''} onChange={(v) => poserManuel({ city: v })} />
          <label style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)' }}>
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub }}>{t('nouveauBien.bien.canton')}</span>
            <select value={data.cantonShort ?? ''} onChange={(e) => poserManuel({ cantonShort: e.target.value, canton: e.target.value })} aria-label={t('nouveauBien.bien.canton')}
              style={{ height: 44, borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg, color: sp.ink, padding: '0 var(--crm-space-lg)', fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 600 }}>
              <option value="">—</option>
              {CANTONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        </div>
        <button type="button" onClick={() => { setManuelle(false); setQuery(data.addr) }} className="nb-lien" style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, color: sp.accent, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer' }}>
          {t('nouveauBien.bien.rechercherAdresse')}
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }} data-nb-sans-entree="">
      <div style={{ position: 'relative' }}>
      <label className="nb-champ" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 48, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg, color: sp.sub }}>
        <MEIcon name="location" size={16} />
        <input value={query} onChange={(e) => saisir(e.target.value)} onKeyDown={clavier} onBlur={() => setOuvert(false)}
          placeholder={t('nouveauBien.bien.adressePlaceholder')} aria-label={t('nouveauBien.bien.adresse')} autoComplete="off"
          role="combobox" aria-expanded={visible} aria-autocomplete="list"
          style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-xl)', fontWeight: 500 }} />
        {ouvert && isLoading && query.trim().length >= 3 && <span style={{ fontSize: 'var(--crm-text-sm)', color: sp.sub }}>{t('nouveauBien.bien.recherche')}</span>}
      </label>
      {visible && (
        // Flottante sous la case, pas dans le flux : la colonne ne saute pas à chaque frappe.
        <div role="listbox" aria-label={t('nouveauBien.bien.adresse')} style={{ position: 'absolute', top: 'calc(100% + var(--crm-space-xs))', left: 0, right: 0, zIndex: 50, maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', padding: 'var(--crm-space-xs)', borderRadius: 'var(--crm-radius-xl)', border: `1px solid ${sp.solidBorder}`, background: sp.solidBg, boxShadow: sp.solidShadow }}>
          {suggestions.map((s, i) => (
            <button key={s.id} type="button" role="option" aria-selected={i === hi} tabIndex={-1}
              onMouseEnter={() => setHi(i)}
              // `mousedown` + preventDefault : le champ garde le focus, son `onBlur` ne ferme pas la liste avant le choix.
              onMouseDown={(e) => { e.preventDefault(); choisir(s) }}
              style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-md)', border: 0, background: i === hi ? sp.focusSurface : 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
              <MEIcon name="location" size={14} color={sp.sub} />
              <span style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-2xs)', minWidth: 0 }}>
                <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{s.street}</span>
                <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>{`${s.postalCode} ${s.city}${s.canton ? ` · ${s.canton}` : ''}`}</span>
              </span>
            </button>
          ))}
        </div>
      )}
      </div>
      {error && <div role="alert" style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('nouveauBien.bien.recherchePanne')}</div>}
      <button type="button" onClick={() => setManuelle(true)} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', padding: 0, color: sp.accent, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer' }}>
        {t('nouveauBien.bien.saisieManuelle')}
      </button>
    </div>
  )
}

export function EtapeBien({ data, set, sp }: { data: WizardData; set: (p: Partial<WizardData>) => void; sp: CrmPalette }) {
  const { t } = useTranslation('listings')
  const terrain = data.type === 'terrain'
  const commerce = data.type === 'commerce'
  const location = data.transaction === 'location'
  const nombre = (cle: keyof WizardData) => (v: string) => set({ [cle]: lireNombre(v) } as Partial<WizardData>)
  const texte = (n: number | null | undefined) => (n == null ? '' : String(n))
  const prix = location ? data.rent : data.price
  const prixM2 = prix && data.area ? Math.round(prix / data.area) : null

  // Deux colonnes : ce qu'EST le bien (quoi, où) à gauche ; ce qu'il VAUT et MESURE à droite —
  // le prix d'abord, c'est le chiffre que l'agent connaît le premier.
  return (
    <>
      <div className="nb-col">
        <NbBloc sp={sp} titre={t('nouveauBien.bien.transaction')}>
          <NbSegment sp={sp} value={data.transaction} onChange={(v) => set({ transaction: v })}
            options={[{ value: 'vente', label: t('detail.transactionSale') }, { value: 'location', label: t('detail.transactionRent') }]} />
        </NbBloc>

        <NbBloc sp={sp} titre={t('nouveauBien.bien.type')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-sm)' }}>
            {TYPES.map(({ v, icon }) => (
              <NbPuce key={v} sp={sp} icon={icon} on={data.type === v} onClick={() => set({ type: v })}>{t(`nouveauBien.types.${v}`)}</NbPuce>
            ))}
          </div>
        </NbBloc>

        <NbBloc sp={sp} titre={t('nouveauBien.bien.adresse')}>
          <Adresse data={data} set={set} sp={sp} />
        </NbBloc>
      </div>

      <div className="nb-col">
        <NbBloc sp={sp} titre={location ? t('nouveauBien.bien.loyer') : t('nouveauBien.bien.prix')}>
          <div className="nb-grille">
            {/* Montants lus comme l'agent les écrit (« 1'450'000 », « 1.45m ») et réaffichés en apostrophes suisses. */}
            <NbChamp sp={sp} label={location ? t('nouveauBien.bien.loyerMensuel') : t('detail.salePriceLabel')} prefixe="CHF" inputMode="numeric"
              value={prix == null ? '' : grouperMilliers(prix)} onChange={(v) => set(location ? { rent: lireMontant(v) } : { price: lireMontant(v) })} />
            <NbChamp sp={sp} label={location ? t('nouveauBien.bien.chargesMensuelles') : t('detail.specs.charges')} prefixe="CHF" inputMode="numeric"
              value={data.charges == null ? '' : grouperMilliers(data.charges)} onChange={(v) => set({ charges: lireMontant(v) })} />
          </div>
          {prixM2 && (
            <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, fontVariantNumeric: 'tabular-nums' }}>
              {t('nouveauBien.bien.prixM2', { prix: galFmtCHF(prixM2) })}
            </div>
          )}
        </NbBloc>

        <NbBloc sp={sp} titre={t('nouveauBien.bien.chiffres')}>
          <div className="nb-grille">
            <NbChamp sp={sp} label={terrain ? t('nouveauBien.bien.surfaceTerrain') : t('nouveauBien.bien.surface')} suffixe="m²" inputMode="decimal" value={texte(data.area)} onChange={nombre('area')} />
            {!terrain && !commerce && <NbChamp sp={sp} label={t('detail.spec.rooms')} inputMode="decimal" value={texte(data.rooms)} onChange={nombre('rooms')} />}
            {!terrain && !commerce && <NbChamp sp={sp} label={t('detail.spec.bedrooms')} inputMode="numeric" value={texte(data.bedrooms)} onChange={nombre('bedrooms')} />}
            {!terrain && !commerce && <NbChamp sp={sp} label={t('detail.specs.bathrooms')} inputMode="numeric" value={texte(data.bathrooms)} onChange={nombre('bathrooms')} />}
            {!terrain && <NbChamp sp={sp} label={t('nouveauBien.bien.etage')} inputMode="numeric" value={texte(data.floor)} onChange={nombre('floor')} />}
            {!terrain && <NbChamp sp={sp} label={t('fiche.specs.yearBuilt')} inputMode="numeric" value={texte(data.year)} onChange={nombre('year')} />}
          </div>
          {!terrain && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }}>
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub }}>{t('detail.specs.energyClass')}</span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-xs)' }}>
                {CLASSES.map((c) => (
                  <NbPuce key={c} sp={sp} on={data.energy === c} onClick={() => set({ energy: data.energy === c ? null : c })}>{c}</NbPuce>
                ))}
              </div>
            </div>
          )}
        </NbBloc>
      </div>
    </>
  )
}
