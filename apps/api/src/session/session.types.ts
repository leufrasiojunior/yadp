export type SessionCookiePayload = {
  authMethod: "pihole-master" | "yapd-password";
  baselineInstanceId: string;
  expiresAt: string;
  antiCsrfToken: string;
};
