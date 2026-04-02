# Logging, Metrics, and Monitoring

The backend exposes three observability endpoints:

- `GET /health` for a lightweight liveness check
- `GET /health/detailed` for database, Redis, and runtime health details
- `GET /metrics` for Prometheus-compatible metrics

## Logs

The API writes structured JSON logs to stdout and stderr. Startup, shutdown, request lifecycle, Redis, Socket.IO, and uncaught process errors are all logged with environment metadata.

## Prometheus

Prometheus is configured from [docker/monitoring/prometheus/prometheus.yml](../docker/monitoring/prometheus/prometheus.yml) and alert rules are defined in [docker/monitoring/prometheus/alerts.yml](../docker/monitoring/prometheus/alerts.yml).

The default scrape target for the local API is `host.docker.internal:4000`, which matches the standard local backend port.

## Alertmanager

Alertmanager is configured in [docker/monitoring/alertmanager/alertmanager.yml](../docker/monitoring/alertmanager/alertmanager.yml).

The checked-in `default-receiver` is intentionally empty, so alerts are grouped and routed internally but are not sent to email, Slack, or webhooks until a concrete receiver is added.

## Grafana

Grafana provisioning files live under [docker/monitoring/grafana](../docker/monitoring/grafana). The default dashboard is [hurgelt-observability.json](../docker/monitoring/grafana/dashboards/hurgelt-observability.json).
