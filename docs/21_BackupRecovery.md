# 21 — Backup, Recovery & Disaster Recovery

Data-protection procedures for production. Targets (docs 15 §9): **RPO ≤ 5 min**,
**RTO ≤ 4 h**, PITR window **30 days**. Backup tooling itself is infra-provisioned
(not in this repo); this document is the strategy + runnable checklists.

## 1. What is (and isn't) backed up

| Store                      | Backed up?          | Method                                         | Rationale                                                                                                                              |
| -------------------------- | ------------------- | ---------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **Postgres**               | ✅ critical         | daily base + continuous WAL (PITR)             | source of truth                                                                                                                        |
| **Object storage** (S3/R2) | ✅                  | provider cross-region replication + versioning | media is user content                                                                                                                  |
| **Redis**                  | ❌ (by design)      | —                                              | cache (DB0) is rebuildable; queues (DB1) are transient; auth (DB3) re-auth on loss; AOF gives local durability across restarts, not DR |
| **Secrets / env**          | ✅                  | GitHub Environments + an offline sealed copy   | see §5                                                                                                                                 |
| **`audit_logs`**           | ✅ (7-yr retention) | part of the PG backup; never pruned            | compliance                                                                                                                             |

## 2. Postgres backup strategy

- **Base backup + WAL archiving** via `pgBackRest` or `wal-g` to a **separate
  bucket with separate credentials** (a compromised app cannot delete backups).
- **Schedule**: daily full base backup; WAL shipped continuously (→ RPO ≤ 5 min).
- **Retention**: 30 days of PITR.
- **Encryption**: at rest (bucket SSE) + in transit.
- **Monitoring**: alert if no successful WAL archive in 15 min or no base backup
  in 26 h (backup failure is a SEV — silent backup loss is the worst outage).

Manual on-demand base backup (example, pgBackRest):

```bash
pgbackrest --stanza=qalam --type=full backup
pgbackrest --stanza=qalam info      # verify the new backup is listed
```

## 3. Restore procedures

### 3a. Full restore (new host / total loss)

```bash
# 1. Provision Postgres 16, stop any app writers.
# 2. Restore the latest base + replay WAL to the newest consistent point.
pgbackrest --stanza=qalam restore
# 3. Start Postgres; verify.
psql "$DATABASE_URL" -c "SELECT count(*) FROM users;"
# 4. Point the app at the restored DB; run pending migrations; smoke /health/ready.
```

### 3b. Point-in-time recovery (bad migration / data corruption at time T)

```bash
pgbackrest --stanza=qalam --type=time --target="2026-07-09 14:32:00" restore
```

Use for "a deploy at 14:35 corrupted data" — recover to 14:32, then re-apply good
changes. Prefer this over `migration:revert` when data (not just schema) is wrong.

### 3c. Migration rollback (bad schema change, data intact)

```bash
docker compose -f docker-compose.prod.yml run --rm backend pnpm --filter backend migration:revert
```

Only safe because every migration ships a tested `down()` (CI `migrations` job
validates up→down→up). For an expand→migrate→contract change, roll the app back
first, then revert the migration.

## 4. Media (object storage) recovery

- Enable **bucket versioning** + a lifecycle to retain non-current versions ≥ 30
  days → recover an overwritten/deleted object.
- **Cross-region replication** to a second bucket for regional loss.
- Orphaned uploads under `quarantine/` are cleaned after 24 h (docs 13 §7) — not a
  data-loss path.

## 5. Environment / secrets backup checklist

- [ ] All production secrets stored in GitHub Environment `production` (protected).
- [ ] An **offline, encrypted, sealed** copy of the secret set exists (recover if
      the CI provider is unavailable).
- [ ] `.env.example` is current (documents every required variable) — the recovery
      shape of truth.
- [ ] Backup-bucket credentials are stored **separately** from app credentials.
- [ ] TLS certs / DNS records documented for edge reprovisioning.

## 6. Disaster-recovery checklist (region/host loss)

1. [ ] Declare incident; page on-call; open the incident channel.
2. [ ] Provision a new host (or region) from infra-as-code.
3. [ ] Restore Postgres (§3a) — this dominates RTO; target < 3 h.
4. [ ] Confirm object storage reachable (replica bucket if primary region lost).
5. [ ] Deploy the last-known-good backend image (immutable `sha-` tag).
6. [ ] Run `migration:run` (idempotent; no-op if already applied).
7. [ ] Repoint DNS / edge to the new host; issue/attach TLS.
8. [ ] Smoke: `/health/ready` = 200, a login, a piece read, a publish.
9. [ ] Verify Redis reachable (cache warms on demand; queues resume).
10. [ ] Post-incident: confirm backups resumed; schedule a restore drill.

## 7. Restore drills

- **Monthly**: restore the latest backup into a scratch environment and run the
  e2e smoke. A backup you have never restored is not a backup. Record the measured
  RTO against the ≤ 4 h target.
