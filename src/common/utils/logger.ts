import { inspect } from "node:util";

import { env } from "./env";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogFields = Record<string, unknown>;

const levelWeights: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const currentLevel = env.LOG_LEVEL;

function shouldLog(level: LogLevel) {
  return levelWeights[level] >= levelWeights[currentLevel];
}

function serializeError(error: Error) {
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
  };
}

function normalizeValue(value: unknown): unknown {
  if (value instanceof Error) {
    return serializeError(value);
  }

  if (typeof value === "bigint") {
    return value.toString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => normalizeValue(item));
  }

  if (value && typeof value === "object") {
    const normalizedEntries = Object.entries(value).map(([key, entryValue]) => [
      key,
      normalizeValue(entryValue),
    ]);

    return Object.fromEntries(normalizedEntries);
  }

  return value;
}

function normalizeFields(fields: LogFields): LogFields {
  return normalizeValue(fields) as LogFields;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}) {
  if (!shouldLog(level)) {
    return;
  }

  const normalizedFields = normalizeFields(fields);

  const payload = {
    timestamp: new Date().toISOString(),
    level,
    service: "hurgelt-backend",
    environment: env.NODE_ENV,
    message,
    ...normalizedFields,
  };

  const line = JSON.stringify(payload, (_key, value) => {
    if (typeof value === "undefined") {
      return null;
    }

    if (typeof value === "string") {
      return value;
    }

    return value;
  });

  if (level === "error") {
    console.error(line);
    return;
  }

  if (level === "warn") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  debug(message: string, fields?: LogFields) {
    emit("debug", message, fields);
  },
  info(message: string, fields?: LogFields) {
    emit("info", message, fields);
  },
  warn(message: string, fields?: LogFields) {
    emit("warn", message, fields);
  },
  error(message: string, fields?: LogFields) {
    emit("error", message, fields);
  },
  exception(message: string, error: unknown, fields: LogFields = {}) {
    if (error instanceof Error) {
      emit("error", message, {
        ...fields,
        error: serializeError(error),
      });
      return;
    }

    emit("error", message, {
      ...fields,
      error:
        typeof error === "string"
          ? error
          : inspect(error, {
              depth: 5,
              breakLength: Infinity,
            }),
    });
  },
};
