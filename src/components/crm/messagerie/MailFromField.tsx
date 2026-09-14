/**
 * « De » : la boîte d'envoi du composeur (Julien, 14.09.2026 : « si un utilisateur a trois
 * comptes mail, il sélectionne sa boîte — un déroulé »).
 *
 * Toutes les boîtes visibles y sont listées. Celles qui ne peuvent pas envoyer restent,
 * éteintes, avec leur MOTIF (« Autorisation à renouveler ») : les retirer laisserait
 * l'agent chercher une boîte qu'il sait avoir connectée, sans lui dire quoi faire.
 *
 * ⚠ Échap ferme la liste et s'arrête là (`preventDefault`) : le piège de focus de la
 * modale ignore un Échap déjà consommé, sans quoi il fermerait aussi le composeur.
 */
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import type { MailAccount } from '@/hooks/useMailAccounts'
import { peutEnvoyerDepuis } from '@/lib/mail/compose'
import { MailProviderLogo, type MailProviderKey } from './MailProviderLogo'
import { MAIL_TRANSITION, PILL, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  boites: MailAccount[]
  valeur: string | null
  onChange: (id: string) => void
}

/** Les fournisseurs que la pastille sait dessiner ; les autres prennent l'arobase. */
const PASTILLE: Record<string, MailProviderKey> = { gmail: 'gmail', outlook: 'outlook' }

/** Le champ « De » et sa liste de boîtes. Se ferme au clic dehors. */
export function MailFromField({ ms, boites, valeur, onChange }: Props) {
  const { t } = useTranslation('messages')
  const ref = useRef<HTMLDivElement>(null)
  const idListe = useId()
  const [ouvert, setOuvert] = useState(false)
  /** L'option survolée ou atteinte au clavier. */
  const [actif, setActif] = useState<number | null>(null)
  const courante = boites.find((b) => b.id === valeur) ?? null
  const motif = (b: MailAccount) => (b.status !== 'active' ? t(`mail.box.status.${b.status}`) : t('mail.compose.fromUnsupported'))

  useEffect(() => {
    if (!ouvert) return
    const dehors = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    return () => document.removeEventListener('mousedown', dehors)
  }, [ouvert])

  const choisir = (b: MailAccount) => {
    if (!peutEnvoyerDepuis(b)) return
    onChange(b.id)
    setOuvert(false)
  }
  /** La prochaine boîte QUI PEUT ENVOYER dans le sens donné — les éteintes se sautent. */
  const voisine = (depuis: number, pas: 1 | -1) => {
    for (let k = 1; k <= boites.length; k++) {
      const i = (depuis + pas * k + boites.length * k) % boites.length
      if (peutEnvoyerDepuis(boites[i])) return i
    }
    return depuis
  }
  const ouvrir = () => { setOuvert(true); setActif(Math.max(0, boites.findIndex((b) => b.id === valeur))) }

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Escape' && ouvert) { e.preventDefault(); setOuvert(false); return }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!ouvert) { ouvrir(); return }
      setActif((i) => voisine(i ?? 0, e.key === 'ArrowDown' ? 1 : -1))
      return
    }
    if ((e.key === 'Enter' || e.key === ' ') && ouvert && actif !== null) { e.preventDefault(); choisir(boites[actif]); return }
    if (e.key === 'Tab') setOuvert(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        role="combobox"
        aria-label={t('mail.compose.from')}
        aria-haspopup="listbox"
        aria-expanded={ouvert}
        aria-controls={idListe}
        aria-activedescendant={ouvert && actif !== null ? `${idListe}-${actif}` : undefined}
        onClick={() => (ouvert ? setOuvert(false) : ouvrir())}
        onKeyDown={onKeyDown}
        style={{
          display: 'flex', alignItems: 'center', gap: 'var(--crm-space-sm)', width: '100%', minHeight: 44, boxSizing: 'border-box',
          padding: 'var(--crm-space-sm) var(--crm-space-3xl)', borderRadius: PILL, cursor: 'pointer', textAlign: 'left',
          background: ms.elev, border: `1px solid ${ouvert ? ms.dim : ms.bord}`, color: ms.ink,
          fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)', transition: MAIL_TRANSITION,
        }}
      >
        <span aria-hidden style={{ flexShrink: 0, minWidth: 28, color: ms.mut }}>{t('mail.compose.from')}</span>
        <span style={{ minWidth: 0, flex: 1, display: 'flex', alignItems: 'baseline', gap: 'var(--crm-space-sm)', overflow: 'hidden', whiteSpace: 'nowrap' }}>
          <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis' }}>{courante?.email ?? t('mail.box.none')}</span>
          {courante && !peutEnvoyerDepuis(courante)
            ? <span style={{ color: ms.dangerText, fontSize: 'var(--crm-text-xs)' }}>{motif(courante)}</span>
            : courante?.display_name && <span style={{ color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis' }}>{courante.display_name}</span>}
        </span>
        <MEIcon name="chevron-down" size={12} color={ms.mut} />
      </button>

      {ouvert && (
        <div
          id={idListe}
          role="listbox"
          aria-label={t('mail.compose.from')}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 310,
            background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)',
            padding: 'var(--crm-space-2xs)', boxShadow: ms.solidShadow,
          }}
        >
          {boites.map((b, i) => {
            const ok = peutEnvoyerDepuis(b)
            const choisie = b.id === valeur
            return (
              <div
                key={b.id}
                id={`${idListe}-${i}`}
                role="option"
                aria-selected={choisie}
                aria-disabled={!ok || undefined}
                // Comme les suggestions : la souris choisit au `mousedown`, sans voler le focus.
                onMouseDown={(e) => { e.preventDefault(); choisir(b) }}
                onMouseEnter={() => ok && setActif(i)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)',
                  padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)',
                  background: ok && i === actif ? ms.hover : 'transparent', cursor: ok ? 'pointer' : 'default',
                  opacity: ok ? 1 : 0.55, transition: MAIL_TRANSITION,
                }}
              >
                <MailProviderLogo ms={ms} provider={PASTILLE[b.provider] ?? 'imap'} size={30} />
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: ms.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.email}</div>
                  <div style={{ fontSize: 'var(--crm-text-xs)', color: ok ? ms.mut : ms.dangerText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ok ? b.display_name : motif(b)}
                  </div>
                </div>
                {choisie && <MEIcon name="check" size={14} color={ms.accentText} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
