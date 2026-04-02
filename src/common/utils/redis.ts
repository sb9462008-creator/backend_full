import Redis from "ioredis";

import { env } from "./env";
import { logger } from "./logger";
import { recordApplicationError } from "./metrics";

export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
});

redis.on("error", (error) => {
  recordApplicationError({
    source: "redis",
    type: "client_error",
  });
  logger.error("Redis client error", {
    errorMessage: error.message,
  });
});

redis.on("ready", () => {
  logger.info("Redis client ready");
});

redis.on("reconnecting", () => {
  logger.warn("Redis client reconnecting");
});
