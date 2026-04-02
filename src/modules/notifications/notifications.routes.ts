import { Router } from "express";

import { authGuard } from "../../common/guards/auth.guard";
import { roleGuard } from "../../common/guards/role.guard";
import { asyncHandler } from "../../common/utils/async-handler";
import { requireTenantId, requireUser } from "../../common/utils/request-context";
import { notificationsService } from "./notifications.service";

const router = Router();

router.use(authGuard, roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER", "DRIVER"]));

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const notifications = await notificationsService.listForActor(
      requireTenantId(request),
      requireUser(request),
    );
    response.json(notifications);
  }),
);

export default router;
