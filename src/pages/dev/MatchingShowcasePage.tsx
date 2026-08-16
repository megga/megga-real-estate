/**
 * Harnais d'aperçu de « Matching » — `/dev/matching-atelier`, sans session.
 *
 * POURQUOI CETTE ROUTE EXISTE. Toute surface `/dashboard/*` passe par
 * `ProtectedRoute`, qui sans session fait
 * `window.location.replace('https://megga.ch/login')` — une redirection ABSOLUE
 * vers la production. On est alors déposé sur `app.megga.ch`, qui sert `main`,
 * en croyant regarder localhost : on relit l'ancienne version de son propre
 * travail. Le piège ne ressemble pas à une erreur. Même idiome, mêmes raisons
 * que `/dev/biens`, `/dev/contacts` et `/dev/mobile` — permanent.
 *
 * ── CE QUI A CHANGÉ (13 août 2026) ───────────────────────────────────────────
 * Ce banc ne montait que `AtelierStage`, soit la page 0 du pager, sans son
 * chrome. Il couvre désormais le PAGER ENTIER : la barre supérieure, le rail (et
 * donc la BASCULE DE THÈME), les deux pages et le geste qui passe de l'une à
 * l'autre. Trois raisons, toutes mesurées :
 *
 * 1. `MatchingRechercheHybride` — la moitié la plus lourde du périmètre bureau —
 *    porte ses PROPRES hooks, tous gatés sur la session : sans banc elle ne rend
 *    qu'un état bloqué. D'où son mode `demo` (`matching-recherche/mrhDemo.ts`).
 * 2. Le reciblage d'`atelier.css` touche 39 blocs de thème sombre d'un seul
 *    geste. Un banc qui ne rend qu'en clair les laisserait invérifiés.
 * 3. Les états qui ne s'atteignent pas par hasard — premier lancement, liste
 *    vide, échec de chargement, requête bloquée — sont exactement ceux qu'un lot
 *    de peinture casse sans qu'on le voie. `/dev/biens` avait déjà caché la
 *    pastille de score faute de donnée pour la déclencher.
 *
 * ⚠ La MÉCANIQUE du pager n'est pas recopiée ici : `MatchingPage` est monté
 * tel quel et reçoit ses contenus par le slot `banc`. Un banc qui dupliquerait la
 * molette, le clavier et les points de page mesurerait sa copie.
 *
 * ⚠ Les trois slots sont des composants de MODULE, pas des fermetures créées au
 * rendu : une identité d'élément qui change à chaque clic remonterait
 * `AtelierStage` et effacerait la session de triage en cours. Leur état passe
 * donc par un contexte, pas par une capture.
 *
 * ⚠ Le thème vient du pager (bouton du rail, clé `megga.sugar.dark` — '1'/'0',
 * **pas** 'true'). Le banc ne le relit jamais pour son compte : il le reçoit,
 * sinon ses propres commandes seraient peintes dans le thème d'avant la dernière
 * bascule.
 *
 * ⛔ Données de DÉMONSTRATION. Rien ne vient de la base, aucun geste n'écrit :
 * les gestes de l'atelier sont des poignées inertes, l'envoi de la Recherche
 * ouvre sa feuille sans minter de lien.
 */
import { createContext, useContext, useMemo, useState } from 'react'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import AtelierStage from '@/components/matching-atelier/AtelierStage'
import MatchingFirstRun from '@/components/matching-atelier/MatchingFirstRun'
import type { AtelierGestes, PendingHandle } from '@/components/matching-atelier/pendingTriage'
import MatchingRechercheHybride from '@/components/matching-recherche/MatchingRechercheHybride'
import type { MrhDemoEtat } from '@/components/matching-recherche/mrhDemo'
import MatchingPage, { type MatchingPagerBanc } from '@/pages/agent/MatchingPage'
import { ATELIER_BUYERS, ATELIER_PIVOT, atelierPoolFor } from './matchingAtelierFixtures'
import '@/components/matching-atelier/atelier.css'

/**
 * États de la page 0. `vide` et `premier` sont DEUX écrans distincts, et la
 * distinction est celle du produit : la couverture explique la boucle de match à
 * une agence sans aucun mandat (le moteur ne PEUT rien produire), l'état vide
 * s'adresse à une agence équipée dont le moteur n'a rien proposé.
 */
type AtelierEtat = 'nominal' | 'premier' | 'vide' | 'erreur'

const ETATS_ATELIER: { id: AtelierEtat; label: string }[] = [
  { id: 'nominal', label: 'Atelier' },
  { id: 'premier', label: 'Premier lancement' },
  { id: 'vide', label: 'Rien à trier' },
  { id: 'erreur', label: 'Échec' },
]

const ETATS_RECHERCHE: { id: MrhDemoEtat; label: string }[] = [
  { id: 'ok', label: 'Recherche' },
  { id: 'vide', label: 'Aucun résultat' },
  { id: 'erreur', label: 'Échec' },
  { id: 'bloque', label: 'Requête bloquée' },
]

interface BancEtat {
  atelier: AtelierEtat
  setAtelier: (e: AtelierEtat) => void
  recherche: MrhDemoEtat
  setRecherche: (e: MrhDemoEtat) => void
  contactId: string | null
  setContactId: (id: string | null) => void
}

const BancCtx = createContext<BancEtat | null>(null)

function useBanc(): BancEtat {
  const v = useContext(BancCtx)
  if (!v) throw new Error('slot de banc rendu hors de son fournisseur')
  return v
}

/** Poignée de geste inerte : même fenêtre d'annulation, zéro écriture. */
const poigneeInerte = (): PendingHandle => ({
  cancel: () => undefined,
  flushNow: () => Promise.resolve(null),
})

const GESTES: AtelierGestes = {
  send: poigneeInerte,
  relance: poigneeInerte,
  snooze: poigneeInerte,
  dismiss: poigneeInerte,
  react: poigneeInerte,
  wake: () => undefined,
  visit: () => undefined,
}

function Page0({ dark, onOpenRecherche }: { dark: boolean; onOpenRecherche: () => void }) {
  const { atelier, setAtelier, contactId, setContactId } = useBanc()
  if (atelier === 'premier') return <MatchingFirstRun onCreateListing={() => undefined} />
  const pivotBuyer = contactId ? ATELIER_BUYERS.find((b) => b.id === contactId) ?? null : null
  return (
    <AtelierStage
      embedded
      dark={dark}
      isLoading={false}
      isError={atelier === 'erreur'}
      onRetry={() => setAtelier('nominal')}
      // `vide` = chargé AVEC SUCCÈS et rien à trier — c'est ce qui le sépare d'un
      // échec, et les deux écrans le disent autrement.
      pivot={atelier === 'nominal' ? ATELIER_PIVOT : null}
      pivots={atelier === 'nominal' ? [ATELIER_PIVOT] : []}
      onPickPivot={() => undefined}
      // Sans lui, le bouton « Voir le marché » du cockpit n'existe pas : il est
      // conditionné à cette prop, et c'est un `.btn-ghost` d'`atelier.css`.
      onOpenRecherche={onOpenRecherche}
      pivotBuyer={pivotBuyer}
      pool={pivotBuyer ? atelierPoolFor(pivotBuyer.id) : []}
      poolCountFor={(cid) => atelierPoolFor(cid).length}
      gestes={GESTES}
      onClose={() => undefined}
      onOpenDeal={() => undefined}
      onOpenBuyerPivot={setContactId}
      onCloseBuyerPivot={() => setContactId(null)}
      onStartKyc={() => undefined}
    />
  )
}

function Page1({ dark }: { dark: boolean }) {
  const { recherche } = useBanc()
  return <MatchingRechercheHybride dark={dark} demo={recherche} />
}

function Chrome({ dark }: { dark: boolean }) {
  const { atelier, setAtelier, recherche, setRecherche } = useBanc()
  // ⛔ Un banc qui CACHE une surface ne la vérifie pas. Posées à demeure, ces
  // commandes recouvrent le coin bas-droit — celui de la fiche annonce et de la
  // feuille d'envoi, les deux plus gros fichiers de la Recherche. On les replie
  // donc sur leur pastille : même piège que `/dev/biens`, qui ne montrait jamais
  // la pastille de score, à ceci près qu'ici c'est le banc qui masque.
  const [replie, setReplie] = useState(false)
  const sp = crmSugarPalette(dark)
  const pilule = (actif: boolean) => ({
    border: 0, cursor: 'pointer', fontFamily: 'inherit',
    padding: 'var(--crm-space-xs) var(--crm-space-lg)',
    borderRadius: 'var(--crm-radius-pill)',
    fontSize: 'var(--crm-text-sm)', fontWeight: 600,
    background: actif ? sp.accent : 'transparent',
    color: actif ? sp.accentInk : sp.sub,
    whiteSpace: 'nowrap' as const,
  })
  const groupe = {
    display: 'inline-flex', gap: 'var(--crm-space-2xs)',
    background: sp.solidBg, borderRadius: 'var(--crm-radius-pill)',
    padding: 'var(--crm-space-2xs)', border: `1px solid ${sp.cardBorder}`,
  }
  return (
    <div style={{
      position: 'fixed', bottom: 14, right: 14, zIndex: 9500,
      display: 'flex', flexDirection: 'column', alignItems: 'flex-end',
      gap: 'var(--crm-space-2xs)',
    }}>
      {!replie && (
        <>
          <div style={groupe}>
            {ETATS_ATELIER.map((e) => (
              <button key={e.id} type="button" onClick={() => setAtelier(e.id)} aria-pressed={atelier === e.id}
                style={pilule(atelier === e.id)}>{e.label}</button>
            ))}
          </div>
          <div style={groupe}>
            {ETATS_RECHERCHE.map((e) => (
              <button key={e.id} type="button" onClick={() => setRecherche(e.id)} aria-pressed={recherche === e.id}
                style={pilule(recherche === e.id)}>{e.label}</button>
            ))}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={() => setReplie((v) => !v)}
        aria-expanded={!replie}
        title={replie ? 'Déplier les commandes du banc' : 'Replier — dégage le coin bas-droit'}
        style={{
          border: 0, cursor: 'pointer', fontFamily: 'inherit',
          padding: 'var(--crm-space-2xs) var(--crm-space-lg)',
          borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk,
          fontSize: 'var(--crm-text-xs)', fontWeight: 600,
        }}>
        {replie ? 'Aperçu ▸' : 'Aperçu · données de démonstration'}
      </button>
    </div>
  )
}

/** Identité STABLE — voir la note sur `MatchingPagerBanc`. */
const BANC: MatchingPagerBanc = { Page0, Page1, Chrome }

export default function MatchingShowcasePage() {
  const [atelier, setAtelier] = useState<AtelierEtat>('nominal')
  const [recherche, setRecherche] = useState<MrhDemoEtat>('ok')
  // Le pivot acheteur : en production il vient de `?contact=`, ici d'un état local.
  const [contactId, setContactId] = useState<string | null>(null)

  const etat = useMemo<BancEtat>(
    () => ({ atelier, setAtelier, recherche, setRecherche, contactId, setContactId }),
    [atelier, recherche, contactId],
  )

  return (
    <BancCtx.Provider value={etat}>
      <MatchingPage banc={BANC} />
    </BancCtx.Provider>
  )
}
