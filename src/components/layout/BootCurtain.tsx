/**
 * Rideau d'arrivée : tient l'écran [[BootSplash]] AU-DESSUS du CRM jusqu'à sa
 * première peinture, puis le dissout.
 *
 * Sans lui, le démarrage à froid montrait deux régimes visuels à la suite —
 * écran d'arrivée, puis squelette gris du dashboard, puis contenu. Le squelette
 * est juste en navigation interne (« la page se construit ») mais faux à
 * l'arrivée : il n'apprend rien et casse la transition depuis megga.ch/login.
 * Le rideau le masque donc pendant l'arrivée, et le laisse faire son travail
 * ensuite.
 *
 * Le signal de levée est générique : `<CurtainLift>` est monté DANS la frontière
 * Suspense de ProtectedRoute, donc il ne se monte que lorsque plus rien ne
 * suspend — c'est-à-dire quand la page protégée est réellement rendue. Ça vaut
 * pour toutes les surfaces (shell Sugar, AgentLayout, export PDF KYC…) sans
 * avoir à instrumenter chacune, et ça ne dépend PAS du chargement des données :
 * on lève dès que le CRM est peint, les squelettes internes prennent le relais.
 */
import { useEffect, useState } from 'react'
import BootSplash from '@/components/layout/BootSplash'
import { hasEnteredCrm, markCrmEntered } from '@/lib/crmEntry'

/** Durée du fondu — doit rester alignée sur la transition de `.megga-boot` (index.html). */
const FADE_MS = 220

/**
 * Filet : si aucune page ne se monte (chunk introuvable, boucle de garde), le
 * rideau se lève quand même. L'échec réel est traité ailleurs (ErrorBoundary,
 * StaleBundleDetector) ; ici on garantit juste qu'on ne masque pas l'écran.
 */
const SAFETY_MS = 8000

/**
 * Monté à l'intérieur du Suspense de ProtectedRoute : son montage EST le signal
 * « la page protégée est rendue ». Ne peint rien.
 */
export function CurtainLift() {
  useEffect(() => { markCrmEntered() }, [])
  return null
}

/** Rideau plein cadre, monté hors du Suspense pour survivre au chargement des chunks. */
export default function BootCurtain() {
  // Lu au montage, une seule fois. `hasEnteredCrm()` couvre le cas nominal (le
  // rideau ne se rejoue pas d'une page à l'autre) ; la classe `megga-booting`
  // borne le rideau au TRAJET D'ARRIVÉE sur le CRM — elle est posée dans le
  // <head> (index.html) uniquement pour `/`, `/auth/callback` et `/dashboard*`.
  // Sans elle, entrer dans le CRM depuis une page publique claire (invitation,
  // confidentialité, 404) déroulait un rideau NOIR plein cadre au milieu d'un
  // parcours clair : un défaut, pas une transition.
  const [needed] = useState(() =>
    !hasEnteredCrm()
    && typeof document !== 'undefined'
    && document.documentElement.classList.contains('megga-booting'),
  )
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!needed || gone) return
    let fade: number | undefined
    const lift = () => {
      setLeaving(true)
      fade = window.setTimeout(() => setGone(true), FADE_MS)
    }
    // On sonde le drapeau plutôt que de s'abonner : `CurtainLift` peut se monter
    // dans le même commit que ce composant, donc un abonnement posé ici
    // manquerait l'événement. Une sonde courte est plus simple et sans course.
    const poll = window.setInterval(() => { if (hasEnteredCrm()) { window.clearInterval(poll); lift() } }, 40)
    const safety = window.setTimeout(() => { window.clearInterval(poll); lift() }, SAFETY_MS)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(safety)
      if (fade) window.clearTimeout(fade)
    }
  }, [needed, gone])

  if (!needed || gone) return null
  return <BootSplash className={leaving ? 'is-done' : undefined} />
}
