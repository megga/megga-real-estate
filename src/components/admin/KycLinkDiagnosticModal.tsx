/**
 * Modale « Diagnostiquer un lien KYC » (maquette `admin-kyc-diagnostic.jsx`, §5.5).
 *
 * Trois temps, dans cet ordre et jamais un autre : le MOTIF d'abord (agence qui
 * signale + référence), la recherche ensuite, les correspondances enfin. Le motif
 * n'est pas une formalité : sans lui l'audit dirait qui a cherché un nom, jamais
 * pourquoi — et le serveur refuse la recherche s'il manque.
 *
 * Ce que la plateforme voit ici : l'ÉTAPE atteinte par un parcours, jamais une
 * pièce, jamais un jeton, jamais une URL. La projection serveur est énumérée à la
 * main pour cette raison.
 *
 * ── Écarts assumés vis-à-vis de la maquette ──
 *
 * É1 · Sélecteur d'agence, pas un champ libre : la RPC attend un `uuid`, et un
 *      nom tapé produirait « Cette agence est introuvable » sur une agence
 *      pourtant réelle.
 * É2 · Le flash de réémission ne dit PAS « nouveau lien généré », ni que l'ancien
 *      reste valable. Mesuré : la RPC n'émet rien et n'invalide rien — elle
 *      dépose un job, et l'outbox n'a aujourd'hui aucun consommateur. Annoncer
 *      un lien parti affirmerait un fait qui n'a pas lieu. D'où « demande
 *      enregistrée ».
 * É3 · Le bouton de réémission est DÉSACTIVÉ pour les statuts que le serveur
 *      refuse (`submitted`, `expired`), avec la raison en ligne. Le laisser
 *      actif produirait un refus par clic sur le cas le plus probable.
 * É4 · Un état de REFUS est ajouté (absent de la maquette) : il rend
 *      `message_fr` verbatim. Le serveur peut répondre `precondition_failed`,
 *      `not_found` ou `rate_limited` — trois textes justes qu'il serait absurde
 *      de réécrire ici.
 * É5 · L'expiration n'est PAS dérivable : la projection ne porte pas
 *      `expires_at`, et rien ne périme un lien côté serveur (l'expiration est
 *      paresseuse, écrite à la visite du client). Un lien mort par TTL s'affiche
 *      donc sous son dernier statut connu — la modale n'affirme rien sur la
 *      validité.
 */
import { useId, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ShieldAlert } from 'lucide-react'
import { Modal } from '@/components/ui/modal'
import { useAdminSugar } from '@/hooks/useAdminSugar'
import { useAdminAgencies } from '@/hooks/useAdminAgencies'
import { useKycLinkLookup, useKycLinkRegenerate } from '@/hooks/useKycLinkDiagnostic'
import {
  kycNormalize,
  canRegenerate,
  KYC_QUERY_MIN,
  STATUS_LABEL_KEY,
  STATUS_STEP,
  type KycLookupResult,
  type KycMatch,
} from '@/lib/kycDiagnostic'
import {
  AdminEmpty,
  AdminGhostBtn,
  AdminIc,
  AdminPill,
  AdminSkeleton,
  AdminSolidBtn,
} from '@/components/admin/kit/adminKit'
import { ADMIN_RADII } from '@/components/admin/kit/adminKitCore'

/** Les quatre étapes de la frise, dans l'ordre du parcours client. */
const STEPS = ['sent', 'opened', 'uploaded', 'submitted'] as const

interface Props {
  onClose: () => void
  /** Renvoi vers le registre, où la consultation qu'on vient de faire est tracée. */
  onGoToJournal: () => void
}

export default function KycLinkDiagnosticModal({ onClose, onGoToJournal }: Props) {
  const { t } = useTranslation('admin')
  const { sp, surf, tones } = useAdminSugar()
  const { agencies, isLoading: agencesEnVol, isError: agencesEnEchec, refetch } = useAdminAgencies()
  const lookup = useKycLinkLookup()
  const regenerate = useKycLinkRegenerate()

  const agencyFieldId = useId()
  const refFieldId = useId()
  const queryFieldId = useId()

  const [agencyId, setAgencyId] = useState('')
  const [ref, setRef] = useState('')
  const [query, setQuery] = useState('')
  const [resultat, setResultat] = useState<KycLookupResult | null>(null)
  const [flash, setFlash] = useState<{ tone: 'ok' | 'err'; text: string } | null>(null)

  // Une clé par lien, produite UNE fois et rejouée : deux clics sur le même lien
  // ne doivent pas déposer deux demandes. La carte vit au niveau du composant,
  // qui est démonté à la fermeture — un réessai après réouverture repartira donc
  // sur une clé neuve, ce que le serveur traite comme une nouvelle demande.
  const clesRef = useRef(new Map<string, string>())
  const cleDe = (linkId: string): string => {
    const existante = clesRef.current.get(linkId)
    if (existante) return existante
    const neuve = crypto.randomUUID()
    clesRef.current.set(linkId, neuve)
    return neuve
  }

  const motifComplet = agencyId !== '' && ref.trim() !== ''
  const requeteNormalisee = useMemo(() => kycNormalize(query), [query])
  const requetePrete = requeteNormalisee.length >= KYC_QUERY_MIN

  const chercher = () => {
    if (!motifComplet || !requetePrete || lookup.isPending) return
    setFlash(null)
    lookup.mutate(
      { agencyId, ref: ref.trim(), query },
      { onSuccess: setResultat, onError: () => setResultat(null) },
    )
  }

  const reemettre = (m: KycMatch) => {
    setFlash(null)
    regenerate.mutate(
      { linkId: m.link_id, agencyId, ref: ref.trim(), idempotencyKey: cleDe(m.link_id) },
      {
        onSuccess: r => {
          if (r.kind === 'refused') { setFlash({ tone: 'err', text: r.messageFr }); return }
          const nom = m.contact ?? t('common.noName')
          setFlash({
            tone: 'ok',
            text: r.kind === 'already_done'
              ? t('kycDiag.regenAlreadyDone', { contact: nom })
              : t('kycDiag.regenRequested', { contact: nom }),
          })
        },
        onError: e => setFlash({ tone: 'err', text: e instanceof Error ? e.message : t('common.loadError') }),
      },
    )
  }

  const champ = {
    width: '100%', height: 36, padding: '0 var(--crm-space-lg)', borderRadius: ADMIN_RADII.row,
    background: surf.cardSub, border: surf.hairline, color: sp.ink,
    fontFamily: 'inherit', fontSize: 'var(--crm-text-lg)', fontWeight: 600,
  } as const
  const libelle = { display: 'block', marginBottom: 5, fontSize: 'var(--crm-text-sm)', fontWeight: 700, color: sp.sub } as const

  return (
    // ⛔ PAS de `className="megga-admin-console"` ici, et c'est mesuré : la feuille
    // `admin-console.css` REDÉFINIT `--color-theme-*` en CLAIR sous cette classe, et
    // ne repasse au sombre que sur `[data-admin-dark='true']` — un attribut que
    // `ModalProps` ne sait pas transmettre (aucun rest spread). Poser la classe seule
    // rendait donc la modale BLANCHE sur une console sombre, vérifié à l'écran.
    // Sans elle, la modale hérite du `data-theme` que le fournisseur pose sur
    // `documentElement` précisément pour les surfaces portées, et suit le thème —
    // c'est le comportement des trois autres modales de la console.
    <Modal
      open
      onClose={onClose}
      title={t('kycDiag.title')}
      description={t('kycDiag.subtitle')}
      size="lg"
    >
      <div style={{ padding: 'var(--crm-space-5xl)', display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-5xl)' }}>

        {/* ── Temps 1 : le motif ───────────────────────────────────────────── */}
        <div>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: sp.sub, marginBottom: 9 }}>
            {t('kycDiag.step1')}
          </div>
          {agencesEnVol ? (
            <AdminSkeleton height={36} />
          ) : agencesEnEchec ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)' }}>
              <span style={{ fontSize: 'var(--crm-text-md)', color: tones.err }}>{t('common.loadError')}</span>
              <AdminGhostBtn onClick={() => void refetch()} style={{ height: 28, fontSize: 'var(--crm-text-sm)' }}>
                {t('common.retry')}
              </AdminGhostBtn>
            </div>
          ) : agencies.length === 0 ? (
            <span style={{ fontSize: 'var(--crm-text-md)', color: sp.sub }}>{t('kycDiag.noAgency')}</span>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--crm-space-xl)' }}>
              <div>
                <label htmlFor={agencyFieldId} style={libelle}>{t('kycDiag.agency')}</label>
                <select
                  id={agencyFieldId}
                  value={agencyId}
                  onChange={e => setAgencyId(e.target.value)}
                  style={champ}
                >
                  <option value="">{t('kycDiag.agencyPlaceholder')}</option>
                  {agencies.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div>
                <label htmlFor={refFieldId} style={libelle}>{t('kycDiag.ref')}</label>
                <input
                  id={refFieldId}
                  type="text"
                  value={ref}
                  onChange={e => setRef(e.target.value)}
                  placeholder={t('kycDiag.refPlaceholder')}
                  style={champ}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Temps 2 : la recherche ───────────────────────────────────────── */}
        <div style={{ opacity: motifComplet ? 1 : 0.45, pointerEvents: motifComplet ? 'auto' : 'none' }}>
          <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: sp.sub, marginBottom: 9 }}>
            {t('kycDiag.step2')}
          </div>
          <div style={{ display: 'flex', gap: 'var(--crm-space-lg)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor={queryFieldId} style={libelle}>{t('kycDiag.query')}</label>
              <input
                id={queryFieldId}
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') chercher() }}
                placeholder={t('kycDiag.queryPlaceholder')}
                style={champ}
              />
            </div>
            <AdminSolidBtn onClick={chercher} disabled={!requetePrete || lookup.isPending} icon={Search}>
              {t('kycDiag.search')}
            </AdminSolidBtn>
          </div>
          <div style={{ marginTop: 6, fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
            {t('kycDiag.queryHint', { min: KYC_QUERY_MIN })}
          </div>
        </div>

        {/* ── Temps 3 : les correspondances ────────────────────────────────── */}
        {(lookup.isPending || resultat || lookup.isError) && (
          <div>
            <div style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', color: sp.sub, marginBottom: 9 }}>
              {t('kycDiag.step3')}
            </div>

            {lookup.isPending ? (
              <AdminSkeleton height={92} />
            ) : lookup.isError ? (
              <div style={{ fontSize: 'var(--crm-text-md)', color: tones.err }}>
                {lookup.error instanceof Error ? lookup.error.message : t('common.loadError')}
              </div>
            ) : resultat?.kind === 'too_many' ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: ADMIN_RADII.row, background: surf.cardSub }}>
                <AdminIc icon={ShieldAlert} size={15} color={tones.warn} />
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink }}>
                  {resultat.messageFr} {t('kycDiag.tooManyCount', { count: resultat.count })}
                </span>
              </div>
            ) : resultat?.kind === 'refused' ? (
              // Le message du serveur, VERBATIM : c'est le seul texte juste, et
              // `admin_error` garantit qu'il n'est pas vide.
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: ADMIN_RADII.row, background: surf.cardSub }}>
                <AdminIc icon={ShieldAlert} size={15} color={tones.err} />
                <span style={{ fontSize: 'var(--crm-text-md)', fontWeight: 600, color: sp.ink }}>{resultat.messageFr}</span>
              </div>
            ) : resultat && resultat.matches.length === 0 ? (
              <AdminEmpty icon={Search} title={t('kycDiag.noMatch')} hint={t('kycDiag.noMatchHint')} />
            ) : resultat ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--crm-space-lg)' }}>
                {resultat.matches.map(m => {
                  const etape = STATUS_STEP[m.status] ?? -1
                  const reemissionPossible = canRegenerate(m.status)
                  return (
                    <div key={m.link_id} style={{ padding: 'var(--crm-space-xl) var(--crm-space-2xl)', borderRadius: ADMIN_RADII.card, background: surf.cardSub }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 'var(--crm-text-lg)', fontWeight: 800, letterSpacing: -0.2, color: sp.ink }}>
                          {m.contact ?? t('common.noName')}
                        </span>
                        <AdminPill
                          label={STATUS_LABEL_KEY[m.status] ? t(STATUS_LABEL_KEY[m.status]) : m.status}
                          tone={m.status === 'submitted' ? 'ok' : m.status === 'expired' ? 'err' : 'info'}
                        />
                        {m.mode && <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>{m.mode}</span>}
                      </div>

                      <div style={{ marginTop: 4, fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
                        {[m.email, m.phone, m.agency].filter(Boolean).join(' · ')}
                      </div>

                      {/* Frise : l'étape atteinte, jamais une pièce. */}
                      <div style={{ marginTop: 11, display: 'flex', gap: 'var(--crm-space-sm)' }}>
                        {STEPS.map((s, i) => (
                          <div key={s} style={{ flex: 1 }}>
                            <div style={{
                              height: 3, borderRadius: ADMIN_RADII.pill,
                              background: etape >= i ? sp.accent : sp.sub,
                              opacity: etape >= i ? 1 : 0.25,
                            }} />
                            <div style={{ marginTop: 5, fontSize: 'var(--crm-text-xs)', fontWeight: 600, color: etape >= i ? sp.ink : sp.sub }}>
                              {t(`kycDiag.step.${s}`)}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 'var(--crm-space-lg)', flexWrap: 'wrap' }}>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub }}>
                          {m.email_sent_at
                            ? t('kycDiag.emailSentAt', { date: new Date(m.email_sent_at).toLocaleDateString('fr-CH') })
                            : t('kycDiag.emailNeverSent')}
                        </span>
                        {reemissionPossible ? (
                          <AdminGhostBtn
                            onClick={() => reemettre(m)}
                            disabled={regenerate.isPending}
                            style={{ height: 30, fontSize: 'var(--crm-text-md)' }}
                          >
                            {t('kycDiag.regenerate')}
                          </AdminGhostBtn>
                        ) : (
                          // Désactiver ET dire pourquoi : un bouton grisé sans
                          // raison se lit comme une panne (É3).
                          <span style={{ fontSize: 'var(--crm-text-sm)', fontWeight: 600, color: sp.sub }}>
                            {t(`kycDiag.regenBlocked.${m.status}`)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : null}
          </div>
        )}

        {flash && (
          <div style={{
            padding: 'var(--crm-space-lg) var(--crm-space-xl)', borderRadius: ADMIN_RADII.row, background: surf.cardSub,
            fontSize: 'var(--crm-text-md)', fontWeight: 600, color: flash.tone === 'ok' ? sp.ink : tones.err,
          }}>
            {flash.text}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--crm-space-xl)', paddingTop: 'var(--crm-space-xs)', borderTop: surf.hairline, marginTop: 2 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 'var(--crm-text-sm)', fontWeight: 500, color: sp.sub, paddingTop: 'var(--crm-space-xl)' }}>
            {t('kycDiag.audited')}
          </span>
          <AdminGhostBtn onClick={onGoToJournal} style={{ height: 28, fontSize: 'var(--crm-text-sm)', marginTop: 12 }}>
            {t('kycDiag.openJournal')}
          </AdminGhostBtn>
        </div>
      </div>
    </Modal>
  )
}
