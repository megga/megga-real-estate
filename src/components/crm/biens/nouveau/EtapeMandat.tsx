/**
 * « Nouveau bien » · étape 4 — Mandat & diffusion : vendeur, mandat, agence partenaire.
 *
 * ⚖ LE VENDEUR EST FACULTATIF, ET EN DERNIER. L'ancien wizard l'exigeait au PREMIER écran :
 * un agent qui prépare l'annonce avant la signature du mandat ne pouvait pas commencer.
 * Choisi ou créé ici, il est rattaché au bien à l'enregistrement (`usePublierWizard`).
 *
 * Un vendeur neuf garde la forme de l'ancien wizard (`_newContact`, id synthétique
 * `c-new-…`) : c'est ce que le hook de publication sait créer, puis relier.
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { CrmPalette } from '@/components/crm/tokens'
import type { WizardData } from '@/components/crm-wizard/tokens'
import { VxAvatar } from '@/components/crm-dossiers/vitrine/vitrineKit'
import { useContacts } from '@/hooks/useContacts'
import { pickAvatarBg } from '@/lib/crmAdapters'
import { AGENCES_PARTENAIRES } from '@/lib/biensFiltres'
import { NbBloc, NbChamp, NbPuce, NbSegment } from './atomes'
import { lireNombre } from './completude'

const DUREES = [3, 6, 12]

function Vendeur({ data, set, dark, sp }: { data: WizardData; set: (p: Partial<WizardData>) => void; dark: boolean; sp: CrmPalette }) {
  const { t } = useTranslation('listings')
  const { contacts } = useContacts()
  const [q, setQ] = useState('')
  const [neuf, setNeuf] = useState<{ prenom: string; nom: string; email: string; phone: string } | null>(null)
  const choisi = data._newContact ?? data._ownerContact

  // Vendeurs et bailleurs d'abord : ce sont eux qu'on cherche ici.
  const resultats = useMemo(() => {
    const s = q.trim().toLowerCase()
    if (!s) return []
    return (contacts ?? [])
      .filter((c) => `${c.first_name ?? ''} ${c.last_name ?? ''} ${c.email ?? ''} ${c.phone ?? ''}`.toLowerCase().includes(s))
      .sort((a, b) => Number(['seller', 'landlord', 'both'].includes(b.type ?? '')) - Number(['seller', 'landlord', 'both'].includes(a.type ?? '')))
      .slice(0, 6)
  }, [contacts, q])

  if (choisi && data.ownerContactId) {
    const nom = `${choisi.firstName} ${choisi.lastName}`.trim()
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', padding: 'var(--crm-space-lg)', borderRadius: 'var(--crm-radius-xl)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg }}>
        <VxAvatar name={nom} bg={data._newContact ? undefined : pickAvatarBg(choisi.id)} size={40} dark={dark} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--crm-text-xl)', fontWeight: 600, color: sp.ink }}>{nom}</div>
          <div style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>
            {data._newContact ? t('nouveauBien.mandat.vendeurNeuf') : [choisi.phone, choisi.email].filter(Boolean).join(' · ')}
          </div>
        </div>
        <NbPuce sp={sp} on={false} onClick={() => set({ ownerContactId: null, _newContact: null, _ownerContact: null })}>{t('nouveauBien.modifier')}</NbPuce>
      </div>
    )
  }

  if (neuf) {
    const valide = neuf.prenom.trim() && neuf.nom.trim()
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
        <div className="nb-grille" style={{ gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
          <NbChamp sp={sp} autoFocus label={t('nouveauBien.mandat.prenom')} value={neuf.prenom} onChange={(v) => setNeuf({ ...neuf, prenom: v })} />
          <NbChamp sp={sp} label={t('nouveauBien.mandat.nom')} value={neuf.nom} onChange={(v) => setNeuf({ ...neuf, nom: v })} />
          <NbChamp sp={sp} type="email" label={t('nouveauBien.mandat.email')} value={neuf.email} onChange={(v) => setNeuf({ ...neuf, email: v })} />
          <NbChamp sp={sp} type="tel" label={t('nouveauBien.mandat.telephone')} value={neuf.phone} onChange={(v) => setNeuf({ ...neuf, phone: v })} />
        </div>
        <div style={{ display: 'flex', gap: 'var(--crm-space-sm)' }}>
          <NbPuce sp={sp} on disabled={!valide} onClick={() => {
            const id = `c-new-${crypto.randomUUID()}`
            const c = { id, firstName: neuf.prenom.trim(), lastName: neuf.nom.trim(), email: neuf.email.trim(), phone: neuf.phone.trim(), type: 'seller', kyc: { status: 'none' }, avatarBg: '' }
            set({ ownerContactId: id, _newContact: c, _ownerContact: null })
            setNeuf(null)
          }}>{t('nouveauBien.mandat.ajouterVendeur')}</NbPuce>
          <NbPuce sp={sp} on={false} onClick={() => setNeuf(null)}>{t('cancel')}</NbPuce>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-sm)' }} data-nb-sans-entree="">
      <label className="nb-champ" style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', height: 44, padding: '0 var(--crm-space-xl)', borderRadius: 'var(--crm-radius-lg)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg, color: sp.sub }}>
        <MEIcon name="search" size={15} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('nouveauBien.mandat.rechercherVendeur')} aria-label={t('nouveauBien.mandat.rechercherVendeur')} autoComplete="off"
          style={{ flex: 1, minWidth: 0, height: '100%', border: 0, outline: 'none', background: 'transparent', color: sp.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 500 }} />
      </label>
      {resultats.map((c) => {
        const nom = `${c.first_name ?? ''} ${c.last_name ?? ''}`.trim()
        return (
          <button key={c.id} type="button" className="nb-option" onClick={() => {
            set({ ownerContactId: c.id, _newContact: null, _ownerContact: { id: c.id, firstName: c.first_name ?? '', lastName: c.last_name ?? '', email: c.email ?? '', phone: c.phone ?? '', type: c.type ?? '', kyc: { status: 'none' }, avatarBg: pickAvatarBg(c.id) } })
            setQ('')
          }} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-md) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit', color: sp.ink }}>
            <VxAvatar name={nom} bg={pickAvatarBg(c.id)} size={32} dark={dark} />
            <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600 }}>{nom}</span>
          </button>
        )
      })}
      <button type="button" onClick={() => {
        const [prenom, ...reste] = q.trim().split(/\s+/)
        setNeuf({ prenom: prenom ?? '', nom: reste.join(' '), email: '', phone: '' })
      }} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-xs)', border: 0, background: 'transparent', padding: 0, color: sp.accent, fontFamily: 'inherit', fontSize: 'var(--crm-text-md)', fontWeight: 600, cursor: 'pointer' }}>
        <MEIcon name="plus" size={13} />{t('nouveauBien.mandat.nouveauVendeur')}
      </button>
    </div>
  )
}

export function EtapeMandat({ data, set, dark, sp }: { data: WizardData; set: (p: Partial<WizardData>) => void; dark: boolean; sp: CrmPalette }) {
  const { t } = useTranslation('listings')
  const m = data.mandate
  const poserMandat = (patch: Partial<WizardData['mandate']>) => set({ mandate: { ...m, ...patch } })

  // Deux colonnes : qui et à quelles conditions à gauche ; avec qui et comment diffuser à droite.
  return (
    <>
      <div className="nb-col">
        <NbBloc sp={sp} titre={t('nouveauBien.mandat.vendeur')}>
          <Vendeur data={data} set={set} dark={dark} sp={sp} />
        </NbBloc>

        <NbBloc sp={sp} titre={t('nouveauBien.mandat.mandat')}>
          <NbSegment sp={sp} value={m.type} onChange={(v) => poserMandat({ type: v })}
            options={[
              { value: 'exclusive', label: t('nouveauBien.mandat.types.exclusive') },
              { value: 'simple', label: t('nouveauBien.mandat.types.simple') },
              { value: 'co', label: t('nouveauBien.mandat.types.co') },
            ]} />
          <div className="nb-grille">
            <NbChamp sp={sp} label={t('detail.mandate.commission')} suffixe="%" inputMode="decimal" value={m.commission ? String(m.commission) : ''} onChange={(v) => poserMandat({ commission: lireNombre(v) ?? 0 })} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-xs)' }}>
              <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: sp.sub }}>{t('nouveauBien.mandat.duree')}</span>
              <div style={{ display: 'flex', gap: 'var(--crm-space-xs)' }}>
                {DUREES.map((d) => <NbPuce key={d} sp={sp} on={m.duration === d} onClick={() => poserMandat({ duration: d })}>{t('nouveauBien.mandat.mois', { count: d })}</NbPuce>)}
              </div>
            </div>
          </div>
          <div>
            <NbPuce sp={sp} icon={m.signed ? 'check' : undefined} on={m.signed} onClick={() => poserMandat({ signed: !m.signed })}>{t('nouveauBien.mandat.signe')}</NbPuce>
          </div>
        </NbBloc>
      </div>

      <div className="nb-col">
        <NbBloc sp={sp} titre={t('nouveauBien.mandat.agence')}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-xs)' }}>
            <NbPuce sp={sp} on={!data.partnerAgency} onClick={() => set({ partnerAgency: null })}>{t('biens.filtres.notreAgence')}</NbPuce>
            {Object.entries(AGENCES_PARTENAIRES).map(([cle, nom]) => (
              <NbPuce key={cle} sp={sp} on={data.partnerAgency === cle} onClick={() => set({ partnerAgency: cle })}>{nom}</NbPuce>
            ))}
          </div>
        </NbBloc>

        <NbBloc sp={sp} titre={t('nouveauBien.mandat.diffusion')}>
          <div className="nb-grille" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {(['publier', 'garder'] as const).map((k) => (
              <div key={k} style={{ display: 'flex', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl)', borderRadius: 'var(--crm-radius-xl)', border: `1px solid ${sp.cardBorder}`, background: sp.cardBg }}>
                <MEIcon name={k === 'publier' ? 'globe' : 'lock'} size={18} color={sp.sub} />
                <div>
                  <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>{t(`nouveauBien.mandat.${k}Titre`)}</div>
                  {/* « Réseau Off-market » se suffit (Julien, 16.09.2026) : seule la publication s'explique. */}
                  {k === 'publier' && <div style={{ marginTop: 'var(--crm-space-2xs)', fontSize: 'var(--crm-text-md)', color: sp.sub, lineHeight: 1.5 }}>{t('nouveauBien.mandat.publierAide')}</div>}
                </div>
              </div>
            ))}
          </div>
        </NbBloc>
      </div>
    </>
  )
}
