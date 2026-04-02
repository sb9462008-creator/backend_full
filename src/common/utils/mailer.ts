import nodemailer from "nodemailer";

import { env } from "./env";
import { logger } from "./logger";

const transporter = env.SMTP_HOST
  ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_PORT === 465,
      auth:
        env.SMTP_USER && env.SMTP_PASS
          ? {
              user: env.SMTP_USER,
              pass: env.SMTP_PASS,
            }
          : undefined,
    })
  : nodemailer.createTransport({ jsonTransport: true });

export const isMailerConfigured = Boolean(env.SMTP_HOST);

export async function sendMail({
  to,
  subject,
  text,
  html,
}: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}) {
  const info = await transporter.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });

  if (isMailerConfigured) {
    logger.info("Email sent", {
      to,
      subject,
      accepted: info.accepted,
      rejected: info.rejected,
      messageId: info.messageId,
    });
  } else {
    const preview =
      typeof (info as { message?: unknown }).message === "string"
        ? (info as { message?: string }).message
        : undefined;

    logger.warn("SMTP is not configured; email captured locally only", {
      to,
      subject,
      preview,
      messageId: info.messageId,
    });
  }

  return info;
}
