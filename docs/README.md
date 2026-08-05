# Qalam Documentation Index

The engineering source of truth. The **master ADR — [`00_ArchitectureDecisions.md`](./00_ArchitectureDecisions.md) — wins** any conflict.
Root [`CLAUDE.md`](../CLAUDE.md) is the day-to-day handbook; [`CONTRIBUTING.md`](../CONTRIBUTING.md) is the workflow.

## Architecture & product

| #   | Doc                                                     | What                                                              |
| --- | ------------------------------------------------------- | ----------------------------------------------------------------- |
| 00  | [Architecture Decisions](./00_ArchitectureDecisions.md) | **Master ADR** — every decision + build amendments (E1–E12)       |
| 01  | [Project Vision](./01_ProjectVision.md)                 | product goals, scope, phases                                      |
| 02  | [System Architecture](./02_SystemArchitecture.md)       | modules, data flow, **event flow** (§6), **queue catalogue** (§7) |
| 03  | [Folder Structure](./03_FolderStructure.md)             | monorepo layout                                                   |
| 04  | [Database Design](./04_DatabaseDesign.md)               | **full ERD**, tables, indexes, constraints                        |
| 05  | [API Standards](./05_APIStandards.md)                   | envelope, errors, pagination, rate limits                         |

## Frontend / design — canonical specs (06–12)

| #     | Doc                                                                                                                                                                                                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 06–12 | [UI/UX](./06_UIUXSpecification.md) · [Design System](./07_DesignSystem.md) · [Components](./08_ComponentLibrary.md) · [User Flows](./09_UserFlows.md) · [Information Architecture](./10_InformationArchitecture.md) · [Routing](./11_RoutingArchitecture.md) · [State Management](./12_StateManagement.md) |

These are the **canonical** frontend spec homes, and each now also carries its **applied,
build-against-frozen-`v1`** guidance folded in (Phase-2 build prep, 2026-07-09): design-system
usage + accessibility + animation → `07` §12–§14; cross-screen guidelines + responsive → `06`
§10–§11; component authoring standards → `08` §8; route→API endpoint map (+ id/slug gaps) →
`11` §10; the `qk.*` factory for real endpoints + invalidation map → `12` §2; frontend value
placement + performance rules → `16` §4.7–§4.8. `11` and `12` were also corrected in place
where they predated the frozen API (feed tab→path, piece-by-`id`, no `/taxonomy` endpoints).

## Frontend implementation guides (standalone)

| #   | Doc                                                   | What                                                                                   |
| --- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 26  | [Frontend Architecture](./26_FrontendArchitecture.md) | **entry point** — bootstrap, folder map, screen→API + component inventories, perf      |
| 32  | [API Integration](./32_APIIntegration.md)             | the real **fetch** client (not axios), refresh flow, uploads, pagination, cancellation |
| 33  | [Form Validation](./33_FormValidation.md)             | RHF + Zod, server-error mapping, reusable fields, submission                           |

## Security, ops & delivery

| #   | Doc                                                   | What                                             |
| --- | ----------------------------------------------------- | ------------------------------------------------ |
| 13  | [Security Architecture](./13_SecurityArchitecture.md) | auth, tokens, redaction contract, threat model   |
| 14  | [Logging & Monitoring](./14_LoggingMonitoring.md)     | Pino, Sentry, health, metrics taxonomy           |
| 15  | [Deployment Strategy](./15_DeploymentStrategy.md)     | environments, Docker, CI/CD, backups (the "why") |
| 16  | [Coding Standards](./16_CodingStandards.md)           | conventions, layering                            |
| 17  | [Git Workflow](./17_GitWorkflow.md)                   | branching, commits, PRs                          |
| 18  | [Development Roadmap](./18_DevelopmentRoadmap.md)     | epic breakdown E1–E10 + Phase 1.5                |

## Production operations (Epic 12 — hardening)

| #   | Doc                                                        | What                                                                  |
| --- | ---------------------------------------------------------- | --------------------------------------------------------------------- |
| 19  | [Deployment Guide](./19_DeploymentGuide.md)                | production architecture, images, deploy steps, env, shutdown, scaling |
| 20  | [Runbook](./20_Runbook.md)                                 | observability, health/metrics, admin ops, common incidents            |
| 21  | [Backup & Recovery](./21_BackupRecovery.md)                | PG PITR, restore, media, env, DR checklist                            |
| 22  | [Release Checklist](./22_ReleaseChecklist.md)              | pre-release → deploy → smoke → rollback                               |
| 23  | [Security Checklist](./23_SecurityChecklist.md)            | posture, pre-release gate, known items, attack surface                |
| 24  | [Backend Readiness Report](./24_BackendReadinessReport.md) | Epic 12 completion + deliverables                                     |
| 25  | [**Backend Freeze v1**](./25_BackendFreeze.md)             | **frozen `v1` contract baseline + breaking-change policy**            |

## Web clients — the remaining build-out

| #   | Doc                                                                                 | What                                                                                                                                        |
| --- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 45  | [Web Client Roadmap](./45_WebClientRoadmap.md)                                      | **The W-track** — ordered plan to close the frontend/admin gap left by AF1–AF6 shipping backend + mobile only                               |
| 46  | [W1 Reader Readiness Report](./46_WebReaderReadinessReport.md)                      | The reading view `/p/:slug` — what shipped, how it was verified, and the E2E debt it discharged                                             |
| 47  | [W2 AI Assistant Readiness Report](./47_WebAiAssistantReadinessReport.md)           | The in-editor Writing Assistant + Craft Coach — the editor/AI seam, the quota gate, and the one E2E gap left open                           |
| 48  | [**Platform Parity Register**](./48_PlatformParityRegister.md)                      | **Binding** — every known web↔mobile divergence, who closes it, and the no-extra-scope rule                                                 |
| 49  | [W3 Collaboration Epic Design](./49_WebCollaborationEpicDesign.md)                  | AF6 on the web in three slices — the capability map, inline review, and publishing/trust                                                    |
| 50  | [W4 Monetization Readiness Report](./50_WebMonetizationReadinessReport.md)          | Plans, subscription, usage, credits, billing history — where premium gating can honestly go, and why `af5` is green in two halves           |
| 51  | [W5 Discovery & Search Readiness Report](./51_WebDiscoverySearchReadinessReport.md) | AF4 on the web — the two engines behind one field, the recommender-backed reader section, and what "AI search" does and does not mean today |

## Browser E2E (frontend + admin)

Real full-stack browser end-to-end tests (Playwright, all three engines, phased) for the `frontend`
and `admin` apps. Self-contained suite:

- [`e2e/`](./e2e/README.md) — **start here**: architecture, conventions/rules, auth strategy, test-data
  policy, selectors, the phased coverage matrix, CI (`web-e2e.yml`), and the runbook.

## Module-level docs

- API reference (Swagger): `GET /docs` (non-production) → exported `openapi.json`.
- Backend modules: [`backend/src/modules/README.md`](../backend/src/modules/README.md)
- Async infrastructure (queues/workers/scheduler/cache/monitoring): [`backend/src/infrastructure/README.md`](../backend/src/infrastructure/README.md)
- Tests: [`backend/test/README.md`](../backend/test/README.md)
