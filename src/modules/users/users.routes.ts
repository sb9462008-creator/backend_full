import { Router } from "express";

import { authGuard } from "../../common/guards/auth.guard";
import { roleGuard } from "../../common/guards/role.guard";
import { validate } from "../../common/middleware/validate.middleware";
import { asyncHandler } from "../../common/utils/async-handler";
import { requireTenantId } from "../../common/utils/request-context";
import { usersService } from "./users.service";
import { createUserSchema, updateUserSchema, userIdParamSchema } from "./users.validation";

const router = Router();

router.use(authGuard, roleGuard(["SUPER_ADMIN", "COMPANY_ADMIN", "DISPATCHER"]));

router.get(
  "/",
  asyncHandler(async (request, response) => {
    response.json(await usersService.list(requireTenantId(request)));
  }),
);

router.post(
  "/",
  validate(createUserSchema),
  asyncHandler(async (request, response) => {
    response.status(201).json(await usersService.create(requireTenantId(request), request.body));
  }),
);

router.get(
  "/:id",
  validate(userIdParamSchema),
  asyncHandler(async (request, response) => {
    response.json(await usersService.getById(requireTenantId(request), request.params.id as string));
  }),
);

router.patch(
  "/:id",
  validate(updateUserSchema),
  asyncHandler(async (request, response) => {
    response.json(
      await usersService.update(requireTenantId(request), request.params.id as string, request.body),
    );
  }),
);

router.delete(
  "/:id",
  validate(userIdParamSchema),
  asyncHandler(async (request, response) => {
    response.json(await usersService.delete(requireTenantId(request), request.params.id as string));
  }),
);

export default router;
