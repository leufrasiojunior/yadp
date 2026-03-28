export type SessionCookiePayload = {
  baselineInstanceId: string;
  sid: string;
  csrf: string;
  expiresAt: string;
  antiCsrfToken: string;
};
