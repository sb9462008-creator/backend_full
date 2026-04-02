import { prisma } from "../../prisma/client";
import { getMetricsSnapshot } from "./metrics";
import { redis } from "./redis";

type DependencyHealth = {
  status: "ok" | "error";
  latencyMs: number;
  message?: string;
};

async function probeDependency(check: () => Promise<unknown>): Promise<DependencyHealth> {
  const startedAt = performance.now();

  try {
    await check();

    return {
      status: "ok",
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
    };
  } catch (error) {
    return {
      status: "error",
      latencyMs: Number((performance.now() - startedAt).toFixed(2)),
      message: error instanceof Error ? error.message : "Unknown dependency error",
    };
  }
}

export async function getDetailedHealth() {
  const [database, cache] = await Promise.all([
    probeDependency(() => prisma.$queryRaw`SELECT 1`),
    probeDependency(() => redis.ping()),
  ]);

  const overallStatus = database.status === "ok" && cache.status === "ok" ? "ok" : "degraded";

  return {
    status: overallStatus,
    service: "hurgelt-backend",
    timestamp: new Date().toISOString(),
    dependencies: {
      database,
      redis: cache,
    },
    metrics: getMetricsSnapshot(),
  };
}
