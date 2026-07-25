/**
 * Point d'entrée mobile du pipeline — assemble MobilePipelineScreen dans la
 * coque à onglets. Le câblage et les états vivent dans le Screen.
 */
import MobileShell from '../shell/MobileShell'
import { MobilePipelineScreen } from './MobilePipelineScreen'

/** Route /dashboard/pipeline (mobile) — onglets de stade + liste, dans la coque à onglets. */
export default function MobilePipelinePage() {
  return (
    <MobileShell variant="tabs">
      <MobilePipelineScreen />
    </MobileShell>
  )
}
