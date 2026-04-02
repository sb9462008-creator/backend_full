import fs from "node:fs";

import { Router } from "express";
import multer from "multer";

import { authGuard } from "../../common/guards/auth.guard";
import { roleGuard } from "../../common/guards/role.guard";
import { validate } from "../../common/middleware/validate.middleware";
import { asyncHandler } from "../../common/utils/async-handler";
import { env } from "../../common/utils/env";
import { ApiError } from "../../common/utils/api-error";
import {
  allowedProofMimeTypes,
  buildStoredUploadFilename,
  ensureAllowedUploadMimeType,
} from "../../common/utils/uploads";
import { requireTenantId, requireUser } from "../../common/utils/request-context";
import { deliveriesService } from "./deliveries.service";
import {
  assignDriverSchema,
  createDeliverySchema,
  deliveryIdParamSchema,
  driverLiveMapQuerySchema,
  proofBodySchema,
  trackingCodeParamSchema,
  updateDeliverySchema,
  updateStatusSchema,
} from "./deliveries.validation";

fs.mkdirSync(env.UPLOAD_DIR, { recursive: true });

const proofUpload = multer({
  storage: multer.diskStorage({
    destination: (_request, _file, callback) => callback(null, env.UPLOAD_DIR),
    filename: (_request, file, callback) => {
      callback(null, buildStoredUploadFilename(file.originalname));
    },
  }),
  fileFilter: (_request, file, callback) => {
    try {
      ensureAllowedUploadMimeType(file.mimetype, allowedProofMimeTypes, "Only image proof uploads are allowed");
      callback(null, true);
    } catch (error) {
      callback(error as Error);
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
});

const router = Router();

router.get(
  "/tracking/:trackingCode",
  validate(trackingCodeParamSchema),
  asyncHandler(async (request, response) => {
    response.json(await deliveriesService.getPublicTracking(request.params.trackingCode as string));
  }),
);

router.use(authGuard, roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "DRIVER"]));

router.get(
  "/",
  asyncHandler(async (request, response) => {
    response.json(await deliveriesService.list(requireTenantId(request), requireUser(request)));
  }),
);

router.post(
  "/",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]),
  validate(createDeliverySchema),
  asyncHandler(async (request, response) => {
    const user = requireUser(request);
    response
      .status(201)
      .json(await deliveriesService.create(requireTenantId(request), user.userId, request.body));
  }),
);

router.get(
  "/:id",
  validate(deliveryIdParamSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await deliveriesService.getById(
        requireTenantId(request),
        request.params.id as string,
        requireUser(request),
      ),
    );
  }),
);

router.patch(
  "/:id",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]),
  validate(updateDeliverySchema),
  asyncHandler(async (request, response) => {
    response.json(await deliveriesService.update(requireTenantId(request), request.params.id as string, request.body));
  }),
);

router.delete(
  "/:id",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]),
  validate(deliveryIdParamSchema),
  asyncHandler(async (request, response) => {
    response.json(await deliveriesService.delete(requireTenantId(request), request.params.id as string));
  }),
);

router.post(
  "/:id/assign-driver",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]),
  validate(assignDriverSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await deliveriesService.assignDriver(
        requireTenantId(request),
        request.params.id as string,
        request.body.driverId,
      ),
    );
  }),
);

router.post(
  "/:id/status",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "DRIVER"]),
  validate(updateStatusSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await deliveriesService.updateStatus(
        requireTenantId(request),
        request.params.id as string,
        request.body,
        requireUser(request),
      ),
    );
  }),
);

router.get(
  "/:id/events",
  validate(deliveryIdParamSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await deliveriesService.getEvents(
        requireTenantId(request),
        request.params.id as string,
        requireUser(request),
      ),
    );
  }),
);

router.post(
  "/:id/proof",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "DRIVER"]),
  validate(deliveryIdParamSchema),
  proofUpload.single("photo"),
  asyncHandler(async (request, response) => {
    const photoUrl = request.file ? `/uploads/${request.file.filename}` : undefined;
    const body = proofBodySchema.parse(request.body);

    if (!photoUrl && !body.recipientName && !body.notes && !body.otpVerified) {
      throw new ApiError(400, "Proof upload requires a photo, recipient, notes, or OTP verification");
    }

    response.status(201).json(
      await deliveriesService.addProof(requireTenantId(request), request.params.id as string, {
        ...body,
        photoUrl,
      }, requireUser(request)),
    );
  }),
);

router.get(
  "/live-map/drivers",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]),
  validate(driverLiveMapQuerySchema),
  asyncHandler(async (request, response) => {
    response.json(
      await deliveriesService.getDriverLiveMapData(requireTenantId(request), {
        latitude:
          typeof request.query.latitude === "number" ? request.query.latitude : undefined,
        longitude:
          typeof request.query.longitude === "number" ? request.query.longitude : undefined,
        radiusMeters:
          typeof request.query.radiusMeters === "number" ? request.query.radiusMeters : undefined,
      }),
    );
  }),
);

export default router;
