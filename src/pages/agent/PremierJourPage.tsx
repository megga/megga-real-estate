// MEGGA Premier jour — Page entrypoint (sas calibrage IA + Today fantôme)
// Se joue une seule fois après l'onboarding, avant la première vraie session.
// Voir handoff-premier-jour/HANDOFF_PREMIER_JOUR_CLAUDE_CODE.md.
import { PremierJourShell } from '@/components/premier-jour-sugar/PremierJourShell'

export default function PremierJourPage() {
  return <PremierJourShell />
}
