import { Router } from "express";
import { z } from "zod";

import { authGuard } from "../../common/guards/auth.guard";
import { roleGuard } from "../../common/guards/role.guard";
import { validate } from "../../common/middleware/validate.middleware";
import { asyncHandler } from "../../common/utils/async-handler";
import { requireTenantId, requireUser } from "../../common/utils/request-context";
import { driversService } from "./drivers.service";
import {
  createDriverSchema,
  driverIdParamSchema,
  recordDriverLocationSchema,
  updateDriverSchema,
} from "./drivers.validation";

const router = Router();

const latestLocationParamSchema = {
  params: z.object({
    id: z.string().uuid(),
  }),
};

router.use(authGuard, roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "DRIVER"]));

router.get(
  "/",
  asyncHandler(async (request, response) => {
    response.json(await driversService.list(requireTenantId(request), requireUser(request)));
  }),
);

router.post(
  "/",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]),
  validate(createDriverSchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(await driversService.create(requireTenantId(request), request.body));
  }),
);

router.get(
  "/:id",
  validate(driverIdParamSchema),
  asyncHandler(async (request, response) => {
    response.json(await driversService.getById(requireTenantId(request), request.params.id as string, requireUser(request)));
  }),
);

router.patch(
  "/:id",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]),
  validate(updateDriverSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await driversService.update(requireTenantId(request), request.params.id as string, request.body),
    );
  }),
);

router.delete(
  "/:id",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]),
  validate(driverIdParamSchema),
  asyncHandler(async (request, response) => {
    response.json(await driversService.delete(requireTenantId(request), request.params.id as string));
  }),
);

router.post(
  "/:id/location",
  roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "DRIVER"]),
  validate(recordDriverLocationSchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(
      await driversService.recordLocation(
        requireTenantId(request),
        request.params.id as string,
        request.body,
        requireUser(request),
      ),
    );
  }),
);

router.get(
  "/:id/location/latest",
  validate(latestLocationParamSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await driversService.getLatestLocation(
        requireTenantId(request),
        request.params.id as string,
        requireUser(request),
      ),
    );
  }),
);

export default router;
