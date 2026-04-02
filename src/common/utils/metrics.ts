type HttpMetricRecord = {
  method: string;
  route: string;
  statusCode: number;
  statusClass: string;
  count: number;
};

type HistogramRecord = {
  method: string;
  route: string;
  count: number;
  sum: number;
  buckets: number[];
};

type ApplicationErrorRecord = {
  source: string;
  type: string;
  count: number;
};

const requestDurationBucketsMs = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000, 10_000];
const startedAt = Date.now();
const startupCpuUsage = process.cpuUsage();

const httpCounters = new Map<string, HttpMetricRecord>();
const httpDurationHistograms = new Map<string, HistogramRecord>();
const applicationErrorCounters = new Map<string, ApplicationErrorRecord>();

let activeRequests = 0;
let socketConnectedClients = 0;
let socketConnectionsTotal = 0;
let socketDisconnectsTotal = 0;

function escapeLabelValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");
}

function formatLabels(labels: Record<string, string | number>) {
  const entries = Object.entries(labels);

  if (entries.length === 0) {
    return "";
  }

  const rendered = entries
    .map(([key, value]) => `${key}="${escapeLabelValue(String(value))}"`)
    .join(",");

  return `{${rendered}}`;
}

function counterKey(labels: Record<string, string | number>) {
  return JSON.stringify(labels);
}

function normalizeRoute(route: string) {
  if (!route) {
    return "unknown";
  }

  return route;
}

function clampNonNegative(value: number) {
  return value < 0 ? 0 : value;
}

export function incrementActiveRequests() {
  activeRequests += 1;
}

export function decrementActiveRequests() {
  activeRequests = clampNonNegative(activeRequests - 1);
}

export function recordHttpRequest(input: {
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
}) {
  const route = normalizeRoute(input.route);
  const statusClass = `${Math.floor(input.statusCode / 100)}xx`;
  const httpKey = counterKey({
    method: input.method,
    route,
    statusCode: input.statusCode,
    statusClass,
  });

  const currentCounter = httpCounters.get(httpKey);

  if (currentCounter) {
    currentCounter.count += 1;
  } else {
    httpCounters.set(httpKey, {
      method: input.method,
      route,
      statusCode: input.statusCode,
      statusClass,
      count: 1,
    });
  }

  const histogramKey = counterKey({
    method: input.method,
    route,
  });
  const currentHistogram = httpDurationHistograms.get(histogramKey);
  const bucketIndex = requestDurationBucketsMs.findIndex((bucket) => input.durationMs <= bucket);

  if (currentHistogram) {
    currentHistogram.count += 1;
    currentHistogram.sum += input.durationMs;

    if (bucketIndex >= 0) {
      currentHistogram.buckets[bucketIndex] += 1;
    }

    return;
  }

  const buckets = requestDurationBucketsMs.map((_bucket, index) => (index === bucketIndex ? 1 : 0));

  httpDurationHistograms.set(histogramKey, {
    method: input.method,
    route,
    count: 1,
    sum: input.durationMs,
    buckets,
  });
}

export function recordApplicationError(input: { source: string; type: string }) {
  const key = counterKey(input);
  const current = applicationErrorCounters.get(key);

  if (current) {
    current.count += 1;
    return;
  }

  applicationErrorCounters.set(key, {
    source: input.source,
    type: input.type,
    count: 1,
  });
}

export function recordSocketConnected() {
  socketConnectedClients += 1;
  socketConnectionsTotal += 1;
}

export function recordSocketDisconnected() {
  socketConnectedClients = clampNonNegative(socketConnectedClients - 1);
  socketDisconnectsTotal += 1;
}

function collectProcessSnapshot() {
  const memoryUsage = process.memoryUsage();
  const cpuUsage = process.cpuUsage(startupCpuUsage);

  return {
    uptimeSeconds: Number((process.uptime()).toFixed(3)),
    residentMemoryBytes: memoryUsage.rss,
    heapUsedBytes: memoryUsage.heapUsed,
    heapTotalBytes: memoryUsage.heapTotal,
    externalMemoryBytes: memoryUsage.external,
    cpuUserSeconds: cpuUsage.user / 1_000_000,
    cpuSystemSeconds: cpuUsage.system / 1_000_000,
    startedAt: new Date(startedAt).toISOString(),
  };
}

function computeLatencySummary() {
  let totalCount = 0;
  let totalDurationMs = 0;
  const aggregatedBuckets = requestDurationBucketsMs.map(() => 0);

  for (const histogram of httpDurationHistograms.values()) {
    totalCount += histogram.count;
    totalDurationMs += histogram.sum;

    histogram.buckets.forEach((value, index) => {
      aggregatedBuckets[index] += value;
    });
  }

  if (totalCount === 0) {
    return {
      averageMs: 0,
      p95Ms: 0,
    };
  }

  const threshold = totalCount * 0.95;
  let runningTotal = 0;
  let p95Ms = requestDurationBucketsMs[requestDurationBucketsMs.length - 1];

  for (let index = 0; index < aggregatedBuckets.length; index += 1) {
    runningTotal += aggregatedBuckets[index];

    if (runningTotal >= threshold) {
      p95Ms = requestDurationBucketsMs[index];
      break;
    }
  }

  return {
    averageMs: Number((totalDurationMs / totalCount).toFixed(2)),
    p95Ms,
  };
}

function countRequestsByStatusClass() {
  const summary: Record<string, number> = {};

  for (const counter of httpCounters.values()) {
    summary[counter.statusClass] = (summary[counter.statusClass] ?? 0) + counter.count;
  }

  return summary;
}

export function getMetricsSnapshot() {
  const requestTotals = Array.from(httpCounters.values()).reduce((sum, counter) => sum + counter.count, 0);
  const errorTotals = Array.from(applicationErrorCounters.values()).reduce(
    (sum, counter) => sum + counter.count,
    0,
  );

  return {
    process: collectProcessSnapshot(),
    http: {
      totalRequests: requestTotals,
      activeRequests,
      statusClasses: countRequestsByStatusClass(),
      latencyMs: computeLatencySummary(),
    },
    application: {
      totalErrors: errorTotals,
    },
    sockets: {
      connectedClients: socketConnectedClients,
      totalConnections: socketConnectionsTotal,
      totalDisconnects: socketDisconnectsTotal,
    },
  };
}

export function renderPrometheusMetrics() {
  const snapshot = getMetricsSnapshot();
  const lines: string[] = [];

  lines.push("# HELP app_active_requests Current in-flight HTTP requests");
  lines.push("# TYPE app_active_requests gauge");
  lines.push(`app_active_requests ${snapshot.http.activeRequests}`);

  lines.push("# HELP app_http_requests_total Total HTTP requests");
  lines.push("# TYPE app_http_requests_total counter");
  for (const counter of httpCounters.values()) {
    lines.push(
      `app_http_requests_total${formatLabels({
        method: counter.method,
        route: counter.route,
        status_code: counter.statusCode,
        status_class: counter.statusClass,
      })} ${counter.count}`,
    );
  }

  lines.push("# HELP app_http_request_duration_ms HTTP request duration in milliseconds");
  lines.push("# TYPE app_http_request_duration_ms histogram");
  for (const histogram of httpDurationHistograms.values()) {
    let cumulative = 0;

    histogram.buckets.forEach((bucketCount, index) => {
      cumulative += bucketCount;
      lines.push(
        `app_http_request_duration_ms_bucket${formatLabels({
          method: histogram.method,
          route: histogram.route,
          le: requestDurationBucketsMs[index],
        })} ${cumulative}`,
      );
    });

    lines.push(
      `app_http_request_duration_ms_bucket${formatLabels({
        method: histogram.method,
        route: histogram.route,
        le: "+Inf",
      })} ${histogram.count}`,
    );
    lines.push(
      `app_http_request_duration_ms_sum${formatLabels({
        method: histogram.method,
        route: histogram.route,
      })} ${Number(histogram.sum.toFixed(3))}`,
    );
    lines.push(
      `app_http_request_duration_ms_count${formatLabels({
        method: histogram.method,
        route: histogram.route,
      })} ${histogram.count}`,
    );
  }

  lines.push("# HELP app_application_errors_total Total application errors by source and type");
  lines.push("# TYPE app_application_errors_total counter");
  for (const counter of applicationErrorCounters.values()) {
    lines.push(
      `app_application_errors_total${formatLabels({
        source: counter.source,
        type: counter.type,
      })} ${counter.count}`,
    );
  }

  lines.push("# HELP process_uptime_seconds Node.js process uptime in seconds");
  lines.push("# TYPE process_uptime_seconds gauge");
  lines.push(`process_uptime_seconds ${snapshot.process.uptimeSeconds}`);

  lines.push("# HELP process_resident_memory_bytes Resident memory size in bytes");
  lines.push("# TYPE process_resident_memory_bytes gauge");
  lines.push(`process_resident_memory_bytes ${snapshot.process.residentMemoryBytes}`);

  lines.push("# HELP process_heap_used_bytes V8 heap used in bytes");
  lines.push("# TYPE process_heap_used_bytes gauge");
  lines.push(`process_heap_used_bytes ${snapshot.process.heapUsedBytes}`);

  lines.push("# HELP process_heap_total_bytes V8 heap total in bytes");
  lines.push("# TYPE process_heap_total_bytes gauge");
  lines.push(`process_heap_total_bytes ${snapshot.process.heapTotalBytes}`);

  lines.push("# HELP process_external_memory_bytes Node.js external memory in bytes");
  lines.push("# TYPE process_external_memory_bytes gauge");
  lines.push(`process_external_memory_bytes ${snapshot.process.externalMemoryBytes}`);

  lines.push("# HELP process_cpu_user_seconds_total User CPU time spent in seconds");
  lines.push("# TYPE process_cpu_user_seconds_total counter");
  lines.push(`process_cpu_user_seconds_total ${snapshot.process.cpuUserSeconds}`);

  lines.push("# HELP process_cpu_system_seconds_total System CPU time spent in seconds");
  lines.push("# TYPE process_cpu_system_seconds_total counter");
  lines.push(`process_cpu_system_seconds_total ${snapshot.process.cpuSystemSeconds}`);

  lines.push("# HELP app_socket_connected_clients Current connected Socket.IO clients");
  lines.push("# TYPE app_socket_connected_clients gauge");
  lines.push(`app_socket_connected_clients ${snapshot.sockets.connectedClients}`);

  lines.push("# HELP app_socket_connections_total Total Socket.IO connections");
  lines.push("# TYPE app_socket_connections_total counter");
  lines.push(`app_socket_connections_total ${snapshot.sockets.totalConnections}`);

  lines.push("# HELP app_socket_disconnects_total Total Socket.IO disconnects");
  lines.push("# TYPE app_socket_disconnects_total counter");
  lines.push(`app_socket_disconnects_total ${snapshot.sockets.totalDisconnects}`);

  return `${lines.join("\n")}\n`;
}
