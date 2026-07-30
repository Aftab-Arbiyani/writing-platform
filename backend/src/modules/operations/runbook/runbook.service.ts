import { Injectable } from '@nestjs/common';

import { RUNBOOK_BY_ID, RUNBOOK_CATALOG } from './runbook.catalog';
import type { Runbook } from '../operations.types';

/**
 * Runbook Service (P7.4) — serves the declarative runbook catalogue (the SSOT for
 * "what an operator does when X fires"). It computes nothing; the catalogue is
 * the source of truth. Alerts link to runbooks by id, so the alerting surface and
 * the incident timeline point operators at the SAME steps — operational knowledge
 * is centralized, never re-described per alert.
 */
@Injectable()
export class RunbookService {
  /** Every runbook. */
  list(): readonly Runbook[] {
    return RUNBOOK_CATALOG;
  }

  /** One runbook by id (null when absent). */
  get(id: string): Runbook | null {
    return RUNBOOK_BY_ID.get(id) ?? null;
  }

  /** The runbook an alert rule links to (null when unmapped). */
  forAlert(alertId: string): Runbook | null {
    return RUNBOOK_CATALOG.find((r) => r.linkedAlerts.includes(alertId)) ?? null;
  }
}
