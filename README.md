## YAPD - Yet Another Pi-hole Dashboard

### Time zone

YAPD stores the selected time zone in the backend configuration and uses that value across sessions and devices.

- The default time zone is `UTC`.
- The web app no longer depends on the browser time zone as the source of truth.
- Docker containers can still define `TZ` for OS-level logs and processes, but YAPD date rendering follows the saved application preference.

### Database migrations

YAPD now treats Prisma migrations in `apps/api/prisma/migrations` as the source of truth for database history.

- On API startup, `npm run start --workspace @yapd/api` automatically runs `prisma migrate deploy` before booting the server.
- The Docker API container uses this same startup path, so `docker compose up --build api` also applies pending migrations before the Nest server starts.
- This startup path is safe for Docker containers and applies only pending migrations, preserving existing data and migration history.
- If the database is not ready yet, startup retries the migration step before failing.
- For new schema changes during development, create a real migration with `npm run db:migrate:dev -- --name your_change_name`.
- For production and Docker rollouts, commit the generated migration files and let startup run `prisma migrate deploy`.
- Never rewrite or delete migrations that were already applied in an existing environment. Add a new migration for every new column, renamed column, new table, data backfill, or schema cleanup.
- Avoid `prisma db push` for application schema changes, because it bypasses migration history and makes production upgrades unsafe.
