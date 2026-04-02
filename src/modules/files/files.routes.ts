import fs from "node:fs";

import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { authGuard } from "../../common/guards/auth.guard";
import { roleGuard } from "../../common/guards/role.guard";
import { validate } from "../../common/middleware/validate.middleware";
import { env } from "../../common/utils/env";
import { ApiError } from "../../common/utils/api-error";
import {
  allowedDocumentMimeTypes,
  buildStoredUploadFilename,
  ensureAllowedUploadMimeType,
  resolveStoredUploadPath,
} from "../../common/utils/uploads";
import { filesService } from "./files.service";

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => {
    callback(null, env.UPLOAD_DIR);
  },
  filename: (_request, file, callback) => {
    callback(null, buildStoredUploadFilename(file.originalname));
  },
});

const upload = multer({
  storage,
  fileFilter: (_request, file, callback) => {
    try {
      ensureAllowedUploadMimeType(
        file.mimetype,
        allowedDocumentMimeTypes,
        "Only common document and image uploads are allowed",
      );
      callback(null, true);
    } catch (error) {
      callback(error as Error);
    }
  },
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const downloadFileParamSchema = {
  params: z.object({
    filename: z.string().min(1).max(255),
  }).strict(),
};

const router = Router();

router.use(authGuard, roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "DRIVER"]));

router.post("/upload", upload.single("file"), (request, response, next) => {
  try {
    if (!request.file) {
      throw new ApiError(400, "File is required");
    }

    response.status(201).json(filesService.toResponse(request.file));
  } catch (error) {
    next(error);
  }
});

router.get("/download/:filename", validate(downloadFileParamSchema), (request, response, next) => {
  const filePath = resolveStoredUploadPath(request.params.filename as string);

  response.download(filePath, (error) => {
    if (error) {
      next(new ApiError(404, "File not found"));
    }
  });
});

export default router;
