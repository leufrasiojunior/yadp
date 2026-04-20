import type { Request } from "express";

export const REQUEST_ID_HEADER = "x-request-id";

type RequestWithContext = Request & {
  requestId?: string;
};

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

export function getRequestId(request: Request) {
  return (request as RequestWithContext).requestId ?? null;
}

export function setRequestId(request: Request, requestId: string) {
  (request as RequestWithContext).requestId = requestId;
}
