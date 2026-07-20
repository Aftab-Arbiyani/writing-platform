import type { ConsentPurpose, ConsentState, DsrKind, DsrStatus } from './privacy.constants';

/** A single purpose's current consent + when it last changed. */
export interface ConsentEntry {
  readonly purpose: ConsentPurpose;
  readonly state: ConsentState;
  readonly updatedAt: string | null;
}

/** A section of a data-subject export contributed by one module. */
export interface DataExportSection {
  /** Stable key, e.g. `profile`, `audit`, `consent`, `pieces`. */
  readonly key: string;
  readonly label: string;
  readonly records: unknown;
}

/** The assembled export bundle (GDPR Art. 15). */
export interface DataExportBundle {
  readonly subjectId: string;
  readonly generatedAt: string;
  readonly sections: DataExportSection[];
}

export interface DataSubjectRequestRecord {
  readonly subjectId: string;
  readonly kind: DsrKind;
  readonly status: DsrStatus;
  readonly requestedAt: string;
  readonly fulfilledAt: string | null;
}

/**
 * Port a module implements to contribute its data to a subject export (GDPR
 * Art. 15) and/or erase it (Art. 17). Modules SELF-REGISTER with the Privacy
 * Platform at bootstrap (like the Policy Engine ports) — so export/erasure is
 * complete and extensible without the platform importing every module (no
 * cycles, no duplication). A contributor that only exports leaves `erase`
 * undefined; one that only erases leaves `exportFor` undefined.
 */
export interface PrivacyDataContributor {
  /** Stable section key + human label. */
  readonly key: string;
  readonly label: string;
  /** Return the subject's data for this domain (export). */
  exportFor?(subjectId: string): Promise<unknown>;
  /** Erase/anonymize the subject's data for this domain (right to erasure). */
  erase?(subjectId: string): Promise<void>;
}
