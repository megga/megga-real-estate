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
