import { Router } from "express";
import { authGuard } from "../../common/guards/auth.guard";
import { roleGuard } from "../../common/guards/role.guard";
import { asyncHandler } from "../../common/utils/async-handler";
import { requireTenantId } from "../../common/utils/request-context";
import { reportsService } from "../reports/reports.service";

const router = Router();

router.use(authGuard, roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]));

router.get(
  "/summary",
  asyncHandler(async (request, response) => {
    const summary = await reportsService.getDashboardSummary(requireTenantId(request));
    response.json(summary);
  }),
);

export default router;
