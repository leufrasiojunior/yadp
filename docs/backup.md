# PostgreSQL Backup Guide

YAPD uses PostgreSQL to store all application state: instances, sessions, secrets, configuration, sync history, audit logs, notifications, and overview data. **There is no automated backup configured by default.** If the Docker volume is lost, all data is lost.

This guide documents how to back up and restore the database. Two approaches are covered: a manual `pg_dump` workflow for occasional snapshots, and a sidecar container for scheduled backups.

---

## What to back up

The Postgres service `postgres` (defined in `compose.yml`) stores everything you care about. The Docker volume name depends on your compose project directory, but the data path inside the container is always `/var/lib/postgresql/data`.

You do **not** need to back up the application container (`yapd`) — it is stateless and can always be rebuilt from the published image.

---

## Manual backup with `pg_dump`

Run from the host where the compose stack is running. The example uses the `yapd` user and database; adjust if you changed them in `compose.yml`.

```bash
# Create a custom-format dump (most flexible — supports selective restore)
docker compose exec -T postgres \
  pg_dump -U yapd -d yapd --format=custom \
  > "yapd-$(date +%Y%m%d-%H%M%S).dump"
```

Recommended location for the dumps: a directory **outside** the compose project (so you do not accidentally delete it during cleanup). For example, `~/backups/yapd/`.

### Verifying a backup

The fastest sanity check is to list the contents of the dump:

```bash
pg_restore --list yapd-YYYYMMDD-HHMMSS.dump | head -20
```

You should see tables like `Instance`, `AuditLog`, `OverviewSnapshot`, etc.

### Compressing

Custom format already compresses well, but you can wrap with gzip if you prefer:

```bash
docker compose exec -T postgres \
  pg_dump -U yapd -d yapd --format=custom \
  | gzip > "yapd-$(date +%Y%m%d-%H%M%S).dump.gz"
```

---

## Manual restore

> Warning: restoring **drops and recreates** all data in the target database. Make sure you understand which database you are restoring into.

### Restore into an empty database

```bash
docker compose cp "yapd-YYYYMMDD-HHMMSS.dump" postgres:/tmp/restore.dump
docker compose exec postgres \
  pg_restore -U yapd -d yapd --clean --if-exists /tmp/restore.dump
docker compose exec postgres rm /tmp/restore.dump
```

### Restore from gzip

```bash
gunzip -c yapd-YYYYMMDD-HHMMSS.dump.gz \
  | docker compose exec -T postgres \
    pg_restore -U yapd -d yapd --clean --if-exists
```

### After restore

Restart the YAPD app container so it picks up the restored state cleanly:

```bash
docker compose restart yapd
```

---

## Scheduled backups via cron (host)

If you want a simple daily backup without adding another container, run cron on the host:

```cron
0 3 * * * cd /opt/yapd && docker compose exec -T postgres pg_dump -U yapd -d yapd --format=custom > /var/backups/yapd/yapd-$(date +\%Y\%m\%d).dump
```

Add a retention step that removes dumps older than N days:

```cron
30 3 * * * find /var/backups/yapd -name "yapd-*.dump" -mtime +14 -delete
```

The cron above keeps 14 daily backups. Adjust `-mtime +14` to your preference.

---

## Scheduled backups via sidecar container (optional)

For a self-contained setup, add a backup service to `compose.yml` that runs `pg_dump` on a schedule:

```yaml
postgres-backup:
  image: prodrigestivill/postgres-backup-local:16
  restart: unless-stopped
  depends_on:
    postgres:
      condition: service_healthy
  environment:
    POSTGRES_HOST: postgres
    POSTGRES_DB: yapd
    POSTGRES_USER: yapd
    POSTGRES_PASSWORD: changeme  # match compose.yml
    SCHEDULE: "@daily"
    BACKUP_KEEP_DAYS: 7
    BACKUP_KEEP_WEEKS: 4
    BACKUP_KEEP_MONTHS: 6
  volumes:
    - ./backups:/backups
```

This image rotates backups automatically (daily, weekly, monthly retention). The dumps land in `./backups/` on the host.

---

## Recommended strategy for home/lab deployments

For most YAPD deployments (single host, small dataset, low write rate), the simplest robust setup is:

1. Cron on the host running `pg_dump --format=custom` every night to a local directory.
2. Retention of 14 daily dumps (covers two weeks of recovery).
3. Periodic off-machine copy of the dumps (rsync to NAS, cloud storage, etc.) — Docker volumes do not survive a disk failure.

For lab or production-style deployments where the dataset is larger or downtime matters, consider WAL archiving for point-in-time recovery (PITR). That is out of scope for this guide.

---

## Testing your backups

A backup you have never restored is not a backup. At least once after setting up the process, do a test restore into a throwaway database to confirm the dump is valid:

```bash
# Create a temporary database
docker compose exec postgres createdb -U yapd yapd_restore_test

# Restore the dump into it
docker compose cp ./yapd-YYYYMMDD-HHMMSS.dump postgres:/tmp/test.dump
docker compose exec postgres \
  pg_restore -U yapd -d yapd_restore_test --clean --if-exists /tmp/test.dump

# Verify a few tables have rows
docker compose exec postgres psql -U yapd -d yapd_restore_test \
  -c "SELECT count(*) FROM \"Instance\";" \
  -c "SELECT count(*) FROM \"AuditLog\";"

# Clean up
docker compose exec postgres dropdb -U yapd yapd_restore_test
docker compose exec postgres rm /tmp/test.dump
```

If the table counts look right, the backup is good.
