import jwt from "jsonwebtoken";

import { env } from "./env";
import type { AuthUser } from "../types/auth";

const jwtIssuer = "hurgelt-backend";
const jwtAudience = "hurgelt-clients";

export function signToken(user: AuthUser) {
  return jwt.sign(user, env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"],
    issuer: jwtIssuer,
    audience: jwtAudience,
    subject: user.userId,
  });
}

export function verifyToken(token: string) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: jwtIssuer,
    audience: jwtAudience,
  }) as AuthUser;
}
