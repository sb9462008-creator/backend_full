import { Router } from "express";

import { authGuard } from "../../common/guards/auth.guard";
import { validate } from "../../common/middleware/validate.middleware";
import { asyncHandler } from "../../common/utils/async-handler";
import { requireUser } from "../../common/utils/request-context";
import { authService } from "./auth.service";
import { loginSchema, registerDriverSchema, registerSchema } from "./auth.validation";

const router = Router();

router.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (request, response) => {
    const result = await authService.register(request.body);
    response.status(201).json(result);
  }),
);

router.post(
  "/register-driver",
  validate(registerDriverSchema),
  asyncHandler(async (request, response) => {
    const result = await authService.registerDriver(request.body);
    response.status(201).json(result);
  }),
);

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (request, response) => {
    const result = await authService.login(request.body);
    response.json(result);
  }),
);

router.post(
  "/logout",
  authGuard,
  (_request, response) => {
    response.json({ success: true });
  },
);

router.get(
  "/me",
  authGuard,
  asyncHandler(async (request, response) => {
    const user = requireUser(request);
    response.json(await authService.me(user.userId, user.tenantId));
  }),
);

export default router;
