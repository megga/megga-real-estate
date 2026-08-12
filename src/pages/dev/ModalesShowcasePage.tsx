/**
 * Banc des modales inatteignables — `/dev/modales`, sans session.
 *
 * POURQUOI IL EXISTE. Le dépôt compte 25 surfaces `role="dialog"`. La plupart
 * s'ouvrent depuis un geste sur un écran protégé : sans session, `ProtectedRoute`
 * renvoie sur la production, et la modale n'est jamais rendue. Elles ont donc été
 * CÂBLÉES (piège de focus, nom accessible) sans jamais être ÉPROUVÉES — un état
 * qui ressemble à du travail fini et n'en est pas. Ce banc les monte directement.
 *
 * ⚠ IL NE COUVRE QUE CE QUE LES AUTRES BANCS N'ATTEIGNENT PAS. Neuf modales ici ;
 * les autres sont déjà accessibles et doivent être éprouvées LÀ-BAS, sur leur
 * vrai écran, pas remontées ici en double :
 *   · `/dev/matching-atelier` → SgaConfirm, SgaSendSheet, SgaAnnonceVue
 *   · `/dev/mobile`           → SgBottomCard (et ses trois consommateurs),
 *                               MrNotifSheet, la visionneuse photo du bien,
 *                               la confirmation « tout marquer » du KYC
 *   · `/dev/contacts`         → Nouveau contact, WhatsApp, et les trois de la fiche
 * Remonter une modale déjà atteignable la ferait éprouver dans un contexte qui
 * n'est pas le sien : un piège de focus se comporte différemment selon ce qui
 * l'entoure (menu ouvert, feuille parente, écran qui se démonte).
 *
 * ⛔ Ce banc PROUVE le comportement clavier et le rendu. Il ne prouve RIEN sur
 * les données : chaque mutation est remplacée par une résolution vide, donc un
 * écran d'échec réel (edge qui refuse, réseau coupé) ne s'y voit pas. Les
 * modales qui portent un état d'erreur distinct ont un interrupteur dédié.
 */
import { useState } from 'react'
import { crmSugarPalette } from '@/components/crm-sugar/tokens'
import { deriveAiPalette } from '@/components/ai-copilot/panel/aiPanel'
import type { MrhCtx } from '@/components/matching-recherche/mrhCtx'
import EmailReviewModal from '@/components/ai-copilot/panel/EmailReviewModal'
import AnnonceReviewModal from '@/components/ai-copilot/panel/AnnonceReviewModal'
import LetterReviewModal from '@/components/ai-copilot/panel/LetterReviewModal'
import PublishReviewModal from '@/components/ai-copilot/panel/PublishReviewModal'
import DeleteContactReviewModal from '@/components/ai-copilot/panel/DeleteContactReviewModal'
import MrhSendSheet from '@/components/matching-recherche/MrhSendSheet'
import { MlkAgentModal } from '@/components/crm-sugar-v3/kyc-wizard/MlkAgentModal'
import { SourceOfFundsOverlay } from '@/components/crm-sugar-v3/kyc/KycSourceOfFundsCard'
import MxModal from '@/components/megga-x/MxModal'
import {
  DEMO_AI_EMAIL, DEMO_AI_ANNONCE, DEMO_AI_LETTER,
  DEMO_AI_PENDING_PUBLISH, DEMO_AI_PENDING_DELETE,
  DEMO_SEND_RESULT, DEMO_KYC_CASE, DEMO_KYC_DOCS,
} from './demoFixtures'

/** Identifiants des neuf modales du banc — l'état ouvert en porte au plus une. */
type Id =
  | 'email' | 'annonce' | 'lettre' | 'publier' | 'supprimer'
  | 'envoi' | 'lienKyc' | 'fonds' | 'vitrine'

const MODALES: { id: Id; label: string; note: string }[] = [
  { id: 'email', label: 'Relecture e-mail', note: 'copilote · avant envoi' },
  { id: 'annonce', label: 'Relecture annonce', note: 'copilote · avant enregistrement' },
  { id: 'lettre', label: 'Relecture courrier', note: 'copilote · lecture seule' },
  { id: 'publier', label: 'Validation publication', note: 'copilote · action en attente' },
  { id: 'supprimer', label: 'Validation suppression', note: 'copilote · action en attente' },
  { id: 'envoi', label: 'Sélection envoyée', note: 'matching · lien de réception' },
  { id: 'lienKyc', label: 'Lien magique KYC', note: 'wizard · envoi au client' },
  { id: 'fonds', label: 'Origine des fonds', note: 'KYC · LBA art. 6' },
  { id: 'vitrine', label: 'Modale MEGGA X', note: 'coquille de la vitrine' },
]

/** Les mutations ne s'exécutent pas ici : le banc ne prouve pas les données. */
const NOOP = () => {}

export default function ModalesShowcasePage() {
  // Même amorçage que les autres bancs : `megga.sugar.dark` ('1' / '0'), la clé
  // que basculent les rails Sugar. Démarrer en dur sur clair rendrait des
  // modales sombres sur une page claire et fabriquerait de faux défauts.
  const [dark, setDark] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const saved = window.localStorage.getItem('megga.sugar.dark')
    if (saved === '1') return true
    if (saved === '0') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
  })
  const [ouverte, setOuverte] = useState<Id | null>(null)
  // ⛔ L'ÉCHEC EST UN ÉTAT À PART ENTIÈRE. Les deux modales de validation
  // d'action distinguent l'échec MÉTIER (`ok: false`, le contact est rattaché à
  // des éléments à conserver) du refus technique. Sans cet interrupteur, seul le
  // chemin heureux serait jamais vu — le défaut exact que `/dev/biens` portait.
  const [echec, setEchec] = useState(false)

  const sp = crmSugarPalette(dark)
  const ai = deriveAiPalette(sp, dark)

  const fermer = () => setOuverte(null)
  const executer = async () =>
    echec
      ? { result: 'Contact rattaché à 2 deals en cours — suppression refusée.', ok: false }
      : { result: 'Fait.', ok: true }

  // MrhSendSheet ne lit que six champs du contexte ; le reste est exigé par le
  // type, pas par l'écran. Les handlers de grille ne peuvent pas être atteints
  // depuis la feuille, d'où les fonctions vides.
  const ctx: MrhCtx = {
    sp, dark, sel: [], buyer: null, animate: false,
    surf: {
      card: sp.cardBg, cardSub: sp.cardSubBg, hairline: sp.cardBorder,
      shadow: sp.shadow, shadowHov: sp.shadow,
    },
    ACC: sp.accent, ONACC: sp.accentInk, line: sp.cardBorder,
    chipBg: sp.cardSubBg, cardSolid: sp.solidBg,
    toggleSel: NOOP, onOpen: NOOP, onAskAi: NOOP,
  }

  const pilule = (actif: boolean) => ({
    border: 0, cursor: 'pointer', fontFamily: 'inherit',
    padding: 'var(--crm-space-xs) var(--crm-space-xl)',
    borderRadius: 'var(--crm-radius-pill)',
    fontSize: 'var(--crm-text-md)', fontWeight: 600,
    background: actif ? sp.accent : 'transparent',
    color: actif ? sp.accentInk : sp.sub,
  })

  return (
    <div style={{
      minHeight: '100vh', background: sp.pageBg, color: sp.ink,
      fontFamily: 'var(--crm-font, "Inter Tight"), system-ui, sans-serif',
      padding: 'var(--crm-space-4xl)',
    }}>
      <header style={{ maxWidth: 760, marginBottom: 'var(--crm-space-3xl)' }}>
        <h1 style={{ fontSize: 'var(--crm-text-2xl)', fontWeight: 600, margin: 0 }}>
          Modales sans écran d’accueil
        </h1>
        <p style={{ fontSize: 'var(--crm-text-md)', color: sp.sub, lineHeight: 1.5, margin: '8px 0 0' }}>
          Les neuf modales qu’aucun autre banc n’atteint sans session. Les autres s’éprouvent
          sur leur propre écran — <code>/dev/matching-atelier</code>, <code>/dev/mobile</code>,
          {' '}<code>/dev/contacts</code> — et non ici.
        </p>
      </header>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--crm-space-md)', maxWidth: 900 }}>
        {MODALES.map((m) => (
          <button key={m.id} type="button" onClick={() => setOuverte(m.id)}
            style={{
              textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
              background: sp.cardBg, color: sp.ink,
              border: `1px solid ${sp.cardBorder}`, borderRadius: 'var(--crm-radius-lg)',
              padding: 'var(--crm-space-lg) var(--crm-space-xl)', minWidth: 210,
            }}>
            <span style={{ display: 'block', fontSize: 'var(--crm-text-md)', fontWeight: 600 }}>{m.label}</span>
            <span style={{ display: 'block', fontSize: 'var(--crm-text-sm)', color: sp.sub, marginTop: 3 }}>{m.note}</span>
          </button>
        ))}
      </div>

      <div style={{
        position: 'fixed', bottom: 14, right: 14, zIndex: 9500, display: 'inline-flex',
        background: sp.cardBg, borderRadius: 'var(--crm-radius-pill)',
        padding: 'var(--crm-space-2xs)', gap: 'var(--crm-space-2xs)',
        border: `1px solid ${sp.cardBorder}`,
      }}>
        <button type="button" onClick={() => {
          const v = !dark
          setDark(v)
          window.localStorage.setItem('megga.sugar.dark', v ? '1' : '0')
        }} style={pilule(dark)}>{dark ? 'Sombre' : 'Clair'}</button>
        <button type="button" onClick={() => setEchec((v) => !v)} aria-pressed={echec}
          title="Fait échouer l’exécution des actions en attente"
          style={pilule(echec)}>Action en échec</button>
      </div>

      <EmailReviewModal open={ouverte === 'email'} sp={ai} dark={dark}
        draft={DEMO_AI_EMAIL} contactId={null} onClose={fermer} onSent={fermer} />
      <AnnonceReviewModal open={ouverte === 'annonce'} sp={ai} dark={dark}
        annonce={DEMO_AI_ANNONCE} listingId={null} onClose={fermer} onSaved={fermer} />
      <LetterReviewModal open={ouverte === 'lettre'} sp={ai} dark={dark}
        letter={DEMO_AI_LETTER} onClose={fermer} />
      <PublishReviewModal open={ouverte === 'publier'} sp={ai} dark={dark}
        pending={DEMO_AI_PENDING_PUBLISH} onClose={fermer}
        executePending={executer} onExecuted={NOOP} />
      <DeleteContactReviewModal open={ouverte === 'supprimer'} sp={ai} dark={dark}
        pending={DEMO_AI_PENDING_DELETE} onClose={fermer}
        executePending={executer} onExecuted={NOOP} />

      {ouverte === 'envoi' && (
        <MrhSendSheet result={DEMO_SEND_RESULT} buyerName="Marie Bertrand" ctx={ctx} onClose={fermer} />
      )}
      {ouverte === 'lienKyc' && (
        <MlkAgentModal kycCaseId="demo-kyc-banc" contactId="demo-c1"
          contactName="Marie Bertrand" contactSummary="Acheteuse · 4 pièces Plainpalais"
          contactEmail="marie.bertrand@example.ch" contactPhone="+41798749484"
          onClose={fermer} />
      )}
      {ouverte === 'fonds' && (
        <SourceOfFundsOverlay dossier={DEMO_KYC_CASE} documents={DEMO_KYC_DOCS}
          isPending={false} onCancel={fermer} onSubmit={fermer} />
      )}
      {ouverte === 'vitrine' && (
        <MxModal title="Coquille de la vitrine" closeLabel="Fermer" onClose={fermer}>
          <p style={{ margin: 0 }}>
            La modale portée depuis la vitrine. Elle ferme sur Échap par son propre
            gestionnaire — le piège de focus ne lui en passe donc pas un second.
          </p>
        </MxModal>
      )}
    </div>
  )
}
