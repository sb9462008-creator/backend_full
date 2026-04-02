import path from "node:path";

import { ApiError } from "./api-error";
import { env } from "./env";

const uploadRoot = path.resolve(env.UPLOAD_DIR);
const safeFilenamePattern = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,254}$/;

export const allowedProofMimeTypes = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const allowedDocumentMimeTypes = new Set([
  ...allowedProofMimeTypes,
  "application/pdf",
  "text/plain",
  "text/csv",
  "application/json",
]);

export function buildStoredUploadFilename(originalName: string) {
  const sanitizedBaseName =
    path
      .basename(originalName)
      .replace(/[^a-zA-Z0-9._-]/g, "_")
      .replace(/_+/g, "_")
      .slice(0, 120) || "file";

  return `${Date.now()}-${sanitizedBaseName}`;
}

export function ensureAllowedUploadMimeType(
  mimetype: string,
  allowedMimeTypes: Set<string>,
  message: string,
) {
  if (!allowedMimeTypes.has(mimetype)) {
    throw new ApiError(400, message);
  }
}

export function resolveStoredUploadPath(filename: string) {
  if (!safeFilenamePattern.test(filename)) {
    throw new ApiError(400, "Invalid filename");
  }

  const resolvedPath = path.resolve(uploadRoot, filename);

  if (!resolvedPath.startsWith(`${uploadRoot}${path.sep}`)) {
    throw new ApiError(400, "Invalid filename");
  }

  return resolvedPath;
}
