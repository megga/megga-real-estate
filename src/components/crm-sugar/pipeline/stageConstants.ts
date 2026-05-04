// MEGGA CRM Sugar v2 — Pipeline stage probability defaults.
// 1:1 port from the Claude Design bundle (crm-screen-pipeline-sugar.jsx).

import type { StageId } from '../tokens'

export const CRM_STAGE_PROBS: Record<StageId, number> = {
  'new-lead': 5,
  'to-qualify': 15,
  'searching': 30,
  'visit-scheduled': 45,
  'visit-done': 60,
  'interest-confirmed': 75,
  'offer': 85,
  'signed': 100,
  'lost': 0,
}
