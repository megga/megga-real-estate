/**
 * Un champ de destinataires « comme Google » (Julien, 14.09.2026) : une adresse validée
 * devient une capsule, on en pose plusieurs, et les contacts de l'agence se proposent
 * pendant la frappe. Il sert « À », « Cc » et « Cci » du composeur, et le transfert.
 *
 * Une adresse se valide par Entrée, Tab, virgule, point-virgule, espace (après une
 * adresse complète), en quittant le champ, ou en collant une liste. Retour arrière dans
 * un champ vide SÉLECTIONNE la dernière capsule, un second la retire : d'un seul coup,
 * un destinataire disparaissait sans qu'on l'ait vu partir. Double-clic : la capsule
 * redevient du texte, pour la corriger.
 *
 * ⚠ Une saisie qui n'est pas une adresse devient AUSSI une capsule, en encre d'alerte,
 * et le composeur refuse d'envoyer tant qu'elle reste : `mail-send` écarte en silence ce
 * qu'il ne sait pas lire, donc un destinataire mal tapé tombait de l'envoi sans bruit.
 *
 * ⚠ Le texte en cours de frappe appartient au PARENT (`texte`) : « Envoyer » cliqué juste
 * après la frappe, sans valider, doit partir avec cette adresse — et le bouton doit
 * s'allumer dès qu'elle est complète.
 */
import { useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import MEIcon from '@/components/propertyx/MEIcon'
import { useMailContactSearch, type MailContactHit } from '@/hooks/useMailContactSearch'
import type { MailSenderLogo } from '@/hooks/useMailSenderLogos'
import { adresseValide, ajouterDestinataires, decouperDestinataires, scinderSaisie } from '@/lib/mail/compose'
import { displayAddress, domaineDe, type MailAddress } from '@/lib/mail/format'
import { MailSenderAvatar } from './MailSenderAvatar'
import { MAIL_TRANSITION, type MailSurfaces } from './mailTokens'

interface Props {
  ms: MailSurfaces
  /** « À », « Cc », « Cci » — écrit en tête du champ. */
  prefixe: string
  /** Nom accessible de la saisie. */
  libelle: string
  valeur: MailAddress[]
  texte: string
  onChange: (valeur: MailAddress[], texte: string) => void
  /** Domaine → logo, pour la pastille des capsules. */
  logos?: Record<string, MailSenderLogo>
  autoFocus?: boolean
  placeholder?: string
  /** À droite, sur la première ligne : les bascules « Cc » et « Cci ». */
  fin?: ReactNode
  /** Fond du champ : creusé dans une carte par défaut, carte dans un bloc déjà creusé. */
  fond?: string
}

/** Hauteur d'une capsule, et donc d'une ligne du champ : 44 px de champ sur une ligne. */
const LIGNE = 26
/**
 * La place que la saisie réclame avant de passer à la ligne. Plus large, le curseur
 * partait seul sur une ligne vide dès la deuxième capsule ; une adresse plus longue que
 * la place restante défile dans la saisie, comme dans Gmail.
 */
const SAISIE_MIN = 96
/** Au-delà, le nom se coupe : une capsule ne mange pas la ligne. */
const CAPSULE_MAX = 240
const SUGGESTIONS_MAX = 6

/** Le champ, ses capsules et ses suggestions de contacts. */
export function MailRecipientField({ ms, prefixe, libelle, valeur, texte, onChange, logos, autoFocus, placeholder, fin, fond }: Props) {
  const { t } = useTranslation('messages')
  const saisie = useRef<HTMLInputElement>(null)
  const idListe = useId()
  const [focus, setFocus] = useState(false)
  const [ouvert, setOuvert] = useState(false)
  /** La suggestion choisie AU CLAVIER ; `null` tant qu'on n'a pas navigué. */
  const [actif, setActif] = useState<number | null>(null)
  /** La capsule sélectionnée (retour arrière, clic) — la prochaine à partir. */
  const [armee, setArmee] = useState<number | null>(null)

  const recherche = useMailContactSearch(ouvert ? texte : '', { pendantLaFrappe: true })
  const deja = new Set(valeur.map((a) => a.email.toLowerCase()))
  /**
   * ⛔ LES RÉSULTATS DE LA FRAPPE PRÉCÉDENTE NE SE PROPOSENT QUE S'ILS RÉPONDENT ENCORE.
   * Gardés le temps que la RPC réponde (sans quoi la liste clignote à chaque lettre), ils
   * restaient offerts TELS QUELS : « théo » puis « pas-une-adresse » + Entrée posait Théo
   * Baumgartner en copie — mesuré au banc. Ils sont refiltrés ici par les jetons de la RPC.
   */
  const jetons = texte.toLowerCase().replace(/[,()%*_\\]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 5)
  const repond = (h: MailContactHit) => jetons.every((j) => [h.first_name, h.last_name, h.email, h.phone].some((v) => (v ?? '').toLowerCase().includes(j)))
  // Un contact sans adresse ne se propose pas : il n'y a rien à lui envoyer.
  const suggestions = (recherche.data ?? []).filter((h) => !recherche.isPlaceholderData || repond(h)).flatMap((h) => (h.email && !deja.has(h.email.toLowerCase())
    ? [{ id: h.id, name: [h.first_name, h.last_name].filter(Boolean).join(' ') || null, email: h.email.toLowerCase() }]
    : [])).slice(0, SUGGESTIONS_MAX)
  const montrer = ouvert && texte.trim().length >= 2 && suggestions.length > 0
  // Entrée prend la suggestion surlignée ; sans navigation, la première — sauf si
  // l'agent a tapé une adresse complète : c'est ELLE qu'il veut, pas un contact voisin.
  const tapeUneAdresse = adresseValide(texte.trim().toLowerCase())
  const iCible = !montrer ? null : actif ?? (tapeUneAdresse ? null : 0)

  const valider = (brut: string) => onChange(ajouterDestinataires(valeur, decouperDestinataires(brut)), '')
  const choisir = (i: number) => {
    const s = suggestions[i]
    onChange(ajouterDestinataires(valeur, [{ name: s.name, email: s.email }]), '')
    setActif(null)
  }
  const retirer = (i: number) => {
    onChange(valeur.filter((_, j) => j !== i), texte)
    setArmee(null)
    saisie.current?.focus()
  }
  const editer = (i: number) => {
    const a = valeur[i]
    const reste = ajouterDestinataires(valeur.filter((_, j) => j !== i), decouperDestinataires(texte))
    onChange(reste, a.name ? `${a.name} <${a.email}>` : a.email)
    setArmee(null)
    saisie.current?.focus()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.nativeEvent.isComposing) return
    if (montrer && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault()
      const n = suggestions.length
      const bas = e.key === 'ArrowDown'
      setActif((i) => (i === null ? (bas ? 0 : n - 1) : (i + (bas ? 1 : n - 1)) % n))
      return
    }
    // ⚠ Consommé (`preventDefault`) : le piège de focus de la modale ignore un Échap
    // déjà pris, sans quoi fermer la liste fermerait aussi le composeur.
    if (e.key === 'Escape' && montrer) { e.preventDefault(); setOuvert(false); return }
    if (e.key === 'Enter' || e.key === 'Tab') {
      // Tab laisse ensuite le focus filer vers le champ suivant, comme partout.
      if (iCible !== null) { if (e.key === 'Enter') e.preventDefault(); choisir(iCible); return }
      if (texte.trim()) { if (e.key === 'Enter') e.preventDefault(); valider(texte); return }
      return
    }
    if (e.key === ' ' && tapeUneAdresse) { e.preventDefault(); valider(texte); return }
    if ((e.key === 'Backspace' || e.key === 'Delete') && armee !== null) { e.preventDefault(); retirer(armee); return }
    if (e.key === 'Backspace' && !texte && valeur.length > 0) { e.preventDefault(); setArmee(valeur.length - 1); return }
    if (e.key === 'ArrowLeft' && !texte && valeur.length > 0) {
      e.preventDefault()
      setArmee((i) => (i === null ? valeur.length - 1 : Math.max(0, i - 1)))
      return
    }
    if (e.key === 'ArrowRight' && armee !== null) {
      e.preventDefault()
      setArmee((i) => (i !== null && i + 1 < valeur.length ? i + 1 : null))
      return
    }
    setArmee(null)
  }

  return (
    <div style={{ position: 'relative' }}>
      <div
        // Un clic dans le vide du champ y pose le curseur, comme dans une saisie simple.
        onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); saisie.current?.focus() } }}
        style={{
          display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-sm)', width: '100%', boxSizing: 'border-box',
          minHeight: 44, padding: 'var(--crm-space-sm) var(--crm-space-3xl)', cursor: 'text',
          background: fond ?? ms.elev, border: `1px solid ${focus ? ms.dim : ms.bord}`,
          // ⚠ Pas le rayon pilule : sur deux lignes de capsules, un rayon de 999 ferait du
          // champ un stade aux bouts ronds. 24 px se réduit à 22 sur une ligne de 44 — une
          // pilule exacte —, et reste un coin arrondi quand le champ grandit.
          borderRadius: 'var(--crm-radius-6xl)', transition: MAIL_TRANSITION,
        }}
      >
        <span aria-hidden style={{ flexShrink: 0, minWidth: 28, height: LIGNE, display: 'flex', alignItems: 'center', fontSize: 'var(--crm-text-sm)', color: ms.mut }}>
          {prefixe}
        </span>
        <div
          onMouseDown={(e) => { if (e.target === e.currentTarget) { e.preventDefault(); saisie.current?.focus() } }}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 'var(--crm-space-xs)' }}
        >
          {valeur.map((a, i) => (
            <Capsule
              key={a.email.toLowerCase()}
              ms={ms}
              adresse={a}
              logo={logos?.[domaineDe(a.email) ?? '']}
              armee={armee === i}
              invalide={t('mail.compose.invalidAddress')}
              retirer={t('mail.compose.removeRecipient', { address: a.email })}
              onArmer={() => { setArmee(i); saisie.current?.focus() }}
              onRetirer={() => retirer(i)}
              onEditer={() => editer(i)}
            />
          ))}
          <input
            ref={saisie}
            role="combobox"
            aria-label={libelle}
            aria-expanded={montrer}
            aria-controls={idListe}
            aria-autocomplete="list"
            aria-activedescendant={iCible !== null ? `${idListe}-${iCible}` : undefined}
            value={texte}
            autoFocus={autoFocus}
            placeholder={valeur.length === 0 ? placeholder : undefined}
            onChange={(e) => {
              setArmee(null)
              setActif(null)
              setOuvert(true)
              // Une virgule ou un point-virgule tapés — ou collés — valident ce qui les
              // précède. Lu sur la VALEUR et non sur la touche : un clavier mobile
              // n'annonce pas toujours la sienne.
              const s = scinderSaisie(e.target.value)
              onChange(s ? ajouterDestinataires(valeur, s.complets) : valeur, s ? s.reste : e.target.value)
            }}
            onKeyDown={onKeyDown}
            onPaste={(e) => {
              // ⚠ Une saisie d'une ligne SUPPRIME les retours à la ligne collés : une colonne
              // d'adresses copiée d'un tableur y devenait « a@b.chc@d.ch ». On la lit avant.
              const colle = e.clipboardData.getData('text')
              if (!/[\n\r\t]/.test(colle)) return
              e.preventDefault()
              const el = e.currentTarget
              valider(texte.slice(0, el.selectionStart ?? texte.length) + '\n' + colle + '\n' + texte.slice(el.selectionEnd ?? texte.length))
            }}
            onFocus={() => { setFocus(true); setOuvert(true) }}
            onBlur={() => {
              setFocus(false)
              setOuvert(false)
              setArmee(null)
              // Quitter le champ valide ce qui y reste : un clic sur « Objet » ne perd rien.
              if (texte.trim()) valider(texte)
            }}
            style={{
              // La base décide du passage à la ligne ; `minWidth: 0` laisse la saisie tenir
              // dans un champ plus étroit qu'elle, au lieu d'en déborder.
              flex: `1 1 ${SAISIE_MIN}px`, minWidth: 0, height: LIGNE, padding: 0, border: 'none', outline: 'none',
              background: 'transparent', color: ms.ink, fontFamily: 'inherit', fontSize: 'var(--crm-text-sm)',
            }}
          />
        </div>
        {fin && <span style={{ flexShrink: 0, height: LIGNE, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-2xs)' }}>{fin}</span>}
      </div>

      {montrer && (
        <div
          id={idListe}
          role="listbox"
          aria-label={t('mail.compose.suggestions')}
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 310,
            background: ms.card, border: `1px solid ${ms.bord}`, borderRadius: 'var(--crm-radius-xl)',
            padding: 'var(--crm-space-2xs)', boxShadow: ms.solidShadow,
          }}
        >
          {suggestions.map((s, i) => (
            <div
              key={s.id}
              id={`${idListe}-${i}`}
              role="option"
              aria-selected={i === iCible}
              // ⚠ `onMouseDown` et non `onClick` : le `blur` du champ part AVANT le clic,
              // validerait le texte tapé en capsule, puis démonterait la liste sous le curseur.
              onMouseDown={(e) => { e.preventDefault(); choisir(i) }}
              onMouseEnter={() => setActif(i)}
              style={{
                display: 'flex', alignItems: 'center', gap: 'var(--crm-space-md)', cursor: 'pointer',
                padding: 'var(--crm-space-sm) var(--crm-space-lg)', borderRadius: 'var(--crm-radius-lg)',
                background: i === iCible ? ms.hover : 'transparent', transition: MAIL_TRANSITION,
              }}
            >
              <MailSenderAvatar ms={ms} nom={s.name} adresse={s.email} taille={28} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: ms.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{displayAddress(s)}</div>
                <div style={{ fontSize: 'var(--crm-text-xs)', color: ms.mut, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.email}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface CapsuleProps {
  ms: MailSurfaces
  adresse: MailAddress
  logo?: MailSenderLogo
  armee: boolean
  /** Libellé « Adresse invalide », pour l'infobulle d'une capsule en alerte. */
  invalide: string
  /** Nom accessible de la croix. */
  retirer: string
  onArmer: () => void
  onRetirer: () => void
  onEditer: () => void
}

/**
 * Une capsule : la pastille (logo ou initiales), le nom — l'adresse à défaut —, la croix.
 * Sélectionnée, elle prend l'ACCENT (l'élément actif, CLAUDE.md §3) : c'est elle que le
 * prochain retour arrière retirera.
 */
function Capsule({ ms, adresse: a, logo, armee, invalide, retirer, onArmer, onRetirer, onEditer }: CapsuleProps) {
  const valide = adresseValide(a.email)
  return (
    <span
      data-capsule=""
      data-invalide={valide ? undefined : ''}
      data-armee={armee ? '' : undefined}
      title={valide ? (a.name ? `${a.name} <${a.email}>` : a.email) : `${invalide} · ${a.email}`}
      // Le clic sélectionne la capsule sans ôter le focus de la saisie.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onArmer}
      onDoubleClick={onEditer}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-2xs)', height: LIGNE, maxWidth: '100%',
        boxSizing: 'border-box', padding: '0 var(--crm-space-2xs)', borderRadius: 'var(--crm-radius-pill)',
        background: armee ? ms.accent : ms.hover, color: armee ? ms.accentInk : valide ? ms.ink : ms.dangerText,
        border: `1px solid ${armee ? ms.accent : valide ? ms.bord : ms.dangerText}`,
        fontSize: 'var(--crm-text-sm)', fontWeight: 500, cursor: 'default', userSelect: 'none', transition: MAIL_TRANSITION,
      }}
    >
      {valide
        ? <MailSenderAvatar ms={ms} nom={a.name} adresse={a.email} logo={logo} taille={18} />
        : <span style={{ width: 18, height: 18, display: 'grid', placeItems: 'center', flexShrink: 0 }}><MEIcon name="alert" size={12} /></span>}
      <span style={{ maxWidth: CAPSULE_MAX, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', padding: '0 var(--crm-space-2xs)' }}>
        {displayAddress(a)}
      </span>
      <button
        type="button"
        // Hors de la tabulation : on ne traverse pas chaque croix pour atteindre « Objet ».
        // Le clavier retire par retour arrière ; la croix reste nommée pour les lecteurs d'écran.
        tabIndex={-1}
        aria-label={retirer}
        onClick={(e) => { e.stopPropagation(); onRetirer() }}
        style={{
          width: 18, height: 18, flexShrink: 0, borderRadius: '50%', display: 'grid', placeItems: 'center', padding: 0,
          background: 'transparent', border: 'none', color: 'inherit', opacity: 0.6, cursor: 'pointer',
        }}
        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1' }}
        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6' }}
      >
        <MEIcon name="close" size={10} />
      </button>
    </span>
  )
}
