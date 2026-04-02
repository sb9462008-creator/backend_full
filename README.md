# Hurgelt Backend

Express + Prisma backend for multi-tenant delivery operations with PostgreSQL, Redis, PostGIS, and Docker.

## Stack

- Node.js + TypeScript + Express
- Prisma ORM
- PostgreSQL with PostGIS
- Redis
- Docker Compose

## Quick Start

1. Copy `.env.example` to `.env`
2. Start infra with `docker compose up -d postgres redis`
3. Push the schema with `npm run prisma:push`
4. Generate the client with `npm run prisma:generate`
5. Seed an admin user with `npm run seed`
6. Start the API with `npm run dev`

You can also run everything with `docker compose up --build`.

## Signup Emails

New customer and driver registrations send a welcome email through SMTP.

Set these variables in `.env` to deliver real email:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`

Without SMTP configuration, the backend keeps signup working but only logs a local JSON email preview instead of delivering to a real inbox.

## Local HTTPS

To run the backend on trusted local HTTPS:

1. Generate localhost certificates with `npm run certs:dev`
2. Set `FORCE_HTTPS=true`
3. Set `HTTPS_CERT_PATH=certs/localhost.pem`
4. Set `HTTPS_KEY_PATH=certs/localhost-key.pem`
5. Set `FRONTEND_URL=https://localhost:3000`
6. Start the API with `npm run dev:https`

## Observability

An overview of logging, metrics, and monitoring is available in [docs/logging-metrics-monitoring.md](./docs/logging-metrics-monitoring.md).

The backend now exposes:

- `GET /health` for a lightweight liveness check
- `GET /health/detailed` for database, Redis, and runtime health details
- `GET /metrics` for Prometheus-style metrics output

Structured JSON logs are written to stdout/stderr and include request id, tenant, user, route, latency, startup, shutdown, Redis, Socket.IO, and error events.

### Prometheus + Grafana

The Docker Compose stack includes an optional `monitoring` profile with:

- Prometheus on `${PROMETHEUS_PORT:-9090}`
- Alertmanager on `${ALERTMANAGER_PORT:-9093}`
- Grafana on `${GRAFANA_PORT:-3001}`

Start the full stack with:

```bash
npm run docker:up:monitoring
```

This monitoring stack scrapes the backend from `host.docker.internal:4000`, so it works when your API is running locally with `npm run dev` or when it is published on host port `4000` from Docker.

Default Grafana credentials come from `.env` or fallback to:

- username: `admin`
- password: `admin`

Provisioned files:

- Prometheus config: `docker/monitoring/prometheus/prometheus.yml`
- Prometheus alert rules: `docker/monitoring/prometheus/alerts.yml`
- Alertmanager config: `docker/monitoring/alertmanager/alertmanager.yml`
- Grafana dashboard: `docker/monitoring/grafana/dashboards/hurgelt-observability.json`

The default Alertmanager receiver is intentionally empty. Add email, Slack, or webhook receivers in `docker/monitoring/alertmanager/alertmanager.yml` before using it in production.

## Kubernetes

Kubernetes manifests are available in [k8s/README.md](./k8s/README.md).

## Production Deployment

Use the templates and guide below when moving this backend out of local development:

- production env template: [`./.env.production.example`](./.env.production.example)
- project deployment guide: [`../DEPLOYMENT.md`](../DEPLOYMENT.md)

Required production variables before the container can start:

- `DATABASE_URL`
- `REDIS_URL`
- `JWT_SECRET`
