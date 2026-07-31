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
 * Durée MINIMALE de l'écran d'arrivée, comptée depuis l'ouverture du document.
 *
 * Depuis que l'aiguillage du callback ne dépend plus d'un minuteur, l'arrivée
 * est devenue si rapide que l'écran passait en un éclair : on ne lisait ni le
 * logo ni la mention, et l'entrée dans le CRM ressemblait à un sursaut plutôt
 * qu'à une transition. Ce plancher lui redonne le temps d'exister.
 *
 * ⚠ C'est un PLANCHER, pas une attente ajoutée : si le CRM met plus longtemps à
 * se peindre, on ne rallonge rien. Et il se mesure depuis `performance.now()`,
 * dont l'origine est la création du document — donc depuis la première frame du
 * jumeau HTML, pas depuis le montage de ce composant. Compter depuis le montage
 * ajouterait le temps déjà écoulé sur `/auth/callback`, où le MÊME écran est
 * déjà à l'affiche : l'agent verrait le total, pas ce plancher.
 *
 * ⚠ INVARIANT : doit rester nettement SOUS `SAFETY_MS`. Le filet ne connaît pas
 * le plancher et lève sans condition ; le poser au-dessus le désarme donc en
 * silence — le rideau part à `SAFETY_MS` et la valeur réglée ici ne fait plus
 * rien. Vérifié par tests/unit/boot-curtain-timings.spec.ts.
 */
const MIN_VISIBLE_MS = 1600

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
    let hold: number | undefined
    const fadeOut = () => {
      setLeaving(true)
      fade = window.setTimeout(() => setGone(true), FADE_MS)
    }
    // Le CRM est prêt : on part, mais pas avant le plancher. `remaining` est
    // négatif dès que le chargement a duré plus longtemps que lui — le cas
    // nominal sur un cache froid, où rien n'est donc rallongé.
    const lift = () => {
      const remaining = MIN_VISIBLE_MS - performance.now()
      if (remaining <= 0) { fadeOut(); return }
      hold = window.setTimeout(fadeOut, remaining)
    }
    // On sonde le drapeau plutôt que de s'abonner : `CurtainLift` peut se monter
    // dans le même commit que ce composant, donc un abonnement posé ici
    // manquerait l'événement. Une sonde courte est plus simple et sans course.
    const poll = window.setInterval(() => { if (hasEnteredCrm()) { window.clearInterval(poll); lift() } }, 40)
    // Le filet, lui, ne connaît pas de plancher : il se déclenche quand quelque
    // chose a mal tourné, et faire patienter davantage devant un écran qui ne
    // mène nulle part serait le contraire de ce qu'on veut.
    const safety = window.setTimeout(() => { window.clearInterval(poll); fadeOut() }, SAFETY_MS)
    return () => {
      window.clearInterval(poll)
      window.clearTimeout(safety)
      if (hold) window.clearTimeout(hold)
      if (fade) window.clearTimeout(fade)
    }
  }, [needed, gone])

  if (!needed || gone) return null
  return <BootSplash className={leaving ? 'is-done' : undefined} />
}
