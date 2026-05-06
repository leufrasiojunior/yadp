![YAPD logo](media/logo.png)

Leia em Português do Brasil: [README.pt-BR](docs/README.pt-BR.md)

# YAPD

**Yet Another Pi-hole Dashboard** is a self-hosted control center for people who run more than one Pi-hole instance and want a clearer, safer way to see what is happening across their network.

YAPD is designed to bring your Pi-hole v6+ environments into one place: dashboards, instance health, query visibility, configuration management, synchronization, drift detection, audit history, and future parental controls. Instead of checking each Pi-hole separately, YAPD aims to become the trusted operational surface for your whole DNS filtering setup.

## Why YAPD Exists

Running a single Pi-hole is simple. Running several Pi-hole instances across a home lab, small office, VLAN setup, or family network is harder:

- settings can drift between instances;
- important changes are easy to miss;
- DNS activity is split across different dashboards;
- manual syncs can become risky;
- critical actions need a visible history.

YAPD is built around a simple idea: **your dashboard should know the desired state, show when reality differs, and make changes explicit, auditable, and recoverable**.

## Highlights

- **Multi-instance dashboard**: manage and monitor multiple Pi-hole v6+ instances from one interface.
- **Central configuration source of truth**: keep the intended configuration in YAPD instead of depending on scattered manual edits.
- **Sync and drift detection**: identify when an instance differs from the expected state before applying changes.
- **Query and activity visibility**: inspect DNS activity, clients, domains, and historical overview data from a unified surface.
- **Instance health and alerts**: follow operational status, notifications, and issues that need attention.
- **Audit-focused operations**: keep a trail of critical actions, configuration changes, sync attempts, and security-sensitive events.
- **Security-first direction**: designed for LAN/VPN use, encrypted secrets, secure sessions, explicit trust for self-signed certificates, and no fixed default admin credentials.
- **Internationalization**: the project is shaped for both English and Brazilian Portuguese users.

## Screenshots

### Dashboard

![YAPD dashboard screenshot](media/dashboard.png)

### Overview

![YAPD overview screenshot](media/Overview.png)

### Instances

![YAPD instances screenshot](media/Instances.png)

### Configuration

![YAPD configuration screenshot](media/Configuration.png)

### Queries

![YAPD queries screenshot](media/queries.png)

### Domains

![YAPD domains screenshot](media/domains.png)

### Groups

![YAPD groups screenshot](media/groups.png)

### Ad Lists

![YAPD ad lists screenshot](media/ad-lists.png)

### Notifications

![YAPD notifications screenshot](media/notifications.png)

## Architecture In Plain Terms

YAPD is a TypeScript monorepo with a web app, an API, and a generated API client.

- **Frontend**: Next.js App Router, Tailwind CSS, Shadcn UI, Zustand, and `next-intl`.
- **Backend**: NestJS API with Prisma and PostgreSQL.
- **API client**: generated TypeScript client used by the frontend.
- **Realtime direction**: WebSocket events for operational updates such as sync jobs, alerts, and instance health.

The frontend is intentionally not the place for sensitive business rules. The backend owns authentication, Pi-hole integration, synchronization, drift detection, audit logging, notifications, and security-sensitive actions.

## Security And Deployment Direction

YAPD is designed first for trusted private networks such as **LAN or VPN environments**. A reverse proxy can be used, but it should not replace application-level controls.

The v1 direction includes:

- secure admin sessions with HTTP-only cookies;
- strong password hashing;
- rate limiting and lockout behavior for sensitive flows;
- encrypted Pi-hole credentials and application secrets;
- explicit certificate trust for self-signed Pi-hole instances;
- audit logs for critical operations;
- reauthentication for dangerous actions;
- no static default admin account or hardcoded bootstrap password.

## Quick Start For Development

```bash
npm install
npm run db:up
npm run prisma:generate
npm run generate:api-client
npm run dev
```

Useful validation commands:

```bash
npm run check
npm run lint
npm run build
```

For database schema changes, use Prisma migrations in `apps/api/prisma/migrations`:

```bash
npm run db:migrate:dev -- --name your_change_name
```

Avoid `prisma db push` for application schema changes. Migrations are the source of truth for safe development and production upgrades.

## Project Status

YAPD is under active development toward the v1 plan described in [Plano.md](Plano.md). The goal is a practical, self-hosted, security-conscious dashboard for operating Pi-hole installations with more confidence and less repetitive manual work.
