<div align="center">

# Qalam · قلم · क़लम

**A premium writing sanctuary.**

A global creative writing platform — built first for Hindi and Urdu writers,
designed from day one for the world's scripts.

</div>

---

## What this is

Qalam is a long-form creative writing platform: a calm, literary home where writers draft,
publish, and grow an audience, and readers discover work by writer, tag, genre, and
language. The writing is always the hero — minimal chrome, generous whitespace, serious
typography (including Nastaliq), dark mode and RTL from day one.

**Status: Phase 0 — Foundation.** This repository contains the complete architecture
documentation and the production-grade scaffold. Feature code (Phase 1) has not started.
See [docs/18_DevelopmentRoadmap.md](docs/18_DevelopmentRoadmap.md).

## Repository layout

```
backend/     NestJS 11 modular monolith (API + BullMQ workers) — PostgreSQL 16, Redis
frontend/    Reader/writer app — React 19, Vite 7, AntD 5 + Tailwind 4, TipTap
admin/       Admin panel — same stack, workbench flavor
packages/    @qalam/shared · @qalam/utils · @qalam/api-types · @qalam/ui · @qalam/config
infrastructure/  Dockerfiles + nginx configs
docs/        Architecture volumes 00–18 (00 = master ADR)
```

The Flutter mobile app lives in a **separate repository** by design.

## Getting started

Prerequisites: **Node 24** (`.nvmrc`), **pnpm 9** (`corepack enable`), **Docker**.

```bash
# 1. Infrastructure (Postgres, Redis, MinIO, Mailpit)
docker compose up -d

# 2. Install & build workspace packages
pnpm install
pnpm build

# 3. Environment
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
cp admin/.env.example admin/.env

# 4. Develop
pnpm dev            # api → :4000 (Swagger at /docs) · frontend → :5173 · admin → :5174
```

Everyday commands: `pnpm lint` · `pnpm typecheck` · `pnpm test` · `pnpm build` — all
Turborepo-cached across the workspace. Full containerized stack:
`docker compose --profile full up`.

## Documentation

| #   | Volume                                                                  | #   | Volume                                                         |
| --- | ----------------------------------------------------------------------- | --- | -------------------------------------------------------------- |
| 00  | [Architecture Decisions (master ADR)](docs/00_ArchitectureDecisions.md) | 10  | [Information Architecture](docs/10_InformationArchitecture.md) |
| 01  | [Project Vision](docs/01_ProjectVision.md)                              | 11  | [Routing Architecture](docs/11_RoutingArchitecture.md)         |
| 02  | [System Architecture](docs/02_SystemArchitecture.md)                    | 12  | [State Management](docs/12_StateManagement.md)                 |
| 03  | [Folder Structure](docs/03_FolderStructure.md)                          | 13  | [Security Architecture](docs/13_SecurityArchitecture.md)       |
| 04  | [Database Design](docs/04_DatabaseDesign.md)                            | 14  | [Logging & Monitoring](docs/14_LoggingMonitoring.md)           |
| 05  | [API Standards](docs/05_APIStandards.md)                                | 15  | [Deployment Strategy](docs/15_DeploymentStrategy.md)           |
| 06  | [UI/UX Specification](docs/06_UIUXSpecification.md)                     | 16  | [Coding Standards](docs/16_CodingStandards.md)                 |
| 07  | [Design System](docs/07_DesignSystem.md)                                | 17  | [Git Workflow](docs/17_GitWorkflow.md)                         |
| 08  | [Component Library](docs/08_ComponentLibrary.md)                        | 18  | [Development Roadmap](docs/18_DevelopmentRoadmap.md)           |
| 09  | [User Flows](docs/09_UserFlows.md)                                      | —   | [CLAUDE.md — engineering handbook](CLAUDE.md)                  |

## Contributing

Trunk-based development, conventional commits, squash merges. Read
[CLAUDE.md](CLAUDE.md) (the hard rules) and
[docs/16_CodingStandards.md](docs/16_CodingStandards.md) before your first PR.
