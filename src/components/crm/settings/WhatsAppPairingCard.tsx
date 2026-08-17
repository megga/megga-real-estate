// MEGGA CRM Sugar v2 — Carte « Connecter WhatsApp » (Tier 3.k).
// Re-skin Sugar Pure de wa-pairing-card.jsx / wa-pairing-tokens.jsx : surface
// neutre (SET_PALETTE.*), glyphe WhatsApp vert pour l'ancrage de marque, bouton
// ghost DS-conforme. Câblé au hook réel useWhatsAppPairing (table
// whatsapp_agent_links + RPC generate_whatsapp_pairing_code).
//
// États dérivés du back :
//   - loading : status.isLoading            → squelette
//   - error   : status.isError              → bandeau « Statut indisponible » + réessayer
//   - linked  : link.verified === true      → numéro masqué + exemples + délier (RPC unlink_whatsapp_number)
//   - waiting : pairing_code présent, pas encore vérifié → code à 8 chiffres + lien d'envoi direct + ping
//   - unlinked: défaut                       → CTA « Générer un code »
//
// `bare` : rend le corps sans la carte extérieure (pour l'embarquer dans une modale Sugar).

import { crmVoileEncre } from '@/components/crm/tokens'
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useTranslation, Trans } from 'react-i18next'
import type { TFunction } from 'i18next'
import { SET_PALETTE } from './data'
import { SetIcon } from './atoms'
import { useWhatsAppPairing } from '@/hooks/useWhatsAppPairing'
import { composePhone, dialCodeOptions, formatInternationalPhone, PHONE_EXAMPLES } from '@/lib/countries'

const SET = SET_PALETTE

const WA_BRAND = '#25D366' // vert WhatsApp officiel — réservé au glyphe, jamais au fond/bouton

// ── Glyphe WhatsApp (pastille verte officielle) ───────────────────────────
function WAGlyphSolid({ size = 20, waColor = WA_BRAND }: { size?: number; waColor?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
      <rect width="32" height="32" rx="9" fill={waColor} />
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        fill="#FFFFFF"
        d="M22.5 9.5A9.1 9.1 0 0 0 8.2 20.5L7 25l4.6-1.2a9.1 9.1 0 0 0 4.35 1.1h.004A9.1 9.1 0 0 0 22.5 9.5Zm-6.55 13.86h-.003a7.56 7.56 0 0 1-3.85-1.05l-.276-.164-2.86.75.764-2.79-.18-.286a7.55 7.55 0 1 1 6.405 3.54Zm4.146-5.66c-.227-.114-1.344-.663-1.552-.739-.208-.076-.36-.114-.51.114-.151.227-.587.738-.72.889-.132.152-.265.17-.492.057-.227-.114-.959-.353-1.826-1.127-.675-.602-1.13-1.345-1.263-1.572-.132-.227-.014-.35.1-.463.103-.102.227-.265.34-.398.114-.133.151-.227.227-.379.076-.151.038-.284-.019-.398-.057-.114-.51-1.23-.7-1.685-.184-.442-.371-.382-.51-.39l-.435-.007a.83.83 0 0 0-.605.284c-.208.227-.794.776-.794 1.892 0 1.116.813 2.194.927 2.346.114.151 1.6 2.443 3.876 3.426.541.234.964.373 1.293.478.543.173 1.038.148 1.43.09.436-.065 1.344-.55 1.533-1.08.189-.531.189-.986.132-1.081-.056-.095-.207-.152-.435-.265Z"
      />
    </svg>
  )
}

// Masque un numéro suisse : indicatif pays (2 chiffres) + préfixe opérateur
// RÉELS + 2 derniers chiffres (dérivés des chiffres, plus figés à « +41 79 » —
// un mobile +41 76/78 affichait sinon un préfixe faux). Hypothèse CC=2 chiffres
// (E.164 CH, ce que renvoie le wa_id Meta du pilote) ; pas de parse E.164 complet.
function maskNumber(num: string | null | undefined): string {
  const digits = (num || '').replace(/\D/g, '')
  if (digits.length < 6) return num || '—'
  const cc = digits.slice(0, 2) // indicatif pays (41)
  const op = digits.slice(2, 4) // préfixe opérateur (79/78/76…)
  const last2 = digits.slice(-2)
  return `+${cc} ${op} ••• •• ${last2}`
}

// ── Tuile glyphe d'en-tête ────────────────────────────────────────────────
function WAHeadTile() {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        borderRadius: 'var(--crm-radius-md)',
        flexShrink: 0,
        display: 'grid',
        placeItems: 'center',
        background: SET.cardSubtle,
        boxShadow: `inset 0 0 0 1px ${crmVoileEncre(false, 0.04)}`,
      }}
    >
      <WAGlyphSolid size={20} />
    </div>
  )
}

// ── En-tête commun ────────────────────────────────────────────────────────
function WAHeader({ status, t }: { status?: ReactNode; t: TFunction }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
      <WAHeadTile />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 'var(--crm-text-2xl)',
            fontWeight: 500,
            color: SET.ink,
            letterSpacing: -0.2,
            lineHeight: 1.25,
          }}
        >
          {t('integrations.whatsapp.title')}
        </div>
        <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: SET.muted, marginTop: 1 }}>
          {t('integrations.whatsapp.subtitle')}
        </div>
      </div>
      {status}
    </div>
  )
}

// ── Statut « Lié » — texte vert sans fond ─────────────────────────────────
function WALinkedBadge({ t }: { t: TFunction }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 'var(--crm-space-sm)',
        fontSize: 'var(--crm-text-lg)',
        fontWeight: 600,
        color: SET.ok,
        letterSpacing: -0.1,
        whiteSpace: 'nowrap',
      }}
    >
      <span
        style={{
          width: 7,
          height: 7,
          borderRadius: 'var(--crm-radius-pill)',
          background: SET.ok,
          boxShadow: `0 0 0 3px ${SET.ok}22`,
        }}
      />
      {t('integrations.whatsapp.linked')}
    </span>
  )
}

// ── Corps par état ────────────────────────────────────────────────────────
function WABody() {
  const { t, i18n } = useTranslation('settings')
  const {
    status, unlink, startVerification, confirmVerification,
    cancelVerification, businessNumber, otpAvailable, otpProbeFailed,
  } = useWhatsAppPairing()
  const link = status.data
  // Le numéro auquel l'agent doit écrire. Affiché groupé (il va être RECOPIÉ à la main
  // par ceux qui n'utilisent pas le lien direct) et non plus figé dans ce fichier.
  const businessDisplay = formatInternationalPhone(businessNumber)

  const [paysIso, setPaysIso] = useState('CH')
  const [numeroLocal, setNumeroLocal] = useState('')
  const [codeSaisi, setCodeSaisi] = useState('')
  const [erreur, setErreur] = useState<string | null>(null)

  // L'instant courant vit en ÉTAT, ré-armé toutes les 30 s. Deux raisons, et la seconde
  // vaut plus que la première :
  //  1. `Date.now()` pendant le rendu est impur (`react-hooks/purity` le refuse) ;
  //  2. surtout, l'écran de saisie du code se referme alors TOUT SEUL à l'échéance. Lu
  //     une fois au rendu, il resterait affiché indéfiniment et l'agent taperait un code
  //     mort pour s'entendre dire « expiré » — alors que l'information était connue.
  // ⚠ Initialiseur PARESSEUX, et non un `setState` en corps d'effet : les deux donnent le
  // même instant de départ, mais le second déclenche un rendu en cascade juste après le
  // montage (`react-hooks/set-state-in-effect`). L'effet ne fait donc que POSER la minuterie.
  const [maintenant, setMaintenant] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setMaintenant(Date.now()), 30_000)
    return () => clearInterval(id)
  }, [])

  // Vérification en cours = un numéro revendiqué ET une échéance encore devant nous.
  // Les deux, parce que les colonnes ne sont pas nettoyées à l'expiration : seule la
  // confirmation les efface. Ne tester que `pending_number` bloquerait l'agent sur un
  // écran de saisie pour un code mort depuis des heures.
  const otpEnCours = !!link?.pending_number
    && !!link?.otp_expires_at
    && new Date(link.otp_expires_at).getTime() > maintenant

  // ⛔ MÊME TEST D'ÉCHÉANCE POUR L'APPAIRAGE, et son absence figeait l'écran. Rien
  // n'efface `pairing_code` à l'expiration : le webhook ne le met à NULL qu'en cas
  // d'appairage RÉUSSI. Tester la seule présence du code laissait donc l'agent qui en
  // génère un sans jamais l'envoyer bloqué DÉFINITIVEMENT sur « En attente de votre
  // message… », devant huit chiffres morts — la saisie de numéro et l'envoi un-clic
  // devenant inatteignables. La branche OTP juste au-dessus testait bien son échéance ;
  // celle-ci ne testait rien.
  //
  // ⚠ Une échéance ABSENTE compte comme expirée : une ligne d'avant l'ajout de la colonne
  // ne doit pas geler l'écran. Le sens du repli est celui qui LIBÈRE l'agent.
  //
  // La VALEUR plutôt qu'un booléen : un `boolean` calculé à part ne restreint pas le type
  // de `link.pairing_code` pour TypeScript, et l'affichage se retrouverait à répéter
  // `?? ''` sur chaque usage — trois occasions d'afficher une chaîne vide comme un code.
  // 5 est le plafond de `confirm_whatsapp_number_verification` ; `otp_attempts` compte
  // les codes REFUSÉS. `null` tant qu'aucun n'a été refusé, et au moment où le mur est
  // atteint : là, ce n'est plus un compte à rebours mais le message d'erreur qui parle,
  // et le bouton « Renvoyer un code » qui rouvre la porte.
  const essaisRestants = link && link.otp_attempts > 0 && link.otp_attempts < 5
    ? 5 - link.otp_attempts
    : null

  // Le mur, dérivé du LIEN et non d'une erreur transitoire. Sans lui, le 5e code faux
  // laissait l'écran dans un état incohérent : le compteur disparaissait (plus d'essai à
  // annoncer) pendant que le message affiché restait « Code incorrect » — vrai, mais
  // périmé, et muet sur le fait que l'agent venait d'épuiser ses essais. Il ne l'aurait
  // appris qu'en réessayant. Le tirer du lien le rend aussi persistant à travers les
  // re-rendus, là où `erreur` s'efface à la première frappe.
  const murAtteint = !!link && link.otp_attempts >= 5

  // — loading —
  if (status.isLoading) {
    const bar = (w: number | string, h = 13): CSSProperties => ({
      width: w,
      height: h,
      borderRadius: 'var(--crm-radius-sm)',
      background: SET.cardSubtle,
      boxShadow: `inset 0 0 0 1px ${crmVoileEncre(false, 0.04)}`,
    })
    return (
      <div style={{ display: 'grid', gap: 'var(--crm-space-3xl)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)' }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 'var(--crm-radius-md)',
              background: SET.cardSubtle,
              boxShadow: `inset 0 0 0 1px ${crmVoileEncre(false, 0.04)}`,
            }}
          />
          <div style={{ display: 'grid', gap: 'var(--crm-space-sm)' }}>
            <div style={bar(150)} />
            <div style={bar(110, 11)} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 'var(--crm-space-md)' }}>
          <div style={bar('90%')} />
          <div style={bar('74%')} />
        </div>
      </div>
    )
  }

  // — error —
  if (status.isError) {
    return (
      <div style={{ display: 'grid', gap: 'var(--crm-space-3xl)' }}>
        <WAHeader t={t} />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 'var(--crm-space-xl)',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-lg)',
            background: SET.cardSubtle,
            boxShadow: `inset 0 0 0 1px ${crmVoileEncre(false, 0.04)}`,
          }}
        >
          <span style={{ color: SET.err, flexShrink: 0, marginTop: 1 }}>
            <SetIcon name="alert" size={18} stroke={SET.err} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 600, color: SET.ink, letterSpacing: -0.1 }}>
              {t('integrations.whatsapp.error.title')}
            </div>
            <div
              style={{
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 500,
                color: SET.inkSoft,
                lineHeight: 1.45,
                marginTop: 2,
              }}
            >
              {t('integrations.whatsapp.error.desc')}
            </div>
          </div>
        </div>
        <WAGhostButton
          icon={<SetIcon name="arrowR" size={16} stroke={SET.inkSoft} sw={2} />}
          onClick={() => status.refetch()}
        >
          {t('integrations.whatsapp.error.retry')}
        </WAGhostButton>
      </div>
    )
  }

  // — linked —
  if (link?.verified) {
    const examples = t('integrations.whatsapp.examples', { returnObjects: true }) as string[]
    return (
      <div style={{ display: 'grid', gap: 'var(--crm-space-4xl)' }}>
        <WAHeader status={<WALinkedBadge t={t} />} t={t} />
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--crm-space-2xl)',
            padding: 'var(--crm-space-xl) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-lg)',
            background: SET.cardSubtle,
            boxShadow: `inset 0 0 0 1px ${crmVoileEncre(false, 0.04)}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 'var(--crm-text-lg)',
                fontWeight: 400,
                color: SET.muted,
              }}
            >
              {t('integrations.whatsapp.linkedNumber')}
            </div>
            <div
              style={{
                fontSize: 'var(--crm-text-xl)',
                fontWeight: 600,
                color: SET.ink,
                letterSpacing: -0.1,
                fontVariantNumeric: 'tabular-nums',
                fontFeatureSettings: '"tnum" 1',
                marginTop: 3,
                whiteSpace: 'nowrap',
              }}
            >
              {maskNumber(link.wa_number)}
            </div>
          </div>
          <span style={{ color: SET.ok, flexShrink: 0 }}>
            <SetIcon name="check" size={18} stroke={SET.ok} sw={2} />
          </span>
        </div>
        <div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--crm-space-sm)', marginBottom: 10 }}>
            <SetIcon name="sparkle" size={14} stroke={SET.muted} />
            <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SET.muted, whiteSpace: 'nowrap' }}>
              {t('integrations.whatsapp.writeLikeColleague')}
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
            {examples.map((e: string) => (
              <span
                key={e}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: 'var(--crm-space-sm) var(--crm-space-xl)',
                  borderRadius: 'var(--crm-radius-pill)',
                  fontSize: 'var(--crm-text-lg)',
                  fontWeight: 500,
                  color: SET.inkSoft,
                  background: SET.card,
                  boxShadow: `inset 0 0 0 1px ${crmVoileEncre(false, 0.06)}`,
                  whiteSpace: 'nowrap',
                }}
              >
                {e}
              </span>
            ))}
          </div>
        </div>
        {/* Délier — la sortie que la carte annonçait sans l'avoir. Elle n'existait pas
            (« no-op : pas de RPC unlink »), si bien qu'un agent qui changeait de téléphone
            restait collé à son ancien numéro : régénérer un code ne délie PAS un lien
            vérifié (c'est délibéré — sinon un code régénéré casserait un appairage qui
            marche), et le webhook ne bascule que false → true. */}
        <WAGhostButton
          icon={<SetIcon name="alert" size={16} stroke={SET.inkSoft} sw={2} />}
          onClick={() => unlink.mutate()}
          disabled={unlink.isPending}
        >
          {unlink.isPending ? t('integrations.whatsapp.unlinking') : t('integrations.whatsapp.unlink')}
        </WAGhostButton>
      </div>
    )
  }

  // — waiting : un code a été généré, en attente de vérification webhook —
  // ⛔ L'ÉCRAN « EN ATTENTE DE VOTRE MESSAGE » A ÉTÉ RETIRÉ AVEC LA VOIE QU'IL SERVAIT.
  // Le garder « pour absorber les liens en vol » aurait été le pire des deux mondes : il
  // passait AVANT la branche OTP, donc l'agent qui avait un code d'appairage en cours,
  // celui-là même qui demandait la saisie du code reçu, serait resté devant huit chiffres
  // à recopier sans pouvoir atteindre le champ. C'est exactement ce qu'il a signalé.
  // ⚠ Aucune migration ne vient effacer les codes encore en vol, et c'est délibéré : ils
  // portent une échéance de quinze minutes qui s'occupe d'eux. Ce qui reste dans la base
  // n'est plus lu par cet écran, et le webhook qui les honore ne fait de mal à personne.
  // ⚠ Un SECOND générateur subsiste hors des Réglages, dans la modale de premier lancement
  // des Contacts (`WhatsAppConnectModal`) : elle affiche le code chez elle, donc elle ne
  // dépend pas de ce qui vient d'être retiré. Le geste n'a pas été porté jusque-là.

  // — otp : un code a été ENVOYÉ au numéro saisi, on attend sa saisie —
  // Lu sur le LIEN et non sur un état local : sans ça, un rechargement de page pendant
  // les dix minutes ramènerait l'agent au formulaire de numéro, alors qu'un code est
  // bel et bien parti — il en redemanderait un, et brûlerait son plafond horaire.
  if (otpEnCours) {
    return (
      <div style={{ display: 'grid', gap: 'var(--crm-space-4xl)' }}>
        <WAHeader t={t} />
        <p style={{ margin: 0, fontSize: 'var(--crm-text-xl)', fontWeight: 500, color: SET.inkSoft, lineHeight: 1.55, maxWidth: 420 }}>
          <Trans
            i18nKey="integrations.whatsapp.otp.sent"
            t={t}
            values={{ number: formatInternationalPhone(link?.pending_number ?? '') }}
            components={{ strong: <span style={{ color: SET.ink, fontWeight: 600 }} /> }}
          />
        </p>
        <input
          value={codeSaisi}
          onChange={(e) => { setCodeSaisi(e.target.value.replace(/\D/g, '').slice(0, 6)); setErreur(null) }}
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          placeholder="000000"
          aria-label={t('integrations.whatsapp.otp.codeLabel')}
          style={{
            width: 200, height: 52, borderRadius: 'var(--crm-radius-lg)', border: 0,
            background: SET.cardSubtle, color: SET.ink, fontFamily: 'inherit',
            fontSize: 'var(--crm-text-4xl)', fontWeight: 600, letterSpacing: 6, textAlign: 'center',
            fontVariantNumeric: 'tabular-nums', outline: 'none',
            boxShadow: `inset 0 0 0 1px ${SET.line}`,
          }}
        />
        {/* Le mur PRIME sur l'erreur du moment : « Trop de tentatives, demandez un
            nouveau code » dit quoi faire, « Code incorrect » ne dit plus rien d'utile
            une fois le cinquième essai consommé. */}
        {(murAtteint || erreur) && (
          <WAErreur t={t} motif={murAtteint ? 'too_many_attempts' : (erreur as string)} />
        )}
        {/* Essais restants — la donnée était RAMENÉE du serveur et lue par personne.
            Elle n'a de valeur qu'avant le mur : au 5e code faux la RPC refuse, et jusqu'à
            l'ajout du bouton « Renvoyer » c'était une impasse. Annoncer le compte fait
            arriver l'agent au mur en le sachant, au lieu de le découvrir. Rien affiché
            tant qu'aucun code n'a été refusé : un compteur qui démarre à 5 alarme sans
            raison quelqu'un qui n'a encore rien tapé. */}
        {essaisRestants !== null && (
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SET.muted }}>
            {t('integrations.whatsapp.otp.attemptsLeft', { count: essaisRestants })}
          </span>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-xl)', alignItems: 'center' }}>
          <WAPrimaryButton
            onClick={() => {
              setErreur(null)
              confirmVerification.mutate(codeSaisi, { onError: (e) => setErreur((e as Error).message) })
            }}
            // Désactivé au mur : la RPC refusera de toute façon, et laisser le bouton
            // vif invite à s'acharner sur le seul geste qui ne peut plus rien donner.
            disabled={codeSaisi.length < 6 || confirmVerification.isPending || murAtteint}
          >
            {confirmVerification.isPending
              ? t('integrations.whatsapp.otp.verifying')
              : t('integrations.whatsapp.otp.verify')}
          </WAPrimaryButton>
          {/* ⛔ RENVOYER — sans ce bouton l'écran était une IMPASSE, et il le disait
              lui-même : au 5e code faux la RPC rend `too_many_attempts`, dont le texte
              demande à l'agent « un nouveau code »… qu'aucune affordance ne proposait.
              « Vérifier » retombait indéfiniment sur le même refus, et l'échéance de dix
              minutes n'étant pas atteinte, l'écran ne se refermait pas non plus. Même
              mismatch pour `expired`.
              Le renvoi relance `start_…`, dont l'upsert remet `otp_attempts` à 0 : c'est
              donc lui, et lui seul, qui rouvre la porte. Le plafond de 3 envois par heure
              reste opposable — un renvoi est un envoi. */}
          <WAGhostButton
            icon={<WAGlyphSolid size={16} />}
            onClick={() => {
              setErreur(null)
              setCodeSaisi('')
              // `pending_number` est en chiffres seuls ; l'edge normalise, mais le « + »
              // garde la valeur lisible dans les journaux et sans ambiguïté de format.
              startVerification.mutate(`+${link?.pending_number ?? ''}`, {
                onError: (e) => setErreur((e as Error).message),
              })
            }}
            disabled={startVerification.isPending}
          >
            {startVerification.isPending
              ? t('integrations.whatsapp.otp.sending')
              : t('integrations.whatsapp.otp.resend')}
          </WAGhostButton>
          {/* Sortie de secours : dix minutes d'attente sans rien recevoir doivent pouvoir
              se solder autrement que par un rechargement de page.
              ⚠ `cancelVerification` et NON `unlink` : ce dernier supprimait la ligne, donc
              le compteur d'envois avec elle — envoyer/annuler/recommencer donnait des
              envois illimités vers un numéro arbitraire. */}
          <WAGhostButton
            icon={<SetIcon name="arrowR" size={16} stroke={SET.inkSoft} sw={2} />}
            onClick={() => { setErreur(null); setCodeSaisi(''); cancelVerification.mutate() }}
            disabled={cancelVerification.isPending}
          >
            {t('integrations.whatsapp.otp.cancel')}
          </WAGhostButton>
        </div>
      </div>
    )
  }

  // — unlinked (défaut) —
  return (
    <div style={{ display: 'grid', gap: 'var(--crm-space-4xl)' }}>
      <WAHeader t={t} />
      <p
        style={{
          margin: 0,
          fontSize: 'var(--crm-text-xl)',
          fontWeight: 500,
          color: SET.inkSoft,
          lineHeight: 1.55,
          maxWidth: 420,
        }}
      >
        <Trans
          i18nKey="integrations.whatsapp.unlinked.body"
          t={t}
          values={{ number: businessDisplay }}
          components={{ strong: <span style={{ color: SET.ink, fontWeight: 600 }} /> }}
        />
      </p>

      {/* Saisir son numéro, recevoir un code — le SEUL chemin depuis le 17.08.2026.
          ⛔ CE BLOC ÉTAIT CONDITIONNÉ À `otpAvailable`, ET LA CONDITION EST DEVENUE UN
          ÉCRAN VIDE. Elle se justifiait tant que l'appairage servait de repli : inutile
          d'offrir ce qui n'est pas armé quand un autre bouton marche. L'appairage retiré,
          la même garde ne cachait plus une voie sur deux mais la seule qui reste — et
          quand la sonde échouait (elle échouait, 403 sur agence nulle), la carte ne
          montrait qu'un titre et un paragraphe, sans un seul geste possible.
          On rend donc TOUJOURS la saisie. Ce que la sonde apprend sert à AVERTIR au-dessus,
          jamais à effacer. */}
      <div style={{ display: 'grid', gap: 'var(--crm-space-xl)' }}>
        {/* Deux avertissements pour deux faits distincts, et ils ne disent pas la même
            chose : `otpAvailable === false` est une RÉPONSE (le template n'est pas
            configuré, réessayer n'y changera rien) ; `otpProbeFailed` est une ABSENCE de
            réponse (on ne sait pas, l'envoi tranchera). Les fondre priverait l'agent du
            seul renseignement qui décide s'il doit insister. */}
        {otpAvailable === false && <WAErreur t={t} motif="template_not_configured" />}
        {otpProbeFailed && (
          <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 500, color: SET.muted }}>
            {t('integrations.whatsapp.otp.probeFailed')}
          </span>
        )}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)' }}>
          <select
            value={paysIso}
            onChange={(e) => { setPaysIso(e.target.value); setErreur(null) }}
            aria-label={t('integrations.whatsapp.otp.countryLabel')}
            style={{
              height: 46, borderRadius: 'var(--crm-radius-lg)', border: 0, maxWidth: 190,
              background: SET.cardSubtle, color: SET.ink, fontFamily: 'inherit',
              fontSize: 'var(--crm-text-lg)', fontWeight: 500, padding: '0 var(--crm-space-lg)',
              outline: 'none', boxShadow: `inset 0 0 0 1px ${SET.line}`,
            }}
          >
            {dialCodeOptions(i18n.language).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            value={numeroLocal}
            onChange={(e) => { setNumeroLocal(e.target.value); setErreur(null) }}
            type="tel"
            inputMode="tel"
            placeholder={PHONE_EXAMPLES[paysIso] ?? PHONE_EXAMPLES.CH}
            aria-label={t('integrations.whatsapp.otp.numberLabel')}
            style={{
              flex: 1, minWidth: 160, height: 46, borderRadius: 'var(--crm-radius-lg)', border: 0,
              background: SET.cardSubtle, color: SET.ink, fontFamily: 'inherit',
              fontSize: 'var(--crm-text-xl)', fontWeight: 500, padding: '0 var(--crm-space-xl)',
              outline: 'none', boxShadow: `inset 0 0 0 1px ${SET.line}`,
            }}
          />
        </div>
        {erreur && <WAErreur t={t} motif={erreur} />}
        <WAPrimaryButton
          onClick={() => {
            setErreur(null)
            // `composePhone` retire le zéro national et pose l'indicatif : c'est la seule
            // forme que la passerelle accepte. Une saisie qui ne laisse aucun chiffre
            // utile rend une chaîne vide, que le bouton désactivé empêche d'envoyer.
            startVerification.mutate(composePhone(paysIso, numeroLocal), {
              onError: (e) => setErreur((e as Error).message),
            })
          }}
          disabled={!composePhone(paysIso, numeroLocal) || startVerification.isPending}
        >
          {startVerification.isPending
            ? t('integrations.whatsapp.otp.sending')
            : t('integrations.whatsapp.otp.send')}
        </WAPrimaryButton>
      </div>

      {/* ⛔ LA GÉNÉRATION DE CODE A ÉTÉ RETIRÉE DE CET ÉCRAN le 17.08.2026, sur décision
          de Julien, répétée trois fois avant que je l'applique. L'appairage — « générez un
          code, envoyez-le à MEGGA » — demandait à l'agent de sortir du CRM, d'ouvrir
          WhatsApp et de recopier huit chiffres pour prouver ce qu'un code reçu prouve
          aussi. Deux chemins pour une même fin, dont l'un place la charge sur l'agent.
          Il ne reste donc que la saisie du numéro ci-dessus.

          ⚠ Le webhook d'appairage reste VIVANT côté serveur, et l'écran « en attente »
          juste au-dessus aussi : un lien déjà commencé par cette voie doit pouvoir
          s'achever ou s'abandonner. C'est l'ENTRÉE qui disparaît, pas la mécanique —
          la retirer entièrement casserait les liens en vol. */}
    </div>
  )
}

// ── Bouton ghost (DS-conforme) ────────────────────────────────────────────
function WAGhostButton({
  children,
  onClick,
  disabled,
  icon,
}: {
  children: ReactNode
  onClick?: () => void
  disabled?: boolean
  icon?: ReactNode
}) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--crm-space-md)',
        width: 'fit-content',
        minHeight: 46,
        padding: '0 var(--crm-space-4xl)',
        borderRadius: 'var(--crm-radius-lg)',
        border: 0,
        background: hover && !disabled ? SET.cardSubtle : 'transparent',
        boxShadow: `inset 0 0 0 1px ${SET.line}`,
        color: SET.inkSoft,
        fontFamily: 'inherit',
        fontSize: 'var(--crm-text-xl)',
        fontWeight: 600,
        letterSpacing: -0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'all .16s ease',
      }}
    >
      {icon}
      {children}
    </button>
  )
}

// ── Refus lisible ─────────────────────────────────────────────────────────
// Les motifs viennent de la RPC et de la garde sortante, en snake_case. Les afficher
// tels quels serait grossier ; les fondre en « une erreur est survenue » serait pire,
// parce que trois d'entre eux se RÉPARENT par un geste de l'agent (attendre, corriger le
// numéro, passer par l'appairage). Un motif inconnu retombe sur un texte générique plutôt
// que sur une clé i18n crue à l'écran.
const MOTIFS_CONNUS = new Set([
  'template_not_configured', 'number_taken', 'rate_limited', 'invalid_phone',
  'wrong_code', 'expired', 'too_many_attempts', 'no_pending', 'phone_suppressed',
  'not_contactable',
  // Plafonds de plateforme (20260817160000). Distingués parce que le geste qui débloque
  // n'est pas le même : attendre, viser un autre numéro, ou appeler le support.
  'platform_rate_limited', 'number_rate_limited', 'too_many_numbers',
])

function WAErreur({ t, motif }: { t: TFunction; motif: string }) {
  const cle = MOTIFS_CONNUS.has(motif) ? motif : 'generic'
  return (
    <div
      role="alert"
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 'var(--crm-space-md)',
        padding: 'var(--crm-space-lg) var(--crm-space-xl)',
        borderRadius: 'var(--crm-radius-lg)',
        background: SET.cardSubtle,
        boxShadow: `inset 0 0 0 1px ${crmVoileEncre(false, 0.04)}`,
      }}
    >
      {/* Pas de `marginTop: 1` optique comme sur le bandeau d'erreur voisin : le cliquet
          de grammaire compte tout littéral d'espacement, et un pixel de recalage ne vaut
          pas d'élargir l'inventaire de la zone. L'icône s'aligne sur la hauteur de ligne. */}
      <span style={{ color: SET.err, flexShrink: 0 }}>
        <SetIcon name="alert" size={16} stroke={SET.err} />
      </span>
      <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 500, color: SET.inkSoft, lineHeight: 1.45 }}>
        {t(`integrations.whatsapp.otp.errors.${cle}`)}
      </span>
    </div>
  )
}

// ── Bouton primaire (accent) ──────────────────────────────────────────────
function WAPrimaryButton({
  children, onClick, disabled,
}: { children: ReactNode; onClick?: () => void; disabled?: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        gap: 'var(--crm-space-md)', width: 'fit-content', minHeight: 46,
        padding: '0 var(--crm-space-4xl)', borderRadius: 'var(--crm-radius-lg)', border: 0,
        background: hover && !disabled ? SET.blackHover : SET.black,
        color: SET.blackInk, fontFamily: 'inherit',
        fontSize: 'var(--crm-text-xl)', fontWeight: 600, letterSpacing: -0.1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        transition: 'background .16s ease, opacity .16s ease',
      }}
    >
      {children}
    </button>
  )
}

// ── Carte ─────────────────────────────────────────────────────────────────
interface WhatsAppPairingCardProps {
  /** Rend le corps sans la carte extérieure (pour l'embarquer dans une modale Sugar). */
  bare?: boolean
}

export function WhatsAppPairingCard({ bare = false }: WhatsAppPairingCardProps) {
  if (bare) return <WABody />
  return (
    <div
      style={{
        boxSizing: 'border-box',
        background: SET.card,
        borderRadius: 'var(--crm-radius-5xl)',
        padding: 'var(--crm-space-7xl)',
        boxShadow: SET.shadow,
        fontFamily: 'inherit',
      }}
    >
      <WABody />
    </div>
  )
}
