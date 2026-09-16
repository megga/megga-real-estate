/**
 * La marque d'une formule : une PASTILLE (nom sur dégradé) et une TUILE (le dégradé seul).
 * Couleurs et correspondance avec la base : `megga-x-crm/plans.ts`.
 *
 * Pas d'icône : l'étoile de l'ancienne pastille « PRO » est retirée (Julien, 16.09.2026) —
 * la couleur suffit à distinguer les trois formules.
 */
import { useTranslation } from 'react-i18next'
import { degradeFormule, type FormuleAffichee } from '@/components/megga-x-crm/plans'

/** Le nom de la formule sur son dégradé — dans le menu du profil. */
export function PlanBadge({ formule }: { formule: FormuleAffichee }) {
  const { t } = useTranslation('settings')
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', padding: 'var(--crm-space-2xs) var(--crm-space-md)',
      borderRadius: 'var(--crm-radius-pill)', background: degradeFormule(formule), color: '#FFFFFF',
      // Un liseré clair à l'intérieur : la pastille garde un bord net sur une surface sombre.
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.18)',
      fontSize: 'var(--crm-text-xs)', fontWeight: 600, letterSpacing: 0.2, flexShrink: 0, whiteSpace: 'nowrap',
    }}>
      {t(`billing.plans.${formule}.name`)}
    </span>
  )
}

/** Le dégradé en tuile, avec un reflet — l'en-tête des cartes de la facturation. */
export function PlanTuile({ formule, taille = 44 }: { formule: FormuleAffichee; taille?: number }) {
  return (
    <span aria-hidden style={{
      width: taille, height: taille, flexShrink: 0, borderRadius: 'var(--crm-radius-xl)',
      background: `radial-gradient(120% 90% at 18% 0%, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0) 55%), ${degradeFormule(formule)}`,
      boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.16)',
    }} />
  )
}
