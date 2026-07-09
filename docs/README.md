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

## Frontend / design (not in scope for backend hardening)

| #     | Doc                                                                                                                                                                                                                                                                                                        |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 06–12 | [UI/UX](./06_UIUXSpecification.md) · [Design System](./07_DesignSystem.md) · [Components](./08_ComponentLibrary.md) · [User Flows](./09_UserFlows.md) · [Information Architecture](./10_InformationArchitecture.md) · [Routing](./11_RoutingArchitecture.md) · [State Management](./12_StateManagement.md) |

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

## Module-level docs

- API reference (Swagger): `GET /docs` (non-production) → exported `openapi.json`.
- Backend modules: [`backend/src/modules/README.md`](../backend/src/modules/README.md)
- Async infrastructure (queues/workers/scheduler/cache/monitoring): [`backend/src/infrastructure/README.md`](../backend/src/infrastructure/README.md)
- Tests: [`backend/test/README.md`](../backend/test/README.md)
