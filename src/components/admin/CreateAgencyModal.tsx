// P8b — Création d'agence (super-admin). Le propriétaire est invité SÉPARÉMENT
// (bouton distinct, non couplé) — la création ne rattache personne.
//
// Rendu en grammaire Sugar : champs sans bordure décorative (surface creuse +
// filet intérieur), plan en segments à fond plein, « solo » en interrupteur
// (l'ancienne case à cocher ne disait pas son état au lecteur d'écran), et un
// seul accent d'action — le noir de `AdminSolidBtn`, pas le violet plateforme.

import { useId, useState, type CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import Modal from '@/components/ui/modal'
import { useToast } from '@/components/ui/Toast'
import { CANTONS } from '@/lib/constants'
import { useAdminCreateAgency } from '@/hooks/useAdminCreateAgency'
import { AdminGhostBtn, AdminSegmentBtn, AdminSolidBtn, AdminSwitch } from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'
import { useAdminSurfaces } from '@/hooks/useAdminSurfaces'
import { ADMIN_CONSOLE_PATH } from '@/lib/adminEntry'
import { crmVoileEncre } from '@/components/crm/tokens'

const PLAN_IDS = ['starter', 'pro', 'entreprise'] as const

export default function CreateAgencyModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation('admin')
  const toast = useToast()
  const navigate = useNavigate()
  const createAgency = useAdminCreateAgency()
  const { sp, surf, dark } = useAdminSurfaces()

  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [canton, setCanton] = useState('')
  const [plan, setPlan] = useState<typeof PLAN_IDS[number]>('starter')
  const [solo, setSolo] = useState(false)
  const [note, setNote] = useState('')

  const handleCreate = () => {
    if (name.trim().length < 2) { toast.error(t('createAgency.nameRequired')); return }
    createAgency.mutate(
      { name: name.trim(), city, canton, plan, solo, note },
      {
        onSuccess: (id) => {
          toast.success(t('createAgency.created'))
          onClose()
          navigate(`${ADMIN_CONSOLE_PATH}/agencies/${id}`)
        },
        onError: (e) => toast.error((e as Error).message.includes('already exists')
          ? t('createAgency.duplicate')
          : t('createAgency.error')),
      },
    )
  }

  // Identifiants des champs : `useId()` plutôt que des chaînes fixes, pour rester
  // corrects si deux instances de la modale coexistaient un jour.
  const uid = useId()
  const nameId = `${uid}-name`
  const cityId = `${uid}-city`
  const cantonId = `${uid}-canton`
  const noteId = `${uid}-note`
  const planLabelId = `${uid}-plan-label`

  const labelStyle: CSSProperties = {
    display: 'block', marginBottom: 6,
    fontSize: 'var(--crm-text-sm)', fontWeight: 600, letterSpacing: 0.2, color: sp.sub,
  }
  // Champ Sugar : pas de bordure, une surface creuse et un filet INTÉRIEUR — le
  // trait ne participe pas à la séparation, l'ombre du bento s'en charge.
  const fieldStyle: CSSProperties = {
    width: '100%', height: 38, padding: '0 var(--crm-space-xl)', borderRadius: ADMIN_RADII.row, border: 0,
    background: surf.cardSub, color: sp.ink,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600, outline: 'none',
    boxShadow: `0 0 0 1.5px ${crmVoileEncre(dark, 0.07)} inset`,
  }

  return (
    <Modal open onClose={onClose} title={t('createAgency.title')} size="md">
      <div className="p-5 space-y-4">
        <div>
          <label htmlFor={nameId} style={labelStyle}>{t('createAgency.name')}</label>
          <input id={nameId} type="text" value={name} onChange={e => setName(e.target.value)} autoFocus style={fieldStyle} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor={cityId} style={labelStyle}>{t('createAgency.city')}</label>
            <input id={cityId} type="text" value={city} onChange={e => setCity(e.target.value)} style={fieldStyle} />
          </div>
          <div>
            <label htmlFor={cantonId} style={labelStyle}>{t('createAgency.canton')}</label>
            <select id={cantonId} value={canton} onChange={e => setCanton(e.target.value)} style={fieldStyle}>
              <option value="">—</option>
              {CANTONS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div>
          {/* « Plan » étiquette un GROUPE de trois boutons, pas un contrôle unique :
              un `<label htmlFor>` y serait faux (il ne peut viser qu'un élément
              étiquetable). D'où un `<span>` + `role="group"` porté par le conteneur,
              qui référence ce libellé via `aria-labelledby` — le groupe a ainsi un
              nom accessible, et chaque bouton garde son `aria-pressed`. */}
          <span id={planLabelId} style={labelStyle}>{t('createAgency.plan')}</span>
          <div role="group" aria-labelledby={planLabelId} style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)' }}>
            {PLAN_IDS.map(p => (
              <AdminSegmentBtn key={p} on={plan === p} onClick={() => setPlan(p)} variant="hollow">
                {t(`common.plan.${p}`)}
              </AdminSegmentBtn>
            ))}
          </div>
        </div>

        {/* `<label>` ENGLOBANT, comme avant la migration : le texte redevient une
            cible de clic. Un `<button>` est un élément étiquetable, donc il est le
            contrôle implicite du label — le navigateur lui transfère le clic reçu
            sur le texte, et ne rejoue RIEN quand le clic vise déjà l'interrupteur
            (pas de double bascule). L'association nomme aussi le switch : lui
            repasser `label` (= `aria-label`) doublerait l'annonce du même libellé. */}
        <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', cursor: 'pointer' }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: sp.ink }}>
            {t('createAgency.solo')}
          </span>
          <AdminSwitch on={solo} onClick={() => setSolo(!solo)} />
        </label>

        <div>
          <label htmlFor={noteId} style={labelStyle}>{t('createAgency.note')}</label>
          <input id={noteId} type="text" value={note} onChange={e => setNote(e.target.value)}
            placeholder={t('createAgency.notePlaceholder')} style={fieldStyle} />
        </div>

        <p style={{ margin: 0, fontSize: 'var(--crm-text-sm)', color: sp.sub, lineHeight: 1.5 }}>{t('createAgency.inviteHint')}</p>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 'var(--crm-space-md)', paddingTop: 'var(--crm-space-xs)' }}>
          <AdminGhostBtn onClick={onClose}>{t('common.cancel')}</AdminGhostBtn>
          <AdminSolidBtn onClick={handleCreate} disabled={createAgency.isPending}>
            {createAgency.isPending ? t('common.saving') : t('createAgency.submit')}
          </AdminSolidBtn>
        </div>
      </div>
    </Modal>
  )
}
