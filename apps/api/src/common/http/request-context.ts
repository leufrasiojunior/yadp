import type { Request } from "express";

export function getRequestIp(request: Request) {
  const forwardedFor = request.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0]?.trim() ?? request.ip ?? null;
  }

  if (Array.isArray(forwardedFor)) {
    return forwardedFor[0] ?? request.ip ?? null;
  }

  return request.ip ?? null;
}
