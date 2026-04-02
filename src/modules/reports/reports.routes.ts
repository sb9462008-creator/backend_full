import { Router } from "express";

import { authGuard } from "../../common/guards/auth.guard";
import { roleGuard } from "../../common/guards/role.guard";
import { asyncHandler } from "../../common/utils/async-handler";
import { requireTenantId } from "../../common/utils/request-context";
import { reportsService } from "./reports.service";

const router = Router();

router.use(authGuard, roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]));

router.get(
  "/deliveries",
  asyncHandler(async (request, response) => {
    const report = await reportsService.getDeliveriesReport(requireTenantId(request));
    response.json(report);
  }),
);

router.get(
  "/drivers",
  asyncHandler(async (request, response) => {
    const report = await reportsService.getDriversReport(requireTenantId(request));
    response.json(report);
  }),
);

export default router;
