## YAPD - Yet Another Pi-hole Dashboard

### Time zone

YAPD stores the selected time zone in the backend configuration and uses that value across sessions and devices.

- The default time zone is `UTC`.
- The web app no longer depends on the browser time zone as the source of truth.
- Docker containers can still define `TZ` for OS-level logs and processes, but YAPD date rendering follows the saved application preference.

### Push notifications

YAPD now keeps the Web Push VAPID key pair stable across restarts.

- If `WEB_PUSH_VAPID_PUBLIC_KEY` and `WEB_PUSH_VAPID_PRIVATE_KEY` are provided, YAPD uses them as an explicit managed override.
- If they are omitted, YAPD generates a VAPID key pair once and stores it in `AppConfig`.
- The persisted private key is encrypted with `APP_ENCRYPTION_KEY`, so that value must remain stable across restarts and deployments.
- If `APP_ENCRYPTION_KEY` changes, YAPD can no longer decrypt the stored VAPID private key and push delivery will fail until a valid configuration is restored.
- Browsers that still hold an old subscription are automatically re-subscribed the next time the user opens the app.

### Database migrations

YAPD now treats Prisma migrations in `apps/api/prisma/migrations` as the source of truth for database history.

- On API startup, `npm run start --workspace @yapd/api` automatically runs `prisma migrate deploy` before booting the server.
- The Docker app container starts the backend and frontend together, and the backend migration step runs before the services are exposed.
- The example `compose.yaml` uses the local image tag `yapd-app:test` and keeps `leufrasiojunior/yapd` commented for an easy switch to Docker Hub later.
- In Docker, the browser talks to the app through the relative path `/api`, while the server-side web runtime uses `INTERNAL_API_BASE_URL` to reach the backend inside the same container.
- The example compose file sets `WEB_ORIGIN="*"` so the app can be opened from another machine on the network during testing.
- This startup path is safe for Docker containers and applies only pending migrations, preserving existing data and migration history.
- If the database is not ready yet, startup retries the migration step before failing.
- For new schema changes during development, create a real migration with `npm run db:migrate:dev -- --name your_change_name`.
- For production and Docker rollouts, commit the generated migration files and let startup run `prisma migrate deploy`.
- Never rewrite or delete migrations that were already applied in an existing environment. Add a new migration for every new column, renamed column, new table, data backfill, or schema cleanup.
- Avoid `prisma db push` for application schema changes, because it bypasses migration history and makes production upgrades unsafe.
