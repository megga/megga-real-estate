/**
 * Harnais d'aperçu de « Contacts » — `/dev/contacts`, sans session.
 *
 * POURQUOI CETTE ROUTE EXISTE. Toute surface `/dashboard/*` passe par
 * `ProtectedRoute`, qui sans session fait
 * `window.location.replace('https://megga.ch/login')` — une redirection ABSOLUE
 * vers la production. On est alors déposé sur `app.megga.ch`, qui sert `main`,
 * en croyant regarder localhost : on relit l'ancienne version de son propre
 * travail. Le piège ne ressemble pas à une erreur, et c'est ce qui le rend cher.
 * Même idiome, mêmes raisons que `/dev/biens` et `/dev/mobile` — permanent.
 *
 * ⚠ Aucun échafaudage n'entre dans le code de production. `ContactsPager` et
 * `ContactDetailPager` sont purement présentationnels (le conteneur porte les
 * requêtes et les callbacks), donc ce harnais les alimente directement : ni
 * `ContactsSugarV2Page` ni `ContactDetailSugarV3Page` n'ont besoin d'une prop de
 * démonstration. `ContactImportPage`, elle, apporte son propre chrome et ne
 * dépend d'aucune donnée chargée — elle se monte telle quelle.
 *
 * ⚠ Le harnais lit `megga.sugar.dark` ('1' / '0', **pas** 'true'), la clé que
 * basculent les rails Sugar. Un harnais démarrant en dur sur `false` rendrait
 * clair dans une page sombre et FABRIQUERAIT des défauts qu'on chercherait
 * ensuite dans le composant.
 *
 * ⚠ Le chemin ne contient pas `/dashboard` : le script d'amorçage d'`index.html`
 * ne pose `data-theme="dark"` que si l'URL le contient. Le thème se pilote donc
 * ici, par le bouton du rail.
 *
 * ⛔ Données de DÉMONSTRATION (`DEMO_*` de `demoFixtures`). Rien ne vient de la
 * base, aucune action n'écrit : c'est un banc d'essai visuel, pas un aperçu du
 * carnet réel. Les callbacks de persistance résolvent sans rien faire.
 */
import { useState } from 'react'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { encreSur, MXC_SYSTEM } from '@/components/megga-x-crm/tokens'
import { SugarTopNav, SUGAR_KEYFRAMES, type SugarScreenId } from '@/components/crm-sugar/SugarShell'
import { SugarIconRail } from '@/components/crm-sugar/LiquidGlassRail'
import ContactsPager from '@/components/crm-sugar/contacts-pager/ContactsPager'
import ContactsFirstRun from '@/components/crm-sugar/contacts-pager/ContactsFirstRun'
import NewContactModal from '@/components/crm-sugar/contacts-pager/NewContactModal'
import WhatsAppConnectModal from '@/components/crm-sugar/contacts-pager/WhatsAppConnectModal'
import ContactDetailPager from '@/components/crm-sugar/contacts-pager/ContactDetailPager'
import ContactImportPage from '@/pages/agent/ContactImportPage'
import {
  DEMO_CONTACTS, DEMO_FICHE, DEMO_FICHE_LINKS, DEMO_FICHE_LOOP, DEMO_FICHE_NBA,
} from './demoFixtures'

type Surface = 'liste' | 'fiche' | 'premier' | 'import'

const SURFACES: { id: Surface; label: string }[] = [
  { id: 'liste', label: 'Liste' },
  { id: 'fiche', label: 'Fiche' },
  { id: 'premier', label: 'Premier lancement' },
  { id: 'import', label: 'Import' },
]

/** Les callbacks de persistance du pager : le banc n'écrit nulle part. */
const NOOP = () => {}
const NOOP_ASYNC = async () => {}

/** Refus d'écriture simulé — alimente les témoins d'échec (voir `ecritureCasse`). */
const REFUS = async () => { throw new Error('écriture refusée (banc d’essai)') }

export default function ContactsShowcasePage() {
  // ⚠ Même amorçage que `ContactsSugarV2Page`. Le CRM porte DEUX clés de thème
  // sans lien — `megga-theme` (lue par `useTheme`) et `megga.sugar.dark` (lue
  // par les surfaces Sugar, basculée par leur rail). C'est la seconde qui
  // décide ici, comme en production.
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [surface, setSurface] = useState<Surface>('liste')
  const [modalOpen, setModalOpen] = useState(false)
  const [waOpen, setWaOpen] = useState(false)
  // ⛔ L'ÉCHEC D'ÉCRITURE EST UN ÉTAT FRAGILE, donc le banc doit pouvoir le
  // montrer. Sans cet interrupteur, `onSaveNote` résout toujours et le témoin
  // d'échec de la note — la raison même de son correctif — reste invisible :
  // exactement le défaut de `/dev/biens`, qui cachait la pastille de score
  // faute de donnée pour la déclencher.
  const [ecritureCasse, setEcritureCasse] = useState(false)

  const sp = crmSugarPalette(dark)

  // Le harnais ne navigue nulle part : chaque cible mènerait à une surface
  // protégée, donc au rebond vers la production que cette page existe pour
  // éviter. Seuls le thème et les overlays agissent.
  const onNavigate = (_id: SugarScreenId | string) => {}

  const selecteur = (
    <div style={{
      position: 'fixed', bottom: 14, right: 14, zIndex: 9500, display: 'inline-flex',
      background: sp.cardBg, borderRadius: 'var(--crm-radius-pill)',
      padding: 'var(--crm-space-2xs)', gap: 'var(--crm-space-2xs)',
      border: `1px solid ${sp.cardBorder}`,
    }}>
      {SURFACES.map((s) => (
        <button key={s.id} type="button" onClick={() => setSurface(s.id)} aria-pressed={surface === s.id}
          style={{
            border: 0, cursor: 'pointer', fontFamily: 'inherit',
            padding: 'var(--crm-space-xs) var(--crm-space-2xl)',
            borderRadius: 'var(--crm-radius-pill)',
            fontSize: 'var(--crm-text-md)', fontWeight: 600,
            background: surface === s.id ? sp.accent : 'transparent',
            color: surface === s.id ? sp.accentInk : sp.sub,
          }}>{s.label}</button>
      ))}
      {/* La modale WhatsApp n'est atteignable depuis aucune des surfaces sans
          session (elle s'ouvre depuis un geste de la liste réelle) : le banc lui
          donne sa propre entrée, sinon elle resterait invisible. */}
      <button type="button" onClick={() => setWaOpen(true)}
        style={{
          border: 0, cursor: 'pointer', fontFamily: 'inherit',
          padding: 'var(--crm-space-xs) var(--crm-space-2xl)',
          borderRadius: 'var(--crm-radius-pill)',
          fontSize: 'var(--crm-text-md)', fontWeight: 600,
          background: 'transparent', color: sp.sub,
        }}>WhatsApp</button>
      <button type="button" onClick={() => setEcritureCasse((v) => !v)} aria-pressed={ecritureCasse}
        title="Fait échouer les écritures — pour voir les témoins d’échec"
        style={{
          border: 0, cursor: 'pointer', fontFamily: 'inherit',
          padding: 'var(--crm-space-xs) var(--crm-space-2xl)',
          borderRadius: 'var(--crm-radius-pill)',
          fontSize: 'var(--crm-text-md)', fontWeight: 600,
          background: ecritureCasse ? MXC_SYSTEM.red400 : 'transparent',
          color: ecritureCasse ? encreSur(MXC_SYSTEM.red400) : sp.sub,
        }}>Écriture en échec</button>
    </div>
  )

  const pastille = (
    <div style={{
      position: 'fixed', bottom: 14, left: 14, zIndex: 9500,
      padding: 'var(--crm-space-sm) var(--crm-space-xl)',
      borderRadius: 'var(--crm-radius-pill)', background: sp.accent, color: sp.accentInk,
      fontSize: 'var(--crm-text-sm)', fontWeight: 600, pointerEvents: 'none',
    }}>
      Aperçu · données de démonstration
    </div>
  )

  // ⚠ L'IMPORT apporte sa propre barre supérieure et son propre rail : c'est une
  // page complète, pas un panneau. La coiffer du chrome du harnais afficherait
  // DEUX barres l'une sous l'autre — défaut déjà payé sur la fiche de
  // `/dev/biens`. Elle remplace donc tout le corps.
  const corps = surface === 'import' ? (
    <ContactImportPage />
  ) : (
    <div style={{
      position: 'relative', background: sp.pageBg, height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif', color: sp.ink,
    }}>
      <style>{SUGAR_KEYFRAMES}</style>
      <SugarTopNav active="contacts" sp={sp} dark={dark} onNavigate={onNavigate} onCmd={NOOP} />
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <SugarIconRail active="contacts" onNavigate={onNavigate} onCmd={NOOP} dark={dark} setDark={setDark} sp={sp} />

        {surface === 'fiche' ? (
          <ContactDetailPager
            fiche={DEMO_FICHE}
            nba={DEMO_FICHE_NBA}
            loop={DEMO_FICHE_LOOP}
            links={DEMO_FICHE_LINKS}
            sp={sp}
            dark={dark}
            onBack={() => setSurface('liste')}
            onSaveIdentity={NOOP_ASYNC}
            onInvalidateKyc={NOOP_ASYNC}
            onSaveCoord={NOOP_ASYNC}
            onSaveCriteria={NOOP_ASYNC}
            onSaveNote={ecritureCasse ? REFUS : NOOP_ASYNC}
            onDelete={NOOP_ASYNC}
            onOpenKyc={NOOP}
            onOpenMatching={NOOP}
            onOpenListings={NOOP}
            onProposeVisit={NOOP}
            onRevokeLink={async () => 'ok'}
          />
        ) : (
          <ContactsPager
            // `premier` = carnet vide chargé AVEC SUCCÈS, donc `fresh` : c'est ce
            // qui distingue un compte neuf d'une panne de chargement.
            contacts={surface === 'premier' ? [] : DEMO_CONTACTS}
            sp={sp}
            dark={dark}
            fresh={surface === 'premier'}
            isLoading={false}
            loadError={false}
            onRetry={NOOP}
            onOpenContact={() => setSurface('fiche')}
            onNewContact={() => setModalOpen(true)}
            firstRunSlot={<ContactsFirstRun sp={sp} dark={dark} onManual={() => setModalOpen(true)} />}
            modalOpen={modalOpen}
            modalSlot={
              <NewContactModal
                sp={sp}
                dark={dark}
                onClose={() => setModalOpen(false)}
                onCreate={NOOP_ASYNC}
                isPending={false}
                error={null}
                onOpenMatching={() => setModalOpen(false)}
                onOpenKyc={() => setModalOpen(false)}
                onOpenFiche={() => setModalOpen(false)}
              />
            }
          />
        )}
      </div>
    </div>
  )

  // ⚠ La modale WhatsApp vit HORS du corps, sinon la surface Import — qui
  // remplace tout — la démonterait, et son bouton resterait visible sans rien
  // faire. C'est le piège du banc qui cache l'élément qu'il doit montrer,
  // rencontré ici même en le construisant.
  return (
    <>
      {corps}
      {pastille}
      {selecteur}
      <WhatsAppConnectModal open={waOpen} onClose={() => setWaOpen(false)} sp={sp} dark={dark} />
    </>
  )
}
