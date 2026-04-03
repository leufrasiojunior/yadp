## YAPD - Yet Another Pi-hole Dashboard

### Time zone

When running YAPD in Docker, set `TZ` on the application containers, for example `TZ=America/Sao_Paulo`.

The web app prefers the browser time zone for rendering dates and falls back to `TZ` during server-side rendering or container-based execution.

### Database migrations

YAPD now treats Prisma migrations in `apps/api/prisma/migrations` as the source of truth for database history.

- On API startup, `npm run start --workspace @yapd/api` automatically runs `prisma migrate deploy` before booting the server.
- This startup path is safe for Docker containers and applies only pending migrations, preserving existing data and migration history.
- If the database is not ready yet, startup retries the migration step before failing.
- For new schema changes during development, create a real migration with `npm run db:migrate:dev -- --name your_change_name`.
- Avoid `prisma db push` for application schema changes, because it bypasses migration history and makes production upgrades unsafe.
