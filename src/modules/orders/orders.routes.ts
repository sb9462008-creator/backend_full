import { Router } from "express";

import { authGuard } from "../../common/guards/auth.guard";
import { roleGuard } from "../../common/guards/role.guard";
import { validate } from "../../common/middleware/validate.middleware";
import { asyncHandler } from "../../common/utils/async-handler";
import { requireTenantId, requireUser } from "../../common/utils/request-context";
import { ordersService } from "./orders.service";
import { createOrderSchema, orderIdParamSchema } from "./orders.validation";

const router = Router();

router.use(authGuard, roleGuard(["CUSTOMER"]));

router.get(
  "/my",
  asyncHandler(async (request, response) => {
    const user = requireUser(request);
    response.json(await ordersService.listForCustomer(requireTenantId(request), user.userId));
  }),
);

router.post(
  "/",
  validate(createOrderSchema),
  asyncHandler(async (request, response) => {
    const user = requireUser(request);
    response.status(201).json(
      await ordersService.create({
        tenantId: requireTenantId(request),
        customerId: user.userId,
        ...request.body,
      }),
    );
  }),
);

router.get(
  "/:id",
  validate(orderIdParamSchema),
  asyncHandler(async (request, response) => {
    const user = requireUser(request);
    response.json(
      await ordersService.getForCustomer(
        requireTenantId(request),
        user.userId,
        request.params.id as string,
      ),
    );
  }),
);

export default router;
